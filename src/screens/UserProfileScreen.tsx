import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Ghost,
  Camera,
  MessageCircle,
  UserPlus,
  Clock,
  Check,
  UserMinus,
  ChevronDown,
  Award,
  Users,
} from 'lucide-react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { useFriends } from '../hooks/useFriends';
import { useToast } from '../components/ui/ToastProvider';
import { OnlineIndicator, AvatarOnlineBadge } from '../components/ui/OnlineIndicator';
import { useTheme } from '../hooks/useTheme';

// ── Types ─────────────────────────────────────────────────────
type PublicProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  snap_score: number | null;
};

type StoryThumb = {
  id: string;
  media_url: string;
  media_type: string;
  created_at: string;
};

// ── Story thumbnail ───────────────────────────────────────────
const StoryThumbnail: React.FC<{ story: StoryThumb }> = ({ story }) => {
  const t = useTheme();
  return (
    <div className="w-16 h-24 rounded-xl overflow-hidden shrink-0 border border-snap-yellow/30">
      {story.media_type === 'IMAGE' ? (
        <img src={story.media_url} alt="Story" className="w-full h-full object-cover" />
      ) : (
        <div className={`w-full h-full flex items-center justify-center ${t.isLight ? 'bg-zinc-200' : 'bg-zinc-900'}`}>
          <Camera size={20} className={t.textFaint} />
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────
export default function UserProfileScreen() {
  const {
    viewingProfileUserId,
    setViewingProfileUserId,
    setCurrentView,
    setDirectChatId,
    user: currentUser,
  } = useAppStore();
  const t = useTheme();
  const { toast } = useToast();
  const {
    friends,
    pendingReceived,
    pendingSent,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    getFriendshipStatus,
  } = useFriends();

  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const targetId = viewingProfileUserId;

  // ── Fetch profile ─────────────────────────────────────────
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-public-profile', targetId],
    queryFn: async () => {
      if (!targetId) return null;
      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url, bio, snap_score')
        .eq('id', targetId)
        .single();
      if (error) throw error;
      const p = data as PublicProfile;
      if (p.avatar_url) {
        p.avatar_url = await getValidMediaUrl('avatars', p.avatar_url);
      }
      return p;
    },
    enabled: !!targetId,
  });

  // ── Fetch friend count via DB function ────────────────────
  const { data: friendCount = 0 } = useQuery({
    queryKey: ['friend-count', targetId],
    queryFn: async () => {
      if (!targetId) return 0;
      const { data, error } = await supabase.rpc('get_friend_count', { user_uuid: targetId });
      if (error) return 0;
      return (data as number) ?? 0;
    },
    enabled: !!targetId,
  });

  // ── Fetch active stories ──────────────────────────────────
  const { data: stories = [] } = useQuery({
    queryKey: ['user-stories', targetId],
    queryFn: async () => {
      if (!targetId) return [];
      const { data, error } = await supabase
        .from('stories')
        .select('id, media_url, media_type, created_at')
        .eq('user_id', targetId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) return [];
      const now = new Date().getTime();
      return (data as StoryThumb[])
        .filter(s => new Date(s.created_at).getTime() + 86400000 > now) // Add local expiry check just in case
        .map((s) => ({
          ...s,
          media_url: s.media_url, // signed URL resolution could be added here
        }));
    },
    enabled: !!targetId,
  });

  // ── Friendship state ──────────────────────────────────────
  const friendshipStatus = targetId ? getFriendshipStatus(targetId) : null;

  const findFriendshipEntry = () => {
    const all = [...friends, ...pendingReceived, ...pendingSent];
    return all.find((f) => f.user.id === targetId);
  };

  // ── Action handlers ───────────────────────────────────────
  const handleAdd = async () => {
    if (!targetId) return;
    try {
      await sendFriendRequest(targetId);
      toast('Demande envoyée !', 'success');
    } catch {
      toast("Impossible d'envoyer la demande", 'error');
    }
  };

  const handleAccept = async () => {
    const entry = findFriendshipEntry();
    if (!entry) return;
    try {
      await acceptFriendRequest(entry.friendship_id);
      toast('Ami ajouté !', 'success');
    } catch {
      toast("Impossible d'accepter la demande", 'error');
    }
  };

  const handleCancelOrRemove = async () => {
    const entry = findFriendshipEntry();
    if (!entry) return;
    try {
      await declineFriendRequest(entry.friendship_id);
      toast('Supprimé', 'success');
      setShowRemoveConfirm(false);
    } catch {
      toast('Erreur', 'error');
    }
  };

  const handleRemoveFriend = async () => {
    const entry = findFriendshipEntry();
    if (!entry) return;
    try {
      await removeFriend(entry.friendship_id);
      toast('Ami supprimé', 'success');
      setShowRemoveConfirm(false);
    } catch {
      toast("Impossible de supprimer l'ami", 'error');
    }
  };

  const handleSnap = () => {
    if (!targetId) return;
    setDirectChatId(targetId);
    setCurrentView('camera');
    setViewingProfileUserId(null);
  };

  const handleMessage = () => {
    if (!targetId) return;
    setDirectChatId(targetId);
    setCurrentView('chat');
    setViewingProfileUserId(null);
  };

  // ── Friendship action button ──────────────────────────────
  const renderFriendshipButton = () => {
    if (!friendshipStatus) {
      return (
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-snap-yellow text-black font-bold text-sm rounded-full shadow-snap active:scale-95 transition-all"
        >
          <UserPlus size={15} />
          Ajouter
        </button>
      );
    }

    if (friendshipStatus === 'PENDING') {
      const entry = findFriendshipEntry();
      if (entry?.is_requester) {
        // I sent the request
        return (
          <button
            onClick={handleCancelOrRemove}
            className={`flex items-center gap-2 px-5 py-2.5 ${t.surface} ${t.textMuted} font-bold text-sm rounded-full active:scale-95 transition-all`}
          >
            <Clock size={15} />
            En attente
          </button>
        );
      } else {
        // They sent me a request
        return (
          <button
            onClick={handleAccept}
            className="flex items-center gap-2 px-5 py-2.5 bg-snap-yellow text-black font-bold text-sm rounded-full shadow-snap active:scale-95 transition-all"
          >
            <Check size={15} />
            Accepter
          </button>
        );
      }
    }

    if (friendshipStatus === 'ACCEPTED') {
      return (
        <div className="relative">
          <button
            onClick={() => setShowRemoveConfirm((v: boolean) => !v)}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-500/15 text-green-400 font-bold text-sm rounded-full active:scale-95 transition-all"
          >
            <Check size={15} />
            Amis ✓
            <ChevronDown size={13} />
          </button>
          <AnimatePresence>
            {showRemoveConfirm && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-2 left-1/2 -translate-x-1/2 glass-dark rounded-2xl p-3 z-10 min-w-[180px]"
              >
                <button
                  onClick={handleRemoveFriend}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-red-400 font-bold text-sm rounded-xl hover:bg-red-500/10 transition-colors"
                >
                  <UserMinus size={15} />
                  Supprimer l'ami
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    if (friendshipStatus === 'BLOCKED') {
      return (
        <button
          onClick={handleCancelOrRemove}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-400 font-bold text-sm rounded-full active:scale-95 transition-all"
        >
          Bloqué · Débloquer
        </button>
      );
    }

    return null;
  };

  // ── Snap score display ────────────────────────────────────
  const formatScore = (score: number | null) => {
    if (!score) return '0';
    if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`;
    if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
    return String(score);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      className={`absolute inset-0 z-50 flex flex-col overflow-y-auto scroll-hide ${t.bg} ${t.text}`}
      onClick={() => setShowRemoveConfirm(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4 shrink-0">
        <button
          onClick={() => setViewingProfileUserId(null)}
          className={`w-9 h-9 rounded-full ${t.surface} flex items-center justify-center ${t.surfaceHover} transition-colors`}
        >
          <X size={18} />
        </button>
        <h1 className="text-lg font-black">Profil</h1>
        <div className="w-9 h-9" />
      </div>

      <div className="flex-1 px-5 flex flex-col items-center pb-10">
        {/* Avatar */}
        <div className="mt-4 mb-5 relative">
          {profileLoading ? (
            <div className={`w-28 h-28 rounded-full ${t.surface} animate-pulse ring-4 ring-snap-yellow ring-offset-4 ${t.ringOffset}`} />
          ) : (
            <div className={`w-28 h-28 rounded-full overflow-hidden ring-4 ring-snap-yellow ring-offset-4 ${t.ringOffset} relative`}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${t.isLight ? 'bg-zinc-200' : 'bg-zinc-900'}`}>
                  <Ghost size={40} className={t.textFaint} />
                </div>
              )}
              {/* Badge de statut en ligne sur l'avatar */}
              {targetId && <AvatarOnlineBadge userId={targetId} size="lg" position="bottom-right" />}
            </div>
          )}
        </div>

        {/* Name & username */}
        <div className="text-center mb-4">
          {profileLoading ? (
            <>
              <div className={`h-7 w-40 rounded-lg animate-pulse mx-auto mb-2 ${t.surface}`} />
              <div className={`h-4 w-28 rounded-lg animate-pulse mx-auto ${t.input}`} />
            </>
          ) : (
            <>
              <h2 className="text-2xl font-black tracking-tight">
                {profile?.display_name || 'Nova User'}
              </h2>
              <p className={`text-sm mt-1 ${t.textMuted}`}>@{profile?.username || 'user'}</p>
              {/* Statut en ligne avec texte */}
              {targetId && (
                <div className="mt-2 flex justify-center">
                  <OnlineIndicator userId={targetId} showText size="sm" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Bio */}
        {profile?.bio && (
          <p className={`text-sm text-center mb-5 max-w-xs leading-relaxed ${t.textMuted}`}>
            {profile.bio}
          </p>
        )}

        {/* Stats */}
        <div className="w-full grid grid-cols-2 gap-3 mb-6">
          <div className={`${t.surface} rounded-2xl py-4 flex flex-col items-center gap-1 border ${t.borderMuted}`}>
            <div className="flex items-center gap-1.5">
              <Award size={14} className="text-snap-yellow" />
              <span className="text-xl font-black text-snap-yellow">
                {formatScore(profile?.snap_score ?? null)}
              </span>
            </div>
            <span className={`text-[10px] uppercase tracking-wider font-bold ${t.textFaint}`}>Score</span>
          </div>
          <div className={`${t.surface} rounded-2xl py-4 flex flex-col items-center gap-1 border ${t.borderMuted}`}>
            <div className="flex items-center gap-1.5">
              <Users size={14} className={t.textMuted} />
              <span className={`text-xl font-black ${t.text}`}>{friendCount}</span>
            </div>
            <span className={`text-[10px] uppercase tracking-wider font-bold ${t.textFaint}`}>Amis</span>
          </div>
        </div>

        {/* Friendship action */}
        {currentUser?.id !== targetId && (
          <div className="flex items-center gap-3 mb-6">
            {renderFriendshipButton()}
          </div>
        )}

        {/* Action buttons */}
        {currentUser?.id !== targetId && (
          <div className="w-full flex gap-3 mb-8">
            <button
              onClick={handleSnap}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-snap-yellow text-black font-black text-sm rounded-2xl shadow-snap active:scale-95 transition-all"
            >
              <Camera size={16} />
              Envoyer un Snap
            </button>
            <button
              onClick={handleMessage}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 ${t.input} border ${t.border} ${t.text} font-bold text-sm rounded-2xl active:scale-95 transition-all`}
            >
              <MessageCircle size={16} />
              Message
            </button>
          </div>
        )}

        {/* Stories section */}
        {stories.length > 0 && (
          <div className="w-full">
            <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${t.textFaint}`}>
              Stories · {stories.length}
            </p>
            <div className="flex gap-3 overflow-x-auto scroll-hide pb-2">
              {stories.map((story) => (
                <StoryThumbnail key={story.id} story={story} />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
