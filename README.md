# Pugmark · IITM BS Esports

The esports league of the IIT Madras BS degree: tournaments for 15 games, solo and team
registration, live standings, house standings and an organiser console.

- **Frontend:** React + Vite (static, GitHub Pages). `web/`
- **Backend:** Supabase (Postgres, Auth email OTP, Storage). `supabase/`
- **Security model:** every table has RLS; clients get read access to public data only, and every
  write goes through a validated `SECURITY DEFINER` function. Sign-in is limited to
  `@ds.study.iitm.ac.in` / `@es.study.iitm.ac.in` by an auth hook and a database trigger.

## Develop

```bash
cd web
npm install
npm run dev          # no Supabase env -> runs the real migrations in-browser (PGlite); code 12345678
npx vitest run db-tests   # database security tests
```

## Deploy

1. Supabase: `npx supabase link --project-ref <ref>`, then `npx supabase db push` and `npx supabase config push`.
2. Set SMTP (dedicated Gmail + App Password) in the Supabase dashboard.
3. GitHub repo variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; Pages source = GitHub Actions.

Docs: `PLAN.md`, `docs/research/`, `docs/security-review.md`.
