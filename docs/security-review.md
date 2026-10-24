# Pugmark security review (pre-launch)

Reviewed 24 Oct 2026. Scope: `supabase/migrations/*.sql`, `supabase/config.toml`, `web/src/**`, `web/index.html`, `web/vite.config.ts`, `web/public/guard.js`, `.github/workflows/*`.
Threat model: the attacker holds the public publishable key and calls Supabase Auth, PostgREST and Storage directly, signed in with their own session or as anon, with any arguments they like.

How the findings were checked:
- **PROVEN** means an exploit test passed against the real migrations in the PGlite harness, or the issue was confirmed from a build or config artifact. The tests are in the scratch dir, `...\scratchpad\sec\exploits.test.ts` and `cost.test.ts` (16/16 and 1/1 passing). The project's own `npx vitest run db-tests` still passes 19/19.
- **THEORETICAL** means the issue follows from documented Supabase/GoTrue behaviour that PGlite cannot run.

## Summary (ranked)

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| C1 | **Critical** | `enable_confirmations = false` plus open password sign-up: anyone can get a session for any IITM address without owning the mailbox, **including the bootstrap superadmin** | PROVEN (config + DB path) |
| H1 | High | No CAPTCHA is enforced and the email quota is 40 per hour project-wide. One IP can stop every student from getting a login code | THEORETICAL (documented limits) |
| M1 | Medium | `house_standings` (anon) takes about 12.5 s at season scale. It times out on Supabase and can pin the free-tier CPU. A rewrite gives the same result 12x faster | PROVEN (benchmark) |
| M2 | Medium | No write RPC has a rate limit. `audit_log` and `entries` can be grown until the 500 MB free DB goes read-only | PROVEN |
| M3 | Medium | Latent: the default EXECUTE-to-PUBLIC is not revoked, so any function a future migration adds is anon-callable | PROVEN |
| M4 | Medium | A 6-digit OTP with a per-IP-only limit can be brute-forced with a proxy pool, aimed at the superadmin | THEORETICAL |
| L1 | Low | Invite codes are 39 bits, not 40 (UUID version nibble), and guesses are not rate-limited | PROVEN |
| L2 | Low | In-game ID oracle: any player can test whether a guessed ID is registered | PROVEN |
| L3 | Low | The `HAS_ENTRIES` guard in `admin_upsert_tournament` is dead code | PROVEN |
| L4 | Low | A partial `admin_upsert_tournament` update silently clears `max_entries` and the registration window | PROVEN |
| L5 | Low | A captain who withdraws during open registration deletes results already recorded | PROVEN |
| L6 | Low | An admin can ban fellow admins and rewrite the superadmin's name and house | PROVEN |
| L7 | Low | Audit gaps: point tables, previous match results and invite regeneration are not recorded | PROVEN (code) |
| L8 | Low | An email-change request still makes GoTrue mail a non-IITM address (it is blocked only at confirmation) | THEORETICAL |
| L9 | Low | The reserved-username list is exact-match only, so `admin1`, `pugmark` and `iitm_official` are allowed | PROVEN (code) |
| L10 | Low | The bootstrap-superadmin grant is permanent | code |
| L11 | Low | The `request_game` 3-per-day limit can be raced | THEORETICAL |
| L12 | Low | The production redirect allow-list includes `http://localhost:5199/` | config |
| I1–I16 | Info | Minor exposures, plus the areas checked and found clean | see end |

---

## C1 — Critical: account creation without the mailbox, and superadmin takeover

**Where**
- `supabase/config.toml:227` sets `enable_confirmations = false`.
- `config.toml:177`/`:222` keep `enable_signup = true`, and the Email provider always accepts password sign-ups.
- `config.toml:290`: no `custom_access_token` hook.
- `supabase/migrations/20261024000002_player_rpc.sql:39-41`: `complete_profile` trusts `auth.users.email` without checking `email_confirmed_at` or how the session was made.
- `:70-76`: grants `superadmin` to whoever holds the bootstrap email.
- `20261024000001_core.sql:323-339`: `require_player` makes the same assumption.

