import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  LogOut,
  Settings,
  Camera,
  Award,
  Ghost,
  Eye,
  Loader2,
  Edit2,
  Users,
  Check,
  BookOpen,
} from 'lucide-react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastProvider';
import { useFriends } from '../hooks/useFriends';

export default function ProfileScreen() {
  const { user, setShowProfile, setShowFriends } = useAppStore();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const { friendCount, pendingCount } = useFriends();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url, bio, snap_score')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      if (data.avatar_url) data.avatar_url = await getValidMediaUrl('avatars', data.avatar_url);
      return data as {
        id: string;
        username: string | null;
        display_name: string | null;
        avatar_url: string | null;
        bio: string | null;
        snap_score: number | null;
      };
    },
    enabled: !!user,
  });

  // ── Stories count ─────────────────────────────────────────
  const { data: storiesCount = 0 } = useQuery({
    queryKey: ['user-stories-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('stories')
        .select('id', { count: 'exact', head: false })
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString());
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user,
  });

  // ── Avatar upload ─────────────────────────────────────────
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      if (updateError) throw updateError;
      await queryClient.invalidateQueries({ queryKey: ['user-profile', user.id] });
      toast('Photo de profil mise à jour !', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      toast('Erreur : ' + message, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Edit profile ──────────────────────────────────────────
  const handleOpenEdit = () => {
    setEditDisplayName(profile?.display_name ?? '');
    setEditBio(profile?.bio ?? '');
    setShowEditForm(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          display_name: editDisplayName.trim() || null,
          bio: editBio.trim() || null,
        })
        .eq('id', user.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['user-profile', user.id] });
      toast('Profil mis à jour !', 'success');
      setShowEditForm(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      toast('Erreur : ' + message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowProfile(false);
  };

  // ── Score display ─────────────────────────────────────────
  const formatScore = (score: number | null) => {
    if (!score) return '0';
    if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`;
    if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
    return String(score);
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-y-auto scroll-hide"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <button
          onClick={() => setShowProfile(false)}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
        >
          <X size={18} />
        </button>
        <h1 className="text-lg font-black">Profil</h1>
        <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors">
          <Settings size={17} />
        </button>
      </div>

      <div className="flex-1 px-5 flex flex-col items-center pb-10">
        {/* Avatar */}
        <div className="relative mt-4 mb-6" onClick={() => fileInputRef.current?.click()}>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleAvatarUpload}
          />
          <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-snap-yellow ring-offset-4 ring-offset-black cursor-pointer">
            {isUploading ? (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-snap-yellow" />
              </div>
            ) : profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                <Ghost size={40} className="text-white/20" />
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-9 h-9 bg-snap-yellow rounded-full flex items-center justify-center border-2 border-black shadow-snap-sm cursor-pointer hover:scale-110 transition-transform">
            <Camera size={15} className="text-black" />
          </div>
        </div>

        {/* Name & username */}
        <div className="text-center mb-3">
          {isLoading ? (
            <>
              <div className="h-7 w-36 bg-white/10 rounded-lg animate-pulse mx-auto mb-2" />
              <div className="h-4 w-24 bg-white/5 rounded-lg animate-pulse mx-auto" />
            </>
          ) : (
            <>
              <h2 className="text-2xl font-black tracking-tight">
                {profile?.display_name || 'Nova User'}
              </h2>
              <p className="text-white/40 text-sm mt-1">@{profile?.username || 'user'}</p>
            </>
          )}
        </div>

        {/* Bio */}
        {profile?.bio && (
          <p className="text-white/50 text-sm text-center mb-5 max-w-xs leading-relaxed">
            {profile.bio}
          </p>
        )}

        {/* Stats */}
        <div className="w-full grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/5 rounded-2xl py-4 flex flex-col items-center gap-1 border border-white/8">
            <span className="text-xl font-black text-snap-yellow">
              {isLoading ? '—' : formatScore(profile?.snap_score ?? null)}
            </span>
            <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Score</span>
          </div>
          <div className="bg-white/5 rounded-2xl py-4 flex flex-col items-center gap-1 border border-white/8">
            <span className="text-xl font-black text-white">
              {isLoading ? '—' : storiesCount}
            </span>
            <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Stories</span>
          </div>
          <button
            onClick={() => { setShowProfile(false); setShowFriends(true); }}
            className="relative bg-white/5 rounded-2xl py-4 flex flex-col items-center gap-1 border border-white/8 hover:bg-white/8 transition-colors active:scale-95"
          >
            <span className="text-xl font-black text-white">
              {isLoading ? '—' : friendCount}
            </span>
            <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Amis</span>
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-black">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Snap score highlight */}
        <div className="w-full bg-snap-yellow/8 border border-snap-yellow/20 rounded-2xl p-4 flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-snap-yellow/15 flex items-center justify-center">
            <Award size={20} className="text-snap-yellow" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm">Nova Score</p>
            <p className="text-white/40 text-xs">Continue à snapper pour augmenter ton score</p>
          </div>
          <span className="text-snap-yellow font-black text-lg">
            {formatScore(profile?.snap_score ?? null)}
          </span>
        </div>

        {/* Inline edit form */}
        <AnimatePresence>
          {showEditForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full overflow-hidden mb-4"
            >
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <p className="text-white font-bold text-sm mb-1">Modifier le profil</p>
                <div>
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider block mb-1.5">
                    Nom affiché
                  </label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="Ton nom..."
                    maxLength={50}
                    className="w-full bg-white/8 border border-white/10 rounded-xl h-11 px-4 text-white placeholder-white/30 focus:outline-none focus:border-snap-yellow/50 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/40 text-xs font-bold uppercase tracking-wider block mb-1.5">
                    Bio
                  </label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Parle de toi en quelques mots..."
                    maxLength={140}
                    rows={3}
                    className="w-full bg-white/8 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-snap-yellow/50 transition-all text-sm resize-none"
                  />
                  <p className="text-white/20 text-xs text-right mt-1">{editBio.length}/140</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowEditForm(false)}
                    className="flex-1 py-2.5 bg-white/8 text-white/60 font-bold text-sm rounded-xl active:scale-95 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="flex-1 py-2.5 bg-snap-yellow text-black font-bold text-sm rounded-xl active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    Enregistrer
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="w-full space-y-3 mt-auto">
          {/* Friends button */}
          <button
            onClick={() => { setShowProfile(false); setShowFriends(true); }}
            className="relative w-full bg-white/8 border border-white/10 rounded-2xl py-4 font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/12 transition-colors active:scale-98"
          >
            <Users size={16} />
            Mes amis
            {pendingCount > 0 && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={handleOpenEdit}
            className="w-full bg-white/8 border border-white/10 rounded-2xl py-4 font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/12 transition-colors active:scale-98"
          >
            <Edit2 size={16} />
            Modifier le profil
          </button>

          <button
            onClick={handleLogout}
            className="w-full bg-red-500/8 border border-red-500/15 rounded-2xl py-4 font-bold text-sm text-red-400 flex items-center justify-center gap-2 hover:bg-red-500/12 transition-colors active:scale-98"
          >
            <LogOut size={16} />
            Se déconnecter
          </button>
        </div>
      </div>
    </motion.div>
  );
}
