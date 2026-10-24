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

alter table public.games drop constraint if exists games_kill_points_check;
alter table public.games add constraint games_kill_points_check check (kill_points between 0 and 1000);
alter table public.tournaments drop constraint if exists tournaments_kill_points_check;
alter table public.tournaments add constraint tournaments_kill_points_check check (kill_points between 0 and 1000);
alter table public.match_results drop constraint if exists match_results_points_check;
alter table public.match_results add constraint match_results_points_check check (points between -100000 and 100000);

update public.games set placement_points = public.scale_points(placement_points, 100), kill_points = kill_points * 100;
update public.tournaments set placement_points = public.scale_points(placement_points, 100),
  house_points = public.scale_points(house_points, 100), kill_points = kill_points * 100;
update public.match_results set points = points * 100;
update public.entries set points_adjust = points_adjust * 100;

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

-- The player confirms the in-game name they will play with; a changed name
-- is validated, must stay unique in the event, and is audited.
create function public.check_in(p_tournament_id uuid, p_ig_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me   public.profiles := public.require_player();
  m    public.entry_members;
  g    public.games;
  v_ig text := btrim(coalesce(p_ig_id, ''));
begin
  perform public.throttle('checkin', 20, interval '1 hour');
  select * into m from public.entry_members where tournament_id = p_tournament_id and user_id = me.id for update;
  if not found then
    raise exception 'Register for this event first' using errcode = 'P0001', hint = 'NOT_REGISTERED';
  end if;
  if not exists (select 1 from public.lobby_agreements a where a.tournament_id = p_tournament_id
                 and a.user_id = me.id and a.version >= public.lobby_rules_version()) then
    raise exception 'Accept the lobby rules first' using errcode = 'P0001', hint = 'RULES_REQUIRED';
  end if;
  if not coalesce((select l.checkin_open from public.event_lobby l where l.tournament_id = p_tournament_id), false) then
    raise exception 'Check-in is not open yet' using errcode = 'P0001', hint = 'CHECKIN_CLOSED';
  end if;
  select g2.* into g from public.games g2 join public.tournaments t on t.game_id = g2.id where t.id = p_tournament_id;
  if v_ig = '' or char_length(v_ig) > 64 or v_ig !~ g.ig_id_pattern then
    raise exception 'That % does not look right. %', g.ig_id_label, g.ig_id_hint using errcode = 'P0001', hint = 'BAD_IG_ID';
  end if;
  if v_ig is distinct from m.ig_id then
    update public.entry_members set ig_id = v_ig where entry_id = m.entry_id and user_id = me.id;
    perform public.audit('ig.change', p_tournament_id::text, jsonb_build_object('user', me.username, 'from', m.ig_id, 'to', v_ig));
  end if;
  update public.entry_members set checked_in_at = now() where entry_id = m.entry_id and user_id = me.id;
  perform public.audit('checkin', p_tournament_id::text, jsonb_build_object('ig_id', v_ig));
exception
  when unique_violation then
    raise exception 'Another player in this event already uses that in-game name' using errcode = 'P0001', hint = 'IG_ID_TAKEN';
end $$;

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
  if p_open and p_notify then
    insert into public.event_notices (tournament_id, kind, title, body, created_by)
    values (p_tournament_id, 'live', 'Check-in is open',
      'Open the Lobby, confirm your in-game name and check in. Only checked-in players get the room code.', auth.uid());
  end if;
  perform public.audit('checkin.toggle', p_tournament_id::text, jsonb_build_object('open', p_open));
end $$;

-- ---------------------------------------------------------------------
-- 4. Lobby readers, now with the default Meet and check-in
-- ---------------------------------------------------------------------
create or replace function public.event_lobby(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  l       public.event_lobby;
  m       public.entry_members;
  v_staff boolean := public.is_staff();
  v_in    boolean;
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
  v_in := m.checked_in_at is not null;
  return jsonb_build_object(
    'registered', true, 'agreed', true,
    'checkin_open', coalesce(l.checkin_open, false),
    'checked_in', v_in, 'checked_in_at', m.checked_in_at, 'my_ig_id', m.ig_id,
    'meet_url', coalesce(l.meet_url, public.default_meet_url()), 'chat_url', l.chat_url,
    'has_room', l.room_code is not null,
    'room_code', case when v_in or v_staff then l.room_code end,
    'room_password', case when v_in or v_staff then l.room_password end,
    'note', coalesce(l.note, ''), 'updated_at', l.updated_at,
    'notices', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body,
                                          'created_at', n.created_at) order by n.created_at desc)
      from public.event_notices n where n.tournament_id = p_tournament_id), '[]'));
end $$;

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

-- ---------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------
revoke execute on function public.scale_points(jsonb, numeric), public.default_meet_url() from public, anon, authenticated;
grant execute on function public.check_in(uuid, text) to authenticated;
grant execute on function
  public.admin_set_default_meet(text), public.admin_set_checkin(uuid, boolean, boolean)
to authenticated;
