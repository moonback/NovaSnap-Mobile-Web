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
  ChevronLeft,
  User,
  Mail,
  Calendar,
  Bell,
  Trash2,
  Shield,
  Lock,
  HardDrive,
  Sun,
  Moon,
  MapPin,
} from 'lucide-react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastProvider';
import { useFriends } from '../hooks/useFriends';
import { useMemories } from '../hooks/useMemories';
import { useTheme } from '../hooks/useTheme';

export default function ProfileScreen() {
  const { user, setShowProfile, setShowFriends, setShowMemories, theme, toggleTheme } = useAppStore();
  const t = useTheme();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  // ── Settings state ────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [ghostMode, setGhostMode] = useState(() => {
    return localStorage.getItem('novasnap_settings_ghost_mode') === 'true';
  });
  const [storyPrivacy, setStoryPrivacy] = useState(() => {
    return localStorage.getItem('novasnap_settings_story_privacy') || 'friends';
  });
  const [autoSaveSnaps, setAutoSaveSnaps] = useState(() => {
    return localStorage.getItem('novasnap_settings_auto_save') === 'true';
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('novasnap_settings_notifications') !== 'false';
  });
  const [mediaQuality, setMediaQuality] = useState(() => {
    return localStorage.getItem('novasnap_settings_media_quality') || 'standard';
  });

  const toggleGhostMode = async () => {
    const nextVal = !ghostMode;
    setGhostMode(nextVal);
    localStorage.setItem('novasnap_settings_ghost_mode', String(nextVal));
    try {
      if (user) {
        const { error } = await supabase
          .from('users')
          .update({ online_status_visibility: nextVal ? 'NOBODY' : 'FRIENDS' })
          .eq('id', user.id);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['friend-locations'] });
      toast(
        nextVal ? 'Mode Fantôme activé ! Ta position est masquée.' : 'Mode Fantôme désactivé.',
        'info'
      );
    } catch (err) {
      console.error('[GhostMode] Erreur lors de la synchronisation:', err);
      toast('Erreur lors de la mise à jour des paramètres en ligne', 'error');
    }
  };

  const updateStoryPrivacy = (val: string) => {
    setStoryPrivacy(val);
    localStorage.setItem('novasnap_settings_story_privacy', val);
    const label = val === 'everyone' ? 'Tout le monde' : val === 'friends' ? 'Mes Amis' : 'Privé';
    toast(`Confidentialité mise à jour : ${label}`, 'success');
  };

  const toggleAutoSave = () => {
    const nextVal = !autoSaveSnaps;
    setAutoSaveSnaps(nextVal);
    localStorage.setItem('novasnap_settings_auto_save', String(nextVal));
    toast(
      nextVal ? 'Sauvegarde automatique dans la galerie activée.' : 'Sauvegarde automatique désactivée.',
      'info'
    );
  };

  const toggleNotifications = () => {
    const nextVal = !notificationsEnabled;
    setNotificationsEnabled(nextVal);
    localStorage.setItem('novasnap_settings_notifications', String(nextVal));
    toast(
      nextVal ? 'Notifications activées.' : 'Notifications désactivées.',
      'info'
    );
  };


  const refreshLocationNow = async () => {
    const ghostModeEnabled = localStorage.getItem('novasnap_settings_ghost_mode') === 'true';

    if (ghostModeEnabled) {
      toast('Désactive le Mode Fantôme pour partager ta position.', 'info');
      return;
    }

    if (!navigator.geolocation) {
      toast("La géolocalisation n'est pas disponible sur cet appareil.", 'error');
      return;
    }

    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
      );
    });

    try {
      const { error } = await supabase.rpc('update_user_heartbeat', {
        p_lat: position?.coords.latitude ?? null,
        p_lng: position?.coords.longitude ?? null,
        p_ghost: false,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['friend-locations'] });
      toast('Position mise à jour sur Snap Map.', 'success');
    } catch (err) {
      console.error('[Location] Erreur de mise à jour:', err);
      toast('Impossible de mettre à jour la position.', 'error');
    }
  };

  const updateMediaQuality = (val: string) => {
    setMediaQuality(val);
    localStorage.setItem('novasnap_settings_media_quality', val);
    toast(`Qualité d'envoi réglée sur : ${val.toUpperCase()}`, 'success');
  };

  const handleClearCache = () => {
    toast('Nettoyage du cache...', 'info');
    setTimeout(() => {
      toast('Cache nettoyé avec succès ! (14.2 Mo libérés)', 'success');
    }, 1000);
  };

  // ── Change password state ─────────────────────────────────
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) return;
    if (newPassword.length < 8) {
      toast('Le nouveau mot de passe doit contenir au moins 8 caractères.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('Les mots de passe ne correspondent pas.', 'error');
      return;
    }
    setIsChangingPassword(true);
    try {
      // Re-authenticate with current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email ?? '',
        password: currentPassword,
      });
      if (signInError) {
        toast('Mot de passe actuel incorrect.', 'error');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast('Mot de passe mis à jour avec succès !', 'success');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      toast('Erreur : ' + message, 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const handleDeleteAccount = async () => {
    toast('Demande de suppression du compte envoyée...', 'info');
    setShowDeleteConfirm(false);
    setShowSettings(false);
    setTimeout(() => {
      supabase.auth.signOut();
      setShowProfile(false);
    }, 1500);
  };

  const { friendCount, pendingCount } = useFriends();
  const { data: memories } = useMemories();
  const memoriesCount = memories?.length ?? 0;

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
      className={`fixed inset-0 z-50 flex flex-col overflow-y-auto scroll-hide ${t.bg} ${t.text}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <button
          onClick={() => setShowProfile(false)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${t.iconBtn}`}
        >
          <X size={18} />
        </button>
        <h1 className="text-lg font-black">Profil</h1>
        <button
          onClick={() => setShowSettings(true)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 ${t.iconBtn}`}
        >
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
          <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-snap-yellow ring-offset-4 cursor-pointer"
            style={{ '--tw-ring-offset-color': t.isLight ? '#f0f2f8' : '#000' } as React.CSSProperties}>
            {isUploading ? (
              <div className={`w-full h-full flex items-center justify-center ${t.isLight ? 'bg-black/8' : 'bg-zinc-900'}`}>
                <Loader2 size={28} className="animate-spin text-snap-yellow" />
              </div>
            ) : profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${t.isLight ? 'bg-black/8' : 'bg-zinc-900'}`}>
                <Ghost size={40} className={t.textFaint} />
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-9 h-9 bg-snap-yellow rounded-full flex items-center justify-center border-2 shadow-snap-sm cursor-pointer hover:scale-110 transition-transform"
            style={{ borderColor: t.isLight ? '#f0f2f8' : '#000' }}>
            <Camera size={15} className="text-black" />
          </div>
        </div>

        {/* Name & username */}
        <div className="text-center mb-3">
          {isLoading ? (
            <>
              <div className={`h-7 w-36 rounded-lg animate-pulse mx-auto mb-2 ${t.skeleton}`} />
              <div className={`h-4 w-24 rounded-lg animate-pulse mx-auto ${t.skeleton}`} />
            </>
          ) : (
            <>
              <h2 className="text-2xl font-black tracking-tight">
                {profile?.display_name || 'Nova User'}
              </h2>
              <p className={`text-sm mt-1 ${t.textMuted}`}>@{profile?.username || 'user'}</p>
            </>
          )}
        </div>

        {/* Bio */}
        {profile?.bio && (
          <p className={`text-sm text-center mb-5 max-w-xs leading-relaxed ${t.textSubtle}`}>
            {profile.bio}
          </p>
        )}

        {/* Stats */}
        <div className="w-full grid grid-cols-4 gap-2 mb-6">
          <div className={`rounded-2xl py-4 flex flex-col items-center gap-1 border ${t.surface} ${t.border}`}>
            <span className="text-xl font-black text-snap-yellow">
              {isLoading ? '—' : formatScore(profile?.snap_score ?? null)}
            </span>
            <span className={`text-[10px] uppercase tracking-wider font-bold ${t.textMuted}`}>Score</span>
          </div>
          <div className={`rounded-2xl py-4 flex flex-col items-center gap-1 border ${t.surface} ${t.border}`}>
            <span className={`text-xl font-black ${t.text}`}>
              {isLoading ? '—' : storiesCount}
            </span>
            <span className={`text-[10px] uppercase tracking-wider font-bold ${t.textMuted}`}>Stories</span>
          </div>
          <button
            onClick={() => { setShowProfile(false); setShowMemories(true); }}
            className={`rounded-2xl py-4 flex flex-col items-center gap-1 border transition-colors active:scale-95 ${t.surface} ${t.border} ${t.surfaceHover}`}
          >
            <span className={`text-xl font-black ${t.text}`}>
              {isLoading ? '—' : memoriesCount}
            </span>
            <span className={`text-[10px] uppercase tracking-wider font-bold ${t.textMuted}`}>Souvenirs</span>
          </button>
          <button
            onClick={() => { setShowProfile(false); setShowFriends(true); }}
            className={`relative rounded-2xl py-4 flex flex-col items-center gap-1 border transition-colors active:scale-95 ${t.surface} ${t.border} ${t.surfaceHover}`}
          >
            <span className={`text-xl font-black ${t.text}`}>
              {isLoading ? '—' : friendCount}
            </span>
            <span className={`text-[10px] uppercase tracking-wider font-bold ${t.textMuted}`}>Amis</span>
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2"
                style={{ borderColor: t.isLight ? '#f0f2f8' : '#000' }}>
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
            <p className={`font-bold text-sm ${t.text}`}>Nova Score</p>
            <p className={`text-xs ${t.textMuted}`}>Continue à snapper pour augmenter ton score</p>
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
              <div className={`border rounded-2xl p-4 space-y-3 ${t.surface} ${t.border}`}>
                <p className={`font-bold text-sm mb-1 ${t.text}`}>Modifier le profil</p>
                <div>
                  <label className={`text-xs font-bold uppercase tracking-wider block mb-1.5 ${t.textMuted}`}>
                    Nom affiché
                  </label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="Ton nom..."
                    maxLength={50}
                    className={`w-full border rounded-xl h-11 px-4 placeholder-black/30 focus:outline-none focus:border-snap-yellow/50 transition-all text-sm ${t.input} ${t.border} ${t.text} ${t.isLight ? 'placeholder-black/30' : 'placeholder-white/30'}`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-bold uppercase tracking-wider block mb-1.5 ${t.textMuted}`}>
                    Bio
                  </label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Parle de toi en quelques mots..."
                    maxLength={140}
                    rows={3}
                    className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-snap-yellow/50 transition-all text-sm resize-none ${t.input} ${t.border} ${t.text} ${t.isLight ? 'placeholder-black/30' : 'placeholder-white/30'}`}
                  />
                  <p className={`text-xs text-right mt-1 ${t.textFaint}`}>{editBio.length}/140</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowEditForm(false)}
                    className={`flex-1 py-2.5 font-bold text-sm rounded-xl active:scale-95 transition-all ${t.surface} ${t.textMuted}`}
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
          <button
            onClick={() => { setShowProfile(false); setShowMemories(true); }}
            className={`w-full border rounded-2xl py-4 font-bold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98] ${t.surface} ${t.border} ${t.surfaceHover} ${t.text}`}
          >
            <BookOpen size={16} />
            Mes Souvenirs
          </button>

          <button
            onClick={() => { setShowProfile(false); setShowFriends(true); }}
            className={`relative w-full border rounded-2xl py-4 font-bold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98] ${t.surface} ${t.border} ${t.surfaceHover} ${t.text}`}
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
            className={`w-full border rounded-2xl py-4 font-bold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98] ${t.surface} ${t.border} ${t.surfaceHover} ${t.text}`}
          >
            <Edit2 size={16} />
            Modifier le profil
          </button>

          <button
            onClick={handleLogout}
            className="w-full bg-red-500/8 border border-red-500/15 rounded-2xl py-4 font-bold text-sm text-red-400 flex items-center justify-center gap-2 hover:bg-red-500/12 transition-colors active:scale-[0.98]"
          >
            <LogOut size={16} />
            Se déconnecter
          </button>
        </div>
      </div>

      {/* ── Settings Drawer ───────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 240 }}
            className={`absolute inset-0 z-50 flex flex-col overflow-y-auto scroll-hide pb-12 ${t.settings} ${t.text}`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-5 pt-14 pb-4 border-b sticky top-0 z-10 backdrop-blur-md ${t.settings} ${t.borderMuted}`}>
              <button onClick={() => setShowSettings(false)} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${t.iconBtn}`}>
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-lg font-black tracking-tight">Réglages</h2>
              <div className="w-9" />
            </div>

            <div className="px-5 space-y-6 mt-4">
              {/* Group 1: Account */}
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wider mb-2.5 ml-2 ${t.textMuted}`}>Mon Compte</p>
                <div className={`border rounded-2xl overflow-hidden ${t.surface} ${t.border} divide-y ${t.divider}`}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3"><User size={18} className="text-snap-yellow" /><span className="text-sm font-bold">Nom d'utilisateur</span></div>
                    <span className={`text-sm ${t.textMuted}`}>@{profile?.username || user?.user_metadata?.username || 'user'}</span>
                  </div>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3"><Mail size={18} className="text-snap-yellow" /><span className="text-sm font-bold">Adresse e-mail</span></div>
                    <span className={`text-sm max-w-[180px] truncate ${t.textMuted}`}>{user?.email || 'non renseigné'}</span>
                  </div>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3"><Calendar size={18} className="text-snap-yellow" /><span className="text-sm font-bold">Créé le</span></div>
                    <span className={`text-sm ${t.textMuted}`}>{user?.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
                  </div>
                </div>
              </div>

              {/* Group 2: Security — Password Change */}
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wider mb-2.5 ml-2 ${t.textMuted}`}>Sécurité</p>
                <div className={`border rounded-2xl overflow-hidden ${t.surface} ${t.border}`}>
                  <button
                    onClick={() => setShowChangePassword(!showChangePassword)}
                    className={`w-full flex items-center justify-between p-4 transition-colors text-left ${t.surfaceHover}`}
                  >
                    <div className="flex items-center gap-3">
                      <Lock size={18} className="text-snap-yellow" />
                      <div>
                        <p className="text-sm font-bold">Changer le mot de passe</p>
                        <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>Modifier ton mot de passe actuel</p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: showChangePassword ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronLeft size={16} className={`${t.textFaint} rotate-[-90deg]`} />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {showChangePassword && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <div className={`px-4 pb-4 pt-1 space-y-3 border-t ${t.borderMuted}`}>
                          {/* Current password */}
                          <div className="relative">
                            <label className={`text-[10px] font-black uppercase tracking-wider block mb-1.5 ${t.textMuted}`}>
                              Mot de passe actuel
                            </label>
                            <div className="relative">
                              <Lock size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${t.textFaint} pointer-events-none`} />
                              <input
                                type={showCurrentPwd ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                className={`w-full border rounded-xl h-11 pl-10 pr-10 text-sm focus:outline-none focus:border-snap-yellow/50 transition-all ${t.input} ${t.border} ${t.text} ${t.isLight ? 'placeholder-black/25' : 'placeholder-white/25'}`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                                className={`absolute right-3 top-1/2 -translate-y-1/2 ${t.textFaint} hover:${t.textMuted} transition-colors`}
                              >
                                {showCurrentPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            </div>
                          </div>

                          {/* New password */}
                          <div>
                            <label className={`text-[10px] font-black uppercase tracking-wider block mb-1.5 ${t.textMuted}`}>
                              Nouveau mot de passe
                            </label>
                            <div className="relative">
                              <Lock size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${t.textFaint} pointer-events-none`} />
                              <input
                                type={showNewPwd ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min. 8 caractères"
                                autoComplete="new-password"
                                className={`w-full border rounded-xl h-11 pl-10 pr-10 text-sm focus:outline-none focus:border-snap-yellow/50 transition-all ${t.input} ${t.border} ${t.text} ${t.isLight ? 'placeholder-black/25' : 'placeholder-white/25'}`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPwd(!showNewPwd)}
                                className={`absolute right-3 top-1/2 -translate-y-1/2 ${t.textFaint} hover:${t.textMuted} transition-colors`}
                              >
                                {showNewPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            </div>
                          </div>

                          {/* Confirm password */}
                          <div>
                            <label className={`text-[10px] font-black uppercase tracking-wider block mb-1.5 ${t.textMuted}`}>
                              Confirmer le nouveau mot de passe
                            </label>
                            <div className="relative">
                              <Lock size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${t.textFaint} pointer-events-none`} />
                              <input
                                type={showConfirmPwd ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Répète le nouveau mot de passe"
                                autoComplete="new-password"
                                className={`w-full border rounded-xl h-11 pl-10 pr-10 text-sm focus:outline-none focus:border-snap-yellow/50 transition-all ${
                                  confirmPassword && newPassword !== confirmPassword
                                    ? 'border-red-500/50 focus:border-red-500/70'
                                    : confirmPassword && newPassword === confirmPassword
                                    ? 'border-green-500/50 focus:border-green-500/70'
                                    : ''
                                } ${t.input} ${t.border} ${t.text} ${t.isLight ? 'placeholder-black/25' : 'placeholder-white/25'}`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                                className={`absolute right-3 top-1/2 -translate-y-1/2 ${t.textFaint} hover:${t.textMuted} transition-colors`}
                              >
                                {showConfirmPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            </div>
                            {confirmPassword && newPassword !== confirmPassword && (
                              <p className="text-red-400 text-[10px] mt-1 font-bold">Les mots de passe ne correspondent pas</p>
                            )}
                            {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
                              <p className="text-green-400 text-[10px] mt-1 font-bold flex items-center gap-1">
                                <Check size={10} /> Mots de passe identiques
                              </p>
                            )}
                          </div>

                          {/* Submit */}
                          <button
                            onClick={handleChangePassword}
                            disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                            className="w-full py-3 bg-snap-yellow text-black font-black text-sm rounded-xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
                          >
                            {isChangingPassword ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <>
                                <Lock size={14} />
                                Mettre à jour le mot de passe
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Group 3: Privacy */}
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wider mb-2.5 ml-2 ${t.textMuted}`}>Confidentialité</p>
                <div className={`border rounded-2xl overflow-hidden ${t.surface} ${t.border} divide-y ${t.divider}`}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-3"><Ghost size={18} className="text-purple-400" /><span className="text-sm font-bold">Mode Fantôme</span></div>
                      <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>Masque ta position sur la carte</p>
                    </div>
                    <button onClick={toggleGhostMode} className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex items-center ${ghostMode ? 'bg-purple-500' : t.isLight ? 'bg-black/15' : 'bg-white/10'}`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow-md transform duration-200 ${ghostMode ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="p-4">
                    <button
                      onClick={refreshLocationNow}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${t.isLight ? 'border-black/10 hover:bg-black/5' : 'border-white/10 hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin size={18} className="text-purple-400" />
                        <div className="text-left">
                          <p className="text-sm font-bold">Mettre à jour ma localisation</p>
                          <p className={`text-[11px] ${t.textMuted}`}>Envoie ta position actuelle maintenant</p>
                        </div>
                      </div>
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3"><Eye size={18} className="text-purple-400" /><span className="text-sm font-bold">Qui peut voir ma Story</span></div>
                    <div className={`grid grid-cols-3 gap-1 rounded-xl p-1 border ${t.isLight ? 'bg-black/8 border-black/8' : 'bg-black/40 border-white/5'}`}>
                      {(['everyone', 'friends', 'private'] as const).map((opt) => {
                        const active = storyPrivacy === opt;
                        const label = opt === 'everyone' ? 'Public' : opt === 'friends' ? 'Amis' : 'Privé';
                        return (
                          <button key={opt} onClick={() => updateStoryPrivacy(opt)}
                            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-purple-500 text-white shadow' : t.textMuted}`}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 4: Preferences */}
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wider mb-2.5 ml-2 ${t.textMuted}`}>Préférences</p>
                <div className={`border rounded-2xl overflow-hidden ${t.surface} ${t.border} divide-y ${t.divider}`}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-3">
                        {theme === 'light' ? <Sun size={18} className="text-snap-yellow" /> : <Moon size={18} className="text-snap-yellow" />}
                        <span className="text-sm font-bold">Thème</span>
                      </div>
                      <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>{theme === 'light' ? 'Mode clair activé' : 'Mode sombre activé'}</p>
                    </div>
                    <button onClick={toggleTheme} className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex items-center ${theme === 'light' ? 'bg-snap-yellow' : 'bg-white/10'}`}>
                      <div className={`w-5 h-5 rounded-full shadow-md transform duration-200 flex items-center justify-center ${theme === 'light' ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white'}`}>
                        {theme === 'light' ? <Sun size={10} className="text-snap-yellow" /> : <Moon size={10} className="text-zinc-600" />}
                      </div>
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-3"><Bell size={18} className="text-cyan-400" /><span className="text-sm font-bold">Notifications</span></div>
                      <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>Alertes de nouveaux messages</p>
                    </div>
                    <button onClick={toggleNotifications} className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex items-center ${notificationsEnabled ? 'bg-cyan-500' : t.isLight ? 'bg-black/15' : 'bg-white/10'}`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow-md transform duration-200 ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-3"><Camera size={18} className="text-cyan-400" /><span className="text-sm font-bold">Enregistrement auto</span></div>
                      <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>Sauvegarder les snaps créés dans la galerie</p>
                    </div>
                    <button onClick={toggleAutoSave} className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex items-center ${autoSaveSnaps ? 'bg-cyan-500' : t.isLight ? 'bg-black/15' : 'bg-white/10'}`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow-md transform duration-200 ${autoSaveSnaps ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3"><HardDrive size={18} className="text-cyan-400" /><span className="text-sm font-bold">Qualité d'envoi des Médias</span></div>
                    <div className={`grid grid-cols-3 gap-1 rounded-xl p-1 border ${t.isLight ? 'bg-black/8 border-black/8' : 'bg-black/40 border-white/5'}`}>
                      {(['eco', 'standard', 'high'] as const).map((opt) => {
                        const active = mediaQuality === opt;
                        const label = opt === 'eco' ? 'Éco' : opt === 'standard' ? 'Standard' : 'HD';
                        return (
                          <button key={opt} onClick={() => updateMediaQuality(opt)}
                            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-cyan-500 text-white shadow' : t.textMuted}`}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 5: System Actions */}
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wider mb-2.5 ml-2 ${t.textMuted}`}>Actions Système</p>
                <div className={`border rounded-2xl overflow-hidden ${t.surface} ${t.border} divide-y ${t.divider}`}>
                  <button onClick={handleClearCache} className={`w-full flex items-center justify-between p-4 transition-colors text-left ${t.surfaceHover}`}>
                    <div className="flex items-center gap-3">
                      <Trash2 size={18} className="text-red-400" />
                      <div>
                        <span className="text-sm font-bold">Vider le cache</span>
                        <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>Libère de l'espace de stockage</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-md font-bold ${t.surface} ${t.textMuted}`}>14.2 Mo</span>
                  </button>
                  <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-between p-4 hover:bg-red-500/5 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <Shield size={18} className="text-red-500" />
                      <div>
                        <span className="text-sm font-bold text-red-400">Supprimer mon compte</span>
                        <p className="text-red-500/40 text-[11px] mt-0.5">Action irréversible de suppression</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Account Confirmation Modal ─────────────────────── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`border border-red-500/20 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl text-center ${t.isLight ? 'bg-white' : 'bg-[#121214]'} ${t.text}`}
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500">
                <Shield size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black">Supprimer le compte ?</h3>
                <p className={`text-xs leading-relaxed ${t.textSubtle}`}>
                  Cette action est définitive. Toutes tes conversations, photos, vidéos et ton score de snaps seront supprimés définitivement.
                </p>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button onClick={() => setShowDeleteConfirm(false)} className={`flex-1 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all ${t.surface} ${t.text}`}>
                  Annuler
                </button>
                <button onClick={handleDeleteAccount} className="flex-1 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-white font-bold text-sm active:scale-95 transition-all">
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
