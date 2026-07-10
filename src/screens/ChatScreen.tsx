import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useConversations } from '../hooks/useConversations';
import { useFriends } from '../hooks/useFriends';
import { useCurrentUserProfile } from '../hooks/useCurrentUserProfile';
import { 
  Loader2, 
  X, 
  Search, 
  UserPlus, 
  Trash2, 
  Check, 
  Users, 
  MessageCirclePlus, 
  Camera
} from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import ConversationScreen from './ConversationScreen';
import { useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastProvider';
import { useTheme } from '../hooks/useTheme';
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion';
import type { AppUserProfile, ConversationRow, ConversationMessage } from '../lib/types';

// Theme token type derived from the useTheme hook
type ThemeTokens = ReturnType<typeof useTheme>;

// Constants for better maintainability
const SWIPE_THRESHOLD = -72;
const DELETE_THRESHOLD = -200;
const MAX_GROUP_MEMBERS = 99;
const USERS_PER_PAGE = 20;
const MAX_QUICK_FRIENDS = 12;

// Utility functions
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'maintenant';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
}

// Memoized utility functions for better performance
const convHasNew = (conv: NonNullable<ConversationRow['conversations']>, userId: string | undefined) => {
  const lastMsg = conv.messages?.[0];
  return !!(lastMsg && lastMsg.sender_id !== userId && (!lastMsg.opened_by || !lastMsg.opened_by.includes(userId || '')));
};

const getConvDisplayTitle = (conv: NonNullable<ConversationRow['conversations']>) => {
  const titleParts = conv.title?.split('::') ?? [];
  return titleParts[0] || 'Chat';
};

