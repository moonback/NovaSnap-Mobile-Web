create extension if not exists postgis;

alter table public.users
  add column if not exists last_location geography(Point, 4326),
  add column if not exists location_updated_at timestamptz,
  add column if not exists online_status_visibility text
    not null default 'FRIENDS'
    check (online_status_visibility in ('EVERYONE','FRIENDS','NOBODY'));

create index if not exists idx_users_location
  on public.users using gist(last_location);

create or replace function public.update_user_heartbeat(
  p_lat   double precision default null,
  p_lng   double precision default null,
  p_ghost boolean default false
)
returns void language plpgsql security definer
set search_path = public as $$
begin
  update public.users set
    last_seen_at = now(),
    last_location = case
      when p_ghost or p_lat is null or p_lng is null then null
      else st_makepoint(p_lng, p_lat)::geography
    end,
    location_updated_at = case
      when p_ghost or p_lat is null then null
      else now()
    end,
    online_status_visibility = case
      when p_ghost then 'NOBODY' else 'FRIENDS'
    end
  where id = auth.uid();
end;
$$;

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
    and u.location_updated_at > now() - interval '5 minutes'
    and st_dwithin(u.last_location, caller_point, p_radius)
    and u.id != caller_id
  order by distance_m;
end;
$$;
