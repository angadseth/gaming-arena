# IITM BS Esports: Games, Rules, Points and Lifecycle

Research date: 24 Oct 2026. Author: tournament-director research pass.
Machine-readable catalog: `games.json` in this folder (same 15 games, same slugs).

Legend: **[V]** = verified against a 2025-26 source cited below. **[U]** = unverified / from general knowledge. Check it in-game before launch.

---

## 0. Legal and platform context (India, 2026)

- **Online gaming law.** The Promotion and Regulation of Online Gaming Act, 2025 bans "online money games", meaning games where players pay fees or stakes expecting monetary winnings. Its Rules (2026) were notified 22 Apr 2026 and took effect 1 May 2026 **[V]** (Drishti IAS, Vikaspedia, BusinessToday). Esports events *may* charge a registration fee and pay performance-based prizes, but no betting or staking is allowed **[V]** (MediaNama, Lloyd Law College summary).
  **Platform decision: entry is always free. No wagering, no paid "entry for prize pool", and no fantasy or prediction games.** That keeps us clearly outside "online money game". Ludo King is allowed only as a free social game, never with stakes.
- **BGMI** is live and legal in India, and Krafton runs BGIS 2026 (₹4 cr pool, grand finals in Chennai, Mar 2026) **[V]**.
- **Free Fire vs Free Fire MAX.** The original *Free Fire* has been blocked since Feb 2022. **"Free Fire India" has still not launched as of Oct 2026**: it was delayed from 5 Sep 2023, and a Sep 2026 teaser carried no date **[V]**. **Free Fire MAX is the version actually played in India**, and Garena runs the FFMIC 2026 Spring and Fall events on it **[V]**. Register it as *Free Fire MAX*.
- **COD Mobile** is available, and its official India circuit runs **5v5 Multiplayer** (Hardpoint / S&D / Control). The CODM World Championship 2026 India qualifiers are Bo5 single elimination into double elimination **[V]** (Liquipedia, callofduty.com).
- **Pokémon UNITE** has an active Indian scene: WCS 2026 India Qualifier and PUACL 2026 India **[V]**.
- **Valorant** needs Riot Vanguard. On Windows 11 that means **TPM 2.0 + Secure Boot**, and the requirement is enforced in 2026 **[V]**. Some student laptops will fail it, so say so on the game page.
- Excluded on purpose: **Fortnite** (heavy, and Android needs a sideloaded Epic store), **Tekken 8** (paid, and PC/console only), **Among Us** (paid on PC, hard to verify), **Clash of Clans** (war results take days and are hard to run as a bracket), and **Minecraft** (paid, and no standard competitive format). Any of them can be a one-off "fun event" later.

---

## 1. Game catalog (15)

