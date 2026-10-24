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

1. **Day before**: Admin > Events > event > *Lobby & notices*. "Create a new Meet", paste
   the link, add the WhatsApp group link, note e.g. `Region: Asia · 5 games · top 8 to final`.
   Save (notify ticked). Post the "Tomorrow" template. Press "Email all".
2. **30 min before**: open the Meet as host. In Stumble Guys: Party > Create, copy the code.
3. **15 min before**: put the code in "Room code", Save with notify. Players get
   "Room code is up". Post "15 min" if you like.
4. **Start**: check names in the room against Registrations (in-game name column);
   kick unknown names. Post "Room live".
5. **After**: record results in Results, post "Results".

Stumble Guys custom parties hold up to 32. With more players, run heats: one code per
heat, change the code and save again between heats.
