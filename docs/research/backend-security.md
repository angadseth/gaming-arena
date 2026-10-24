# Backend and security architecture: IITM BS Esports

Researched 24 Oct 2026. Every claim has a source URL next to it. Anything marked **[UNVERIFIED]** I could not confirm from a primary source, so test it before relying on it.

**Short answer:** keep Supabase. It is the only free option that meets all of these at once: email OTP codes, a domain allow-list hook, Postgres RLS, file storage, and 50k MAU. GitHub Pages is fine for the frontend. Two things must be done before launch, or login breaks on day one:

1. **Set up custom SMTP.** The built-in sender only delivers to project team members, and only 2 emails per hour.
2. **Write explicit GRANTs.** From 30 Oct 2026, Supabase no longer exposes `public` tables to the API automatically.

---

## 0. Two platform changes in 2026 that shape this design

| Change | What it means for us | Source |
|---|---|---|
| **Tables are no longer exposed to the Data API by default.** This is the default for new projects from 30 May 2026, and applies to all existing projects from 30 Oct 2026. | Every table needs `grant ... to anon/authenticated` + RLS + policies. A missing grant fails with error `42501`. This fits our "grant almost nothing" design. | https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically |
| **New API key names.** `sb_publishable_...` replaces the `anon` JWT, and `sb_secret_...` replaces `service_role`. The legacy keys are deprecated by the end of 2026. | Put only the **publishable** key in the frontend. It is "safe to expose online". The secret key never goes into the repo or the browser, not even on localhost. | https://supabase.com/docs/guides/api/api-keys |

Also, `pg_graphql` is no longer enabled by default (since 18 May 2026). Leave it off: that removes a whole attack surface (lints 0026/0027).

---

## 1. Supabase email OTP (a 6-digit code, not a magic link)

**API** (supabase-js v2). Source: https://supabase.com/docs/guides/auth/auth-email-passwordless

```js
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,          // sb_publishable_...
  { auth: { persistSession: true, autoRefreshToken: true,
            detectSessionInUrl: false } }                 // OTP-only: never parse tokens from the URL
)

// Step 1: send the code
const DOMAIN = '@ds.study.iitm.ac.in'
export async function requestCode(rawEmail, captchaToken) {
  const email = rawEmail.trim().toLowerCase()
  if (!email.endsWith(DOMAIN) || email.includes('+')) throw new Error('Use your @ds.study.iitm.ac.in email')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, captchaToken },   // the hook (section 3) is the real gate
  })
  if (error) throw error            // success: data.user and data.session are both null
}

// Step 2: verify the code
export async function verifyCode(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
  return data.session               // the session is saved to localStorage by supabase-js
}
```

**Getting a code instead of a link.** `signInWithOtp` sends the same email for both methods. Only the template content differs, so put `{{ .Token }}` in the template and leave out `{{ .ConfirmationURL }}` (docs, same page).
- Edit the template in **Authentication → Emails → Templates**. Edit **both "Magic Link" and "Confirm signup"**: a user's *first* sign-in uses the Confirm-signup template (https://github.com/orgs/supabase/discussions/28947).
- Suggested template. Put the code in the subject so it shows in the phone's notification. Keep it plain, no links (it looks less like phishing) and no emoji.
  - Subject: `{{ .Token }} is your IITM BS Esports login code`
  - Body: `<p>Your login code is <b style="font-size:24px;letter-spacing:4px">{{ .Token }}</b></p><p>It expires in 10 minutes. If you did not request it, ignore this email.</p>`
- **[UNVERIFIED]** I did not test that `type:'email'` verifies a first-time (signup-template) code. Test both a new and a returning user. Fall back to `type:'signup'` only if it fails.

**Settings**

| Setting | Value | Notes / source |
|---|---|---|
| OTP length | 6 (allowed range 6–10) | `auth.email.otp_length` in the CLI config: https://supabase.com/docs/guides/local-development/cli/config . One project was reported to default to 8 (https://dev.to/incultnitollc/your-otp-regex-assumes-six-digits-supabase-magic-links-dont-33i1), so **check that it is 6 in the dashboard** and don't hard-code a `^\d{6}$` check until you have. |
| OTP expiry | Default 3600 s. **Set it to 600 s.** | Authentication → Sign In / Providers → Email → "Email OTP expiration". Over 86,400 s is discouraged. It also controls every other email link. (passwordless docs) |
| Per-user resend interval | 1 request / 60 s (configurable) | https://supabase.com/docs/guides/auth/rate-limits |
| `/otp` and other sign-in endpoints | 30 requests / 5 min per IP | same |
| `/verify` | 30 requests / 5 min per IP | same. Brute-forcing 10^6 codes inside a 10-minute window isn't practical at this rate. **[UNVERIFIED]** I found no per-code attempt counter in the docs. |
| Emails sent (built-in SMTP) | **2 per hour, project-wide** | same. You can raise it **only** with custom SMTP or the Send Email hook. |
| Built-in SMTP recipients | **Only addresses in the project's team.** Everyone else gets "Email address not authorized". | https://supabase.com/docs/guides/auth/auth-smtp (current rule, confirmed) |

