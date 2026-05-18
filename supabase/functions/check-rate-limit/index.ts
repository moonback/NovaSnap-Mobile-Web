// ============================================================
// Edge Function: check-rate-limit
// Deno runtime
//
// Enforces per-user daily quotas and per-IP write rate limits
// for messages, stories, uploads, and AI sessions.
//
// Called by the client BEFORE performing a write operation.
// Returns 200 { allowed: true } or 429 { allowed: false, ... }.
//
// Request body:
//   { resource_type: 'message' | 'story' | 'upload' | 'ai_session' }
//
// Auth: Bearer JWT (Supabase anon key + user JWT in Authorization header)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Types ─────────────────────────────────────────────────────

interface RateLimitRequest {
  resource_type: 'message' | 'story' | 'upload' | 'ai_session';
}

interface RateLimitResponse {
  allowed: boolean;
  resource_type: string;
  reason?: string;
  retry_after?: string; // ISO date of next reset (midnight UTC)
  daily_limit?: number;
  current_count?: number;
}

// ── In-memory IP rate limiter (per function instance) ─────────
// Tracks write attempts per IP in a sliding 60-second window.
// This is a best-effort guard; the DB quota is the authoritative limit.
const ipWriteAttempts = new Map<string, { count: number; windowStart: number }>();
const IP_WINDOW_MS = 60_000;       // 1 minute window
const IP_MAX_WRITES_PER_WINDOW = 60; // max 60 writes/min per IP

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipWriteAttempts.get(ip);

  if (!entry || now - entry.windowStart > IP_WINDOW_MS) {
    ipWriteAttempts.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= IP_MAX_WRITES_PER_WINDOW) {
    return false;
  }

  entry.count += 1;
  return true;
}

// ── Helpers ───────────────────────────────────────────────────

function nextMidnightUtc(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

function jsonResponse(body: RateLimitResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// ── Main handler ──────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  // ── Extract client IP ──
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  // ── IP-level rate limit (fast path, no DB) ──
  if (!checkIpRateLimit(ip)) {
    // Log abuse event via service role client
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      await supabaseAdmin.rpc('log_security_event', {
        p_event_type:    'ip_rate_limit_exceeded',
        p_severity:      'warn',
        p_user_id:       null,
        p_ip_address:    ip,
        p_resource_type: null,
        p_details:       { window_ms: IP_WINDOW_MS, limit: IP_MAX_WRITES_PER_WINDOW },
      });
    } catch (_) { /* non-fatal */ }

    return jsonResponse(
      {
        allowed: false,
        resource_type: 'unknown',
        reason: 'IP rate limit exceeded. Too many requests.',
        retry_after: new Date(Date.now() + IP_WINDOW_MS).toISOString(),
      },
      429,
    );
  }

  // ── Parse and validate request body ──
  let body: RateLimitRequest;
  try {
    body = await req.json() as RateLimitRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  const validTypes = ['message', 'story', 'upload', 'ai_session'] as const;
  if (!validTypes.includes(body.resource_type as typeof validTypes[number])) {
    return new Response(
      JSON.stringify({ error: `Invalid resource_type. Must be one of: ${validTypes.join(', ')}` }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders() } },
    );
  }

  // ── Authenticate the user ──
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  const jwt = authHeader.slice(7);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // User-scoped client to verify JWT and call check_and_increment_quota
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  // ── Daily quota check (DB-authoritative) ──
  // check_and_increment_quota uses auth.uid() — works because we pass the user JWT.
  const { data: allowed, error: quotaError } = await supabaseUser.rpc(
    'check_and_increment_quota',
    { p_resource_type: body.resource_type },
  );

  if (quotaError) {
    console.error('[check-rate-limit] quota RPC error:', quotaError.message);
    // Fail open on unexpected DB errors to avoid blocking legitimate users
    return jsonResponse({ allowed: true, resource_type: body.resource_type }, 200);
  }

  if (!allowed) {
    // Fetch current usage for informative response
    const { data: usageRows } = await supabaseUser.rpc('get_daily_usage');
    const row = (usageRows as Array<{ resource_type: string; count: number; daily_limit: number }> | null)
      ?.find((r) => r.resource_type === body.resource_type);

    // Log the abuse event with IP context via service role
    try {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      await supabaseAdmin.rpc('log_security_event', {
        p_event_type:    'quota_exceeded',
        p_severity:      'warn',
        p_user_id:       user.id,
        p_ip_address:    ip,
        p_resource_type: body.resource_type,
        p_details: {
          current_count: row?.count ?? null,
          daily_limit:   row?.daily_limit ?? null,
          source:        'edge_function',
        },
      });
    } catch (_) { /* non-fatal */ }

    return jsonResponse(
      {
        allowed: false,
        resource_type: body.resource_type,
        reason: `Daily ${body.resource_type} quota exceeded.`,
        retry_after: nextMidnightUtc(),
        daily_limit: row?.daily_limit,
        current_count: row?.count,
      },
      429,
    );
  }

  return jsonResponse({ allowed: true, resource_type: body.resource_type }, 200);
});
