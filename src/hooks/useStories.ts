import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

export const useStories = () => {
  const { user } = useAppStore();

  return useQuery({
    queryKey: ['stories', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Query active stories from friendships
      // For MVP, we might just query all active stories (expires_at > now()) where user_id is in friends list + own stories
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('stories')
        .select(`
          id,
          media_url,
          media_type,
          created_at,
          expires_at,
          user_id,
          users!stories_user_id_fkey (
            username,
            avatar_url
          )
        `)
        .gt('expires_at', now)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching stories:", JSON.stringify(error, null, 2));
        return [];
      }

      return data as any[];
    },
    enabled: !!user,
  });
};