Session length: access JWTs last 1 h and refresh automatically, and refresh tokens keep the user signed in. So a student needs an OTP roughly **once per device**, not once per visit. That keeps email volume close to "new devices per day". **[UNVERIFIED]** whether "time-box sessions" is free. We don't need it anyway.

---

## 2. Custom SMTP on a zero budget (delivering into Google Workspace inboxes)

| Option | Free limit | Deliverability to @ds.study.iitm.ac.in | Own domain needed? | Verdict |
|---|---|---|---|---|
| **Gmail (personal @gmail.com) + App Password** | Google: "more than 500 emails sent in a day" trips the limit, then a 1–24 h block (https://support.google.com/mail/answer/22839) | Excellent. Gmail signs it with DKIM as gmail.com and DMARC aligns, Google to Google. | No | **Recommended for v1** |
| Gmail on a Workspace / school account (IITM) | Workspace: 2,000 per day per user (https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace) | Best possible (same domain) | No | Google says the App-password option **may be missing on work/school accounts** (https://support.google.com/accounts/answer/185833). It depends on the IITM admin. **[UNVERIFIED for IITM]** |
| Brevo free | 300 per day (https://help.brevo.com/hc/en-us/articles/208580669) | Poor without a domain: if the sender isn't authenticated, Brevo rewrites From to `@brevosend.com` (https://www.captaindns.com/en/blog/brevo-transactional-email-technical-guide). You can't add DKIM for gmail.com. | Effectively yes | Only once we own a domain |
| Resend free | 100 per day, 3,000 per month (https://resend.com/docs/knowledge-base/account-quotas-and-limits) | Good, with a domain | Yes, in practice (it sends from a verified domain) | Needs a domain, and the cap is lower than Gmail's |
| Google Apps Script `MailApp` (through the Send Email hook) | 100 recipients/day on a consumer account, **1,500/day on Workspace** (https://developers.google.com/apps-script/guides/services/quotas). **[UNVERIFIED]** whether the Education tier has the same 1,500. | Best if it runs on an IITM account | No | **Escalation path** for launch surges (below) |

### Recommendation: a dedicated Gmail account with an App Password

What Angad has to do by hand (about 10 minutes, and only he can do it):
1. Create a new Gmail account just for this, for example `iitmbs.esports.login@gmail.com`. Don't use his personal one: if Google rate-limits it, his own mail stops too.
2. Turn on **2-Step Verification** on it. App Passwords "can only be used with accounts that have 2-Step Verification turned on" (https://support.google.com/accounts/answer/185833).
3. Go to myaccount.google.com/apppasswords, create one named "Supabase", and copy the 16-character password.
4. In Supabase, open **Authentication → Emails → SMTP Settings → Enable custom SMTP** and fill in:

| Field | Value |
|---|---|
| Sender email | `iitmbs.esports.login@gmail.com`. This **must be the same account**, or Gmail rewrites From. |
| Sender name | `IITM BS Esports` |
| Host | `smtp.gmail.com` |
| Port | `465` (SSL), or `587` (STARTTLS) |
| Username | `iitmbs.esports.login@gmail.com` |
| Password | the 16-character App Password, without spaces |
| Minimum interval per user | `60` seconds |

   The matching Management API fields are `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_admin_email` and `smtp_sender_name` (https://supabase.com/docs/guides/auth/auth-smtp).
5. In **Authentication → Rate Limits**, set "Rate limit for sending emails" to **40 per hour**. That keeps a quiet day under Gmail's ~500/day ceiling, and a launch hour can still burst.
6. Send test OTPs to 3 or 4 real @ds.study.iitm.ac.in inboxes and check they land in the Inbox, not Spam.

Changing the account password revokes App Passwords, so a password change means making a new App Password and pasting it into Supabase again.

### Launch-surge escalation (if more than ~400 sign-ins a day are expected)

Gmail's ceiling is about 500 emails a day. A launch with thousands of first-time sign-ins will hit it. Handle it in this order:

1. **Roll out in waves.** Open sign-up house by house or region by region over several days, so each day stays under ~400. It costs nothing and needs no code.
2. **Send Email hook → Edge Function → dispatcher** (the hook is available on Free: https://supabase.com/docs/guides/auth/auth-hooks). When the hook is on, it sends every auth email and SMTP is not used (https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook). The payload carries `email_data.token`. Verify the request with the standardwebhooks signing secret. Edge Functions **cannot open outbound ports 25 or 587** (https://supabase.com/docs/guides/functions/limits), so send over **HTTPS**:
   - primary: an Apps Script web app on a Workspace (IITM) account, which calls `MailApp.sendEmail` (≈1,500/day, same-domain delivery). Protect it with a shared secret in the POST body.
   - fallback: Brevo HTTP API (300/day). It is weaker on deliverability without a domain.
3. If a domain is bought later (it is not zero-cost), switch to Brevo or Resend with SPF, DKIM and DMARC on that domain.

---

## 3. Allowing only @ds.study.iitm.ac.in

Use **both** layers: the Before User Created hook (it gives a clean error) **and** a trigger on `auth.users` (defence in depth, and it also blocks *email changes*, which the hook does not cover).

The Before User Created hook **is available on the Free plan** (https://supabase.com/docs/guides/auth/auth-hooks). Payload, return format and grants are from https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook

```sql
-- 3a. Before User Created hook (Postgres function version)
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_email text := lower(coalesce(event->'user'->>'email', ''));
begin
  -- exactly one @, an allowed local-part (no '+', which blocks alias farming), and the exact domain
  if v_email !~ '^[a-z0-9._-]+@ds\.study\.iitm\.ac\.in$' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Only @ds.study.iitm.ac.in emails can sign up.'));
  end if;
  return '{}'::jsonb;   -- allow
end;
$$;

grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;
-- Dashboard: Authentication → Hooks → Before User Created → Postgres → public.hook_before_user_created
```

Optional, stricter: roll numbers look like `24f2004141`, so you could require `^[0-9]{2}f[0-9]{7}@...`. **[UNVERIFIED]** that every BS student's address has that form (older or diploma batches may differ). Ship with the domain-only rule, and tighten it only after checking real addresses.

```sql
-- 3b. Backstop trigger on auth.users: blocks a bad domain on insert AND blocks any email change
create schema if not exists private;          -- NOT listed in API "Exposed schemas"

create or replace function private.enforce_iitm_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.email is not null and new.email is distinct from old.email then
    raise exception 'email cannot be changed' using errcode = '42501';
  end if;
  if lower(coalesce(new.email,'')) !~ '^[a-z0-9._-]+@ds\.study\.iitm\.ac\.in$' then
    raise exception 'email domain not allowed' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger enforce_iitm_email
  before insert or update of email on auth.users
  for each row execute function private.enforce_iitm_email();
```

**Can an outsider make the project send emails to non-IITM addresses?** With `shouldCreateUser: true`, a new address goes through the user-creation path, the hook rejects it, and the OTP email is sent *after* creation, so no email goes out. **[UNVERIFIED in the docs, high confidence from how GoTrue is built]**. Test it once: request a code for a @gmail.com address and confirm Auth Logs show a 403 and no email is sent. Existing users can still be sent codes, so the remaining abuse is someone spamming a real student's inbox. That is limited by 1 per 60 s per user, by the project-wide email cap, and by CAPTCHA.

**Also switch these off in the dashboard:** phone auth, anonymous sign-ins (lint 0012), every OAuth provider, and "Allow manual linking". Keep "Confirm email" on. Set the Site URL to the Pages URL, and keep the redirect allow-list to that one URL.

### CAPTCHA: Cloudflare Turnstile (free)
Source: https://supabase.com/docs/guides/auth/auth-captcha
1. Cloudflare dashboard → Turnstile → add a widget. Hostnames: `angadseth.github.io` (plus `localhost` for development). Copy the site key and the secret key.
2. Supabase → Authentication → **Bot and Abuse Protection** → Enable CAPTCHA → Turnstile → paste the **secret** key.
3. Static site, no React wrapper needed:

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
<div id="ts"></div>
<script type="module">
  let captchaToken = null
  window.onloadTurnstileCallback = () => turnstile.render('#ts', {
    sitekey: 'YOUR_SITE_KEY', callback: t => { captchaToken = t } })
  // on "Send code": await requestCode(email, captchaToken); then turnstile.reset('#ts') (tokens are single-use)
</script>
```
**[UNVERIFIED]** whether Supabase also asks for a captcha on `verifyOtp`. The docs show it on sign-up and sign-in. Test it.

---

## 4. RLS and privilege design

**Rules**
1. The client gets **SELECT only**, and only on what it needs. Every write goes through `SECURITY DEFINER` RPCs that check input, run as the owner, and use `set search_path = ''` with schema-qualified names (https://supabase.com/docs/guides/database/postgres/row-level-security).
2. RLS is **on for every table**, as a second wall behind the GRANTs.
3. Admin status comes from a **`user_roles` table**, never from `user_metadata`. A signed-in user can change `raw_user_meta_data` themselves with `supabase.auth.updateUser({ data: { role: 'admin' } })`, so it "is not a good place to store authorization data" (RLS docs). Lint 0015 `rls_references_user_metadata` flags exactly this. `app_metadata` is safe but stale until the JWT refreshes. A table lookup takes effect the moment an admin is removed.
4. Private data (email, WhatsApp, full name) lives in a **separate table**. That's safer than relying only on column grants on one table.
5. Watch out: new functions are executable by `PUBLIC` by default. Revoke that and grant to `authenticated` only.

```sql
-- ===== lookup tables =====
create table public.houses  (slug text primary key, name text not null);
create table public.regions (slug text primary key, name text not null);
-- houses: 12 IITM BS houses. [UNVERIFIED list, confirm before seeding] e.g. bandipur, corbett, gir, kanha,
-- kaziranga, nallamala, namdapha, nilgiri, pichavaram, saranda, sundarbans, wayanad

-- ===== people =====
create table public.profiles (               -- PUBLIC fields only
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  house text not null references public.houses(slug),
  region text not null references public.regions(slug),
  created_at timestamptz not null default now()
);
create table public.profile_private (        -- owner + admins only
  id uuid primary key references public.profiles(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  email text not null,
  whatsapp text not null check (whatsapp ~ '^[6-9][0-9]{9}$'),
  consent_at timestamptz not null default now()   -- DPDP Act: record consent to store a phone number
);
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','superadmin')),
  granted_by uuid, granted_at timestamptz default now()
);

-- ===== games / teams / results =====
create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null,
  team_size int not null default 1 check (team_size between 1 and 10),
  bg_image_path text,                         -- path inside the 'game-art' bucket
  registration_open boolean not null default false,
  starts_at timestamptz, created_at timestamptz default now()
);
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 30),
  captain_id uuid not null references public.profiles(id),
  invite_code text not null unique,           -- NEVER granted to clients (column grant below)
  unique (game_id, name)
);
create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (team_id, user_id),
  unique (game_id, user_id)                   -- one team per game per person
);
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz default now(),
  unique (game_id, user_id)
);
create table public.results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid references public.profiles(id), team_id uuid references public.teams(id),
  score numeric not null default 0,
  updated_by uuid, updated_at timestamptz default now(),
  check (num_nonnulls(user_id, team_id) = 1),
  unique (game_id, user_id), unique (game_id, team_id)
);
create table public.game_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_name text not null check (char_length(game_name) between 2 and 60),
  note text check (char_length(note) <= 300),
  status text not null default 'open' check (status in ('open','accepted','rejected')),
  created_at timestamptz default now()
);
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid, action text not null, target text, details jsonb, at timestamptz default now()
);

-- indexes for RLS and the leaderboard (lint 0001; RLS docs: index every filtered column)
create index on public.registrations (user_id);
create index on public.team_members (user_id);
create index on public.results (game_id, score desc);
create index on public.game_requests (user_id);

-- ===== username can never change, enforced in the DB (even admins and the service role) =====
create or replace function private.forbid_username_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.username is distinct from old.username or new.id is distinct from old.id then
    raise exception 'username is permanent' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_username_immutable before update on public.profiles
  for each row execute function private.forbid_username_change();

-- ===== admin check (lives in the private, non-exposed schema) =====
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles
                 where user_id = (select auth.uid()) and role in ('admin','superadmin'));
