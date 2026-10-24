-- =====================================================================
-- Player-facing RPCs: onboarding, profile, registration, teams,
-- game requests, and the public read endpoints (leaderboards, rosters).
-- Errors carry a machine code in HINT; the web app maps it to copy.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Onboarding and profile
-- ---------------------------------------------------------------------
create function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(btrim(p_username)) ~ '^[a-z][a-z0-9_]{2,19}$'
     and not exists (select 1 from public.reserved_usernames where name = lower(btrim(p_username)))
     and lower(btrim(p_username)) !~ '(admin|moder|staff|offici|pugmark|iitm|organi[sz]|support|esport|superuser|root)'
     and not exists (select 1 from public.profiles where lower(username) = lower(btrim(p_username)))
$$;

create function public.complete_profile(
  p_username  text,
  p_full_name text,
  p_house_id  smallint,
  p_region_id smallint,
  p_whatsapp  text,
  p_accept_rules boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_user  text := lower(btrim(coalesce(p_username, '')));
  v_name  text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
begin
  if v_uid is null then
    raise exception 'Please sign in first' using errcode = '42501', hint = 'AUTH_REQUIRED';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Your profile is already set up' using errcode = 'P0001', hint = 'PROFILE_EXISTS';
  end if;

  if not public.session_ok() then
    raise exception 'Sign in with the emailed code' using errcode = '42501', hint = 'AUTH_METHOD';
  end if;
  -- Only a mailbox-verified address counts.
  select lower(email) into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null or not public.email_domain_allowed(v_email) then
    raise exception 'Only IIT Madras BS student emails can join' using errcode = '42501', hint = 'BAD_DOMAIN';
  end if;

  if p_accept_rules is not true then
    raise exception 'Please accept the rules to continue' using errcode = 'P0001', hint = 'RULES_REQUIRED';
  end if;
  if v_user !~ '^[a-z][a-z0-9_]{2,19}$' then
    raise exception 'Username: 3-20 characters, lowercase letters, numbers and _, starting with a letter'
      using errcode = 'P0001', hint = 'BAD_USERNAME';
  end if;
  if exists (select 1 from public.reserved_usernames where name = v_user)
     or v_user ~ '(admin|moder|staff|offici|pugmark|iitm|organi[sz]|support|esport|superuser|root)' then
    raise exception 'That username is reserved' using errcode = 'P0001', hint = 'USERNAME_TAKEN';
  end if;
  if exists (select 1 from public.profiles where lower(username) = v_user) then
    raise exception 'That username is taken' using errcode = 'P0001', hint = 'USERNAME_TAKEN';
  end if;
  if v_name !~ '^[[:alpha:]][[:alpha:] .''-]{1,59}$' then
    raise exception 'Enter your full name as on your IITM records' using errcode = 'P0001', hint = 'BAD_NAME';
  end if;
  if not exists (select 1 from public.houses where id = p_house_id) then
    raise exception 'Pick your house' using errcode = 'P0001', hint = 'BAD_HOUSE';
  end if;
  if not exists (select 1 from public.regions where id = p_region_id and is_active) then
    raise exception 'Pick your region' using errcode = 'P0001', hint = 'BAD_REGION';
  end if;

  insert into public.profiles (id, email, username, full_name, house_id, region_id, whatsapp, rules_accepted_at)
  values (v_uid, v_email, v_user, v_name, p_house_id, p_region_id, public.normalize_whatsapp(p_whatsapp), now());

  -- First sign-in of a bootstrap superadmin grants the role, only while no superadmin exists.
  if not exists (select 1 from public.user_roles where role = 'superadmin') and exists (
    select 1 from public.app_settings s, jsonb_array_elements_text(s.value) e(email)
    where s.key = 'bootstrap_superadmins' and lower(e.email) = v_email
  ) then
    insert into public.user_roles (user_id, role) values (v_uid, 'superadmin') on conflict do nothing;
  end if;

  perform public.audit('profile.create', v_uid::text, jsonb_build_object('username', v_user));
exception
  when unique_violation then
    raise exception 'That username is taken' using errcode = 'P0001', hint = 'USERNAME_TAKEN';
end $$;

-- Own profile with private fields and roles; null when not onboarded.
create function public.get_my_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'email', p.email, 'username', p.username, 'full_name', p.full_name,
    'house_id', p.house_id, 'region_id', p.region_id, 'whatsapp', p.whatsapp,
    'status', p.status, 'created_at', p.created_at,
    'roles', coalesce((select jsonb_agg(r.role) from public.user_roles r where r.user_id = p.id), '[]'))
  from public.profiles p where p.id = auth.uid()
