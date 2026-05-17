import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { ChevronLeft, Send, Camera as CameraIcon, Loader2, Bookmark, BookmarkCheck } from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EphemeralMedia from '../components/chat/EphemeralMedia';

type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO';

type RawMessage = Omit<Message, 'users'> & {
  users?: { username: string }[] | { username: string };
};

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  message_type: MessageType;
  media_url?: string;
  is_ephemeral?: boolean;
  is_saved?: boolean;
  opened_by?: string[];
  users?: { username: string };
  pending?: boolean;
  client_hash?: string;
  client_message_id?: string;
}

export default function ConversationScreen({
  conversationId,
  onBack,
  title = 'Chat',
  avatarUrl,
}: {
  conversationId: string;
  onBack: () => void;
  title?: string;
  avatarUrl?: string;
}) {
  const { user, setCurrentView, setDirectChatId } = useAppStore();
  const [newMessage, setNewMessage] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  // ─── Fetch messages ────────────────────────────────────────────────────────
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(
          `id,content,message_type,media_url,created_at,sender_id,
           client_message_id,is_ephemeral,is_saved,opened_by,users (username)`
        )
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messagesWithSignedUrls = await Promise.all(
        ((data ?? []) as RawMessage[]).map(async (rawMsg) => {
          const normalizedUser = Array.isArray(rawMsg.users)
            ? rawMsg.users[0]
            : rawMsg.users;
          const msg: Message = { ...rawMsg, users: normalizedUser };
          if (
            msg.media_url &&
            (msg.message_type === 'IMAGE' || msg.message_type === 'VIDEO')
          ) {
            const signedUrl = await getValidMediaUrl('chats', msg.media_url);
            return { ...msg, media_url: signedUrl };
          }
          return msg;
        })
      );

      return messagesWithSignedUrls;
    },
  });

  // ─── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          let newMsg = payload.new as Message;
          if (
            newMsg.media_url &&
            (newMsg.message_type === 'IMAGE' || newMsg.message_type === 'VIDEO')
          ) {
            const signedUrl = await getValidMediaUrl('chats', newMsg.media_url);
            newMsg = { ...newMsg, media_url: signedUrl };
          }

          queryClient.setQueryData<Message[]>(
            ['messages', conversationId],
            (oldData) => {
              if (!oldData) return [newMsg];
              if (oldData.some((m) => m.id === newMsg.id)) return oldData;
              const withoutPendingEcho = oldData.filter((m) => {
                if (!m.pending) return true;
                if (m.client_message_id && newMsg.client_message_id) {
                  return m.client_message_id !== newMsg.client_message_id;
                }
                return !(
                  m.sender_id === newMsg.sender_id &&
                  m.content === newMsg.content
                );
              });
              return [...withoutPendingEcho, newMsg];
            }
          );

          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          queryClient.setQueryData<Message[]>(
            ['messages', conversationId],
            (oldData) => {
              if (!oldData) return oldData;
              return oldData.map((m) =>
                m.id === updated.id ? { ...m, ...updated } : m
              );
            }
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          queryClient.setQueryData<Message[]>(
            ['messages', conversationId],
            (oldData) => oldData?.filter((m) => m.id !== deletedId) ?? []
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // ─── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Mark text message as opened (triggers ephemeral delete for recipient) ─
  const markAsOpened = useCallback(
    async (msg: Message) => {
      if (!user) return;
      // Only act on ephemeral text messages not yet opened by this user
      if (
        msg.message_type !== 'TEXT' ||
        !msg.is_ephemeral ||
        msg.is_saved ||
        msg.sender_id === user.id ||
        msg.opened_by?.includes(user.id)
      )
        return;

      const newOpenedBy = [...(msg.opened_by ?? []), user.id];

      // Optimistic update
      queryClient.setQueryData<Message[]>(
        ['messages', conversationId],
        (old) =>
          old?.map((m) =>
            m.id === msg.id ? { ...m, opened_by: newOpenedBy } : m
          ) ?? []
      );

      await supabase
        .from('messages')
        .update({ opened_by: newOpenedBy })
        .eq('id', msg.id);
    },
    [user, conversationId, queryClient]
  );

  // ─── Delete ephemeral text after both sides have opened it ─────────────────
  useEffect(() => {
    if (!messages || !user) return;
    messages.forEach(async (msg) => {
      if (
        msg.message_type !== 'TEXT' ||
        !msg.is_ephemeral ||
        msg.is_saved ||
        !msg.opened_by
      )
        return;

      // Delete once the recipient (non-sender) has opened it
      const recipientOpened =
        msg.sender_id === user.id
          ? // I'm the sender: delete when the other side opened it
            msg.opened_by.some((uid) => uid !== user.id)
          : // I'm the recipient: delete once I've opened it (already marked above)
            msg.opened_by.includes(user.id);

      if (recipientOpened) {
        // Remove from local cache immediately
        queryClient.setQueryData<Message[]>(
          ['messages', conversationId],
          (old) => old?.filter((m) => m.id !== msg.id) ?? []
        );
        // Delete from DB
        await supabase.from('messages').delete().eq('id', msg.id);
      }
    });
  }, [messages, user, conversationId, queryClient]);

  // ─── Toggle save (long-press) ──────────────────────────────────────────────
  const toggleSave = useCallback(
    async (msg: Message) => {
      if (!user || savingId) return;
      setSavingId(msg.id);

      const newSaved = !msg.is_saved;

      // Optimistic update
      queryClient.setQueryData<Message[]>(
        ['messages', conversationId],
        (old) =>
          old?.map((m) =>
            m.id === msg.id ? { ...m, is_saved: newSaved } : m
          ) ?? []
      );

      await supabase
        .from('messages')
        .update({ is_saved: newSaved })
        .eq('id', msg.id);

      setSavingId(null);
    },
    [user, savingId, conversationId, queryClient]
  );

  // Long-press handlers
  const handlePressStart = (msg: Message) => {
    longPressTimerRef.current = setTimeout(() => {
      toggleSave(msg);
    }, 500);
  };

  const handlePressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // ─── Send message ──────────────────────────────────────────────────────────
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      content,
      meta,
    }: {
      content: string;
      meta: { clientMessageId: string };
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        content,
        message_type: 'TEXT',
        sender_id: user.id,
        client_message_id: meta.clientMessageId,
        // Text messages are ephemeral by default (deleted after recipient reads)
        is_ephemeral: true,
        is_saved: false,
        opened_by: [],
      });
      if (error) throw error;
    },
    onMutate: async ({ content, meta }) => {
      if (!user) return;
      const tempId = `temp-${Date.now()}`;
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      const previousMessages =
        queryClient.getQueryData<Message[]>(['messages', conversationId]) ?? [];
      const optimisticMessage: Message = {
        id: tempId,
        content,
        sender_id: user.id,
        created_at: new Date().toISOString(),
        message_type: 'TEXT',
        is_ephemeral: true,
        is_saved: false,
        opened_by: [],
        pending: true,
        client_message_id: meta.clientMessageId,
      };
      queryClient.setQueryData<Message[]>(['messages', conversationId], [
        ...previousMessages,
        optimisticMessage,
      ]);
      setNewMessage('');
      return { previousMessages };
    },
    onError: (_err, _content, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ['messages', conversationId],
          context.previousMessages
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return;
    sendMessageMutation.mutate({
      content: trimmedMessage,
      meta: { clientMessageId: crypto.randomUUID() },
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 bg-[#050505] z-50 flex flex-col font-sans">
      {/* Header */}
      <div className="h-16 border-b border-white/10 flex items-center px-4 bg-black/40 backdrop-blur-md shrink-0">
        <button
          onClick={onBack}
          className="p-2 mr-2 text-white/70 hover:text-white transition-colors"
        >
          <ChevronLeft size={28} />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-500 p-[1px] mr-3">
          <div className="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-xs text-white overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              title.substring(0, 2).toUpperCase()
            )}
          </div>
        </div>
        <div>
          <h2 className="text-white font-bold text-lg leading-tight">{title}</h2>
          <p className="text-white/40 text-xs font-mono">Messages éphémères activés</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {isLoading && (
          <div className="space-y-3 my-auto">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <Skeleton
                  className={`h-12 rounded-2xl ${
                    i % 2 === 0 ? 'w-2/3' : 'w-1/2 ml-auto'
                  }`}
                />
              </div>
            ))}
          </div>
        )}

        {messages?.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          const isSaved = msg.is_saved ?? false;
          const isSaving = savingId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[80%] ${
                isMe ? 'self-end items-end' : 'self-start items-start'
              } ${msg.pending ? 'opacity-70' : ''}`}
              // Long-press to save/unsave
              onMouseDown={() => handlePressStart(msg)}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={() => handlePressStart(msg)}
              onTouchEnd={handlePressEnd}
              onTouchCancel={handlePressEnd}
              // Mark as opened when rendered (for recipient)
              ref={(el) => {
                if (el && !isMe && msg.message_type === 'TEXT') {
                  markAsOpened(msg);
                }
              }}
            >
              <div
                className={`
                  px-4 py-2.5 rounded-2xl relative transition-colors select-none
                  ${isSaved ? 'bg-white/10 border border-white/20' : ''}
                  ${
                    isMe
                      ? msg.message_type === 'TEXT'
                        ? isSaved
                          ? 'bg-white/10 text-white rounded-br-sm'
                          : 'bg-blue-600 text-white rounded-br-sm'
                        : ''
                      : msg.message_type === 'TEXT'
                      ? isSaved
                        ? 'bg-white/10 text-white rounded-bl-sm'
                        : 'glass text-white rounded-bl-sm'
                      : ''
                  }
                `}
              >
                {msg.message_type === 'TEXT' && (
                  <p className="text-[15px] leading-relaxed break-words">
                    {msg.content}
                  </p>
                )}
                {(msg.message_type === 'IMAGE' ||
                  msg.message_type === 'VIDEO') &&
                  msg.media_url && (
                    <EphemeralMedia
                      messageId={msg.id}
                      mediaUrl={msg.media_url}
                      mediaType={msg.message_type}
                      isMe={isMe}
                      isSaved={isSaved}
                    />
                  )}

                {/* Save indicator */}
                {isSaved && (
                  <span
                    className={`absolute -top-2 ${
                      isMe ? '-left-2' : '-right-2'
                    } w-5 h-5 rounded-full bg-white/20 flex items-center justify-center`}
                  >
                    {isSaving ? (
                      <Loader2 size={10} className="animate-spin text-white" />
                    ) : (
                      <BookmarkCheck size={10} className="text-cyan-400" />
                    )}
                  </span>
                )}
              </div>

              <span className="text-[10px] text-white/30 mt-1 font-mono flex items-center gap-1">
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {msg.pending && <Loader2 size={10} className="animate-spin" />}
                {isSaved && (
                  <span className="text-white/40 text-[9px]">• Enregistré</span>
                )}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-black/40 backdrop-blur-md border-t border-white/10 shrink-0 pb-8">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDirectChatId(conversationId);
              setCurrentView('camera');
              onBack();
            }}
            className="w-12 h-12 rounded-full glass flex items-center justify-center text-white/70 hover:text-white shrink-0 cursor-pointer"
          >
            <CameraIcon size={24} />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Envoyer un message..."
            className="flex-1 bg-white/5 border border-white/10 rounded-full h-12 px-5 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition-all font-medium"
          />
          {newMessage.trim() && (
            <button
              type="submit"
              disabled={sendMessageMutation.isPending}
              className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 hover:bg-blue-700 transition-colors"
            >
              <Send size={20} className="ml-1" />
            </button>
          )}
        </form>
        <p className="text-center text-white/20 text-[10px] mt-2 font-mono">
          Appui long pour enregistrer un message
        </p>
      </div>
    </div>
  );
}
