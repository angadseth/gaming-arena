# RESUME: Gaming Arena (25 Oct 2026, ~12:40)
TRIGGER: "game website continue" -> read this, then MEMORY.md "START HERE" if needed. He doesn't track state; I own it.
LIVE https://angadseth.github.io/gaming-arena/ · repo github.com/angadseth/gaming-arena · angadseth/pugmark = redirect-only repo (keep!)
Supabase ref fehkrxssoxuiixgmfini (Mumbai). Superadmin angad_seth = 24f2004141@ds. Dev preview: cd web; npx vite --port 5199 (code 12345678).
I can't press Run in Supabase: copy SQL to clipboard, paste in Monaco, HE presses Run. Data edits: use admin UI.

25 Oct session (his asks, all built):
 - GitHub: 9sagar6 (Sagar Rathore) invited with WRITE (not admin). main is protected: PR + 1 approval; Angad (admin) can still push.
 - Roles v2 = migration 0015 (includes 0014 mg domain): superadmin = everything; admin = open/close events, results
   with @mentions, ± points, see registrations, run lobby; NO roles/bans/player edits/requests/logs/games/event settings.
   Sagar 25f2003321@ds + Abhimanyu 24f3002949@mg pre-set as admin by email. Public badges: crown "Super Admin", star "Admin".
   Tests: web/db-tests/roles-v2.test.ts (79/79 pass). He wants: admins never add staff themselves; they ask him.
 - Results: WhatsApp-style @ autocomplete of registered players only (pages/admin/MentionBox.tsx); "@name, points".
 - Dashboard = card "Control room" (Overview.tsx + EventCard.tsx); admin Events page = cards, no table.
 - Home: "Open Games" + "Upcoming" sections (no All/Open/... chips). Completed events only on Leaderboards.
 - Games: Smash Karts, Stumble, BGMI, FF, CODM, skribbl, CoC, Clash Royale, CS2, Valorant, Among Us, Extra first;
   he said do NOT remove any game; old 7 stay after them (sort 21-27). New art in web/public/art (CREDITS.md).
 - Diwali: toran svg (wire+bulbs+marigolds in one svg = no drift on zoom), diyas, Diwali banner with "Patakhe on/off",
   crackers canvas BEHIND content: rockets (peony/ring/willow/crackle), anaar, chakri, kandils, tap sky to burst.

STATE: see bottom of this file for whether 0015 is pasted / run and what was deployed.

OPEN QUESTIONS to Angad (still unanswered from 24 Oct):
 b. One roll number = one account across ds/es/mg? c. "Verified on Meet" tick for top 3? d. Top Players incl. live events?
 e. Abhimanyu's surname for the footer?
NEXT: 1. He presses Run on 0015, then I verify live (badges, admin login as Sagar). 2. Real game-night test with a friend.
 3. Supabase Auth Site URL -> /gaming-arena/; SMTP sender name still "Pugmark". 4. Rotate Gmail app password; 2FA.
RULES: small cards not tables/text walls; build what he names; keep versions; loophole-review before big features; verify live in Chrome.
