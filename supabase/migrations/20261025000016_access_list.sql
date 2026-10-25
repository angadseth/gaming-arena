-- 0016: one list for the Super Admin's "Team & access" page.
-- Everyone who has a staff role, a pre-set email role, or a ban/suspension, with their highest role.
-- Super Admin only (require_admin means superadmin since 0015). Read-only: changes still go through
-- superadmin_set_email_role and admin_set_email_ban.

create or replace function public.superadmin_access_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return coalesce((
    with people as (
      select a.email from public.email_access a
      union
      select p.email from public.profiles p
      where p.status <> 'active' or exists (select 1 from public.user_roles r where r.user_id = p.id)
    ),
    rows as (
      select x.email, p.id, p.username, p.full_name, p.status, p.status_note, p.created_at,
        a.role as email_role, a.banned as email_banned, a.note, a.updated_at, b.username as by,
        (select r.role from public.user_roles r where r.user_id = p.id
          order by case r.role when 'superadmin' then 0 when 'admin' then 1 else 2 end limit 1) as user_role,
        (select max(r.granted_at) from public.user_roles r where r.user_id = p.id) as granted_at
      from people x
      left join public.profiles p on p.email = x.email
      left join public.email_access a on a.email = x.email
      left join public.profiles b on b.id = a.updated_by
    )
    select jsonb_agg(jsonb_build_object(
      'email', email,
      'registered', id is not null,
      'username', username,
      'full_name', full_name,
      'role', coalesce(user_role, email_role),
      'banned', coalesce(email_banned, false) or coalesce(status = 'banned', false),
      'suspended', coalesce(status = 'suspended', false),
      'note', coalesce(note, status_note),
      'by', by,
      'updated_at', coalesce(updated_at, granted_at, created_at))
      order by case coalesce(user_role, email_role) when 'superadmin' then 0 when 'admin' then 1 when 'organizer' then 2 else 3 end,
        coalesce(updated_at, granted_at, created_at) desc)
    from rows), '[]');
end $$;

revoke execute on function public.superadmin_access_list() from public, anon, authenticated;
grant execute on function public.superadmin_access_list() to authenticated;
