import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

type ConversationMessage = {
  id: string;
  content: string | null;
  message_type: string;
  created_at: string;
  sender_id: string;
};

type ConversationMember = {
  user_id: string;
  users: {
    username: string | null;
    avatar_url: string | null;
  } | null;
};

type ConversationDetails = {
  id: string;
  is_group: boolean;
  title: string | null;
  updated_at: string;
  messages: ConversationMessage[] | null;
  conversation_members: ConversationMember[] | null;
};

export type ConversationRow = {
  joined_at: string;
  last_read_at: string | null;
  conversations: ConversationDetails | null;
};

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

export const useConversations = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
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
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  return useQuery<ConversationRow[]>({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('conversation_members')
        .select(`joined_at,last_read_at,conversations (id,is_group,title,updated_at,messages (id,content,message_type,created_at,sender_id),conversation_members (user_id,users (username,avatar_url)))`)
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
                  avatar_url: await getValidMediaUrl('avatars', firstUser.avatar_url),
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
};
