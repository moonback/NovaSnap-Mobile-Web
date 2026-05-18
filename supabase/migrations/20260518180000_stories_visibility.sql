-- Add visibility column to stories
ALTER TABLE public.stories 
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'friends' 
  CHECK (visibility IN ('everyone', 'friends', 'private'));

-- Enable RLS on stories if not already enabled
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Drop old select policy if exists
DROP POLICY IF EXISTS "Users can view stories based on visibility" ON public.stories;
DROP POLICY IF EXISTS "Anyone can view active stories" ON public.stories;

-- Create SELECT policy enforcing visibility rules
CREATE POLICY "Users can view stories based on visibility"
ON public.stories FOR SELECT
USING (
  user_id = auth.uid() -- Can see own stories
  OR visibility = 'everyone' -- Can see public stories
  OR (
    visibility = 'friends'
    AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'ACCEPTED'
        AND ((f.user_id = auth.uid() AND f.friend_id = stories.user_id)
          OR (f.friend_id = auth.uid() AND f.user_id = stories.user_id))
    )
  )
);

-- Drop old insert policy if exists
DROP POLICY IF EXISTS "Users can insert their own stories" ON public.stories;

-- Create INSERT policy
CREATE POLICY "Users can insert their own stories"
ON public.stories FOR INSERT
WITH CHECK (user_id = auth.uid());
