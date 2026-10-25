-- =====================================================================
-- 0017 (25 Oct 2026, Angad's report): "points change karne ke baad bhi
-- houses upar niche nahi ja rahe".
-- Cause: house_standings and player_rankings counted only events with
-- status 'completed', and admins can only open/close events, so every
-- result in a running event stayed invisible (all houses on 0).
-- Fix:
-- 1. Both count every open, closed, live or completed event, so houses and
--    Top players move the moment a result or a ± point is saved.
-- 2. Only entries that actually scored (a result row or a ± adjustment)
--    are ranked. Before, every registered no-show tied at the bottom and
--    each one still took that rank's house points.
-- 3. The WhatsApp number is optional (he asked: don't ask for the mobile
--    number at sign-up). It can still be added from the profile.
-- Safe to run twice.
-- =====================================================================

-- 3. Optional WhatsApp ------------------------------------------------
alter table public.profiles alter column whatsapp drop not null;

create or replace function public.normalize_whatsapp(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  d text := regexp_replace(coalesce(p, ''), '[\s()-]', '', 'g');
begin
  if d = '' then
    return null;
  elsif d ~ '^[6-9][0-9]{9}$' then
    return '+91' || d;
  elsif d ~ '^(0|91)[6-9][0-9]{9}$' then
    return '+91' || right(d, 10);
  elsif d ~ '^\+[1-9][0-9]{7,14}$' then
    return d;
  end if;
  raise exception 'Enter a valid WhatsApp number' using errcode = 'P0001', hint = 'BAD_WHATSAPP';
end $$;

-- 1 + 2. House standings ----------------------------------------------
create or replace function public.house_standings(p_season text default null)
returns table (rank bigint, house_id smallint, points numeric, podiums bigint, players bigint)
language sql stable security definer set search_path = '' as $$
  with done as (
    select id, house_points from public.tournaments
    where status in ('open', 'closed', 'live', 'completed') and (p_season is null or season = p_season)
  ), agg as (
    select e.id as entry_id, e.tournament_id,
           coalesce(sum(r.points), 0) + e.points_adjust as points,
           count(*) filter (where r.placement = 1) as wins,
           coalesce(sum(r.kills), 0) as kills, min(r.placement) as best
    from public.entries e join done d on d.id = e.tournament_id
    left join public.match_results r on r.entry_id = e.id
    where e.status = 'active' group by e.id
    having count(r.entry_id) > 0 or e.points_adjust <> 0
  ), placed as (
    select a.tournament_id, a.entry_id,
           rank() over (partition by a.tournament_id
                        order by a.points desc, a.wins desc, a.kills desc, a.best asc nulls last) as rnk
    from agg a
  ), scored as (
    select pl.tournament_id, pl.entry_id, pl.rnk, public.points_for_rank(d.house_points, pl.rnk::int) as pts
    from placed pl join done d on d.id = pl.tournament_id
  ), shares as (
    select p.house_id, s.rnk, s.pts / count(*) over (partition by s.tournament_id, s.entry_id) as share
    from scored s
    join public.entry_members m on m.entry_id = s.entry_id and m.role <> 'sub'
    join public.profiles p on p.id = m.user_id
  ), pts as (
    select house_id, sum(share) as points, count(*) filter (where rnk <= 3) as podiums
    from shares group by house_id
  ), ppl as (
    select p.house_id, count(distinct m.user_id) as players
    from agg a join public.entry_members m on m.entry_id = a.entry_id
    join public.profiles p on p.id = m.user_id group by p.house_id
  )
  select rank() over (order by coalesce(pts.points, 0) desc), h.id, round(coalesce(pts.points, 0), 2),
         coalesce(pts.podiums, 0), coalesce(ppl.players, 0)
  from public.houses h left join pts on pts.house_id = h.id left join ppl on ppl.house_id = h.id
  order by 1, h.name
$$;

-- 1 + 2. Top players --------------------------------------------------
create or replace function public.player_rankings(p_format text default 'all', p_season text default null)
returns table (
  rank bigint, username text, avatar text, house_id smallint,
  points numeric, events bigint, podiums bigint, firsts bigint, is_me boolean, total bigint
)
language sql stable security definer set search_path = '' as $$
  with done as (
    select t.id, t.house_points
    from public.tournaments t join public.games g on g.id = t.game_id
    where t.status in ('open', 'closed', 'live', 'completed') and (p_season is null or t.season = p_season)
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
    having count(r.entry_id) > 0 or e.points_adjust <> 0
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
         coalesce(p.id = auth.uid(), false), (select count(*) from ranked)
  from ranked r join public.profiles p on p.id = r.user_id
  where r.rnk <= 3 or p.id = auth.uid()
  order by r.rnk, p.username
$$;
grant execute on function public.house_standings(text), public.player_rankings(text, text) to anon, authenticated;

-- 4. skribbl: the registered name IS the skribbl name, so the host's auto-score
--    bookmark (admin Results) can match the room scoreboard to players.
update public.games set
  ig_id_label = 'skribbl name',
  ig_id_pattern = '^.{2,21}$',
  ig_id_hint = 'Type this exact name on skribbl.io when you join the room',
  rules = jsonb_build_array(
    'No typing the answer in chat, no letters in drawings',
    'One tab per person',
    'Join the room with the exact skribbl name you registered; any other name scores 0'),
  verify_note = 'Host reads the room scoreboard with the auto-score bookmark'
where slug = 'skribbl';
