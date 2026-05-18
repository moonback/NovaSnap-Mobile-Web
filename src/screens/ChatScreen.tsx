import React, { useMemo, useState, useRef, useCallback } from 'react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useConversations } from '../hooks/useConversations';
import { useFriends } from '../hooks/useFriends';
import { Loader2, User, X, Search, Edit3, ChevronRight, Trash2 } from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import ConversationScreen from './ConversationScreen';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastProvider';
import { useTheme } from '../hooks/useTheme';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import type { AppUserProfile, ConversationRow } from '../lib/types';

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
  const bgColor = useTransform(x, [-200, -72, 0], ['#ef4444', '#dc2626', '#dc2626']);

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
    if (isDeleting) return;
    isDragging.current = false;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDeleting) return;
    const delta = e.clientX - startX.current;
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

  const lastMsg = conv.messages?.[0];
  const hasNew = !!(lastMsg && lastMsg.sender_id !== userId);
  const otherMember = conv.conversation_members?.find((m) => m.user_id !== userId);
  const otherAvatar = otherMember?.users?.avatar_url;
  const initials = conv.title?.substring(0, 2).toUpperCase() || 'CH';

  return (
    <div className="relative overflow-hidden rounded-2xl mb-0.5">
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
        className={`relative flex items-center gap-3 px-2 py-3 rounded-2xl cursor-pointer select-none touch-pan-y ${t.bg} ${isDeleting ? 'pointer-events-none' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        <div className="relative shrink-0">
          <div className={`w-14 h-14 rounded-full overflow-hidden ${hasNew ? `ring-2 ring-snap-yellow ring-offset-2 ${t.isLight ? 'ring-offset-[#f0f2f8]' : 'ring-offset-black'}` : ''}`}>
            {otherAvatar
              ? <img src={otherAvatar} alt="Avatar" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-sm">{initials}</div>
            }
          </div>
          {hasNew && <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-snap-yellow border-2 ${t.isLight ? 'border-[#f0f2f8]' : 'border-black'}`} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className={`font-bold text-[15px] truncate ${t.text}`}>{conv.title}</span>
            {lastMsg && <span className={`text-xs shrink-0 ml-2 ${t.textFaint}`}>{timeAgo(lastMsg.created_at)}</span>}
          </div>
          {lastMsg
            ? <p className={`text-sm truncate ${hasNew ? 'text-snap-yellow font-semibold' : t.textMuted}`}>
                {lastMsg.message_type !== 'TEXT' ? '📷 Snap' : lastMsg.content}
              </p>
            : <p className={`text-sm ${t.textFaint}`}>Aucun message</p>
          }
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

  const { data: allUsers, isLoading: isUsersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url');
      if (error) throw error;
      return Promise.all(
        data.map(async (u) => {
          if (u.avatar_url) u.avatar_url = await getValidMediaUrl('avatars', u.avatar_url);
          return u;
        })
      );
    },
    enabled: showNewChatModal,
  });

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

  const otherUsers = allUsers?.filter((u) => u.id !== user?.id) || [];
  const filteredUsers = otherUsers.filter(
    (u) =>
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.display_name && u.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <button onClick={() => setShowProfile(true)} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${t.iconBtn}`}>
          <User size={18} />
        </button>
        <h1 className="text-xl font-black tracking-tight">Chat</h1>
        <button onClick={() => setShowNewChatModal(true)} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${t.iconBtn}`}>
          <Edit3 size={17} />
        </button>
      </div>

      {/* Search bar */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${t.textMuted}`} />
          <input type="text" placeholder="Rechercher..." readOnly onClick={() => setShowNewChatModal(true)}
            className={`w-full border rounded-full h-10 pl-10 pr-4 text-sm focus:outline-none transition-all ${t.input} ${t.border} ${t.text} ${t.isLight ? 'placeholder-black/30' : 'placeholder-white/30'}`}
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

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className={`absolute inset-0 z-50 flex justify-center backdrop-blur-md ${t.isLight ? 'bg-[#f0f2f8]/75' : 'bg-black/70'} ${t.text}`}>
          <div className={`w-full max-w-[430px] h-full flex flex-col ${t.isLight ? 'bg-[#f0f2f8]/98' : 'bg-black/95'} border-x ${t.borderMuted}`}>
          <div className={`flex items-center gap-3 px-4 pt-14 pb-4 border-b ${t.borderMuted}`}>
            <button onClick={() => { setShowNewChatModal(false); setSearchQuery(''); }} className={`w-9 h-9 rounded-full flex items-center justify-center ${t.iconBtn}`}>
              <X size={18} />
            </button>
            <h2 className="text-lg font-black flex-1">Nouveau chat</h2>
          </div>
          <div className="px-4 py-4">
            <div className="relative">
              <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${t.textMuted}`} />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher un utilisateur..." autoFocus
                className={`w-full border rounded-full h-11 pl-10 pr-4 text-sm focus:outline-none focus:border-snap-yellow/50 transition-all ${t.input} ${t.border} ${t.text} ${t.isLight ? 'placeholder-black/30' : 'placeholder-white/30'}`}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scroll-hide px-4 pb-8">
            {isUsersLoading && <div className="flex justify-center pt-12"><Loader2 className={`animate-spin ${t.textMuted}`} size={28} /></div>}
            {!isUsersLoading && filteredUsers.length === 0 && <div className={`text-center pt-12 text-sm ${t.textMuted}`}>Aucun utilisateur trouvé</div>}
            {!isUsersLoading && filteredFriendUsers.length > 0 && (
              <>
                <p className={`text-xs font-bold uppercase tracking-wider mb-2 px-2 ${t.textMuted}`}>Amis</p>
                {filteredFriendUsers.map((u) => <UserRow key={u.id} user={u} isFriend isCreating={isCreating} onSelect={() => handleStartChat(u)} />)}
              </>
            )}
            {!isUsersLoading && filteredOtherUsers.length > 0 && (
              <>
                {filteredFriendUsers.length > 0 && <p className={`text-xs font-bold uppercase tracking-wider mb-2 mt-4 px-2 ${t.textMuted}`}>Autres utilisateurs</p>}
                {filteredOtherUsers.map((u) => <UserRow key={u.id} user={u} isFriend={false} isCreating={isCreating} onSelect={() => handleStartChat(u)} />)}
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
