import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Robustly converts any Supabase storage URL or relative path into a usable URL.
 *
 * Strategy by bucket:
 * - `avatars`, `stories`: public buckets — return the public URL directly.
 *   No signing needed; RLS SELECT policies allow authenticated reads globally.
 * - `chats`, `temporary_snaps`: private buckets — generate a fresh signed URL
 *   so the caller's auth context is embedded in the URL.
 *
 * If the input is already a valid absolute URL for a public bucket, it is
 * returned as-is (avoids an unnecessary round-trip to Supabase).
 */
export async function getValidMediaUrl(bucketName: string, urlOrPath: string): Promise<string> {
  if (!urlOrPath) return '';

  // Local/blob/data URLs — return as-is
  if (urlOrPath.startsWith('blob:') || urlOrPath.startsWith('data:')) {
    return urlOrPath;
  }

  // Extract the storage file path from any Supabase storage URL variant:
  //   /storage/v1/object/public/<bucket>/<filePath>
  //   /storage/v1/object/sign/<bucket>/<filePath>?token=...
  //   /storage/v1/object/authenticated/<bucket>/<filePath>
  let filePath = urlOrPath;
  if (urlOrPath.includes('/storage/v1/object/')) {
    const parts = urlOrPath.split('/storage/v1/object/');
    if (parts.length > 1) {
      // afterObject = "<access>/<bucket>/<filePath...>"
      const afterObject = parts[1].split('?')[0];
      const pathParts = afterObject.split('/');
      // pathParts[0] = access type (public/sign/authenticated)
      // pathParts[1] = bucket name
      // pathParts[2..] = actual file path
      if (pathParts.length > 2) {
        filePath = pathParts.slice(2).join('/');
      }
    }
  }

  // All buckets are private — always use signed URLs.
  const CHAT_BUCKETS = new Set(['chats', 'temporary_snaps']);
  const segments = filePath.split('/').filter(Boolean);
  const isLegacyPath = CHAT_BUCKETS.has(bucketName) && segments.length === 2;

  if (isLegacyPath) {
    // Check if the current user is the sender (first segment = their uid)
    const { data: { session } } = await supabase.auth.getSession();
    const currentUid = session?.user?.id;
    if (!currentUid || segments[0] !== currentUid) {
      // Recipient viewing a legacy media file — cannot sign, return empty
      // so the UI renders a placeholder instead of a broken image.
      return '';
    }
  }

  // Attempt to sign the URL (24h expiry)
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 86400);

    if (error || !data?.signedUrl) {
      // Only warn for non-chat buckets (chat legacy failures are expected and suppressed above)
      if (!CHAT_BUCKETS.has(bucketName)) {
        console.warn(`[getValidMediaUrl] Failed to sign ${bucketName}/${filePath}:`, error?.message ?? 'no signedUrl returned');
      }
      return '';
    }
    return data.signedUrl;
  } catch (err) {
    console.error(`[getValidMediaUrl] Exception signing ${bucketName}/${filePath}:`, err);
    return '';
  }
}