RESUME.md plans `supabase config push`, which pushes this `false` to the live project. That contradicts the research doc's "Keep Confirm email on".

**Exploit**
1. With email confirmation off, GoTrue's `/signup` with a password auto-confirms the user and returns a session at once (supabase-js `signUp` docs: "if Confirm email is disabled, a session is returned").
2. The Before-User-Created hook passes, because the domain is allowed. The hook only checks the domain; it cannot check mailbox ownership.
```bash
curl -s "$SB/auth/v1/signup" -H "apikey: $PUBLISHABLE" -H 'content-type: application/json' \
  -d '{"email":"24f2004141@ds.study.iitm.ac.in","password":"anything123"}'      # -> access_token
curl -s "$SB/rest/v1/rpc/complete_profile" -H "apikey: $PUBLISHABLE" -H "authorization: Bearer $AT" \
  -H 'content-type: application/json' -d '{"p_username":"angad","p_full_name":"Angad Seth","p_house_id":9,
  "p_region_id":1,"p_whatsapp":"9876543210","p_accept_rules":true}'            # -> superadmin
```
The attacker then holds every admin RPC, including all emails and WhatsApp numbers through `admin_search_users`, and can grant roles. The same call impersonates any student who has not signed up yet. The real owner's later OTP sign-in lands in the attacker's account, where the attacker still has password access, so the account is shared. The DB half is proven: `exploits.test.ts > bootstrap superadmin is granted on ANY auth.users row with that email`, using even an upper-case variant of the address.

**Variant with confirmations ON (theoretical, depends on GoTrue version)**
1. The attacker signs up with a password for a victim's address and leaves the account unconfirmed.
2. The victim later signs in by OTP, which confirms the account.
3. The attacker's password now works.

**Fix (do all of these; the hook alone is not enough)**
1. In `config.toml:227` set `enable_confirmations = true`. Check that the dashboard matches.
2. Refuse every password-based session at token issuance. This hook is available on the Free plan:
```sql
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
```
   ```toml
   [auth.hook.custom_access_token]
   enabled = true
   uri = "pg-functions://postgres/public/hook_custom_access_token"
   ```
3. Add the same guard in the database, so a misconfigured hook still fails closed:
```sql
create function public.session_ok() returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and not exists (select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]')) a
                     where a ->> 'method' in ('password', 'anonymous'))
$$;
-- require_player(), complete_profile(): first line
if not public.session_ok() then
  raise exception 'Sign in with the emailed code' using errcode = '42501', hint = 'AUTH_METHOD';
end if;
-- has_role(): add  "and public.session_ok()"  to the WHERE clause
-- complete_profile(): read the email only when it is confirmed
select lower(email) into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
```
   The PGlite stub needs `auth.jwt()`: `select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb`.
4. After the owner's first sign-in, run `update public.app_settings set value = '[]' where key = 'bootstrap_superadmins';` (see L10).
5. If the config was ever pushed with `false`, check `auth.users` and `auth.audit_log_entries` for password sign-ups (`action = 'user_signedup'` with provider `email` and no OTP verification before it) and delete them.

Test on staging that a first-time OTP sign-in does not carry `amr = password`; it should be `otp`.

## H1 — High: login-code denial of service, with no CAPTCHA enforced

**Where**
- `config.toml:200` sets `email_sent = 40` per hour for the whole project.
- `config.toml:215`: the `[auth.captcha]` block is commented out.
- `web/src/pages/SignIn.tsx:58` only shows Turnstile when `VITE_TURNSTILE_SITE_KEY` is set.
- `.github/workflows/pages.yml` lets that variable be empty.
- `20261024000001_core.sql:283-293`: the hook accepts any local part.

