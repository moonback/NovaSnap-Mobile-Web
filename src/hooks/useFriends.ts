import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

// ── Fetch helper ─────────────────────────────────────────────
async function fetchFriendships(userId: string): Promise<FriendWithProfile[]> {
  // Fetch all friendships where I am user_id
  const { data: asSender, error: senderError } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status, created_at, updated_at')
    .eq('user_id', userId);

  if (senderError) throw senderError;

  // Fetch all friendships where I am friend_id
  const { data: asReceiver, error: receiverError } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status, created_at, updated_at')
    .eq('friend_id', userId);

  if (receiverError) throw receiverError;

  const allRows: RawFriendshipRow[] = [
    ...((asSender as RawFriendshipRow[]) ?? []),
    ...((asReceiver as RawFriendshipRow[]) ?? []),
  ];

  if (allRows.length === 0) return [];

  // Collect all other user IDs
  const otherUserIds = allRows.map((row) =>
    row.user_id === userId ? row.friend_id : row.user_id
  );
  const uniqueIds = [...new Set(otherUserIds)];

  // Fetch profiles for all those users
  const { data: profiles, error: profilesError } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url, bio, snap_score')
    .in('id', uniqueIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map<string, RawUserProfile>(
    ((profiles as RawUserProfile[]) ?? []).map((p) => [p.id, p])
  );

  // Resolve signed avatar URLs in parallel
  const resolvedProfiles = new Map<string, RawUserProfile & { avatar_url: string | null }>();
  await Promise.all(
    uniqueIds.map(async (id) => {
      const profile = profileMap.get(id);
      if (!profile) return;
      const avatarUrl = profile.avatar_url
        ? await getValidMediaUrl('avatars', profile.avatar_url)
        : null;
      resolvedProfiles.set(id, { ...profile, avatar_url: avatarUrl });
    })
  );

  // Build FriendWithProfile array
  return allRows.map((row): FriendWithProfile => {
    const isRequester = row.user_id === userId;
    const otherId = isRequester ? row.friend_id : row.user_id;
    const profile = resolvedProfiles.get(otherId);

    return {
      friendship_id: row.id,
      friendship_status: row.status,
      is_requester: isRequester,
      user: {
        id: otherId,
        username: profile?.username ?? null,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        bio: profile?.bio ?? null,
        snap_score: profile?.snap_score ?? 0,
      },
    };
  });
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
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, queryClient]);

  // ── Query ──────────────────────────────────────────────────
  const { data: allFriendships = [], isLoading } = useQuery({
    queryKey: FRIENDS_QUERY_KEY(user?.id ?? ''),
    queryFn: () => fetchFriendships(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });

  // ── Derived lists ──────────────────────────────────────────
  const friends = allFriendships.filter((f) => f.friendship_status === 'ACCEPTED');
  const pendingReceived = allFriendships.filter(
    (f) => f.friendship_status === 'PENDING' && !f.is_requester
  );
  const pendingSent = allFriendships.filter(
    (f) => f.friendship_status === 'PENDING' && f.is_requester
  );
  const friendCount = friends.length;
  const pendingCount = pendingReceived.length;

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
      if (user) queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY(user.id) });
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
      if (user) queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY(user.id) });
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
      if (user) queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY(user.id) });
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
      if (user) queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY(user.id) });
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
      if (user) queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY(user.id) });
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
    sendFriendRequest: sendFriendRequestMutation.mutateAsync,
    acceptFriendRequest: acceptFriendRequestMutation.mutateAsync,
    declineFriendRequest: declineFriendRequestMutation.mutateAsync,
    removeFriend: removeFriendMutation.mutateAsync,
    blockUser: blockUserMutation.mutateAsync,
    getFriendshipStatus,
  };
}
