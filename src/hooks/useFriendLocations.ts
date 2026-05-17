import { useQuery } from '@tanstack/react-query';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

export type FriendLocation = {
  user_id:    string;
  username:   string;
  avatar_url: string | null;
  lat:        number;
  lng:        number;
  distance_m: number;
  updated_at: string;
};

export function useFriendLocations(
  userLat: number | null,
  userLng: number | null,
) {
  const { user } = useAppStore();
  const ghostMode =
    localStorage.getItem('novasnap_settings_ghost_mode') === 'true';

  return useQuery({
    queryKey: ['friend-locations', userLat, userLng],
    queryFn: async () => {
      if (!user || userLat == null || userLng == null) return [];
      const { data, error } = await supabase.rpc('get_nearby_friends', {
        p_lat: userLat, p_lng: userLng, p_radius: 50_000,
      });
      if (error) throw error;
      return Promise.all(
        (data as FriendLocation[]).map(async f => ({
          ...f,
          avatar_url: f.avatar_url
            ? await getValidMediaUrl('avatars', f.avatar_url)
            : null,
        })),
      );
    },
    enabled: !!user && !ghostMode && userLat != null && userLng != null,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