**Exploit**
1. Loop `POST /auth/v1/otp {"email":"<random>@ds.study.iitm.ac.in","create_user":true}`.
2. The per-IP limit is 30 per 5 min, which is 360 per hour, and the per-address 60 s limit doesn't matter with random addresses. One IP therefore burns the 40-per-hour quota in minutes, and keeps it burned.
3. No student can receive a code.
4. Every request also inserts a junk `auth.users` row and sends mail to mailboxes that don't exist. The bounces hurt the dedicated Gmail sender's reputation, and Google may suspend it.

**Fix**
- Turn CAPTCHA on at the server. That is the only thing that binds it:
  ```toml
  [auth.captcha]
  enabled = true
  provider = "turnstile"
  secret = "env(SUPABASE_AUTH_CAPTCHA_SECRET)"
  ```
- Make the site key mandatory in `pages.yml`: add a step that runs `test -n "$VITE_TURNSTILE_SITE_KEY"`.
- If every IITM BS address matches the roll-number format, tighten the hook regex to it, e.g. `'^[0-9]{2}[a-z][0-9]{7}@'`. Confirm the ES format first.
- Raise the email ceiling (Send Email hook or a transactional provider) and alert on bounce spikes.

## M1 — Medium: `house_standings` is too expensive to leave anon-callable

**Where:** `20261024000002_player_rpc.sql:445-473` calls `tournament_standings()` (`:406-439`) laterally for every completed event. A SECURITY DEFINER SQL function is never inlined, so for every entry it also builds the unused `members` JSONB and runs the `is_mine` subquery. It is granted to anon at `20261024000003_admin_rpc.sql:457-460`.

**Proof** (`cost.test.ts`): 20 completed events × 400 squads × 4 players.
- `house_standings(null)` took **12.2 / 12.4 / 13.3 s** in PGlite.
- The rewrite below took **1.07 s** and returned **identical rows** (`same result: true`).

Supabase's anon `statement_timeout` is 3 s, so the Houses page fails once a season is underway. Meanwhile anyone can loop the endpoint and saturate a free-tier instance.

**Fix:** replace it with this (validated):
```sql
create or replace function public.house_standings(p_season text default null)
returns table (rank bigint, house_id smallint, points numeric, podiums bigint, players bigint)
language sql stable security definer set search_path = '' as $$
  with done as (
    select id, house_points from public.tournaments
    where status = 'completed' and (p_season is null or season = p_season)
  ), agg as (
    select e.id as entry_id, e.tournament_id,
           coalesce(sum(r.points), 0) + e.points_adjust as points,
           count(*) filter (where r.placement = 1) as wins,
           coalesce(sum(r.kills), 0) as kills, min(r.placement) as best
    from public.entries e join done d on d.id = e.tournament_id
    left join public.match_results r on r.entry_id = e.id
    where e.status = 'active' group by e.id
  ), placed as (
    select a.tournament_id, a.entry_id,
           rank() over (partition by a.tournament_id
                        order by a.points desc, a.wins desc, a.kills desc, a.best asc nulls last) as rnk
    from agg a
  ), scored as (
    select pl.tournament_id, pl.entry_id, pl.rnk, public.points_for_rank(d.house_points, pl.rnk::int) as pts
    from placed pl join done d on d.id = pl.tournament_id
  ), shares as (
    select p.house_id, s.rnk, s.pts / count(*) over (partition by s.tournament_id, s.entry_id) as share
    from scored s
    join public.entry_members m on m.entry_id = s.entry_id and m.role <> 'sub'
    join public.profiles p on p.id = m.user_id
  ), pts as (
    select house_id, sum(share) as points, count(*) filter (where rnk <= 3) as podiums
    from shares group by house_id
  ), ppl as (
    select p.house_id, count(distinct m.user_id) as players
    from public.entry_members m join done d on d.id = m.tournament_id
    join public.profiles p on p.id = m.user_id group by p.house_id
  )
  select rank() over (order by coalesce(pts.points, 0) desc), h.id, round(coalesce(pts.points, 0), 2),
         coalesce(pts.podiums, 0), coalesce(ppl.players, 0)
  from public.houses h left join pts on pts.house_id = h.id left join ppl on ppl.house_id = h.id
  order by 1, h.name
$$;
```
Optionally, cache the result in a table. Refresh it when a tournament becomes `completed` or a match is recorded or deleted, and grant anon `select` on the table only.

