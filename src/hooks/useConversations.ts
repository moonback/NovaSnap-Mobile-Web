import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
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

      return data as any[];
    },
    enabled: !!user,
  });
};
