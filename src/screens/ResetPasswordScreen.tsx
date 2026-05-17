import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Loader2, Eye, EyeOff, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/ToastProvider';

export default function ResetPasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      toast('Le mot de passe doit contenir au moins 8 caractères.', 'error');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast('Les mots de passe ne correspondent pas.', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccess(true);
      toast('Mot de passe réinitialisé avec succès !', 'success');
      
      // Rediriger vers l'app après 2 secondes
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la réinitialisation';
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordValid = newPassword.length >= 8;

  return (
    <div className="w-full h-full bg-[#0a0a0f] text-white flex flex-col items-center justify-center relative overflow-hidden font-sans p-6">
      {/* Animated Background Blobs */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-[80px] pointer-events-none fixed"
        style={{ background: 'radial-gradient(circle, #FFFC00 0%, transparent 70%)' }} 
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-[#FFFC00] to-[#eab308] flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(255,252,0,0.3)]"
          >
            <svg viewBox="0 0 100 100" className="w-12 h-12" fill="none">
              <path
                d="M50 10C28 10 10 28 10 50c0 8 2.5 15.5 6.8 21.6L10 90l18.4-6.8C34.5 87.5 42 90 50 90c22 0 40-18 40-40S72 10 50 10z"
                fill="black"
              />
              <circle cx="35" cy="50" r="5" fill="white" />
              <circle cx="50" cy="50" r="5" fill="white" />
              <circle cx="65" cy="50" r="5" fill="white" />
            </svg>
          </motion.div>
          <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70">
            NovaSnap
          </h1>
        </div>

        {success ? (
          /* Success State */
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
              <Check size={40} className="text-green-400" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-white font-black text-xl">Mot de passe réinitialisé !</p>
              <p className="text-white/50 text-sm">
                Redirection en cours...
              </p>
            </div>
            <Loader2 className="animate-spin text-snap-yellow" size={24} />
          </motion.div>
        ) : (
          /* Reset Form */
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black mb-2">Nouveau mot de passe</h2>
              <p className="text-white/40 text-sm">
                Choisis un nouveau mot de passe sécurisé pour ton compte.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* New Password */}
              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-snap-yellow transition-colors pointer-events-none" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Nouveau mot de passe"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-snap-yellow/50 focus:bg-white/10 transition-all text-[15px] shadow-inner"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Confirm Password */}
              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-snap-yellow transition-colors pointer-events-none" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirmer le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full bg-white/5 border rounded-2xl py-4 pl-12 pr-12 text-white placeholder-white/30 focus:outline-none focus:bg-white/10 transition-all text-[15px] shadow-inner ${
                    confirmPassword && !passwordsMatch
                      ? 'border-red-500/50 focus:border-red-500/70'
                      : confirmPassword && passwordsMatch
                      ? 'border-green-500/50 focus:border-green-500/70'
                      : 'border-white/10 focus:border-snap-yellow/50'
                  }`}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password validation feedback */}
              <div className="space-y-1.5 px-1">
                <div className={`flex items-center gap-2 text-xs transition-colors ${
                  passwordValid ? 'text-green-400' : 'text-white/30'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${passwordValid ? 'bg-green-400' : 'bg-white/20'}`} />
                  Au moins 8 caractères
                </div>
                <div className={`flex items-center gap-2 text-xs transition-colors ${
                  passwordsMatch ? 'text-green-400' : 'text-white/30'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${passwordsMatch ? 'bg-green-400' : 'bg-white/20'}`} />
                  Les mots de passe correspondent
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={!passwordValid || !passwordsMatch || loading}
                whileTap={!loading && passwordValid && passwordsMatch ? { scale: 0.98 } : {}}
                className="w-full bg-gradient-to-r from-[#FFFC00] to-[#eab308] text-black font-black py-4 rounded-2xl mt-6 flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(255,252,0,0.25)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[15px] tracking-wide relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <span className="relative z-10">Réinitialiser le mot de passe</span>
                    <ArrowRight size={18} className="relative z-10" />
                  </>
                )}
              </motion.button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
