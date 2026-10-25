-- =====================================================================
-- 0019 (25 Oct 2026, Angad): "aaj ek game night hui, kal phir hogi: dono
-- alag dikhne chahiye, aur Stumble ka overall rank bhi."
-- A game night is not stored: it is the IST date of a saved game, with the
-- day turning over at 06:00 so a 1 AM game still counts for the night
-- before. Every game gets:
--   * one board per night  = sum of that night's game points per player
--   * an Overall board     = every night of every event of that game, plus
--                            the ± points admins gave.
-- Boards rank players (a team's points count for each teammate), and only
-- the top 3, the caller's own row and the row just above it leave the
-- server, like player_rankings.
-- Safe to run twice.
-- =====================================================================

create or replace function public.night_of(p timestamptz) returns date
language sql immutable set search_path = '' as $$
  select ((p at time zone 'Asia/Kolkata') - interval '6 hours')::date
$$;

-- Games that have at least one saved game, newest first, with their nights.
create or replace function public.boards_index() returns jsonb
language sql stable security definer set search_path = '' as $$
  with m as (
    select t.game_id, mt.id, public.night_of(mt.played_at) as night, mt.played_at
    from public.matches mt
    join public.tournaments t on t.id = mt.tournament_id and t.status not in ('draft', 'cancelled')
  ), per_night as (
    select m.game_id, m.night, count(*) as games,
           (select count(distinct mm.user_id) from public.match_results r
              join public.entry_members mm on mm.entry_id = r.entry_id and mm.role <> 'sub'
              join m m2 on m2.id = r.match_id
             where m2.game_id = m.game_id and m2.night = m.night) as players
    from m group by m.game_id, m.night
  )
  select coalesce(jsonb_agg(g order by g->>'last_at' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'game_id', pn.game_id,
      'last_at', (select max(played_at) from m where m.game_id = pn.game_id),
      'nights', jsonb_agg(jsonb_build_object(
                  'night', pn.night,
                  'n', (select count(*) from per_night x where x.game_id = pn.game_id and x.night <= pn.night),
                  'games', pn.games, 'players', pn.players) order by pn.night desc)) as g
    from per_night pn group by pn.game_id
  ) s
$$;

-- One board: p_night null = Overall.
create or replace function public.game_board(p_game_id uuid, p_night date default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  with ev as (
    select t.id from public.tournaments t
    where t.game_id = p_game_id and t.status not in ('draft', 'cancelled')
  ), res as (
    select r.entry_id, r.points, r.placement, r.kills
    from public.match_results r
    join public.matches mt on mt.id = r.match_id and mt.tournament_id in (select id from ev)
    join public.entries e on e.id = r.entry_id and e.status = 'active'
    where p_night is null or public.night_of(mt.played_at) = p_night
  ), per_entry as (
    select e.id as entry_id,
           coalesce(sum(res.points), 0) + case when p_night is null then e.points_adjust else 0 end as points,
           count(res.entry_id) as games,
           count(*) filter (where res.placement = 1) as wins,
           coalesce(sum(res.kills), 0) as kills
    from public.entries e
    left join res on res.entry_id = e.id
    where e.tournament_id in (select id from ev) and e.status = 'active'
    group by e.id
    having count(res.entry_id) > 0 or (p_night is null and e.points_adjust <> 0)
  ), per_player as (
    select m.user_id, sum(pe.points) as points, sum(pe.games) as games, sum(pe.wins) as wins, sum(pe.kills) as kills
    from per_entry pe
    join public.entry_members m on m.entry_id = pe.entry_id and m.role <> 'sub'
    join public.profiles p on p.id = m.user_id and p.status <> 'banned'
    group by m.user_id
  ), ranked as (
    select rank() over (order by pp.points desc, pp.wins desc, pp.kills desc) as rnk, pp.*
    from per_player pp
  ), mine as (
    select rnk from ranked where user_id = auth.uid()
  )
  select jsonb_build_object(
    'total', (select count(*) from ranked),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rank', r.rnk, 'username', p.username, 'house_id', p.house_id,
               'avatar', coalesce(p.avatar, 'bottts:' || left(regexp_replace(lower(p.username), '[^a-z0-9]', '', 'g'), 16)),
               'points', round(r.points, 2), 'games', r.games, 'wins', r.wins,
               'is_me', coalesce(p.id = auth.uid(), false))
             order by r.rnk, p.username)
      from ranked r join public.profiles p on p.id = r.user_id
      where r.rnk <= 3 or p.id = auth.uid()
         or r.rnk = (select max(x.rnk) from ranked x where x.rnk < (select rnk from mine))
    ), '[]'::jsonb))
$$;

revoke execute on function public.night_of(timestamptz), public.boards_index(), public.game_board(uuid, date) from public;
grant execute on function public.night_of(timestamptz), public.boards_index(), public.game_board(uuid, date) to anon, authenticated;
