import { useQuery } from '@tanstack/react-query';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

export const useConversations = () => {
  const { user } = useAppStore();

  return useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Note: we fetch conversations where the current user is a member
      const { data, error } = await supabase
        .from('conversation_members')
        .select(`
          joined_at,
          last_read_at,
          conversations (
            id,
            is_group,
            title,
            updated_at,
            messages (
              id,
              content,
              message_type,
              created_at,
              sender_id
            ),
            conversation_members (
              user_id,
              users (
                username,
                avatar_url
              )
            )
          )
        `)
        .eq('user_id', user.id)
        // Get the latest message for the snippet
        .order('created_at', { referencedTable: 'conversations.messages', ascending: false })
        .limit(1, { referencedTable: 'conversations.messages' });

      if (error) {
        console.error("Error fetching conversations:", error);
        return [];
      }

      // Resolve signed URLs for all avatars fetched
      const convsWithSignedAvatars = await Promise.all(
        (data as any[]).map(async (row) => {
          if (row.conversations?.conversation_members) {
            row.conversations.conversation_members = await Promise.all(
              row.conversations.conversation_members.map(async (member: any) => {
                if (member.users?.avatar_url) {
                  member.users.avatar_url = await getValidMediaUrl('avatars', member.users.avatar_url);
                }
                return member;
              })
            );
          }
          return row;
        })
      );

      return convsWithSignedAvatars;
    },
    enabled: !!user,
  });
};
