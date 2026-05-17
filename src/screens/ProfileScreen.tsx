import React from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LogOut, Settings, Camera, Award, Ghost, Eye, Loader2 } from 'lucide-react';
import { supabase, getValidMediaUrl } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/ui/ToastProvider';

export default function ProfileScreen() {
  const { user, setShowProfile } = useAppStore();

  // Fetch full user profile from DB
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;

      // Resolve signed URL if the avatar is in the private bucket
      if (data.avatar_url) {
        data.avatar_url = await getValidMediaUrl('avatars', data.avatar_url);
      }
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

      // 1. Upload to secure 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Supabase public URL structure (even if bucket is private, we store this standard format 
      // so our getValidMediaUrl function can parse it and sign it dynamically)
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // 2. Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // 3. Invalidate cache to refetch and resign
      await queryClient.invalidateQueries({ queryKey: ['user-profile', user.id] });
      toast('Profile photo updated successfully!', 'success');
      
    } catch (err: any) {
      console.error(err);
      toast('Failed to upload photo: ' + err.message, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
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
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-[#050505] text-white flex flex-col overflow-y-auto overflow-x-hidden"
    >
      {/* Header */}
      <div className="flex justify-between items-center p-6 mt-4">
        <button 
          onClick={() => setShowProfile(false)}
          className="w-10 h-10 rounded-full glass flex items-center justify-center text-white hover:bg-white/10 transition-colors"
        >
          <ChevronDown size={24} />
        </button>
        <button className="w-10 h-10 rounded-full glass flex items-center justify-center text-white hover:bg-white/10 transition-colors">
          <Settings size={20} />
        </button>
      </div>

      <div className="flex-1 px-6 flex flex-col items-center max-w-md w-full mx-auto pb-10">
        
        {/* Avatar Section */}
        <div className="relative group cursor-pointer mt-4" onClick={() => fileInputRef.current?.click()}>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleAvatarUpload} 
          />
          <div className="w-32 h-32 rounded-[40px] bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 p-[3px] shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all group-hover:scale-105">
            <div className="w-full h-full bg-black rounded-[38px] overflow-hidden relative">
              {isUploading ? (
                <div className="w-full h-full flex items-center justify-center bg-[#111]">
                  <Loader2 size={32} className="animate-spin text-cyan-400" />
                </div>
              ) : profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#111]">
                  <Ghost size={48} className="text-white/20" />
                </div>
              )}
            </div>
          </div>
          <div className="absolute -bottom-3 -right-3 w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center border-4 border-[#050505] shadow-lg hover:scale-110 transition-transform">
            <Camera size={16} className="text-black" />
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 text-center space-y-2">
          {isLoading ? (
            <div className="h-8 w-40 bg-white/10 rounded-lg animate-pulse mx-auto" />
          ) : (
            <h1 className="text-3xl font-black tracking-tight">{profile?.display_name || 'Nova User'}</h1>
          )}
          
          {isLoading ? (
            <div className="h-5 w-24 bg-white/5 rounded-lg animate-pulse mx-auto mt-2" />
          ) : (
            <p className="text-white/40 font-mono text-sm tracking-wide">@{profile?.username || 'user'}</p>
          )}
        </div>

        {/* Stats Board */}
        <div className="w-full grid grid-cols-2 gap-4 mt-10">
          <div className="glass rounded-3xl p-5 flex flex-col items-center gap-3 border border-white/5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Award size={24} />
            </div>
            <div className="text-center">
              <p className="text-2xl font-black">12,402</p>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mt-1">Nova Score</p>
            </div>
          </div>

          <div className="glass rounded-3xl p-5 flex flex-col items-center gap-3 border border-white/5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Eye size={24} />
            </div>
            <div className="text-center">
              <p className="text-2xl font-black">348</p>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mt-1">Story Views</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full mt-auto pt-10 space-y-3">
          <button className="w-full glass rounded-2xl py-4 font-bold text-sm tracking-wide hover:bg-white/10 transition-colors border border-white/5">
            Edit Public Profile
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full glass rounded-2xl py-4 font-bold text-sm tracking-wide text-red-400 hover:bg-red-500/10 transition-colors border border-red-500/10 flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>

      </div>
    </motion.div>
  );
}
