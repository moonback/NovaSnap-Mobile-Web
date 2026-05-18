-- =======================================================================
-- NOVASNAP — MIGRATION V5 (Storage hardening)
-- ✅ Renforce les policies storage.objects pour empêcher
--    l'upload/lecture hors namespace utilisateur.
-- ✅ Réduit l'exposition et limite l'abus de buckets privés.
-- =======================================================================

-- Idempotence: supprimer anciennes policies trop permissives
DROP POLICY IF EXISTS "Auth read avatars"   ON storage.objects;
DROP POLICY IF EXISTS "Auth insert avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth read chats"     ON storage.objects;
DROP POLICY IF EXISTS "Auth insert chats"   ON storage.objects;
DROP POLICY IF EXISTS "Auth read stories"   ON storage.objects;
DROP POLICY IF EXISTS "Auth insert stories" ON storage.objects;
DROP POLICY IF EXISTS "Auth read snaps"     ON storage.objects;
DROP POLICY IF EXISTS "Auth insert snaps"   ON storage.objects;

-- AVATARS
-- Lecture: uniquement authentifié, bucket avatars
CREATE POLICY "Auth read avatars"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
  );

-- Upload: uniquement dans son propre préfixe <uid>/...
CREATE POLICY "Auth insert avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- CHATS
CREATE POLICY "Auth read chats"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chats'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Auth insert chats"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chats'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- STORIES
CREATE POLICY "Auth read stories"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'stories'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Auth insert stories"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'stories'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- TEMPORARY SNAPS
CREATE POLICY "Auth read snaps"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'temporary_snaps'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Auth insert snaps"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'temporary_snaps'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Optionnel hardening futur:
-- - Ajouter UPDATE/DELETE uniquement owner prefix
-- - Ajouter purge serveur pour temporary_snaps expirés
