-- 0022: a username is chosen once at sign-up and never changes (Angad, 25 Oct). The profile
-- edit keeps its signature, but any username other than the current one is refused.

create or replace function public.update_my_profile(p_username text, p_full_name text, p_whatsapp text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me     public.profiles := public.require_player();
  v_user text := lower(btrim(coalesce(p_username, '')));
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_wa   text := public.normalize_whatsapp(p_whatsapp);
begin
  perform 1 from public.profiles where id = me.id for update;

  if v_user <> '' and v_user <> me.username then
    raise exception 'Usernames are fixed once chosen' using errcode = 'P0001', hint = 'USERNAME_LOCKED';
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
end $$;
