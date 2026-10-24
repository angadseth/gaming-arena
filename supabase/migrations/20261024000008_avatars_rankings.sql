-- =====================================================================
-- Profile pictures (picked from generated avatars, never uploaded) and
-- the overall player rankings with top-three podiums.
-- Player points: every completed event awards placement points from its
-- house_points table (1st 10, 2nd 7, 3rd 5 ...). Each non-sub member of
-- the entry gets the full amount (house points are split; player points
-- are not, because every player on a winning team won).
-- =====================================================================

-- "<style>:<seed>", e.g. "bottts:k7q2". Null = default avatar from the username.
alter table public.profiles add column avatar text
  check (avatar is null or avatar ~ '^(bottts|pixel-art|lorelei|thumbs):[a-z0-9]{1,16}$');

create function public.set_my_avatar(p_avatar text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_player();
  v  text := nullif(lower(btrim(coalesce(p_avatar, ''))), '');
begin
  if v is not null and v !~ '^(bottts|pixel-art|lorelei|thumbs):[a-z0-9]{1,16}$' then
    raise exception 'Pick one of the avatars shown' using errcode = 'P0001', hint = 'BAD_INPUT';
  end if;
  if v is not distinct from me.avatar then
    return;
  end if;
  perform public.throttle('avatar', 20, interval '1 day');
  update public.profiles set avatar = v where id = me.id;
end $$;

create or replace function public.get_my_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'email', p.email, 'username', p.username, 'full_name', p.full_name,
    'house_id', p.house_id, 'region_id', p.region_id, 'whatsapp', p.whatsapp,
    'status', p.status, 'created_at', p.created_at, 'avatar', p.avatar,
    'username_next_change', case when p.username_changed_at is null then null
                                 else p.username_changed_at + interval '30 days' end,
    'roles', coalesce((select jsonb_agg(r.role) from public.user_roles r where r.user_id = p.id), '[]'))
  from public.profiles p where p.id = auth.uid()
$$;

-- Standings now also return the captain's avatar (used by the podium cards).
drop function public.tournament_standings(uuid);
create function public.tournament_standings(p_tournament_id uuid)
returns table (
  rank bigint, entry_id uuid, name text, house_id smallint, members jsonb,
  points numeric, matches bigint, wins bigint, kills bigint, best_placement smallint,
  status text, is_mine boolean, avatar text
)
language sql stable security definer set search_path = '' as $$
  with t as (
    select * from public.tournaments where id = p_tournament_id and (status <> 'draft' or public.is_staff())
  ), agg as (
    select e.id, e.name, e.house_id, e.status, e.captain_id,
           coalesce(sum(r.points), 0) + e.points_adjust as points,
           count(r.match_id) as matches,
           count(*) filter (where r.placement = 1) as wins,
           coalesce(sum(r.kills), 0) as kills,
           min(r.placement) as best_placement
    from public.entries e
    join t on t.id = e.tournament_id
    left join public.match_results r on r.entry_id = e.id
    group by e.id
  )
  select
    case when a.status = 'active'
         then rank() over (partition by a.status = 'active'
                           order by a.points desc, a.wins desc, a.kills desc, a.best_placement asc nulls last)
    end,
    a.id, a.name, a.house_id,
    (select jsonb_agg(jsonb_build_object('username', p.username, 'role', m.role) order by m.role, p.username)
       from public.entry_members m join public.profiles p on p.id = m.user_id where m.entry_id = a.id),
    a.points, a.matches, a.wins, a.kills, a.best_placement, a.status,
    exists (select 1 from public.entry_members m where m.entry_id = a.id and m.user_id = auth.uid()),
    coalesce((select c.avatar from public.profiles c where c.id = a.captain_id),
             'bottts:' || left(regexp_replace(lower((select c.username from public.profiles c where c.id = a.captain_id)), '[^a-z0-9]', '', 'g'), 16))
  from agg a
  order by a.status = 'active' desc, a.points desc, a.wins desc, a.kills desc, a.best_placement asc nulls last, a.name
$$;

-- Overall player rankings. p_format: 'solo' (1 player), 'small' (2-3 players),
-- 'squad' (4 or more), anything else = all games. Returns the top 100 plus
-- the signed-in player's own row wherever they are.
create function public.player_rankings(p_format text default 'all', p_season text default null)
returns table (
  rank bigint, username text, avatar text, house_id smallint,
  points numeric, events bigint, podiums bigint, firsts bigint, is_me boolean
)
language sql stable security definer set search_path = '' as $$
  with done as (
    select t.id, t.house_points
    from public.tournaments t join public.games g on g.id = t.game_id
    where t.status = 'completed' and (p_season is null or t.season = p_season)
      and case p_format
            when 'solo' then g.team_size = 1
            when 'small' then g.team_size between 2 and 3
            when 'squad' then g.team_size >= 4
            else true
          end
  ), agg as (
    select e.id as entry_id, e.tournament_id,
           coalesce(sum(r.points), 0) + e.points_adjust as points,
           count(*) filter (where r.placement = 1) as wins,
           coalesce(sum(r.kills), 0) as kills, min(r.placement) as best
    from public.entries e join done d on d.id = e.tournament_id
    left join public.match_results r on r.entry_id = e.id
    where e.status = 'active' group by e.id
  ), placed as (
    select a.tournament_id, a.entry_id,
           rank() over (partition by a.tournament_id
                        order by a.points desc, a.wins desc, a.kills desc, a.best asc nulls last) as rnk
    from agg a
  ), scored as (
    select pl.entry_id, pl.rnk, coalesce(public.points_for_rank(d.house_points, pl.rnk::int), 0) as pts
    from placed pl join done d on d.id = pl.tournament_id
  ), per as (
    select m.user_id, sum(s.pts) as points, count(*) as events,
           count(*) filter (where s.rnk <= 3) as podiums, count(*) filter (where s.rnk = 1) as firsts
    from scored s
    join public.entry_members m on m.entry_id = s.entry_id and m.role <> 'sub'
    join public.profiles p on p.id = m.user_id and p.status <> 'banned'
    group by m.user_id
  ), ranked as (
    select rank() over (order by per.points desc, per.firsts desc, per.podiums desc) as rnk, per.*
    from per
  )
  select r.rnk, p.username,
         coalesce(p.avatar, 'bottts:' || left(regexp_replace(lower(p.username), '[^a-z0-9]', '', 'g'), 16)),
         p.house_id, round(r.points, 2), r.events, r.podiums, r.firsts,
         coalesce(p.id = auth.uid(), false)
  from ranked r join public.profiles p on p.id = r.user_id
  where r.rnk <= 100 or p.id = auth.uid()
  order by r.rnk, p.username
$$;

grant execute on function public.tournament_standings(uuid), public.player_rankings(text, text) to anon, authenticated;
revoke all on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
