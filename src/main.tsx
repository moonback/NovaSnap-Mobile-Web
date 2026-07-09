import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/ToastProvider.tsx';
import App from './App.tsx';
import './index.css';
import { messageQueue } from './lib/messageQueue.ts';

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // Désactiver et désenregistrer le Service Worker en mode développement
    // pour éviter les conflits de cache et les problèmes avec le serveur de dev Vite
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
        console.log('ServiceWorker désenregistré en mode dev.');
      }
    });
  }
}

// Enregistrer les configurations Supabase pour que le Service Worker y accède hors connexion
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';
messageQueue.saveConfig(supabaseUrl, supabaseAnonKey).catch((e) => {
  console.warn('Erreur d\'enregistrement de la configuration Supabase dans IndexedDB:', e);
});


const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);

