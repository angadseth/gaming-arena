# Match lobby, notices and play links (24 Oct 2026)

Asked for Stumble Guys first; it works for every game.

## What a player sees (event page > Lobby tab)

| State | Shows |
|---|---|
| Not signed in / not registered | Only one card: "Register to open the lobby" (or "Sign in to register"). No links, steps, rules or Meet (since 45baec0) |
| Registered, rules not accepted | Lobby rules checklist + "I agree" + Unlock lobby |
| Registered + accepted | Room code (tap to copy), password, Join Meet, Group chat, Add to calendar, Turn on alerts, note, notices |

Registration itself now needs an "I agree" tick (rules, rulebook, notices).
After registering, the success screen opens the Lobby.

## Who is who: site account vs in-game account (migration 0011)

The site account (IITM email -> username) and the game account (Stumble Guys name) are different.
The bridge is the in-game name, and it is checked three times:

1. **Registration**: the player types their in-game name. One name per event; a second player
   cannot register the same name.
2. **Check-in** (organiser presses "Open check-in", players get pinged): the player confirms or
   fixes the exact in-game name and ticks "this is my own account". Fixes are audited and show as
   "edited" on the roster. **Only checked-in players get the room code.**
3. **In the room**: the organiser's roster lists in-game name <-> @username <-> house. A name in
   the game room that is not checked in earns nothing. (I could not confirm Stumble Guys has a
   host kick; the room code only goes to checked-in players, so outsiders are rare.) With the
   Meet limited to IITM accounts, the Meet tile also shows the person's IITM name.

Results: Admin > Results > **Names in order**. The host types the in-game names off the results
screen, best first, one line per place; names on one line split by commas share the place (e.g.
everyone out in round 1). The site matches each name to its player like `ig_key` does (case,
spaces, colour tags ignored), suggests the closest registered name for typos, and needs an
explicit tick to skip outsiders (registered players then move up). Not listed = 0 for that game.
Disputes: the player shows their in-game profile on the Meet; organiser decides.

### Every name scenario

| Case | What happens |
|---|---|
| Already has a Stumble account | Types the name exactly as on the home screen (top-left). No rename needed: after the first free rename, a rename costs 100 gems. |
| New to Stumble Guys | Register page shows "New to it?" + Browser / Play / App Store / Steam chips. Gets the game, picks a name, registers with it. |
| Name has colour tags | `[color=red]Rahul[/color]` is cleaned to `Rahul` automatically, on register and check-in. |
| Emoji or symbols in the name | Pattern allows letters, numbers, space, `_ . -`. Player registers the plain part; host types the same when entering results. |
| Two players, same name | Second one gets "name taken" (unique per event, case/space-insensitive). Only the real owner can prove it on Meet; organiser fixes with "Fix name". |
| Changes name before match day | Fixes it at check-in (prefilled, editable). Change is audited ("edited" on the roster). |
| Changes name after check-in | Locked. Organiser can fix it with "Fix name" (audited). |
| Plays on a friend's account (ringer) | Rule: own account only. Asked on Meet to show profile; ringer = DQ. |
| Forgot to check in | No room code. Check-in stays open until 6 h after the start. |
| Outsider gets the code | Their name is not on the roster: they get nothing and registered players move up. |
| Disconnects mid-game | Placed where they ended up; plays the next game. |

## Points (x100)

Every table is x100 (1 old point = 100). Stumble Guys per game: 1st 1000, 2nd 700, 3rd 500,
4th 400, 5-8 250, 9-16 100, everyone else in the room 50. A heat adds up its games.
House points default: 1000 / 700 / 500 / 400 / 200 / 100.

## One fixed Meet link

Admin > any event > Lobby & notices > "Fixed Meet link (all events)". Every lobby uses it unless
that event fills in its own Meet.

## How players get notified

1. **Bell + Notices page** (`/inbox`): unread badge, polled every 60 s.
2. **Browser alerts**: "Turn on alerts" asks permission; while the site is open in any tab,
   a new notice pops a system notification (tap opens the lobby).
3. **Email**: admin Lobby page > "Email all N" opens Gmail compose with everyone in BCC
   (40 per button), subject + text + lobby link filled. Send from the organiser's IITM mail.
4. **WhatsApp**: "WhatsApp text" copies a ready message with the lobby link for the group.
5. **Calendar**: "Add to calendar" puts the match in the player's Google Calendar, so the
   phone itself reminds them, with the Meet link as the location.

Not built (needs money or keys): true push when the site is closed (service worker + VAPID +
a sender function) and automatic emails (Edge Function + SMTP secret). Both fit on top later.

