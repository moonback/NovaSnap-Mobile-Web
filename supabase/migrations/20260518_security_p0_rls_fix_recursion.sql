-- Security P0 fix: resolve infinite recursion in conversation_members RLS policy
-- Date: 2026-05-18
--
-- Root cause: the SELECT policy on conversation_members used a subquery that
-- re-queried conversation_members, causing infinite recursion when PostgREST
-- executed deeply nested joins (conversations → conversation_members → users).
--
-- Fix: SECURITY DEFINER helper function that bypasses RLS for the membership
-- check, breaking the recursion. All dependent policies are dropped via CASCADE
-- and recreated immediately after.

BEGIN;

-- ── 1. Drop the function CASCADE ─────────────────────────────────────────────
-- This also drops the 4 policies that depend on it:
--   • "Users can read conversation messages"      ON messages
--   • "Users can send messages"                   ON messages
--   • "Users can add members to conversations"    ON conversation_members
--   • "Users can view their conversations"        ON conversations
-- They are all recreated below.

DROP FUNCTION IF EXISTS public.is_conversation_member(uuid, uuid) CASCADE;


-- ── 2. Recreate the helper function with canonical parameter names ────────────
-- SECURITY DEFINER so it runs as the function owner (bypasses RLS on its own
-- SELECT), which is what breaks the recursion.
-- SET search_path = public prevents search-path injection.

CREATE FUNCTION public.is_conversation_member(
  p_conversation_id uuid,
  p_user_id         uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = p_user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO service_role;


-- ── 3. Ensure the supporting index exists ────────────────────────────────────
CREATE INDEX IF NOT EXISTS conversation_members_conv_user_idx
  ON public.conversation_members (conversation_id, user_id);


-- ── 4. Recreate conversation_members SELECT policy (was recursive) ────────────
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;

CREATE POLICY "Users can view members of their conversations"
ON public.conversation_members FOR SELECT
USING (
  public.is_conversation_member(conversation_id, auth.uid())
);

-- Keep the existing INSERT policy (unchanged)
DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_members;

CREATE POLICY "Users can join conversations"
ON public.conversation_members FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Recreate the INSERT policy that was dropped by CASCADE (if it existed)
DROP POLICY IF EXISTS "Users can add members to conversations" ON public.conversation_members;

CREATE POLICY "Users can add members to conversations"
ON public.conversation_members FOR INSERT
WITH CHECK (
  public.is_conversation_member(conversation_id, auth.uid())
  OR user_id = auth.uid()
);


-- ── 5. Recreate conversations SELECT policy ───────────────────────────────────
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

CREATE POLICY "Users can view their conversations"
ON public.conversations FOR SELECT
USING (
  public.is_conversation_member(id, auth.uid())
);


-- ── 6. Recreate messages policies ────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read conversation messages" ON public.messages;

CREATE POLICY "Users can read conversation messages"
ON public.messages FOR SELECT
USING (
  public.is_conversation_member(conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_conversation_member(conversation_id, auth.uid())
);

COMMIT;
