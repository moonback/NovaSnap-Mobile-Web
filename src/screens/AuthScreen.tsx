import React, { useMemo, useState } from 'react';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../components/ui/ToastProvider';
import { motion, AnimatePresence } from 'framer-motion';

type AuthMode = 'login' | 'signup' | 'forgot';

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
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const { toast } = useToast();

  const isLogin = mode === 'login';
  const isForgot = mode === 'forgot';
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

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}?reset=true`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error('Erreur lors de l\'envoi.');
      setError(parsedError.message);
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
    <div className="w-full h-full bg-black text-white flex flex-col items-center justify-center relative overflow-y-auto overflow-x-hidden font-sans py-8">
      {/* Animated background blobs */}
      <motion.div
        animate={{ scale: [1, 1.15, 1], rotate: [0, 120, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.18] blur-[100px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FFFC00 0%, transparent 65%)' }}
      />
      <motion.div
        animate={{ scale: [1, 1.25, 1], rotate: [0, -100, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        className="absolute -bottom-40 -right-40 w-[450px] h-[450px] rounded-full opacity-[0.12] blur-[100px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 65%)' }}
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-sm px-6 relative z-10 flex flex-col my-auto"
      >
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            whileHover={{ scale: 1.06, rotate: 4 }}
            whileTap={{ scale: 0.94 }}
            className="w-[88px] h-[88px] rounded-[26px] flex items-center justify-center mb-5 relative"
            style={{
              background: 'linear-gradient(145deg, #FFFC00 0%, #FFD700 100%)',
              boxShadow: '0 0 50px rgba(255,252,0,0.35), 0 12px 40px rgba(0,0,0,0.3)',
            }}
          >
            <img
              src="/logo.png"
              alt="Logo"
              className="w-14 h-14 object-contain relative z-10"
            />
          </motion.div>
          <h1 className="text-[32px] font-black tracking-tight text-white">
            NovaSnap
          </h1>
          <p className="text-white/45 text-[13px] mt-1.5 font-medium">
            {isLogin ? 'Content de te revoir 👋' : 'Rejoins la communauté ✨'}
          </p>
        </div>

        {/* Segmented toggle */}
        {!isForgot && (
          <div
            className="flex p-1 rounded-full mb-7 relative"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <motion.div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full"
              animate={{ x: isLogin ? 4 : 'calc(100% + 4px)' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors duration-150 ${isLogin ? 'text-white' : 'text-white/40 hover:text-white/65'}`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors duration-150 ${!isLogin ? 'text-white' : 'text-white/40 hover:text-white/65'}`}
            >
              Inscription
            </button>
          </div>
        )}

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
            {isForgot ? (
              /* ── Forgot Password View ── */
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="space-y-4"
              >
                {forgotSent ? (
                  /* Success state */
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="w-16 h-16 rounded-full bg-snap-yellow/15 border border-snap-yellow/30 flex items-center justify-center">
                      <Mail size={28} className="text-snap-yellow" />
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-white font-black text-lg">Email envoyé !</p>
                      <p className="text-white/50 text-sm leading-relaxed">
                        Vérifie ta boîte mail à <span className="text-snap-yellow font-bold">{forgotEmail}</span> et clique sur le lien pour réinitialiser ton mot de passe.
                      </p>
                    </div>
                    <button
                      onClick={() => { setMode('login'); setForgotSent(false); setError(null); }}
                      className="w-full bg-white/8 border border-white/10 text-white font-bold py-3.5 rounded-2xl text-sm hover:bg-white/12 transition-colors active:scale-95"
                    >
                      Retour à la connexion
                    </button>
                  </div>
                ) : (
                  /* Form state */
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="text-center space-y-1.5 mb-2">
                      <p className="text-white font-black text-lg">Mot de passe oublié ?</p>
                      <p className="text-white/40 text-sm leading-relaxed">
                        Saisis ton adresse email et on t'envoie un lien de réinitialisation.
                      </p>
                    </div>

                    <div className="relative group">
                      <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-snap-yellow transition-colors pointer-events-none" />
                      <input
                        type="email"
                        placeholder="Adresse email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-snap-yellow/50 focus:bg-white/10 transition-all text-[15px] shadow-inner"
                        required
                        autoComplete="email"
                        inputMode="email"
                      />
                    </div>

                    <motion.button
                      type="submit"
                      disabled={!forgotEmail.trim() || loading}
                      whileTap={!loading ? { scale: 0.98 } : {}}
                      className="w-full bg-gradient-to-r from-[#FFC0CB] to-[#eab308] text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(255,252,0,0.25)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[15px] tracking-wide relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                      {loading ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <>
                          <span className="relative z-10">Envoyer le lien</span>
                          <ArrowRight size={18} className="relative z-10" />
                        </>
                      )}
                    </motion.button>

                    <button
                      type="button"
                      onClick={() => { setMode('login'); setError(null); }}
                      className="w-full text-white/40 hover:text-white/70 transition-colors text-sm font-medium py-2"
                    >
                      ← Retour à la connexion
                    </button>
                  </form>
                )}
              </motion.div>
            ) : (
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
                  <User size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#FFFC00] transition-colors pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Nom d'utilisateur"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-2xl py-[14px] pl-11 pr-4 text-white placeholder-white/30 focus:outline-none text-[15px]"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1.5px solid rgba(255,255,255,0.1)',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,252,0,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
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
                  <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#FFFC00] transition-colors pointer-events-none" />
                  <input
                    type="email"
                    placeholder="Adresse email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl py-[14px] pl-11 pr-4 text-white placeholder-white/30 focus:outline-none text-[15px]"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1.5px solid rgba(255,255,255,0.1)',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,252,0,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                    required
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>

                <div className="relative group">
                  <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#FFFC00] transition-colors pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl py-[14px] pl-11 pr-12 text-white placeholder-white/30 focus:outline-none text-[15px]"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1.5px solid rgba(255,255,255,0.1)',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,252,0,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                    required
                    minLength={8}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                {isLogin && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(null); setForgotSent(false); setForgotEmail(email); }}
                      className="text-xs text-white/40 hover:text-snap-yellow transition-colors font-medium"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}

                <motion.button
                  type="submit"
                  disabled={!canSubmit}
                  whileTap={canSubmit ? { scale: 0.97 } : {}}
                  className="w-full text-black font-black py-[15px] rounded-2xl mt-5 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[15px] tracking-wide relative overflow-hidden"
                  style={{
                    background: '#FFFC00',
                    boxShadow: canSubmit ? '0 6px 24px rgba(255,252,0,0.3)' : 'none',
                  }}
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <span>{isLogin ? 'Se connecter' : 'Créer mon compte'}</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
