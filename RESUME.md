# RESUME (24 Oct 2026, ~13:35)
TRIGGER: Angad types "game website continue" in a new terminal -> read this file, do the NEXT list in order, no questions. He does not track state; I own everything.
Repo: github.com/angadseth/pugmark (public; idea/ + MEMORY.md are local-only, gitignored). Last commit b68c402.
Done: units 1-8, CI/Pages/keepalive workflows, dev preview = PGlite (code 123456).
Done b68c402: migration 0006 email access (superadmin_set_email_role, admin_set_email_ban, admin_email_access;
 banned emails blocked at hook+auth trigger) + ALL security-review fixes (docs/security-review.md): no passwords
 (auth trigger + hook_custom_access_token + session_ok in has_role/require_player), confirmed email for onboarding,
 throttles, house_standings rewrite, L3-L10. config.toml: confirmations ON, otp_expiry 300, token hook, no localhost.
 34/34 db-tests pass, build OK.
TODO code: admin UI "Access by email" panel in web/src/pages/admin/Players.tsx (superadmin: email + role select;
 admins: ban/unban email + note; list from admin_email_access). Remove dead "code is 123456" banner from prod.
 Not done from review: H1 Turnstile server-side (needs Cloudflare account), M4 8-digit OTP/TOTP (kept 6, 300s).
SUPABASE: project CREATED: name pugmark, ref fehkrxssoxuiixgmfini, Mumbai, URL https://fehkrxssoxuiixgmfini.supabase.co
 (org zxcwnvqzrmmrwzucbmtm; DB password was auto-generated, not saved; auto-expose OFF, auto-RLS ON).
 Chrome ext works (tab group); Angad logged in. NEXT:
 1. DONE 13:40: all 6 migrations ran in SQL editor (fetched from raw.githubusercontent @b68c402 into Monaco via JS); verified 15 games/15 events/12 houses/guard trigger/bucket; 8 anon fns.
 2. Auth: Email provider ON + confirm email ON, OTP 6 / 300s, templates (supabase/templates/otp.html, subject
    "{{ .Token }} is your Pugmark sign-in code") for Magic Link + Confirm signup, hooks: Before User Created ->
    public.hook_before_user_created, Custom Access Token -> public.hook_custom_access_token; anon sign-ins OFF;
    Site URL + redirect https://angadseth.github.io/pugmark/
 3. Angad: Gmail + App Password into Auth > SMTP himself (smtp.gmail.com 465).
 4. gh variable set VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (publishable key from API settings), Pages=Actions.
 5. After his first sign-in: update app_settings set value='[]' where key='bootstrap_superadmins'.