`tournament_standings` takes about 0.5–0.7 s for 400 entries in PGlite. That is acceptable, but the same `members` subquery is the main cost if events grow.

## M2 — Medium: no write RPC is rate-limited, so the free-tier database can be filled

**Where**
- `update_my_whatsapp` (`20261024000002_player_rpc.sql:97-104`) writes an `audit_log` row on every call, even when nothing changed.
- The `create_team`/`leave_entry`/`join_team`/`kick_member` churn (`:176-343`) writes entries, members and audit rows.
- `audit()` is at `20261024000001_core.sql:341-345`.

**Proof**
- 300 `update_my_whatsapp` calls produced 300 audit rows.
- 50 create-and-withdraw team cycles produced at least 400 audit rows, plus 50 fresh invite codes.

At about 50 requests/s, one account writes millions of rows a day. Supabase Free makes the project read-only at 500 MB, which takes the platform down.

**Fix:** add a throttle and call it at the start of every player write RPC:
```sql
create table public.rate_events (user_id uuid not null, action text not null, at timestamptz not null default now());
create index rate_events_idx on public.rate_events (user_id, action, at);
alter table public.rate_events enable row level security;   -- no grants
create function public.throttle(p_action text, p_max int, p_window interval) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_action, 0));
  if (select count(*) from public.rate_events
      where user_id = auth.uid() and action = p_action and at > now() - p_window) >= p_max then
    raise exception 'Slow down and try again shortly' using errcode = 'P0001', hint = 'RATE_LIMITED';
  end if;
  insert into public.rate_events (user_id, action) values (auth.uid(), p_action);
  delete from public.rate_events where at < now() - interval '2 days' and random() < 0.01;
end $$;
```
- Suggested limits: `perform public.throttle('reg', 30, '1 hour')` in register, create, join, leave and kick; `('whatsapp', 5, '1 day')`; `('invite', 30, '1 hour')` in `team_by_invite` and `join_team`. `team_by_invite` must become `volatile` to insert.
- In `update_my_whatsapp`, skip both the update and the audit row when the number has not changed.

## M3 — Medium (latent): future functions are executable by PUBLIC, and so by anon

**Where:** `20261024000001_core.sql:21`, `alter default privileges in schema public revoke execute on functions from public, ...`. A per-schema entry can only add to the built-in default; it cannot remove the global `EXECUTE TO PUBLIC`. Only the one-time `revoke ... on all functions` at `20261024000003_admin_rpc.sql:451` protects today's functions.

**Proof:** `exploits.test.ts > LATENT`. After all migrations, a new `security definer` function was created as owner. Then `has_function_privilege('anon', …)` returned `true`, and anon called it successfully. The next migration that adds a helper (a new `require_*`, `audit_*` or data function) is therefore exposed at `/rest/v1/rpc/<name>` to everyone.

**Fix**
```sql
alter default privileges revoke execute on functions from public;                         -- global, current role
alter default privileges in schema public revoke execute on functions from anon, authenticated;
```
Also turn the inventory test (`exploits.test.ts > inventory`) into a CI test that compares the exposed functions with an explicit allow-list. Today's exposed set is correct: 36 functions, and none of the helpers.

## M4 — Medium (theoretical): the 6-digit OTP can be brute-forced

**Where:** `config.toml:233` (`otp_length = 6`), `:234` (600 s), `:210` (30 verifications per 5 min **per IP**). GoTrue documents no per-code attempt limit.

**Exploit**
1. Request a code for `24f2004141@ds.study.iitm.ac.in`.
2. Spread `/verify` attempts over N proxies. 1000 IPs give about 60k guesses per 10-minute window, a 6% chance per window.
3. Repeating every window makes success likely within a day. CAPTCHA does not cover `/verify`.

