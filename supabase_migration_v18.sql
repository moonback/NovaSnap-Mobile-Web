-- ========== MIGRATION V18: RESOLVED FRIENDSHIPS VIEW ==========
-- Projects friendships so they can be queried by a single user_id field
-- with the friend's profile pre-joined.

CREATE OR REPLACE VIEW public.friendships_resolved 
WITH (security_invoker = on) AS
SELECT 
  f.id AS friendship_id,
  f.status AS friendship_status,
  f.created_at,
  f.updated_at,
  f.user_id AS requester_id,
  f.friend_id AS recipient_id,
  -- Perspective of user_id (requester)
  f.user_id AS user_id,
  f.friend_id AS friend_id,
  true AS is_requester,
  u_friend.username AS friend_username,
  u_friend.display_name AS friend_display_name,
  u_friend.avatar_url AS friend_avatar_url,
  u_friend.bio AS friend_bio,
  u_friend.snap_score AS friend_snap_score
FROM public.friendships f
LEFT JOIN public.users u_friend ON f.friend_id = u_friend.id
UNION ALL
SELECT 
  f.id AS friendship_id,
  f.status AS friendship_status,
  f.created_at,
  f.updated_at,
  f.user_id AS requester_id,
  f.friend_id AS recipient_id,
  -- Perspective of friend_id (recipient)
  f.friend_id AS user_id,
  f.user_id AS friend_id,
  false AS is_requester,
  u_user.username AS friend_username,
  u_user.display_name AS friend_display_name,
  u_user.avatar_url AS friend_avatar_url,
  u_user.bio AS friend_bio,
  u_user.snap_score AS friend_snap_score
FROM public.friendships f
LEFT JOIN public.users u_user ON f.user_id = u_user.id;