$$;

-- Only WhatsApp is editable by the player. Name, house and region are
-- locked after onboarding (admins can correct them).
create function public.update_my_whatsapp(p_whatsapp text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_player();
begin
  if me.whatsapp is not distinct from public.normalize_whatsapp(p_whatsapp) then
    return;
  end if;
  perform public.throttle('whatsapp', 5, interval '1 day');
  update public.profiles set whatsapp = public.normalize_whatsapp(p_whatsapp) where id = me.id;
  perform public.audit('profile.whatsapp', me.id::text);
end $$;

-- ---------------------------------------------------------------------
-- Registration
-- ---------------------------------------------------------------------
create function public.lock_open_tournament(p_tournament_id uuid) returns public.tournaments
language plpgsql security definer set search_path = '' as $$
declare
  v public.tournaments;
begin
  select * into v from public.tournaments where id = p_tournament_id for update;
  if not found or v.status = 'draft' then
    raise exception 'Event not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  if not public.registration_open(v) then
    raise exception 'Registration for this event is closed' using errcode = 'P0001', hint = 'REG_CLOSED';
  end if;
  return v;
end $$;

create function public.check_capacity(t public.tournaments) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if t.max_entries is not null
     and (select count(*) from public.entries e where e.tournament_id = t.id) >= t.max_entries then
    raise exception 'This event is full' using errcode = 'P0001', hint = 'EVENT_FULL';
  end if;
end $$;

create function public.check_not_registered(p_tournament_id uuid, p_user uuid, p_ig_id text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from public.entry_members where tournament_id = p_tournament_id and user_id = p_user) then
    raise exception 'You are already registered for this event' using errcode = 'P0001', hint = 'ALREADY_REGISTERED';
  end if;
  if exists (select 1 from public.entry_members
             where tournament_id = p_tournament_id and lower(btrim(ig_id)) = lower(btrim(p_ig_id))) then
    raise exception 'That in-game ID is already registered in this event' using errcode = 'P0001', hint = 'IG_ID_TAKEN';
  end if;
end $$;

create function public.register_solo(p_tournament_id uuid, p_ig_id text, p_extra jsonb default '{}')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_player();
  v_t public.tournaments;
  v_g public.games;
  v_extra jsonb;
  v_entry uuid;
begin
  perform public.throttle('reg', 30, interval '1 hour');
  v_t := public.lock_open_tournament(p_tournament_id);
  select * into v_g from public.games where id = v_t.game_id;
  if v_g.team_size <> 1 then
    raise exception 'This is a team event. Create or join a team.' using errcode = 'P0001', hint = 'TEAM_EVENT';
  end if;
  v_extra := public.validate_game_fields(v_g, p_ig_id, p_extra);
  perform public.check_capacity(v_t);
  perform public.check_not_registered(v_t.id, me.id, p_ig_id);

  insert into public.entries (tournament_id, name, captain_id, house_id)
  values (v_t.id, me.username, me.id, me.house_id) returning id into v_entry;
  insert into public.entry_members (entry_id, tournament_id, user_id, role, ig_id, extra)
  values (v_entry, v_t.id, me.id, 'captain', btrim(p_ig_id), v_extra);

  perform public.audit('entry.solo', v_entry::text, jsonb_build_object('tournament', v_t.id));
  return v_entry;
exception
  when unique_violation then
    raise exception 'You or that in-game ID is already registered' using errcode = 'P0001', hint = 'ALREADY_REGISTERED';
end $$;

create function public.create_team(
  p_tournament_id uuid, p_team_name text, p_ig_id text, p_extra jsonb default '{}'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_player();
  v_t public.tournaments;
  v_g public.games;
  v_extra jsonb;
  v_name text := regexp_replace(btrim(coalesce(p_team_name, '')), '\s+', ' ', 'g');
  v_entry uuid;
  v_code text;
begin
  perform public.throttle('reg', 30, interval '1 hour');
  v_t := public.lock_open_tournament(p_tournament_id);
  select * into v_g from public.games where id = v_t.game_id;
  if v_g.team_size = 1 then
    raise exception 'This is a solo event' using errcode = 'P0001', hint = 'SOLO_EVENT';
  end if;
  if v_name !~ '^[[:alnum:]][[:alnum:] ._-]{1,31}$' then
    raise exception 'Team name: 2-32 letters, numbers, spaces, . _ -' using errcode = 'P0001', hint = 'BAD_TEAM_NAME';
  end if;
  v_extra := public.validate_game_fields(v_g, p_ig_id, p_extra);
  perform public.check_capacity(v_t);
  perform public.check_not_registered(v_t.id, me.id, p_ig_id);
  if exists (select 1 from public.entries where tournament_id = v_t.id and lower(name) = lower(v_name)) then
    raise exception 'A team with that name already exists in this event' using errcode = 'P0001', hint = 'TEAM_NAME_TAKEN';
  end if;

  v_code := public.new_invite_code();
  insert into public.entries (tournament_id, name, captain_id, house_id, invite_code)
  values (v_t.id, v_name, me.id, case when v_t.same_house_teams then me.house_id end, v_code)
  returning id into v_entry;
  insert into public.entry_members (entry_id, tournament_id, user_id, role, ig_id, extra)
  values (v_entry, v_t.id, me.id, 'captain', btrim(p_ig_id), v_extra);

  perform public.audit('entry.team.create', v_entry::text, jsonb_build_object('tournament', v_t.id, 'name', v_name));
  return jsonb_build_object('entry_id', v_entry, 'invite_code', v_code);
exception
  when unique_violation then
    raise exception 'You, that in-game ID, or that team name is already registered' using errcode = 'P0001', hint = 'ALREADY_REGISTERED';
end $$;

-- Preview a team from an invite code before joining (no private data).
create function public.team_by_invite(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  r jsonb;
begin
  perform public.require_player();
  perform public.throttle('invite', 30, interval '1 hour');
  select jsonb_build_object(
    'entry_id', e.id, 'team_name', e.name, 'tournament_id', t.id, 'tournament_title', t.title,
    'tournament_slug', t.slug, 'game_title', g.title, 'house_id', e.house_id,
    'team_size', g.team_size, 'max_subs', g.max_subs,
    'members', (select count(*) from public.entry_members m where m.entry_id = e.id),
    'open', public.registration_open(t))
  into r
  from public.entries e
  join public.tournaments t on t.id = e.tournament_id
  join public.games g on g.id = t.game_id
  where e.invite_code = upper(btrim(p_code)) and e.status = 'active';
  if r is null then
    raise exception 'That invite code is not valid' using errcode = 'P0001', hint = 'BAD_INVITE';
  end if;
  return r;
end $$;

create function public.join_team(p_code text, p_ig_id text, p_extra jsonb default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_player();
  v_e public.entries;
  v_t public.tournaments;
  v_g public.games;
  v_extra jsonb;
  v_count int;
  v_role text;
begin
  perform public.throttle('invite', 30, interval '1 hour');
  perform public.throttle('reg', 30, interval '1 hour');
  select * into v_e from public.entries
  where invite_code = upper(btrim(coalesce(p_code, ''))) and status = 'active'
  for update;
  if not found then
    raise exception 'That invite code is not valid' using errcode = 'P0001', hint = 'BAD_INVITE';
  end if;
  v_t := public.lock_open_tournament(v_e.tournament_id);
  select * into v_g from public.games where id = v_t.game_id;
  if v_t.same_house_teams and v_e.house_id is distinct from me.house_id then
    raise exception 'Teams in this event are same-house only' using errcode = 'P0001', hint = 'WRONG_HOUSE';
  end if;
  v_extra := public.validate_game_fields(v_g, p_ig_id, p_extra);
  perform public.check_not_registered(v_t.id, me.id, p_ig_id);

  select count(*) into v_count from public.entry_members where entry_id = v_e.id;
  if v_count >= v_g.team_size + v_g.max_subs then
    raise exception 'This team is full' using errcode = 'P0001', hint = 'TEAM_FULL';
  end if;
  v_role := case when v_count >= v_g.team_size then 'sub' else 'player' end;

  insert into public.entry_members (entry_id, tournament_id, user_id, role, ig_id, extra)
  values (v_e.id, v_t.id, me.id, v_role, btrim(p_ig_id), v_extra);
  perform public.audit('entry.team.join', v_e.id::text, jsonb_build_object('role', v_role));
  return v_e.id;
exception
  when unique_violation then
    raise exception 'You or that in-game ID is already registered' using errcode = 'P0001', hint = 'ALREADY_REGISTERED';
end $$;

-- A member leaves; a captain leaving withdraws the whole entry.
-- Only while registration is open.
create function public.leave_entry(p_entry_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_player();
  v_e public.entries;
begin
  select * into v_e from public.entries where id = p_entry_id for update;
  if not found or not exists (select 1 from public.entry_members where entry_id = p_entry_id and user_id = me.id) then
    raise exception 'You are not in this entry' using errcode = 'P0001', hint = 'NOT_MEMBER';
  end if;
  perform public.throttle('reg', 30, interval '1 hour');
  perform public.lock_open_tournament(v_e.tournament_id);
  if exists (select 1 from public.match_results where entry_id = v_e.id) then
    raise exception 'Results are already recorded for this entry' using errcode = 'P0001', hint = 'HAS_RESULTS';
  end if;

  if v_e.captain_id = me.id then
    delete from public.entries where id = v_e.id;
    perform public.audit('entry.withdraw', v_e.id::text, jsonb_build_object('tournament', v_e.tournament_id));
  else
    delete from public.entry_members where entry_id = v_e.id and user_id = me.id;
    perform public.reslot_subs(v_e.id);
    perform public.audit('entry.team.leave', v_e.id::text);
  end if;
end $$;

-- After someone leaves, promote the earliest sub into an open slot.
create function public.reslot_subs(p_entry_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_size int;
begin
  select g.team_size into v_size
  from public.entries e join public.tournaments t on t.id = e.tournament_id
  join public.games g on g.id = t.game_id where e.id = p_entry_id;
  update public.entry_members set role = 'player'
  where entry_id = p_entry_id and user_id = (
    select user_id from public.entry_members where entry_id = p_entry_id and role = 'sub'
    order by joined_at limit 1)
  and (select count(*) from public.entry_members where entry_id = p_entry_id and role <> 'sub') < v_size;
end $$;

create function public.kick_member(p_entry_id uuid, p_username text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_player();
  v_e public.entries;
  v_target uuid;
begin
  select * into v_e from public.entries where id = p_entry_id for update;
  if not found or v_e.captain_id <> me.id then
    raise exception 'Only the captain can remove players' using errcode = '42501', hint = 'NOT_CAPTAIN';
  end if;
  perform public.throttle('reg', 30, interval '1 hour');
  perform public.lock_open_tournament(v_e.tournament_id);
  if exists (select 1 from public.match_results where entry_id = v_e.id) then
    raise exception 'Results are already recorded for this entry' using errcode = 'P0001', hint = 'HAS_RESULTS';
  end if;
  select p.id into v_target from public.profiles p
  join public.entry_members m on m.user_id = p.id and m.entry_id = v_e.id
  where lower(p.username) = lower(btrim(p_username));
  if v_target is null or v_target = me.id then
    raise exception 'That player is not on your team' using errcode = 'P0001', hint = 'NOT_MEMBER';
  end if;
  delete from public.entry_members where entry_id = v_e.id and user_id = v_target;
  perform public.reslot_subs(v_e.id);
  perform public.audit('entry.team.kick', v_e.id::text, jsonb_build_object('user', v_target));
end $$;

create function public.regenerate_invite(p_entry_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_player();
  v_code text := public.new_invite_code();
begin
  perform public.throttle('invite', 30, interval '1 hour');
  update public.entries set invite_code = v_code
  where id = p_entry_id and captain_id = me.id and invite_code is not null;
  if not found then
    raise exception 'Only the captain can do that' using errcode = '42501', hint = 'NOT_CAPTAIN';
  end if;
  return v_code;
end $$;

-- Everything the signed-in player is registered for, with teammates.
create function public.my_entries() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x ->> 'starts_at' nulls last), '[]')
  from (
    select jsonb_build_object(
      'entry_id', e.id, 'name', e.name, 'status', e.status,
      'is_captain', e.captain_id = auth.uid(),
      'invite_code', case when e.captain_id = auth.uid() then e.invite_code end,
      'my_ig_id', mine.ig_id, 'my_role', mine.role,
      'tournament', jsonb_build_object('id', t.id, 'slug', t.slug, 'title', t.title, 'status', t.status,
                                       'starts_at', t.starts_at, 'reg_open', public.registration_open(t)),
      'game', jsonb_build_object('slug', g.slug, 'title', g.title, 'team_size', g.team_size,
                                 'max_subs', g.max_subs, 'cover_path', g.cover_path),
      'members', (select jsonb_agg(jsonb_build_object('username', p.username, 'role', m.role, 'house_id', p.house_id)
                                   order by m.joined_at)
                  from public.entry_members m join public.profiles p on p.id = m.user_id
                  where m.entry_id = e.id),
      'starts_at', t.starts_at) as x
    from public.entry_members mine
    join public.entries e on e.id = mine.entry_id
    join public.tournaments t on t.id = e.tournament_id
    join public.games g on g.id = t.game_id
    where mine.user_id = auth.uid()
  ) s
$$;

-- ---------------------------------------------------------------------
-- Game requests (max 3 per player per 24h)
-- ---------------------------------------------------------------------
create function public.request_game(p_game_name text, p_platform text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_player();
begin
  perform pg_advisory_xact_lock(hashtextextended(me.id::text || 'request_game', 0));
  if (select count(*) from public.game_requests
      where user_id = me.id and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'You can send 3 requests a day' using errcode = 'P0001', hint = 'RATE_LIMITED';
  end if;
  insert into public.game_requests (user_id, game_name, platform, note)
  values (me.id, btrim(p_game_name), btrim(coalesce(p_platform, '')), btrim(coalesce(p_note, '')));
end $$;

-- ---------------------------------------------------------------------
-- Public reads
-- ---------------------------------------------------------------------
-- Standings for one tournament: one row per entry, ranked.
create function public.tournament_standings(p_tournament_id uuid)
returns table (
  rank bigint, entry_id uuid, name text, house_id smallint, members jsonb,
  points numeric, matches bigint, wins bigint, kills bigint, best_placement smallint,
  status text, is_mine boolean
)
language sql stable security definer set search_path = '' as $$
  with t as (
    select * from public.tournaments where id = p_tournament_id and (status <> 'draft' or public.is_staff())
  ), agg as (
    select e.id, e.name, e.house_id, e.status,
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
    exists (select 1 from public.entry_members m where m.entry_id = a.id and m.user_id = auth.uid())
  from agg a
  order by a.status = 'active' desc, a.points desc, a.wins desc, a.kills desc, a.best_placement asc nulls last, a.name
$$;

-- House standings for a season. Each completed event's placement earns
-- house points (tournament.house_points); a team's points are split
-- equally among its non-sub members, each share going to that member's
-- house. Mixed-house teams therefore count fairly for every house.
create function public.house_standings(p_season text default null)
returns table (rank bigint, house_id smallint, points numeric, podiums bigint, players bigint)
language sql stable security definer set search_path = '' as $$
  with done as (
    select id, house_points from public.tournaments
    where status = 'completed' and (p_season is null or season = p_season)
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
    from public.entry_members m join done d on d.id = m.tournament_id
    join public.profiles p on p.id = m.user_id group by p.house_id
  )
  select rank() over (order by coalesce(pts.points, 0) desc), h.id, round(coalesce(pts.points, 0), 2),
         coalesce(pts.podiums, 0), coalesce(ppl.players, 0)
  from public.houses h left join pts on pts.house_id = h.id left join ppl on ppl.house_id = h.id
  order by 1, h.name
$$;

-- Public roster counts per tournament (for event cards).
create function public.tournament_counts()
returns table (tournament_id uuid, entries bigint, players bigint)
language sql stable security definer set search_path = '' as $$
  select t.id, count(distinct e.id), count(m.user_id)
  from public.tournaments t
  left join public.entries e on e.tournament_id = t.id
  left join public.entry_members m on m.entry_id = e.id
  where t.status <> 'draft'
  group by t.id
$$;

-- Per-match breakdown for one tournament (public once not draft).
create function public.tournament_match_results(p_tournament_id uuid)
returns table (match_id uuid, label text, played_at timestamptz, entry_id uuid, placement smallint, kills smallint, points numeric)
language sql stable security definer set search_path = '' as $$
  select mt.id, mt.label, mt.played_at, r.entry_id, r.placement, r.kills, r.points
  from public.matches mt
  join public.tournaments t on t.id = mt.tournament_id
  join public.match_results r on r.match_id = mt.id
  where mt.tournament_id = p_tournament_id and (t.status <> 'draft' or public.is_staff())
  order by mt.played_at, mt.label, r.points desc
$$;
