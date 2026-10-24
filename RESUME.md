# RESUME (24 Oct 2026, ~15:30)
TRIGGER: Angad types "game website continue" in a new terminal -> read this file, do the NEXT list in order, no questions. He does not track state; I own everything.
Repo: github.com/angadseth/pugmark (public; idea/ + MEMORY.md are local-only, gitignored). Last commit b68c402.
Done: units 1-8, CI/Pages/keepalive workflows, dev preview = PGlite (code 123456).
Done b68c402: migration 0006 email access (superadmin_set_email_role, admin_set_email_ban, admin_email_access;
 banned emails blocked at hook+auth trigger) + ALL security-review fixes (docs/security-review.md): no passwords
 (auth trigger + hook_custom_access_token + session_ok in has_role/require_player), confirmed email for onboarding,
 throttles, house_standings rewrite, L3-L10. config.toml: confirmations ON, OTP 8/600s, token hook, no localhost.
 34/34 db-tests pass, build OK.
Minor TODO: dead dev-banner text ships in prod bundle (harmless).
 Not done from review: H1 Turnstile server-side (needs Cloudflare account), M4 8-digit OTP/TOTP (kept 6, 300s).
SUPABASE (ref fehkrxssoxuiixgmfini, Mumbai, URL https://fehkrxssoxuiixgmfini.supabase.co; org zxcwnvqzrmmrwzucbmtm):
 DONE 24 Oct: all 6 migrations live; hooks Before User Created + Custom Access Token ENABLED; Email provider:
 confirm email ON, anon OFF, OTP 8 digits / 600 s (app uses OTP_LENGTH=8, dev code 12345678); Site URL set.
 GitHub vars set, Pages=Actions; LIVE https://angadseth.github.io/pugmark/ (commit 8746694+). Admin "Access by
 email" panel shipped in Players. Live probes OK: gmail 403, password signup refused, profiles/admin RPC denied.
NEXT (blocked on ANGAD, step 1):
 1. Angad: new Gmail (e.g. pugmark.iitm@gmail.com) + 2-Step Verification + App Password; HE pastes it at
    Supabase > Authentication > Emails > SMTP Settings (host smtp.gmail.com, port 465, user = that Gmail,
    sender name Pugmark). Until then login codes don't reach students (built-in mail = team only, 2/hour).
 2. Me after SMTP: Emails > Templates: "Magic link or OTP" + "Confirm sign up" -> subject
    "{{ .Token }} is your Pugmark sign-in code", body = supabase/templates/otp.html (says 10 minutes; code 8 digits).
    Rate Limits: emails/hour ~40 (raise after watching), verify limits default.
 3. Angad signs in with 24f2004141 -> becomes superadmin. Then SQL: update public.app_settings set value='[]'
    where key='bootstrap_superadmins';  Then test Access by email panel live (screen not yet seen visually:
    dev server was killed for low RAM; verify on live site after his login).
 4. Later: Turnstile captcha (needs Cloudflare acct), real regions list, game art uploads.
