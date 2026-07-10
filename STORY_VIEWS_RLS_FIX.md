# Story Views RLS Fix

## Issue
The application is showing this error:
```
POST https://ivaevasbinqcswgwdipa.supabase.co/rest/v1/story_views 403 (Forbidden)
Error: new row violates row-level security policy (USING expression) for table "story_views"
```

This happens when users try to view stories, as the app attempts to record the view in the `story_views` table.

## Root Cause
The Row Level Security (RLS) policies on the `story_views` table are either:
1. Missing INSERT policies
2. Have incorrect INSERT policy configuration (using `USING` instead of `WITH CHECK`)
3. Have overly restrictive conditions

## Solution

### Step 1: Manual SQL Fix (Run in Supabase Dashboard)

Go to **Supabase Dashboard > SQL Editor** and run this SQL:

```sql
-- Enable RLS on story_views table
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Users can insert their own story views" ON story_views;
DROP POLICY IF EXISTS "Story authors can view their story views" ON story_views;
DROP POLICY IF EXISTS "Users can view their own views" ON story_views;

-- Create correct INSERT policy with WITH CHECK clause
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

-- Create SELECT policy for story authors to see who viewed their stories
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

-- Create SELECT policy for users to see their own viewing history
CREATE POLICY "Users can view their own views"
ON story_views
FOR SELECT
TO authenticated
USING (
  viewer_id = auth.uid()
);

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'story_views';
```

### Step 2: Test the Fix

After running the SQL:

1. **Refresh your app** (hard refresh with Ctrl+F5)
2. **View a story** - the 403 error should be gone
3. **Check browser console** - no more RLS policy violation errors

### Step 3: Verify Fix (Optional)

Run this query to confirm policies exist:

```sql
SELECT policyname, cmd, with_check IS NOT NULL as has_with_check 
FROM pg_policies 
WHERE tablename = 'story_views';
```

Expected output:
```
policyname                           | cmd    | has_with_check
Users can insert their own story views | INSERT | true
Story authors can view their story views | SELECT | false  
Users can view their own views          | SELECT | false
```

## Why This Fixes It

1. **Correct INSERT syntax**: Uses `WITH CHECK` instead of `USING` for INSERT operations
2. **Proper authentication**: Ensures only authenticated users can insert
3. **Ownership validation**: Users can only record views for themselves (`viewer_id = auth.uid()`)
4. **Story validation**: Only allows viewing active stories that haven't expired
5. **Separate SELECT policies**: Allows story authors to see viewers and users to see their history

## Key Differences from Before

- **INSERT policies use `WITH CHECK`** (not `USING`)
- **SELECT policies use `USING`** (not `WITH CHECK`)  
- **More granular permissions** for viewing vs inserting
- **Story expiration check** to prevent views on expired content

## Rollback (If Needed)

If you need to rollback:

```sql
-- Disable RLS completely (temporary)
ALTER TABLE story_views DISABLE ROW LEVEL SECURITY;

-- Or drop all policies
DROP POLICY IF EXISTS "Users can insert their own story views" ON story_views;
DROP POLICY IF EXISTS "Story authors can view their story views" ON story_views;
DROP POLICY IF EXISTS "Users can view their own views" ON story_views;
```

## Additional Notes

- This fix is based on the migration file `scripts/migrations/fix_story_views_rls.sql`
- The policies follow PostgreSQL RLS best practices
- No application code changes needed - this is a database-only fix