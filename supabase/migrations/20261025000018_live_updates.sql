-- =====================================================================
-- 0018 (25 Oct 2026, Angad): "jo changes karein wo turant bacchon ko dikhne
-- chahiye; abhi baar baar refresh karna pad raha hai".
-- Every write that changes what players see sends one small Realtime
-- Broadcast on the public topic 'arena'. The payload carries only a kind
-- ("results", "entries", ...), never data: the site then refetches what it
-- already shows, through the same RPCs and grants as before. Tables stay
-- out of the realtime publication (nothing readable leaks).
-- If Realtime is missing (tests, PGlite) or fails, the write still succeeds.
-- Safe to run twice.
-- =====================================================================

create or replace function public.broadcast_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    if to_regprocedure('realtime.send(jsonb, text, text, boolean)') is not null then
      execute 'select realtime.send($1, $2, $3, false)'
        using jsonb_build_object('kind', tg_argv[0], 'at', now()), tg_argv[0], 'arena';
    end if;
  exception when others then
    null; -- a lost ping only means players wait for the 60 s refresh
  end;
  return null;
end $$;
revoke execute on function public.broadcast_change() from public, anon, authenticated;

-- One ping per statement, not per row: saving a 30-player game sends one message.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('matches', 'results'), ('match_results', 'results'),
      ('entries', 'entries'), ('entry_members', 'entries'),
      ('tournaments', 'events'), ('games', 'games'),
      ('event_notices', 'notices'), ('event_lobby', 'lobby'))
    as v(tbl, kind)
  loop
    if to_regclass('public.' || t.tbl) is not null then
      execute format('drop trigger if exists %I on public.%I', t.tbl || '_live', t.tbl);
      execute format(
        'create trigger %I after insert or update or delete on public.%I
           for each statement execute function public.broadcast_change(%L)',
        t.tbl || '_live', t.tbl, t.kind);
    end if;
  end loop;
end $$;
