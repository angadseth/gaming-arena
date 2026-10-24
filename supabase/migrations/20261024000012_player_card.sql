-- =====================================================================
-- Player card: XP, levels and badges (24 Oct 2026). The "lalach":
-- every game you play earns XP, levels show on your card, and badges
-- unlock for showing up, winning a game, podiums and titles.
-- Nothing is stored: the card is computed from results and check-ins,
-- so it can never drift from the leaderboards or be edited by anyone.
--
-- XP = sum of your entries' match points (whole team shares a team's
--      points) + 100 for every event you checked in to.
-- Levels: Rookie 0, Bronze 1000, Silver 3000, Gold 6000, Platinum 10000,
--         Diamond 20000, Legend 40000.
-- Badges: debut (played a game), regular (checked in to 3 events),
--         game_winner (won a single game), podium (top 3 of a finished
--         event), champion (won a finished event).
-- =====================================================================

create function public.player_card(p_username text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p        public.profiles;
  v_xp     numeric;
  v_check  int;
  v_played int;
  v_gwins  int;
  v_pod    int;
  v_champ  int;
  v_events int;
  v_level  text;
  v_floor  int;
  v_next   int;
begin
  if p_username is null then
    select * into p from public.profiles where id = auth.uid();
  else
    select * into p from public.profiles where lower(username) = lower(btrim(p_username));
  end if;
  if not found or p.status = 'banned' then
    return null;
  end if;

  select count(distinct m.tournament_id), count(*) filter (where m.checked_in_at is not null)
    into v_events, v_check
  from public.entry_members m
  join public.entries e on e.id = m.entry_id and e.status = 'active'
  join public.tournaments t on t.id = m.tournament_id and t.status <> 'cancelled'
  where m.user_id = p.id;

  select coalesce(sum(r.points), 0), count(r.match_id), count(*) filter (where r.placement = 1)
    into v_xp, v_played, v_gwins
  from public.entry_members m
  join public.entries e on e.id = m.entry_id and e.status = 'active'
  join public.match_results r on r.entry_id = e.id
  where m.user_id = p.id and m.role <> 'sub';

  -- Final ranks in completed events, same ordering as the standings.
  with mine as (
    select e.tournament_id, e.id from public.entry_members m
    join public.entries e on e.id = m.entry_id and e.status = 'active'
    join public.tournaments t on t.id = e.tournament_id and t.status = 'completed'
    where m.user_id = p.id and m.role <> 'sub'
  ), agg as (
    select e.id, e.tournament_id,
           coalesce(sum(r.points), 0) + e.points_adjust as pts,
           count(*) filter (where r.placement = 1) as wins,
           coalesce(sum(r.kills), 0) as kills, min(r.placement) as best
    from public.entries e
    left join public.match_results r on r.entry_id = e.id
    where e.status = 'active' and e.tournament_id in (select tournament_id from mine)
    group by e.id
  ), ranked as (
    select a.id, rank() over (partition by a.tournament_id
                              order by a.pts desc, a.wins desc, a.kills desc, a.best asc nulls last) as rnk
    from agg a
  )
  select count(*) filter (where r.rnk <= 3), count(*) filter (where r.rnk = 1)
    into v_pod, v_champ
  from ranked r where r.id in (select id from mine);

  v_xp := v_xp + 100 * v_check;
  select l.name, l.at, l.nxt into v_level, v_floor, v_next
  from (values ('Rookie', 0, 1000), ('Bronze', 1000, 3000), ('Silver', 3000, 6000), ('Gold', 6000, 10000),
               ('Platinum', 10000, 20000), ('Diamond', 20000, 40000), ('Legend', 40000, null))
       l(name, at, nxt)
  where v_xp >= l.at order by l.at desc limit 1;

  return jsonb_build_object(
    'username', p.username, 'house_id', p.house_id,
    'avatar', coalesce(p.avatar, 'bottts:' || left(regexp_replace(lower(p.username), '[^a-z0-9]', '', 'g'), 16)),
    'xp', round(v_xp), 'level', v_level, 'level_floor', v_floor, 'next_level_at', v_next,
    'events', v_events, 'checkins', v_check, 'games', v_played,
    'badges', jsonb_build_array(
      jsonb_build_object('key', 'debut', 'count', least(v_played, 1), 'have', v_played > 0),
      jsonb_build_object('key', 'regular', 'count', v_check, 'have', v_check >= 3),
      jsonb_build_object('key', 'game_winner', 'count', v_gwins, 'have', v_gwins > 0),
      jsonb_build_object('key', 'podium', 'count', v_pod, 'have', v_pod > 0),
      jsonb_build_object('key', 'champion', 'count', v_champ, 'have', v_champ > 0)));
end $$;

grant execute on function public.player_card(text) to anon, authenticated;
