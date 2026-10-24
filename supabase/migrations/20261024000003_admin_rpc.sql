-- =====================================================================
-- Admin RPCs. Every one starts with require_admin() (or a superadmin
-- check) and writes an audit_log row.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Games
-- ---------------------------------------------------------------------
create function public.admin_upsert_game(p jsonb) returns uuid
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
      coalesce(p -> 'placement_points', '{"1": 10, "2": 7, "3": 5, "4": 4, "5-8": 2, "9-16": 1}'),
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

-- ---------------------------------------------------------------------
-- Tournaments
-- ---------------------------------------------------------------------
create function public.admin_upsert_tournament(p jsonb) returns uuid
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
      coalesce(p -> 'house_points', '{"1": 10, "2": 7, "3": 5, "4": 4, "5-8": 2, "9-16": 1}'),
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

-- ---------------------------------------------------------------------
-- Registrations (staff view includes WhatsApp; nobody else ever sees it)
-- ---------------------------------------------------------------------
create function public.admin_registrations(p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'entry_id', e.id, 'name', e.name, 'status', e.status, 'house_id', e.house_id,
      'points_adjust', e.points_adjust, 'adjust_note', e.adjust_note, 'created_at', e.created_at,
      'members', (select jsonb_agg(jsonb_build_object(
          'username', p.username, 'full_name', p.full_name, 'email', p.email, 'whatsapp', p.whatsapp,
          'house_id', p.house_id, 'region_id', p.region_id, 'role', m.role, 'ig_id', m.ig_id, 'extra', m.extra)
          order by m.role, m.joined_at)
        from public.entry_members m join public.profiles p on p.id = m.user_id where m.entry_id = e.id))
      order by e.created_at)
    from public.entries e where e.tournament_id = p_tournament_id), '[]');
end $$;

create function public.admin_set_entry(p_entry_id uuid, p_status text, p_points_adjust numeric, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.entries set
    status = coalesce(p_status, status),
    points_adjust = coalesce(p_points_adjust, points_adjust),
    adjust_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_entry_id;
  if not found then
    raise exception 'Entry not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  perform public.audit('entry.admin_set', p_entry_id::text,
    jsonb_build_object('status', p_status, 'points_adjust', p_points_adjust, 'note', p_note));
end $$;

create function public.admin_remove_entry(p_entry_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_snapshot jsonb;
begin
  perform public.require_admin();
  select jsonb_build_object('name', e.name, 'tournament', e.tournament_id,
    'members', (select jsonb_agg(m.user_id) from public.entry_members m where m.entry_id = e.id))
  into v_snapshot from public.entries e where e.id = p_entry_id;
  if v_snapshot is null then
    raise exception 'Entry not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  delete from public.entries where id = p_entry_id;
  perform public.audit('entry.admin_remove', p_entry_id::text, v_snapshot || jsonb_build_object('reason', p_reason));
end $$;

-- ---------------------------------------------------------------------
-- Results. One call records one match atomically. Rows identify an
-- entry by entry_id, team name, or a member's username. If any row
-- fails, nothing is written and every problem is returned.
--   p_rows: [{"team": "Night Owls", "placement": 1, "kills": 12},
--            {"username": "gamer1", "placement": 2, "kills": 3, "points": 20}]
-- points, when absent, = placement_points[placement] + kills * kill_points.
-- ---------------------------------------------------------------------
create function public.admin_record_match(
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
  perform public.require_admin();
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
        where m.tournament_id = v_t.id and lower(btrim(m.ig_id)) = lower(btrim(r ->> 'ig_id'));
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
         or v_points < -1000 or v_points > 10000 then
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

create function public.admin_delete_match(p_match_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  delete from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  perform public.audit('match.delete', p_match_id::text);
end $$;

-- ---------------------------------------------------------------------
-- Users and roles
-- ---------------------------------------------------------------------
create function public.admin_search_users(p_query text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := lower(btrim(coalesce(p_query, '')));
begin
  perform public.require_admin();
  if char_length(q) < 2 then
    return '[]';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'username', p.username, 'full_name', p.full_name, 'email', p.email, 'whatsapp', p.whatsapp,
      'house_id', p.house_id, 'region_id', p.region_id, 'status', p.status, 'status_note', p.status_note,
      'created_at', p.created_at,
      'roles', coalesce((select jsonb_agg(r.role) from public.user_roles r where r.user_id = p.id), '[]')))
    from (select * from public.profiles
          where lower(username) like '%' || q || '%' or lower(email) like '%' || q || '%'
             or lower(full_name) like '%' || q || '%'
          order by username limit 50) p), '[]');
end $$;

