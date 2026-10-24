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
DONE 24 Oct ~16:20: SMTP saved by Angad (sender onlypadaicontent0001@gmail.com, name Pugmark, 465);
 templates "Magic link or OTP" + "Confirm sign up" set (subject {{ .Token }}..., body otp.html).
 BUG FIXED live (22123be + supabase/live-patches/): GoTrue gives OTP users a random encrypted_password, so the
 trigger's password check blocked all sign-ups; now passwords are blocked only by token hook + session_ok().
 Test code SENT to 24f2004141 OK (8 boxes render).
NEXT:
 1. Angad enters code + onboarding (username permanent) -> superadmin. Verify get_my_profile roles.
 2. SQL: update public.app_settings set value='[]' where key='bootstrap_superadmins';
 3. Check Access by email panel on live site visually (Players page), and Me/Register flows.
 4. Later: Turnstile captcha (needs Cloudflare acct), real regions list, game art uploads, rate limit check
    (Gmail ~500/day; Supabase custom-SMTP default 30 emails/hour).
