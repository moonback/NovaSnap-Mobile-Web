BEGIN;

-- Allow users to leave conversations
DROP POLICY IF EXISTS "Users can leave conversations" ON public.conversation_members;

CREATE POLICY "Users can leave conversations"
ON public.conversation_members FOR DELETE
USING (user_id = auth.uid());

COMMIT;
