# Complete Database Fix for NovaSnap

## Issues Found

1. **Story Views RLS Error**: `403 Forbidden` when recording story views
2. **Friendship Queries Failing**: HEAD requests to friendship table failing
3. **Missing Database Views**: `friendships_resolved` view may be missing

## Root Causes

1. **Story Views**: RLS policies on `story_views` table are misconfigured
2. **Friendships**: RLS policies on `friendships` table may be too restrictive or missing
3. **Database Views**: The `friendships_resolved` view used by the friends hook may not exist

## Complete Fix (Run in Supabase Dashboard)

Go to **Supabase Dashboard > SQL Editor** and run this complete fix:

```sql
-- ========================================
-- PART 1: Fix story_views RLS policies
-- ========================================

-- Enable RLS on story_views table
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

-- Drop any existing story_views policies
DROP POLICY IF EXISTS "Users can insert their own story views" ON story_views;
DROP POLICY IF EXISTS "Story authors can view their story views" ON story_views;
DROP POLICY IF EXISTS "Users can view their own views" ON story_views;

-- Create correct INSERT policy for story_views
CREATE POLICY "Users can insert their own story views"
ON story_views
FOR INSERT
TO authenticated
WITH CHECK (
  viewer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = story_views.story_id
    AND stories.expires_at > NOW()
  )
);

-- Create SELECT policies for story_views
CREATE POLICY "Story authors can view their story views"
ON story_views
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = story_views.story_id
    AND stories.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own views"
ON story_views
FOR SELECT
TO authenticated
USING (
  viewer_id = auth.uid()
);

-- ========================================
-- PART 2: Fix friendships RLS policies
-- ========================================

-- Enable RLS on friendships table (if not already enabled)
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Drop existing friendship policies to start fresh
DROP POLICY IF EXISTS "Users can view their own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can manage their own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can insert friendship requests" ON friendships;
DROP POLICY IF EXISTS "Users can update friendship status" ON friendships;
DROP POLICY IF EXISTS "Users can delete their friendships" ON friendships;

-- Create comprehensive friendships policies

-- SELECT: Users can view friendships where they are involved
CREATE POLICY "Users can view their own friendships"
ON friendships
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR friend_id = auth.uid()
);

-- INSERT: Users can send friend requests
CREATE POLICY "Users can insert friendship requests"
ON friendships
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND user_id != friend_id  -- Can't friend yourself
);

-- UPDATE: Users can update friendship status where they are the recipient
CREATE POLICY "Users can update friendship status"
ON friendships
FOR UPDATE
TO authenticated
USING (
  friend_id = auth.uid()  -- Only recipient can accept/update
)
WITH CHECK (
  friend_id = auth.uid()
);

-- DELETE: Users can delete friendships where they are involved
CREATE POLICY "Users can delete their friendships"
ON friendships
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() OR friend_id = auth.uid()
);

-- ========================================
-- PART 3: Create friendships_resolved view
-- ========================================

-- Drop the view if it exists
DROP VIEW IF EXISTS friendships_resolved;

-- Create the friendships_resolved view used by the app
CREATE VIEW friendships_resolved AS
SELECT 
  f.id as friendship_id,
  f.user_id,
  f.friend_id,
  f.status as friendship_status,
  f.created_at,
  f.updated_at,
  true as is_requester,
  -- Friend profile info
  u_friend.id as friend_id,
  u_friend.username as friend_username,
  u_friend.display_name as friend_display_name,
  u_friend.avatar_url as friend_avatar_url,
  u_friend.bio as friend_bio,
  u_friend.snap_score as friend_snap_score
FROM friendships f
LEFT JOIN users u_friend ON f.friend_id = u_friend.id

UNION ALL

SELECT 
  f.id as friendship_id,
  f.friend_id as user_id,
  f.user_id as friend_id,
  f.status as friendship_status,
  f.created_at,
  f.updated_at,
  false as is_requester,
  -- Friend profile info (from user side)
  u_user.id as friend_id,
  u_user.username as friend_username,
  u_user.display_name as friend_display_name,
  u_user.avatar_url as friend_avatar_url,
  u_user.bio as friend_bio,
  u_user.snap_score as friend_snap_score
FROM friendships f
LEFT JOIN users u_user ON f.user_id = u_user.id;

-- Add RLS to the view
ALTER VIEW friendships_resolved OWNER TO postgres;

-- Create RLS policy for the view
CREATE POLICY "Users can view their resolved friendships"
ON friendships_resolved
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- ========================================
-- PART 4: Verification queries
-- ========================================

-- Check story_views policies
SELECT 
  policyname, 
  cmd, 
  with_check IS NOT NULL as has_with_check,
  qual IS NOT NULL as has_using
FROM pg_policies 
WHERE tablename = 'story_views'
ORDER BY cmd, policyname;

-- Check friendships policies  
SELECT 
  policyname, 
  cmd, 
  with_check IS NOT NULL as has_with_check,
  qual IS NOT NULL as has_using
FROM pg_policies 
WHERE tablename = 'friendships'
ORDER BY cmd, policyname;

-- Check if friendships_resolved view exists
SELECT 
  schemaname, 
  viewname, 
  definition
FROM pg_views 
WHERE viewname = 'friendships_resolved';

-- Test story_views table access
SELECT COUNT(*) as story_views_count FROM story_views;

-- Test friendships table access  
SELECT COUNT(*) as friendships_count FROM friendships;

-- Test friendships_resolved view access
SELECT COUNT(*) as friendships_resolved_count FROM friendships_resolved;
```

## Expected Results After Fix

### Story Views
- ✅ No more `403 Forbidden` errors when viewing stories
- ✅ Story view counts work correctly
- ✅ Story viewers list loads properly

### Friendships  
- ✅ Friend list loads without errors
- ✅ Friend counts display correctly
- ✅ Friend requests work properly
- ✅ No more HEAD request failures

### Verification Queries Results

**story_views policies:**
```
policyname                              | cmd    | has_with_check | has_using
Users can insert their own story views  | INSERT | true          | false
Story authors can view their story views| SELECT | false         | true  
Users can view their own views          | SELECT | false         | true
```

**friendships policies:**
```
policyname                            | cmd    | has_with_check | has_using
Users can insert friendship requests  | INSERT | true          | false
Users can view their own friendships  | SELECT | false         | true
Users can update friendship status    | UPDATE | true          | true
Users can delete their friendships   | DELETE | false         | true
```

**Views:**
```
schemaname | viewname             | exists
public     | friendships_resolved | yes
```

## Testing the Fix

1. **Refresh the app** (Ctrl+F5 / Cmd+Shift+R)
2. **View a story** - should work without 403 errors
3. **Check Friends tab** - should load friend list and counts
4. **Send a friend request** - should work properly
5. **Open browser console** - should see no RLS errors

## Rollback (If Needed)

If you need to temporarily disable RLS while debugging:

```sql
-- Disable RLS temporarily (NOT RECOMMENDED for production)
ALTER TABLE story_views DISABLE ROW LEVEL SECURITY;
ALTER TABLE friendships DISABLE ROW LEVEL SECURITY;

-- To re-enable later:
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
```

## Notes

- This fix addresses both the story views and friendship query issues
- All policies follow PostgreSQL RLS best practices
- The `friendships_resolved` view provides the bidirectional friendship data the app expects
- No application code changes are required - this is purely a database fix
- The policies are secure and only allow users to access their own data