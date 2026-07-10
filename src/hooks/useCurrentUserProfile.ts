import { useQuery } from '@tanstack/react-query';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

export type CurrentUserProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  snap_score: number | null;
};

export function useCurrentUserProfile() {
  const { user } = useAppStore();

  return useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url, bio, snap_score')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      if (data.avatar_url) {
        data.avatar_url = await getValidMediaUrl('avatars', data.avatar_url);
      }
      return data as CurrentUserProfile;
    },
    enabled: !!user,
  });
}
