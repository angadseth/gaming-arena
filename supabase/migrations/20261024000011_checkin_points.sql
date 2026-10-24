-- =====================================================================
-- Check-in, one fixed Meet link, and bigger points (24 Oct 2026, Angad).
--
-- 1. One Google Meet link for every event (app_settings.default_meet_url);
--    an event can still override it in its lobby.
-- 2. Identity: the site account and the in-game account are different
--    things. The link between them is the in-game ID the player typed at
--    registration. Before a match the player CHECKS IN and confirms (or
--    fixes) that in-game name; only checked-in players get the room code.
--    Organisers get a roster (site username <-> in-game name <-> house)
--    to compare with the names inside the game room, and results are
--    matched by that in-game name. Every name change is audited.
-- 3. Points x100: "10 is too small". Every stored table and result is
--    multiplied by 100 so old and new events stay comparable. Stumble Guys
--    gets its own table (1st 1000 ... reached the room 50).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Points x100
-- ---------------------------------------------------------------------
create function public.scale_points(p jsonb, f numeric) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(k, to_jsonb(round(v::numeric * f, 2))), '{}'::jsonb)
  from jsonb_each_text(coalesce(p, '{}')) e(k, v)
$$;

-- Widen first, scale, then put the (wider) checks back.
alter table public.games drop constraint if exists games_kill_points_check;
alter table public.tournaments drop constraint if exists tournaments_kill_points_check;
alter table public.match_results drop constraint if exists match_results_points_check;
alter table public.entries alter column points_adjust type numeric(10, 2);
alter table public.match_results alter column points type numeric(10, 2);

update public.games set placement_points = public.scale_points(placement_points, 100), kill_points = kill_points * 100;
update public.tournaments set placement_points = public.scale_points(placement_points, 100),
  house_points = public.scale_points(house_points, 100), kill_points = kill_points * 100;
update public.match_results set points = points * 100;
update public.entries set points_adjust = points_adjust * 100;

alter table public.games add constraint games_kill_points_check check (kill_points between 0 and 1000);
alter table public.tournaments add constraint tournaments_kill_points_check check (kill_points between 0 and 1000);
alter table public.match_results add constraint match_results_points_check check (points between -100000 and 100000);

alter table public.games alter column placement_points
  set default '{"1": 1000, "2": 700, "3": 500, "4": 400, "5-8": 200, "9-16": 100}';
alter table public.tournaments alter column house_points
  set default '{"1": 1000, "2": 700, "3": 500, "4": 400, "5-8": 200, "9-16": 100}';

update public.games set scoring = scoring || ' Gaming Arena scores x100 (1 official point = 100).'
where slug <> 'stumble-guys' and scoring <> '' and scoring not like '%x100%';

-- Stumble Guys: per game in a heat. 32 max in a custom party.
update public.games set
  placement_points = '{"1": 1000, "2": 700, "3": 500, "4": 400, "5-8": 250, "9-16": 100, "17-32": 50}',
  scoring = 'Per game: 1st 1000, 2nd 700, 3rd 500, 4th 400, 5th-8th 250, 9th-16th 100, everyone else in the room 50. A heat adds up all its games.'
where slug = 'stumble-guys';
update public.tournaments t set placement_points = g.placement_points
from public.games g
where g.id = t.game_id and g.slug = 'stumble-guys'
  and not exists (select 1 from public.matches m where m.tournament_id = t.id);

-- ---------------------------------------------------------------------
-- 2. One fixed Meet link
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value) values ('default_meet_url', 'null')
on conflict (key) do nothing;

