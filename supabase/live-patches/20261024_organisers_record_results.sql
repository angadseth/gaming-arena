-- Live patch 24 Oct: organisers may record and delete match results (staff, not only admins).

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

create or replace function public.admin_delete_match(p_match_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Organisers run matches, so results are open to all staff.
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  delete from public.matches where id = p_match_id;
  if not found then
    raise exception 'Match not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  perform public.audit('match.delete', p_match_id::text);
end $$;