$$;
create or replace function private.is_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles
                 where user_id = (select auth.uid()) and role = 'superadmin');
$$;
grant usage on schema private to anon, authenticated;     -- needed so policies can call the helpers
grant execute on function private.is_admin(), private.is_superadmin() to anon, authenticated;

-- ===== GRANTS (the 30 Oct 2026 model: nothing is exposed unless granted here) =====
revoke all on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

grant select on public.houses, public.regions, public.games, public.results, public.team_members
  to anon, authenticated;
grant select (id, username, house, region, created_at) on public.profiles to anon, authenticated;
grant select (id, game_id, name, captain_id) on public.teams to anon, authenticated;  -- invite_code hidden
grant select on public.profile_private, public.registrations, public.user_roles,
                public.game_requests, public.audit_log to authenticated;
-- NO insert/update/delete grants to anon/authenticated anywhere. Writes go only through the RPCs below.
-- Column grants mean the client must list columns: select('id,username,house,region'). select('*') fails with 42501.

-- ===== RLS =====
alter table public.houses enable row level security;
alter table public.regions enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.user_roles enable row level security;
alter table public.games enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.registrations enable row level security;
alter table public.results enable row level security;
alter table public.game_requests enable row level security;
alter table public.audit_log enable row level security;

-- public-read tables (lint 0024 warns on `using (true)`; it's intended here)
create policy read_all on public.houses for select to anon, authenticated using (true);
create policy read_all on public.regions for select to anon, authenticated using (true);
create policy read_all on public.profiles for select to anon, authenticated using (true);
create policy read_all on public.games for select to anon, authenticated using (true);
create policy read_all on public.teams for select to anon, authenticated using (true);
create policy read_all on public.team_members for select to anon, authenticated using (true);
create policy read_all on public.results for select to anon, authenticated using (true);
-- owner or admin
create policy own_or_admin on public.profile_private for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy own_or_admin on public.registrations for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy own_or_admin on public.game_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy own_role on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_superadmin()));
create policy admin_only on public.audit_log for select to authenticated
  using ((select private.is_admin()));
