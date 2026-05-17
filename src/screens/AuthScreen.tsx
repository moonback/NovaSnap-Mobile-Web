import React, { useMemo, useState } from 'react';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../components/ui/ToastProvider';
import { motion, AnimatePresence } from 'framer-motion';

type AuthMode = 'login' | 'signup';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function getAuthErrorMessage(error: AuthError | Error): string {
  const message = error.message.toLowerCase();
  if (message.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (message.includes('password should be at least')) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (message.includes('email not confirmed')) return 'Confirme ton email avant de te connecter.';
  if (message.includes('user already registered')) return 'Cet email est déjà utilisé.';
  return error.message || 'Une erreur est survenue.';
}

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const isLogin = mode === 'login';
  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);
  
  const usernameError = useMemo(() => {
    if (isLogin || normalizedUsername.length === 0) return null;
    if (!USERNAME_PATTERN.test(normalizedUsername)) return '3-20 caractères : lettres, chiffres, underscore.';
    return null;
  }, [isLogin, normalizedUsername]);

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password) return false;
    if (!isLogin && (!username.trim() || !!usernameError)) return false;
    return !loading;
  }, [email, isLogin, loading, password, username, usernameError]);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: normalizedUsername } },
        });
        if (signUpError) throw signUpError;
        if (data.user) toast('Vérifie ton email pour confirmer ton compte !', 'success');
      }
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error('Erreur d\'authentification.');
      setError(getAuthErrorMessage(parsedError));
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
  };

  const formVariants = {
    hidden: { opacity: 0, x: isLogin ? -20 : 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, x: isLogin ? 20 : -20, transition: { duration: 0.3, ease: "easeIn" } }
  };

  return (
    <div className="w-full h-full bg-[#0a0a0f] text-white flex flex-col items-center justify-center relative overflow-hidden font-sans">
      {/* Animated Background Blobs */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-[80px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FFFC00 0%, transparent 70%)' }} 
      />
      <motion.div 
        animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-[0.15] blur-[80px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)' }} 
      />

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-sm px-6 relative z-10 flex flex-col"
      >
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-[#FFFC00] to-[#eab308] flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(255,252,0,0.3)] relative group"
          >
            <div className="absolute inset-0 rounded-[28px] bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
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
          <p className="text-white/40 text-sm mt-1.5 font-medium">
            {isLogin ? 'Content de te revoir 👋' : 'Rejoins la communauté'}
          </p>
        </div>

        {/* Segmented Toggle */}
        <div className="flex p-1 bg-white/5 border border-white/10 rounded-full mb-8 relative backdrop-blur-md">
          <motion.div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/10 rounded-full shadow-lg border border-white/5"
            animate={{ x: isLogin ? 4 : 'calc(100% + 4px)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors ${isLogin ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors ${!isLogin ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            Inscription
          </button>
        </div>

        {/* Error Message */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0, mb: 0 }}
              animate={{ opacity: 1, height: 'auto', mb: 20 }}
              exit={{ opacity: 0, height: 0, mb: 0 }}
              className="overflow-hidden"
            >
              <div role="alert" className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center font-medium backdrop-blur-md flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Animated Form */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.form 
              key={mode}
              variants={formVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onSubmit={handleAuth} 
              className="space-y-3.5"
            >
              {!isLogin && (
                <div className="relative group">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-snap-yellow transition-colors pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Nom d'utilisateur"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-snap-yellow/50 focus:bg-white/10 transition-all text-[15px] shadow-inner"
                    required
                    minLength={3}
                    maxLength={20}
                    autoCapitalize="none"
                    autoComplete="username"
                    aria-invalid={!!usernameError}
                  />
                  <AnimatePresence>
                    {usernameError && (
                      <motion.p 
                        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                        className="text-xs text-amber-400 mt-2 pl-2 font-medium"
                      >
                        {usernameError}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="relative group">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-snap-yellow transition-colors pointer-events-none" />
                <input
                  type="email"
                  placeholder="Adresse email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-snap-yellow/50 focus:bg-white/10 transition-all text-[15px] shadow-inner"
                  required
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-snap-yellow transition-colors pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-snap-yellow/50 focus:bg-white/10 transition-all text-[15px] shadow-inner"
                  required
                  minLength={8}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {isLogin && (
                <div className="flex justify-end pt-1">
                  <button type="button" className="text-xs text-white/40 hover:text-white transition-colors font-medium">
                    Mot de passe oublié ?
                  </button>
                </div>
              )}

              <motion.button
                type="submit"
                disabled={!canSubmit}
                whileTap={canSubmit ? { scale: 0.98 } : {}}
                className="w-full bg-gradient-to-r from-[#FFFC00] to-[#eab308] text-black font-black py-4 rounded-2xl mt-4 flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(255,252,0,0.25)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer text-[15px] tracking-wide relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <span className="relative z-10">{isLogin ? 'Se connecter' : 'Créer mon compte'}</span>
                    <ArrowRight size={18} className="relative z-10" />
                  </>
                )}
              </motion.button>
            </motion.form>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
