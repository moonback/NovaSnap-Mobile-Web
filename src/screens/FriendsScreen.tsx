import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Search,
  Ghost,
  UserPlus,
  Check,
  Clock,
  UserMinus,
  MessageCircle,
  Camera,
  Users,
} from 'lucide-react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { useFriends } from '../hooks/useFriends';
import { useToast } from '../components/ui/ToastProvider';
import { AvatarOnlineBadge } from '../components/ui/OnlineIndicator';
import type { AppUserProfile, FriendWithProfile } from '../lib/types';

// ── Avatar component ─────────────────────────────────────────
function Avatar({
  url,
  name,
  size = 'md',
}: {
  url: string | null;
  name: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';
  const textClass = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm';
  const initials = (name ?? '?').substring(0, 2).toUpperCase();

  return (
    <div className={`${sizeClass} rounded-full overflow-hidden shrink-0`}>
      {url ? (
        <img src={url} alt={name ?? ''} className="w-full h-full object-cover" />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black ${textClass}`}
        >
          {initials}
        </div>
      )}
    </div>
  );
}

// ── Snap score badge ─────────────────────────────────────────
function SnapScoreBadge({ score }: { score?: number }) {
  if (!score) return null;
  const display = score >= 1000 ? `${(score / 1000).toFixed(1)}K` : String(score);
  return (
    <span className="text-[10px] font-bold text-snap-yellow bg-snap-yellow/10 border border-snap-yellow/20 rounded-full px-2 py-0.5">
      ⚡ {display}
    </span>
  );
}

// ── Friend row with swipe/long-press actions ─────────────────
const FriendRow: React.FC<{
  friend: FriendWithProfile;
  onSnap: () => void;
  onMessage: () => void;
  onRemove: () => void;
}> = ({ friend, onSnap, onMessage, onRemove }) => {
  const [showActions, setShowActions] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePressStart = () => {
    longPressTimer.current = setTimeout(() => setShowActions(true), 500);
  };
  const handlePressEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl mb-2">
      <div
        className="flex items-center gap-3 px-3 py-3 bg-white/5 border border-white/8 rounded-2xl active:bg-white/8 transition-colors cursor-pointer select-none"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onClick={() => setShowActions((v) => !v)}
      >
        <div className="relative">
          <Avatar url={friend.user.avatar_url} name={friend.user.display_name ?? friend.user.username} size="md" />
          <AvatarOnlineBadge userId={friend.user.id} size="md" position="bottom-right" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px] text-white truncate">
            {friend.user.display_name || friend.user.username}
          </p>
          <p className="text-xs text-white/40 truncate">@{friend.user.username}</p>
        </div>
        <SnapScoreBadge score={friend.user.snap_score} />
      </div>

      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="flex gap-2 px-3 pb-3 pt-1 bg-white/5 border-x border-b border-white/8 rounded-b-2xl -mt-2"
          >
            <button
              onClick={(e) => { e.stopPropagation(); onSnap(); setShowActions(false); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-snap-yellow text-black font-bold text-xs rounded-full active:scale-95 transition-transform"
            >
              <Camera size={13} />
              Snap
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMessage(); setShowActions(false); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white/10 text-white font-bold text-xs rounded-full active:scale-95 transition-transform"
            >
              <MessageCircle size={13} />
              Message
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); setShowActions(false); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500/15 text-red-400 font-bold text-xs rounded-full active:scale-95 transition-transform"
            >
              <UserMinus size={13} />
              Supprimer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Search result row ─────────────────────────────────────────
type SearchUser = AppUserProfile & { bio?: string | null; snap_score?: number };

const SearchResultRow: React.FC<{
  user: SearchUser;
  friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';
  friendshipId?: string;
  onAdd: () => void;
  onAccept: () => void;
}> = ({ user, friendshipStatus, onAdd, onAccept }) => {
  const renderAction = () => {
    switch (friendshipStatus) {
      case 'none':
        return (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-snap-yellow text-black font-bold text-xs rounded-full active:scale-95 transition-transform shrink-0"
          >
            <UserPlus size={12} />
            Ajouter
          </button>
        );
      case 'pending_sent':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white/50 font-bold text-xs rounded-full shrink-0">
            <Clock size={12} />
            En attente
          </span>
        );
      case 'pending_received':
        return (
          <button
            onClick={onAccept}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-snap-yellow text-black font-bold text-xs rounded-full active:scale-95 transition-transform shrink-0"
          >
            <Check size={12} />
            Accepter
          </button>
        );
      case 'accepted':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 text-green-400 font-bold text-xs rounded-full shrink-0">
            <Check size={12} />
            Amis ✓
          </span>
        );
      case 'blocked':
        return (
          <span className="px-3 py-1.5 bg-red-500/10 text-red-400 font-bold text-xs rounded-full shrink-0">
            Bloqué
          </span>
        );
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 transition-colors">
      <Avatar url={user.avatar_url} name={user.display_name ?? user.username} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[15px] text-white truncate">
          {user.display_name || user.username}
        </p>
        <p className="text-xs text-white/40 truncate">@{user.username}</p>
      </div>
      {renderAction()}
    </div>
  );
};

// ── Skeleton loader ───────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3 animate-pulse">
      <div className="w-12 h-12 rounded-full bg-white/10 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 bg-white/10 rounded-lg" />
        <div className="h-3 w-1/4 bg-white/5 rounded-lg" />
      </div>
      <div className="h-7 w-20 bg-white/10 rounded-full" />
    </div>
  );
}

// ── Tab definitions ───────────────────────────────────────────
type Tab = 'friends' | 'requests' | 'add';

// ── Main FriendsScreen ────────────────────────────────────────
export default function FriendsScreen() {
  const { setShowFriends, setCurrentView, setDirectChatId, user } = useAppStore();
  const { toast } = useToast();
  const {
    friends,
    pendingReceived,
    pendingSent,
    pendingCount,
    isLoading,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    getFriendshipStatus,
  } = useFriends();

  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [friendSearch, setFriendSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // ── Search all users (Tab 3) ──────────────────────────────
  const { data: allUsers = [], isLoading: isSearchLoading } = useQuery({
    queryKey: ['users-search', userSearch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url, bio, snap_score')
        .neq('id', user?.id ?? '')
        .order('username');
      if (error) throw error;
      return Promise.all(
        (data as SearchUser[]).map(async (u) => {
          if (u.avatar_url) {
            return { ...u, avatar_url: await getValidMediaUrl('avatars', u.avatar_url) };
          }
          return u;
        })
      );
    },
    enabled: activeTab === 'add' && !!user,
    staleTime: 60_000,
  });

  const filteredSearchUsers = allUsers.filter((u) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q)
    );
  });

  // ── Filtered friends list ─────────────────────────────────
  const filteredFriends = friends.filter((f) => {
    if (!friendSearch) return true;
    const q = friendSearch.toLowerCase();
    return (
      f.user.username?.toLowerCase().includes(q) ||
      f.user.display_name?.toLowerCase().includes(q)
    );
  });

  // ── Action handlers ───────────────────────────────────────
  const handleSendRequest = useCallback(
    async (targetUserId: string) => {
      try {
        await sendFriendRequest(targetUserId);
        toast('Demande envoyée !', 'success');
      } catch {
        toast("Impossible d'envoyer la demande", 'error');
      }
    },
    [sendFriendRequest, toast]
  );

  const handleAccept = useCallback(
    async (friendshipId: string) => {
      try {
        await acceptFriendRequest(friendshipId);
        toast('Ami ajouté !', 'success');
      } catch {
        toast("Impossible d'accepter la demande", 'error');
      }
    },
    [acceptFriendRequest, toast]
  );

  const handleDecline = useCallback(
    async (friendshipId: string) => {
      try {
        await declineFriendRequest(friendshipId);
        toast('Demande refusée', 'success');
      } catch {
        toast('Impossible de refuser la demande', 'error');
      }
    },
    [declineFriendRequest, toast]
  );

  const handleRemove = useCallback(
    async (friendshipId: string) => {
      try {
        await removeFriend(friendshipId);
        toast('Ami supprimé', 'success');
      } catch {
        toast("Impossible de supprimer l'ami", 'error');
      }
    },
    [removeFriend, toast]
  );

  const handleSnapFriend = useCallback(
    (friendId: string) => {
      setDirectChatId(friendId);
      setCurrentView('camera');
      setShowFriends(false);
    },
    [setDirectChatId, setCurrentView, setShowFriends]
  );

  const handleMessageFriend = useCallback(
    (friendId: string) => {
      setDirectChatId(friendId);
      setCurrentView('chat');
      setShowFriends(false);
    },
    [setDirectChatId, setCurrentView, setShowFriends]
  );

  // ── Determine search user friendship status ───────────────
  const getSearchStatus = (
    targetId: string
  ): { status: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked'; friendshipId?: string } => {
    const raw = getFriendshipStatus(targetId);
    if (!raw) return { status: 'none' };

    // Find the friendship entry to get its ID
    const allFriendships = [...friends, ...pendingReceived, ...pendingSent];
    const entry = allFriendships.find((f) => f.user.id === targetId);

    if (raw === 'ACCEPTED') return { status: 'accepted', friendshipId: entry?.friendship_id };
    if (raw === 'BLOCKED') return { status: 'blocked', friendshipId: entry?.friendship_id };
    if (raw === 'PENDING') {
      if (entry?.is_requester) return { status: 'pending_sent', friendshipId: entry.friendship_id };
      return { status: 'pending_received', friendshipId: entry?.friendship_id };
    }
    return { status: 'none' };
  };

  // ── Tab content ───────────────────────────────────────────
  const renderFriendsTab = () => (
    <div className="flex-1 overflow-y-auto scroll-hide px-4 pb-8">
      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        <input
          type="text"
          value={friendSearch}
          onChange={(e) => setFriendSearch(e.target.value)}
          placeholder="Rechercher un ami..."
          className="w-full bg-white/8 border border-white/8 rounded-full h-10 pl-10 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-all text-sm"
        />
      </div>

      {isLoading && (
        <div className="space-y-1">
          {[...Array(5)].map((_, i) => <RowSkeleton key={i} />)}
        </div>
      )}

      {!isLoading && filteredFriends.length === 0 && (
        <div className="flex flex-col items-center justify-center pt-16 gap-4">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
            <Ghost size={36} className="text-white/20" />
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">Aucun ami pour l'instant</p>
            <p className="text-white/40 text-sm mt-1">Commence à ajouter des amis</p>
          </div>
          <button
            onClick={() => setActiveTab('add')}
            className="mt-2 px-6 py-3 bg-snap-yellow text-black font-black rounded-full text-sm shadow-snap active:scale-95 transition-all"
          >
            Ajouter des amis
          </button>
        </div>
      )}

      {!isLoading && filteredFriends.length > 0 && (
        <div>
          <p className="text-white/30 text-xs font-bold uppercase tracking-wider mb-3">
            {filteredFriends.length} ami{filteredFriends.length > 1 ? 's' : ''}
          </p>
          {filteredFriends.map((friend) => (
            <FriendRow
              key={friend.friendship_id}
              friend={friend}
              onSnap={() => handleSnapFriend(friend.user.id)}
              onMessage={() => handleMessageFriend(friend.user.id)}
              onRemove={() => handleRemove(friend.friendship_id)}
            />
          ))}
        </div>
      )}
    </div>
  );

  const renderRequestsTab = () => (
    <div className="flex-1 overflow-y-auto scroll-hide px-4 pb-8">
      {isLoading && (
        <div className="space-y-1">
          {[...Array(3)].map((_, i) => <RowSkeleton key={i} />)}
        </div>
      )}

      {!isLoading && pendingReceived.length === 0 && pendingSent.length === 0 && (
        <div className="flex flex-col items-center justify-center pt-16 gap-4">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
            <Users size={36} className="text-white/20" />
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">Aucune demande</p>
            <p className="text-white/40 text-sm mt-1">Les demandes d'amis apparaîtront ici</p>
          </div>
        </div>
      )}

      {/* Received requests */}
      {!isLoading && pendingReceived.length > 0 && (
        <div className="mb-6">
          <p className="text-white/30 text-xs font-bold uppercase tracking-wider mb-3">
            Reçues · {pendingReceived.length}
          </p>
          {pendingReceived.map((req) => (
            <div
              key={req.friendship_id}
              className="flex items-center gap-3 px-3 py-3 bg-white/5 border border-white/8 rounded-2xl mb-2"
            >
              <Avatar url={req.user.avatar_url} name={req.user.display_name ?? req.user.username} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] text-white truncate">
                  {req.user.display_name || req.user.username}
                </p>
                <p className="text-xs text-white/40 truncate">@{req.user.username}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleAccept(req.friendship_id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-snap-yellow text-black font-bold text-xs rounded-full active:scale-95 transition-transform"
                >
                  <Check size={12} />
                  Accepter
                </button>
                <button
                  onClick={() => handleDecline(req.friendship_id)}
                  className="px-3 py-1.5 bg-white/10 text-white/60 font-bold text-xs rounded-full active:scale-95 transition-transform"
                >
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sent requests */}
      {!isLoading && pendingSent.length > 0 && (
        <div>
          <p className="text-white/30 text-xs font-bold uppercase tracking-wider mb-3">
            Envoyées · {pendingSent.length}
          </p>
          {pendingSent.map((req) => (
            <div
              key={req.friendship_id}
              className="flex items-center gap-3 px-3 py-3 bg-white/5 border border-white/8 rounded-2xl mb-2"
            >
              <Avatar url={req.user.avatar_url} name={req.user.display_name ?? req.user.username} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] text-white truncate">
                  {req.user.display_name || req.user.username}
                </p>
                <p className="text-xs text-white/40 truncate">@{req.user.username}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1 px-3 py-1.5 bg-white/8 text-white/40 font-bold text-xs rounded-full">
                  <Clock size={11} />
                  En attente...
                </span>
                <button
                  onClick={() => handleDecline(req.friendship_id)}
                  className="px-3 py-1.5 bg-red-500/10 text-red-400 font-bold text-xs rounded-full active:scale-95 transition-transform"
                >
                  Annuler
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAddTab = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search input */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Rechercher par nom ou @username..."
            autoFocus
            className="w-full bg-white/8 border border-white/8 rounded-full h-10 pl-10 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-snap-yellow/40 transition-all text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-hide px-4 pb-8">
        {isSearchLoading && (
          <div className="space-y-1">
            {[...Array(6)].map((_, i) => <RowSkeleton key={i} />)}
          </div>
        )}

        {!isSearchLoading && filteredSearchUsers.length === 0 && (
          <div className="text-center pt-12 text-white/30 text-sm">
            {userSearch ? 'Aucun utilisateur trouvé' : 'Commence à taper pour rechercher'}
          </div>
        )}

        {!isSearchLoading && filteredSearchUsers.map((u) => {
          const { status, friendshipId } = getSearchStatus(u.id);
          return (
            <SearchResultRow
              key={u.id}
              user={u}
              friendshipStatus={status}
              friendshipId={friendshipId}
              onAdd={() => handleSendRequest(u.id)}
              onAccept={() => friendshipId ? handleAccept(friendshipId) : undefined}
            />
          );
        })}
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      className="fixed inset-0 z-50 screen-shell text-white flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4 shrink-0">
        <button
          onClick={() => setShowFriends(false)}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
        >
          <X size={18} />
        </button>
        <h1 className="text-lg font-black">Amis</h1>
        <button
          onClick={() => setActiveTab('add')}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
        >
          <Search size={17} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-4 gap-1 mb-4 shrink-0">
        {(
          [
            { key: 'friends' as Tab, label: 'Mes amis' },
            { key: 'requests' as Tab, label: 'Demandes', badge: pendingCount },
            { key: 'add' as Tab, label: 'Ajouter' },
          ] as { key: Tab; label: string; badge?: number }[]
        ).map(({ key, label, badge }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 relative py-2.5 rounded-full text-sm font-bold transition-all ${
              activeTab === key
                ? 'bg-snap-yellow text-black shadow-snap-sm'
                : 'bg-white/8 text-white/60 hover:bg-white/12'
            }`}
          >
            {label}
            {badge != null && badge > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-black">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content with animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.18 }}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {activeTab === 'friends' && renderFriendsTab()}
          {activeTab === 'requests' && renderRequestsTab()}
          {activeTab === 'add' && renderAddTab()}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
