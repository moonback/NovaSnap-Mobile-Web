-- Security P0 follow-up: fix storage policies to preserve product behavior while keeping strict access controls
-- Date: 2026-05-18

BEGIN;

-- Drop previous user-scoped policies introduced in 20260518_security_p0_rls_storage.sql
DROP POLICY IF EXISTS "User scoped read avatars" ON storage.objects;
DROP POLICY IF EXISTS "User scoped insert avatars" ON storage.objects;
DROP POLICY IF EXISTS "User scoped read chats" ON storage.objects;
DROP POLICY IF EXISTS "User scoped insert chats" ON storage.objects;
DROP POLICY IF EXISTS "User scoped read stories" ON storage.objects;
DROP POLICY IF EXISTS "User scoped insert stories" ON storage.objects;
DROP POLICY IF EXISTS "User scoped read snaps" ON storage.objects;
DROP POLICY IF EXISTS "User scoped insert snaps" ON storage.objects;

-- Avatars: everyone authenticated can read avatars, only owner can upload under <uid>/...
CREATE POLICY "Authenticated read avatars"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "User scoped insert avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- Chats: object path must be chats/<conversation_id>/<sender_user_id>/<file>
-- Read/insert requires membership in conversation.
CREATE POLICY "Conversation member read chats"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chats'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id::text = split_part(name, '/', 1)
      AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Conversation member insert chats"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chats'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id::text = split_part(name, '/', 1)
      AND cm.user_id = auth.uid()
  )
);

-- Stories: all authenticated users can read active story media; only owner can upload under <uid>/...
CREATE POLICY "Authenticated read stories"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'stories'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "User scoped insert stories"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'stories'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- Temporary snaps: same model as chats for ephemeral media exchange
-- object path: temporary_snaps/<conversation_id>/<sender_user_id>/<file>
CREATE POLICY "Conversation member read snaps"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'temporary_snaps'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id::text = split_part(name, '/', 1)
      AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Conversation member insert snaps"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'temporary_snaps'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id::text = split_part(name, '/', 1)
      AND cm.user_id = auth.uid()
  )
);

COMMIT;
