import React from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, LogOut, Settings, Camera, Award, Ghost, Eye, Loader2, Edit2 } from 'lucide-react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastProvider';

export default function ProfileScreen() {
  const { user, setShowProfile } = useAppStore();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (error) throw error;
      if (data.avatar_url) data.avatar_url = await getValidMediaUrl('avatars', data.avatar_url);
      return data;
    },
    enabled: !!user,
  });

  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const queryClient = useQueryClient();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;
      await queryClient.invalidateQueries({ queryKey: ['user-profile', user.id] });
      toast('Photo de profil mise à jour !', 'success');
    } catch (err: any) {
      toast('Erreur : ' + err.message, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowProfile(false);
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
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
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
          <div className="absolute -bottom-1 -right-1 w-9 h-9 bg-snap-yellow rounded-full flex items-center justify-center border-3 border-black shadow-snap-sm cursor-pointer hover:scale-110 transition-transform">
            <Camera size={15} className="text-black" />
          </div>
        </div>

        {/* Name & username */}
        <div className="text-center mb-8">
          {isLoading ? (
            <>
              <div className="h-7 w-36 bg-white/10 rounded-lg animate-pulse mx-auto mb-2" />
              <div className="h-4 w-24 bg-white/5 rounded-lg animate-pulse mx-auto" />
            </>
          ) : (
            <>
              <h2 className="text-2xl font-black tracking-tight">{profile?.display_name || 'Nova User'}</h2>
              <p className="text-white/40 text-sm mt-1">@{profile?.username || 'user'}</p>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="w-full grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Score', value: '12.4K', color: 'text-snap-yellow' },
            { label: 'Stories', value: '348', color: 'text-white' },
            { label: 'Amis', value: '127', color: 'text-white' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/5 rounded-2xl py-4 flex flex-col items-center gap-1 border border-white/8">
              <span className={`text-xl font-black ${stat.color}`}>{stat.value}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Snap score highlight */}
        <div className="w-full bg-snap-yellow/8 border border-snap-yellow/20 rounded-2xl p-4 flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-snap-yellow/15 flex items-center justify-center">
            <Award size={20} className="text-snap-yellow" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm">Nova Score</p>
            <p className="text-white/40 text-xs">Continue à snapper pour augmenter ton score</p>
          </div>
          <span className="text-snap-yellow font-black text-lg">12,402</span>
        </div>

        {/* Actions */}
        <div className="w-full space-y-3 mt-auto">
          <button className="w-full bg-white/8 border border-white/10 rounded-2xl py-4 font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/12 transition-colors active:scale-98">
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
