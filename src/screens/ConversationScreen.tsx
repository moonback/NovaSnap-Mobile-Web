import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../hooks/useTheme';
import {
  ChevronLeft,
  Send,
  Camera as CameraIcon,
  Loader2,
  BookmarkCheck,
  MoreVertical,
  Eye,
  LogOut,
  Users,
  AlertCircle
} from 'lucide-react';
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

const mediaUrlCache = new Map<string, { url: string; expiresAt: number }>();

const getCachedMediaUrl = async (bucket: 'chats', path: string) => {
  const now = Date.now();
  const cacheKey = `${bucket}:${path}`;
  const cached = mediaUrlCache.get(cacheKey);
  // Cache for 55 minutes
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }
  const url = await getValidMediaUrl(bucket, path);
  if (url) {
    mediaUrlCache.set(cacheKey, { url, expiresAt: now + 55 * 60 * 1000 });
  }
  return url;
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
  const t = useTheme();
  const [newMessage, setNewMessage] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);

  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // ── Fetch Conversation Members (useful for showing who has seen messages and for group actions) ──
  const { data: members = [] } = useQuery({
    queryKey: ['conversation-members', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_members')
        .select(`
          user_id,
          joined_at,
          users:users!user_id (id, username, display_name, avatar_url)
        `)
        .eq('conversation_id', conversationId);
      
      if (error) {
        console.error('[ConversationScreen] Error fetching members:', error);
        return [];
      }

      return (data ?? []).map((m: any) => {
        const u = Array.isArray(m.users) ? m.users[0] : m.users;
        return {
          user_id: m.user_id,
          joined_at: m.joined_at,
          username: u?.username || 'Ami',
          display_name: u?.display_name || u?.username || 'Ami',
          avatar_url: u?.avatar_url || null,
        };
      });
    },
    enabled: !!conversationId,
  });

  const handleLeaveGroup = async () => {
    if (!user) return;
    try {
      // 1. Send system message
      const displayName = user.user_metadata?.display_name || user.user_metadata?.username || user.email?.split('@')[0] || 'Un membre';
      const systemContent = `📢 ${displayName} a quitté le groupe`;
      
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        content: systemContent,
        message_type: 'TEXT',
        sender_id: user.id,
        is_ephemeral: false,
        is_saved: true,
        opened_by: [],
      });

      // 2. Delete membership
      const { error } = await supabase
        .from('conversation_members')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // 3. Clear cache and go back
      queryClient.setQueryData(['conversations', user.id], (old: any) =>
        old?.filter((row: any) => row.conversations?.id !== conversationId) ?? []
      );
      
      setShowLeaveConfirm(false);
      onBack();
    } catch (err) {
      console.error('Erreur lors du départ du groupe:', err);
    }
  };

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

  const messagesRef = useRef<Message[]>([]);

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

        // Filter out already-opened ephemeral messages to prevent them from showing on refresh
        const activeData = (data ?? []).filter((msg) => {
          if (msg.message_type === 'TEXT' && msg.is_ephemeral && !msg.is_saved && msg.opened_by) {
            const recipientOpened = msg.sender_id === user?.id
              ? msg.opened_by.some((uid) => uid !== user?.id)
              : msg.opened_by.includes(user?.id);
            if (recipientOpened) return false;
          }
          return true;
        });

        const processed = await Promise.all(
          (activeData as RawMessage[]).map(async (rawMsg) => {
            const normalizedUser = Array.isArray(rawMsg.users) ? rawMsg.users[0] : rawMsg.users;
            const msg: Message = { ...rawMsg, users: normalizedUser };
            if (msg.media_url && (msg.message_type === 'IMAGE' || msg.message_type === 'VIDEO')) {
              const signedUrl = await getCachedMediaUrl('chats', msg.media_url);
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
    if (messages) {
      messagesRef.current = messages;
    }
  }, [messages]);

  // ── Auto mark messages as opened/read ──
  useEffect(() => {
    if (!user || !messages || messages.length === 0) return;

    const unreadMessages = messages.filter(
      (msg) => msg.sender_id !== user.id && (!msg.opened_by || !msg.opened_by.includes(user.id))
    );

    if (unreadMessages.length > 0) {
      console.log(`[ConversationScreen] Automatically marking ${unreadMessages.length} messages as opened.`);
      
      unreadMessages.forEach(async (msg) => {
        const newOpenedBy = [...(msg.opened_by ?? []), user.id];
        
        // Optimistic cache update
        queryClient.setQueryData<Message[]>(['messages', conversationId], (old) =>
          old?.map((m) => (m.id === msg.id ? { ...m, opened_by: newOpenedBy } : m)) ?? []
        );

        try {
          await supabase
            .from('messages')
            .update({ opened_by: newOpenedBy })
            .eq('id', msg.id);
        } catch (err) {
          console.error('[ConversationScreen] Error updating message opened_by:', err);
        }
      });

      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
    }
  }, [messages, user, conversationId, queryClient]);

  useEffect(() => {
    console.log(`[NovaChat:Realtime] Initialisation du canal realtime pour la conversation ${conversationId}...`);
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          let newMsg = payload.new as Message;
          console.log('[NovaChat:Realtime] INSERT reçu !', newMsg);
          if (newMsg.media_url && (newMsg.message_type === 'IMAGE' || newMsg.message_type === 'VIDEO')) {
            const signedUrl = await getCachedMediaUrl('chats', newMsg.media_url);
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
    if (msg.sender_id === user.id || msg.opened_by?.includes(user.id)) return;

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

  // Nettoyage des messages éphémères lus lors de la fermeture de la conversation
  useEffect(() => {
    return () => {
      const currentUser = user;
      if (!currentUser) return;

      const currentMessages = messagesRef.current;
      if (!currentMessages || currentMessages.length === 0) return;

      const toDeleteIds = currentMessages
        .filter((msg) => {
          if (msg.message_type !== 'TEXT' || !msg.is_ephemeral || msg.is_saved || !msg.opened_by) return false;
          const recipientOpened = msg.sender_id === currentUser.id
            ? msg.opened_by.some((uid) => uid !== currentUser.id)
            : msg.opened_by.includes(currentUser.id);
          return recipientOpened;
        })
        .map((msg) => msg.id);

      if (toDeleteIds.length > 0) {
        console.log(`[NovaChat:Cleanup] Suppression de ${toDeleteIds.length} messages éphémères lus lors de la fermeture :`, toDeleteIds);
        supabase
          .from('messages')
          .delete()
          .in('id', toDeleteIds)
          .then(({ error }) => {
            if (error) console.error('[NovaChat:Cleanup] Erreur lors de la suppression des messages éphémères lus:', error);
            else console.log('[NovaChat:Cleanup] Nettoyage des messages éphémères lus terminé avec succès.');
          });
      }
    };
  }, [conversationId, user]);

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

  const getGroupGradient = (preset: string) => {
    switch (preset) {
      case 'emerald':
        return 'from-emerald-400 to-teal-600 text-white';
      case 'cyan':
        return 'from-cyan-400 to-blue-600 text-white';
      case 'gold':
        return 'from-yellow-400 via-orange-500 to-red-500 text-white';
      case 'sunset':
      default:
        return 'from-indigo-500 via-purple-500 to-pink-500 text-white';
    }
  };

  const isGroup = title.includes('::') || (avatarUrl === 'group');
  const titleParts = title.split('::');
  const displayTitle = titleParts[0];
  const avatarPreset = titleParts[1] || 'sunset';
  const initials = displayTitle.substring(0, 2).toUpperCase();

  return (
    <div className={`relative w-full h-full z-50 flex flex-col ${t.bg} ${t.text}`}>
      {/* Header */}
      <div className={`sticky top-0 z-40 backdrop-blur-xl flex items-center gap-3 px-3 pt-5 pb-3.5 border-b ${t.isLight ? 'bg-white/80 border-black/5' : 'bg-zinc-950/80 border-white/5'}`}>
        <button onClick={onBack} className={`w-9 h-9 rounded-full flex items-center justify-center ${t.text} hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}>
          <ChevronLeft size={26} />
        </button>

        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 shadow-sm border border-black/5 dark:border-white/5">
          {isGroup ? (
            <div className={`w-full h-full bg-gradient-to-br ${getGroupGradient(avatarPreset)} flex items-center justify-center font-black text-white text-xs tracking-wider`}>
              {initials}
            </div>
          ) : avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-xs">
              {initials}
            </div>
          )}
        </div>

        <div
          onClick={() => isGroup && setShowGroupDetails(true)}
          className={`flex-1 min-w-0 ${isGroup ? 'cursor-pointer active:opacity-75 transition-opacity' : ''}`}
        >
          <h2 className={`font-black ${t.text} text-[15.5px] tracking-tight leading-tight truncate`}>{displayTitle}</h2>
          <p className={`${t.textMuted} text-[11px] font-medium tracking-wide flex items-center gap-1`}>
            {isGroup ? (
              <>
                <Users size={10} className="text-cyan-400" /> {members.length} membres · Détails
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" /> Messages éphémères
              </>
            )}
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`w-9 h-9 rounded-full flex items-center justify-center ${t.textMuted} ${t.surfaceHover} transition-colors`}
          >
            <MoreVertical size={20} />
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div
                  className="absolute inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute right-0 top-12 w-48 rounded-2xl shadow-xl z-50 border overflow-hidden ${t.isLight ? 'bg-white border-black/10' : 'bg-zinc-900 border-white/10'}`}
                >
                  {isGroup ? (
                    <>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowGroupDetails(true);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors ${t.text} ${t.surfaceHover}`}
                      >
                        <Users size={16} className={t.textMuted} />
                        Détails du groupe
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowLeaveConfirm(true);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors text-red-500 ${t.surfaceHover}`}
                      >
                        <LogOut size={16} />
                        Quitter le groupe
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={async () => {
                        setShowMenu(false);
                        if (!user) return;
                        try {
                          const { error } = await supabase
                            .from('conversation_members')
                            .delete()
                            .eq('conversation_id', conversationId)
                            .eq('user_id', user.id);
                          if (error) throw error;
                          queryClient.setQueryData(['conversations', user.id], (old: any) =>
                            old?.filter((row: any) => row.conversations?.id !== conversationId) ?? []
                          );
                          onBack();
                        } catch (err) {
                          console.error('Erreur lors de la suppression de la conversation:', err);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors text-red-500 ${t.surfaceHover}`}
                    >
                      Supprimer le chat
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
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

        {!isLoading && (!messages || messages.length === 0) && (
          <div className={`my-auto mx-auto max-w-[270px] rounded-[24px] px-6 py-7 text-center border shadow-sm ${t.border} ${t.surface} bg-white/50 dark:bg-zinc-900/30 backdrop-blur-md`}>
            <div className="w-12 h-12 bg-snap-yellow/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">👻</span>
            </div>
            <p className={`font-black text-sm tracking-tight ${t.text}`}>Aucun message pour le moment</p>
            <p className={`text-xs mt-1.5 leading-normal ${t.textMuted}`}>Écris le premier message pour démarrer la conversation.</p>
          </div>
        )}

        {messages?.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          const isSaved = msg.is_saved ?? false;
          const isSaving = savingId === msg.id;
          const isSystemMsg = msg.content.startsWith('📢');

          if (isSystemMsg) {
            return (
              <div key={msg.id} className="w-full flex justify-center my-2 shrink-0">
                <div className={`px-4 py-1.5 rounded-full text-[11px] font-black tracking-wide border shadow-sm ${t.isLight ? 'bg-black/5 border-black/8 text-[#0d0e1a]/60' : 'bg-white/5 border-white/5 text-white/50'}`}>
                  {msg.content}
                </div>
              </div>
            );
          }

          const seenByList = (msg.opened_by ?? [])
            .filter((uid) => uid !== msg.sender_id)
            .map((uid) => {
              const m = members.find((mem) => mem.user_id === uid);
              return m ? (m.display_name || m.username) : null;
            })
            .filter(Boolean) as string[];

          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'} ${msg.pending ? 'opacity-60' : ''}`}
              onMouseDown={() => handlePressStart(msg)}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={() => handlePressStart(msg)}
              onTouchEnd={handlePressEnd}
              onTouchCancel={handlePressEnd}
              ref={(el) => { if (el && !isMe && msg.message_type === 'TEXT') markAsOpened(msg); }}
            >
              {!isMe && isGroup && msg.users?.username && (
                <span className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ml-2.5 ${t.textMuted}`}>
                  {msg.users.username}
                </span>
              )}
              <div className={`
                px-4 py-2.5 rounded-[18px] select-none shadow-sm transition-all duration-300
                ${(msg.message_type === 'TEXT' || isMe || isSaved) ? 'relative' : ''}
                ${msg.message_type === 'TEXT' ? (
                  isMe
                    ? isSaved
                      ? `${t.isLight ? 'bg-black/5 border border-black/10 text-[#0d0e1a]' : 'bg-white/5 border border-white/10 text-white'} rounded-tr-none`
                      : 'bg-[#00b2ff] text-white font-semibold rounded-tr-none shadow-[0_2px_8px_rgba(0,178,255,0.2)]'
                    : isSaved
                      ? `${t.isLight ? 'bg-black/5 border border-black/10 text-[#0d0e1a]' : 'bg-white/5 border border-white/10 text-white'} rounded-tl-none`
                      : `${t.isLight ? 'bg-white border border-black/8 text-[#0d0e1a]' : 'bg-[#1c1d29] border border-white/5 text-white'} rounded-tl-none`
                ) : ''}
              `}>
                {msg.message_type === 'TEXT' && (
                  <p className={`text-[14.5px] leading-relaxed break-words font-semibold ${isMe && !isSaved ? 'text-white' : t.isLight ? 'text-[#0d0e1a]' : 'text-white'}`}>
                    {msg.content}
                  </p>
                )}
                {(msg.message_type === 'IMAGE' || msg.message_type === 'VIDEO') && msg.media_url && (
                  <EphemeralMedia messageId={msg.id} mediaUrl={msg.media_url} mediaType={msg.message_type} isMe={isMe} isSaved={isSaved} />
                )}
                {isSaved && (
                  <span className={`absolute -top-2 ${isMe ? '-left-2' : '-right-2'} w-5 h-5 rounded-full ${t.isLight ? 'bg-black/12' : 'bg-white/15'} flex items-center justify-center`}>
                    {isSaving ? <Loader2 size={10} className={`animate-spin ${t.isLight ? 'text-[#0d0e1a]' : 'text-white'}`} /> : <BookmarkCheck size={10} className="text-snap-yellow" />}
                  </span>
                )}
              </div>
              <span className={`text-[10px] ${t.textFaint} mt-1 flex items-center gap-1.5 flex-wrap`}>
                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {msg.pending && <Loader2 size={9} className="animate-spin" />}
                {isSaved && <span className={t.textMuted}>· Enregistré</span>}
                {seenByList.length > 0 && (
                  <span className="flex items-center gap-0.5 text-cyan-400 font-bold">
                    · <Eye size={10} className="inline shrink-0" /> Vu par {seenByList.join(', ')}
                  </span>
                )}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {Object.keys(typingUsers).length > 0 && (
        <div className={`px-5 py-2.5 flex items-center gap-2 border-t ${t.borderMuted} ${t.isLight ? 'bg-black/5' : 'bg-gradient-to-r from-zinc-950/60 to-transparent'} shrink-0`}>
          <div className="flex gap-1 items-center shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-snap-yellow animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-snap-yellow animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-snap-yellow animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className={`${t.textSubtle} text-[11px] font-bold italic tracking-wide`}>
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
            className={`border-t ${t.borderMuted} ${t.isLight ? 'bg-[#eef1f8]/95' : 'bg-zinc-950/90'} backdrop-blur-md overflow-hidden flex flex-col pointer-events-auto shrink-0 z-40`}
          >
            <div className={`flex items-center justify-between px-4 py-2 border-b ${t.borderMuted}`}>
              <span className={`text-[10px] font-black ${t.textMuted} uppercase tracking-wider`}>Emojis</span>
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
                  className={`text-2xl flex items-center justify-center p-1.5 rounded-xl active:scale-75 transition-all ${t.isLight ? 'hover:bg-black/10' : 'hover:bg-white/10'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className={`px-4 py-4 border-t ${t.isLight ? 'bg-[#f8f9fc] border-black/5' : 'bg-[#0a0b10] border-white/5'} pb-8 shrink-0 z-30`}>
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setDirectChatId(conversationId); setCurrentView('camera'); onBack(); }}
            className={`w-11 h-11 rounded-full ${t.input} flex items-center justify-center ${t.textMuted} hover:bg-black/5 dark:hover:bg-white/5 transition-all shrink-0`}
          >
            <CameraIcon size={22} />
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Envoyer un message..."
            className={`flex-1 ${t.input} border ${t.border} rounded-full h-11 px-5 ${t.text} ${t.isLight ? 'placeholder-black/30 focus:border-black/20 focus:bg-white' : 'placeholder-white/30 focus:border-white/20 focus:bg-black'} focus:outline-none transition-all text-[15px] font-semibold`}
          />

          {newMessage.trim() ? (
            <button
              type="submit"
              disabled={sendMessageMutation.isPending}
              className="w-11 h-11 rounded-full bg-[#00b2ff] flex items-center justify-center shrink-0 active:scale-90 hover:scale-105 transition-all shadow-[0_2px_8px_rgba(0,178,255,0.35)]"
            >
              <Send size={18} className="text-white ml-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-all ${showEmojiPicker ? 'bg-[#00b2ff] text-white shadow-[0_2px_8px_rgba(0,178,255,0.2)]' : `${t.input} ${t.textMuted} hover:bg-black/5 dark:hover:bg-white/5`
                }`}
            >
              <span className="text-lg">😊</span>
            </button>
          )}
        </form>
        <p className={`text-center text-[10px] mt-2 ${t.textFaint}`}>Appui long sur un message pour l'enregistrer</p>
      </div>

      {/* Group Details Bottom Sheet */}
      <AnimatePresence>
        {showGroupDetails && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGroupDetails(false)}
              className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm pointer-events-auto"
            />
            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`absolute bottom-0 left-0 right-0 z-50 rounded-t-[32px] border-t p-6 max-h-[85%] flex flex-col pointer-events-auto ${t.isLight ? 'bg-[#f0f2f8] border-black/10' : 'bg-[#0d0d0f] border-white/10'}`}
            >
              {/* Handle */}
              <div className="w-12 h-1.5 rounded-full bg-zinc-700/50 mx-auto mb-6 cursor-pointer" onClick={() => setShowGroupDetails(false)} />
              
              {/* Header */}
              <div className="text-center mb-6 shrink-0">
                <div className={`w-16 h-16 rounded-full mx-auto mb-3 shadow-md bg-gradient-to-br ${getGroupGradient(avatarPreset)} flex items-center justify-center font-black text-white text-xl`}>
                  {initials}
                </div>
                <h3 className={`text-xl font-black ${t.text}`}>{displayTitle}</h3>
                <p className={`text-xs mt-1 font-bold ${t.textMuted}`}>{members.length} membres · Groupe NovaSnap</p>
              </div>

              {/* Members List */}
              <div className="flex-1 overflow-y-auto scroll-hide space-y-4 pr-1">
                <h4 className={`text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Membres</h4>
                {members.map((member) => (
                  <div key={member.user_id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-snap-yellow/10 border border-snap-yellow/20 flex items-center justify-center text-sm font-bold shrink-0">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                      ) : (
                        member.username.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${t.text}`}>{member.display_name}</p>
                      <p className={`text-[10px] ${t.textMuted}`}>@{member.username}</p>
                    </div>
                    {member.user_id === user?.id && (
                      <span className="text-[10px] font-black text-snap-yellow bg-snap-yellow/10 border border-snap-yellow/30 px-2 py-0.5 rounded-full">
                        Toi
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Leave Button */}
              <div className="mt-6 pt-4 border-t border-black/5 dark:border-white/5 shrink-0">
                <button
                  onClick={() => {
                    setShowGroupDetails(false);
                    setShowLeaveConfirm(true);
                  }}
                  className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-red-500/10 hover:bg-red-500/15 text-red-500 font-bold text-sm transition-all active:scale-[0.98]"
                >
                  <LogOut size={16} />
                  Quitter le groupe
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Leave Confirmation Dialog */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLeaveConfirm(false)}
              className="absolute inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-auto"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`absolute inset-x-6 top-1/2 -translate-y-1/2 z-[61] max-w-sm mx-auto rounded-[32px] p-6 border shadow-2xl space-y-4 pointer-events-auto ${t.isLight ? 'bg-white border-black/10' : 'bg-[#121214] border-white/10'}`}
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className={`text-lg font-black ${t.text}`}>Quitter le groupe ?</h3>
                <p className={`text-sm mt-1 leading-normal ${t.textMuted}`}>
                  Tu ne recevras plus de messages de ce groupe et ton historique de chat sera supprimé pour toi.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className={`flex-1 py-3.5 rounded-xl font-bold text-sm bg-black/5 dark:bg-white/5 ${t.text}`}
                >
                  Annuler
                </button>
                <button
                  onClick={handleLeaveGroup}
                  className="flex-1 py-3.5 rounded-xl font-black text-sm bg-red-500 text-white shadow-lg shadow-red-500/25 hover:bg-red-600 transition-colors"
                >
                  Quitter
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
