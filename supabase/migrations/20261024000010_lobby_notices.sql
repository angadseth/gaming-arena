-- =====================================================================
-- Match lobby + notices (24 Oct 2026, asked for Stumble Guys first).
--
--   * games.play_links / games.join_steps: public "get the game" links
--     (browser, Play Store, App Store, Steam...) and how to enter a
--     custom room. Same for every event of that game.
--   * event_lobby: the private side of an event: Google Meet link,
--     WhatsApp group link, room code + password, a note. Only players
--     registered in that event (and staff) can read it. tournaments is
--     world-readable, so none of this may live there.
--   * event_notices: announcements organisers post to one event.
--     Registered players see them on the event page and in their inbox;
--     profiles.notices_seen_at drives the unread badge.
-- Nothing here is granted to clients directly; RPCs only.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Play links and join steps on the game
-- ---------------------------------------------------------------------
alter table public.games
  add column play_links jsonb not null default '[]' check (jsonb_typeof(play_links) = 'array'),
  add column join_steps jsonb not null default '[]' check (jsonb_typeof(join_steps) = 'array');

-- [{kind, label, url}], kind one of the platform keys; https links only.
create function public.clean_play_links(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  l jsonb;
  out jsonb := '[]';
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 8 then
    raise exception 'Up to 8 play links' using errcode = 'P0001', hint = 'BAD_INPUT';
  end if;
  for l in select * from jsonb_array_elements(p) loop
    if coalesce(l ->> 'kind', '') not in ('web', 'android', 'ios', 'pc', 'mac', 'console')
       or char_length(btrim(coalesce(l ->> 'label', ''))) not between 2 and 40
       or coalesce(l ->> 'url', '') !~ '^https://[^\s<>"]{4,}$' or char_length(l ->> 'url') > 300 then
      raise exception 'Each play link needs a kind, a label and an https:// address'
        using errcode = 'P0001', hint = 'BAD_INPUT';
    end if;
    out := out || jsonb_build_array(jsonb_build_object(
      'kind', l ->> 'kind', 'label', btrim(l ->> 'label'), 'url', l ->> 'url'));
  end loop;
  return out;
end $$;

create function public.admin_set_game_play(p_game_id uuid, p_play_links jsonb, p_join_steps jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_steps jsonb := '[]';
  s text;
begin
  perform public.require_admin();
  if p_join_steps is null or jsonb_typeof(p_join_steps) <> 'array' or jsonb_array_length(p_join_steps) > 12 then
    raise exception 'Up to 12 join steps' using errcode = 'P0001', hint = 'BAD_INPUT';
  end if;
  for s in select btrim(x) from jsonb_array_elements_text(p_join_steps) x loop
    if s = '' then continue; end if;
    if char_length(s) > 300 then
      raise exception 'Keep each step under 300 characters' using errcode = 'P0001', hint = 'BAD_INPUT';
    end if;
    v_steps := v_steps || to_jsonb(s);
  end loop;
  update public.games set play_links = public.clean_play_links(p_play_links), join_steps = v_steps
  where id = p_game_id;
  if not found then
    raise exception 'Game not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  perform public.audit('game.play', p_game_id::text);
end $$;

update public.games set
  play_links = $j$[
    {"kind":"web","label":"Play in browser","url":"https://www.stumbleguys.com/play"},
    {"kind":"android","label":"Google Play","url":"https://play.google.com/store/apps/details?id=com.kitkagames.fallbuddies"},
    {"kind":"ios","label":"App Store","url":"https://apps.apple.com/us/app/stumble-guys/id1541153375"},
    {"kind":"pc","label":"Steam (PC)","url":"https://store.steampowered.com/app/1677740/Stumble_Guys/"}
  ]$j$::jsonb,
  join_steps = $j$[
    "Install the game, or play it in the browser",
    "Set your in-game name to the one you registered",
    "Settings > Region: pick the one in the lobby note",
    "Join the Google Meet 10 min before the start",
    "Party > Join > type the room code > Join",
    "Stay in the room and screenshot every final"
  ]$j$::jsonb
where slug = 'stumble-guys';

-- ---------------------------------------------------------------------
-- 2. Private lobby per event
-- ---------------------------------------------------------------------
create table public.event_lobby (
  tournament_id uuid primary key references public.tournaments (id) on delete cascade,
  meet_url      text check (meet_url is null or (meet_url ~ '^https://[^\s<>"]{4,}$' and char_length(meet_url) <= 300)),
  chat_url      text check (chat_url is null or (chat_url ~ '^https://[^\s<>"]{4,}$' and char_length(chat_url) <= 300)),
  room_code     text check (room_code is null or char_length(room_code) between 1 and 40),
  room_password text check (room_password is null or char_length(room_password) between 1 and 40),
  note          text not null default '' check (char_length(note) <= 1000),
  updated_by    uuid references public.profiles (id),
  updated_at    timestamptz not null default now()
);
alter table public.event_lobby enable row level security;

-- Registered (any entry status) or staff.
create function public.in_event(p_tournament_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_staff() or (public.session_ok() and exists (
    select 1 from public.entry_members m join public.profiles p on p.id = m.user_id
    where m.tournament_id = p_tournament_id and m.user_id = auth.uid() and p.status = 'active'))
$$;

-- Players accept the lobby code of conduct once per event before the
-- Meet link and room code are shown to them (Angad asked for this).
-- Bump lobby_rules_version in app_settings to make everyone accept again.
create table public.lobby_agreements (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  version       int not null,
  accepted_at   timestamptz not null default now(),
  primary key (tournament_id, user_id)
);
alter table public.lobby_agreements enable row level security;
insert into public.app_settings (key, value) values ('lobby_rules_version', '1');

create function public.lobby_rules_version() returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = 'lobby_rules_version'), 1)
$$;

create function public.accept_lobby_rules(p_tournament_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_player();
begin
  if not exists (select 1 from public.entry_members where tournament_id = p_tournament_id and user_id = me.id) then
    raise exception 'Register for this event first' using errcode = 'P0001', hint = 'NOT_REGISTERED';
  end if;
  insert into public.lobby_agreements (tournament_id, user_id, version)
  values (p_tournament_id, me.id, public.lobby_rules_version())
  on conflict (tournament_id, user_id) do update set version = excluded.version, accepted_at = now();
  perform public.audit('lobby.accept', p_tournament_id::text);
end $$;

-- What the event page shows in its Lobby tab. Outsiders get only "registered: false";
-- registered players who have not accepted the lobby rules get "agreed: false".
create function public.event_lobby(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  l public.event_lobby;
begin
  if not public.in_event(p_tournament_id) then
    return jsonb_build_object('registered', false);
  end if;
  if not public.is_staff() and not exists (
    select 1 from public.lobby_agreements a
    where a.tournament_id = p_tournament_id and a.user_id = auth.uid() and a.version >= public.lobby_rules_version()) then
    return jsonb_build_object('registered', true, 'agreed', false,
      'has_room', exists (select 1 from public.event_lobby x where x.tournament_id = p_tournament_id and x.room_code is not null));
  end if;
  select * into l from public.event_lobby where tournament_id = p_tournament_id;
  return jsonb_build_object(
    'registered', true, 'agreed', true,
    'meet_url', l.meet_url, 'chat_url', l.chat_url,
    'room_code', l.room_code, 'room_password', l.room_password,
    'note', coalesce(l.note, ''), 'updated_at', l.updated_at,
    'notices', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body,
                                          'created_at', n.created_at) order by n.created_at desc)
      from public.event_notices n where n.tournament_id = p_tournament_id), '[]'));
