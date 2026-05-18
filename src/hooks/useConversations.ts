import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import type { ConversationDetails, ConversationMember, ConversationRow } from '../lib/types';

type RawConversationMember = {
  user_id: string;
  users: { username: string | null; avatar_url: string | null } | { username: string | null; avatar_url: string | null }[] | null;
};

type RawConversation = Omit<ConversationDetails, 'conversation_members'> & {
  conversation_members: RawConversationMember[] | null;
};

type RawConversationRow = {
  joined_at: string;
  last_read_at: string | null;
  conversations: RawConversation | RawConversation[] | null;
};

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const avatarUrlCache = new Map<string, { url: string; expiresAt: number }>();

const getCachedAvatarUrl = async (path: string) => {
  const now = Date.now();
  const cached = avatarUrlCache.get(path);
  // Cache for 55 minutes (Supabase signed URLs typically expire in 60 mins)
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }
  const url = await getValidMediaUrl('avatars', path);
  if (url) {
    avatarUrlCache.set(path, { url, expiresAt: now + 55 * 60 * 1000 });
  }
  return url;
};

export const useConversations = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');

  useEffect(() => {
    if (!user) return;

    const createChannel = () => supabase
      .channel(`conversation-members:${user.id}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          const conversationId = (payload.new as { conversation_id?: string } | null)?.conversation_id
            ?? (payload.old as { conversation_id?: string } | null)?.conversation_id;
          if (!conversationId) return;

          queryClient.setQueryData<ConversationRow[]>(['conversations', user.id], (oldRows) => {
            if (!oldRows) return oldRows;
            const index = oldRows.findIndex((row) => row.conversations?.id === conversationId);
            if (index === -1) return oldRows;
            const rows = [...oldRows];
            const [updated] = rows.splice(index, 1);
            rows.unshift(updated);
            return rows;
          });

          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        }
      );

    let channel = createChannel();
    const subscribeWithRetry = () => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
          }
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('reconnecting');
          supabase.removeChannel(channel);
          if (!retryTimeoutRef.current) {
            retryTimeoutRef.current = setTimeout(() => {
              channel = createChannel();
              retryTimeoutRef.current = null;
              subscribeWithRetry();
            }, 1500);
          }
        }
      });
    };

    subscribeWithRetry();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  const query = useQuery<ConversationRow[]>({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('conversation_members')
        .select(`joined_at,last_read_at,conversations (id,is_group,title,updated_at,messages (id,content,message_type,created_at,sender_id,opened_by,reactions,is_saved,is_ephemeral),conversation_members (user_id,users (username,avatar_url)))`)
        .eq('user_id', user.id)
        .order('created_at', { referencedTable: 'conversations.messages', ascending: false })
        .limit(1, { referencedTable: 'conversations.messages' });

      if (error) {
        console.error('Error fetching conversations:', error);
        return [];
      }

      const rows = (data ?? []) as unknown as RawConversationRow[];
      return Promise.all(
        rows.map(async (row) => {
          const conversation = pickFirst(row.conversations);
          if (!conversation) {
            return { ...row, conversations: null };
          }

          const members = conversation.conversation_members ?? [];
          const normalizedMembers = await Promise.all(
            members.map(async (member): Promise<ConversationMember> => {
              const firstUser = pickFirst(member.users);
              if (!firstUser?.avatar_url) {
                return { user_id: member.user_id, users: firstUser };
              }
              return {
                user_id: member.user_id,
                users: {
                  ...firstUser,
                  avatar_url: await getCachedAvatarUrl(firstUser.avatar_url),
                },
              };
            })
          );

          return {
            joined_at: row.joined_at,
            last_read_at: row.last_read_at,
            conversations: {
              ...conversation,
              conversation_members: normalizedMembers,
            },
          };
        })
      );
    },
    enabled: !!user,
    staleTime: 20_000,
  });

  return { ...query, realtimeStatus };
};
