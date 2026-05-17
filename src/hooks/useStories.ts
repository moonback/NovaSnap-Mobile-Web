import { useQuery } from '@tanstack/react-query';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

type StoryRow = {
  id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  expires_at: string;
  user_id: string;
  users: {
    username: string | null;
    avatar_url: string | null;
  } | null;
};

type RawStoryRow = Omit<StoryRow, 'users'> & {
  users: { username: string | null; avatar_url: string | null }[] | null;
};

export const useStories = () => {
  const { user } = useAppStore();

  return useQuery<StoryRow[]>({
    queryKey: ['stories', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('stories')
        .select(`id,media_url,media_type,created_at,expires_at,user_id,users!stories_user_id_fkey (username,avatar_url)`)
        .gt('expires_at', now)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching stories:', error);
        return [];
      }

      const rows = (data ?? []) as unknown as RawStoryRow[];
      return Promise.all(rows.map(async (story) => ({
        ...story,
        users: story.users?.[0] ?? null,
        media_url: await getValidMediaUrl('stories', story.media_url),
      })));
    },
    enabled: !!user,
    staleTime: 15_000,
  });
};
