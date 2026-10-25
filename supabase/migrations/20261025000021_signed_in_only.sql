-- 0021: signed-in students only. Until now visitors (anon) could read events, games, houses,
-- standings and leaderboards. Now anon reads nothing: every table and data function is for
-- the authenticated role only. The site itself sends visitors to sign-in.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- RLS policies call these. anon reaches no table now, but a policy must never fail on them.
grant execute on function public.has_role(text[]), public.is_admin(), public.is_staff(),
  public.is_superadmin(), public.can_manage_events() to anon;