create function public.admin_set_user_status(p_user_id uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own status' using errcode = 'P0001', hint = 'SELF';
  end if;
  if exists (select 1 from public.user_roles where user_id = p_user_id and role = 'superadmin')
     and not public.has_role(array['superadmin']) then
    raise exception 'Only a superadmin can do that to a superadmin' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  update public.profiles set status = p_status, status_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_user_id;
  if not found then
    raise exception 'User not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  perform public.audit('user.status', p_user_id::text, jsonb_build_object('status', p_status, 'note', p_note));
end $$;

-- Admins may correct a player's name, house or region (never username/email).
create function public.admin_correct_profile(p_user_id uuid, p_full_name text, p_house_id smallint, p_region_id smallint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if exists (select 1 from public.user_roles where user_id = p_user_id) and not public.has_role(array['superadmin']) then
    raise exception 'Only the superadmin can edit staff profiles' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  update public.profiles set
    full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
    house_id = coalesce(p_house_id, house_id),
    region_id = coalesce(p_region_id, region_id)
  where id = p_user_id;
  if not found then
    raise exception 'User not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  perform public.audit('user.correct', p_user_id::text,
    jsonb_build_object('full_name', p_full_name, 'house_id', p_house_id, 'region_id', p_region_id));
end $$;

create function public.superadmin_set_role(p_user_id uuid, p_role text, p_grant boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(array['superadmin']) then
    raise exception 'Superadmins only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  if p_role not in ('superadmin', 'admin', 'organizer') then
    raise exception 'Unknown role' using errcode = 'P0001', hint = 'BAD_INPUT';
  end if;
  if p_grant then
    insert into public.user_roles (user_id, role, granted_by) values (p_user_id, p_role, auth.uid())
    on conflict do nothing;
  else
    if p_user_id = auth.uid() and p_role = 'superadmin' then
      raise exception 'You cannot remove your own superadmin role' using errcode = 'P0001', hint = 'SELF';
    end if;
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
  perform public.audit(case when p_grant then 'role.grant' else 'role.revoke' end, p_user_id::text,
    jsonb_build_object('role', p_role));
end $$;

-- ---------------------------------------------------------------------
-- Game requests, regions, audit
-- ---------------------------------------------------------------------
create function public.admin_game_requests() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'game_name', r.game_name, 'platform', r.platform,
      'note', r.note, 'status', r.status, 'created_at', r.created_at, 'username', p.username)
      order by r.created_at desc)
    from (select * from public.game_requests order by created_at desc limit 300) r
    join public.profiles p on p.id = r.user_id), '[]');
end $$;

create function public.admin_set_request_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.game_requests set status = p_status where id = p_id;
  perform public.audit('request.status', p_id::text, jsonb_build_object('status', p_status));
end $$;

create function public.admin_upsert_region(p_id smallint, p_name text, p_sort smallint, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if p_id is null then
    insert into public.regions (name, sort_order, is_active) values (btrim(p_name), coalesce(p_sort, 0), coalesce(p_active, true));
  else
    update public.regions set name = btrim(p_name), sort_order = coalesce(p_sort, sort_order),
      is_active = coalesce(p_active, is_active) where id = p_id;
  end if;
  perform public.audit('region.upsert', coalesce(p_id::text, p_name));
end $$;

create function public.admin_audit(p_limit int default 200) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'action', a.action, 'target', a.target,
      'details', a.details, 'at', a.at, 'actor', p.username) order by a.id desc)
    from (select * from public.audit_log order by id desc limit least(greatest(p_limit, 1), 1000)) a
    left join public.profiles p on p.id = a.actor_id), '[]');
end $$;

-- ---------------------------------------------------------------------
-- Grants. Nothing is executable unless listed here.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Used inside RLS policies, so anon needs them too.
grant execute on function public.has_role(text[]), public.is_admin(), public.is_staff() to anon, authenticated;

-- Public reads.
grant execute on function
  public.tournament_standings(uuid), public.house_standings(text), public.tournament_counts(),
  public.tournament_match_results(uuid), public.registration_open(public.tournaments)
to anon, authenticated;

-- Signed-in players.
grant execute on function
  public.username_available(text),
  public.complete_profile(text, text, smallint, smallint, text, boolean),
  public.get_my_profile(), public.update_my_whatsapp(text),
  public.register_solo(uuid, text, jsonb), public.create_team(uuid, text, text, jsonb),
  public.team_by_invite(text), public.join_team(text, text, jsonb),
  public.leave_entry(uuid), public.kick_member(uuid, text), public.regenerate_invite(uuid),
  public.my_entries(), public.request_game(text, text, text)
to authenticated;

-- Admin RPCs check the role themselves; granting execute is safe.
grant execute on function
  public.admin_upsert_game(jsonb), public.admin_upsert_tournament(jsonb),
  public.admin_registrations(uuid), public.admin_set_entry(uuid, text, numeric, text),
  public.admin_remove_entry(uuid, text),
  public.admin_record_match(uuid, text, timestamptz, jsonb, boolean), public.admin_delete_match(uuid),
  public.admin_search_users(text), public.admin_set_user_status(uuid, text, text),
  public.admin_correct_profile(uuid, text, smallint, smallint),
  public.superadmin_set_role(uuid, text, boolean),
  public.admin_game_requests(), public.admin_set_request_status(uuid, text),
  public.admin_upsert_region(smallint, text, smallint, boolean), public.admin_audit(int)
to authenticated;

-- The auth server calls the hook; nobody else may.
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on public.app_settings to supabase_auth_admin;