**Fix**
- Set `otp_length = 8`, and update `web/src/pages/SignIn.tsx:96` and the `OtpInput` length.
- Set `otp_expiry = 300`.
- For staff accounts, enable TOTP MFA (`[auth.mfa.totp] enroll_enabled/verify_enabled = true`). Require `aal2` for staff roles in `has_role`:
  `and (not (p_roles && array['superadmin','admin']) or auth.jwt() ->> 'aal' = 'aal2')`.
- Alert on repeated `/verify` failures for staff addresses in Auth logs.

---

## Low

**L1 — Invite codes have 39 bits, and guessing is unthrottled.** PROVEN.
- `20261024000001_core.sql:351-356` takes `get_byte(bytes, i)` for i = 0..7 of a UUIDv4. Byte 6 is `0x4X`, so position 7 can only be `A`–`R` (16 symbols, from 4000 samples). Byte 8 would be fine.
- `team_by_invite`/`join_team` (`20261024000002_player_rpc.sql:219-280`) answered 1000 wrong guesses with no slowdown.
- Impact is limited: a guessed code only lets someone join a team, and the captain can kick them.
- Fix: `substr(alphabet, (get_byte(bytes, case when i = 6 then 9 else i end) % 32) + 1, 1)`, or `extensions.gen_random_bytes(8)`. Add the M2 throttle.

**L2 — In-game ID oracle.** PROVEN. `check_not_registered` (`20261024000002_player_rpc.sql:139-142`) returns `IG_ID_TAKEN` to a player who is not registered, and writes nothing. Anyone can confirm that a specific BGMI or Riot ID is in an event. This is inherent to the uniqueness rule. Mitigate with the M2 throttle, or accept duplicates and let admins resolve them.

**L3 — The `HAS_ENTRIES` guard never fires.** PROVEN.
- At `20261024000003_admin_rpc.sql:128-131` the guard reads `game_id` **after** the update, so it always equals `p->>'game_id'`. A solo event with registrations was moved to a 4-player squad game.
- Fix: before the update, run `select game_id into v_old from public.tournaments where id = v_id for update;`, then `if v_old is distinct from (p->>'game_id')::uuid and exists (select 1 from public.entries where tournament_id = v_id) then raise ...`.

**L4 — A partial tournament update clears fields.** PROVEN.
- At `20261024000003_admin_rpc.sql:114-117`, if `max_entries`, `reg_opens_at`, `reg_closes_at` or `starts_at` is missing from `p`, it is set to NULL. A status-only call from the API removes the capacity limit and the closing time; the existing test at `db.test.ts:234` does exactly this.
- Fix: `max_entries = case when p ? 'max_entries' then nullif(p->>'max_entries','')::integer else max_entries end`, and the same for each nullable column.

**L5 — Withdrawing deletes recorded results.** PROVEN.
- `leave_entry` and `kick_member` (`20261024000002_player_rpc.sql:284-343`) only check `registration_open`.
- Admins can record matches while registration is open. When a captain then withdraws, the entry is deleted and its `match_results` cascade away.
- Fix: `if exists (select 1 from public.match_results where entry_id = v_e.id) then raise exception 'Results are already recorded' using hint = 'HAS_RESULTS'; end if;`

**L6 — Admins act against peers and the superadmin.** PROVEN.
- `admin_set_user_status` (`20261024000003_admin_rpc.sql:341-358`) lets an admin ban another admin; `has_role` then drops that admin's powers.
- `admin_correct_profile` (`:361-375`) lets an admin rewrite the superadmin's name and house.
- Fix: in both, raise `FORBIDDEN` when `exists (select 1 from public.user_roles where user_id = p_user_id) and not public.has_role(array['superadmin'])`.