| # | slug | Game | Platform | Mode / size | Format | Match length | In-game ID | Verify via |
|---|------|------|----------|-------------|--------|--------------|-----------|------------|
| 1 | `bgmi` | Battlegrounds Mobile India | Android, iOS | squad 4 (+1 sub) | Custom-room BR, 3-4 maps, placement + kills | ~25-30 min/map | Character ID (numeric) | End-of-match result screen + lobby screenshot |
| 2 | `ff-max` | Free Fire MAX | Android, iOS | squad 4 (+1 sub) | Custom-room BR, 3-6 matches, 12 squads/lobby | ~15-20 min | UID (numeric) | Result screen screenshot |
| 3 | `codm` | Call of Duty: Mobile | Android, iOS | team 5v5 (+1 sub) | MP private match, Bo3 (HP / S&D / Control), Bo5 final | ~10-15 min/map | UID (numeric, long) | Scoreboard screenshot |
| 4 | `clash-royale` | Clash Royale | Android, iOS | solo 1v1 | In-game Private Tournament (qualifier) → Bo3 friendly-battle bracket | ~3-5 min | Player tag `#XXXX` | Battle log (public API) |
| 5 | `brawl-stars` | Brawl Stars | Android, iOS | team 3v3 (+1 sub) | Friendly Game room, Bo3 across modes (Gem Grab / Brawl Ball / Knockout...) | ~2-3 min/game | Player tag `#XXXX` | Battle log (public API) + screenshot |
| 6 | `pokemon-unite` | Pokémon UNITE | Android, iOS, Switch | team 5v5 (+1 sub) | Custom battle, Bo3, Bo5 final | ~10 min | Trainer ID (7 alnum) | Result screenshot |
| 7 | `efootball` | eFootball | Android, iOS, PC, console (crossplay) | solo 1v1 | Friend Match, group stage → knockout, 2 legs | ~12-15 min | eFootball User ID | Final-score screenshot |
| 8 | `real-cricket` | Real Cricket 24 | Android, iOS | solo 1v1 | "Play with Friends" 2-over or 5-over match, knockout | ~10-20 min | In-game name | Scorecard screenshot |
| 9 | `asphalt-legends` | Asphalt Legends Unite | Android, iOS, PC, console | solo, 8 per race | Private room, 3-5 races per heat, F1-style points | ~2-3 min/race | Gameloft in-game name | Race result screenshot |
| 10 | `stumble-guys` | Stumble Guys | Android, iOS, PC | solo, up to 32 | Custom party, 3-5 games per heat, round points | ~5-8 min | Username | Final-round screenshot |
| 11 | `ludo-king` | Ludo King | Android, iOS, web | solo, 4 per table | Private room tables, knockout (winner advances) | ~15-25 min | In-game name | Win screen screenshot |
| 12 | `valorant` | VALORANT | PC (Windows) | team 5v5 (+1 sub) | Custom game, tournament mode, Bo1 → Bo3 semis/final | ~35-50 min/map | Riot ID `Name#TAG` | Tracker match history + scoreboard |
| 13 | `cs2` | Counter-Strike 2 | PC (Steam) | team 5v5 (+1 sub) | Private lobby / FACEIT-style, MR12 Bo1 → Bo3 | ~40-50 min/map | SteamID64 | Scoreboard + demo |
| 14 | `chess` | Chess (lichess.org) | Web, Android, iOS | solo | Lichess team Swiss (7 rd, 5+3) or Arena | ~10-16 min/game | lichess username | **lichess API** (automatic) |
| 15 | `skribbl` | skribbl.io | Web (phone browser OK) | solo, up to ~12-20/room | Private room heats, 3-5 rounds, top-N advance | ~15-20 min/room | Display name | Final scoreboard screenshot |

Mix: 10 phone-first, 2 PC-only, 3 cross/web. Casual titles (Ludo, Stumble Guys, skribbl, Asphalt) keep low-spec and non-gamer students in the house points race.

### ID formats and validation (client-side, lenient)

| Game | Field label | Regex (JS) | Notes |
|------|-------------|-----------|-------|
| BGMI | Character ID | `^\d{9,12}$` | Public examples are 9-10 digits **[V]** (Sportskeeda). No official length, so allow 9-12 **[U]**. |
| Free Fire MAX | UID | `^\d{8,12}$` | Usually 9-10 digits **[V]** (multiple guides). Allow 8-12. |
| COD Mobile | UID | `^\d{10,20}$` | Activision support says it's "about 20 digits"; guides say 10-19 **[V]**. |
| Clash Royale / Brawl Stars | Player Tag | `^#?[0289PYLQGRJCUV]{3,12}$` | The charset is the documented Supercell tag set (RoyaleAPI docs) **[V]**. Length 3-12 **[U]**. Uppercase it, map `O`→`0`, prefix `#` on save. |
| Pokémon UNITE | Trainer ID | `^[A-Za-z0-9]{7}$` | "7-character mix of letters and numbers" **[V]** (Dexerto/AFK guides). Uppercase it. |
| eFootball | User ID | `^[A-Za-z]{4}-?\d{3}-?\d{3}-?\d{3}$` | Format `ABCD-123-456-789` is from memory **[U]**. Ask for a profile screenshot too. |
| Real Cricket 24 | In-game name | `^.{2,24}$` | No public ID format **[U]**. |
| Asphalt Legends Unite | In-game name | `^.{2,24}$` | **[U]** |
| Stumble Guys | Username | `^.{2,24}$` | **[U]** |
| Ludo King | In-game name | `^.{2,24}$` | **[U]** |
| VALORANT | Riot ID | `^[^#]{3,16}#[A-Za-z0-9]{3,5}$` | Name 3-16, tagline 3-5 alphanumeric **[V]** (Riot support FAQ). The name can contain spaces or unicode, so don't restrict it to ASCII. |
| CS2 | SteamID64 | `^7656119\d{10}$` | 17-digit SteamID64 **[U, well-known]**. Also accept a profile URL and resolve it server-side later. |
| Chess | lichess username | `^[A-Za-z0-9][A-Za-z0-9_-]{0,28}[A-Za-z0-9]$` | lila source: historic names are `[a-zA-Z0-9_-]{2,30}` **[V]** (lila `userId.scala`). New signups are 2-20 chars **[U]**. Verify existence with `GET https://lichess.org/api/user/{name}`. |
| skribbl.io | Display name | `^.{2,20}$` | Free text. Bind it to the platform name. |