// ── Swipeable conversation row ────────────────────────────────
const getStatusIcon = (lastMsg: ConversationMessage | null, userId: string | undefined, hasNew: boolean) => {
  if (!lastMsg) return null;
  const isMe = lastMsg.sender_id === userId;
  const isImage = lastMsg.message_type === 'IMAGE';
  const isVideo = lastMsg.message_type === 'VIDEO';

  const color = isImage ? '#ff004f' : isVideo ? '#9b51e0' : '#00b2ff';
  const shadowColor = isImage ? 'rgba(255,0,79,0.4)' : isVideo ? 'rgba(155,81,224,0.4)' : 'rgba(0,178,255,0.4)';

  if (!isMe) {
    if (hasNew) {
      const baseClasses = "w-3.5 h-3.5 shrink-0 animate-pulse";
      const shape = isImage || isVideo ? "rounded-[4px]" : "rounded-full";
      return (
        <div
          className={`${baseClasses} ${shape}`}
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${shadowColor}` }}
        />
      );
    } else {
      const baseClasses = "w-3.5 h-3.5 border-2 shrink-0";
      const shape = isImage || isVideo ? "rounded-[4px]" : "rounded-full";
      return <div className={`${baseClasses} ${shape}`} style={{ borderColor: color }} />;
    }
  } else {
    const isOpened = lastMsg.opened_by && lastMsg.opened_by.length > 0;
    if (isOpened) {
      return (
        <svg 
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke={color} 
          strokeWidth="3.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="shrink-0"
          aria-label="Message lu"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
    } else {
      return (
        <svg 
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill={color} 
          stroke={color} 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="shrink-0" 
          style={{ filter: `drop-shadow(0 0 4px ${shadowColor})` }}
          aria-label="Message envoyé"
        >
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
      const messageType = isImage || isVideo ? 'Nouveau Snap' : 'Nouveau chat';
      return (
        <span className={`font-black ${colorClass} text-[13px] tracking-tight`}>
          {messageType}
        </span>
      );
    } else {
      const content = isImage || isVideo 
        ? 'Snap reçu · Appuie pour voir' 
        : lastMsg.content;
      return (
        <span className={`text-[13px] leading-snug ${t.textMuted} truncate block`}>
          {content}
        </span>
      );
    }
  } else {
    const isOpened = lastMsg.opened_by && lastMsg.opened_by.length > 0;
    const status = isImage || isVideo
      ? (isOpened ? 'Ouvert' : 'Envoyé')
      : (isOpened ? 'Lu' : 'Distribué');
      
    return (
      <span className={`text-[13px] leading-snug ${t.textMuted}`}>
        {status}
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

// Memoized group gradient selector for better performance
const getGroupGradient = (preset: string) => {
  const gradients = {
    emerald: 'from-emerald-400 to-teal-600 text-white',
    cyan: 'from-cyan-400 to-blue-600 text-white',
    gold: 'from-yellow-400 via-orange-500 to-red-500 text-white',
    sunset: 'from-indigo-500 via-purple-500 to-pink-500 text-white'
  } as const;
  
  return gradients[preset as keyof typeof gradients] || gradients.sunset;
};

const SwipeableConvRow: React.FC<SwipeableConvRowProps> = ({ conv, userId, t, onOpen, onDelete }) => {
  const x = useMotionValue(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Optimized motion transforms
  const deleteOpacity = useTransform(x, [-80, -40], [1, 0]);
  const deleteScale = useTransform(x, [-200, -72], [1.3, 1]);

  const snapBack = useCallback(() => {
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
  }, [x]);

  const confirmDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await animate(x, -500, { duration: 0.25, ease: 'easeIn' });
      await onDelete(conv.id);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      setIsDeleting(false);
      snapBack();
    }
  }, [conv.id, onDelete, x, snapBack]);

  // Optimized pointer event handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    isDragging.current = false;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [isDeleting]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isDeleting) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 6) {
      e.stopPropagation();
    }
    if (delta > 0) { x.set(0); return; }
    isDragging.current = Math.abs(delta) > 6;
    x.set(Math.max(delta, -240));
  }, [isDeleting, x]);

  const handlePointerUp = useCallback(async () => {
    if (isDeleting) return;
    const current = x.get();
    if (current <= DELETE_THRESHOLD) {
      await confirmDelete();
    } else if (current <= SWIPE_THRESHOLD) {
      animate(x, -80, { type: 'spring', stiffness: 400, damping: 30 });
    } else {
      snapBack();
    }
  }, [isDeleting, x, confirmDelete, snapBack]);

  const handleClick = useCallback(() => {
    if (isDragging.current) return;
    if (x.get() !== 0) { snapBack(); return; }
    onOpen();
  }, [onOpen, snapBack, x]);

  // Memoized computed values
  const lastMsg = useMemo(() => conv.messages?.[0], [conv.messages]);
  const hasNew = useMemo(() => convHasNew(conv, userId), [conv, userId]);
  const isGroup = conv.is_group;
  const titleParts = conv.title?.split('::') ?? [];
  const displayTitle = titleParts[0] || 'Chat';
  const avatarPreset = titleParts[1] || 'sunset';

  const otherMember = useMemo(
    () => !isGroup ? conv.conversation_members?.find((m) => m.user_id !== userId) : null,
    [conv.conversation_members, isGroup, userId]
  );
  
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
    <div className="relative overflow-hidden">
      {/* Delete background — red, not yellow */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-6"
        style={{ backgroundColor: '#ef4444' }}
      >
        <motion.div 
          style={{ opacity: deleteOpacity, scale: deleteScale }} 
          className="flex flex-col items-center gap-0.5"
        >
          <AnimatePresence mode="wait">
            {isDeleting ? (
              <motion.div key="loader" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Loader2 size={22} className="text-white animate-spin" />
              </motion.div>
            ) : (
              <motion.div key="trash" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Trash2 size={22} className="text-white" />
              </motion.div>
            )}
          </AnimatePresence>
          <span className="text-white text-[9px] font-black uppercase tracking-wider">Suppr.</span>
        </motion.div>
      </motion.div>

      {/* Row content */}
      <motion.div
        style={{ x }}
        className={`relative flex items-center gap-3.5 pl-4 pr-3 py-3.5 cursor-pointer select-none touch-pan-y ${isDeleting ? 'pointer-events-none' : ''} ${hasNew ? (t.isLight ? 'bg-black/[0.03]' : 'bg-white/[0.04]') : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        <div className="relative shrink-0">
          <div className={`w-[52px] h-[52px] rounded-full overflow-hidden transition-all duration-200 ${hasNew ? `ring-[2px] ${ringColor} ring-offset-[2px] ${t.ringOffset}` : ''}`}>
            {isGroup ? (
              <div className={`w-full h-full bg-gradient-to-br ${getGroupGradient(avatarPreset)} flex items-center justify-center font-black text-white text-sm tracking-wider`}>
                {initials}
              </div>
            ) : otherAvatar ? (
              <img 
                src={otherAvatar} 
                alt={`Avatar de ${displayTitle}`} 
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-neutral-600 to-neutral-800 flex items-center justify-center font-black text-white text-sm">
                {initials}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <span className={`truncate ${hasNew ? 'font-black text-[15.5px]' : 'font-semibold text-[15px]'} tracking-tight ${t.text}`}>
              {displayTitle}
            </span>
            {lastMsg && (
              <span className={`text-[11px] shrink-0 tabular-nums ${t.textFaint}`}>
                {timeAgo(lastMsg.created_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {getStatusIcon(lastMsg, userId, hasNew)}
            <div className="truncate flex-1 min-w-0">
              {getStatusText(lastMsg, userId, hasNew, t)}
            </div>
          </div>
        </div>

        {/* Unread dot — small and clean */}
        {hasNew && (
          <div className="w-2 h-2 rounded-full bg-[#00b2ff] shrink-0 self-center" />
        )}
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
  const { data: currentProfile } = useCurrentUserProfile();
  const t = useTheme();
  const queryClient = useQueryClient();

  // Group creation states
  const [modalMode, setModalMode] = useState<'chat' | 'group'>('chat');
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<'sunset' | 'emerald' | 'cyan' | 'gold'>('sunset');

  const toggleFriendSelection = useCallback((friendId: string) => {
    setSelectedFriends((prev) => {
      const exists = prev.includes(friendId);
      if (!exists && prev.length >= MAX_GROUP_MEMBERS) {
        toast('La limite est de 100 membres par groupe !', 'warning');
        return prev;
      }
      return exists ? prev.filter((id) => id !== friendId) : [...prev, friendId];
    });
  }, [toast]);

  const resetModalState = useCallback(() => {
    setShowNewChatModal(false);
    setSearchQuery('');
    setGroupTitle('');
    setSelectedFriends([]);
    setModalMode('chat');
    setSelectedPreset('sunset');
  }, []);

  const handleStartGroup = useCallback(async () => {
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

      // 2. Add current user first (essential for RLS)
      const { error: selfMemberError } = await supabase
        .from('conversation_members')
        .insert({ conversation_id: newConvId, user_id: user.id, role: 'ADMIN' });
      if (selfMemberError) throw selfMemberError;

      // 3. Add other members in batch
      const membersToInsert = selectedFriends.map((friendId) => ({
        conversation_id: newConvId,
        user_id: friendId,
        role: 'MEMBER'
      }));
      
      const { error: membersError } = await supabase
        .from('conversation_members')
        .insert(membersToInsert);
      if (membersError) throw membersError;

      // 4. Send system message
      await supabase.from('messages').insert({
        conversation_id: newConvId,
        sender_id: user.id,
        message_type: 'TEXT',
        content: `📢 ${user.user_metadata?.display_name || user.user_metadata?.username || user.email?.split('@')[0] || 'Un utilisateur'} a créé le groupe "${groupTitle.trim()}"`,
      });

      // 5. Update UI
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      
      setActiveConversationPreview({
        title: `${groupTitle.trim()}::${selectedPreset}`,
        avatarUrl: 'group',
      });
      setActiveConversationId(newConvId);
      setIsInConversation(true);
      resetModalState();
      toast('Groupe créé avec succès ! 🎉', 'success');
      
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error('Impossible de créer le groupe');
      toast('Erreur : ' + parsedError.message, 'error');
    } finally {
      setIsCreating(false);
    }
  }, [user, groupTitle, selectedPreset, selectedFriends, queryClient, toast, resetModalState, setIsInConversation]);

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

  // Enhanced friends data with better filtering
  const { friends } = useFriends();
  const friendIds = useMemo(() => new Set(friends.map((f) => f.user.id)), [friends]);

  const {
    data: usersPages,
    isLoading: isUsersLoading,
    fetchNextPage: fetchNextUsersPage,
    hasNextPage: hasNextUsersPage,
    isFetchingNextPage: isFetchingNextPageData,
    error: usersError,
  } = useInfiniteQuery({
    queryKey: ['users', searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('users')
        .select('id, username, display_name, avatar_url')
        .neq('id', user?.id ?? '')
        .order('username');

      if (searchQuery) {
        query = query.or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.range(
        (pageParam as number) * USERS_PER_PAGE, 
        ((pageParam as number) + 1) * USERS_PER_PAGE - 1
      );
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
      return lastPage.length === USERS_PER_PAGE ? allPages.length : undefined;
    },
    enabled: showNewChatModal && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
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

  const handleStartChat = useCallback(async (targetUser: AppUserProfile) => {
    if (!user) return;
    
    setIsCreating(true);
    try {
      // Optimized conversation check
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
          resetModalState();
          return;
        }
      }
      
      // Create new conversation
      const newConvId = crypto.randomUUID();
      const { error: createError } = await supabase
        .from('conversations')
        .insert({ 
          id: newConvId, 
          is_group: false, 
          title: targetUser.display_name || targetUser.username 
        });
      if (createError) throw createError;

      // Insert current user first for RLS compliance
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
      resetModalState();
      
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error('Impossible de démarrer la conversation');
      toast('Erreur : ' + parsedError.message, 'error');
    } finally {
      setIsCreating(false);
    }
  }, [user, queryClient, toast, resetModalState, setIsInConversation]);

  // Optimized computed values with better memoization
  const filteredUsers = useMemo(() => allUsers, [allUsers]);
  const filteredFriendUsers = useMemo(() => 
    filteredUsers.filter((u) => friendIds.has(u.id)), 
    [filteredUsers, friendIds]
  );
  const filteredOtherUsers = useMemo(() => 
    filteredUsers.filter((u) => !friendIds.has(u.id)), 
    [filteredUsers, friendIds]
  );

  const activeConversation = useMemo(
    () => conversations?.find(
      (c: ConversationRow) => c.conversations?.id === activeConversationId
    )?.conversations,
    [activeConversationId, conversations]
  );

  const sortedConversations = useMemo(() => {
    if (!conversations) return [];
    const rows = conversations
      .map((c) => c.conversations)
      .filter((c): c is NonNullable<typeof c> => !!c);
    return [...rows].sort((a, b) => {
      const aNew = convHasNew(a, user?.id);
      const bNew = convHasNew(b, user?.id);
      if (aNew !== bNew) return aNew ? -1 : 1;
      const aTime = a.messages?.[0]?.created_at ?? '';
      const bTime = b.messages?.[0]?.created_at ?? '';
      return bTime.localeCompare(aTime);
    });
  }, [conversations, user?.id]);

  const newConversations = useMemo(
    () => sortedConversations.filter((c) => convHasNew(c, user?.id)),
    [sortedConversations, user?.id]
  );

  const recentConversations = useMemo(
    () => sortedConversations.filter((c) => !convHasNew(c, user?.id)),
    [sortedConversations, user?.id]
  );

  const quickFriends = useMemo(() => {
    const seen = new Set<string>();
    const items: { 
      id: string; 
      name: string; 
      avatar: string | null; 
      convId: string; 
      hasNew: boolean;
    }[] = [];
    
    for (const conv of sortedConversations) {
      if (conv.is_group) continue;
      const member = conv.conversation_members?.find((m) => m.user_id !== user?.id);
      if (!member || seen.has(member.user_id)) continue;
      
      seen.add(member.user_id);
      items.push({
        id: member.user_id,
        name: getConvDisplayTitle(conv),
        avatar: member.users?.avatar_url ?? null,
        convId: conv.id,
        hasNew: convHasNew(conv, user?.id),
      });
      
      if (items.length >= MAX_QUICK_FRIENDS) break;
    }
    return items;
  }, [sortedConversations, user?.id]);

  // Optimized conversation row renderer
  const renderConvRow = useCallback((conv: NonNullable<ConversationRow['conversations']>) => (
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
  ), [user?.id, t, setIsInConversation, handleDeleteConversation]);

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
      {/* ── Header Snapchat ── */}
      <div className="shrink-0 px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <motion.button
            onClick={() => setShowProfile(true)}
            aria-label="Profil"
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-[1.5px] ring-white/20"
          >
            {currentProfile?.avatar_url ? (
              <img src={currentProfile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-black text-sm text-black"
                style={{ background: 'linear-gradient(135deg, #FFFC00 0%, #ff9500 100%)' }}
              >
                {(currentProfile?.username || user?.user_metadata?.username || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </motion.button>

          <h1 className="text-[22px] font-black tracking-tight absolute left-1/2 -translate-x-1/2">
            Chat
          </h1>

          <motion.button
            onClick={() => setShowNewChatModal(true)}
            aria-label="Nouveau message"
            whileTap={{ scale: 0.9 }}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${t.isLight ? 'bg-black/8 text-black' : 'bg-white/10 text-white'}`}
          >
            <UserPlus size={18} strokeWidth={2} />
          </motion.button>
        </div>

        {/* Search — pill Snapchat */}
        <button
          type="button"
          onClick={() => setShowNewChatModal(true)}
          className={`w-full flex items-center gap-2.5 h-10 rounded-full px-4 ${t.input} border ${t.borderMuted}`}
        >
          <Search size={15} className={t.textMuted} />
          <span className={`text-[14px] font-medium ${t.textMuted}`}>Rechercher</span>
        </button>
      </div>

      {/* Realtime status */}
      {realtimeStatus !== 'connected' && (
        <div className="mx-4 mb-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-400 text-xs font-medium">Reconnexion en cours...</span>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scroll-hide pb-28">
        {/* Quick friends strip */}
        {!isLoading && quickFriends.length > 0 && (
          <div className="mb-2">
            <div className="flex gap-4 overflow-x-auto scroll-hide px-4 pb-3 pt-1">
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowNewChatModal(true)}
                className="flex flex-col items-center gap-1.5 shrink-0 w-[56px]"
                aria-label="Nouveau chat"
              >
                <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-sm" style={{ background: t.isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.1)' }}>
                  <MessageCirclePlus size={22} className={t.text} strokeWidth={1.8} />
                </div>
                <span className="text-[10px] font-bold text-center leading-tight max-w-[56px] truncate">Nouveau</span>
              </motion.button>

              {quickFriends.map((friend) => (
                <motion.button
                  key={friend.id}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    setActiveConversationId(friend.convId);
                    setIsInConversation(true);
                  }}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-[56px]"
                  aria-label={`Ouvrir la conversation avec ${friend.name}`}
                >
                  <div className={`relative w-[52px] h-[52px] rounded-full overflow-hidden ${friend.hasNew ? `ring-[2px] ring-[#00b2ff] ring-offset-[2px] ${t.ringOffset}` : ''}`}>
                    {friend.avatar ? (
                      <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-neutral-500 to-neutral-700 flex items-center justify-center font-black text-white text-xs">
                        {friend.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    {/* New message dot indicator */}
                    {friend.hasNew && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#00b2ff] rounded-full border-2 border-black" />
                    )}
                  </div>
                  <span className={`text-[10px] text-center leading-tight max-w-[56px] truncate ${friend.hasNew ? 'font-black' : 'font-semibold'} ${t.textMuted}`}>
                    {friend.name.split(' ')[0]}
                  </span>
                </motion.button>
              ))}
            </div>
            <div className={`mx-4 border-b ${t.borderMuted}`} />
          </div>
        )}

        {/* Nouveau chat row */}
        {!isLoading && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.99 }}
            onClick={() => setShowNewChatModal(true)}
            className={`w-full flex items-center gap-3.5 pl-4 pr-3 py-3.5 border-b ${t.borderMuted} transition-opacity`}
          >
            <div className={`w-[52px] h-[52px] rounded-full flex items-center justify-center shrink-0 ${t.isLight ? 'bg-black/6' : 'bg-white/8'}`}>
              <Camera size={22} className={t.textMuted} strokeWidth={1.8} />
            </div>
            <div className="flex-1 text-left">
              <p className={`font-bold text-[15px] tracking-tight ${t.text}`}>Nouveau Snap / Chat</p>
              <p className={`text-[13px] mt-0.5 ${t.textMuted}`}>Envoie un message à un ami</p>
            </div>
          </motion.button>
        )}

        {/* Skeleton loading */}
        {isLoading && (
          <div className="pt-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`flex items-center gap-3.5 pl-4 pr-3 py-3 border-b ${t.borderMuted}`}>
                <Skeleton className="w-[52px] h-[52px] rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Conversation list */}
        {!isLoading && sortedConversations.length > 0 && (
          <>
            {newConversations.length > 0 && (
              <section aria-label="Nouvelles conversations">
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <p className={`text-[11px] font-black uppercase tracking-[0.12em] ${t.textFaint}`}>
                    Nouveaux
                  </p>
                  <span className={`text-[10px] font-black rounded-full px-2 py-0.5 leading-none ${t.isLight ? 'bg-black/8 text-black/60' : 'bg-white/10 text-white/60'}`}>
                    {newConversations.length}
                  </span>
                </div>
                {newConversations.map(renderConvRow)}
              </section>
            )}

            {recentConversations.length > 0 && (
              <section aria-label="Conversations récentes">
                <p className={`px-4 pt-4 pb-1 text-[11px] font-black uppercase tracking-[0.12em] ${t.textFaint}`}>
                  {newConversations.length > 0 ? 'Récents' : 'Conversations'}
                </p>
                {recentConversations.map(renderConvRow)}
              </section>
            )}
          </>
        )}

        {/* Empty state */}
        {!isLoading && sortedConversations.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center pt-20 px-8 gap-5"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: t.isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)' }}
            >
              <MessageCirclePlus size={36} className={t.textFaint} strokeWidth={1.5} />
            </motion.div>
            <div className="text-center">
              <p className="font-black text-[18px] tracking-tight">Aucune conversation</p>
              <p className={`text-[14px] mt-1.5 leading-relaxed ${t.textMuted}`}>
                Envoie ton premier Snap ou démarre un chat avec tes amis
              </p>
            </div>
            <motion.button
              onClick={() => setShowNewChatModal(true)}
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.03 }}
              className={`px-8 py-3.5 font-bold rounded-full text-[14px] border ${t.isLight ? 'border-black/15 text-black bg-black/5' : 'border-white/15 text-white bg-white/8'}`}
            >
              Commencer à chatter
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* New Chat / Group Modal */}
      <AnimatePresence>
        {showNewChatModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`absolute inset-0 z-50 flex justify-center backdrop-blur-md ${t.isLight ? 'bg-[#f0f2f8]/80' : 'bg-black/80'} ${t.text}`}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              className={`w-full max-w-[430px] h-full flex flex-col ${t.bg}`}
            >

            {/* Header */}
            <div className={`flex items-center gap-3 px-4 pt-5 pb-4 border-b ${t.borderMuted}`}>
              <motion.button
                onClick={resetModalState}
                whileTap={{ scale: 0.9 }}
                className={`w-9 h-9 rounded-full flex items-center justify-center ${t.iconBtn}`}
                aria-label="Fermer"
              >
                <X size={18} />
              </motion.button>
              <h2 className="text-lg font-black flex-1">
                {modalMode === 'chat' ? 'Nouveau chat' : 'Créer un groupe'}
              </h2>
              {modalMode === 'group' && selectedFriends.length > 0 && (
                <motion.button
                  onClick={() => setModalMode('chat')}
                  whileTap={{ scale: 0.95 }}
                  className="text-xs font-bold text-snap-yellow bg-snap-yellow/10 px-3 py-1.5 rounded-full"
                >
                  {selectedFriends.length} sélectionnés
                </motion.button>
              )}
            </div>

            {/* Sliding tab switcher with enhanced animations */}
            <div className="px-4 py-3 flex justify-center border-b border-black/5 dark:border-white/5">
              <div className={`relative flex p-1 rounded-full w-full max-w-[340px] border ${t.isLight ? 'bg-black/5 border-black/5' : 'bg-white/5 border-white/5'}`}>
                <motion.button
                  type="button"
                  onClick={() => setModalMode('chat')}
                  whileTap={{ scale: 0.98 }}
                  className={`relative flex-1 py-2 rounded-full text-[11px] font-black tracking-wider uppercase transition-all z-10 ${modalMode === 'chat' ? (t.isLight ? 'text-black' : 'text-white') : `${t.textMuted} hover:text-current`}`}
                >
                  Nouveau Chat
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setModalMode('group')}
                  whileTap={{ scale: 0.98 }}
                  className={`relative flex-1 py-2 rounded-full text-[11px] font-black tracking-wider uppercase transition-all z-10 ${modalMode === 'group' ? (t.isLight ? 'text-black' : 'text-white') : `${t.textMuted} hover:text-current`}`}
                >
                  Nouveau Groupe
                </motion.button>
                <motion.div
                  className="absolute bg-white/90 dark:bg-white/15 rounded-full shadow-sm"
                  animate={{
                    x: modalMode === 'chat' ? 4 : '50%',
                    width: modalMode === 'chat' ? 'calc(50% - 8px)' : 'calc(50% - 8px)'
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  style={{
                    top: 4,
                    bottom: 4,
                    left: modalMode === 'chat' ? 4 : undefined,
                    right: modalMode === 'group' ? 4 : undefined
                  }}
                />
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

            {/* Enhanced Members / Users List with better error handling */}
            <div className="flex-1 overflow-y-auto scroll-hide px-4 pb-8 flex flex-col gap-1.5">
              {isUsersLoading && (
                <div className="flex flex-col items-center justify-center pt-12 gap-4">
                  <Loader2 className={`animate-spin ${t.textMuted}`} size={28} />
                  <span className={`text-sm ${t.textMuted}`}>Chargement des utilisateurs...</span>
                </div>
              )}

              {usersError && (
                <div className="flex flex-col items-center justify-center pt-12 gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${t.isLight ? 'bg-red-50' : 'bg-red-900/20'}`}>
                    <X size={24} className="text-red-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-red-500 mb-2">Erreur de chargement</p>
                    <p className={`text-sm ${t.textMuted}`}>Impossible de charger les utilisateurs</p>
                  </div>
                </div>
              )}

              {!isUsersLoading && !usersError && modalMode === 'chat' && (
                <>
                  {filteredUsers.length === 0 && (
                    <div className={`text-center pt-12 text-sm ${t.textMuted}`}>
                      {searchQuery ? 'Aucun utilisateur trouvé pour cette recherche' : 'Aucun utilisateur trouvé'}
                    </div>
                  )}
                  
                  {filteredFriendUsers.length > 0 && (
                    <>
                      <div className="flex items-center justify-between px-2 mb-1 mt-1">
                        <p className={`text-xs font-bold uppercase tracking-wider ${t.textMuted}`}>
                          Amis ({filteredFriendUsers.length})
                        </p>
                      </div>
                      {filteredFriendUsers.map((u) => (
                        <UserRow 
                          key={u.id} 
                          user={u} 
                          isFriend 
                          isCreating={isCreating} 
                          onSelect={() => handleStartChat(u)} 
                        />
                      ))}
                    </>
                  )}
                  
                  {filteredOtherUsers.length > 0 && (
                    <>
                      <div className="flex items-center justify-between px-2 mb-1 mt-3">
                        <p className={`text-xs font-bold uppercase tracking-wider ${t.textMuted}`}>
                          Autres utilisateurs ({filteredOtherUsers.length})
                        </p>
                      </div>
                      {filteredOtherUsers.map((u) => (
                        <UserRow 
                          key={u.id} 
                          user={u} 
                          isFriend={false} 
                          isCreating={isCreating} 
                          onSelect={() => handleStartChat(u)} 
                        />
                      ))}
                    </>
                  )}
                  
                  {/* Loading more indicator with better UX */}
                  {isFetchingNextPageData && (
                    <div className="flex justify-center py-4 shrink-0">
                      <div className="flex items-center gap-2">
                        <Loader2 className={`animate-spin ${t.textMuted}`} size={20} />
                        <span className={`text-sm ${t.textMuted}`}>Chargement...</span>
                      </div>
                    </div>
                  )}
                  
                  {hasNextUsersPage && (
                    <div ref={loadMoreUsersRef} className="h-1 w-full shrink-0" aria-hidden="true" />
                  )}
                </>
              )}

              {!isUsersLoading && !usersError && modalMode === 'group' && (
                <>
                  {filteredFriendUsers.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center pt-12 gap-4 text-center"
                    >
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${t.isLight ? 'bg-black/5' : 'bg-white/5'}`}>
                        <Users size={28} className={t.textFaint} strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className={`font-bold text-[15px] ${t.text}`}>Aucun ami trouvé</p>
                        <p className={`text-sm mt-1 ${t.textMuted}`}>Ajoute des amis pour créer un groupe !</p>
                      </div>
                    </motion.div>
                  ) : (
                    <>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-2 px-2 ${t.textMuted}`}>
                        Membres ({selectedFriends.length} sélectionné{selectedFriends.length > 1 ? 's' : ''})
                      </p>
                      <div className="flex flex-col gap-1">
                        {filteredFriendUsers.map((u) => {
                          const isSelected = selectedFriends.includes(u.id);
                          return (
                            <motion.button
                              key={u.id}
                              type="button"
                              whileTap={{ scale: 0.98 }}
                              onClick={() => toggleFriendSelection(u.id)}
                              className={`w-full flex items-center justify-between px-3 py-3 rounded-2xl transition-all text-left border active:scale-[0.99] ${
                                isSelected
                                  ? `border-snap-yellow/30 ${t.isLight ? 'bg-snap-yellow/5' : 'bg-snap-yellow/8'}`
                                  : `border-transparent ${t.surfaceHover}`
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-11 h-11 rounded-full overflow-hidden shrink-0 transition-all ${isSelected ? 'ring-2 ring-snap-yellow ring-offset-1' : ''} ${t.ringOffset}`}>
                                  {u.avatar_url ? (
                                    <img
                                      src={u.avatar_url}
                                      alt={`Avatar de ${u.display_name || u.username}`}
                                      className="w-full h-full object-cover"
                                    />
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

                              {/* Animated checkbox */}
                              <motion.div
                                animate={isSelected
                                  ? { scale: 1.08, backgroundColor: '#FFFC00', borderColor: '#FFFC00' }
                                  : { scale: 1, backgroundColor: 'transparent', borderColor: t.isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)' }
                                }
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0"
                                style={{ boxShadow: isSelected ? '0 2px 8px rgba(255,252,0,0.4)' : 'none' }}
                              >
                                <AnimatePresence>
                                  {isSelected && (
                                    <motion.div
                                      initial={{ scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0, opacity: 0 }}
                                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                                    >
                                      <Check size={11} className="text-black" strokeWidth={3.5} />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Enhanced group creation with better validation */}
                  {filteredFriendUsers.length > 0 && (
                    <div className="pt-4 mt-auto space-y-3">
                      {/* Group info summary */}
                      <div className={`p-3 rounded-2xl border ${t.isLight ? 'bg-black/2 border-black/5' : 'bg-white/2 border-white/5'}`}>
                        <div className="flex items-center justify-between text-xs">
                          <span className={t.textMuted}>Membres sélectionnés:</span>
                          <span className="font-bold text-snap-yellow">{selectedFriends.length}/{MAX_GROUP_MEMBERS}</span>
                        </div>
                        {groupTitle.trim() && (
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className={t.textMuted}>Nom du groupe:</span>
                            <span className="font-bold">{groupTitle.trim()}</span>
                          </div>
                        )}
                      </div>

                      {/* Create button with better states */}
                      <motion.button
                        type="button"
                        disabled={isCreating || !groupTitle.trim() || selectedFriends.length === 0}
                        onClick={handleStartGroup}
                        whileTap={{ scale: 0.98 }}
                        whileHover={{ scale: 1.02 }}
                        className={`w-full py-4 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 rounded-2xl transition-all ${
                          (!groupTitle.trim() || selectedFriends.length === 0) 
                            ? `bg-black/10 dark:bg-white/10 ${t.textMuted} cursor-not-allowed` 
                            : 'bg-snap-yellow text-black shadow-[0_4px_25px_rgba(255,252,0,0.35)]'
                        }`}
                      >
                        <AnimatePresence mode="wait">
                          {isCreating ? (
                            <motion.div
                              key="creating"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="flex items-center gap-2"
                            >
                              <Loader2 className="animate-spin text-black" size={18} />
                              <span>Création...</span>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="create"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="flex items-center gap-2"
                            >
                              <Users size={16} />
                              <span>Créer le groupe ({selectedFriends.length})</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </div>
                  )}
                </>
              )}
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Enhanced User Row Component ────────────────────────────────────
const UserRow: React.FC<{
  user: AppUserProfile;
  isFriend: boolean;
  isCreating: boolean;
  onSelect: () => void;
}> = React.memo(({ user, isFriend, isCreating, onSelect }) => {
  const t = useTheme();
  
  return (
    <motion.button 
      onClick={onSelect} 
      disabled={isCreating}
      whileTap={{ scale: 0.98 }}
      className={`w-full flex items-center gap-3 px-4 py-3 border-b ${t.borderMuted} transition-all text-left disabled:opacity-50 hover:bg-black/2 dark:hover:bg-white/2 rounded-lg mx-2 -mx-2`}
    >
      <div className="w-[48px] h-[48px] rounded-full overflow-hidden shrink-0 ring-2 ring-transparent hover:ring-snap-yellow/20 transition-all">
        {user.avatar_url ? (
          <img 
            src={user.avatar_url} 
            alt={`Avatar de ${user.display_name || user.username}`}
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-500 to-neutral-700 flex items-center justify-center font-black text-white text-sm">
            {user.username?.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-bold text-[15px] truncate ${t.text}`}>
            {user.display_name || user.username}
          </p>
          {isFriend && (
            <span className={`text-[9px] font-black rounded-full px-2 py-0.5 shrink-0 uppercase tracking-wide ${t.isLight ? 'bg-black/8 text-black/50' : 'bg-white/10 text-white/50'}`}>
              Ami
            </span>
          )}
        </div>
        <p className={`text-[13px] ${t.textMuted}`}>@{user.username}</p>
      </div>
      
      <div className="shrink-0">
        <AnimatePresence mode="wait">
          {isCreating ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
            >
              <Loader2 size={18} className={`animate-spin ${t.textMuted}`} />
            </motion.div>
          ) : (
            <motion.div
              key="add"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`w-8 h-8 rounded-full flex items-center justify-center ${t.isLight ? 'bg-black/7 text-black/60' : 'bg-white/10 text-white/60'}`}
            >
              <UserPlus size={15} strokeWidth={2} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
});
