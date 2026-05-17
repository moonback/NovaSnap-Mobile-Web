import React, { useState, useEffect, useRef } from 'react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { ChevronLeft, Send, Camera as CameraIcon, Loader2 } from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EphemeralMedia from '../components/chat/EphemeralMedia';

type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO';

type RawMessage = Omit<Message, 'users'> & { users?: { username: string }[] | { username: string } };

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  message_type: MessageType;
  media_url?: string;
  users?: {
    username: string;
  };
  pending?: boolean;
  client_hash?: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`id,content,message_type,media_url,created_at,sender_id,users (username)`)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messagesWithSignedUrls = await Promise.all(
        ((data ?? []) as RawMessage[]).map(async (rawMsg) => {
          const normalizedUser = Array.isArray(rawMsg.users) ? rawMsg.users[0] : rawMsg.users;
          const msg: Message = { ...rawMsg, users: normalizedUser };
          if (msg.media_url && (msg.message_type === 'IMAGE' || msg.message_type === 'VIDEO')) {
            const signedUrl = await getValidMediaUrl('chats', msg.media_url);
            return { ...msg, media_url: signedUrl };
          }
          return msg;
        })
      );

      return messagesWithSignedUrls;
    },
  });

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
          if (newMsg.media_url && (newMsg.message_type === 'IMAGE' || newMsg.message_type === 'VIDEO')) {
            const signedUrl = await getValidMediaUrl('chats', newMsg.media_url);
            newMsg = { ...newMsg, media_url: signedUrl };
          }

          queryClient.setQueryData<Message[]>(['messages', conversationId], (oldData) => {
            if (!oldData) return [newMsg];
            if (oldData.some((m) => m.id === newMsg.id)) return oldData;
            const withoutPendingEcho = oldData.filter(
              (m) => !(m.pending && m.sender_id === newMsg.sender_id && m.content === newMsg.content)
            );
            return [...withoutPendingEcho, newMsg];
          });

          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        content,
        message_type: 'TEXT',
        sender_id: user.id,
      });
      if (error) throw error;
    },
    onMutate: async (content) => {
      if (!user) return;
      const tempId = `temp-${Date.now()}`;
      const clientHash = `${user.id}:${conversationId}:${content}:${Date.now()}`;
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      const previousMessages = queryClient.getQueryData<Message[]>(['messages', conversationId]) ?? [];
      const optimisticMessage: Message = {
        id: tempId,
        content,
        sender_id: user.id,
        created_at: new Date().toISOString(),
        message_type: 'TEXT',
        pending: true,
        client_hash: clientHash,
      };
      queryClient.setQueryData<Message[]>(['messages', conversationId], [...previousMessages, optimisticMessage]);
      setNewMessage('');
      return { previousMessages };
    },
    onError: (_err, _content, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', conversationId], context.previousMessages);
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
    sendMessageMutation.mutate(trimmedMessage);
  };

  return (
    <div className="absolute inset-0 bg-[#050505] z-50 flex flex-col font-sans">
      <div className="h-16 border-b border-white/10 flex items-center px-4 bg-black/40 backdrop-blur-md shrink-0">
        <button onClick={onBack} className="p-2 mr-2 text-white/70 hover:text-white transition-colors">
          <ChevronLeft size={28} />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-500 p-[1px] mr-3">
          <div className="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-xs text-white overflow-hidden">
            {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : title.substring(0, 2).toUpperCase()}
          </div>
        </div>
        <div>
          <h2 className="text-white font-bold text-lg leading-tight">{title}</h2>
          <p className="text-white/40 text-xs font-mono">Online</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {isLoading && (
          <div className="space-y-3 my-auto">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <Skeleton className={`h-12 rounded-2xl ${i % 2 === 0 ? 'w-2/3' : 'w-1/2 ml-auto'}`} />
              </div>
            ))}
          </div>
        )}

        {messages?.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'} ${msg.pending ? 'opacity-70' : ''}`}>
              <div className={`px-4 py-2.5 rounded-2xl ${isMe ? (msg.message_type === 'TEXT' ? 'bg-blue-600 text-white rounded-br-sm' : '') : (msg.message_type === 'TEXT' ? 'glass text-white rounded-bl-sm' : '')}`}>
                {msg.message_type === 'TEXT' && <p className="text-[15px] leading-relaxed break-words">{msg.content}</p>}
                {(msg.message_type === 'IMAGE' || msg.message_type === 'VIDEO') && msg.media_url && (
                  <EphemeralMedia messageId={msg.id} mediaUrl={msg.media_url} mediaType={msg.message_type} isMe={isMe} />
                )}
              </div>
              <span className="text-[10px] text-white/30 mt-1 font-mono flex items-center gap-1">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {msg.pending && <Loader2 size={10} className="animate-spin" />}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

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
            placeholder="Send a chat..."
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
      </div>
    </div>
  );
}
