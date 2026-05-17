import React, { useMemo, useState } from 'react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useConversations } from '../hooks/useConversations';
import { useFriends } from '../hooks/useFriends';
import { Loader2, User, X, Search, Edit3, ChevronRight, MessageCircle as MessageCircleIcon2 } from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import ConversationScreen from './ConversationScreen';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastProvider';
import { useTheme } from '../hooks/useTheme';
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

export default function ChatScreen() {
  const { data: conversations, isLoading, realtimeStatus } = useConversations();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationPreview, setActiveConversationPreview] = useState<{ title: string; avatarUrl?: string } | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { user, setShowProfile } = useAppStore();
  const t = useTheme();
  const queryClient = useQueryClient();

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
          setShowNewChatModal(false);
          return;
        }
      }
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({ is_group: false, title: targetUser.display_name || targetUser.username })
        .select()
        .single();
      if (createError) throw createError;
      const { error: memberError } = await supabase.from('conversation_members').insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: targetUser.id },
      ]);
      if (memberError) throw memberError;
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setActiveConversationPreview({
        title: targetUser.display_name || targetUser.username || 'Chat',
        avatarUrl: targetUser.avatar_url ?? undefined,
      });
      setActiveConversationId(newConv.id);
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
        }}
        title={activeConversation?.title || activeConversationPreview?.title || 'Chat'}
        avatarUrl={otherMember?.users?.avatar_url ?? activeConversationPreview?.avatarUrl}
      />
    );
  }

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden ${t.bg} ${t.text}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
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
              const lastMsg = conv.messages?.[0];
              const hasNew = !!(lastMsg && lastMsg.sender_id !== user?.id);
              const otherMember = conv.conversation_members?.find((m) => m.user_id !== user?.id);
              const otherAvatar = otherMember?.users?.avatar_url;
              const initials = conv.title?.substring(0, 2).toUpperCase() || 'CH';
              return (
                <button key={conv.id} onClick={() => setActiveConversationId(conv.id)}
                  className={`w-full flex items-center gap-3 px-2 py-3 rounded-2xl transition-colors text-left ${t.surfaceHover}`}>
                  <div className="relative shrink-0">
                    <div className={`w-14 h-14 rounded-full overflow-hidden ${hasNew ? `ring-2 ring-snap-yellow ring-offset-2 ${t.isLight ? 'ring-offset-[#f0f2f8]' : 'ring-offset-black'}` : ''}`}>
                      {otherAvatar ? <img src={otherAvatar} alt="Avatar" className="w-full h-full object-cover" /> : (
                        <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-sm">{initials}</div>
                      )}
                    </div>
                    {hasNew && <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-snap-yellow border-2 ${t.isLight ? 'border-[#f0f2f8]' : 'border-black'}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`font-bold text-[15px] truncate ${t.text}`}>{conv.title}</span>
                      {lastMsg && <span className={`text-xs shrink-0 ml-2 ${t.textFaint}`}>{timeAgo(lastMsg.created_at)}</span>}
                    </div>
                    {lastMsg ? (
                      <p className={`text-sm truncate ${hasNew ? 'text-snap-yellow font-semibold' : t.textMuted}`}>
                        {lastMsg.message_type !== 'TEXT' ? '📷 Snap' : lastMsg.content}
                      </p>
                    ) : <p className={`text-sm ${t.textFaint}`}>Aucun message</p>}
                  </div>
                  {hasNew && <ChevronRight size={16} className="text-snap-yellow shrink-0" />}
                </button>
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
        <div className={`absolute inset-0 z-50 flex flex-col backdrop-blur-md ${t.isLight ? 'bg-[#f0f2f8]/98' : 'bg-black/95'} ${t.text}`}>
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