Extra registration fields (all games): platform display name, house and region come from the user profile, so don't re-ask them. Per game, where useful:
- BGMI / FF MAX / CODM: `ign` (in-game name, shown in kill feeds), plus the device model (optional, for the device rule).
- Squad games: `teamName` (3-24 chars), `captain` (the registrant), member platform usernames, and an optional `sub`.
- Clash Royale: `trophies` (for seeding). Chess: optional `chesscom` username for backup.
- Valorant / CS2: `rank` (seeding only, self-reported).

---

## 2. Per-game tournament rules

### Common to every game (applies unless a game section overrides it)
- **Check-in** opens 30 min before the slot and closes 10 min before it. Anyone not checked in drops out and the next waitlisted entry is promoted.
- **Lobby join.** Room ID and password go to checked-in captains on the platform (or the WhatsApp group) 10-15 min before start. **The match starts on time. A no-show more than 10 min late is a forfeit** (BR: the match is played without you, scoring 0).
- **Result proof.** The **captain** (or the winner, in 1v1) uploads the result screenshot **within 15 min** of the match ending. The opponent can confirm or dispute within 15 min. Silence counts as acceptance. An admin then enters or finalises the result.
- **Screenshots** must be uncropped and show the in-game names and the result. Keep a screen recording of every match. It is required on request in a dispute or cheating claim.
- **Disconnects.** In 1v1 and team modes, one restart is allowed if the disconnect happens in the first 60 s (or before the first kill / goal). After that the match stands. In BR there are no restarts: you can rejoin if the game allows it.
- **No emulators** on mobile titles unless the event page says "emulator open". **No iPads or tablets** in phone-only BR events unless stated; this follows common Indian college practice **[U]**.
- **Anti-cheat.** Hacks, mods, macros, VPN region-hopping, account sharing, playing on someone else's account, teaming in BR, or ghosting a stream all mean an **immediate DQ plus a platform ban** (see §3.8).
- **Subs** may only be swapped in between matches or maps, never mid-match. Every sub must be a registered platform user who is not on another team in the same event.
- **Streaming.** Players may stream with a **≥3 min delay**. Organisers have first right to stream the final.

### 2.1 BGMI (`bgmi`)
- **Format:** custom room (needs a Room Card: Elite RP level 46 or Clan Shop 300 clan pts, per the BGMI help centre **[V]**). Up to 16 squads × 4 per lobby (64 players). With more than 16 squads, run group lobbies, then semis, then a final.
- **Maps per day:** 3-4 (Erangel, Miramar, Sanhok, Erangel), TPP, squad.
- **Points (BGIS standard since 2024) [V]** (esports.net, esportsverse):

  | Place | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9-16 |
  |---|---|---|---|---|---|---|---|---|---|
  | Pts | 10 | 6 | 5 | 4 | 3 | 2 | 1 | 1 | 0 |

  **+1 per finish (kill).** Total = placement + finishes over all maps.
- **Tiebreakers** (common PMCO/BGIS convention **[U]**): (1) total WWCDs (chicken dinners), (2) total placement points, (3) total finishes, (4) best placement in the last match.
- **Verification:** the captain uploads the end-of-match "Results" screen showing the rank and squad finishes. The organiser/spectator account in the room also screenshots the final standings, and the room host's record overrides captains' uploads.
- **Device:** phone only. Emulator (GameLoop etc.) and iPad are not allowed unless the event says so. Max 4 fingers / claw allowed, but no triggers that need an app, macros, or GFX tools that modify game files.
- **Fair play:** teaming with other squads is a DQ for both. Hackers in the lobby get a whole-squad DQ and a ban. Squads carry up to 4 players plus 1 sub, and the sub may swap in between maps.

