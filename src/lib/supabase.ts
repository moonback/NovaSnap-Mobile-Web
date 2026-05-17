import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Robustly converts any Supabase storage URL (public or signed) or relative path
 * into a fresh, valid signed URL with the specified expiry.
 */
export async function getValidMediaUrl(bucketName: string, urlOrPath: string): Promise<string> {
  if (!urlOrPath) return '';

  // If it's already a local/blob/data URL, return it as is.
  if (urlOrPath.startsWith('blob:') || urlOrPath.startsWith('data:')) {
    return urlOrPath;
  }

  // Extract the file path from the URL.
  // Supabase URL pattern: /storage/v1/object/[public|sign]/[bucketName]/[filePath...]
  let filePath = urlOrPath;
  if (urlOrPath.includes('/storage/v1/object/')) {
    const parts = urlOrPath.split('/storage/v1/object/');
    if (parts.length > 1) {
      const afterObject = parts[1].split('?')[0]; // remove query params
      const pathParts = afterObject.split('/');
      if (pathParts.length > 2) {
        // Skip the first part (public/sign) and second part (bucketName)
        filePath = pathParts.slice(2).join('/');
      }
    }
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 86400); // 24 hours expiry
      
    if (error || !data?.signedUrl) {
      console.warn(`Failed to create signed URL for bucket ${bucketName}, path ${filePath}:`, error);
      return urlOrPath; // fallback to original
    }
    return data.signedUrl;
  } catch (err) {
    console.error(`Error in getValidMediaUrl for bucket ${bucketName}:`, err);
    return urlOrPath; // fallback
  }
}

