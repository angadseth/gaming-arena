# RESUME: Gaming Arena (25 Oct 2026, ~13:15)
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
 - Leaderboards (event + Top players): ONLY top 3 podium cards + "my rank" card (LinkedIn Zip style: #rank of N,
   top %, points, stats, gap to next, share). Full list only on admin Results. Badges plain text (no crown/star, his call).
 - Team & access page (/admin/access, Super Admin only, nav + dashboard tile): email/roll + chips Make Admin/
   Organiser/Remove role/Ban/Unban; a card per person with role tag + tick list of every power; quick buttons.
   Data = migration 0016 superadmin_access_list() (falls back to admin_email_access until run). Players page
   now just links there. Also fixed phone top bar overflow (name + Super Admin tag = 480px page at 390).
 - Diwali: toran svg (wire+bulbs+marigolds in one svg = no drift on zoom), diyas, Diwali banner with "Patakhe on/off",
   crackers canvas BEHIND content: rockets (peony/ring/willow/crackle), anaar, chakri, kandils, tap sky to burst.

STATE 25 Oct ~13:30: 0015 + 0016 RUN by him (Success). Verified live: Team & access shows angad_seth Super Admin 11/11,
 sagar + abhimanyu Admin 5/11 (both signed up); home = 1 open + 18 upcoming = 19 games. Until then: no new games, no badges, open/close button errors. Old version = git tag before-roles-v2.
 His PC has Windows animations OFF (prefers-reduced-motion) -> crackers were hidden; now the banner switch overrides it
 (turned ON in his Chrome). Pushing to main works for angadseth (admin bypass of protection; "must be PR" text is just a notice).

25 Oct ~17:15 (his asks, commit 6227621; 0017 RUN by him + PUSHED bef2763 ~17:15, verified live):
 - Footer = slim neon ribbon (GAME NIGHT / GAMING ARENA / FOR PAN IIT / ENTRY FREE, runs even with reduced motion) + one line
   (links · "For Pan IIT · Entry free" · credit right). ~80px vs ~760. Old footer = git tag before-footer-ribbon.
 - Sign-up form: no WhatsApp/mobile field (optional on profile).
 - BUG FIXED: houses/top players counted only status=completed; admins can only open/close -> all houses 0.
   Migration 0017_live_standings: count open/closed/live/completed, only entries with a result or ± points
   (no-shows no longer take house points); whatsapp nullable; skribbl ig label "skribbl name". 87/87 tests.
 - skribbl auto-score: admin Results (skribbl event) shows a bookmark (SkribblScorer.tsx) that reads skribbl.io
   #game-players (.player-name/.player-rank/.player-score, own row has "(You)") and opens Results?from=skribbl&lines=...
   -> names prefilled winner first -> admin presses Save. Verified on a mock DOM + local preview.
 DONE: he ran 0017, pushed, live verified (footer 79px + ribbon, Houses: Wayanad 1000 / Pichavaram 700, skribbl card on
   admin Results). Supabase SQL page is blocked for me even to open: he pastes SQL himself (I copy it to clipboard).
 DONE 25 Oct ~18:20: skribbl bookmark tested in a REAL skribbl.io private room (2 players, own "(You)" stripped,
   selectors #game-players .player/.player-name/.player-rank/.player-score all real). Found: skribbl strips
   . , & ' % $ " < > / + # from names and cuts long ones -> commit bffa1b4: quick entry falls back to letters+digits
   match + unique 8+ char prefix (web/src/pages/admin/parseLines.test.ts 4/4). Full game podium not played (needs 2 humans).
 - 25 Oct ~17:25 LIVE UPDATES (he: "instant update ho jaye, bacche refresh kar rahe"): 0018_live_updates = statement
   triggers -> realtime.send(kind) on public topic 'arena' (no data); client useLiveUpdates (lib/app.tsx) batches 0.4 s
   and invalidates queries; 60 s polling fallback. Frontend PUSHED + deployed; public channel verified (2-client test).
   0018 RUN by him ~17:25; VERIFIED live: listener on 'arena' got PING events after a real event change (11:56 UTC).
 - Mediator answer: results are staff-only already (Organiser can ADD results, Admin can edit/delete); give a
   trusted person the Organiser role from Team & access; kids never see the skribbl card.
 - 25 Oct ~17:40 (he: "close turant nahi hua", footer floats on short pages): admin toggle is optimistic (flips in
   ~70 ms), home Open Games = open+live only (closed -> Upcoming), live batch 150 ms, #root flex column so footer
   sticks to the bottom. Pushed + deployed; live footer verified at viewport bottom.
 - 25 Oct ~17:40 he said 2 new accounts registered but names not in admin. Checked live: 'entries' ping arrives
   (<1 s) and a second admin tab refetches admin_registrations on it. DB has NO registrations from new accounts after
   17:26 (only desibeer -> skribbl 17:31); Players list has no new profiles. Asked him which emails/event. Added 5 s
   polling on admin registrations as backup. (Did 2 no-op saves of newbie +100 for the test: audit shows entry.points 100->100.)
 - 25 Oct ~18:00 PUSHED: Game boards (0019 night_of/boards_index/game_board; Leaderboards: game chips, Overall + per
   night chips, Tonight default), Jaipuri kandils (lib/kandil.ts; tag before-jaipuri-kandil) + crackers always on
   (no switch), avatars Girls (pookie, queen) / Boys (boy, dude) (0020). 96/96 tests. 0019+0020 RUN by him ~18:05 + verified live (boards_index, game_board, Leaderboards page).
   Photo upload offered, not built (needs admin remove button first).
 - 25 Oct ~18:15 his PC "mouse click kaam nahi kar raha": CPU/RAM fine, nothing hung. Killed 4 leftover vite servers
   (5199-5202). Likely cause = "Leave site?" dialog in the Supabase SQL tab (unsaved query) from my earlier navigate.
   Told him: press Leave/Esc, Ctrl+Alt+Del > Cancel, replug mouse, quit Wispr Flow. Waiting on which step fixed it.
   LESSON: never navigate/close the Supabase SQL tab after pasting (open a NEW tab); kill my vite servers when done.
 All code committed + pushed (e4ac75e), tree clean.

OPEN QUESTIONS to Angad (still unanswered from 24 Oct):
 b. One roll number = one account across ds/es/mg? c. "Verified on Meet" tick for top 3? d. Top Players incl. live events?
 e. Abhimanyu's surname for the footer?
NEXT: 1. (done) Run 0015+0016. Offered: GitHub Action to auto-apply future migrations (needs his Supabase token as a secret). then I verify live (badges, admin login as Sagar). 2. Real game-night test with a friend.
 3. Supabase Auth Site URL -> /gaming-arena/; SMTP sender name still "Pugmark". 4. Rotate Gmail app password; 2FA.
RULES: small cards not tables/text walls; build what he names; keep versions; loophole-review before big features; verify live in Chrome.