### 2.2 Free Fire MAX (`ff-max`)
- **Format:** custom room, 12 squads × 4 per lobby (Bermuda / Purgatory / Kalahari rotation), 3-6 matches.
- **Points (FFMIC 2026 table) [V]** (esportsverse.live FFMIC Fall 2026):

  | Place | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11-12 |
  |---|---|---|---|---|---|---|---|---|---|---|---|
  | Pts | 12 | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0 |

  **+1 per elimination.** Optional finale: "Champion Rush". Once a squad passes a threshold, its next Booyah wins the title. FFMIC used ≥110 pts across a 12-match final **[V]**. Only use it for the final, with the threshold announced in advance.
- **Tiebreakers:** Booyahs, then total placement pts, then eliminations, then last-match rank.
- **Device:** phone only, no emulators, same rules as BGMI. Squads are 4 + 1 sub.

### 2.3 COD Mobile (`codm`)
- **Format:** 5v5 Multiplayer private match, ranked rules. Bo3: map 1 Hardpoint, map 2 S&D, map 3 Control (matching the 2026 official India qualifier mode pool **[V]**, Liquipedia). Single elimination, with a Bo5 grand final. For more than 32 teams, use a BR qualifier day (BGMI-style points).
- **Score recorded:** map wins per series, plus per-player kills and deaths from the scoreboard for the individual leaderboard.
- **Tiebreakers in groups:** map differential, then round differential, then head-to-head.
- **Device:** phone and tablet allowed, no emulator (CODM puts emulators in their own pool anyway). Restricted items list as per the current competitive ruleset; publish it on the event page. Teams are 5 + 1 sub.

### 2.4 Clash Royale (`clash-royale`)
- **Qualifier:** in-game **Private Tournament** (creator needs Arena 3 and pays 10 gems; mode, duration, level cap and max players are configurable **[V]**, Clash Royale support). Use a password. The top N by wins advance.
- **Bracket:** Bo3 friendly battles (Tournament Standard levels), single elimination, Bo5 final. Deck-swap is allowed between games.
- **Verification:** the battle log is public. Admins can read it via the official Clash Royale API (`/players/{tag}/battlelog`) **[U, well-known]**, plus a screenshot.
- **Tiebreakers in qualifier:** in-game tournament rank.

### 2.5 Brawl Stars (`brawl-stars`)
- **Format:** Friendly Game room, 3v3. Brawlers are set to max power in friendlies **[V-weak]**. Bo3 across Gem Grab → Brawl Ball → Knockout (or Heist). Map pool published in advance. Single or double elimination.
- **Draft:** blind pick, no duplicates per team. An "Esports draft" option can come later.
- **Verify:** screenshot plus the battle log via the official API.
- **Team:** 3 + 1 sub.

### 2.6 Pokémon UNITE (`pokemon-unite`)
- **Format:** 5v5 custom battle, Theia Sky Ruins, draft mode. Bo3, Bo5 grand final, double elimination. This mirrors the WCS 2026 India Qualifier format **[V]**.
- **Custom lobby availability on mobile:** unconfirmed **[U]**. Test it before announcing.
- **Score:** map wins. Team score for tiebreaks. Team is 5 + 1 sub.

### 2.7 eFootball (`efootball`)
- **Format:** 1v1 Friend Match, Dream Team or "Authentic teams only" (organiser picks one per event; Authentic is fairest). Match time 10 min, Normal condition, no extra time in groups, ET plus penalties in KO.
- **Stage:** groups of 4 (3 pts win, 1 draw), then knockout over two legs (aggregate, then away goals off, then a single-match decider).
- **Tiebreak in groups:** points, goal difference, goals scored, head-to-head.
- **Disconnect:** a DC in the first 5 in-game minutes with the score level means a replay. Otherwise the leading player wins by the current score, or the remaining time is replayed.
- **Crossplay:** mobile vs console/PC is allowed. Organisers may split divisions.

