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
DONE ~16:45: Angad signed in -> username angad_seth, superadmin; bootstrap list cleared ([]).
 Organisers can now record/delete match results (952f4ea + live patch applied). 36/36 tests.
 Live audit: 0 write grants on public tables, RLS on all, no realtime, storage admin-only, roles = only angad_seth;
 Security Advisor 0 errors (warnings = SECURITY DEFINER RPCs by design + leaked-password n/a).
DONE ~17:30: THEME v2 "Holo League" LIVE (1267211..a1482e3+): holo foil event cards per game hue, split-flap
 numbers (Houses/Leaderboards/Me), pugmark cursor trail + magnetic primary buttons (lib/fx.ts), keycap buttons,
 SiteFooter credit "Website made by ANGAD JANGIR" (he asked: Jangir, not Seth). Plan: docs/research/design-v2.md.
 Old theme = git tag theme-ranger-v1. Phone width not yet eyeballed (frames blocked, window would not resize).
DONE ~17:50: folder MOVED to tools_unique/PUGMARK (old iitm-esports locked by VS Code, has MOVED-TO-PUGMARK.txt;
 delete it once free). memory/ = local copies of global notes. Migration 0007 profile_edit LIVE (2d40e11):
 update_my_profile (username 1x/30 days, not while live, audited; full name 3/30d; WhatsApp 5/day) + red
 "keep username respectful or banned for the whole tenure" warning on onboarding + Edit profile sheet. 43/43 tests.
 Test account 25f2003321 (sagar_rathore, friend): delete SQL PREPARED in Supabase SQL tab, Angad must press Run
 (I may not hard-delete data). Also unverified sagar6969rathor@ds... exists (never signed in).
NEXT:
 0. Brand rename asked 24 Oct: "pugmark ajib lag raha, game jaisa chakachond naam". Await his pick, then rename
    everywhere (UI, footer, emails sender name, templates, title; repo/URL rename only if he wants).
 1. Ask Angad how v2 feels on his phone; tune from his words (keep v1 tag for "pehle wala").
 2. Remind Angad: rotate the Gmail App Password he pasted in chat; 2FA on GitHub (Supabase login) + IITM Google.
 3. Check Access by email panel visually on live site (as angad_seth).
 4. Later: auto status cron (pg_cron: upcoming->open->closed by time), Turnstile captcha (needs Cloudflare
    acct), real regions list, game art uploads.
