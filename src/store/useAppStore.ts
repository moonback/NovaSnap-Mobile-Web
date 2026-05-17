import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';

export type Theme = 'dark' | 'light';

interface AppState {
  currentView: 'chat' | 'camera' | 'stories' | 'map';
  setCurrentView: (view: 'chat' | 'camera' | 'stories' | 'map') => void;
  user: User | null;
  session: Session | null;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  directChatId: string | null;
  setDirectChatId: (id: string | null) => void;
  showProfile: boolean;
  setShowProfile: (show: boolean) => void;
  showFriends: boolean;
  setShowFriends: (show: boolean) => void;
  viewingProfileUserId: string | null;
  setViewingProfileUserId: (id: string | null) => void;
  showMemories: boolean;
  setShowMemories: (show: boolean) => void;
  isEditingSnap: boolean;
  setIsEditingSnap: (isEditing: boolean) => void;
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem('novasnap_theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
};

export const useAppStore = create<AppState>((set) => ({
  currentView: 'camera',
  setCurrentView: (view) => set({ currentView: view }),
  user: null,
  session: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  directChatId: null,
  setDirectChatId: (id) => set({ directChatId: id }),
  showProfile: false,
  setShowProfile: (show) => set({ showProfile: show }),
  showFriends: false,
  setShowFriends: (show) => set({ showFriends: show }),
  viewingProfileUserId: null,
  setViewingProfileUserId: (id) => set({ viewingProfileUserId: id }),
  showMemories: false,
  setShowMemories: (show) => set({ showMemories: show }),
  isEditingSnap: false,
  setIsEditingSnap: (isEditing) => set({ isEditingSnap: isEditing }),
  theme: getInitialTheme(),
  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('novasnap_theme', next);
      return { theme: next };
    }),
  setTheme: (theme) => {
    localStorage.setItem('novasnap_theme', theme);
    set({ theme });
  },
}));
