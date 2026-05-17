-- =======================================================================
-- NOVASNAP — MIGRATION V2 (Sécurité + Performance)
-- ✅ Ce fichier est SAFE à exécuter sur une base existante.
-- ✅ Toutes les commandes utilisent IF NOT EXISTS / IF EXISTS / ON CONFLICT.
-- ❌ Ne PAS ré-exécuter supabase_schema.sql complet (erreur 42P07).
-- =======================================================================


-- ──────────────────────────────────────────────────────────────────────
-- 1. BUCKETS DE STOCKAGE — Passer en PRIVÉ
-- ──────────────────────────────────────────────────────────────────────
-- Crée les buckets s'ils n'existent pas, ou met à jour public → false
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars',         'avatars',         false),
  ('chats',           'chats',           false),
  ('stories',         'stories',         false),
  ('temporary_snaps', 'temporary_snaps', false)
ON CONFLICT (id) DO UPDATE SET public = false;


-- ──────────────────────────────────────────────────────────────────────
-- 2. POLITIQUES STORAGE — Remplacer les politiques publiques
-- ──────────────────────────────────────────────────────────────────────
-- Supprimer les anciennes politiques publiques si elles existent
DROP POLICY IF EXISTS "Allow select for avatars"       ON storage.objects;
DROP POLICY IF EXISTS "Allow insert for avatars"       ON storage.objects;
DROP POLICY IF EXISTS "Allow select for chats"         ON storage.objects;
DROP POLICY IF EXISTS "Allow insert for chats"         ON storage.objects;
DROP POLICY IF EXISTS "Allow select for stories"       ON storage.objects;
DROP POLICY IF EXISTS "Allow insert for stories"       ON storage.objects;
DROP POLICY IF EXISTS "Allow select for temporary_snaps" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert for temporary_snaps" ON storage.objects;

-- Nouvelles politiques : accès uniquement pour les utilisateurs authentifiés
CREATE POLICY "Auth read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Auth insert avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Auth read chats"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chats' AND auth.role() = 'authenticated');

CREATE POLICY "Auth insert chats"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chats' AND auth.role() = 'authenticated');

CREATE POLICY "Auth read stories"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stories' AND auth.role() = 'authenticated');

CREATE POLICY "Auth insert stories"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'stories' AND auth.role() = 'authenticated');

CREATE POLICY "Auth read snaps"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'temporary_snaps' AND auth.role() = 'authenticated');

CREATE POLICY "Auth insert snaps"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'temporary_snaps' AND auth.role() = 'authenticated');


-- ──────────────────────────────────────────────────────────────────────
-- 3. COLONNE unique_hash — Conversations 1v1 sans doublons
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS unique_hash TEXT;

-- Index unique partiel (uniquement pour conversations avec hash)
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_hash
  ON public.conversations(unique_hash)
  WHERE unique_hash IS NOT NULL;


-- ──────────────────────────────────────────────────────────────────────
-- 4. INDEXES DE PERFORMANCE
-- ──────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stories_expires
  ON public.stories(expires_at);

CREATE INDEX IF NOT EXISTS idx_stories_user_created
  ON public.stories(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friendships_user
  ON public.friendships(user_id);

CREATE INDEX IF NOT EXISTS idx_friendships_friend
  ON public.friendships(friend_id);

CREATE INDEX IF NOT EXISTS idx_message_status_user
  ON public.message_status(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user
  ON public.conversation_members(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation
  ON public.conversation_members(conversation_id);


-- ──────────────────────────────────────────────────────────────────────
-- 5. POLITIQUE conversation_members — Supprimer la récursion infinie
-- ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view members of their conversations"
  ON public.conversation_members;

CREATE POLICY "Users can view members of their conversations"
  ON public.conversation_members FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- ──────────────────────────────────────────────────────────────────────
-- 6. NETTOYAGE — Supprimer les medias blob: corrompus dans les tables
-- ──────────────────────────────────────────────────────────────────────
DELETE FROM public.stories  WHERE media_url LIKE 'blob:%';
DELETE FROM public.messages WHERE media_url LIKE 'blob:%';


-- ──────────────────────────────────────────────────────────────────────
-- ✅ Migration V2 terminée avec succès.
-- ──────────────────────────────────────────────────────────────────────