**L7 — Audit gaps.**
- `tournament.update` (`20261024000003_admin_rpc.sql:132`) records only slug and status, so a change to `house_points`, `placement_points` or `kill_points` leaves no trace.
- `game.update` (`:75`) records only the slug.
- `match.record` with replace (`:290`, `:301-302`) deletes the old rows without keeping them.
- `regenerate_invite` and `request_game` write no audit row.
- Fix: log `jsonb_build_object('before', to_jsonb(old_row), 'after', to_jsonb(new_row))`, and for replaced matches log `(select jsonb_agg(to_jsonb(r)) from public.match_results r where match_id = v_match)` before the delete.

**L8 — Email-change requests (theoretical).**
- The trigger at `20261024000001_core.sql:464-477` blocks only the final `email` update.
- `updateUser({email:'x@gmail.com'})` still makes GoTrue send a confirmation to the outside address, which also uses up email quota.
- Fix: fire on `update of email, email_change`, and raise when `coalesce(new.email_change,'') <> ''`. Test on staging.

**L9 — Staff impersonation through usernames.**
- `reserved_usernames` (`20261024000001_core.sql:98-103`) is an exact-match list, checked at `20261024000002_player_rpc.sql:51`.
- `admin1`, `pugmark`, `iitm_official` and `moderator_x` are all allowed, and usernames are public in every standings table.
- Fix: in `complete_profile` and `username_available`, also reject `v_user ~ '(admin|moder|staff|offici|pugmark|iitm|organi[sz]|support|esport)'`.

**L10 — The bootstrap grant is permanent.** `20261024000001_core.sql:33` and `20261024000002_player_rpc.sql:70-76` re-grant superadmin whenever a profile with that email is created, for example after the account is deleted and recreated. Fix: clear the list after first use, or add `and not exists (select 1 from public.user_roles where role = 'superadmin')`.

**L11 — The `request_game` limit can be raced (theoretical).** `20261024000002_player_rpc.sql:394-399` counts and then inserts without a lock, so parallel requests get past the limit. Fix: `perform pg_advisory_xact_lock(hashtextextended(me.id::text, 0));` before the count, or use the M2 throttle.

**L12 — localhost on the redirect allow-list.** `config.toml:164` allows `http://localhost:5199/` in production. Templates contain only the token, so the impact is small, but remove it from the pushed config.

---

## Info, and what was checked and found clean

- **I1 (PROVEN):** anon can read `tournaments.created_by` and `matches.created_by` (staff UUIDs) through `select *` (`20261024000001_core.sql:500-501`). Harmless today. A column-level grant would fix it, but `api/supabase.ts:42` would then need explicit column lists.
- **I2 (PROVEN, by design):** organizers, the lowest staff role, receive every registrant's email, WhatsApp and full name from `admin_registrations` (`20261024000003_admin_rpc.sql:150`). Consider admin-only access, or masking for organizers.
- **I3 (PROVEN):** a player can read the admin's `status_note` about them through `GET /rest/v1/profiles`. Keep internal notes elsewhere.
- **I4:** `registration_open(tournaments)`, `has_role`, `is_admin` and `is_staff` can be called through `/rpc`, but they are harmless. The `registration_open` grant (`20261024000003_admin_rpc.sql:459`) is unnecessary and can be revoked.
- **I5:** `max_rows = 500` (`config.toml:18`) truncates `tournament_standings` and `tournament_match_results` for big events. This is a correctness issue, not a security one.
- **I6, dev backend in production (VERIFIED):** I built with and without Supabase env into the scratch dir and grepped both bundles and the existing `web/dist`.
  - Absent: the `@electric-sql/pglite` module, `__devdb`, `idb://` and the stub SQL. `getApi` only imports `./pglite` under `import.meta.env.DEV`.
  - Present as dead code: the banner strings "LOCAL PREVIEW DATABASE · sign-in code is 123456" (`SignIn.tsx:115`, `Shell.tsx:25-27`). Wrap them in `import.meta.env.DEV &&` so they are removed from the build.
  - The CI grep only checks `__devdb`/`pugmark-dev`; also grep for `PGlite.create`.