-- note `(select auth.uid())`: it's evaluated once per statement, not per row (lint 0003)
```

### RPC skeletons (every write goes through these)

```sql
create or replace function private.audit(p_action text, p_target text, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log(actor, action, target, details)
  values ((select auth.uid()), p_action, p_target, p_details);
$$;

-- one-time profile completion right after the first OTP login
create or replace function public.complete_profile(
  p_username text, p_full_name text, p_house text, p_region text, p_whatsapp text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_email text; v_phone text;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select email into v_email from auth.users where id = v_uid;      -- email comes from auth, NOT from the client
  if lower(v_email) !~ '^[a-z0-9._-]+@ds\.study\.iitm\.ac\.in$' then raise exception 'domain not allowed'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then raise exception 'profile already exists'; end if;
  p_username := lower(btrim(p_username));
  if p_username !~ '^[a-z0-9_]{3,20}$' or p_username in ('admin','root','support','iitm','moderator')
    then raise exception 'invalid username'; end if;
  v_phone := right(regexp_replace(p_whatsapp, '\D', '', 'g'), 10);  -- strips +91 / spaces
  insert into public.profiles(id, username, house, region) values (v_uid, p_username, p_house, p_region);
  insert into public.profile_private(id, full_name, email, whatsapp)
    values (v_uid, btrim(p_full_name), lower(v_email), v_phone);
exception
  when unique_violation then raise exception 'username already taken';
  when foreign_key_violation then raise exception 'invalid house or region';
  when check_violation then raise exception 'invalid name or WhatsApp number';
end $$;

create or replace function public.register_solo(p_game_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); g public.games; v_id uuid;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid)
    then raise exception 'complete your profile first'; end if;
  select * into g from public.games where id = p_game_id for share;
  if not found then raise exception 'game not found'; end if;
  if not g.registration_open then raise exception 'registration is closed'; end if;
  if g.team_size > 1 then raise exception 'squad game: create or join a team'; end if;
  insert into public.registrations(game_id, user_id) values (p_game_id, v_uid) returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'already registered';
end $$;

create or replace function public.create_team(p_game_id uuid, p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); g public.games; v_team uuid;
        v_code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid)
    then raise exception 'complete your profile first'; end if;
  select * into g from public.games where id = p_game_id for share;
  if not found or not g.registration_open or g.team_size < 2 then raise exception 'cannot create team'; end if;
  insert into public.teams(game_id, name, captain_id, invite_code)
    values (p_game_id, btrim(p_name), v_uid, v_code) returning id into v_team;
  insert into public.team_members(team_id, game_id, user_id) values (v_team, p_game_id, v_uid);
  insert into public.registrations(game_id, user_id, team_id) values (p_game_id, v_uid, v_team);
  return v_code;                                   -- only the captain ever sees the code
