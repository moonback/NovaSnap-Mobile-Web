import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import type { MemoryRow, MemorySource } from '../lib/types';

// ── Fetch all memories for the current user ──────────────────
export const useMemories = () => {
  const { user } = useAppStore();

  return useQuery<MemoryRow[]>({
    queryKey: ['memories', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('memories')
        .select('id, user_id, media_url, media_type, caption, source, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching memories:', error);
        return [];
      }

      const rows = (data ?? []) as MemoryRow[];

      // Resolve signed URLs in parallel
      return Promise.all(
        rows.map(async (memory) => ({
          ...memory,
          media_url: await getValidMediaUrl('memories', memory.media_url),
        }))
      );
    },
    enabled: !!user,
    staleTime: 30_000,
  });
};

// ── Save a new memory ─────────────────────────────────────────
export const useSaveMemory = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      mediaBlob,
      mediaType,
      source = 'camera',
      caption,
    }: {
      mediaBlob: Blob;
      mediaType: 'IMAGE' | 'VIDEO';
      source?: MemorySource;
      caption?: string;
    }) => {
      if (!user) throw new Error('Non authentifié');

      const fileExt = mediaType === 'IMAGE' ? 'jpg' : 'webm';
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('memories')
        .upload(filePath, mediaBlob, {
          contentType: mediaBlob.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Insert DB row
      const { data, error: insertError } = await supabase
        .from('memories')
        .insert({
          user_id: user.id,
          media_url: filePath,
          media_type: mediaType,
          source,
          caption: caption ?? null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return data as MemoryRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories', user?.id] });
    },
  });
};

// ── Delete a memory ───────────────────────────────────────────
export const useDeleteMemory = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memoryId, storagePath }: { memoryId: string; storagePath: string }) => {
      if (!user) throw new Error('Non authentifié');

      // Delete from DB first
      const { error: dbError } = await supabase
        .from('memories')
        .delete()
        .eq('id', memoryId)
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      // Best-effort storage cleanup (extract path from signed URL if needed)
      let filePath = storagePath;
      if (storagePath.includes('/storage/v1/object/')) {
        const parts = storagePath.split('/storage/v1/object/');
        if (parts.length > 1) {
          const afterObject = parts[1].split('?')[0];
          const pathParts = afterObject.split('/');
          if (pathParts.length > 2) {
            filePath = pathParts.slice(2).join('/');
          }
        }
      }

      await supabase.storage.from('memories').remove([filePath]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories', user?.id] });
    },
  });
};

// ── Update caption ────────────────────────────────────────────
export const useUpdateMemoryCaption = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memoryId, caption }: { memoryId: string; caption: string }) => {
      if (!user) throw new Error('Non authentifié');

      const { error } = await supabase
        .from('memories')
        .update({ caption: caption.trim() || null })
        .eq('id', memoryId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories', user?.id] });
    },
  });
};
