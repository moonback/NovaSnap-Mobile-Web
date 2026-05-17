import React, { useMemo, useState } from 'react';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '../components/ui/ToastProvider';

type AuthMode = 'login' | 'signup';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function getAuthErrorMessage(error: AuthError | Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Invalid email or password.';
  }
  if (message.includes('password should be at least')) {
    return 'Password must contain at least 8 characters.';
  }
  if (message.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }

  return error.message || 'An error occurred during authentication.';
}

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const isLogin = mode === 'login';
  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);
  const usernameError = useMemo(() => {
    if (isLogin || normalizedUsername.length === 0) return null;
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      return 'Use 3-20 chars: letters, numbers, underscore.';
    }
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
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: normalizedUsername,
            },
          },
        });
        if (signUpError) throw signUpError;

        if (data.user) {
          toast('Check your email for the confirmation link!', 'success');
        }
      }
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error('Authentication failed.');
      setError(getAuthErrorMessage(parsedError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md glass rounded-[40px] p-8 relative z-10 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-400 to-purple-500 p-[2px] mx-auto mb-4">
            <div className="w-full h-full bg-black rounded-2xl flex items-center justify-center">
              <span className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-tr from-cyan-400 to-purple-500">N</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">NovaSnap</h1>
          <p className="text-white/40 text-sm mt-2 font-mono uppercase tracking-widest">{isLogin ? 'Welcome Back' : 'Create Account'}</p>
        </div>

        {error && (
          <div role="alert" className="mb-6 p-4 glass-dark border border-red-500/30 rounded-2xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40">
                <User size={18} />
              </div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition-all font-medium"
                required
                minLength={3}
                maxLength={20}
                autoCapitalize="none"
                autoComplete="username"
                aria-invalid={!!usernameError}
              />
              {usernameError && <p className="text-xs text-amber-300 mt-2">{usernameError}</p>}
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40">
              <Mail size={18} />
            </div>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition-all font-medium"
              required
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40">
              <Lock size={18} />
            </div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition-all font-medium"
              required
              minLength={8}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold py-4 rounded-2xl mt-6 flex items-center justify-center gap-2 hover:from-cyan-300 hover:to-blue-400 active:scale-95 transition-all shadow-[0_0_20px_rgba(34,211,238,0.4)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <>{isLogin ? 'Sign In' : 'Continue'}<ArrowRight size={20} /></>}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setMode(isLogin ? 'signup' : 'login');
              setError(null);
            }}
            className="text-white/40 hover:text-white text-sm font-medium transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}
