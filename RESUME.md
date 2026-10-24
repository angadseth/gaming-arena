# RESUME (24 Oct 2026)
Repo: github.com/angadseth/pugmark (public; idea/ + MEMORY.md are local-only, gitignored).
Done: units 1-8 (DB+RLS+RPCs+19 tests, full web app, admin console, rules/privacy), CI + Pages + keepalive workflows,
supabase/config.toml (OTP 600s, 60s resend, hook, templates), dev preview = PGlite in browser (code 123456).
Preview: cd web && npx vite --port 5199 ; screenshots: ADMIN=1 node dev/demo.mjs <outdir> 390
Running: security review agent -> docs/security-review.md. NEXT: apply its fixes, rerun db-tests, commit.
BLOCKED ON ANGAD (unit 9 deploy):
 1. supabase.com account + new project "pugmark" (region Mumbai), send project ref/URL.
 2. run `! npx supabase login` in this session -> then I run link, db push, config push, db advisors.
 3. dedicated Gmail + 2FA + App Password, pasted by HIM in Supabase Auth > SMTP (host smtp.gmail.com, 465).
 4. then I set repo vars VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, Pages source=Actions.
Open: real IITM regions list (seeded provisional), real game key art (admin uploads), Turnstile optional.
