# Match lobby, notices and play links (24 Oct 2026)

Asked for Stumble Guys first; it works for every game.

## What a player sees (event page > Lobby tab)

| State | Shows |
|---|---|
| Not signed in / not registered | "Get the game" tiles, "How to join the room" steps, a locked card with Register |
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
3. **In the room**: the organiser's roster lists in-game name <-> @username <-> house. Anyone in
   the game room whose name is not checked in gets kicked. With the Meet limited to IITM accounts,
   the Meet tile also shows the person's IITM name: a second check.

Results are entered by in-game name (Results dropdown shows "username · in-game name"). A name in
the final screenshot that is not on the roster gets nothing. Disputes: the player shows their
in-game profile on the Meet; organiser decides.

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

1. **Day before**: Admin > Events > event > *Lobby & notices*. Fixed Meet is already set;
   add the WhatsApp group link, note e.g. `Region: Asia · 5 games · top 8 to final`.
   Save (notify ticked). Post the "Tomorrow" template. Press "Email all".
2. **30 min before**: open the Meet as host. In Stumble Guys: Party > Create, copy the code.
3. **30 min before**: press "Open check-in" (players get pinged).
4. **15 min before**: put the code in "Room code", Save with notify. Only checked-in
   players see it.
5. **Start**: compare names in the game room with the roster; kick names that are not
   checked in. Post "Room live".
6. **After**: record results in Results, post "Results".

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
