// ============================================================
// Edge Function: send-push-notification
// Deno runtime — utilise Web Crypto API native (pas de npm)
// Déclenchée par un trigger DB via pg_net ou appelée directement
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Types ─────────────────────────────────────────────────────
interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown>;
}

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ── Helpers base64url ─────────────────────────────────────────
function base64UrlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64 + padding);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Générer le JWT VAPID ──────────────────────────────────────
async function generateVapidJwt(
  audience: string,
  vapidPrivateKeyB64: string,
  vapidPublicKeyB64: string,
  subject: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 3600; // 12h

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp, sub: subject };

  const encodedHeader = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedPayload = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Importer la clé privée VAPID (format raw EC P-256)
  const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKeyB64);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = uint8ArrayToBase64Url(new Uint8Array(signature));
  return `${signingInput}.${encodedSignature}`;
}

// ── Chiffrement du payload (RFC 8291 — aes128gcm) ────────────
async function encryptPayload(
  payload: string,
  clientPublicKeyB64: string,
  authSecretB64: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(payload);

  // Clé publique du client
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    base64UrlToUint8Array(clientPublicKeyB64),
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );

  // Générer une paire de clés éphémères serveur
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  // Exporter la clé publique serveur (format raw, 65 bytes)
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  );

  // ECDH — dériver les bits partagés
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    serverKeyPair.privateKey,
    256
  );

  const authSecret = base64UrlToUint8Array(authSecretB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF pour dériver la clé de chiffrement et le nonce (RFC 8291)
  const ikm = await hkdf(
    new Uint8Array(sharedBits),
    authSecret,
    buildInfo('auth', new Uint8Array(0), new Uint8Array(0)),
    32
  );

  const clientPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', clientPublicKey)
  );

  const contentEncryptionKey = await hkdf(
    ikm,
    salt,
    buildInfo('aesgcm', clientPublicKeyRaw, serverPublicKeyRaw),
    16
  );

  const nonce = await hkdf(
    ikm,
    salt,
    buildInfo('nonce', clientPublicKeyRaw, serverPublicKeyRaw),
    12
  );

  // Chiffrer avec AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw',
    contentEncryptionKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Padding (2 bytes de longueur + payload)
  const paddedPlaintext = new Uint8Array(plaintext.length + 2);
  paddedPlaintext[0] = 0;
  paddedPlaintext[1] = 0;
  paddedPlaintext.set(plaintext, 2);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey,
      paddedPlaintext
    )
  );

  return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw };
}

// ── HKDF helper ───────────────────────────────────────────────
async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

function buildInfo(type: string, clientKey: Uint8Array, serverKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(`Content-Encoding: ${type}\0`);
  const contextBytes = new Uint8Array(
    1 + 2 + clientKey.length + 2 + serverKey.length
  );
  let offset = 0;
  contextBytes[offset++] = 0x00; // P-256 label
  contextBytes[offset++] = (clientKey.length >> 8) & 0xff;
  contextBytes[offset++] = clientKey.length & 0xff;
  contextBytes.set(clientKey, offset);
  offset += clientKey.length;
  contextBytes[offset++] = (serverKey.length >> 8) & 0xff;
  contextBytes[offset++] = serverKey.length & 0xff;
  contextBytes.set(serverKey, offset);

  const result = new Uint8Array(typeBytes.length + contextBytes.length);
  result.set(typeBytes);
  result.set(contextBytes, typeBytes.length);
  return result;
}

// ── Envoyer une notification push à une subscription ─────────
async function sendWebPush(
  subscription: PushSubscription,
  payloadJson: string,
  vapidPrivateKey: string,
  vapidPublicKey: string,
  vapidSubject: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  // Générer le JWT VAPID
  const jwt = await generateVapidJwt(audience, vapidPrivateKey, vapidPublicKey, vapidSubject);

  // Chiffrer le payload
  const { ciphertext, salt, serverPublicKey } = await encryptPayload(
    payloadJson,
    subscription.p256dh,
    subscription.auth
  );

  // Construire le corps de la requête (format aesgcm)
  const body = ciphertext;

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Encryption': `salt=${uint8ArrayToBase64Url(salt)}`,
      'Crypto-Key': `dh=${uint8ArrayToBase64Url(serverPublicKey)};p256ecdsa=${vapidPublicKey}`,
      'Authorization': `vapid t=${jwt},k=${vapidPublicKey}`,
      'TTL': '86400',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { ok: false, status: response.status, error: text };
  }

  return { ok: true, status: response.status };
}

// ── Handler principal ─────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Vérifier les variables d'environnement
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@novasnap.app';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!vapidPrivateKey || !vapidPublicKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parser le body
    const body = await req.json() as PushPayload;
    const { user_id, title, body: notifBody, type, data = {} } = body;

    if (!user_id || !title || !notifBody) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, title, body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Client Supabase avec service role (accès complet)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Récupérer toutes les subscriptions de l'utilisateur
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id);

    if (subError) {
      return new Response(
        JSON.stringify({ error: subError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'No subscriptions found for user' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Payload JSON à envoyer
    const pushPayload = JSON.stringify({ title, body: notifBody, type, data });

    // Envoyer à toutes les subscriptions en parallèle
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        sendWebPush(sub as PushSubscription, pushPayload, vapidPrivateKey, vapidPublicKey, vapidSubject)
      )
    );

    // Nettoyer les subscriptions expirées (status 410 = Gone)
    const expiredEndpoints: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value.status === 410) {
        expiredEndpoints.push(subscriptions[i].endpoint);
      }
    });

    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    const sent = results.filter(
      (r) => r.status === 'fulfilled' && r.value.ok
    ).length;

    return new Response(
      JSON.stringify({
        sent,
        total: subscriptions.length,
        expired_cleaned: expiredEndpoints.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
