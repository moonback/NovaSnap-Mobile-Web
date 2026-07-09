import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import type { FriendWithProfile, FriendshipStatus } from '../lib/types';

// ── Raw DB row shape ─────────────────────────────────────────
type RawFriendshipRow = {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
};

type RawUserProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  snap_score: number | null;
};

// ── Query key ────────────────────────────────────────────────
const FRIENDS_QUERY_KEY = (userId: string) => ['friends', userId] as const;

// ── Fetch Helper for pagination ──────────────────────────────
async function fetchFriendshipsPage(userId: string, pageParam: number, limit: number): Promise<FriendWithProfile[]> {
  const { data: rows, error } = await supabase
    .from('friendships_resolved')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(pageParam * limit, (pageParam + 1) * limit - 1);

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  return Promise.all(
    rows.map(async (row): Promise<FriendWithProfile> => {
      const avatarUrl = row.friend_avatar_url
        ? await getValidMediaUrl('avatars', row.friend_avatar_url)
        : null;

      return {
        friendship_id: row.friendship_id,
        friendship_status: row.friendship_status,
        is_requester: row.is_requester,
        user: {
          id: row.friend_id,
          username: row.friend_username,
          display_name: row.friend_display_name,
          avatar_url: avatarUrl,
          bio: row.friend_bio,
          snap_score: row.friend_snap_score || 0,
        },
      };
    })
  );
}


// ── Hook ─────────────────────────────────────────────────────
export function useFriends() {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Realtime subscription ──────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`friendships:${user.id}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY(user.id) });
          queryClient.invalidateQueries({ queryKey: ['friendships-counts', user.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `friend_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY(user.id) });
          queryClient.invalidateQueries({ queryKey: ['friendships-counts', user.id] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, queryClient]);

  // ── Friends Count Query ────────────────────────────────────
  const { data: counts = { friendsCount: 0, pendingCount: 0 } } = useQuery({
    queryKey: ['friendships-counts', user?.id],
    queryFn: async () => {
      if (!user) return { friendsCount: 0, pendingCount: 0 };
      
      const { count: friendsCount, error: friendsErr } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'ACCEPTED');

      if (friendsErr) throw friendsErr;

      const { count: pendingCount, error: pendingErr } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', user.id)
        .eq('status', 'PENDING');

      if (pendingErr) throw pendingErr;

      return {
        friendsCount: friendsCount ?? 0,
        pendingCount: pendingCount ?? 0,
      };
    },
    enabled: !!user,
  });

  // ── Query ──────────────────────────────────────────────────
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: FRIENDS_QUERY_KEY(user?.id ?? ''),
    queryFn: ({ pageParam = 0 }) => fetchFriendshipsPage(user!.id, pageParam as number, 20),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 20 ? allPages.length : undefined;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const allFriendships = data ? data.pages.flatMap((page) => page) : [];

  // ── Derived lists ──────────────────────────────────────────
  const friends = allFriendships.filter((f) => f.friendship_status === 'ACCEPTED');
  const pendingReceived = allFriendships.filter(
    (f) => f.friendship_status === 'PENDING' && !f.is_requester
  );
  const pendingSent = allFriendships.filter(
    (f) => f.friendship_status === 'PENDING' && f.is_requester
  );
  const friendCount = counts.friendsCount;
  const pendingCount = counts.pendingCount;

  // ── Mutations ──────────────────────────────────────────────

  const sendFriendRequestMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('friendships').insert({
        user_id: user.id,
        friend_id: targetUserId,
        status: 'PENDING',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY(user.id) });
        queryClient.invalidateQueries({ queryKey: ['friendships-counts', user.id] });
      }
    },
  });

  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
        .eq('id', friendshipId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY(user.id) });
        queryClient.invalidateQueries({ queryKey: ['friendships-counts', user.id] });
      }
    },
  });

  const declineFriendRequestMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY(user.id) });
        queryClient.invalidateQueries({ queryKey: ['friendships-counts', user.id] });
      }
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY(user.id) });
        queryClient.invalidateQueries({ queryKey: ['friendships-counts', user.id] });
      }
    },
  });

  const blockUserMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'BLOCKED', updated_at: new Date().toISOString() })
        .eq('id', friendshipId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY(user.id) });
        queryClient.invalidateQueries({ queryKey: ['friendships-counts', user.id] });
      }
    },
  });

  // ── Utility ────────────────────────────────────────────────
  const getFriendshipStatus = (targetUserId: string): FriendshipStatus | null => {
    const found = allFriendships.find((f) => f.user.id === targetUserId);
    return found?.friendship_status ?? null;
  };

  return {
    friends,
    pendingReceived,
    pendingSent,
    friendCount,
    pendingCount,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    sendFriendRequest: sendFriendRequestMutation.mutateAsync,
    acceptFriendRequest: acceptFriendRequestMutation.mutateAsync,
    declineFriendRequest: declineFriendRequestMutation.mutateAsync,
    removeFriend: removeFriendMutation.mutateAsync,
    blockUser: blockUserMutation.mutateAsync,
    getFriendshipStatus,
  };
}