## Architecture

```
GitHub Pages (React)                     Supabase Postgres (RLS on, grant-nothing)
 Event page > Lobby tab ── event_lobby() ──> event_lobby + event_notices + lobby_agreements
 Bell / Notices page ───── my_notices() ──> event_notices (only events I am in)
                           mark_notices_seen() -> profiles.notices_seen_at
 Admin > Event > Lobby ─── admin_set_lobby / admin_post_notice / admin_delete_notice / admin_lobby
 Admin > Game ──────────── admin_set_game_play -> games.play_links, games.join_steps (public)
```

- `tournaments` is world-readable, so the Meet link and room code live in `event_lobby`,
  which no client can select; only `event_lobby()` returns it, and only to registered,
  active players who accepted the current `lobby_rules_version` (or staff).
- Bump `app_settings.lobby_rules_version` to make everyone accept again.
- Migration: `supabase/migrations/20261024000010_lobby_notices.sql`; tests:
  `web/db-tests/lobby-notices.test.ts`.

## Organiser runbook: a Stumble Guys match

A Stumble Guys room code cannot be made in advance: it exists only once the host presses
Party > Create, on match day. So the plan is fixed in advance and the code goes in at the end.
The admin Lobby page shows this as a 4-step timeline with the real clock times.

1. **Any day before** (e.g. Monday for a Friday 9 pm Game Night): create the event with
   `starts_at` = Fri 21:00, open registration. In *Lobby & notices* add the WhatsApp group link
   and a note e.g. `Region: Asia · 5 games`. Thursday: post the "Tomorrow" template, Email all.
2. **20:15 (start - 45 min)**: check-in opens by itself. Press "Open check-in" only to ping
   everyone (it also resets earlier check-ins).
3. **20:50 (start - 10 min)**: open the Meet as host. In Stumble Guys: Party > Create, copy the
   code, paste in "Room code", Save with notify. Only checked-in players see it.
4. **21:00**: start when the checked-in names are in. If the party breaks or a new heat needs a
   new room: paste the new code, Save again.
5. **After every game**: Results > Names in order > Save. Standings, the leaderboard and XP update
   at once. Post the "Results" template at the end.

Stumble Guys custom parties hold up to 32. With more players, run heats: one code per
heat, change the code and save again between heats.

## Rewards: why players register, agree and check in (migration 0012)

Lobby side card "What you unlock": Register -> lobby; accept rules -> Meet link + group chat;
check in -> room code + 100 XP; play -> 50 to 1000 points a game; top 3 -> house points,
Podium badge, hall of fame (event podium).

Player card on Me (`player_card()`, computed live, nothing stored, cannot be edited):
- XP = your entries' match points + 100 per check-in.
- Levels: Rookie 0, Bronze 1000, Silver 3000, Gold 6000, Platinum 10000, Diamond 20000, Legend 40000.
- Badges: Debut (first game), Regular (3 check-ins), Game winner, Podium, Champion.
  Locked badges show how to unlock them.
No money prizes: entry is free and there is nothing to bet (Online Gaming Act).

## Loophole review (24 Oct, review agent) and what was fixed in 0011

| Finding | Fix |
|---|---|
| Room code leaked through notice titles (inbox, lock screen, WhatsApp, email) | Notices only say "Room code is up"; old titles rewritten |
| Two players swap in-game names between a game and its results | Name locked once checked in or once any match exists; organiser-only `admin_set_ig_id` (audited, "Fix name" on roster) |
| Disqualified players still saw the room code and notices | `in_event`, inbox, rules and check-in require an active entry; no code after completed/cancelled |
| Lookalike names (zero-width space, Cyrillic) | `ig_key()` unique index (NFKC, invisible chars stripped); Stumble names ASCII only; roster flags "odd chars" |
| Points caps still at the old scale; x1 fallback tables | Caps -100000..100000; fallback tables x100; points columns numeric(10,2) |
| Notify bypassed the notice throttle | throttle on lobby/check-in notices; delete checks not-found |
| Check-in never reset between heats | Opening check-in starts a new round (everyone checks in again) |
| Nobody gets the code if organisers forget check-in | Check-in opens by itself 45 min before `starts_at` |
| Polling cost on the free tier | Hidden tabs stop polling; bell fetches 10, Notices page 50; audit_log index |
| Fixed Meet link kept forever by anyone who saw it | Make the Meet IITM-only with host admit; rotate it each term |
| x100 migration abort when kill_points > 10 | Constraints dropped before scaling, re-added after |
