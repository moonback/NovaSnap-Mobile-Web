-- Security P0 hardening
-- Date: 2026-05-18

BEGIN;

-- 1) conversation_members: strict select policy (only members of the same conversation)
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;

CREATE POLICY "Users can view members of their conversations"
ON public.conversation_members
FOR SELECT
USING (
  conversation_id IN (
    SELECT cm.conversation_id
    FROM public.conversation_members cm
    WHERE cm.user_id = auth.uid()
  )
);

-- 2) Storage hardening: enforce per-user path prefix "<auth.uid()>/..."
-- Remove permissive policies if present
DROP POLICY IF EXISTS "Auth read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth insert avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth read chats" ON storage.objects;
DROP POLICY IF EXISTS "Auth insert chats" ON storage.objects;
DROP POLICY IF EXISTS "Auth read stories" ON storage.objects;
DROP POLICY IF EXISTS "Auth insert stories" ON storage.objects;
DROP POLICY IF EXISTS "Auth read snaps" ON storage.objects;
DROP POLICY IF EXISTS "Auth insert snaps" ON storage.objects;

-- Avatars
CREATE POLICY "User scoped read avatars"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "User scoped insert avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- Chats
CREATE POLICY "User scoped read chats"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chats'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "User scoped insert chats"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chats'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- Stories
CREATE POLICY "User scoped read stories"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'stories'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "User scoped insert stories"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'stories'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- Temporary snaps
CREATE POLICY "User scoped read snaps"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'temporary_snaps'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "User scoped insert snaps"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'temporary_snaps'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) = auth.uid()::text
);

COMMIT;
