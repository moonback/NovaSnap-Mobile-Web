import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { ChevronLeft, Send, Camera as CameraIcon, Loader2, BookmarkCheck, MoreVertical } from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EphemeralMedia from '../components/chat/EphemeralMedia';
import { motion, AnimatePresence } from 'framer-motion';

const EMOJIS = [
  '😀', '😂', '😍', '🥰', '😎', '😜', '🤔', '🙄', 
  '👍', '👎', '❤️', '🔥', '🎉', '✨', '👏', '🙌',
  '😮', '😢', '😡', '😱', '💩', '💯', '🚀', '👀',
  '💬', '📸', '⚡', '🌟', '🧁', '🍕', '🍻', '🎈'
];

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

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);

  const handleInputChange = (text: string) => {
    setNewMessage(text);
    if (!user || !channelRef.current) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, username: user.user_metadata?.username || user.email?.split('@')[0] || 'Ami', isTyping: true }
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, isTyping: false }
      });
    }, 1500);
  };

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      console.log(`[NovaChat:Query] Chargement des messages pour la conversation ${conversationId}...`);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select(`id,content,message_type,media_url,created_at,sender_id,client_message_id,is_ephemeral,is_saved,opened_by,users:users!sender_id (username)`)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });
        
        if (error) {
          console.error('[NovaChat:Query] Erreur Supabase lors du fetch des messages:', error);
          throw error;
        }
        
        console.log(`[NovaChat:Query] ${data?.length ?? 0} messages bruts récupérés.`);
        
        const processed = await Promise.all(
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
        
        console.log('[NovaChat:Query] Traitement des messages terminé.', processed);
        return processed;
      } catch (err) {
        console.error('[NovaChat:Query] Exception attrapée dans queryFn:', err);
        throw err;
      }
    },
  });

  useEffect(() => {
    console.log(`[NovaChat:Realtime] Initialisation du canal realtime pour la conversation ${conversationId}...`);
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          let newMsg = payload.new as Message;
          console.log('[NovaChat:Realtime] INSERT reçu !', newMsg);
          if (newMsg.media_url && (newMsg.message_type === 'IMAGE' || newMsg.message_type === 'VIDEO')) {
            const signedUrl = await getValidMediaUrl('chats', newMsg.media_url);
            newMsg = { ...newMsg, media_url: signedUrl };
          }
          queryClient.setQueryData<Message[]>(['messages', conversationId], (oldData) => {
            if (!oldData) return [newMsg];
            if (oldData.some((m) => m.id === newMsg.id)) {
              console.log('[NovaChat:Realtime] Message déjà présent dans le cache (doublon évité).');
              return oldData;
            }
            const withoutPendingEcho = oldData.filter((m) => {
              if (!m.pending) return true;
              if (m.client_message_id && newMsg.client_message_id) {
                const match = m.client_message_id === newMsg.client_message_id;
                if (match) console.log(`[NovaChat:Realtime] Correspondance trouvée sur client_message_id: ${m.client_message_id}. Remplacement du message temporaire.`);
                return !match;
              }
              const contentMatch = m.sender_id === newMsg.sender_id && m.content === newMsg.content;
              if (contentMatch) console.log('[NovaChat:Realtime] Correspondance trouvée sur le contenu. Remplacement du message temporaire.');
              return !contentMatch;
            });
            return [...withoutPendingEcho, newMsg];
          });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const updated = payload.new as Message;
          console.log('[NovaChat:Realtime] UPDATE reçu !', updated);
          queryClient.setQueryData<Message[]>(['messages', conversationId], (oldData) =>
            oldData ? oldData.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)) : oldData
          );
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          console.log(`[NovaChat:Realtime] DELETE reçu pour le message ID: ${deletedId}`);
          queryClient.setQueryData<Message[]>(['messages', conversationId], (oldData) => oldData?.filter((m) => m.id !== deletedId) ?? []);
        }
      )
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        console.log('[NovaChat:Realtime] Broadcast typing reçu !', payload);
        if (payload.userId !== user?.id) {
          setTypingUsers((prev) => {
            const next = { ...prev };
            if (payload.isTyping) {
              next[payload.userId] = payload.username;
            } else {
              delete next[payload.userId];
            }
            return next;
          });
        }
      });

    channel.subscribe((status) => {
      console.log(`[NovaChat:Realtime] Changement de statut du canal: ${status}`);
    });

    channelRef.current = channel;
      
    return () => { 
      console.log(`[NovaChat:Realtime] Fermeture du canal realtime pour ${conversationId}`);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      channelRef.current = null;
      supabase.removeChannel(channel); 
    };
  }, [conversationId, queryClient, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const markAsOpened = useCallback(async (msg: Message) => {
    if (!user) return;
    if (msg.message_type !== 'TEXT' || !msg.is_ephemeral || msg.is_saved || msg.sender_id === user.id || msg.opened_by?.includes(user.id)) return;
    
    console.log(`[NovaChat:Lifecycle] Marquage du message ${msg.id} comme lu par l'utilisateur actuel.`);
    const newOpenedBy = [...(msg.opened_by ?? []), user.id];
    queryClient.setQueryData<Message[]>(['messages', conversationId], (old) =>
      old?.map((m) => (m.id === msg.id ? { ...m, opened_by: newOpenedBy } : m)) ?? []
    );
    try {
      const { error } = await supabase.from('messages').update({ opened_by: newOpenedBy }).eq('id', msg.id);
      if (error) console.error(`[NovaChat:Lifecycle] Erreur lors du marquage comme lu du message ${msg.id} :`, error);
      else console.log(`[NovaChat:Lifecycle] Message ${msg.id} marqué comme lu mis à jour avec succès dans Supabase.`);
    } catch (e) {
      console.error(`[NovaChat:Lifecycle] Exception lors du marquage comme lu du message ${msg.id} :`, e);
    }
  }, [user, conversationId, queryClient]);

  useEffect(() => {
    if (!messages || !user) return;
    messages.forEach(async (msg) => {
      if (msg.message_type !== 'TEXT' || !msg.is_ephemeral || msg.is_saved || !msg.opened_by) return;
      const recipientOpened = msg.sender_id === user.id
        ? msg.opened_by.some((uid) => uid !== user.id)
        : msg.opened_by.includes(user.id);
        
      if (recipientOpened) {
        console.log(`[NovaChat:Lifecycle] Le destinataire a ouvert le message éphémère ${msg.id}. Lancement de la suppression.`);
        queryClient.setQueryData<Message[]>(['messages', conversationId], (old) => old?.filter((m) => m.id !== msg.id) ?? []);
        try {
          const { error } = await supabase.from('messages').delete().eq('id', msg.id);
          if (error) console.error(`[NovaChat:Lifecycle] Erreur lors de la suppression du message éphémère ${msg.id} :`, error);
          else console.log(`[NovaChat:Lifecycle] Message éphémère ${msg.id} supprimé avec succès de Supabase.`);
        } catch (e) {
          console.error(`[NovaChat:Lifecycle] Exception lors de la suppression du message éphémère ${msg.id} :`, e);
        }
      }
    });
  }, [messages, user, conversationId, queryClient]);

  const toggleSave = useCallback(async (msg: Message) => {
    if (!user || savingId) return;
    console.log(`[NovaChat:Lifecycle] Toggling save pour le message ${msg.id}. État actuel: ${msg.is_saved}`);
    setSavingId(msg.id);
    const newSaved = !msg.is_saved;
    queryClient.setQueryData<Message[]>(['messages', conversationId], (old) =>
      old?.map((m) => (m.id === msg.id ? { ...m, is_saved: newSaved } : m)) ?? []
    );
    try {
      const { error } = await supabase.from('messages').update({ is_saved: newSaved }).eq('id', msg.id);
      if (error) console.error(`[NovaChat:Lifecycle] Erreur de mise à jour de la sauvegarde pour le message ${msg.id} :`, error);
      else console.log(`[NovaChat:Lifecycle] État de sauvegarde du message ${msg.id} enregistré avec succès.`);
    } catch (e) {
      console.error(`[NovaChat:Lifecycle] Exception lors de la sauvegarde du message ${msg.id} :`, e);
    }
    setSavingId(null);
  }, [user, savingId, conversationId, queryClient]);

  const handlePressStart = (msg: Message) => {
    longPressTimerRef.current = setTimeout(() => toggleSave(msg), 500);
  };
  const handlePressEnd = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, meta }: { content: string; meta: { clientMessageId: string } }) => {
      console.log('[NovaChat:Mutation] Insertion du message dans Supabase...', { content, meta });
      if (!user) throw new Error('Utilisateur non connecté');
      const { data, error } = await supabase.from('messages').insert({
        conversation_id: conversationId, content, message_type: 'TEXT', sender_id: user.id,
        client_message_id: meta.clientMessageId, is_ephemeral: true, is_saved: false, opened_by: [],
      }).select();
      
      if (error) {
        console.error('[NovaChat:Mutation] Erreur de Supabase lors de l\'insertion :', error);
        throw error;
      }
      console.log('[NovaChat:Mutation] Insertion réussie ! Données insérées:', data);
    },
    onMutate: async ({ content, meta }) => {
      console.log('[NovaChat:Mutation] Début onMutate pour envoi optimiste.', { content, meta });
      if (!user) return;
      const tempId = `temp-${Date.now()}`;
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      const previousMessages = queryClient.getQueryData<Message[]>(['messages', conversationId]) ?? [];
      const optimisticMessage: Message = {
        id: tempId, content, sender_id: user.id, created_at: new Date().toISOString(),
        message_type: 'TEXT', is_ephemeral: true, is_saved: false, opened_by: [],
        pending: true, client_message_id: meta.clientMessageId,
      };
      
      console.log('[NovaChat:Mutation] Ajout du message optimiste au cache :', optimisticMessage);
      queryClient.setQueryData<Message[]>(['messages', conversationId], [...previousMessages, optimisticMessage]);
      setNewMessage('');
      return { previousMessages };
    },
    onError: (err, content, context) => {
      console.error('[NovaChat:Mutation] Erreur lors de l\'envoi du message ! Restauration de l\'état précédent.', err);
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', conversationId], context.previousMessages);
      }
    },
    onSettled: () => {
      console.log('[NovaChat:Mutation] Mutation terminée (settled). Invalidation des requêtes.');
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user?.id, isTyping: false }
    });

    sendMessageMutation.mutate({ content: trimmedMessage, meta: { clientMessageId: crypto.randomUUID() } });
  };

  const initials = title.substring(0, 2).toUpperCase();

  return (
    <div className="absolute inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 pt-12 pb-3 border-b border-white/8">
        <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors">
          <ChevronLeft size={26} />
        </button>

        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-xs">
              {initials}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-white font-black text-[15px] leading-tight truncate">{title}</h2>
          <p className="text-white/30 text-xs">Messages éphémères</p>
        </div>

        <button className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:bg-white/10 transition-colors">
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-hide px-4 py-4 flex flex-col gap-2">
        {isLoading && (
          <div className="space-y-3 my-auto">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className={`h-10 rounded-2xl ${i % 2 === 0 ? 'w-2/3' : 'w-1/2 ml-auto'}`} />
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
              className={`flex flex-col max-w-[78%] ${isMe ? 'self-end items-end' : 'self-start items-start'} ${msg.pending ? 'opacity-60' : ''}`}
              onMouseDown={() => handlePressStart(msg)}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={() => handlePressStart(msg)}
              onTouchEnd={handlePressEnd}
              onTouchCancel={handlePressEnd}
              ref={(el) => { if (el && !isMe && msg.message_type === 'TEXT') markAsOpened(msg); }}
            >
              <div className={`
                px-4 py-2.5 rounded-2xl select-none
                ${(msg.message_type === 'TEXT' || isMe || isSaved) ? 'relative' : ''}
                ${msg.message_type === 'TEXT' ? (
                  isMe
                    ? isSaved ? 'bg-white/10 border border-white/15 text-white rounded-br-sm' : 'bg-snap-yellow text-black rounded-br-sm'
                    : isSaved ? 'bg-white/10 border border-white/15 text-white rounded-bl-sm' : 'bg-white/12 text-white rounded-bl-sm'
                ) : ''}
              `}>
                {msg.message_type === 'TEXT' && (
                  <p className={`text-[15px] leading-relaxed break-words font-medium ${isMe && !isSaved ? 'text-black' : 'text-white'}`}>
                    {msg.content}
                  </p>
                )}
                {(msg.message_type === 'IMAGE' || msg.message_type === 'VIDEO') && msg.media_url && (
                  <EphemeralMedia messageId={msg.id} mediaUrl={msg.media_url} mediaType={msg.message_type} isMe={isMe} isSaved={isSaved} />
                )}
                {isSaved && (
                  <span className={`absolute -top-2 ${isMe ? '-left-2' : '-right-2'} w-5 h-5 rounded-full bg-white/15 flex items-center justify-center`}>
                    {isSaving ? <Loader2 size={10} className="animate-spin text-white" /> : <BookmarkCheck size={10} className="text-snap-yellow" />}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-white/25 mt-1 flex items-center gap-1">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {msg.pending && <Loader2 size={9} className="animate-spin" />}
                {isSaved && <span className="text-white/30">· Enregistré</span>}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {Object.keys(typingUsers).length > 0 && (
        <div className="px-5 py-2.5 flex items-center gap-2 bg-gradient-to-r from-zinc-950/60 to-transparent border-t border-white/5 shrink-0">
          <div className="flex gap-1 items-center shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-snap-yellow animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-snap-yellow animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-snap-yellow animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-white/45 text-[11px] font-bold italic tracking-wide">
            {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length > 1 ? 'sont' : 'est'} en train d'écrire...
          </span>
        </div>
      )}

      {/* Emoji Picker Drawer */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 180, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 bg-zinc-950/90 backdrop-blur-md overflow-hidden flex flex-col pointer-events-auto shrink-0 z-40"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-wider">Emojis</span>
              <button 
                onClick={() => setShowEmojiPicker(false)}
                className="text-[11px] font-bold text-snap-yellow hover:text-yellow-400 active:scale-95 transition-all"
              >
                Fermer
              </button>
            </div>
            <div className="grid grid-cols-8 gap-3 p-4 overflow-y-auto max-h-[140px] scroll-hide">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewMessage((prev) => prev + emoji)}
                  className="text-2xl flex items-center justify-center hover:bg-white/10 p-1.5 rounded-xl active:scale-75 transition-all"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/8 pb-6 shrink-0 bg-black z-30">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setDirectChatId(conversationId); setCurrentView('camera'); onBack(); }}
            className="w-11 h-11 rounded-full bg-white/8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/12 transition-all shrink-0"
          >
            <CameraIcon size={22} />
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Envoyer un message..."
            className="flex-1 bg-white/8 border border-white/10 rounded-full h-11 px-5 text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-all text-[15px]"
          />

          {newMessage.trim() ? (
            <button
              type="submit"
              disabled={sendMessageMutation.isPending}
              className="w-11 h-11 rounded-full bg-snap-yellow flex items-center justify-center shrink-0 active:scale-90 transition-all shadow-snap-sm"
            >
              <Send size={18} className="text-black ml-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-all ${
                showEmojiPicker ? 'bg-snap-yellow text-black' : 'bg-white/8 text-white/40 hover:text-white hover:bg-white/12'
              }`}
            >
              <span className="text-lg">😊</span>
            </button>
          )}
        </form>
        <p className="text-center text-white/15 text-[10px] mt-2">Appui long pour enregistrer</p>
      </div>
    </div>
  );
}
