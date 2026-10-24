-- Live patch 24 Oct: GoTrue gives code-only users a random password, so the
-- encrypted_password check blocked every real sign-up. Same as migration 0006 now.
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

drop trigger if exists guard_domain on auth.users;
create trigger guard_domain before insert or update of email, email_change on auth.users
  for each row execute function public.guard_auth_user_domain();
