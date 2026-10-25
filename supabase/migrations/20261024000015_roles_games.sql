-- =====================================================================
-- Roles v2 and the new game list (25 Oct 2026, Angad).
--
-- 1. Three staff levels, the superadmin on top and never bypassed:
--      superadmin  everything (only Angad).
--      admin       open or close events, see registrations, add and edit
--                  results, nudge a player's points, run the lobby.
--      organizer   run the lobby, see registrations, add results.
--    Admins can NOT: give or take roles, ban or unban, edit a player's
--    details or in-game name, see game requests or the audit log, edit
--    games, regions, event settings or the Meet link.
--    From this migration is_admin() / require_admin() mean "superadmin":
--    every older admin_* RPC behind them is now superadmin-only. Admin
--    powers are spelled out below with can_manage_events().
-- 2. Public staff badges: "Super Admin" and "Admin ★" next to a username.
-- 3. Sagar and Abhimanyu become admins (by email, so it also works before
--    they first sign in), plus the @mg.study domain from 0014.
-- 4. New games on top: Smash Karts, Stumble Guys, BGMI, Free Fire, CODM,
--    skribbl, Clash of Clans, Clash Royale, CS2, Valorant, Among Us, Extra.
-- Safe to run twice.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Role checks
-- ---------------------------------------------------------------------
create or replace function public.is_superadmin() returns boolean
language sql stable set search_path = '' as $$
  select public.has_role(array['superadmin'])
$$;

create or replace function public.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select public.has_role(array['superadmin'])
$$;

create or replace function public.require_admin() returns void
language plpgsql stable set search_path = '' as $$
begin
  if not public.has_role(array['superadmin']) then
    raise exception 'Only the superadmin can do that' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
end $$;

-- Admin level: open/close events and fix points.
create or replace function public.can_manage_events() returns boolean
language sql stable set search_path = '' as $$
  select public.has_role(array['superadmin', 'admin'])
$$;

-- Admins open or close registration; nothing else about the event changes.
create or replace function public.admin_set_event_status(p_tournament_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old text;
begin
  if not public.can_manage_events() then
    raise exception 'Admins only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  if p_status not in ('open', 'closed') then
    raise exception 'Status must be open or closed' using errcode = 'P0001', hint = 'BAD_INPUT';
  end if;
  select status into v_old from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  if v_old not in ('upcoming', 'open', 'closed') then
    raise exception 'Only an upcoming, open or closed event can be opened or closed here' using errcode = 'P0001', hint = 'BAD_STATE';
  end if;
  -- Reopening after the start (or once results exist) would let people join a running event.
  if p_status = 'open' and not public.is_superadmin() and (
       exists (select 1 from public.matches where tournament_id = p_tournament_id)
       or exists (select 1 from public.tournaments where id = p_tournament_id and starts_at is not null and starts_at <= now())) then
    raise exception 'This event has already started; only the superadmin can reopen it' using errcode = 'P0001', hint = 'STARTED';
  end if;
  update public.tournaments set status = p_status where id = p_tournament_id;
  perform public.audit('tournament.status', p_tournament_id::text, jsonb_build_object('from', v_old, 'to', p_status));
end $$;

-- Admins nudge an entry's total up or down (a typo in a result, a penalty).
create or replace function public.admin_adjust_points(p_entry_id uuid, p_points_adjust numeric, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old numeric;
begin
  if not public.can_manage_events() then
    raise exception 'Admins only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  if p_points_adjust is null or abs(p_points_adjust) > 100000 then
    raise exception 'Points must be within ±100000' using errcode = 'P0001', hint = 'BAD_INPUT';
  end if;
  select points_adjust into v_old from public.entries where id = p_entry_id for update;
  if not found then
    raise exception 'Entry not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  if not public.is_superadmin() and exists (
       select 1 from public.entries e join public.tournaments t on t.id = e.tournament_id
       where e.id = p_entry_id and (e.status <> 'active' or t.status in ('completed', 'cancelled', 'draft'))) then
    raise exception 'This event is finished or the entry is disqualified; only the superadmin can change its points'
      using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  update public.entries set points_adjust = p_points_adjust,
    adjust_note = nullif(left(btrim(coalesce(p_note, '')), 200), '')
  where id = p_entry_id;
  perform public.audit('entry.points', p_entry_id::text, jsonb_build_object('from', v_old, 'to', p_points_adjust, 'note', p_note));
end $$;

-- Game requests: superadmin only now (was any staff).
create or replace function public.admin_game_requests() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'game_name', r.game_name, 'platform', r.platform,
      'note', r.note, 'status', r.status, 'created_at', r.created_at, 'username', p.username)
      order by r.created_at desc)
    from (select * from public.game_requests order by created_at desc limit 300) r
    join public.profiles p on p.id = r.user_id), '[]');
end $$;

