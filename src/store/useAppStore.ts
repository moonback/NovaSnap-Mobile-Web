import { create } from 'zustand';

interface AppState {
  currentView: 'chat' | 'camera' | 'stories';
  setCurrentView: (view: 'chat' | 'camera' | 'stories') => void;
  user: any | null; // Replace with proper Supabase user type later
  setUser: (user: any | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'camera',
  setCurrentView: (view) => set({ currentView: view }),
  user: null,
  setUser: (user) => set({ user }),
}));
