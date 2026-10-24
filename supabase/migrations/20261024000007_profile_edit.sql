-- =====================================================================
-- Players can edit their username, full name and WhatsApp number.
-- (24 Oct 2026: Angad replaced "username is permanent" with editing plus
-- a respectful-name warning; offensive names get the account banned.)
--
-- Guards against abuse:
--   * username: same rules as onboarding, at most once every 30 days,
--     never while one of the player's events is live;
--   * full name: at most 3 changes in 30 days;
--   * WhatsApp: at most 5 changes a day (as before);
--   * every rename is audited with the old and new value, so a player
--     cannot hide an offensive name by changing it again.
-- Email and id stay frozen. Username changes only through this RPC.
-- =====================================================================

alter table public.profiles add column username_changed_at timestamptz;

create or replace function public.profiles_freeze_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.email <> old.email then
    raise exception 'Email cannot be changed' using errcode = 'P0001', hint = 'IMMUTABLE';
  end if;
  if new.username <> old.username and coalesce(current_setting('pugmark.rename', true), '') <> 'on' then
    raise exception 'Username cannot be changed here; use your profile page' using errcode = 'P0001', hint = 'IMMUTABLE';
  end if;
  return new;
end $$;

-- Raises when a new username breaks a rule; shared by onboarding checks and renames.
create function public.check_username(p_username text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_username !~ '^[a-z][a-z0-9_]{2,19}$' then
    raise exception 'Username: 3-20 characters, lowercase letters, numbers and _, starting with a letter'
      using errcode = 'P0001', hint = 'BAD_USERNAME';
  end if;
  if exists (select 1 from public.reserved_usernames where name = p_username)
     or p_username ~ '(admin|moder|staff|offici|pugmark|iitm|organi[sz]|support|esport|superuser|root)' then
    raise exception 'That username is reserved' using errcode = 'P0001', hint = 'USERNAME_TAKEN';
  end if;
  if exists (select 1 from public.profiles where lower(username) = p_username) then
    raise exception 'That username is taken' using errcode = 'P0001', hint = 'USERNAME_TAKEN';
  end if;
end $$;

create function public.update_my_profile(p_username text, p_full_name text, p_whatsapp text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me     public.profiles := public.require_player();
  v_user text := lower(btrim(coalesce(p_username, '')));
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_wa   text := public.normalize_whatsapp(p_whatsapp);
begin
  -- Lock the row so two tabs cannot race past the cooldowns.
  perform 1 from public.profiles where id = me.id for update;

  if v_user <> me.username then
    if me.username_changed_at is not null and me.username_changed_at > now() - interval '30 days' then
      raise exception 'You can change your username again on %',
        to_char((me.username_changed_at + interval '30 days') at time zone 'Asia/Kolkata', 'DD Mon')
        using errcode = 'P0001', hint = 'RENAME_COOLDOWN';
    end if;
    if exists (
      select 1 from public.entry_members m
      join public.entries e on e.id = m.entry_id
      join public.tournaments t on t.id = e.tournament_id
      where m.user_id = me.id and t.status = 'live'
    ) then
      raise exception 'Usernames cannot change while one of your events is live'
        using errcode = 'P0001', hint = 'RENAME_LIVE';
    end if;
    perform public.check_username(v_user);

    perform set_config('pugmark.rename', 'on', true);
    update public.profiles set username = v_user, username_changed_at = now() where id = me.id;
    perform set_config('pugmark.rename', '', true);
    -- Solo entries are listed under the player's username: keep them in step.
    update public.entries e set name = v_user
    from public.tournaments t, public.games g
    where e.captain_id = me.id and lower(e.name) = lower(me.username)
      and t.id = e.tournament_id and g.id = t.game_id and g.team_size = 1;
    perform public.audit('profile.username', me.id::text, jsonb_build_object('from', me.username, 'to', v_user));
  end if;

  if v_name <> me.full_name then
    if v_name !~ '^[[:alpha:]][[:alpha:] .''-]{1,59}$' then
      raise exception 'Enter your full name as on your IITM records' using errcode = 'P0001', hint = 'BAD_NAME';
    end if;
    perform public.throttle('full_name', 3, interval '30 days');
    update public.profiles set full_name = v_name where id = me.id;
    perform public.audit('profile.full_name', me.id::text, jsonb_build_object('from', me.full_name, 'to', v_name));
  end if;

  if v_wa is distinct from me.whatsapp then
    perform public.throttle('whatsapp', 5, interval '1 day');
    update public.profiles set whatsapp = v_wa where id = me.id;
    perform public.audit('profile.whatsapp', me.id::text);
  end if;
exception
  when unique_violation then
    raise exception 'That username is taken' using errcode = 'P0001', hint = 'USERNAME_TAKEN';
end $$;

-- Profile payload now says when the next username change is allowed.
create or replace function public.get_my_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'email', p.email, 'username', p.username, 'full_name', p.full_name,
    'house_id', p.house_id, 'region_id', p.region_id, 'whatsapp', p.whatsapp,
    'status', p.status, 'created_at', p.created_at,
    'username_next_change', case when p.username_changed_at is null then null
                                 else p.username_changed_at + interval '30 days' end,
    'roles', coalesce((select jsonb_agg(r.role) from public.user_roles r where r.user_id = p.id), '[]'))
  from public.profiles p where p.id = auth.uid()
$$;

revoke all on function public.check_username(text) from public, anon, authenticated;
revoke all on function public.update_my_profile(text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text) to authenticated;
