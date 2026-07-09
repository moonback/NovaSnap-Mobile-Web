import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useConversations } from '../hooks/useConversations';
import { useFriends } from '../hooks/useFriends';
import { Loader2, User, X, Search, Edit3, ChevronRight, Trash2, Check, Users } from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import ConversationScreen from './ConversationScreen';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastProvider';
import { useTheme } from '../hooks/useTheme';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import type { AppUserProfile, ConversationRow, ConversationMessage } from '../lib/types';

// Theme token type derived from the useTheme hook
type ThemeTokens = ReturnType<typeof useTheme>;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'maintenant';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
}

// ── Swipeable conversation row ────────────────────────────────
const SWIPE_THRESHOLD = -72; // px to reveal delete action
const DELETE_THRESHOLD = -200; // px to auto-confirm delete

const getStatusIcon = (lastMsg: ConversationMessage | null, userId: string | undefined, hasNew: boolean) => {
  if (!lastMsg) return null;
  const isMe = lastMsg.sender_id === userId;
  const isImage = lastMsg.message_type === 'IMAGE';
  const isVideo = lastMsg.message_type === 'VIDEO';

  const color = isImage ? '#ff004f' : isVideo ? '#9b51e0' : '#00b2ff';
  const shadowColor = isImage ? 'rgba(255,0,79,0.4)' : isVideo ? 'rgba(155,81,224,0.4)' : 'rgba(0,178,255,0.4)';

  if (!isMe) {
    if (hasNew) {
      if (isImage || isVideo) {
        return (
          <div 
            className="w-3.5 h-3.5 rounded-[4px] shrink-0 animate-pulse" 
            style={{ backgroundColor: color, boxShadow: `0 0 8px ${shadowColor}` }} 
          />
        );
      } else {
        return (
          <div 
            className="w-3.5 h-3.5 rounded-full shrink-0" 
            style={{ backgroundColor: color, boxShadow: `0 0 8px ${shadowColor}` }} 
          />
        );
      }
    } else {
      if (isImage || isVideo) {
        return <div className="w-3.5 h-3.5 border-2 rounded-[4px] shrink-0" style={{ borderColor: color }} />;
      } else {
        return <div className="w-3.5 h-3.5 border-2 rounded-full shrink-0" style={{ borderColor: color }} />;
      }
    }
  } else {
    const isOpened = lastMsg.opened_by && lastMsg.opened_by.length > 0;
    if (isOpened) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
    } else {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ filter: `drop-shadow(0 0 4px ${shadowColor})` }}>
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      );
    }
  }
};

const getStatusText = (lastMsg: ConversationMessage | null, userId: string | undefined, hasNew: boolean, t: ThemeTokens) => {
  if (!lastMsg) return <span className={t.textFaint}>Aucun message</span>;
  const isMe = lastMsg.sender_id === userId;
  const isImage = lastMsg.message_type === 'IMAGE';
  const isVideo = lastMsg.message_type === 'VIDEO';

  const colorClass = isImage ? 'text-[#ff004f]' : isVideo ? 'text-[#9b51e0]' : 'text-[#00b2ff]';

  if (!isMe) {
    if (hasNew) {
      return (
        <span className={`font-black ${colorClass} text-[13.5px] tracking-tight`}>
          {isImage ? 'Nouveau Snap 📷' : isVideo ? 'Nouveau Snap 🎥' : 'Nouveau Message 💬'}
        </span>
      );
    } else {
      return (
        <span className={`text-[13px] leading-normal ${t.textMuted} truncate block max-w-[200px]`}>
          {isImage ? '📷 Snap photo reçu' : isVideo ? '🎥 Snap vidéo reçu' : lastMsg.content}
        </span>
      );
    }
  } else {
    const isOpened = lastMsg.opened_by && lastMsg.opened_by.length > 0;
    return (
      <span className={`text-[13.5px] leading-normal ${t.textMuted} font-semibold`}>
        {isImage || isVideo
          ? isOpened ? 'Ouvert' : 'Envoyé' 
          : isOpened ? 'Lu' : 'Distribué'
        }
      </span>
    );
  }
};

