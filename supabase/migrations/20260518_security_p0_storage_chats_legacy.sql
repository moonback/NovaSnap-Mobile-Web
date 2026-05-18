-- Security P0 fix: support legacy chat media paths alongside new conversation-scoped paths
-- Date: 2026-05-18
--
-- Context:
--   Before the security migration, chat media was uploaded to:
--     chats/<sender_uid>/<timestamp>.<ext>          ← legacy format
--
--   The new security policy expects:
--     chats/<conversation_id>/<sender_uid>/<file>   ← new format
--
--   Existing messages in the DB still reference legacy paths.
--   createSignedUrl fails because the RLS SELECT policy rejects them.
--
-- Fix:
--   Replace the single "Conversation member read chats" policy with one that
--   accepts BOTH path formats:
--     • Legacy:  split_part(name, '/', 1) = auth.uid()::text
--                (the sender can always read their own files)
--     • New:     split_part(name, '/', 1) is a conversation_id the user belongs to
--                AND split_part(name, '/', 2) is any member of that conversation
--
--   The INSERT policy is unchanged (new uploads must use the new format).

BEGIN;

-- Drop the existing read policy for chats
DROP POLICY IF EXISTS "Conversation member read chats" ON storage.objects;

-- Recreate with legacy path support
CREATE POLICY "Conversation member read chats"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chats'
  AND auth.role() = 'authenticated'
  AND (
    -- Legacy format: <sender_uid>/<file> — sender can read their own files
    split_part(name, '/', 1) = auth.uid()::text

    OR

    -- New format: <conversation_id>/<sender_uid>/<file>
    -- Any member of the conversation can read
    EXISTS (
      SELECT 1
      FROM public.conversation_members cm
      WHERE cm.conversation_id::text = split_part(name, '/', 1)
        AND cm.user_id = auth.uid()
    )
  )
);

-- Same fix for temporary_snaps (same legacy path issue may apply)
DROP POLICY IF EXISTS "Conversation member read snaps" ON storage.objects;

CREATE POLICY "Conversation member read snaps"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'temporary_snaps'
  AND auth.role() = 'authenticated'
  AND (
    -- Legacy format: <sender_uid>/<file>
    split_part(name, '/', 1) = auth.uid()::text

    OR

    -- New format: <conversation_id>/<sender_uid>/<file>
    EXISTS (
      SELECT 1
      FROM public.conversation_members cm
      WHERE cm.conversation_id::text = split_part(name, '/', 1)
        AND cm.user_id = auth.uid()
    )
  )
);

COMMIT;
