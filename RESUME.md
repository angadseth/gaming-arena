# RESUME: Gaming Arena (25 Oct 2026, ~01:00)
TRIGGER: "game website continue" -> read this, then MEMORY.md "START HERE" if needed. He doesn't track state; I own it.
LIVE https://angadseth.github.io/gaming-arena/ · repo github.com/angadseth/gaming-arena (last f68062c) · angadseth/pugmark = redirect-only repo (keep!)
Supabase ref fehkrxssoxuiixgmfini (Mumbai). Superadmin angad_seth = 24f2004141@ds. Dev preview: cd web; npx vite --port 5199 (code 12345678).
Migrations 0001-0013 LIVE. 0014 (allow @mg.study) PASTED in Supabase SQL tab: he must press Run (UNCONFIRMED).
I can't press Run in Supabase (auto mode blocks): copy SQL to clipboard, paste in Monaco, he presses Run. Data edits: use admin UI.

STATE (what exists): Stumble Guys Season 1 = registration OPEN, closes Fri 30 Oct 20:00, starts 21:00 IST.
 Fixed Meet (all events) https://meet.google.com/gzm-enay-fab. Lobby hidden until registered; check-in auto T-45;
 room code only to checked-in. Admin Results = cards, "name, points" per line (no points = table), Edit/Delete per game.
 Event standings: "Your position" card. Footer: "Made by Angad Jangir, Abhimanyu and Sagar Rathore" (equal, his call).
 Test data on live: newbie (25f1001880) registered + DQ'd, game "stumble k chode" 1000 pts. Ask before clearing.
 Docs: docs/match-lobby.md (architecture, every name scenario, game-night runbook). Screens: web/dev/gamenight-demo.mjs.

OPEN QUESTIONS to Angad (ask first thing):
 a. Did you press Run for 0014 (mg emails)? 24f3002949@mg must be able to log in.
 b. One roll number = one account across ds/es/mg? (desibeer = 24f3002949@ds already exists -> could make 2 accounts.) I recommend YES.
 c. Top 3 "Verified on Meet" tick before points are final? (offered, no answer)
 d. Top Players page counts only COMPLETED events; include live events? (offered, no answer)
 e. Abhimanyu's surname for the footer?

NEXT (he said 25 Oct: "kal se aur deep cheez, website bahut zyada update karenge"):
 1. Answer/implement a-e above. 2. Real test with a friend: register -> check-in -> room code -> results.
 3. Supabase dashboard: Auth > URL config Site URL -> /gaming-arena/ ; SMTP sender name still "Pugmark".
 4. Remind: rotate the Gmail app password he pasted in chat; 2FA on GitHub + IITM Google.
 5. Later ideas: pg_cron auto status (upcoming->open->closed->live), Turnstile captcha, screenshot OCR for results.
RULES: small boxes/cards, not text walls, not oversized; build what he names; keep versions (git tags/history);
 run a loophole-review agent before big features go live; verify live in Chrome after every deploy.
Full history: MEMORY.md (bottom section has the old long RESUME).