create function public.default_meet_url() returns text
language sql stable security definer set search_path = '' as $$
  select nullif(value #>> '{}', '') from public.app_settings where key = 'default_meet_url'
$$;

create function public.admin_set_default_meet(p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v text := nullif(btrim(coalesce(p_url, '')), '');
begin
  perform public.require_admin();
  if v is not null and (v !~ '^https://[^\s<>"]{4,}$' or char_length(v) > 300) then
    raise exception 'The Meet link must start with https://' using errcode = 'P0001', hint = 'BAD_INPUT';
  end if;
  insert into public.app_settings (key, value) values ('default_meet_url', to_jsonb(v))
  on conflict (key) do update set value = excluded.value;
  perform public.audit('settings.meet', null, jsonb_build_object('url', v));
end $$;

-- ---------------------------------------------------------------------
-- 3. Check-in
-- ---------------------------------------------------------------------
alter table public.event_lobby add column checkin_open boolean not null default false;
alter table public.entry_members add column checked_in_at timestamptz;

-- Comparable form of an in-game name: Unicode-folded, no spaces or invisible
-- characters, lowercase. Two names with the same key count as the same name.
create function public.ig_key(p text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select lower(regexp_replace(normalize(coalesce(p, ''), NFKC), '[\s​-‏⁠﻿­]', '', 'g'))
$$;
create unique index entry_members_ig_key_unique on public.entry_members (tournament_id, public.ig_key(ig_id));

-- Check-in is open when the organiser opened it, or automatically from 45 min before the start.
create function public.checkin_is_open(p_tournament_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select t.status not in ('completed', 'cancelled', 'draft') and (
           coalesce((select l.checkin_open from public.event_lobby l where l.tournament_id = t.id), false)
           or (t.starts_at is not null and now() >= t.starts_at - interval '45 minutes' and now() < t.starts_at + interval '6 hours'))
  from public.tournaments t where t.id = p_tournament_id
$$;

-- The player confirms the in-game name they will play with. A changed name is
-- validated, must stay unique in the event (lookalikes included) and is audited.
-- Once checked in, or once any match is recorded, the name is locked: only an
-- organiser can change it (admin_set_ig_id), so players cannot swap names to
-- steal each other's placements between a game and its results.
create function public.check_in(p_tournament_id uuid, p_ig_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me   public.profiles := public.require_player();
  m    public.entry_members;
  g    public.games;
  v_ig text := btrim(coalesce(p_ig_id, ''));
begin
  perform public.throttle('checkin', 20, interval '1 hour');
  select m2.* into m from public.entry_members m2
  join public.entries e on e.id = m2.entry_id and e.status = 'active'
  where m2.tournament_id = p_tournament_id and m2.user_id = me.id for update of m2;
  if not found then
    raise exception 'Register for this event first' using errcode = 'P0001', hint = 'NOT_REGISTERED';
  end if;
  if not exists (select 1 from public.lobby_agreements a where a.tournament_id = p_tournament_id
                 and a.user_id = me.id and a.version >= public.lobby_rules_version()) then
    raise exception 'Accept the lobby rules first' using errcode = 'P0001', hint = 'RULES_REQUIRED';
  end if;
  if not coalesce(public.checkin_is_open(p_tournament_id), false) then
    raise exception 'Check-in is not open yet' using errcode = 'P0001', hint = 'CHECKIN_CLOSED';
  end if;
  select g2.* into g from public.games g2 join public.tournaments t on t.game_id = g2.id where t.id = p_tournament_id;
  if v_ig = '' or char_length(v_ig) > 64 or v_ig !~ g.ig_id_pattern then
    raise exception 'That % does not look right. %', g.ig_id_label, g.ig_id_hint using errcode = 'P0001', hint = 'BAD_IG_ID';
  end if;
  if v_ig is distinct from m.ig_id then
    if m.checked_in_at is not null then
      raise exception 'You are checked in, so your name is locked. Ask an organiser to change it'
        using errcode = 'P0001', hint = 'IG_LOCKED';
    end if;
    if exists (select 1 from public.matches x where x.tournament_id = p_tournament_id) then
      raise exception 'Names are locked once matches start. Ask an organiser' using errcode = 'P0001', hint = 'IG_LOCKED';
    end if;
    update public.entry_members set ig_id = v_ig where entry_id = m.entry_id and user_id = me.id;
    perform public.audit('ig.change', p_tournament_id::text, jsonb_build_object('user', me.username, 'from', m.ig_id, 'to', v_ig));
  end if;
  update public.entry_members set checked_in_at = now() where entry_id = m.entry_id and user_id = me.id;
  perform public.audit('checkin', p_tournament_id::text, jsonb_build_object('ig_id', v_ig));
exception
  when unique_violation then
    raise exception 'Another player in this event already uses that in-game name' using errcode = 'P0001', hint = 'IG_ID_TAKEN';
end $$;

-- Organiser fixes a player's in-game name (typo, dispute). Audited.
create function public.admin_set_ig_id(p_tournament_id uuid, p_username text, p_ig_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_old  text;
  v_ig   text := btrim(coalesce(p_ig_id, ''));
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
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

-- Opening check-in starts a fresh round (new heat or new day): everyone checks in again,
-- so last heat's players do not get this heat's room code.
create function public.admin_set_checkin(p_tournament_id uuid, p_open boolean, p_notify boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.tournaments where id = p_tournament_id) then
    raise exception 'Event not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  insert into public.event_lobby as l (tournament_id, checkin_open, updated_by)
  values (p_tournament_id, p_open, auth.uid())
  on conflict (tournament_id) do update set checkin_open = p_open, updated_by = auth.uid(), updated_at = now();
  if p_open then
    update public.entry_members set checked_in_at = null where tournament_id = p_tournament_id;
  end if;
  if p_open and p_notify then
    perform public.throttle('notice', 30, interval '1 hour');
    insert into public.event_notices (tournament_id, kind, title, body, created_by)
    values (p_tournament_id, 'live', 'Check-in is open',
      'Open the Lobby, confirm your in-game name and check in. Only checked-in players get the room code.', auth.uid());
  end if;
  perform public.audit('checkin.toggle', p_tournament_id::text, jsonb_build_object('open', p_open));
end $$;

-- ---------------------------------------------------------------------
-- 4. Lobby readers, now with the default Meet and check-in
-- ---------------------------------------------------------------------
-- Only ACTIVE entries count as "in the event": disqualified players lose the lobby.
create or replace function public.in_event(p_tournament_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_staff() or (public.session_ok() and exists (
    select 1 from public.entry_members m
    join public.profiles p on p.id = m.user_id
    join public.entries e on e.id = m.entry_id and e.status = 'active'
    where m.tournament_id = p_tournament_id and m.user_id = auth.uid() and p.status = 'active'))
$$;

create or replace function public.event_lobby(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  l       public.event_lobby;
  m       public.entry_members;
  v_staff boolean := public.is_staff();
  v_in    boolean;
  v_over  boolean;
begin
  if not public.in_event(p_tournament_id) then
    return jsonb_build_object('registered', false);
  end if;
  select * into l from public.event_lobby where tournament_id = p_tournament_id;
  if not v_staff and not exists (
    select 1 from public.lobby_agreements a
    where a.tournament_id = p_tournament_id and a.user_id = auth.uid() and a.version >= public.lobby_rules_version()) then
    return jsonb_build_object('registered', true, 'agreed', false, 'has_room', l.room_code is not null);
  end if;
  select * into m from public.entry_members where tournament_id = p_tournament_id and user_id = auth.uid();
  v_over := (select t.status in ('completed', 'cancelled') from public.tournaments t where t.id = p_tournament_id);
  v_in := m.checked_in_at is not null and not v_over;
  return jsonb_build_object(
    'registered', true, 'agreed', true,
    'checkin_open', coalesce(public.checkin_is_open(p_tournament_id), false),
    'checked_in', m.checked_in_at is not null, 'checked_in_at', m.checked_in_at, 'my_ig_id', m.ig_id,
    'meet_url', coalesce(l.meet_url, public.default_meet_url()), 'chat_url', l.chat_url,
    'has_room', l.room_code is not null and not v_over,
    'room_code', case when v_in or v_staff then l.room_code end,
    'room_password', case when v_in or v_staff then l.room_password end,
    'note', coalesce(l.note, ''), 'updated_at', l.updated_at,
    'notices', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body,
                                          'created_at', n.created_at) order by n.created_at desc)
      from public.event_notices n where n.tournament_id = p_tournament_id), '[]'));
end $$;

-- ---------------------------------------------------------------------
-- 5. Loophole fixes from the review (24 Oct)
-- ---------------------------------------------------------------------
-- Never put the room code in a notice: notices reach players who have not
-- checked in, lock screens, WhatsApp and email. Notify is throttled too.
create or replace function public.admin_set_lobby(p_tournament_id uuid, p jsonb, p_notify boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_t public.tournaments;
  v_code text := nullif(btrim(coalesce(p ->> 'room_code', '')), '');
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
    nullif(btrim(coalesce(p ->> 'meet_url', '')), ''), nullif(btrim(coalesce(p ->> 'chat_url', '')), ''),
    v_code, nullif(btrim(coalesce(p ->> 'room_password', '')), ''),
    btrim(coalesce(p ->> 'note', '')), auth.uid(), now())
  on conflict (tournament_id) do update set
    meet_url = excluded.meet_url, chat_url = excluded.chat_url, room_code = excluded.room_code,
    room_password = excluded.room_password, note = excluded.note,
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

update public.event_notices set title = 'Room code is up', body = 'Check in on the Lobby tab to see it.'
where title like 'Room code is up: %';

create or replace function public.admin_delete_notice(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  delete from public.event_notices where id = p_id;
  if not found then
    raise exception 'Notice not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  perform public.audit('notice.delete', p_id::text);
end $$;

-- Rules can only be accepted by players whose entry is still active.
create or replace function public.accept_lobby_rules(p_tournament_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_player();
begin
  if not exists (select 1 from public.entry_members m join public.entries e on e.id = m.entry_id and e.status = 'active'
                 where m.tournament_id = p_tournament_id and m.user_id = me.id) then
    raise exception 'Register for this event first' using errcode = 'P0001', hint = 'NOT_REGISTERED';
  end if;
  insert into public.lobby_agreements (tournament_id, user_id, version)
  values (p_tournament_id, me.id, public.lobby_rules_version())
  on conflict (tournament_id, user_id) do update set version = excluded.version, accepted_at = now();
  perform public.audit('lobby.accept', p_tournament_id::text);
end $$;

-- Inbox: only events where the player's entry is still active.
create or replace function public.my_notices(p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_seen timestamptz;
begin
  if auth.uid() is null or not public.session_ok() then
    return jsonb_build_object('unread', 0, 'items', '[]'::jsonb);
  end if;
  select notices_seen_at into v_seen from public.profiles where id = auth.uid() and status = 'active';
  if not found then
    return jsonb_build_object('unread', 0, 'items', '[]'::jsonb);
  end if;
  return (
    with mine as (
      select n.*, t.slug, t.title as event_title
      from public.event_notices n
      join public.tournaments t on t.id = n.tournament_id
      where exists (select 1 from public.entry_members m join public.entries e on e.id = m.entry_id and e.status = 'active'
                    where m.tournament_id = n.tournament_id and m.user_id = auth.uid())
    )
    select jsonb_build_object(
      'unread', (select count(*) from mine where v_seen is null or created_at > v_seen),
      'items', coalesce((select jsonb_agg(jsonb_build_object(
          'id', x.id, 'kind', x.kind, 'title', x.title, 'body', x.body, 'created_at', x.created_at,
          'event_slug', x.slug, 'event_title', x.event_title,
          'unread', v_seen is null or x.created_at > v_seen) order by x.created_at desc)
        from (select * from mine order by created_at desc limit least(greatest(p_limit, 1), 200)) x), '[]'))
  );
end $$;

-- Stumble Guys names: plain letters, numbers, _ . - and spaces, so lookalike
-- Unicode names cannot shadow a real player on the roster.
update public.games set ig_id_pattern = '^[A-Za-z0-9_. -]{2,24}$',
  ig_id_hint = 'Your Stumble Guys name: letters, numbers, _ . - only'
where slug = 'stumble-guys';

-- The roster counts name changes per player; keep that lookup indexed.
create index audit_log_action_target_idx on public.audit_log (action, target);

create or replace function public.admin_lobby(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  return (select public.event_lobby(p_tournament_id)) || jsonb_build_object(
    'event_meet_url', (select l.meet_url from public.event_lobby l where l.tournament_id = p_tournament_id),
    'default_meet_url', public.default_meet_url(),
    'recipients', (select count(distinct m.user_id) from public.entry_members m
                   join public.profiles p on p.id = m.user_id
                   where m.tournament_id = p_tournament_id and p.status = 'active'),
    'agreed_count', (select count(*) from public.lobby_agreements a
                     where a.tournament_id = p_tournament_id and a.version >= public.lobby_rules_version()),
    'checked_in_count', (select count(*) from public.entry_members m
                         where m.tournament_id = p_tournament_id and m.checked_in_at is not null),
    'emails', coalesce((select jsonb_agg(distinct p.email) from public.entry_members m
                        join public.profiles p on p.id = m.user_id
                        where m.tournament_id = p_tournament_id and p.status = 'active'), '[]'),
    -- Who to let into the game room: compare ig_id with the names in the room.
    'roster', coalesce((select jsonb_agg(jsonb_build_object(
        'username', p.username, 'full_name', p.full_name, 'house_id', p.house_id,
        'entry', e.name, 'entry_status', e.status, 'role', m.role, 'ig_id', m.ig_id,
        'checked_in_at', m.checked_in_at,
        'ig_changes', (select count(*) from public.audit_log a where a.action = 'ig.change'
                       and a.target = p_tournament_id::text and a.details ->> 'user' = p.username))
        order by m.checked_in_at nulls last, lower(m.ig_id))
      from public.entry_members m
      join public.profiles p on p.id = m.user_id
      join public.entries e on e.id = m.entry_id
      where m.tournament_id = p_tournament_id), '[]'));
end $$;

-- The event's own Meet link is optional now; empty means "use the fixed one".
-- (admin_set_lobby already stores an empty meet_url as null.)

-- Bigger point bounds and x100 fallback tables in the admin functions (copies of 0003
-- with only those lines changed; ig_id lookups use ig_key so lookalikes match).
create or replace function public.admin_upsert_game(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_pattern text := coalesce(p ->> 'ig_id_pattern', '^.{2,40}$');
  f jsonb;
begin
  perform public.require_admin();

  -- Reject patterns Postgres cannot compile before they reach a table.
  begin
    perform 'x' ~ v_pattern;
  exception when others then
    raise exception 'In-game ID pattern is not a valid regex' using errcode = 'P0001', hint = 'BAD_PATTERN';
  end;
  for f in select * from jsonb_array_elements(coalesce(p -> 'extra_fields', '[]')) loop
    if coalesce(f ->> 'key', '') !~ '^[a-z][a-z0-9_]{0,29}$' or coalesce(f ->> 'label', '') = '' then
      raise exception 'Each extra field needs a key (a-z, 0-9, _) and a label' using errcode = 'P0001', hint = 'BAD_FIELDS';
    end if;
    if f ? 'pattern' then
      begin
        perform 'x' ~ (f ->> 'pattern');
      exception when others then
        raise exception 'Pattern for % is not a valid regex', f ->> 'key' using errcode = 'P0001', hint = 'BAD_PATTERN';
      end;
    end if;
  end loop;

  if v_id is null then
    insert into public.games (slug, title, short, description, platforms, mode, team_size, max_subs,
      ig_id_label, ig_id_pattern, ig_id_hint, extra_fields, rules, scoring, cover_path, accent, is_active, sort_order,
      placement_points, kill_points, match_minutes, verify_note)
    values (
      lower(p ->> 'slug'), p ->> 'title', coalesce(p ->> 'short', ''), coalesce(p ->> 'description', ''),
      coalesce(array(select jsonb_array_elements_text(p -> 'platforms')), '{}'),
      p ->> 'mode', coalesce((p ->> 'team_size')::smallint, 1), coalesce((p ->> 'max_subs')::smallint, 0),
      coalesce(p ->> 'ig_id_label', 'In-game ID'), v_pattern, coalesce(p ->> 'ig_id_hint', ''),
      coalesce(p -> 'extra_fields', '[]'), coalesce(p -> 'rules', '[]'), coalesce(p ->> 'scoring', ''),
      nullif(p ->> 'cover_path', ''), nullif(p ->> 'accent', ''),
      coalesce((p ->> 'is_active')::boolean, true), coalesce((p ->> 'sort_order')::smallint, 0),
      coalesce(p -> 'placement_points', '{"1": 1000, "2": 700, "3": 500, "4": 400, "5-8": 200, "9-16": 100}'),
      coalesce((p ->> 'kill_points')::numeric, 0), nullif(p ->> 'match_minutes', '')::smallint,
      coalesce(p ->> 'verify_note', ''))
    returning id into v_id;
    perform public.audit('game.create', v_id::text, jsonb_build_object('slug', p ->> 'slug'));
  else
    update public.games set
      slug = lower(p ->> 'slug'), title = p ->> 'title', short = coalesce(p ->> 'short', ''),
      description = coalesce(p ->> 'description', ''),
      platforms = coalesce(array(select jsonb_array_elements_text(p -> 'platforms')), '{}'),
      mode = p ->> 'mode', team_size = coalesce((p ->> 'team_size')::smallint, 1),
      max_subs = coalesce((p ->> 'max_subs')::smallint, 0),
      ig_id_label = coalesce(p ->> 'ig_id_label', 'In-game ID'), ig_id_pattern = v_pattern,
      ig_id_hint = coalesce(p ->> 'ig_id_hint', ''), extra_fields = coalesce(p -> 'extra_fields', '[]'),
      rules = coalesce(p -> 'rules', '[]'), scoring = coalesce(p ->> 'scoring', ''),
      cover_path = nullif(p ->> 'cover_path', ''), accent = nullif(p ->> 'accent', ''),
      is_active = coalesce((p ->> 'is_active')::boolean, true),
      sort_order = coalesce((p ->> 'sort_order')::smallint, 0),
      placement_points = coalesce(p -> 'placement_points', placement_points),
      kill_points = coalesce((p ->> 'kill_points')::numeric, kill_points),
      match_minutes = nullif(p ->> 'match_minutes', '')::smallint,
      verify_note = coalesce(p ->> 'verify_note', '')
    where id = v_id;
    if not found then
      raise exception 'Game not found' using errcode = 'P0001', hint = 'NOT_FOUND';
    end if;
    perform public.audit('game.update', v_id::text, jsonb_build_object('slug', p ->> 'slug'));
  end if;
  return v_id;
exception
  when unique_violation then
    raise exception 'A game with that slug already exists' using errcode = 'P0001', hint = 'SLUG_TAKEN';
  when check_violation then
    raise exception 'Some game fields are out of range (%).', sqlerrm using errcode = 'P0001', hint = 'BAD_INPUT';
end $$;

create or replace function public.admin_upsert_tournament(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_old public.tournaments;
begin
  perform public.require_admin();
  if v_id is null then
    insert into public.tournaments (game_id, slug, title, season, summary, status, reg_opens_at, reg_closes_at,
      starts_at, max_entries, same_house_teams, placement_points, kill_points, house_points, contact_note, created_by)
    values (
      (p ->> 'game_id')::uuid, lower(p ->> 'slug'), p ->> 'title', coalesce(p ->> 'season', '2026'),
      coalesce(p ->> 'summary', ''), coalesce(p ->> 'status', 'draft'),
      nullif(p ->> 'reg_opens_at', '')::timestamptz, nullif(p ->> 'reg_closes_at', '')::timestamptz,
      nullif(p ->> 'starts_at', '')::timestamptz, nullif(p ->> 'max_entries', '')::integer,
      coalesce((p ->> 'same_house_teams')::boolean, false),
      coalesce(p -> 'placement_points', (select g.placement_points from public.games g where g.id = (p ->> 'game_id')::uuid), '{}'),
      coalesce((p ->> 'kill_points')::numeric, (select g.kill_points from public.games g where g.id = (p ->> 'game_id')::uuid), 0),
      coalesce(p -> 'house_points', '{"1": 1000, "2": 700, "3": 500, "4": 400, "5-8": 200, "9-16": 100}'),
      coalesce(p ->> 'contact_note', ''), auth.uid())
    returning id into v_id;
    perform public.audit('tournament.create', v_id::text, jsonb_build_object('slug', p ->> 'slug'));
  else
    select * into v_old from public.tournaments where id = v_id for update;
    if not found then
      raise exception 'Event not found' using errcode = 'P0001', hint = 'NOT_FOUND';
    end if;
    -- Changing the game under existing registrations would break them.
    if v_old.game_id is distinct from (p ->> 'game_id')::uuid
       and exists (select 1 from public.entries where tournament_id = v_id) then
      raise exception 'This event already has registrations; its game cannot change' using errcode = 'P0001', hint = 'HAS_ENTRIES';
    end if;
    -- Fields missing from p keep their value; an empty string clears a nullable field.
    update public.tournaments set
      game_id = (p ->> 'game_id')::uuid, slug = lower(p ->> 'slug'), title = p ->> 'title',
      season = coalesce(p ->> 'season', season), summary = coalesce(p ->> 'summary', summary),
      status = coalesce(p ->> 'status', status),
      reg_opens_at = case when p ? 'reg_opens_at' then nullif(p ->> 'reg_opens_at', '')::timestamptz else reg_opens_at end,
      reg_closes_at = case when p ? 'reg_closes_at' then nullif(p ->> 'reg_closes_at', '')::timestamptz else reg_closes_at end,
      starts_at = case when p ? 'starts_at' then nullif(p ->> 'starts_at', '')::timestamptz else starts_at end,
      max_entries = case when p ? 'max_entries' then nullif(p ->> 'max_entries', '')::integer else max_entries end,
      same_house_teams = coalesce((p ->> 'same_house_teams')::boolean, same_house_teams),
      placement_points = coalesce(p -> 'placement_points', placement_points),
      kill_points = coalesce((p ->> 'kill_points')::numeric, kill_points),
      house_points = coalesce(p -> 'house_points', house_points),
      contact_note = coalesce(p ->> 'contact_note', contact_note)
    where id = v_id;
    perform public.audit('tournament.update', v_id::text, jsonb_build_object('before', to_jsonb(v_old),
      'after', (select to_jsonb(t) from public.tournaments t where t.id = v_id)));
  end if;
  return v_id;
exception
  when unique_violation then
    raise exception 'An event with that slug already exists' using errcode = 'P0001', hint = 'SLUG_TAKEN';
  when check_violation then
    raise exception 'Some event fields are out of range (%).', sqlerrm using errcode = 'P0001', hint = 'BAD_INPUT';
  when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
    raise exception 'A date or number field is not valid' using errcode = 'P0001', hint = 'BAD_INPUT';
end $$;

create or replace function public.admin_record_match(
  p_tournament_id uuid, p_label text, p_played_at timestamptz, p_rows jsonb, p_replace boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_t public.tournaments;
  v_match uuid;
  r jsonb;
  i int := 0;
  v_entry uuid;
  v_place smallint;
  v_kills smallint;
  v_points numeric;
  v_errors jsonb := '[]';
  v_rows jsonb := '[]';
  v_seen uuid[] := '{}';
begin
  -- Organisers run matches, so results are open to all staff.
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  select * into v_t from public.tournaments where id = p_tournament_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 500 then
    raise exception 'Results must be a list of 1-500 rows' using errcode = 'P0001', hint = 'BAD_INPUT';
  end if;
  if coalesce(btrim(p_label), '') = '' then
    raise exception 'Give the match a label, e.g. "Match 1 - Erangel"' using errcode = 'P0001', hint = 'BAD_INPUT';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    v_entry := null;
    begin
      if r ? 'entry_id' then
        select e.id into v_entry from public.entries e
        where e.id = (r ->> 'entry_id')::uuid and e.tournament_id = v_t.id;
      elsif r ? 'team' then
        select e.id into v_entry from public.entries e
        where e.tournament_id = v_t.id and lower(e.name) = lower(btrim(r ->> 'team'));
      elsif r ? 'username' then
        select m.entry_id into v_entry from public.entry_members m
        join public.profiles p on p.id = m.user_id
        where m.tournament_id = v_t.id and lower(p.username) = lower(btrim(r ->> 'username'));
      elsif r ? 'ig_id' then
        select m.entry_id into v_entry from public.entry_members m
        where m.tournament_id = v_t.id and public.ig_key(m.ig_id) = public.ig_key(r ->> 'ig_id');
      end if;

      if v_entry is null then
        v_errors := v_errors || jsonb_build_object('row', i, 'error',
          'No registered entry matches ' || coalesce(r ->> 'team', r ->> 'username', r ->> 'ig_id', r ->> 'entry_id', '(nothing given)'));
        continue;
      end if;
      if v_entry = any (v_seen) then
        v_errors := v_errors || jsonb_build_object('row', i, 'error', 'Same entry appears twice in this match');
        continue;
      end if;
      v_seen := v_seen || v_entry;

      v_place := nullif(r ->> 'placement', '')::smallint;
      v_kills := coalesce(nullif(r ->> 'kills', '')::smallint, 0);
      v_points := coalesce(nullif(r ->> 'points', '')::numeric,
        coalesce(public.points_for_rank(v_t.placement_points, v_place), 0) + v_kills * v_t.kill_points);
      if v_kills < 0 or v_kills > 500 or (v_place is not null and (v_place < 1 or v_place > 1000))
         or v_points < -100000 or v_points > 100000 then
        v_errors := v_errors || jsonb_build_object('row', i, 'error', 'Numbers out of range');
        continue;
      end if;
      v_rows := v_rows || jsonb_build_object('entry_id', v_entry, 'placement', v_place, 'kills', v_kills, 'points', v_points);
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', i, 'error', 'Could not read this row: ' || sqlerrm);
    end;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object('ok', false, 'errors', v_errors);
  end if;

  select id into v_match from public.matches where tournament_id = v_t.id and lower(label) = lower(btrim(p_label));
  if v_match is not null then
    if not p_replace then
      return jsonb_build_object('ok', false, 'errors', jsonb_build_array(jsonb_build_object('row', 0,
        'error', 'A match with this label already exists. Tick "replace" to overwrite it.')));
    end if;
    delete from public.match_results where match_id = v_match;
    update public.matches set played_at = coalesce(p_played_at, played_at) where id = v_match;
  else
    insert into public.matches (tournament_id, label, played_at, created_by)
    values (v_t.id, btrim(p_label), coalesce(p_played_at, now()), auth.uid()) returning id into v_match;
  end if;

  insert into public.match_results (match_id, entry_id, placement, kills, points)
  select v_match, (x ->> 'entry_id')::uuid, (x ->> 'placement')::smallint, (x ->> 'kills')::smallint, (x ->> 'points')::numeric
  from jsonb_array_elements(v_rows) x;

  perform public.audit('match.record', v_match::text,
    jsonb_build_object('tournament', v_t.id, 'label', p_label, 'rows', jsonb_array_length(v_rows), 'replaced', v_match is not null and p_replace));
  return jsonb_build_object('ok', true, 'match_id', v_match, 'rows', jsonb_array_length(v_rows));
end $$;

-- ---------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------
revoke execute on function public.scale_points(jsonb, numeric), public.default_meet_url() from public, anon, authenticated;
grant execute on function public.check_in(uuid, text) to authenticated;
revoke execute on function public.ig_key(text), public.checkin_is_open(uuid) from public, anon, authenticated;
grant execute on function
  public.admin_set_default_meet(text), public.admin_set_checkin(uuid, boolean, boolean),
  public.admin_set_ig_id(uuid, text, text)
to authenticated;
