import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

// ── Types ─────────────────────────────────────────────────────
type OnlineStatus = {
  isOnline: boolean;
  lastSeenAt: string | null;
  canView: boolean;
};

type BatchOnlineStatus = {
  user_id: string;
  is_online: boolean;
  last_seen_at: string | null;
};

// ── Hook principal ────────────────────────────────────────────
export const useOnlineStatus = (userId?: string) => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAppStore();

  // ── Heartbeat mutation (met à jour last_seen_at toutes les 30s) ──
  const heartbeatMutation = useMutation({
    mutationFn: async () => {
      const ghostMode =
        localStorage.getItem('novasnap_settings_ghost_mode') === 'true';

      if (ghostMode) {
        const { error } = await supabase.rpc('update_user_heartbeat',
          { p_ghost: true });
        if (error) throw error;
        return;
      }

      const position = await new Promise<GeolocationPosition | null>(resolve => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos),
          ()  => resolve(null),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
        );
      });

      const { error } = await supabase.rpc('update_user_heartbeat', {
        p_lat:   position?.coords.latitude  ?? null,
        p_lng:   position?.coords.longitude ?? null,
        p_ghost: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalider les requêtes de statut en ligne pour refléter le changement
      queryClient.invalidateQueries({ queryKey: ['online-status'] });
    },
  });

  // ── Heartbeat automatique toutes les 30 secondes ──
  useEffect(() => {
    if (!currentUser) return;

    // Heartbeat initial
    heartbeatMutation.mutate();

    // Heartbeat périodique
    const interval = setInterval(() => {
      heartbeatMutation.mutate();
    }, 30_000); // 30 secondes

    // Heartbeat lors de la visibilité de la page
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        heartbeatMutation.mutate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.id]);

  // ── Query pour obtenir le statut d'un utilisateur spécifique ──
  const { data: status, isLoading } = useQuery<OnlineStatus>({
    queryKey: ['online-status', userId],
    queryFn: async () => {
      if (!userId) throw new Error('userId is required');
      
      const { data, error } = await supabase.rpc('get_user_online_status', {
        target_user_id: userId,
      });

      if (error) throw error;
      
      const result = (data as unknown as OnlineStatus[])?.[0];
      return {
        isOnline: result?.isOnline ?? false,
        lastSeenAt: result?.lastSeenAt ?? null,
        canView: result?.canView ?? false,
      };
    },
    enabled: !!userId && !!currentUser,
    staleTime: 30_000, // 30 secondes
    refetchInterval: 60_000, // Rafraîchir toutes les 60 secondes
  });

  return {
    isOnline: status?.isOnline ?? false,
    lastSeenAt: status?.lastSeenAt ?? null,
    canView: status?.canView ?? false,
    isLoading,
  };
};

// ── Hook pour obtenir les statuts en batch (pour les listes d'amis) ──
export const useBatchOnlineStatus = (userIds: string[]) => {
  const { user: currentUser } = useAppStore();

  const { data: statuses = [], isLoading } = useQuery<BatchOnlineStatus[]>({
    queryKey: ['batch-online-status', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];

      const { data, error } = await supabase.rpc('get_batch_online_status', {
        user_ids: userIds,
      });

      if (error) throw error;
      return (data as BatchOnlineStatus[]) ?? [];
    },
    enabled: userIds.length > 0 && !!currentUser,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Convertir en Map pour un accès facile
  const statusMap = new Map<string, { isOnline: boolean; lastSeenAt: string | null }>();
  statuses.forEach((s) => {
    statusMap.set(s.user_id, {
      isOnline: s.is_online,
      lastSeenAt: s.last_seen_at,
    });
  });

  return {
    getStatus: useCallback(
      (userId: string) => statusMap.get(userId) ?? { isOnline: false, lastSeenAt: null },
      [statuses]
    ),
    isLoading,
  };
};

// ── Fonction utilitaire pour formater "il y a X minutes" ──
export const formatLastSeen = (lastSeenAt: string | null): string => {
  if (!lastSeenAt) return '';

  const now = new Date();
  const lastSeen = new Date(lastSeenAt);
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return 'À l\'instant';
  if (diffMinutes < 60) return `Il y a ${diffMinutes}m`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  
  return 'Il y a longtemps';
};
