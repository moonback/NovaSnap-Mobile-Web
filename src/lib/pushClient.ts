// ============================================================
// pushClient.ts — Appel direct à l'Edge Function depuis le client
// Utilisé pour les cas où le trigger DB ne suffit pas
// (ex: tester manuellement, envoyer depuis le front)
// ============================================================

import { supabase } from './supabase';

export type PushPayload = {
  user_id: string;
  title: string;
  body: string;
  type:
    | 'NEW_MESSAGE'
    | 'SNAP_OPENED'
    | 'FRIEND_REQUEST'
    | 'FRIEND_ACCEPTED'
    | 'NEW_STORY'
    | 'SNAP_SCREENSHOT';
  data?: Record<string, unknown>;
};

/**
 * Envoie une notification push via l'Edge Function Supabase.
 * Les triggers DB appellent automatiquement cette fonction —
 * n'utilise ceci que pour des cas manuels ou des tests.
 */
export async function sendPushNotification(payload: PushPayload): Promise<void> {
  const { error } = await supabase.functions.invoke('send-push-notification', {
    body: payload,
  });

  if (error) {
    console.error('[Push] Erreur Edge Function:', error);
    throw error;
  }
}

/**
 * Envoie une notification push à plusieurs utilisateurs en parallèle.
 */
export async function sendBatchPushNotifications(
  userIds: string[],
  notification: Omit<PushPayload, 'user_id'>
): Promise<void> {
  await Promise.allSettled(
    userIds.map((user_id) =>
      sendPushNotification({ ...notification, user_id })
    )
  );
}
