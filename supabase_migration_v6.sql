-- =======================================================================
-- NOVASNAP — MIGRATION V6 (Message idempotency hardening)
-- ✅ Ajoute un client_message_id pour dédupliquer les envois optimistes
-- ✅ Crée un index unique partiel par expéditeur
-- =======================================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS client_message_id TEXT;

-- Empêche les doublons d'un même message client pour un sender donné
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_sender_client_message_id_unique
  ON public.messages(sender_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