### 2.8 Real Cricket 24 (`real-cricket`)
- **Format:** 1v1 online via "Play with Friends" **[V-weak: feature exists, room mechanics unverified]**. 2 overs per side in groups and 5 overs in the KO. Difficulty: Pro. Same team allowed.
- **Tie:** Super Over if the game has it; otherwise a re-play of a 1-over match.
- **Fallback:** if friend play proves unreliable in testing, swap to World Cricket Championship 3 **[U]**.

### 2.9 Asphalt Legends Unite (`asphalt-legends`)
- **Format:** private room (added Jan 2025 **[V-weak]**), 8 racers per heat, 4 races per heat, tracks announced in advance. Cars are open class or a fixed class (e.g. "Class B max") to keep it fair for low spenders.
- **Points per race (F1-style):** 1st 10, 2nd 8, 3rd 6, 4th 5, 5th 4, 6th 3, 7th 2, 8th 1. Top 2 per heat advance.
- **Tiebreak:** most race wins, then best finish in the last race.

### 2.10 Stumble Guys (`stumble-guys`)
- **Format:** custom party, max 32 **[V]** (Stumble Guys Workshop FAQ). 5 games per heat.
- **Points per game:** winner 10, 2nd 7, 3rd 5, reached the final round 2. Top 25% advance.
- **Teaming or griefing** in custom parties means a DQ.

### 2.11 Ludo King (`ludo-king`)
- **Format:** private room, 4-player tables, Classic mode (or Quick mode for time). The winner of each table advances, and the final table plays a full game.
- **Rules:** no paid boosts. Absolutely **no stakes or side bets** (the 2025 Act).
- **Verify:** the win screen screenshot from the host.

### 2.12 VALORANT (`valorant`)
- **Format:** custom game, Tournament Mode ON, Standard (first to 13, OT win by 2), cheats off. Map veto via ban/pick. Bo1 in groups / Ro16, Bo3 semis and final. Server: Mumbai.
- **Account:** the Riot ID registered must be the one played. No smurf accounts or rank boosting.
- **Hardware:** Vanguard needs TPM 2.0 + Secure Boot on Win 11 **[V]**. Players must check this before registering.
- **Verify:** scoreboard screenshot plus match history (tracker.gg or in-client).
- **Score:** map wins, then round differential. Individual leaderboard: ACS / K / D. Team is 5 + 1 sub.

### 2.13 Counter-Strike 2 (`cs2`)
- **Format:** private lobby or community server, MR12 (first to 13), active-duty map pool, veto. Bo1 → Bo3.
- **Spec warning:** CS2 needs a mid/high GPU. Run it only if 8 or more teams register.
- **Verify:** scoreboard plus the `.dem` demo on request. Teams are 5 + 1 sub.

### 2.14 Chess (`chess`, lichess)
- **Format A, Swiss (preferred):** private **lichess team** "IITM BS Esports" with membership approval. Swiss is created with `POST /api/swiss/new/{teamId}` (Swiss is team-scoped) **[V]** (lichess OpenAPI spec). 7 rounds, **5+3 blitz** (or 10+5 rapid).
- **Format B, Arena:** 60-90 min, 3+2, created with `POST /api/tournament`, with entry restricted to team members.
- **Results:** **automatic**. Use `GET /api/swiss/{id}/results` or `GET /api/tournament/{id}/results` (NDJSON: rank, username, points, tieBreak, performance) **[V]**. Map each lichess username to a platform user. This is the only game with no manual result entry.
- **Tiebreak:** Swiss uses lichess's Sonneborn-Berger, then performance. Arena uses lichess's own rank.
- **Fair play:** a lichess fair-play (TOS) mark on any account means a DQ and a platform ban. Engines and assistance are banned, and so is opening a second device.

### 2.15 skribbl.io (`skribbl`)
- **Format:** private rooms of up to 12 (guides say 12 or 20 **[U]**), 3-5 rounds, draw time 80 s **[V-weak]**, language English. Custom word list optional (IITM / course words make it fun).
- **Advance:** top 3 per room → final room.
- **Rules:** no saying the answer in chat, no writing letters in the drawing, and no alt tabs to the same room.

---

## 3. Platform-wide rulebook

