import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';

interface AppState {
  currentView: 'chat' | 'camera' | 'stories';
  setCurrentView: (view: 'chat' | 'camera' | 'stories') => void;
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
}

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
}));
