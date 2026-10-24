# RESUME (24 Oct 2026, ~13:30)
Repo: github.com/angadseth/pugmark (public; idea/ + MEMORY.md are local-only, gitignored).
Done: units 1-8 (DB+RLS+RPCs, full web app, admin console, rules/privacy), CI + Pages + keepalive workflows,
supabase/config.toml (OTP 600s, 60s resend, hook, templates), dev preview = PGlite in browser (code 123456).
NEW (uncommitted): migration 0006_email_access.sql (superadmin_set_email_role, admin_set_email_ban,
 admin_email_access, banned emails blocked in hook + auth trigger, admins can't touch admins) +
 web/db-tests/email-access.test.ts -> 30/30 tests pass. TODO: admin UI panel "Access by email" in Players,
 add new RPC names to api, commit + push.
Preview: cd web && npx vite --port 5199 ; screenshots: ADMIN=1 node dev/demo.mjs <outdir> 390
Running: security review agent -> docs/security-review.md. NEXT: apply its fixes, rerun db-tests, commit.
SUPABASE (Chrome ext connected, Angad logged in, org zxcwnvqzrmmrwzucbmtm, old paused project exists):
 - IN PROGRESS: creating project "pugmark", region Mumbai (ap-south-1), DB password via "Generate".
 - then SQL editor: run migrations 0001..0006 in order (0005 storage too), then Auth settings:
   email OTP length 6/expiry 600, templates from supabase/templates/otp.html, Before User Created hook ->
   public.hook_before_user_created, disable anon sign-ins/other providers, Site URL https://angadseth.github.io/pugmark/
 - Angad must paste Gmail App Password in Auth > SMTP himself (smtp.gmail.com 465).
 - then repo vars VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (gh variable set), Pages source=Actions.
Open: real IITM regions list (seeded provisional), real game key art (admin uploads), Turnstile optional.
