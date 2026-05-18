-- ========== MIGRATION V15: MESSAGE REACTIONS & MENTIONS ==========
-- Ajoute la colonne reactions sur la table messages pour stocker les emojis

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.messages.reactions IS 'Stocke les réactions emoji des utilisateurs sous la forme {"user_id": "emoji"}';

-- Index de performance pour les recherches JSONB (optionnel)
CREATE INDEX IF NOT EXISTS idx_messages_reactions ON public.messages USING gin (reactions);
