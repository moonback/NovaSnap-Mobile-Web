import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import type { StoryRow } from '../lib/types';

type RawStoryRow = Omit<StoryRow, 'users'> & {
  users: { username: string | null; avatar_url: string | null }[] | null;
};

const storyUrlCache = new Map<string, { url: string; expiresAt: number }>();

const getCachedStoryUrl = async (path: string) => {
  const now = Date.now();
  const cached = storyUrlCache.get(path);
  // Cache for 55 minutes
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }
  const url = await getValidMediaUrl('stories', path);
  if (url) {
    storyUrlCache.set(path, { url, expiresAt: now + 55 * 60 * 1000 });
  }
  return url;
};

export const useStories = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`stories-realtime:${user.id}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stories' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['stories', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  return useQuery<StoryRow[]>({
    queryKey: ['stories', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('stories')
        .select(`id,media_url,media_type,created_at,expires_at,user_id,visibility,users!stories_user_id_fkey (username,avatar_url)`)
        .gt('expires_at', now)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching stories:', error);
        return [];
      }

      const rows = (data ?? []) as any[];
      return Promise.all(rows.map(async (story) => {
        let userObj = null;
        if (story.users) {
          userObj = Array.isArray(story.users) ? (story.users[0] ?? null) : story.users;
        }
        return {
          ...story,
          users: userObj,
          media_url: await getCachedStoryUrl(story.media_url),
        };
      }));
    },
    enabled: !!user,
    staleTime: 10_000,
    refetchInterval: 30_000, // Background fallback polling
  });
};