end $$;

-- ---------------------------------------------------------------------
-- 3. Notices
-- ---------------------------------------------------------------------
create table public.event_notices (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  kind          text not null default 'info' check (kind in ('info', 'room', 'live', 'reminder', 'result')),
  title         text not null check (char_length(title) between 2 and 80),
  body          text not null default '' check (char_length(body) <= 1500),
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);
create index event_notices_t_idx on public.event_notices (tournament_id, created_at desc);
alter table public.event_notices enable row level security;

alter table public.profiles add column notices_seen_at timestamptz;

-- Staff only. Saving room details can post a "room" notice in the same call.
create function public.admin_set_lobby(p_tournament_id uuid, p jsonb, p_notify boolean default false) returns void
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
    insert into public.event_notices (tournament_id, kind, title, body, created_by)
    values (p_tournament_id, 'room',
      case when v_code is null then 'Lobby details updated' else 'Room code is up: ' || v_code end,
      'Open the event''s Lobby tab for the Meet link, room code and steps.', auth.uid());
  end if;
  perform public.audit('lobby.set', p_tournament_id::text, jsonb_build_object('notify', p_notify));
exception
  when check_violation then
    raise exception 'Links must start with https:// and codes stay under 40 characters'
      using errcode = 'P0001', hint = 'BAD_INPUT';
end $$;

create function public.admin_lobby(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  return (select public.event_lobby(p_tournament_id)) || jsonb_build_object(
    'recipients', (select count(distinct m.user_id) from public.entry_members m
                   join public.profiles p on p.id = m.user_id
                   where m.tournament_id = p_tournament_id and p.status = 'active'),
    'agreed_count', (select count(*) from public.lobby_agreements a
                     where a.tournament_id = p_tournament_id and a.version >= public.lobby_rules_version()),
    'emails', coalesce((select jsonb_agg(distinct p.email) from public.entry_members m
                        join public.profiles p on p.id = m.user_id
                        where m.tournament_id = p_tournament_id and p.status = 'active'), '[]'));
end $$;

create function public.admin_post_notice(p_tournament_id uuid, p_kind text, p_title text, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  perform public.throttle('notice', 30, interval '1 hour');
  if not exists (select 1 from public.tournaments where id = p_tournament_id) then
    raise exception 'Event not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  insert into public.event_notices (tournament_id, kind, title, body, created_by)
  values (p_tournament_id, coalesce(p_kind, 'info'), btrim(coalesce(p_title, '')), btrim(coalesce(p_body, '')), auth.uid())
  returning id into v_id;
  perform public.audit('notice.post', v_id::text, jsonb_build_object('tournament', p_tournament_id, 'title', p_title));
  return v_id;
exception
  when check_violation then
    raise exception 'Title 2-80 characters, message up to 1500' using errcode = 'P0001', hint = 'BAD_INPUT';
end $$;

create function public.admin_delete_notice(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  delete from public.event_notices where id = p_id;
  perform public.audit('notice.delete', p_id::text);
end $$;

-- The signed-in player's inbox: notices from every event they are in.
create function public.my_notices(p_limit int default 50) returns jsonb
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
      where exists (select 1 from public.entry_members m
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

create function public.mark_notices_seen() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_player();
begin
  update public.profiles set notices_seen_at = now() where id = me.id;
end $$;

-- ---------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------
revoke execute on function public.clean_play_links(jsonb), public.in_event(uuid) from public, anon, authenticated;
grant execute on function
  public.event_lobby(uuid), public.accept_lobby_rules(uuid), public.my_notices(int), public.mark_notices_seen()
to authenticated;
grant execute on function
  public.admin_set_game_play(uuid, jsonb, jsonb), public.admin_set_lobby(uuid, jsonb, boolean),
  public.admin_lobby(uuid), public.admin_post_notice(uuid, text, text, text), public.admin_delete_notice(uuid)
to authenticated;
