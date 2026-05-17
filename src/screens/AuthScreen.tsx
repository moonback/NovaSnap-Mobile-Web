import React, { useMemo, useState } from 'react';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../components/ui/ToastProvider';

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
    if (!isLogin && !!usernameError) return false;
    return !loading;
  }, [email, isLogin, loading, password, usernameError]);

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

  return (
    <div className="w-full h-full bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background gradient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #FFFC00 0%, transparent 70%)' }} />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ff9500 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-sm px-6 relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-[28px] bg-snap-yellow flex items-center justify-center mb-4 shadow-snap">
            <svg viewBox="0 0 100 100" className="w-12 h-12" fill="none">
              <path
                d="M50 10C28 10 10 28 10 50c0 8 2.5 15.5 6.8 21.6L10 90l18.4-6.8C34.5 87.5 42 90 50 90c22 0 40-18 40-40S72 10 50 10z"
                fill="black"
              />
              <circle cx="35" cy="50" r="5" fill="white" />
              <circle cx="50" cy="50" r="5" fill="white" />
              <circle cx="65" cy="50" r="5" fill="white" />
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight">NovaSnap</h1>
          <p className="text-white/40 text-sm mt-1">
            {isLogin ? 'Content de te revoir 👋' : 'Rejoins la communauté'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="mb-5 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-3">
          {!isLogin && (
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                type="text"
                placeholder="Nom d'utilisateur"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/8 border border-white/12 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-snap-yellow/60 focus:bg-white/10 transition-all text-[15px]"
                required
                minLength={3}
                maxLength={20}
                autoCapitalize="none"
                autoComplete="username"
                aria-invalid={!!usernameError}
              />
              {usernameError && <p className="text-xs text-amber-400 mt-1.5 pl-1">{usernameError}</p>}
            </div>
          )}

          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type="email"
              placeholder="Adresse email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/8 border border-white/12 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-snap-yellow/60 focus:bg-white/10 transition-all text-[15px]"
              required
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/8 border border-white/12 rounded-2xl py-4 pl-12 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-snap-yellow/60 focus:bg-white/10 transition-all text-[15px]"
              required
              minLength={8}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-snap-yellow text-black font-black py-4 rounded-2xl mt-2 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-snap disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[15px] tracking-wide"
          >
            {loading
              ? <Loader2 size={20} className="animate-spin" />
              : <>{isLogin ? 'Se connecter' : 'Créer mon compte'} <ArrowRight size={20} /></>
            }
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-8 text-center">
          <button
            onClick={() => { setMode(isLogin ? 'signup' : 'login'); setError(null); }}
            className="text-white/50 hover:text-white text-sm transition-colors"
          >
            {isLogin ? "Pas encore de compte ? " : 'Déjà un compte ? '}
            <span className="text-snap-yellow font-bold">{isLogin ? 'Inscription' : 'Connexion'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