interface SwipeableConvRowProps {
  conv: NonNullable<ConversationRow['conversations']>;
  userId: string | undefined;
  t: ReturnType<typeof useTheme>;
  onOpen: () => void;
  onDelete: (convId: string) => Promise<void>;
}

const SwipeableConvRow: React.FC<SwipeableConvRowProps> = ({ conv, userId, t, onOpen, onDelete }) => {
  const x = useMotionValue(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete button opacity: appears as soon as we swipe left
  const deleteOpacity = useTransform(x, [-80, -40], [1, 0]);
  // Scale the trash icon slightly as we pull further
  const deleteScale = useTransform(x, [-200, -72], [1.3, 1]);
  // Background color shifts to red when past delete threshold
  const bgColor = useTransform(x, [-200, -72, 0], ['#FFFF00', '#FFFF00', '#FFFF00']);

  const snapBack = useCallback(() => {
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
  }, [x]);

  const confirmDelete = useCallback(async () => {
    setIsDeleting(true);
    // Slide fully off screen then delete
    await animate(x, -500, { duration: 0.25, ease: 'easeIn' });
    await onDelete(conv.id);
  }, [conv.id, onDelete, x]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    isDragging.current = false;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDeleting) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 6) {
      e.stopPropagation();
    }
    // Only allow left swipe
    if (delta > 0) { x.set(0); return; }
    isDragging.current = Math.abs(delta) > 6;
    x.set(Math.max(delta, -240));
  };

  const handlePointerUp = async () => {
    if (isDeleting) return;
    const current = x.get();
    if (current <= DELETE_THRESHOLD) {
      await confirmDelete();
    } else if (current <= SWIPE_THRESHOLD) {
      // Snap to reveal delete button
      animate(x, -80, { type: 'spring', stiffness: 400, damping: 30 });
    } else {
      snapBack();
    }
  };

  const handleClick = () => {
    if (isDragging.current) return;
    if (x.get() !== 0) { snapBack(); return; }
    onOpen();
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

  const lastMsg = conv.messages?.[0];
  const hasNew = !!(lastMsg && lastMsg.sender_id !== userId && (!lastMsg.opened_by || !lastMsg.opened_by.includes(userId || '')));
  
  const isGroup = conv.is_group;
  const titleParts = conv.title?.split('::') ?? [];
  const displayTitle = titleParts[0] || 'Chat';
  const avatarPreset = titleParts[1] || 'sunset';

  const otherMember = !isGroup ? conv.conversation_members?.find((m) => m.user_id !== userId) : null;
  const otherAvatar = otherMember?.users?.avatar_url;
  const initials = displayTitle.substring(0, 2).toUpperCase() || 'GP';

  const ringColor = hasNew 
    ? lastMsg?.message_type === 'IMAGE' 
      ? 'ring-[#ff004f]' 
      : lastMsg?.message_type === 'VIDEO' 
        ? 'ring-[#9b51e0]' 
        : 'ring-[#00b2ff]' 
    : '';

  return (
    <div className="relative overflow-hidden rounded-2xl mb-1.5 border-b border-black/5 dark:border-white/5 pb-1">
      {/* Delete background */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-5 rounded-2xl"
        style={{ backgroundColor: bgColor }}
      >
        <motion.div style={{ opacity: deleteOpacity, scale: deleteScale }} className="flex flex-col items-center gap-1">
          {isDeleting
            ? <Loader2 size={20} className="text-white animate-spin" />
            : <Trash2 size={20} className="text-white" />
          }
          <span className="text-white text-[9px] font-black uppercase tracking-wider">Supprimer</span>
        </motion.div>
      </motion.div>

      {/* Row content */}
      <motion.div
        style={{ x }}
        className={`relative flex items-center gap-3 px-3 py-3.5 rounded-2xl cursor-pointer select-none touch-pan-y ${t.bg} hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isDeleting ? 'pointer-events-none' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        <div className="relative shrink-0">
          <div className={`w-14 h-14 rounded-full overflow-hidden transition-all duration-300 ${hasNew ? `ring-2 ${ringColor} ring-offset-2 ${t.isLight ? 'ring-offset-[#f0f2f8]' : 'ring-offset-black'}` : ''}`}>
            {isGroup ? (
              <div className={`w-full h-full bg-gradient-to-br ${getGroupGradient(avatarPreset)} flex items-center justify-center font-black text-white text-[15px] tracking-wider shadow-inner`}>
                {initials}
              </div>
            ) : otherAvatar ? (
              <img src={otherAvatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-sm">{initials}</div>
            )}
          </div>
          {hasNew && (
            <div 
              className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 ${t.isLight ? 'border-[#f0f2f8]' : 'border-black'}`}
              style={{ backgroundColor: lastMsg?.message_type === 'IMAGE' ? '#ff004f' : lastMsg?.message_type === 'VIDEO' ? '#9b51e0' : '#00b2ff' }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className={`font-black text-[15.5px] tracking-tight truncate ${t.text}`}>{displayTitle}</span>
            {lastMsg && <span className={`text-[11px] shrink-0 ml-2 ${t.textFaint}`}>{timeAgo(lastMsg.created_at)}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {getStatusIcon(lastMsg, userId, hasNew)}
            <div className="truncate flex-1">
              {getStatusText(lastMsg, userId, hasNew, t)}
            </div>
          </div>
        </div>

        {hasNew && <ChevronRight size={16} className="text-snap-yellow shrink-0" />}
      </motion.div>
    </div>
  );
};

export default function ChatScreen() {
  const { data: conversations, isLoading, realtimeStatus } = useConversations();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationPreview, setActiveConversationPreview] = useState<{ title: string; avatarUrl?: string } | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { user, setShowProfile, setIsInConversation } = useAppStore();
  const t = useTheme();
  const queryClient = useQueryClient();

  // Group creation states
  const [modalMode, setModalMode] = useState<'chat' | 'group'>('chat');
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<'sunset' | 'emerald' | 'cyan' | 'gold'>('sunset');

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends((prev) => {
      const exists = prev.includes(friendId);
      if (!exists && prev.length >= 99) {
        toast('La limite est de 100 membres par groupe !', 'warning');
        return prev;
      }
      return exists ? prev.filter((id) => id !== friendId) : [...prev, friendId];
    });
  };

  const handleStartGroup = async () => {
    if (!user || !groupTitle.trim() || selectedFriends.length === 0) return;
    setIsCreating(true);
    try {
      const newConvId = crypto.randomUUID();
      const fullTitle = `${groupTitle.trim()}::${selectedPreset}`;
      
      // 1. Create group conversation
      const { error: createError } = await supabase
        .from('conversations')
        .insert({ id: newConvId, is_group: true, title: fullTitle });
      if (createError) throw createError;

      // 2. Add current user first (essential for RLS conversation memberships insertion)
      const { error: selfMemberError } = await supabase
        .from('conversation_members')
        .insert({ conversation_id: newConvId, user_id: user.id, role: 'ADMIN' });
      if (selfMemberError) throw selfMemberError;

      // 3. Add other members in batch insert
      const membersToInsert = selectedFriends.map((friendId) => ({
        conversation_id: newConvId,
        user_id: friendId,
        role: 'MEMBER'
      }));
      const { error: membersError } = await supabase
        .from('conversation_members')
        .insert(membersToInsert);
      if (membersError) throw membersError;

      // 4. Send group system creation message
      await supabase.from('messages').insert({
        conversation_id: newConvId,
        sender_id: user.id,
        message_type: 'TEXT',
        content: `📢 ${user.user_metadata?.display_name || user.user_metadata?.username || user.email?.split('@')[0] || 'Un utilisateur'} a créé le groupe "${groupTitle.trim()}"`,
      });

      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      
      setActiveConversationPreview({
        title: groupTitle.trim() + '::' + selectedPreset,
        avatarUrl: 'group',
      });
      setActiveConversationId(newConvId);
      setIsInConversation(true);
      setShowNewChatModal(false);
      
      // Reset states
      setGroupTitle('');
      setSelectedFriends([]);
      setSelectedPreset('sunset');
      setModalMode('chat');
      toast('Groupe créé avec succès ! 🎉', 'success');
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error('Impossible de créer le groupe');
      toast('Erreur : ' + parsedError.message, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteConversation = useCallback(async (convId: string) => {
    if (!user) return;
    // Optimistic removal from cache
    queryClient.setQueryData<ConversationRow[]>(['conversations', user.id], (old) =>
      old?.filter((row) => row.conversations?.id !== convId) ?? []
    );
    try {
      // Leave the conversation (delete membership row — cascades messages via RLS/trigger)
      const { error } = await supabase
        .from('conversation_members')
        .delete()
        .eq('conversation_id', convId)
        .eq('user_id', user.id);
      if (error) throw error;
      toast('Conversation supprimée', 'success');
    } catch (e) {
      // Rollback on error
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
      toast('Impossible de supprimer la conversation', 'error');
    }
  }, [user, queryClient, toast]);

  // Friends data for the "Nouveau chat" modal
  const { friends } = useFriends();
  const friendIds = new Set(friends.map((f) => f.user.id));

  const {
    data: usersPages,
    isLoading: isUsersLoading,
    fetchNextPage: fetchNextUsersPage,
    hasNextPage: hasNextUsersPage,
    isFetchingNextPage: isFetchingNextPageData,
  } = useInfiniteQuery({
    queryKey: ['users', searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      const limit = 20;
      let query = supabase
        .from('users')
        .select('id, username, display_name, avatar_url')
        .neq('id', user?.id ?? '')
        .order('username');

      if (searchQuery) {
        query = query.or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.range((pageParam as number) * limit, ((pageParam as number) + 1) * limit - 1);
      if (error) throw error;

      return Promise.all(
        data.map(async (u) => {
          if (u.avatar_url) u.avatar_url = await getValidMediaUrl('avatars', u.avatar_url);
          return u;
        })
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 20 ? allPages.length : undefined;
    },
    enabled: showNewChatModal && !!user,
  });

  const allUsers = usersPages ? usersPages.pages.flatMap((page) => page) : [];

  const observerUsersRef = useRef<IntersectionObserver | null>(null);
  const loadMoreUsersRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isUsersLoading || isFetchingNextPageData || !hasNextUsersPage) return;
      if (observerUsersRef.current) observerUsersRef.current.disconnect();

      observerUsersRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          fetchNextUsersPage();
        }
      });

      if (node) observerUsersRef.current.observe(node);
    },
    [isUsersLoading, isFetchingNextPageData, hasNextUsersPage, fetchNextUsersPage]
  );

  useEffect(() => {
    return () => {
      if (observerUsersRef.current) observerUsersRef.current.disconnect();
    };
  }, []);

  const handleStartChat = async (targetUser: AppUserProfile) => {
    if (!user) return;
    setIsCreating(true);
    try {
      const { data: myConversations, error: myConvError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);
      if (myConvError) throw myConvError;
      const myConvIds = myConversations.map((c) => c.conversation_id);
      if (myConvIds.length > 0) {
        const { data: sharedMembers, error: sharedError } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .in('conversation_id', myConvIds)
          .eq('user_id', targetUser.id);
        if (sharedError) throw sharedError;
        if (sharedMembers && sharedMembers.length > 0) {
          setActiveConversationPreview({
            title: targetUser.display_name || targetUser.username || 'Chat',
            avatarUrl: targetUser.avatar_url ?? undefined,
          });
          setActiveConversationId(sharedMembers[0].conversation_id);
          setIsInConversation(true);
          setShowNewChatModal(false);
          return;
        }
      }
      // Generate the conversation id client-side so we never need to SELECT
      // the row back (which would fail RLS before members are inserted).
      const newConvId = crypto.randomUUID();
      const { error: createError } = await supabase
        .from('conversations')
        .insert({ id: newConvId, is_group: false, title: targetUser.display_name || targetUser.username });
      if (createError) throw createError;

      // Insert current user first — RLS on conversation_members requires the
      // authenticated user to be the one being inserted (auth.uid() = user_id).
      // Inserting both rows at once triggers the policy for each row independently,
      // and the second row (targetUser) fails because auth.uid() !== targetUser.id.
      // Solution: insert self first, then insert the other member via a separate call.
      const { error: selfMemberError } = await supabase
        .from('conversation_members')
        .insert({ conversation_id: newConvId, user_id: user.id });
      if (selfMemberError) throw selfMemberError;

      const { error: otherMemberError } = await supabase
        .from('conversation_members')
        .insert({ conversation_id: newConvId, user_id: targetUser.id });
      if (otherMemberError) throw otherMemberError;

      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setActiveConversationPreview({
        title: targetUser.display_name || targetUser.username || 'Chat',
        avatarUrl: targetUser.avatar_url ?? undefined,
      });
      setActiveConversationId(newConvId);
      setIsInConversation(true);
      setShowNewChatModal(false);
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error('Impossible de démarrer la conversation');
      toast('Erreur : ' + parsedError.message, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredUsers = allUsers;

  // Split into friends and others
  const filteredFriendUsers = filteredUsers.filter((u) => friendIds.has(u.id));
  const filteredOtherUsers = filteredUsers.filter((u) => !friendIds.has(u.id));

  const activeConversation = useMemo(
    () =>
      conversations?.find(
        (c: ConversationRow) => c.conversations?.id === activeConversationId
      )?.conversations,
    [activeConversationId, conversations]
  );

  if (activeConversationId) {
    const otherMember = activeConversation?.conversation_members?.find(
      (m) => m.user_id !== user?.id
    );
    return (
      <ConversationScreen
        conversationId={activeConversationId}
        onBack={() => {
          setActiveConversationId(null);
          setActiveConversationPreview(null);
          setIsInConversation(false);
        }}
        title={activeConversation?.title || activeConversationPreview?.title || 'Chat'}
        avatarUrl={otherMember?.users?.avatar_url ?? activeConversationPreview?.avatarUrl}
      />
    );
  }

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden ${t.bg} ${t.text}`}>
      {/* ── Header — Snapchat style ── */}
      <div className="relative flex items-center justify-between px-4 pt-12 pb-3">
        {/* Left — profile avatar */}
        <button
          onClick={() => setShowProfile(true)}
          aria-label="Profil"
          className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center active:scale-90 transition-transform"
          style={{ background: 'linear-gradient(135deg, #FFFC00 0%, #ff9500 100%)' }}
        >
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" />
          ) : (
            <span className="text-black font-black text-sm">
              {(user?.user_metadata?.username || user?.email || 'U').charAt(0).toUpperCase()}
            </span>
          )}
        </button>

        {/* Center — title */}
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[19px] font-black tracking-tight">Chat</h1>

        {/* Right — compose */}
        <button
          onClick={() => setShowNewChatModal(true)}
          aria-label="Nouveau message"
          className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
          style={{ background: t.isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.1)' }}
        >
          <Edit3 size={17} />
        </button>
      </div>

      {/* ── Search bar — Snapchat dark pill ── */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${t.textMuted}`} />
          <input
            type="text"
            placeholder="Rechercher..."
            readOnly
            onClick={() => setShowNewChatModal(true)}
            className={`w-full h-[38px] rounded-full pl-9 pr-4 text-sm font-semibold focus:outline-none cursor-pointer snap-input ${t.isLight ? 'placeholder-black/35' : 'placeholder-white/35'}`}
          />
        </div>
      </div>

      {/* Realtime status */}
      {realtimeStatus !== 'connected' && (
        <div className="mx-4 mb-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-400 text-xs font-medium">Reconnexion en cours...</span>
        </div>
      )}

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto scroll-hide px-4 pb-28">
        {isLoading && (
          <div className="space-y-1 pt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-3">
                <Skeleton className="w-14 h-14 rounded-full shrink-0" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /></div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && conversations && conversations.length > 0 && (
          <div className="pt-1">
            {conversations.map((convObj) => {
              const conv = convObj.conversations;
              if (!conv) return null;
              return (
                <SwipeableConvRow
                  key={conv.id}
                  conv={conv}
                  userId={user?.id}
                  t={t}
                  onOpen={() => {
                    setActiveConversationId(conv.id);
                    setIsInConversation(true);
                  }}
                  onDelete={handleDeleteConversation}
                />
              );
            })}
          </div>
        )}

        {!isLoading && (!conversations || conversations.length === 0) && (
          <div className="flex flex-col items-center justify-center pt-20 gap-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${t.surface}`}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={t.isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'} strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className={`font-bold text-lg ${t.text}`}>Aucune conversation</p>
              <p className={`text-sm mt-1 ${t.textMuted}`}>Commence à chatter avec tes amis</p>
            </div>
            <button onClick={() => setShowNewChatModal(true)} className="mt-2 px-6 py-3 bg-snap-yellow text-black font-black rounded-full text-sm shadow-snap active:scale-95 transition-all">
              Nouveau chat
            </button>
          </div>
        )}
      </div>

      {/* New Chat / Group Modal */}
      {showNewChatModal && (
        <div className={`absolute inset-0 z-50 flex justify-center backdrop-blur-md ${t.isLight ? 'bg-[#f0f2f8]/75' : 'bg-black/70'} ${t.text}`}>
          <div className={`w-full max-w-[430px] h-full flex flex-col ${t.isLight ? 'bg-[#f0f2f8]/98' : 'bg-black/95'} border-x ${t.borderMuted}`}>
            
            {/* Header */}
            <div className={`flex items-center gap-3 px-4 pt-14 pb-4 border-b ${t.borderMuted}`}>
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                  setSearchQuery('');
                  setGroupTitle('');
                  setSelectedFriends([]);
                  setModalMode('chat');
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center ${t.iconBtn}`}
              >
                <X size={18} />
              </button>
              <h2 className="text-lg font-black flex-1">
                {modalMode === 'chat' ? 'Nouveau chat' : 'Créer un groupe'}
              </h2>
            </div>

            {/* Sliding tab switcher */}
            <div className="px-4 py-3 flex justify-center border-b border-black/5 dark:border-white/5">
              <div className={`flex p-1 rounded-full w-full max-w-[340px] border ${t.isLight ? 'bg-black/5 border-black/5' : 'bg-white/5 border-white/5'}`}>
                <button
                  type="button"
                  onClick={() => setModalMode('chat')}
                  className={`flex-1 py-2 rounded-full text-[11px] font-black tracking-wider uppercase transition-all ${modalMode === 'chat' ? 'bg-snap-yellow text-black shadow-md scale-100' : `${t.textMuted} hover:text-current active:scale-95`}`}
                >
                  Nouveau Chat
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode('group')}
                  className={`flex-1 py-2 rounded-full text-[11px] font-black tracking-wider uppercase transition-all ${modalMode === 'group' ? 'bg-snap-yellow text-black shadow-md scale-100' : `${t.textMuted} hover:text-current active:scale-95`}`}
                >
                  Nouveau Groupe
                </button>
              </div>
            </div>

            {modalMode === 'group' && (
              /* Group customization panel */
              <div className="flex flex-col items-center gap-4 py-4 px-6 border-b border-black/5 dark:border-white/5">
                <div className="relative group">
                  <div className="absolute inset-0 rounded-full bg-snap-yellow/15 blur-lg scale-110" />
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center font-black text-white text-2xl tracking-wider shadow-[0_4px_20px_rgba(0,0,0,0.15)] ring-4 ring-offset-2 transition-all duration-300 ${t.isLight ? 'ring-black/5 ring-offset-[#f0f2f8]' : 'ring-white/5 ring-offset-black'}`}
                    style={{
                      background: selectedPreset === 'sunset' ? 'linear-gradient(to bottom right, #6366f1, #a855f7, #ec4899)' :
                                  selectedPreset === 'emerald' ? 'linear-gradient(to bottom right, #34d399, #0d9488)' :
                                  selectedPreset === 'cyan' ? 'linear-gradient(to bottom right, #22d3ee, #2563eb)' :
                                  'linear-gradient(to bottom right, #facc15, #f97316, #ef4444)'
                    }}
                  >
                    {groupTitle.trim().substring(0, 2).toUpperCase() || 'GP'}
                  </div>
                </div>

                {/* Group name input */}
                <input
                  type="text"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  placeholder="Nom du groupe..."
                  maxLength={30}
                  className={`w-full text-center border-b font-extrabold text-lg focus:outline-none focus:border-snap-yellow transition-colors py-1 bg-transparent ${t.isLight ? 'border-black/10' : 'border-white/10'} ${t.text}`}
                />

                {/* Gradient preset selectors */}
                <div className="flex items-center gap-3 mt-1">
                  {(['sunset', 'emerald', 'cyan', 'gold'] as const).map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setSelectedPreset(preset)}
                      className={`w-8 h-8 rounded-full transition-all duration-300 relative ${selectedPreset === preset ? 'scale-110 ring-2 ring-snap-yellow ring-offset-2' : 'scale-90 hover:scale-100 opacity-70'}`}
                      style={{
                        background: preset === 'sunset' ? 'linear-gradient(to bottom right, #6366f1, #a855f7, #ec4899)' :
                                    preset === 'emerald' ? 'linear-gradient(to bottom right, #34d399, #0d9488)' :
                                    preset === 'cyan' ? 'linear-gradient(to bottom right, #22d3ee, #2563eb)' :
                                    'linear-gradient(to bottom right, #facc15, #f97316, #ef4444)',
                        '--tw-ring-offset-color': t.isLight ? '#f0f2f8' : '#000'
                      } as React.CSSProperties}
                    >
                      {selectedPreset === preset && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check size={12} className="text-white drop-shadow" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search bar */}
            <div className="px-4 py-3">
              <div className="relative">
                <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${t.textMuted}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={modalMode === 'chat' ? "Rechercher un utilisateur..." : "Filtrer tes amis..."}
                  autoFocus={modalMode === 'chat'}
                  className={`w-full border rounded-full h-11 pl-10 pr-4 text-sm focus:outline-none focus:border-snap-yellow/50 transition-all bg-transparent ${t.input} ${t.border} ${t.text} ${t.isLight ? 'placeholder-black/30' : 'placeholder-white/30'}`}
                />
              </div>
            </div>

            {/* Members / Users List */}
            <div className="flex-1 overflow-y-auto scroll-hide px-4 pb-8 flex flex-col gap-1.5">
              {isUsersLoading && <div className="flex justify-center pt-12"><Loader2 className={`animate-spin ${t.textMuted}`} size={28} /></div>}
              
              {!isUsersLoading && modalMode === 'chat' && (
                <>
                  {filteredUsers.length === 0 && <div className={`text-center pt-12 text-sm ${t.textMuted}`}>Aucun utilisateur trouvé</div>}
                  {filteredFriendUsers.length > 0 && (
                    <>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-1 mt-1 px-2 ${t.textMuted}`}>Amis</p>
                      {filteredFriendUsers.map((u) => <UserRow key={u.id} user={u} isFriend isCreating={isCreating} onSelect={() => handleStartChat(u)} />)}
                    </>
                  )}
                  {filteredOtherUsers.length > 0 && (
                    <>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-1 mt-3 px-2 ${t.textMuted}`}>Autres utilisateurs</p>
                      {filteredOtherUsers.map((u) => <UserRow key={u.id} user={u} isFriend={false} isCreating={isCreating} onSelect={() => handleStartChat(u)} />)}
                    </>
                  )}
                  {isFetchingNextPageData && (
                    <div className="flex justify-center py-2 shrink-0">
                      <Loader2 className={`animate-spin ${t.textMuted}`} size={20} />
                    </div>
                  )}
                  {hasNextUsersPage && (
                    <div ref={loadMoreUsersRef} className="h-1 w-full shrink-0" />
                  )}
                </>
              )}

              {!isUsersLoading && modalMode === 'group' && (
                <>
                  {/* For group creation, we show a multi-select list of friends */}
                  {filteredFriendUsers.length === 0 ? (
                    <div className={`text-center pt-12 text-sm ${t.textMuted}`}>Aucun ami trouvé. Ajoute des amis pour créer un groupe !</div>
                  ) : (
                    <>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-2 px-2 ${t.textMuted}`}>Choisis les membres de ton groupe ({selectedFriends.length} sélectionné{selectedFriends.length > 1 ? 's' : ''})</p>
                      <div className="flex flex-col gap-1">
                        {filteredFriendUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleFriendSelection(u.id)}
                            className={`w-full flex items-center justify-between px-3 py-3 rounded-2xl transition-all text-left ${t.surfaceHover} border border-transparent active:scale-[0.99]`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-full overflow-hidden shrink-0">
                                {u.avatar_url ? (
                                  <img src={u.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-sm">
                                    {u.username?.substring(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className={`font-bold text-[14.5px] truncate ${t.text}`}>{u.display_name || u.username}</p>
                                <p className={`text-xs ${t.textMuted}`}>@{u.username}</p>
                              </div>
                            </div>
                            
                            {/* Premium checkbox circle */}
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedFriends.includes(u.id) ? 'bg-snap-yellow border-snap-yellow scale-105 shadow-[0_2px_8px_rgba(255,252,0,0.4)]' : `${t.isLight ? 'border-black/15' : 'border-white/15'}`}`}>
                              {selectedFriends.includes(u.id) && (
                                <Check size={11} className="text-black" strokeWidth={3.5} />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Create group CTA Button */}
                  {filteredFriendUsers.length > 0 && (
                    <div className="pt-4 mt-auto">
                      <button
                        type="button"
                        disabled={isCreating || !groupTitle.trim() || selectedFriends.length === 0}
                        onClick={handleStartGroup}
                        className={`w-full py-4 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 rounded-2xl transition-all ${(!groupTitle.trim() || selectedFriends.length === 0) ? `bg-black/10 dark:bg-white/10 ${t.textMuted} cursor-not-allowed` : 'bg-snap-yellow text-black hover:scale-[1.02] active:scale-98 shadow-[0_4px_25px_rgba(255,252,0,0.35)]'}`}
                      >
                        {isCreating ? (
                          <Loader2 className="animate-spin text-black" size={18} />
                        ) : (
                          <>
                            <Users size={16} />
                            Créer le groupe ({selectedFriends.length})
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── User row sub-component ────────────────────────────────────
const UserRow: React.FC<{
  user: AppUserProfile;
  isFriend: boolean;
  isCreating: boolean;
  onSelect: () => void;
}> = ({ user, isFriend, isCreating, onSelect }) => {
  const t = useTheme();
  return (
    <button onClick={onSelect} disabled={isCreating}
      className={`w-full flex items-center gap-3 px-2 py-3 rounded-2xl transition-colors text-left disabled:opacity-50 ${t.surfaceHover}`}>
      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
        {user.avatar_url ? <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : (
          <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-sm">
            {user.username?.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-bold text-[15px] truncate ${t.text}`}>{user.display_name || user.username}</p>
          {isFriend && <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5 shrink-0">Amis</span>}
        </div>
        <p className={`text-sm ${t.textMuted}`}>@{user.username}</p>
      </div>
      {isCreating ? <Loader2 size={18} className={`animate-spin shrink-0 ${t.textMuted}`} /> : (
        <div className="w-8 h-8 rounded-full bg-snap-yellow flex items-center justify-center shrink-0">
          <span className="text-black font-black text-lg leading-none">+</span>
        </div>
      )}
    </button>
  );
};
