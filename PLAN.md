# PUGMARK — IITM BS Esports platform: PLAN

Goal: a company-grade esports platform for every IIT Madras BS student (DS + ES).
Sign in only with an IITM email + 6-digit OTP. Events, team/solo registration,
per-event leaderboards, house standings, profile, full admin panel. Hosted free:
GitHub Pages (static frontend) + Supabase free (Postgres/Auth/Storage).
Superadmin: 24f2004141@ds.study.iitm.ac.in. Research in docs/research/.

## Decisions (made by me; owner gave full authority 24 Oct 2026)
- Stack: Vite + React + TS, HashRouter, TanStack Query, supabase-js. No SSR.
- Security: grant-nothing DB; every write is a SECURITY DEFINER RPC with validation;
  RLS on all tables; roles in user_roles; email domain hook + auth.users trigger;
  no '+' aliases; username + email immutable; WhatsApp only to owner + staff.
- Login = OTP only (no passwords to leak). Custom SMTP = dedicated Gmail + App Password.
- Teams: mixed-house allowed by default; house points split pro-rata across members'
  houses. Per-event flag same_house_teams for "House Cup" events.
- Entry is always free (India online gaming law, in force 1 May 2026).
- Design: RANGER direction (docs/research/design-direction.md), brand PUGMARK.
- Local dev backend: PGlite in the browser running the real migrations (no Docker).

## Units
| # | Unit | Done when |
|---|------|-----------|
| 1 | DB schema, RLS, RPCs, seed, PGlite tests | 19+ tests green |
| 2 | Web foundation: tokens, shell, router, API layer (supabase or pglite) | app boots on both backends |
| 3 | Auth: email -> OTP -> onboarding | new user reaches profile; domain errors clear |
| 4 | Events list + event page + solo/team registration + join by code | registers on PGlite |
| 5 | Leaderboards (event standings, search/sort, my position) + house standings | ranks match DB |
| 6 | Profile: my entries, team management, WhatsApp edit | |
| 7 | Admin: games (art upload), events, registrations + CSV, results + JSON paste, users/roles, requests, regions, audit | every admin RPC reachable |
| 8 | Rules, privacy, about pages; 404; empty/error states | |
| 9 | Deploy: GitHub repo, Actions -> Pages, Supabase project + migrations + auth config | live URL works end to end |
| 10 | Security review agent + fixes; phone-width visual pass | no open high findings |
