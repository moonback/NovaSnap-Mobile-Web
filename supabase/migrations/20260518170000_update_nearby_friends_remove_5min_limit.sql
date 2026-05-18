create or replace function public.get_nearby_friends(
  p_lat    double precision,
  p_lng    double precision,
  p_radius integer default 50000
)
returns table (
  user_id    uuid, username text, avatar_url text,
  lat        double precision, lng double precision,
  distance_m double precision, updated_at timestamptz
)
language plpgsql security definer stable
set search_path = public as $$
declare
  caller_id    uuid      := auth.uid();
  caller_point geography := st_makepoint(p_lng, p_lat)::geography;
begin
  return query
  select
    u.id, u.username, u.avatar_url,
    st_y(u.last_location::geometry)::double precision,
    st_x(u.last_location::geometry)::double precision,
    st_distance(u.last_location, caller_point),
    u.location_updated_at
  from public.users u
  where exists (
      select 1 from public.friendships f
      where f.status = 'ACCEPTED'
        and ((f.user_id = caller_id and f.friend_id = u.id)
          or (f.friend_id = caller_id and f.user_id = u.id))
    )
    and u.online_status_visibility != 'NOBODY'
    and u.last_location is not null
    and st_dwithin(u.last_location, caller_point, p_radius)
    and u.id != caller_id
  order by distance_m;
end;
$$;