### 3.1 Eligibility
1. Open only to **currently active IIT Madras BS degree students**. Sign-in uses a verified **`@ds.study.iitm.ac.in` / `@es.study.iitm.ac.in`** Google account (adjust the domains to whatever the program uses).
2. **One platform account per person.** Duplicate accounts mean both are banned.
3. The house and region come from the student's official house allocation, are set once, and are editable only by admins.
4. **One registration per game per event per person.** You cannot appear on two teams in the same event, even as a sub.
5. In-game IDs are tied to the person. An in-game ID can be registered by only one platform user per game, and the platform enforces uniqueness.

### 3.2 Teams
- Every member, sub included, must be a registered platform user who has accepted the invite. The **captain** creates the team and is responsible for check-in, lobby join, result upload and disputes.
- **Roster lock** comes when registration closes. After that, only the 1 sub slot can be filled, and only until check-in closes.
- Max **1 substitute** per team. A sub who plays even one match counts as a team member for points.
- Team names must be clean. Admins can rename offensive names.

### 3.3 House rule (proposal)
**Mixed-house teams are allowed. House points split pro-rata by roster.** The team's house points for a placement are divided equally among the members who actually played (subs who played included), and each share goes to that member's house.
- Example: a BGMI squad of 3 Gir + 1 Corbett wins 10 house points, so Gir gets 7.5 and Corbett gets 2.5.
- This keeps registration friction-free (friends across houses can play) and stays fair (no house gets credit it didn't earn). There's no "majority house" gaming either.
- **Per-house cap:** for each event, only a house's **best 3 entries** (teams or players) count toward house standings. That stops big-roster houses winning on volume alone. Individual leaderboards are unaffected.
- Optional "House Cup" events (organiser flag `sameHouseOnly: true`) require all members from one house. In those events the house takes the full points.

### 3.4 Code of conduct
No slurs, harassment, sexism, casteism or regional abuse in game chat, voice, WhatsApp or streams. Respect volunteers. No spamming organisers. No sharing other students' contacts. Follow the IITM BS student code of conduct, which takes precedence.

### 3.5 Disputes
1. File in-platform within **15 min of the match result** (or within 30 min of the event ending for scoring errors), with evidence (screenshot or recording).
2. The opponent responds within **15 min**.
3. The **match admin** rules within 60 min during a live event, or within 24 h otherwise.
4. Appeal within **24 h** to the **head organiser panel** (2 admins not involved in the match). Their decision is final.
5. The **admin who entered the result can't hear the appeal.** Every edit is logged.

### 3.6 Penalties ladder
| Level | Examples | Penalty |
|---|---|---|
| Minor | late check-in, wrong screenshot | Warning |
| Moderate | late to lobby (<10 min), repeated warnings, toxic chat | −placement points (BR: −5) or loss of a map/game |
| Major | no-show, sub violation, playing on another account | Forfeit match / DQ from event, house points void |
| Severe | cheating, hacking, teaming, impersonation, match-fixing, betting | DQ + **platform ban** (season or permanent), house points from that event revoked, report to student affairs |

Two no-shows in a season mean a 30-day registration ban.

### 3.7 Streaming
Allowed for every player, with a ≥3 min delay and no lobby passwords on screen. The official stream has priority for finals. Players may not use the stream to share info with others in the same lobby (stream sniping by opponents is a DQ).

### 3.8 Privacy
- The WhatsApp number and email are **visible only to organisers/admins** of events the user registered for, and to their own team captain (WhatsApp only, for coordination). They are never shown publicly or in exports.
- Public data: display name, house, region, in-game name, and results.
- In-game IDs are public only on brackets for that game, since opponents need them to add friends.
- Data is used only for running tournaments. Users can request deletion, and results stay anonymised.

### 3.9 Prizes and money
Free entry always. Prizes, if any, are sponsored and performance-based. No betting, staking or paid predictions, in line with the 2025 Act.

---

## 4. Points systems

### 4.1 House points per event (placement → house points)
Scale by event size so a 6-entry Ludo event doesn't count like a 120-squad BGMI event:

| Final placement | Base points |
|---|---|
| 1st | 10 |
| 2nd | 7 |
| 3rd | 5 |
| 4th | 4 |
| 5th-8th | 2 |
| 9th-16th | 1 |
| Played at least one match (participation) | 0.25 |

- **Size multiplier:** `m = 1.0` for ≥16 entries, `0.75` for 8-15, `0.5` for <8.
- **Tier multiplier (optional):** flagship (BGMI, FF MAX, Valorant, Chess) ×1.5, standard ×1.0, casual ×0.75. Publish the tiers at the start of the season.
- House points = `base × m × tier`, split pro-rata per §3.3, with only each house's best 3 entries per event counting. The participation 0.25 is per person, capped at 5 per house per event, so it rewards turnout without letting it dominate.
- **House standings:** sum over the season, with ties broken by most 1st places, then most 2nd places.

### 4.2 Generic individual leaderboard (one schema for every game)
Every game reports **placement** (always) and **stats** (game-specific, optional). The leaderboard score per player per game is:

`leaderboardPoints = Σ over events of placementPoints(event)` using the same placement table as §4.1 (1st 10 ... participation 0.25), times the size multiplier only (no tier). Team results credit **every member who played** with the team's full placement points.

Secondary columns are shown per game from `stats`, and none of them goes into the cross-game score:
- BR: `kills`, `wwcd`, `avgPlacement`
- Team shooters / MOBA: `mapWins`, `kills`, `deaths`, `kd`
- 1v1 (CR, eFootball, cricket, Ludo): `wins`, `losses`, `goalDiff` / `runDiff`
- Chess: `rating` (lichess Swiss perf), `score`
- Casual: `wins`, `points`

The default sort is `leaderboardPoints`, then `firsts`, then the game's main stat (`gameConfig.primaryStat`).

### 4.3 Results data model (both per-match rows and aggregate)
Store **per-match rows** as the source of truth. **Aggregate** them to standings, which can be recomputed at any time.

```
Event(id, gameSlug, title, state, format, startsAt, regOpensAt, regClosesAt,
      teamSize, maxEntries, sameHouseOnly, tier, pointsTableId, lichessId?)

Entry(id, eventId, kind: solo|team, teamName?, captainUserId, status: registered|checked_in|withdrawn|dq,
      seed?, members: [{userId, role: captain|player|sub, igId, house, played:boolean}])

Match(id, eventId, stage: "group A"|"QF"|"final", round, mapOrMode?, scheduledAt,
      status: scheduled|live|awaiting_result|disputed|final, roomId?, roomPass? (admin-only))

MatchResult(id, matchId, entryId, placement?, score?, win?, stats: {kills, deaths, goals, ...} (JSON),
            points (computed from pointsTable), evidenceUrls[], submittedBy, verifiedBy, verifiedAt)

PlayerMatchStat(matchId, userId, entryId, stats JSON)   // optional, for per-player kills etc.

Standing(eventId, entryId, rank, totalPoints, tiebreak: [..] JSON, computedAt)  // materialised
HousePointAward(eventId, house, entryId, userId?, points, reason: placement|participation)  // audit trail
AuditLog(actorId, action, entity, before, after, at)
```

- The points table is data (`PointsTable{id, placement:{1:10,2:6,...}, perKill:1}`), so BGMI, FF MAX and Asphalt each just reference a different table.
- Chess results come in via the lichess API into MatchResult rows (one "match" per tournament, with lichess rank as the placement).

---

## 5. Event lifecycle

| State | Visible to | Allowed | Not allowed |
|---|---|---|---|
| **Draft** | Admins | Edit everything (game, format, dates, points table, caps) | Registration, public listing |
| **Upcoming** | Everyone | View rules and schedule, "notify me". Admin edits allowed except the game | Registration |
| **Registration Open** | Everyone | Register / withdraw, build teams, invite members, edit in-game IDs. Admin can extend the close date | Changing format/points (only the date window can change) |
| **Registration Closed** | Everyone | Roster locked except the 1 sub slot. Seeding, bracket generation, check-in (opens 30 min before), room details sent | New entries (admins can add from the waitlist) |
| **Live** | Everyone (bracket live) | Result upload, confirm/dispute, admin result entry, DQs, sub swaps between matches | Roster changes besides sub swaps, rule changes |
| **Completed** | Everyone | Standings final and house points awarded. Appeals for 24 h. Admin corrections are audit-logged and recompute standings | New results without an audit reason |
| **Cancelled** | Everyone (with reason) | Registrants notified, entries kept for history | Any points awarded (partial events award nothing unless admins mark "completed early") |

Transitions: Draft→Upcoming (publish) → Reg Open (auto at `regOpensAt`) → Reg Closed (auto at `regClosesAt` or when full) → Live (admin or `startsAt`) → Completed (admin finalises). Any state before Completed can go → Cancelled.

---

## Sources
- BGIS points table: https://www.esports.net/news/mobile-games/bgmi-esports-points-table-system ; https://www.esportsverse.in/tournaments/bgmi/battlegrounds-mobile-india-series-2025
- BGIS 2026: https://respawn.outlookindia.com/esports/esports-news/kraftons-bgis-2026-the-grind-stage-begins ; https://community.iqoo.com/in/thread/130756
- BGMI custom room: https://help.battlegroundsmobileindia.com/hc/en/6-bgmi/faq/490-how-do-i-create-a-custom-room/
- BGMI ID examples: https://www.sportskeeda.com/bgmi/mew2-s-bgmi-id-stats-f-d-ratio-win-ratio-youtube-income
- Free Fire India status: https://respawn.outlookindia.com/gaming/gaming-news/free-fire-india-reports-ffmic-and-indias-ffws-2026-run ; https://www.talkesport.com/news/free-fire-india-launch-date-2026-why-ff-india-release-is-not-expected-anytime-soon-this-year/
- FFMIC 2026 points: https://www.esportsverse.live/tournaments/free-fire/free-fire-max-india-cup-fall-2026 ; https://www.sportsdunia.com/esports/free-fire-ffmic-2026-fall-grand-finals-day-2-points-table
- CODM 2026: https://liquipedia.net/callofduty/CODM_Fall_Split/2026/Qualifier_2/India ; https://www.callofduty.com/fr/mobile/esports ; UID: https://support.activision.com/cod-mobile/articles/call-of-duty-mobile-promotions
- Online Gaming Act and Rules: https://en.wikipedia.org/wiki/Promotion_and_Regulation_of_Online_Gaming_Act,_2025 ; https://www.drishtiias.com/daily-updates/daily-news-analysis/promotion-and-regulation-of-online-gaming-rules-2026/print_manually ; https://www.medianama.com/2025/10/223-e-sports-events-online-gaming-law/ ; https://www.lloydlawcollege.edu.in/blog/online-gaming-act-2025-esports-platform-rules.html
- Riot ID: https://support.riotgames.com/en-us/riot/account/riot-id-faq ; Vanguard TPM: https://afkgaming.com/esports/guide/how-to-fix-this-version-of-vanguard-requires-tpm-20-in-valorant
- Supercell tag charset: https://docs.royaleapi.com/faq ; Clash Royale private tournaments: https://support.clashroyale.com/hc/en-us/articles/49484921349019-Private-Tournaments
- Brawl Stars friendlies: https://guildorder.com/games/brawl_stars/wiki/friendly-games-and-club-practice (low confidence)
- Pokémon UNITE India: https://www.tribuneindia.com/news/sports/s8ul-to-represent-india-at-pokemon-unite-world-championships-2026-after-winning-national-qualifier/ ; Trainer ID: https://www.dexerto.com/pokemon/how-to-add-friends-on-pokemon-unite-1616564
- eFootball (FIFAe 2026 uses User ID): https://www.fifa.gg/news/claim-your-fifae-world-cup-2026-challenger-series-profile-fifa-gg
- Real Cricket 24 friends: https://gamesfuze.com/how-to/real-cricket-24-how-to-add-and-invite-friends/
- Asphalt Legends Unite private rooms: https://blabbermouth.net/news/avenged-sevenfold-teams-up-with-racing-game-asphalt-legends-unite
- Stumble Guys 32-player custom party: https://stumbleguys.com/news/workshopFAQ
- skribbl.io settings: https://mechanicsofmagic.com/?p=17118 (low confidence)
- lichess username regex: https://github.com/lichess-org/lila/blob/master/modules/core/src/main/userId.scala ; lichess API spec: https://github.com/lichess-org/api/blob/master/doc/specs/lichess-api.yaml
- chess.com usernames: https://support.chess.com/en/articles/8609530-what-kind-of-username-can-i-choose