exception when unique_violation then raise exception 'team name taken, or you are already in a team';
end $$;

create or replace function public.join_team(p_invite_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); t public.teams; g public.games;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid)
    then raise exception 'complete your profile first'; end if;
  select * into t from public.teams where invite_code = upper(btrim(p_invite_code)) for update;  -- serialises joins
  if not found then raise exception 'invalid invite code'; end if;
  select * into g from public.games where id = t.game_id;
  if not g.registration_open then raise exception 'registration is closed'; end if;
  if (select count(*) from public.team_members where team_id = t.id) >= g.team_size
    then raise exception 'team is full'; end if;
  insert into public.team_members(team_id, game_id, user_id) values (t.id, t.game_id, v_uid);
  insert into public.registrations(game_id, user_id, team_id) values (t.game_id, v_uid, t.id);
  return t.id;
exception when unique_violation then raise exception 'you are already in a team for this game';
end $$;
-- "invite by username" = a team_invites(team_id, invitee_id, status) table plus invite_user() and accept_invite() RPCs, same pattern.

-- ===== admin RPCs =====
create or replace function public.admin_set_registration(p_game_id uuid, p_open boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.games set registration_open = p_open where id = p_game_id;
  perform private.audit('set_registration', p_game_id::text, jsonb_build_object('open', p_open));
end $$;

create or replace function public.admin_set_score(p_game_id uuid, p_user_id uuid, p_team_id uuid, p_score numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if num_nonnulls(p_user_id, p_team_id) <> 1 then raise exception 'give exactly one of user/team'; end if;
  if p_user_id is not null then
    insert into public.results(game_id, user_id, score, updated_by) values (p_game_id, p_user_id, p_score, auth.uid())
    on conflict (game_id, user_id) do update set score = excluded.score, updated_by = excluded.updated_by, updated_at = now();
  else
    insert into public.results(game_id, team_id, score, updated_by) values (p_game_id, p_team_id, p_score, auth.uid())
    on conflict (game_id, team_id) do update set score = excluded.score, updated_by = excluded.updated_by, updated_at = now();
  end if;
  perform private.audit('set_score', p_game_id::text,
    jsonb_build_object('user', p_user_id, 'team', p_team_id, 'score', p_score));
end $$;

create or replace function public.superadmin_grant_admin(p_username text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_superadmin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select id into v_id from public.profiles where username = lower(p_username);
  if v_id is null then raise exception 'no such user'; end if;
  insert into public.user_roles(user_id, role, granted_by) values (v_id, 'admin', auth.uid())
    on conflict (user_id) do nothing;
  perform private.audit('grant_admin', p_username, null);
end $$;
-- (admin_upsert_game, admin_review_request and submit_game_request follow the same pattern;
--  submit_game_request caps it at 3 open requests per user)

-- execute rights: authenticated only
revoke execute on function public.complete_profile, public.register_solo, public.create_team,
  public.join_team, public.admin_set_registration, public.admin_set_score,
  public.superadmin_grant_admin from public, anon;
grant execute on function public.complete_profile, public.register_solo, public.create_team,
  public.join_team, public.admin_set_registration, public.admin_set_score,
  public.superadmin_grant_admin to authenticated;
revoke execute on function private.audit(text, text, jsonb) from public, anon, authenticated;
```

**Seeding the superadmin.** After 24f2004141 logs in once and completes the profile, run this in the SQL editor, which runs as the owner (never from the client):
```sql
insert into public.user_roles(user_id, role)
select id, 'superadmin' from auth.users where email = '24f2004141@ds.study.iitm.ac.in';
```

The advisor will flag the RPCs under lint 0029 (`authenticated_security_definer_function_executable`). That's intended and documented here. Make sure **none** trip 0028 (executable by `anon`).

---

## 5. Storage: game background images

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-art', 'game-art', true, 512000,                       -- 500 KB hard cap
        array['image/webp','image/jpeg','image/png','image/avif']);  -- NO image/svg+xml (SVG can carry script)

create policy game_art_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'game-art' and (select private.is_admin()));
create policy game_art_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'game-art' and (select private.is_admin()))
  with check (bucket_id = 'game-art' and (select private.is_admin()));
create policy game_art_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'game-art' and (select private.is_admin()));
create policy game_art_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'game-art' and (select private.is_admin()));    -- needed for upsert and listing in the admin panel
```
- Reading through public URLs (`/storage/v1/object/public/game-art/...`) needs **no** SELECT policy, because public buckets "are already publicly accessible" (https://supabase.com/docs/guides/storage/security/access-control). **Don't** add a broad SELECT policy: it makes the bucket listable (lint 0025).
- The JS equivalent and the bucket limits (`allowedMimeTypes`, `fileSizeLimit`) are on https://supabase.com/docs/guides/storage/buckets/creating-buckets. The Free plan caps any single upload at 50 MB (https://supabase.com/pricing).
- **Resize in the browser before upload.** Server-side image transforms are a paid feature **[UNVERIFIED on the current price page]**. In the admin panel, draw the image to a `<canvas>`, then `canvas.toBlob(cb, 'image/webp', 0.8)` at **1200 px wide, ≤120 KB**, plus a **600 px card version, ≤40 KB**. Name files `games/<slug>-<timestamp>.webp` so caches never go stale, and upload with `cacheControl: '31536000'`.
- **Egress budget (important).** Free gives **5 GB uncached + 5 GB cached egress a month** (pricing page). 5,000 active students × 8 cards × 40 KB ≈ 1.6 GB, which fits. At 300 KB per image it would be about 12 GB, which doesn't. If egress gets tight, move the images into the GitHub Pages repo, which has a much larger bandwidth allowance.

---

## 6. Leaderboard at scale

At this scale (≤30k users, a few thousand entries per game) a **plain `security_invoker` view plus an index** is enough. A materialized view adds refresh work and gets flagged by lint 0016 when it is exposed.

```sql
create view public.leaderboard with (security_invoker = true) as
select r.game_id,
       coalesce(t.name, p.username) as entrant,
       p.username, p.house, p.region, t.id as team_id,
       r.score, r.updated_at,
       rank() over (partition by r.game_id order by r.score desc) as position
from public.results r
left join public.profiles p on p.id = r.user_id
left join public.teams    t on t.id = r.team_id;
grant select on public.leaderboard to anon, authenticated;
```
- `security_invoker = true` means the view runs with the **caller's** privileges and RLS. Without it the view runs as `postgres`, bypasses RLS, and could leak (lint 0010). The view contains **no** email or WhatsApp column, and those columns aren't granted anyway, so PostgREST can't return them. **Never** make a view over `auth.users` (lint 0002).
- A `game_id` filter is pushed into the window partition, so ranks stay correct when you then filter by username:

```js
// page of 50, sorted
const { data, count } = await supabase.from('leaderboard')
  .select('entrant,username,house,region,score,position', { count: 'exact' })
  .eq('game_id', gameId).order('position').range(page*50, page*50 + 49)
// search: escape % and _ first
const q = term.replace(/[%_\\]/g, m => '\\' + m)
await supabase.from('leaderboard').select('entrant,score,position').eq('game_id', gameId).ilike('entrant', `%${q}%`).limit(50)
// my position
await supabase.from('leaderboard').select('position,score').eq('game_id', gameId).eq('username', myUsername).maybeSingle()
```
- If search gets slow, add `create extension pg_trgm with schema extensions;` and a GIN trigram index on `profiles.username` (put extensions in `extensions`, not `public`: lint 0014).
- Use `range()` pagination, which is offset-based and fine for thousands of rows. Use keyset (`.gt('position', last)`) only beyond about 50k rows.
- **Don't use Realtime for leaderboards.** The Free plan allows **200 concurrent Realtime connections** (pricing). Poll every 30–60 s while the tab is visible, or give a refresh button.
- Registration counts per game: add a `security definer` RPC `game_counts()` that returns `(game_id, count)`. That way the registrations table never has to be readable.

---

## 7. Free-tier gotchas

From https://supabase.com/pricing unless noted.

| Limit | Free plan | Impact for us |
|---|---|---|
| Pausing | "Free projects are paused after 1 week of inactivity" | A few requests a day prevent it (https://supabase.com/docs/guides/platform/free-project-pausing). You restore with a dashboard click. That page says up to 1 year in the body but "90-day" in a heading, so treat the restore window as unclear. |
| Database | 500 MB per project | 30k profiles is roughly 30–50 MB, so fine |
| Egress | 5 GB uncached + 5 GB cached a month | Images are the risk (section 5) |
| File storage | 1 GB; 50 MB max per upload | fine |
| Auth MAU | 50,000 | 30k students fits |
| Edge Functions | 500k invocations a month; 256 MB RAM; 2 s CPU; 150 s wall clock; ports 25/587 blocked | https://supabase.com/docs/guides/functions/limits |
| Realtime | 200 concurrent connections, 2M messages | avoid it for public pages |
| Backups | **None** on Free | Nightly `pg_dump` from GitHub Actions (below) |
| Logs | Kept 1 day | Our own `audit_log` table is the durable record |
| Projects | 2 active free projects | |
| Auth emails | 2 per hour until custom SMTP is set | section 2 |

**Keep-alive.** A GitHub Actions cron job pinging a tiny RPC every 3 days is the common community pattern (https://github.com/travisvn/supabase-pause-prevention). The pausing docs only say API calls count as activity. I found **nothing in Supabase's docs or terms that explicitly allows or forbids** scripted pings **[UNVERIFIED]**. A real read is the most defensible choice:
```yaml
# .github/workflows/keepalive.yml
on: { schedule: [{ cron: '17 3 */3 * *' }], workflow_dispatch: {} }
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: >
          curl -fsS "$URL/rest/v1/games?select=id&limit=1"
          -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
        env: { URL: '${{ secrets.SUPABASE_URL }}', KEY: '${{ secrets.SUPABASE_PUBLISHABLE_KEY }}' }
```
In a public repo, GitHub **disables scheduled workflows after 60 days with no repo activity**. So add a monthly commit, or put the keep-alive in a private repo. During term, real student traffic keeps the project awake anyway.

**Backups.** Nightly `supabase db dump`, using the **pooler (Supavisor) connection string**, because the direct DB host is IPv6-only and GitHub runners are IPv4 **[UNVERIFIED for 2026]**. Encrypt the dump (it contains emails and phone numbers) with `age` or `gpg` before uploading it as an artifact or to a private repo.

---

## 8. GitHub Pages frontend

**Routing: use `HashRouter`** (`/#/events`, `/#/game/bgmi`, `/#/me`, `/#/admin`).
- The `404.html` trick serves deep links with an **HTTP 404 status**, and WhatsApp/Telegram link previews and some crawlers dislike that. Hash URLs always return 200.
- The usual problem with hash routing (Supabase magic-link tokens arriving in `#access_token=`) doesn't apply: we only use OTP codes, and `detectSessionInUrl: false` is set.
- If clean URLs are wanted later, copy `dist/index.html` to `dist/<route>/index.html` for each static route at build time, plus `404.html` as the fallback.

**Deploy with Vite + Actions.** From https://vite.dev/guide/static-deploy :
- Use `actions/checkout` v7 → `actions/setup-node` v7 (`node-version: lts/*`, `cache: npm`) → `npm ci` → `npm run build` → `actions/configure-pages` v6 → `actions/upload-pages-artifact` v5 (`path: ./dist`) → `actions/deploy-pages` v5.
- Give the job these permissions: `contents: read, pages: write, id-token: write`.
- Set concurrency group `pages`.
- Repo **Settings → Pages → Source: GitHub Actions**.
- Set `base: '/<repo>/'` for a project site, or `'/'` for a custom domain.
- Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in repo *variables*. They're public anyway; never add the secret key.

**Headers GitHub Pages actually sends.** I checked live on angadseth.github.io on 24 Oct 2026: `Strict-Transport-Security: max-age=31556952`, `Cache-Control: max-age=600`, `Access-Control-Allow-Origin: *`. There's **no** CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy or Permissions-Policy, and no way to add headers.

**CSP through `<meta>`** (only in the production `index.html`, since Vite dev injects inline scripts):
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://challenges.cloudflare.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src https://fonts.gstatic.com;
  img-src 'self' data: blob: https://<ref>.supabase.co;
  connect-src 'self' https://<ref>.supabase.co wss://<ref>.supabase.co;
  frame-src https://challenges.cloudflare.com;
  object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests">
<meta name="referrer" content="strict-origin-when-cross-origin">
```
Browsers **ignore `frame-ancestors`, `sandbox` and `report-uri` in a meta CSP**, and Report-Only can't be sent by meta (https://content-security-policy.com/examples/meta, https://codereview.chromium.org/1835463002).

| Can't control | Risk | Mitigation |
|---|---|---|
| `frame-ancestors` / X-Frame-Options | Clickjacking on the admin panel | JS frame-buster: `if (top !== self) top.location = self.location;`. Hide the admin UI when framed. Ask for a typed confirmation on destructive admin actions. |
| X-Content-Type-Options | MIME sniffing | Low risk: GitHub serves correct types. User uploads go to Supabase, not Pages, and SVG is blocked. |
| Permissions-Policy | n/a | No third-party iframes apart from Turnstile |
| Cache-Control (10 min) | A stale `index.html` right after a deploy | Vite's hashed asset names; tell admins it can take up to 10 min to show |
| Fix-all later | n/a | A custom domain behind Cloudflare (free plan) can add every header with Transform Rules |

**The publishable key in the bundle is fine.** It identifies the app, not the user. The protection is RLS plus GRANTs (https://supabase.com/docs/guides/api/api-keys). The real browser risk is **XSS**: supabase-js keeps the session in `localStorage`, so XSS means account takeover. So: strict CSP, no third-party scripts beyond Turnstile and Fonts, never `dangerouslySetInnerHTML`/`innerHTML` with user data (usernames, team names, request notes), and validate everything in the RPCs too.

---

## 9. Security Advisor and the 15 mistakes to avoid

Run **Dashboard → Advisors → Security Advisor** after every migration. Fix every ERROR. Accept only the documented WARNs (0024 on public-read tables, 0029 on the authenticated RPCs). Lint list: https://supabase.com/docs/guides/database/database-linter

1. A table with **RLS disabled** in `public` (0013), or policies written but RLS off (0007).
2. **Trusting `user_metadata`** for roles (0015). Use the `user_roles` table.
3. **The secret / service_role key in frontend code**, a public repo, or a GitHub Pages build.
4. A **view without `security_invoker = true`** (0010), or any view over `auth.users` (0002).
5. **SECURITY DEFINER functions without `set search_path = ''`** (0011), or kept in an exposed schema when they're helpers.
6. Definer RPCs **executable by `anon`** (0028). Remember the default `PUBLIC` execute grant.
7. Granting **INSERT/UPDATE to clients** and relying on RLS `with check` alone. Users can then write any column (scores, `team_id`, house). Use RPCs.
8. **`using (true)` on private tables** (0024), or the email and WhatsApp columns in a publicly readable table.
9. RPCs that **take user identity from parameters** (`p_user_id`) instead of `auth.uid()`, or the email from the client instead of `auth.users`.
10. **No server-side checks** (length, regex, registration open, team capacity, races). The client is only for UX. Use `for update` locks for capacity.
11. **Leaving the default SMTP on**, or sending all auth email through a personal inbox. Login fails above 2 per hour, or his own mail gets blocked.
12. **Leaving extra auth providers on** (anonymous, phone, OAuth), or a wide redirect allow-list.
13. **A public bucket with a broad SELECT policy** (0025), SVG uploads allowed, or no size or type limit.
14. **No backups** on Free, and treating the 1-day logs as an audit trail.
15. **Policies calling `auth.uid()` per row, and unindexed policy columns** (0003, 0001). Lists get slow at 30k users and look like an outage.

Also: keep `pg_graphql` off. Don't expose materialized or foreign tables (0016/0017). Rotate the SMTP App Password if anyone leaves the admin team.

---

## 10. Alternatives: Supabase is still the pick

| Option | Email OTP code at ₹0? | Domain gate | Authz model | Free limits | Verdict |
|---|---|---|---|---|---|
| **Supabase** | Yes. Native OTP plus a template token; needs custom SMTP. | Before User Created hook (Free) plus a trigger | Postgres RLS, GRANTs, definer RPCs | 50k MAU, 500 MB DB, 5+5 GB egress, pauses after 7 days idle | **Use it** |
| Firebase (Spark) | **No** native email *code*. It has email-*link* sign-in, with low Spark send quotas (https://firebase.google.com/docs/auth/limits). A custom OTP needs Cloud Functions, which need the **Blaze** (card) plan. | Blocking functions are also on Blaze | Firestore rules (no SQL, so a leaderboard needs denormalising) | n/a | Fails the "OTP code at zero cost" requirement |
| Appwrite Cloud Free | Yes (email OTP token) **[UNVERIFIED that it allows custom SMTP on Free]** | Through a Function | Collection/document permissions; weaker than RLS for column privacy | 75k MAU, 2 GB storage, 5 GB bandwidth (https://appwrite.io/pricing) | **Pauses after 7 days without *Console* development activity, and app traffic may not count.** Paused 90 days means deleted (https://appwrite.io/changelog/entry/2026-06-29). Riskier than Supabase. |
| PocketBase (self-host) | Yes (OTP auth built in) | Hooks in JS/Go | Rule strings, SQLite | You need an always-on host with a disk. Free options are poor (Oracle Always Free needs a card; Render free spins down and has no persistent disk). | Too much ops work for one builder |

**Final:** Supabase (Free) + GitHub Pages (HashRouter, meta CSP) + Gmail App-Password SMTP + Turnstile + a domain hook and `auth.users` trigger + grant-nothing, RPC-only writes + `security_invoker` leaderboard view + nightly encrypted dump + keep-alive cron. Upgrade path: a cheap domain gives Brevo/Resend SMTP and Cloudflare headers, and Supabase Pro adds backups and no pausing.

### What only Angad can do (manual)
1. Create the Supabase project. Leave "Automatically expose new tables" **off**.
2. Create the dedicated Gmail account, turn on 2SV, generate the App Password, and paste the SMTP fields (section 2).
3. Create the Cloudflare Turnstile widget and paste the secret into Supabase (section 3).
4. Point the Before User Created hook at `public.hook_before_user_created` in Auth → Hooks.
5. Edit both email templates (Magic Link and Confirm signup) and set OTP expiry to 600 and length to 6.
6. Log in once as 24f2004141, then run the superadmin seed SQL.
7. Set Pages Source to GitHub Actions, and add the repo variables and secrets.
