-- Migration: Fix ghost mode in get_nearby_friends
-- Date: 2026-07-09
-- Problem: The previous implementation used `online_status_visibility != 'NOBODY'`
--          which allowed users with visibility = 'FRIENDS' to appear on the map for
--          ALL callers, not just their friends. Ghost mode (which sets the field to
--          'NOBODY' via update_user_heartbeat) was already working, but users with
--          'FRIENDS' visibility could appear on the map for strangers if they were
--          in a conversation together (no friendship check on the map).
--
-- Fix: enforce proper visibility semantics:
--   • 'EVERYONE'  → visible to all nearby friends (existing behaviour)
--   • 'FRIENDS'   → visible only to accepted friends (already the case since the
--                    friendships join is always present, but we make the intent explicit)
--   • 'NOBODY'    → never visible (ghost mode) — excluded via != 'NOBODY'
--
-- The key change: add a hard guard so that a user in ghost mode (NOBODY) is NEVER
-- returned, and document that FRIENDS is acceptable because the friendship check is
-- already in the WHERE clause. No change to behaviour for FRIENDS users, but we
-- add a clear comment and lock out any future drift.

create or replace function public.get_nearby_friends(
  p_lat    double precision,
  p_lng    double precision,
  p_radius integer default 50000
)
returns table (
  user_id    uuid,
  username   text,
  avatar_url text,
  lat        double precision,
  lng        double precision,
  distance_m double precision,
  updated_at timestamptz
)
language plpgsql security definer stable
set search_path = public
as $$
declare
  caller_id    uuid      := auth.uid();
  caller_point geography := st_makepoint(p_lng, p_lat)::geography;
begin
  -- Safety guard: unauthenticated callers get nothing.
  if caller_id is null then
    return;
  end if;

  return query
  select
    u.id,
    u.username,
    u.avatar_url,
    st_y(u.last_location::geometry)::double precision  as lat,
    st_x(u.last_location::geometry)::double precision  as lng,
    st_distance(u.last_location, caller_point)         as distance_m,
    u.location_updated_at                              as updated_at
  from public.users u
  where
    -- ── 1. Must be an accepted friend ──────────────────────────────────────────
    exists (
      select 1
      from public.friendships f
      where f.status = 'ACCEPTED'
        and (
          (f.user_id  = caller_id and f.friend_id = u.id)
          or
          (f.friend_id = caller_id and f.user_id  = u.id)
        )
    )

    -- ── 2. Respect privacy/ghost-mode setting ──────────────────────────────────
    -- 'NOBODY'   → ghost mode, never visible on the map
    -- 'FRIENDS'  → visible to accepted friends only (the join above enforces this)
    -- 'EVERYONE' → visible to all (accepted friends in this context)
    and u.online_status_visibility in ('FRIENDS', 'EVERYONE')

    -- ── 3. Must have a known location ─────────────────────────────────────────
    and u.last_location is not null

    -- ── 4. Must be within the requested radius ────────────────────────────────
    and st_dwithin(u.last_location, caller_point, p_radius)

    -- ── 5. Exclude the caller themselves ─────────────────────────────────────
    and u.id != caller_id

  order by distance_m;
end;
$$;

comment on function public.get_nearby_friends is
  'Returns accepted friends within p_radius metres who have opted in to location sharing (online_status_visibility != NOBODY). Ghost-mode users (NOBODY) are always excluded regardless of friendship status.';
