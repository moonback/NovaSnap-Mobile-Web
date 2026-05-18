-- ============================================================
-- NovaSnap Migration v10 — Friends System
-- Safe to run multiple times (idempotent)
-- ============================================================

-- 1. Add bio column to users if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'bio'
  ) THEN
    ALTER TABLE public.users ADD COLUMN bio TEXT;
  END IF;
END $$;

-- 2. Add snap_score column to users if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'snap_score'
  ) THEN
    ALTER TABLE public.users ADD COLUMN snap_score BIGINT DEFAULT 0;
  END IF;
END $$;

-- 3. Add friendships table to realtime publication
-- First ensure the publication exists, then add the table
DO $$
BEGIN
  -- Add friendships to the existing supabase_realtime publication if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'friendships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  END IF;
END $$;

-- 4. Add RLS DELETE policy for friendships if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'friendships'
      AND policyname = 'Users can delete their own friendships'
  ) THEN
    CREATE POLICY "Users can delete their own friendships"
    ON public.friendships FOR DELETE
    USING (user_id = auth.uid() OR friend_id = auth.uid());
  END IF;
END $$;

-- 5. Add index on friendships(status) if not exists
CREATE INDEX IF NOT EXISTS idx_friendships_status
  ON public.friendships(status);

-- 6. DB function: get_friend_count
CREATE OR REPLACE FUNCTION public.get_friend_count(user_uuid UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::BIGINT
  FROM public.friendships
  WHERE status = 'ACCEPTED'
    AND (user_id = user_uuid OR friend_id = user_uuid);
$$;

-- 7. DB function: get_pending_requests_count
CREATE OR REPLACE FUNCTION public.get_pending_requests_count(user_uuid UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::BIGINT
  FROM public.friendships
  WHERE status = 'PENDING'
    AND friend_id = user_uuid;
$$;
