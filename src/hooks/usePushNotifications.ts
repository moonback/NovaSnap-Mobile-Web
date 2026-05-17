import { useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

// ── Types ─────────────────────────────────────────────────────
export type NotificationType =
  | 'NEW_MESSAGE'
  | 'SNAP_OPENED'
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'NEW_STORY'
  | 'SNAP_SCREENSHOT';

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

// ── Clé VAPID publique (à remplacer par ta vraie clé) ─────────
// Génère une paire avec: npx web-push generate-vapid-keys
// Mets la clé publique ici et la privée dans les Edge Functions Supabase
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

// ── Convertir la clé VAPID base64 en Uint8Array ───────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// ── Hook principal ────────────────────────────────────────────
export const usePushNotifications = () => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Sauvegarder la subscription en base ──────────────────
  const saveSubscriptionMutation = useMutation({
    mutationFn: async (subscription: PushSubscription) => {
      if (!user) throw new Error('Non connecté');
      const sub = subscription.toJSON();
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: sub.endpoint!,
          p256dh: (sub.keys as Record<string, string>)?.p256dh ?? '',
          auth: (sub.keys as Record<string, string>)?.auth ?? '',
          user_agent: navigator.userAgent.substring(0, 200),
        },
        { onConflict: 'user_id,endpoint' }
      );
      if (error) throw error;
    },
  });

  // ── Supprimer la subscription (désabonnement) ─────────────
  const removeSubscriptionMutation = useMutation({
    mutationFn: async (endpoint: string) => {
      if (!user) return;
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', endpoint);
    },
  });

  // ── Demander la permission et s'abonner ───────────────────
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !VAPID_PUBLIC_KEY) return false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();

      // Réutiliser la subscription existante si elle est valide
      if (existing) {
        await saveSubscriptionMutation.mutateAsync(existing);
        return true;
      }

      // Créer une nouvelle subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
      });

      await saveSubscriptionMutation.mutateAsync(subscription);
      return true;
    } catch (err) {
      console.error('[Push] Erreur lors de l\'abonnement:', err);
      return false;
    }
  }, [user, saveSubscriptionMutation]);

  // ── Se désabonner ─────────────────────────────────────────
  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removeSubscriptionMutation.mutateAsync(subscription.endpoint);
        await subscription.unsubscribe();
      }
    } catch (err) {
      console.error('[Push] Erreur lors du désabonnement:', err);
    }
  }, [removeSubscriptionMutation]);

  // ── Auto-subscribe au chargement si permission déjà accordée ─
  useEffect(() => {
    if (!user || !VAPID_PUBLIC_KEY) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const autoSubscribe = async () => {
      const settingsEnabled = localStorage.getItem('novasnap_settings_notifications') !== 'false';
      if (!settingsEnabled) {
        await unsubscribe();
        return;
      }
      const permission = Notification.permission;
      if (permission === 'granted') {
        await subscribe();
      }
    };

    autoSubscribe();
  }, [user?.id, subscribe, unsubscribe]);

  // ── Écouter les notifications en temps réel (in-app) ─────
  useEffect(() => {
    if (!user) return;

    // Nom unique pour éviter les conflits en StrictMode (double-mount React 18)
    const channelName = `notifications:${user.id}:${crypto.randomUUID()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          const settingsEnabled = localStorage.getItem('novasnap_settings_notifications') !== 'false';
          if (!settingsEnabled) return;
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
          queryClient.invalidateQueries({ queryKey: ['unread-count', user.id] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id, queryClient]);

  // ── Naviguer vers la bonne vue depuis une notification ────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE') {
        const url = new URL(event.data.url, window.location.origin);
        const view = url.searchParams.get('view');
        if (view) {
          // Dispatcher un événement custom pour que App.tsx puisse réagir
          window.dispatchEvent(new CustomEvent('sw-navigate', { detail: { view, url: event.data.url } }));
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  return { subscribe, unsubscribe };
};

// ── Hook pour le compteur de notifications non lues ──────────
export const useNotificationCount = () => {
  const { user } = useAppStore();

  return useQuery<number>({
    queryKey: ['unread-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase.rpc('get_unread_notification_count');
      if (error) return 0;
      return (data as number) ?? 0;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};

// ── Hook pour la liste des notifications ─────────────────────
export const useNotifications = (limit = 30) => {
  const { user } = useAppStore();
  const queryClient = useQueryClient();

  const query = useQuery<AppNotification[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return [];
      return (data as AppNotification[]) ?? [];
    },
    enabled: !!user,
    staleTime: 15_000,
  });

  // Marquer toutes comme lues
  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-count', user?.id] });
      // Effacer le badge de l'app
      updateAppBadge(0);
    },
  });

  return { ...query, markAllRead: markAllRead.mutate };
};

// ── Mettre à jour le badge de l'app via le SW ────────────────
export function updateAppBadge(count: number) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage({ type: count > 0 ? 'UPDATE_BADGE' : 'CLEAR_BADGE', count });
  });
}