-- A player's in-game name is a player detail: superadmin only (was any staff).
create or replace function public.admin_set_ig_id(p_tournament_id uuid, p_username text, p_ig_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_old  text;
  v_ig   text := btrim(coalesce(p_ig_id, ''));
begin
  perform public.require_admin();
  if v_ig = '' or char_length(v_ig) > 64 then
    raise exception 'Give an in-game name' using errcode = 'P0001', hint = 'BAD_IG_ID';
  end if;
  select m.user_id, m.ig_id into v_user, v_old from public.entry_members m join public.profiles p on p.id = m.user_id
  where m.tournament_id = p_tournament_id and lower(p.username) = lower(btrim(p_username)) for update of m;
  if not found then
    raise exception 'That player is not in this event' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  update public.entry_members set ig_id = v_ig where tournament_id = p_tournament_id and user_id = v_user;
  perform public.audit('ig.change', p_tournament_id::text,
    jsonb_build_object('user', lower(btrim(p_username)), 'from', v_old, 'to', v_ig, 'by_staff', true));
exception
  when unique_violation then
    raise exception 'Another player in this event already uses that in-game name' using errcode = 'P0001', hint = 'IG_ID_TAKEN';
end $$;

-- Results guard (loophole review 3 + 5), as a trigger so every path is covered:
--   * saved results of a completed, cancelled or draft event change only by the superadmin;
--   * editing or deleting saved results needs admin level (organisers only add new games).
-- Calls without a signed-in user (SQL editor, migrations) pass.
create or replace function public.guard_results() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_tid uuid;
  v_status text;
begin
  if auth.uid() is null or public.is_superadmin() then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'matches' then
    v_tid := coalesce(new.tournament_id, old.tournament_id);
  else
    select m.tournament_id into v_tid from public.matches m where m.id = coalesce(new.match_id, old.match_id);
  end if;
  select status into v_status from public.tournaments where id = v_tid;
  if v_status in ('completed', 'cancelled', 'draft') then
    raise exception 'This event is finished; only the superadmin can change its results' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and not public.can_manage_events() then
    raise exception 'Only admins can edit or delete saved results' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists matches_guard on public.matches;
create trigger matches_guard before insert or update or delete on public.matches
  for each row execute function public.guard_results();
drop trigger if exists match_results_guard on public.match_results;
create trigger match_results_guard before insert or update or delete on public.match_results
  for each row execute function public.guard_results();

-- Loophole review (2): only the superadmin sets an event's own Meet / chat link
-- (a staff-set link would reach every player: phishing). Staff still post room code and note.
create or replace function public.admin_set_lobby(p_tournament_id uuid, p jsonb, p_notify boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_t public.tournaments;
  v_code text := nullif(btrim(coalesce(p ->> 'room_code', '')), '');
  v_super boolean := public.is_superadmin();
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  select * into v_t from public.tournaments where id = p_tournament_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  insert into public.event_lobby as l (tournament_id, meet_url, chat_url, room_code, room_password, note, updated_by, updated_at)
  values (p_tournament_id,
    case when v_super then nullif(btrim(coalesce(p ->> 'meet_url', '')), '') end,
    case when v_super then nullif(btrim(coalesce(p ->> 'chat_url', '')), '') end,
    v_code, nullif(btrim(coalesce(p ->> 'room_password', '')), ''),
    btrim(coalesce(p ->> 'note', '')), auth.uid(), now())
  on conflict (tournament_id) do update set
    meet_url = case when v_super then excluded.meet_url else l.meet_url end,
    chat_url = case when v_super then excluded.chat_url else l.chat_url end,
    room_code = excluded.room_code, room_password = excluded.room_password, note = excluded.note,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  if p_notify then
    perform public.throttle('notice', 30, interval '1 hour');
    insert into public.event_notices (tournament_id, kind, title, body, created_by)
    values (p_tournament_id, 'room',
      case when v_code is null then 'Lobby details updated' else 'Room code is up' end,
      'Check in on the Lobby tab to see it.', auth.uid());
  end if;
  perform public.audit('lobby.set', p_tournament_id::text, jsonb_build_object('notify', p_notify));
exception
  when check_violation then
    raise exception 'Links must start with https:// and codes stay under 40 characters'
      using errcode = 'P0001', hint = 'BAD_INPUT';
end $$;

-- Loophole review (1): game requests readable only by their author and the superadmin.
drop policy if exists requests_read_own on public.game_requests;
create policy requests_read_own on public.game_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Loophole review (6): there is only ever one superadmin.
create unique index if not exists one_superadmin on public.user_roles (role) where role = 'superadmin';

-- ---------------------------------------------------------------------
-- 2. Public staff badges (username -> top role), shown next to names
-- ---------------------------------------------------------------------
create or replace function public.staff_badges() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(lower(p.username), b.role), '{}'::jsonb)
  from (
    select r.user_id, case when bool_or(r.role = 'superadmin') then 'superadmin' else 'admin' end as role
    from public.user_roles r
    where r.role in ('superadmin', 'admin')
    group by r.user_id
  ) b
  join public.profiles p on p.id = b.user_id
  where p.status = 'active' and p.username is not null
$$;

-- ---------------------------------------------------------------------
-- 3. Domains and the two admins
-- ---------------------------------------------------------------------
update public.app_settings
set value = '["ds.study.iitm.ac.in", "es.study.iitm.ac.in", "mg.study.iitm.ac.in"]'::jsonb
where key = 'allowed_email_domains';

insert into public.email_access (email, role, note) values
  ('25f2003321@ds.study.iitm.ac.in', 'admin', 'Sagar Rathore'),
  ('24f3002949@mg.study.iitm.ac.in', 'admin', 'Abhimanyu')
on conflict (email) do update set role = excluded.role, note = excluded.note, updated_at = now();

-- Already signed up: grant now (otherwise apply_email_access does it at onboarding).
insert into public.user_roles (user_id, role)
select p.id, 'admin' from public.profiles p
where p.email in ('25f2003321@ds.study.iitm.ac.in', '24f3002949@mg.study.iitm.ac.in')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 4. Games: Angad's twelve first, the rest after them
-- ---------------------------------------------------------------------
insert into public.games (slug, title, short, description, platforms, mode, team_size, max_subs,
  ig_id_label, ig_id_pattern, ig_id_hint, extra_fields, rules, scoring,
  placement_points, kill_points, match_minutes, verify_note, accent, sort_order, play_links, join_steps)
values
  ($q$smash-karts$q$, $q$Smash Karts$q$, $q$Smash Karts$q$,
   $q$Kart battle in the browser: grab weapons, smash rivals. Private room, 6-8 players per room, several 3-minute rounds; most smashes wins.$q$,
   array[$q$web$q$, $q$android$q$, $q$ios$q$]::text[], $q$solo$q$, 1, 0,
   $q$Smash Karts name$q$, $q$^.{2,24}$$q$, $q$The name above your kart. Same name all night.$q$,
   $j$[]$j$::jsonb,
   $j$["One account per player; same name all night","No teaming up inside a free-for-all room","Host screenshots the end-of-round scoreboard","Tiebreak: more round wins, then more smashes"]$j$::jsonb,
   $q$Per round: 1st 1000, 2nd 700, 3rd 500, 4th 400, 5th-8th 250; the night's total decides the winner$q$,
   $j${"1":1000,"2":700,"3":500,"4":400,"5-8":250}$j$::jsonb, 0, 20, $q$scoreboard screenshot$q$, $q$#ff7a2e$q$, 1,
   $j$[{"kind":"web","label":"Play in browser","url":"https://smashkarts.io"}]$j$::jsonb,
   $j$["Open smashkarts.io (or the app) and set your name","Check in on this page when it opens","Join the Google Meet","Private Match > Join > type the room code","Stay till the last round; results land on Standings"]$j$::jsonb),
  ($q$clash-of-clans$q$, $q$Clash of Clans$q$, $q$Clash of Clans$q$,
   $q$Friendly challenges inside the IITM BS clan: attack each other's base, best stars then destruction % wins. Groups, then a knockout.$q$,
   array[$q$android$q$, $q$ios$q$]::text[], $q$solo$q$, 1, 0,
   $q$Player Tag$q$, $q$^#?[0289PYLQGRJCUVpylqgrjcuv]{3,12}$$q$, $q$Starts with #, under your name on the profile. Letter O is zero.$q$,
   $j$[{"key":"th","label":"Town Hall level","pattern":"^\\d{1,2}$","hint":"For fair pairing","required":true}]$j$::jsonb,
   $j$["Join the event clan before the start (link in the lobby)","Friendly challenge on your war base; no base swaps mid-round","Pairs are matched by Town Hall level","Stars first, then destruction %, then time left","Winner screenshots the replay result"]$j$::jsonb,
   $q$Per pairing: win 1000, loss 0; tiebreak total stars, then destruction %$q$,
   $j${"1":1000,"2":700,"3":500,"4":400,"5-8":250,"9-16":100}$j$::jsonb, 0, 15, $q$replay screenshot$q$, $q$#f6c343$q$, 7,
   $j$[{"kind":"android","label":"Google Play","url":"https://play.google.com/store/apps/details?id=com.supercell.clashofclans"},{"kind":"ios","label":"App Store","url":"https://apps.apple.com/app/clash-of-clans/id529479190"}]$j$::jsonb,
   $j$["Copy your Player Tag from your profile","Join the event clan from the lobby link","Check in on this page when it opens","Wait for your pairing in the lobby notes","Send or accept the friendly challenge","Screenshot the result for the organisers"]$j$::jsonb),
  ($q$among-us$q$, $q$Among Us$q$, $q$Among Us$q$,
   $q$Social deduction in a private lobby of up to 15. Crewmates finish tasks or vote out the impostors; impostors sabotage. Points per game by role and result.$q$,
   array[$q$android$q$, $q$ios$q$, $q$pc$q$]::text[], $q$solo$q$, 1, 0,
   $q$Among Us name$q$, $q$^.{2,10}$$q$, $q$Your in-game name (Among Us allows 10 characters).$q$,
   $j$[]$j$::jsonb,
   $j$["Talk only in meetings (Meet mic) - ghosts stay silent","No screen-sharing or telling others your role","Host sets the map and settings; nobody else changes them","Leaving mid-game = 0 for that game"]$j$::jsonb,
   $q$Per game: impostor win 1000, crewmate win 500, survived 100 extra; the host enters points per game$q$,
   $j${"1":1000,"2":700,"3":500,"4":400,"5-8":250,"9-15":100}$j$::jsonb, 0, 15, $q$end screen screenshot$q$, $q$#d7263d$q$, 11,
   $j$[{"kind":"android","label":"Google Play","url":"https://play.google.com/store/apps/details?id=com.innersloth.spacemafia"},{"kind":"ios","label":"App Store","url":"https://apps.apple.com/app/among-us/id1351168404"},{"kind":"pc","label":"Steam (PC)","url":"https://store.steampowered.com/app/945360/Among_Us/"}]$j$::jsonb,
   $j$["Set your in-game name to the one you registered","Check in on this page when it opens","Join the Google Meet (voice for meetings)","Online > Find Game > Enter Code > type the room code","Stay till the last game; results land on Standings"]$j$::jsonb),
  ($q$extra$q$, $q$Extra games$q$, $q$Extra$q$,
   $q$Fun one-off nights: whatever game the community picks (GeoGuessr, Krunker, chess blitz, quizzes and more). The lobby note says the game of the night.$q$,
   array[$q$web$q$, $q$android$q$, $q$ios$q$, $q$pc$q$]::text[], $q$solo$q$, 1, 0,
   $q$In-game name$q$, $q$^.{2,32}$$q$, $q$The name you will use in tonight's game.$q$,
   $j$[]$j$::jsonb,
   $j$["The game and its rules are in the lobby note","Same name all night","Host's scoreboard is final"]$j$::jsonb,
   $q$Set per night by the host; default 1st 1000, 2nd 700, 3rd 500$q$,
   $j${"1":1000,"2":700,"3":500,"4":400,"5-8":250,"9-16":100}$j$::jsonb, 0, 30, $q$screenshot$q$, $q$#b99cff$q$, 12,
   $j$[]$j$::jsonb,
   $j$["Read the lobby note: it names tonight's game","Check in on this page when it opens","Join the Google Meet","Join the room with the code the host posts"]$j$::jsonb)
on conflict (slug) do nothing;

update public.games g set sort_order = o.n, title = coalesce(o.title, g.title)
from (values
  ('smash-karts', 1, null), ('stumble-guys', 2, null), ('bgmi', 3, null), ('ff-max', 4, null), ('codm', 5, null),
  ('skribbl', 6, null), ('clash-of-clans', 7, null), ('clash-royale', 8, null), ('cs2', 9, null), ('valorant', 10, null),
  ('among-us', 11, null), ('extra', 12, null),
  ('brawl-stars', 21, null), ('pokemon-unite', 22, null), ('efootball', 23, null), ('real-cricket', 24, null),
  ('asphalt-legends', 25, null), ('ludo-king', 26, null), ('chess', 27, null)
) as o(slug, n, title)
where g.slug = o.slug;

-- A Season 1 event for each new game, announced but not open (same as the seed).
insert into public.tournaments (game_id, slug, title, season, summary, status, placement_points, kill_points, same_house_teams)
select g.id, g.slug || '-s1', coalesce(nullif(g.short, ''), g.title) || ' Season 1', 'S1',
       'Season 1 of the IITM BS ' || g.title || ' tournament. Dates are announced here and on the official WhatsApp group.',
       'upcoming', g.placement_points, g.kill_points, false
from public.games g
where g.slug in ('smash-karts', 'clash-of-clans', 'among-us', 'extra')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke execute on function public.guard_results() from public, anon, authenticated;
revoke execute on function public.is_superadmin(), public.can_manage_events(),
  public.admin_set_event_status(uuid, text), public.admin_adjust_points(uuid, numeric, text),
  public.staff_badges() from public;
grant execute on function public.is_superadmin(), public.can_manage_events() to anon, authenticated;
grant execute on function public.admin_set_event_status(uuid, text), public.admin_adjust_points(uuid, numeric, text) to authenticated;
grant execute on function public.staff_badges() to anon, authenticated;
