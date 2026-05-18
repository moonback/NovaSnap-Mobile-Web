// ============================================================
// Edge Function: security-dashboard
// Deno runtime
//
// Returns aggregated security event data for abuse monitoring.
// Restricted to service-role callers only (admin use).
//
// GET /functions/v1/security-dashboard
//   ?hours=24          (default: 24, max: 168 = 7 days)
//   &event_type=...    (optional filter)
//   &severity=...      (optional filter: info|warn|error|critical)
//
// Returns:
//   {
//     summary: DashboardRow[],       -- aggregated by event_type
//     recent_events: SecurityEvent[], -- last 50 raw events
//     quota_config: QuotaConfig[],   -- current quota settings
//     top_offenders: OffenderRow[],  -- top 10 users by event count
//   }
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  // ── Service-role auth only ──
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Validate that the caller is using the service role key
  if (!authHeader || !authHeader.includes(serviceRoleKey)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Parse query params ──
  const url = new URL(req.url);
  const hoursParam = parseInt(url.searchParams.get('hours') ?? '24', 10);
  const hours = Math.min(Math.max(hoursParam, 1), 168); // clamp 1–168
  const eventTypeFilter = url.searchParams.get('event_type');
  const severityFilter = url.searchParams.get('severity');

  const since = new Date(Date.now() - hours * 3_600_000).toISOString();

  try {
    // ── 1. Aggregated summary ──
    let summaryQuery = supabase
      .from('security_events')
      .select('event_type, severity, resource_type, user_id, ip_address, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (eventTypeFilter) summaryQuery = summaryQuery.eq('event_type', eventTypeFilter);
    if (severityFilter)  summaryQuery = summaryQuery.eq('severity', severityFilter);

    const { data: rawEvents, error: eventsError } = await summaryQuery.limit(1000);
    if (eventsError) throw eventsError;

    // Aggregate in JS (avoids needing a custom RPC for the dashboard)
    type AggKey = string;
    const aggMap = new Map<AggKey, {
      event_type: string;
      severity: string;
      resource_type: string | null;
      event_count: number;
      unique_users: Set<string>;
      unique_ips: Set<string>;
      last_seen: string;
      first_seen: string;
    }>();

    for (const ev of rawEvents ?? []) {
      const key = `${ev.event_type}|${ev.severity}|${ev.resource_type ?? ''}`;
      const existing = aggMap.get(key);
      if (!existing) {
        aggMap.set(key, {
          event_type:    ev.event_type,
          severity:      ev.severity,
          resource_type: ev.resource_type,
          event_count:   1,
          unique_users:  new Set(ev.user_id ? [ev.user_id] : []),
          unique_ips:    new Set(ev.ip_address ? [ev.ip_address] : []),
          last_seen:     ev.created_at,
          first_seen:    ev.created_at,
        });
      } else {
        existing.event_count += 1;
        if (ev.user_id)    existing.unique_users.add(ev.user_id);
        if (ev.ip_address) existing.unique_ips.add(ev.ip_address);
        if (ev.created_at > existing.last_seen)  existing.last_seen  = ev.created_at;
        if (ev.created_at < existing.first_seen) existing.first_seen = ev.created_at;
      }
    }

    const summary = Array.from(aggMap.values())
      .map((row) => ({
        event_type:    row.event_type,
        severity:      row.severity,
        resource_type: row.resource_type,
        event_count:   row.event_count,
        unique_users:  row.unique_users.size,
        unique_ips:    row.unique_ips.size,
        last_seen:     row.last_seen,
        first_seen:    row.first_seen,
      }))
      .sort((a, b) => b.event_count - a.event_count);

    // ── 2. Recent raw events (last 50) ──
    const { data: recentEvents, error: recentError } = await supabase
      .from('security_events')
      .select('id, created_at, event_type, severity, user_id, ip_address, resource_type, details')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50);
    if (recentError) throw recentError;

    // ── 3. Current quota config ──
    const { data: quotaConfig, error: quotaError } = await supabase
      .from('quota_config')
      .select('resource_type, daily_limit, updated_at')
      .order('resource_type');
    if (quotaError) throw quotaError;

    // ── 4. Top offenders (users with most events in window) ──
    const userEventCounts = new Map<string, number>();
    for (const ev of rawEvents ?? []) {
      if (!ev.user_id) continue;
      userEventCounts.set(ev.user_id, (userEventCounts.get(ev.user_id) ?? 0) + 1);
    }
    const topOffenders = Array.from(userEventCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([user_id, event_count]) => ({ user_id, event_count }));

    return new Response(
      JSON.stringify({
        window_hours:   hours,
        since,
        summary,
        recent_events:  recentEvents ?? [],
        quota_config:   quotaConfig ?? [],
        top_offenders:  topOffenders,
        total_events:   rawEvents?.length ?? 0,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[security-dashboard] error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }
});
