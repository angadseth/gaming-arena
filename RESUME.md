# RESUME: Gaming Arena (25 Oct 2026, ~18:30)
TRIGGER: "game website/arena continue" -> read this; full 25 Oct log = docs/RESUME-history-2026-10-25.md; MEMORY.md "START HERE".
LIVE https://angadseth.github.io/gaming-arena/ · repo angadseth/gaming-arena (main protected, angadseth push bypasses;
 the "must be PR" text is only a notice) · angadseth/pugmark = redirect-only repo (keep!).
Supabase ref fehkrxssoxuiixgmfini (Mumbai). Superadmin angad_seth = 24f2004141@ds. Admins: Sagar 25f2003321@ds,
 Abhimanyu 24f3002949@mg. Dev preview: cd web; npx vite --port 5199 (code 12345678); KILL vite when done.
SQL: I copy to clipboard, he pastes + presses Run. NEVER navigate/close the Supabase SQL tab after pasting
 ("Leave site?" dialog froze his mouse once). Data edits: use admin UI.

STATE: migrations 0001-0020 all RUN (0021 pending) + verified live. Tree clean after bffa1b4 + this file.
 Built 25 Oct: roles v2, Team & access, @mention results, card dashboard, Open Games/Upcoming home, top-3 + my-rank
 leaderboards, per-game-night boards, Diwali (toran, kandils, crackers always on), slim ribbon footer, live updates
 (realtime 'arena' topic + 60 s poll), optimistic open/close, Girls/Boys avatars, skribbl auto-score bookmark.
 ~18:20 skribbl bookmark tested in a REAL skribbl.io room: selectors right, "(You)" stripped. skribbl strips
 . , & ' % $ " < > / + # and cuts long names -> quick entry now matches letters+digits + unique 8+ prefix (live).
 Not tested: a full skribbl game podium (needs 2 humans) -> do it on game night.

25 Oct ~18:50 (he: "bina sign in kuch nahi dikhna chahiye", incognito opened #/leaderboards): commit 4379f8c LIVE:
 every route except /signin, /rules, /privacy needs a session (RequireAuth around the Shell children), next= returns
 the visitor to the link after sign-in. Verified live signed-out. Migration 0021_signed_in_only (anon loses all tables
 + functions) copied to his clipboard -> WAITING for him to Run, then verify with curl anon key = permission denied.
 Old version: tag before-signin-only.
WAITING ON HIM: which step fixed his mouse (18:15); which 2 accounts "registered but not in admin" (none in DB).
OPEN QUESTIONS (since 24 Oct): b. one roll = one account across ds/es/mg? c. "Verified on Meet" tick for top 3?
 d. Top Players incl. live events? e. Abhimanyu's surname for the footer?
NEXT: 1. Real game-night test with a friend. 2. Supabase Auth Site URL -> /gaming-arena/; SMTP sender name still
 "Pugmark" (dashboard Auth settings, not the SQL tab). 3. Rotate Gmail app password; 2FA. 4. Photo upload (offered,
 needs admin remove button first). 5. Offered: GitHub Action to auto-apply migrations (needs his Supabase token).
Old versions: git tags before-roles-v2, before-footer-ribbon, before-jaipuri-kandil.
RULES: small cards not tables/text walls; build what he names; keep versions; loophole-review before big features;
 verify live in Chrome.
