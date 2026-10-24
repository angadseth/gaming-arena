-- =====================================================================
-- Access by email: the superadmin can make someone an organiser/admin,
-- and admins can ban someone, by IITM email, before or after that person
-- has signed up. A banned email can never sign in again.
-- =====================================================================

create table public.email_access (
  email      text primary key check (email = lower(email)),
  role       text check (role in ('admin', 'organizer')),
  banned     boolean not null default false,
  note       text,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
alter table public.email_access enable row level security;
-- No client grants: RPCs only.

-- Allowed domain AND not banned.
create or replace function public.email_may_sign_in(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.email_domain_allowed(p_email)
     and not exists (select 1 from public.email_access a where a.email = lower(btrim(p_email)) and a.banned)
$$;

create or replace function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
begin
  if not public.email_may_sign_in(v_email) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Only IIT Madras BS student emails can sign in.'));
  end if;
  return '{}'::jsonb;
end $$;

-- Second line of defence if the hook is ever switched off.
create or replace function public.guard_auth_user_domain() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.email is not null and new.email is distinct from old.email then
    raise exception 'Email cannot be changed.' using errcode = '42501';
  end if;
  if coalesce(new.email_change, '') <> '' then
    raise exception 'Email cannot be changed.' using errcode = '42501';
  end if;
  -- Passwords cannot be blocked here: GoTrue stores a random password even for
  -- code-only users. Password sessions are refused by hook_custom_access_token
  -- and by public.session_ok() instead.
  if new.email is null or (tg_op = 'INSERT' and not public.email_may_sign_in(new.email))
     or not public.email_domain_allowed(new.email) then
    raise exception 'Only IIT Madras BS student emails can sign in.' using errcode = '42501';
  end if;
  return new;
end $$;

-- Ban by user id now also bans the email, so the person stays banned even if
-- their auth account is ever deleted and recreated. Only the superadmin can
-- change the status of an admin or another superadmin.
create or replace function public.admin_set_user_status(p_user_id uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
begin
  perform public.require_admin();
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own status' using errcode = 'P0001', hint = 'SELF';
  end if;
  if exists (select 1 from public.user_roles where user_id = p_user_id and role in ('superadmin', 'admin'))
     and not public.has_role(array['superadmin']) then
    raise exception 'Only the superadmin can do that to an admin' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  if exists (select 1 from public.user_roles where user_id = p_user_id and role = 'superadmin') and p_status <> 'active' then
    raise exception 'A superadmin cannot be suspended or banned' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  update public.profiles set status = p_status, status_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_user_id
  returning email into v_email;
  if not found then
    raise exception 'User not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  insert into public.email_access (email, banned, note, updated_by)
  values (v_email, p_status = 'banned', nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  on conflict (email) do update set banned = excluded.banned, note = excluded.note,
    updated_by = excluded.updated_by, updated_at = now();
  perform public.audit('user.status', p_user_id::text, jsonb_build_object('status', p_status, 'note', p_note));
end $$;

-- Pending email grants/bans are applied when the profile is created.
create or replace function public.apply_email_access(p_user uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.email_access;
begin
  select * into a from public.email_access where email = lower(p_email);
  if not found then
    return;
  end if;
  if a.role is not null then
    insert into public.user_roles (user_id, role, granted_by) values (p_user, a.role, a.updated_by)
    on conflict do nothing;
  end if;
  if a.banned then
    update public.profiles set status = 'banned', status_note = coalesce(a.note, 'Banned by organisers') where id = p_user;
  end if;
end $$;

-- Pending grants apply the moment the person finishes onboarding.
create or replace function public.profiles_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.apply_email_access(new.id, new.email);
  return new;
end $$;
create trigger profiles_apply_access after insert on public.profiles
  for each row execute function public.profiles_after_insert();

-- Superadmin: give or take a role by email.
create or replace function public.superadmin_set_email_role(p_email text, p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
begin
  if not public.has_role(array['superadmin']) then
    raise exception 'Superadmins only' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  if not public.email_domain_allowed(v_email) then
    raise exception 'Enter an IITM BS student email' using errcode = 'P0001', hint = 'BAD_DOMAIN';
  end if;
  if p_role is not null and p_role not in ('admin', 'organizer') then
    raise exception 'Role must be admin or organizer' using errcode = 'P0001', hint = 'BAD_INPUT';
  end if;

  insert into public.email_access (email, role, updated_by) values (v_email, p_role, auth.uid())
  on conflict (email) do update set role = excluded.role, updated_by = excluded.updated_by, updated_at = now();

  select id into v_user from public.profiles where email = v_email;
  if v_user is not null then
    if v_user = auth.uid() then
      raise exception 'You cannot change your own role here' using errcode = 'P0001', hint = 'SELF';
    end if;
    delete from public.user_roles where user_id = v_user and role in ('admin', 'organizer');
    if p_role is not null then
      insert into public.user_roles (user_id, role, granted_by) values (v_user, p_role, auth.uid());
    end if;
  end if;

  perform public.audit(case when p_role is null then 'role.revoke_email' else 'role.grant_email' end, v_email,
    jsonb_build_object('role', p_role, 'registered', v_user is not null));
  return jsonb_build_object('email', v_email, 'role', p_role, 'registered', v_user is not null);
end $$;

-- Admins: ban or unban by email (superadmins cannot be banned by admins).
create or replace function public.admin_set_email_ban(p_email text, p_banned boolean, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
begin
  perform public.require_admin();
  if not public.email_domain_allowed(v_email) then
    raise exception 'Enter an IITM BS student email' using errcode = 'P0001', hint = 'BAD_DOMAIN';
  end if;
  select id into v_user from public.profiles where email = v_email;
  if v_user = auth.uid() then
    raise exception 'You cannot ban yourself' using errcode = 'P0001', hint = 'SELF';
  end if;
  if v_user is not null and exists (select 1 from public.user_roles where user_id = v_user and role = 'superadmin') then
    raise exception 'A superadmin cannot be banned' using errcode = '42501', hint = 'FORBIDDEN';
  end if;
  if v_user is not null and exists (select 1 from public.user_roles where user_id = v_user and role = 'admin')
     and not public.has_role(array['superadmin']) then
    raise exception 'Only the superadmin can ban an admin' using errcode = '42501', hint = 'FORBIDDEN';
  end if;

  insert into public.email_access (email, banned, note, updated_by)
  values (v_email, coalesce(p_banned, true), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  on conflict (email) do update set banned = excluded.banned, note = excluded.note,
    updated_by = excluded.updated_by, updated_at = now();

  if v_user is not null then
    update public.profiles
    set status = case when p_banned then 'banned' else 'active' end,
        status_note = case when p_banned then nullif(btrim(coalesce(p_note, '')), '') end
    where id = v_user;
  end if;

  perform public.audit(case when p_banned then 'user.ban_email' else 'user.unban_email' end, v_email,
    jsonb_build_object('note', p_note, 'registered', v_user is not null));
  return jsonb_build_object('email', v_email, 'banned', p_banned, 'registered', v_user is not null);
end $$;

-- Staff list of every email-level grant and ban.
create or replace function public.admin_email_access() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'email', a.email, 'role', a.role, 'banned', a.banned, 'note', a.note, 'updated_at', a.updated_at,
      'registered', p.id is not null, 'username', p.username, 'by', b.username)
      order by a.updated_at desc)
    from public.email_access a
    left join public.profiles p on p.email = a.email
    left join public.profiles b on b.id = a.updated_by), '[]');
end $$;

revoke execute on function public.email_may_sign_in(text), public.apply_email_access(uuid, text),
  public.profiles_after_insert(), public.superadmin_set_email_role(text, text),
  public.admin_set_email_ban(text, boolean, text), public.admin_email_access() from public, anon, authenticated;
grant execute on function public.superadmin_set_email_role(text, text), public.admin_set_email_ban(text, boolean, text),
  public.admin_email_access() to authenticated;
grant select on public.email_access to supabase_auth_admin;

drop trigger guard_domain on auth.users;
create trigger guard_domain before insert or update of email, email_change on auth.users
  for each row execute function public.guard_auth_user_domain();

-- Token hook: refuse any session that did not come from the emailed code.
create function public.hook_custom_access_token(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
begin
  if event ->> 'authentication_method' in ('password', 'anonymous')
     or exists (select 1 from jsonb_array_elements(coalesce(event -> 'claims' -> 'amr', '[]')) a
                where a ->> 'method' in ('password', 'anonymous')) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403,
      'message', 'Sign in with the code we email you.'));
  end if;
  return event;
end $$;
revoke execute on function public.hook_custom_access_token(jsonb) from public, anon, authenticated;
grant execute on function public.hook_custom_access_token(jsonb) to supabase_auth_admin;
