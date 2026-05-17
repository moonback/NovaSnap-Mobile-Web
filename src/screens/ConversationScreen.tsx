import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { ChevronLeft, Send, Camera as CameraIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EphemeralMedia from '../components/chat/EphemeralMedia';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  message_type: 'TEXT' | 'IMAGE' | 'VIDEO';
  media_url?: string;
  users?: {
    username: string;
  };
}

export default function ConversationScreen({ conversationId, onBack }: { conversationId: string, onBack: () => void }) {
  const { user, setCurrentView, setDirectChatId } = useAppStore();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch messages
  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          message_type,
          media_url,
          created_at,
          sender_id,
          users (username)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as unknown as Message[];
    },
  });

  // Subscribe to real-time changes
  useEffect(() => {
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        // Optimistically update cache
        queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
          if (!oldData) return [payload.new];
          // avoid duplicates
          if (oldData.find((m: any) => m.id === payload.new.id)) return oldData;
          return [...oldData, payload.new];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content,
          message_type: 'TEXT',
          sender_id: user.id
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  return (
    <div className="absolute inset-0 bg-[#050505] z-50 flex flex-col font-sans">
      {/* Header */}
      <div className="h-16 border-b border-white/10 flex items-center px-4 bg-black/40 backdrop-blur-md shrink-0">
        <button onClick={onBack} className="p-2 mr-2 text-white/70 hover:text-white transition-colors">
          <ChevronLeft size={28} />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-500 p-[1px] mr-3">
          <div className="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-xs text-white">
            CH
          </div>
        </div>
        <div>
          <h2 className="text-white font-bold text-lg leading-tight">Chat</h2>
          <p className="text-white/40 text-xs font-mono">Online</p>
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {isLoading && <div className="text-center text-white/40 my-auto">Loading messages...</div>}
        
        {messages?.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
              <div 
                className={`px-4 py-2.5 rounded-2xl ${
                  isMe 
                    ? (msg.message_type === 'TEXT' ? 'bg-blue-600 text-white rounded-br-sm' : '') 
                    : (msg.message_type === 'TEXT' ? 'glass text-white rounded-bl-sm' : '')
                }`}
              >
                {msg.message_type === 'TEXT' && (
                  <p className="text-[15px] leading-relaxed break-words">{msg.content}</p>
                )}
                {(msg.message_type === 'IMAGE' || msg.message_type === 'VIDEO') && msg.media_url && (
                  <EphemeralMedia messageId={msg.id} mediaUrl={msg.media_url} mediaType={msg.message_type as 'IMAGE' | 'VIDEO'} isMe={isMe} />
                )}
              </div>
              <span className="text-[10px] text-white/30 mt-1 font-mono">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
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