- **I7, CSP and clickjacking (VERIFIED in the build output):**
  - The CSP is `script-src 'self' https://challenges.cloudflare.com`, with no inline or eval scripts, `object-src 'none'`, `base-uri 'self'` and `form-action 'self'`. It is injected before any script. `style-src 'unsafe-inline'` is low risk because there is no HTML-injection sink.
  - `frame-ancestors` cannot be set in a `<meta>` tag. `guard.js` hides the page **before** it tries to break out of the frame, so a sandboxed frame without top-navigation stays hidden, and one without `allow-scripts` renders blank.
  - Optional: add `require-trusted-types-for 'script'`.
- **I8, XSS (VERIFIED):** there is no `dangerouslySetInnerHTML`, `innerHTML` or `eval`. The only DB-derived `href` is `https://wa.me/<digits only>` (`Registrations.tsx:144`). The `window.open` in `event.tsx:110` uses `encodeURIComponent` and `noopener`. `cover_path` and `accent` are regex-constrained in the DB.
- **I9, open redirect (VERIFIED):** `?next=` must start with `/` (`SignIn.tsx:45`, `Onboarding.tsx:18`). With HashRouter, a value like `//evil.com` stays inside the hash, and react-router 7.18.4 `validateNavigationTarget` throws on external targets.
- **I10, CSV injection (VERIFIED):** `csvCell` (`admin/shared.tsx:42-46`) prefixes `'` to `= + - @ \t \r` and quotes every cell. Player-controlled `ig_id` and `extra` values are btrimmed server-side. A side effect is that negative `points_adjust` exports as text.
- **I11:** supabase-js keeps the access and refresh tokens in localStorage. That is acceptable given the CSP. `detectSessionInUrl: false` is correct for OTP.
- **I12, storage (VERIFIED from code):** only admins can insert, update, delete or list in `game-art`. Reads are by public URL only, there's a 500 KB cap, and SVG is excluded. The MIME allow-list trusts the uploader's declared Content-Type, which only matters for admins.
- **I13:** GitHub Actions are pinned to tags, not commit SHAs. Workflows use `permissions: contents: read` and never interpolate untrusted input into `run:`.
- **I14, domain guard (PROVEN):**
  - Rejected: trailing dot, look-alike suffix, sub-domain, `+` alias, double `@`, non-ASCII local part, and a U+2024 homoglyph dot.
  - Upper-case addresses are normalised to lower case.
  - The hook rejects phone and anonymous users (empty email), and the `auth.users` trigger backs it up.
- **I15:** seed games label some extra fields "Optional" but set `"required": true` (Clash Royale trophies, Valorant rank, chess.com). This is a functional bug.
- **I16, checked and clean:**
  - No dynamic SQL anywhere, so no SQL injection.
  - Every function has `search_path = ''`, with fully qualified names.
  - None of the helpers can be reached through PostgREST: `require_player`, `lock_open_tournament`, `validate_game_fields`, `check_*`, `reslot_subs`, `audit`, `new_invite_code`, `normalize_whatsapp`, `points_for_rank`, `email_domain_allowed`, `require_admin` and the trigger and hook functions (inventory test).
  - No function takes identity from a parameter. Everything uses `auth.uid()`.
  - `complete_profile` cannot grant any role except the bootstrap one. Username and email are frozen by trigger, even for the owner.
  - Capacity, team-size and duplicate-registration races are serialised by `FOR UPDATE` on the tournament (and entry) rows, and backed by unique constraints.
  - `tournament_standings`, `my_entries`, `team_by_invite` and `tournament_counts` return no email, WhatsApp, full name or in-game ID. The invite code is shown to the captain only.
  - The audit log has no client write path, and its rows survive cascades because it has no foreign keys.
  - Player-facing errors expose only the player's own input or admin-authored labels.
  - Admin-supplied regexes are compile-checked. Postgres's regex engine is not a backtracking engine and is subject to `statement_timeout`, so ReDoS needs a malicious admin and stays theoretical.
