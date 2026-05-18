-- =======================================================================
-- NOVASNAP — MIGRATION V7 (Storage owner update/delete hardening)
-- ✅ Restreint UPDATE/DELETE des objets storage au propriétaire du préfixe
--    <auth.uid()>/... pour tous les buckets privés NovaSnap.
-- =======================================================================

DROP POLICY IF EXISTS "Auth update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth update chats" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete chats" ON storage.objects;
DROP POLICY IF EXISTS "Auth update stories" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete stories" ON storage.objects;
DROP POLICY IF EXISTS "Auth update snaps" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete snaps" ON storage.objects;

CREATE POLICY "Auth update avatars"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Auth delete avatars"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Auth update chats"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'chats'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'chats'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Auth delete chats"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chats'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Auth update stories"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'stories'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'stories'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Auth delete stories"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'stories'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Auth update snaps"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'temporary_snaps'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'temporary_snaps'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Auth delete snaps"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'temporary_snaps'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
