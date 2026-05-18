import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/ToastProvider.tsx';
import App from './App.tsx';
import './index.css';

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

