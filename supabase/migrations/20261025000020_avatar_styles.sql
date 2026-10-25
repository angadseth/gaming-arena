-- =====================================================================
-- 0020 (25 Oct 2026, Angad): avatars for girls ("pookie") and boys.
-- New picker styles: pookie + queen (Girls), boy + dude (Boys), next to the
-- old robots/pixel/faces/blobs. Only the allowed style names change.
-- Safe to run twice.
-- =====================================================================
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check
  check (avatar is null or avatar ~ '^(pookie|queen|boy|dude|bottts|pixel-art|lorelei|thumbs):[a-z0-9]{1,16}$');

create or replace function public.set_my_avatar(p_avatar text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := public.require_player();
  v  text := nullif(lower(btrim(coalesce(p_avatar, ''))), '');
begin
  if v is not null and v !~ '^(pookie|queen|boy|dude|bottts|pixel-art|lorelei|thumbs):[a-z0-9]{1,16}$' then
    raise exception 'Pick one of the avatars shown' using errcode = 'P0001', hint = 'BAD_INPUT';
  end if;
  if v is not distinct from me.avatar then
    return;
  end if;
  perform public.throttle('avatar', 20, interval '1 day');
  update public.profiles set avatar = v where id = me.id;
end $$;
revoke all on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
