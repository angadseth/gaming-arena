# Design direction: IITM BS inter-house esports platform

Researched 2026-10-24. Opinionated on purpose. Section 3 is the build spec; the rest explains the choices.

---

## 1. References: what to copy, with the pattern named

Most of these sites are JS apps, so WebFetch returned partial content (HLTV and Liquipedia returned 403). The notes below combine what came back with how these products are known to work.

| # | Product | What it does well | Pattern we take |
|---|---|---|---|
| 1 | **start.gg** (tournament page) | Banner image plus avatar header. The tabs are always the same (Overview, Events, Brackets, Attendees). The **Register** button stays pinned top-right on every tab, with "Registration closes in 2d 4h" beside it. Each event row reads: game box art thumbnail, event name, format, entrant count. | The register button and the closing time are always visible. Every event row carries the same four facts: **game, format, size, entrants**. |
| 2 | **FACEIT** | Near-black UI with one hot brand colour (orange, about #FF5500) used almost only for the primary "Play" action. Stats sit in dense, quiet tiles. The profile hero is the player's level badge, not decoration. | **Proof that "one accent, one job" works in esports.** We use the same discipline but a different hue (marigold, not orange) so we don't read as a FACEIT clone. |
| 3 | **valorantesports.com / lolesports.com** (Riot) | The home hero is the **next match** with a live countdown ("TODAY @ 18:00"). Metadata uses a slash grammar ("Knockouts // Bo3"). Standings are a plain numbered list: logo, name, points ("LOUD 1548 pts"). Key art appears only in feature tiles, as 16:9 images. | The hero is the next actionable thing (your next match, or the event closing soonest). Metadata uses `//` separators. Standings stay unboxed and numeric. |
| 4 | **HLTV** (rankings) | Extremely dense rows: big rank numeral, team, points in brackets, movement (+2 / -1) in small coloured figures, and a lineup that expands on tap. No cards and no art. Fast. | Leaderboards are **rows, not cards**. Rank movement shows as a small figure. Numbers use tabular figures. Density reads as authority. |
| 5 | **Liquipedia** | Group tables tint whole rows by outcome (pale green = advanced, pale red = eliminated), with a legend under the table. The bracket is a strict grid with tabular scores. Built for scanning large amounts of data. | **Row-tint state plus a legend** for qualified and eliminated rows. We never use colour as the only signal: an icon or label always goes with it. |
| 6 | **Battlefy** | Tournament cards give game art, title, date and time **with timezone**, team size badge ("5v5"), status and a Join CTA. Check-in is a separate, visible step. | A team-size badge on every card (`SOLO` / `DUO` / `SQUAD 4`). Times show as IST explicitly. |
| 7 | **Esports World Cup** | Uppercase section heads with a hairline rule under them. The **Club Championship** is a cross-game points table: each club earns points per game title (1000 / 750 / 500), which roll up into an overall ranking. | **This is our house standings model.** Each house earns placement points per game, and the house page shows the per-game breakdown. Section heads get uppercase type over a hairline rule. |
| 8 | **BGMI pro points tables** (BGMS / BGIS) | The Indian battle-royale convention every BGMI player already reads: `# · Team · M · WWCD · Place pts · Finish pts · Total`. | Battle-royale leaderboards use exactly these columns. Don't invent new ones; players will look for WWCD. |
| 9 | **Challengermode / Strafe** | Mobile-first ladders. Strafe's match card is `Team A  2 : 1  Team B` with a LIVE tag, and the score is the largest element on the card. | Match cards are score-first. The live tag is a small red dot plus a label, never a big banner. |

**What every good reference shares, and what we keep:** a dark neutral base, colour held back for state, tabular numerals, uppercase condensed labels, key art only where a game is being sold (cards and heroes), and plain rows wherever data is shown. None of them use gradients-as-design, glass panels or glowing blobs.

---

## 2. Three art directions

### A. "RANGER": field guide meets broadcast scoreboard  **(RECOMMENDED)**
**Concept.** The houses are Indian national parks, so the platform reads like a forest department's field kit run by a sports broadcaster. The base is a night-safari near-black with a faint green cast. Topographic contour lines appear as a quiet texture, on hero headers and house pages only. Status and house chips are cut like **ranger ID tags**: rectangles with a notched corner, mono caps and a 3-letter code (GIR, KAZ, SUN). The one accent is **marigold**, the yellow of Indian forest-department signboards on dark green, and it marks only the primary action and the selected state. Numbers are set like a scoreboard: tabular, mono, right-aligned.
- **Palette:** bg `#0B0F0D` · surface `#121815` / `#18201C` / `#202924` · border `#27312C` · text `#ECEFE7` / `#A7B1AA` / `#848F88` · **accent marigold `#F4B740`** (text on it `#1A1204`) · success `#3FB97A` · danger `#EF5350`
- **Fonts (Google):** **Archivo** (variable, `wdth` 62–125, `wght` 100–900): condensed caps at wdth 72 for display, wdth 100 for UI and body, so one family covers both. **IBM Plex Mono** (500/600) for ranks, scores, codes and tags.
- **Motif:** a single static contour-line SVG (about 3 KB, 1px strokes, 6–8% opacity), notched-corner tags, hairline rules under uppercase section heads, and a 3-letter house code system.
- **Key art:** shown in full colour, never tinted. Game cards are 4:5 crops with a bottom scrim to `#0B0F0D` and the title on the scrim. The event hero is full-bleed 16:9 with the same scrim. Key art appears only on game and event surfaces, never behind tables.
- **Why it fits:** it is rooted in India and in this house system specifically, so no other esports site can look like it. It stays premium because the motif is held back (texture plus tag shape only, with no animal illustrations or jungle clip-art). It is also fast: no blur, and everything is solid surfaces.

### B. "LOWER THIRD": pure broadcast graphics
**Concept.** Everything looks like a TV broadcast package: hard black, white type, angled lower-third bars, a scoreboard strip across the top of event pages, and a ticker of live results. Riot and EWC energy.
- **Palette:** bg `#08080A` · surface `#111114` / `#1A1A1F` · border `#2A2A31` · text `#FFFFFF` / `#B4B4BE` / `#70707A` · **accent signal red `#FF3B30`** · success `#30D158`
- **Fonts:** **Barlow Condensed** (600/700) for display, **Barlow** (400/500) for UI, **Roboto Mono** for numbers.
- **Motif:** 12° parallelogram bars (clip-path), scoreboard strips and a scrolling ticker.
- **Key art:** large and dramatic, with a hard diagonal mask and white condensed titles knocked out over it.
- **Why not:** it looks good, but it is generic. It would fit any tournament anywhere and says nothing about IITM or the houses. Red as the accent also collides with LIVE and danger states. The ticker and diagonals get tiresome in a tool people use every day.

### C. "MATCHDAY PAPER": editorial sports supplement
**Concept.** A light theme set like a weekend sports newspaper: off-white newsprint, ink-black serif headlines, ruled columns, and leaderboards set like printed league tables. Unusual for esports, and that is the point.
- **Palette:** bg `#F4F1EA` · surface `#FFFFFF` / `#ECE8DF` · border `#D8D2C6` · text `#16140F` / `#4E4A42` / `#8A857A` · **accent ink-red `#C8331E`** · success `#2E7D4F`
- **Fonts:** **Fraunces** (opsz, 600) for headlines, **Public Sans** for UI, **IBM Plex Mono** for figures.
- **Motif:** column rules, drop-cap numerals for rank 1–3, halftone dots on key art.
- **Key art:** halftone duotone cut-outs, as in a printed paper.
- **Why not:** it would be distinctive, but it fights the game key art (bright art on cream looks pasted on). Most players expect dark at night on their phones, and it reads more like a magazine than a product.

### Recommendation: **A, RANGER**
It is the only option that is ownable: no other esports brand can claim Indian national parks. It follows the reference patterns (FACEIT's single accent, HLTV and BGMI's dense rows, EWC's cross-title points) instead of inventing new ones, and it has the cheapest render cost on a mid-range Android: solid fills, one static SVG texture, two font families, no blur. B's scoreboard number treatment is already folded into A.

---

## 3. RANGER design-token spec

### 3.1 CSS variables
```css
:root {
  /* surfaces: elevation = lighter surface, not shadow */
  --bg:            #0B0F0D;
  --surface-1:     #121815;   /* cards, rows */
  --surface-2:     #18201C;   /* raised: sheets, sticky rows, inputs */
  --surface-3:     #202924;   /* hover, pressed, toasts */
  --border:        #27312C;   /* hairlines */
  --border-strong: #36433C;   /* inputs, outlined pills */
  --scrim:         linear-gradient(180deg, rgba(11,15,13,0) 35%, rgba(11,15,13,.85) 75%, #0B0F0D 100%);

  /* text */
  --text-1: #ECEFE7;   /* primary, bone */
  --text-2: #A7B1AA;   /* secondary */
  --text-3: #848F88;   /* tertiary, metadata (5.8:1 on bg, 5.4 on surface-1, 5.0 on surface-2; avoid on surface-3) */

  /* THE accent: primary action + selected state ONLY */
  --accent:        #F4B740;
  --accent-hover:  #F7C766;
  --accent-press:  #DCA22E;
  --on-accent:     #1A1204;
  --accent-tint:   rgba(244,183,64,.12);  /* selected row, focus ring fill */

  /* status: never used decoratively */
  --success:      #3FB97A;  --success-tint: rgba(63,185,122,.14);
  --danger:       #EF5350;  --danger-tint:  rgba(239,83,80,.14);   /* also LIVE */
  /* no "warning" yellow: it would collide with the accent; say it in words instead */

  /* radii: deliberately tight (not the shadcn 8px everywhere) */
  --r-tag: 2px;  --r-sm: 4px;  --r-md: 6px;  --r-lg: 10px;  --r-full: 999px;
  --notch: 8px;   /* ranger-tag corner cut */

  /* spacing (4-pt) */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px;
  --s-6: 24px; --s-8: 32px; --s-10: 40px; --s-14: 56px; --s-18: 72px;
  --gutter: 16px;        /* mobile side padding */
  --nav-h: 64px;         /* bottom bar */
  --top-h: 56px;

  /* type */
  --font-sans: "Archivo", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  /* size / line-height  (mobile → ≥1024px) */
  --t-micro:   11px/14px;   /* tag caps, mono, +0.08em */
  --t-caption: 12px/16px;
  --t-small:   13px/18px;
  --t-body:    15px/22px;   /* inputs use 16px */
  --t-lead:    17px/24px;
  --t-h3:      20px/24px;   /* wdth 100, 650 */
  --t-h2:      24px/28px;   /* wdth 72 caps, 750 */
  --t-h1:      32px/34px;   /* → 44px/46px desktop */
  --t-display: 44px/44px;   /* → 64px/62px desktop, wdth 68 caps 800 */

  /* shadows: overlays only */
  --shadow-overlay: 0 16px 40px rgba(0,0,0,.55), 0 0 0 1px var(--border);
  --focus-ring: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);

  /* motion */
  --ease-out: cubic-bezier(.2,.8,.2,1);
  --ease-in:  cubic-bezier(.4,0,1,1);
  --d-fast: 120ms; --d-base: 200ms; --d-slow: 320ms;
}
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.caps { font-stretch: 72%; text-transform: uppercase; letter-spacing: .02em; font-weight: 750; }
.tag  { font: 600 11px/14px var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }
```
Fonts: `https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@500;600&display=swap`. Preconnect, latin subset, and preload the Archivo woff2. Only two families.

### 3.2 Rules
- **Accent audit:** marigold may appear only on (1) the single primary button on a screen, (2) the selected tab, segment or row (including the bottom-nav indicator and "my position"), and (3) focus rings. It never goes on headings, icons, borders or charts. If two marigold things are visible that aren't the same job, one of them is wrong.
- **One primary button per view.** Everything else is secondary (surface-2 with a border) or ghost (text only).
- **Shadows:** none on cards. Use only `--shadow-overlay` on sheets, menus and toasts.
- **No `backdrop-filter`.** The top bar and bottom bar are solid `--bg` with a 1px `--border` hairline. Glass is banned outright, which also makes the rule easy to enforce.
- **Texture:** the contour SVG (`/img/contour.svg`, generated once and static) is used at most once per screen, as a `background-image` on the hero or page header only. It never sits behind data.

### 3.3 Motion
- Animate only `transform` and `opacity`. Presses run at 120ms (`scale(.98)`), state changes at 200ms, and sheets and dialogs at 320ms (translateY 100% to 0, `--ease-out`).
- The **only** infinite animation is the LIVE dot: opacity 1 to .35, 1.6s.
- When a leaderboard rank changes, the row background flashes `--surface-3` to transparent over 900ms and the movement figure fades in. Numbers never roll.
- No parallax, no scroll-triggered reveals, no hover-only information. Page transitions are none, or a 150ms fade.
- Under `prefers-reduced-motion: reduce`, all durations drop to 0 and the LIVE dot stays static.

### 3.4 Icons
Use **Lucide** (`lucide-react`) at 20px with stroke 1.75 (16px inline in text), coloured `currentColor`. No emoji anywhere, including toasts and empty states. Game and house identity always uses real logo images, never icons. Mapping: Events `calendar-range`, Leaderboards `list-ordered`, Houses `trees`, Me `user-round`, Admin `shield`, Search `search`, Sort `arrow-up-down`, Live `radio`, Squad `users-round`, Solo `user`, Copy `copy`, Share `share-2`, Done `check`.

### 3.5 Component inventory

**Top bar (mobile, 56px).** Logo mark plus wordmark on the left. Search and notifications icon buttons (44x44 hit area) on the right. Solid `--bg` with a bottom hairline. Scrolls away under event heroes and stays put on lists. At ≥1024px it becomes the full nav: wordmark, then Events / Leaderboards / Houses as text links (the selected one gets text-1 and a 2px marigold underline), then the avatar menu on the right with Admin inside it.

**Bottom bar (mobile only, <1024px).** Four tabs: **Events · Leaderboards · Houses · Me**. Height `64px + env(safe-area-inset-bottom)`. Each tab is an icon plus an 11px label. The selected tab gets text-1 and a 2px marigold bar on its top edge; the rest are text-3. Admin is never in the bar; it lives inside Me.

**Game card.** A 4:5 key-art crop (`object-fit: cover`, AVIF/WebP, `loading=lazy`, explicit width and height) on `--surface-1` with `--r-lg`. Bottom scrim. Over the scrim: the game logo (24px tall), the title in `.caps` 20px, then one meta line in `.tag`: `SQUAD 4 // BR // 3 EVENTS`. A status pill sits top-left. Press state is `scale(.98)`. There is no CTA on the card: the whole card is the target. Two columns at 360–412px with a 12px gap.

**Event status pill (ranger tag).** 22px tall, `.tag` type, 8px horizontal padding, top-right corner notched with `clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)`, plus a 6px leading dot where noted. None of them use the accent.
| State | Fill | Text | Extra |
|---|---|---|---|
| OPEN | `--success-tint` | `--success` | dot, plus "· closes 28 Oct" in text-2 next to the pill |
| LIVE | `--danger-tint` | `--danger` | pulsing dot |
| UPCOMING | transparent, 1px `--border-strong` | `--text-2` | "opens 1 Nov" |
| CLOSED | `--surface-2` + 1px `--border` | `--text-3` | none |
| COMPLETED | `--surface-2` + 1px `--border` | `--text-3` | Lucide `check` 12px |

**Buttons.** 48px tall on mobile (40px desktop), `--r-md`, Archivo 600 15px. Primary: `--accent` with `--on-accent` text and a notched top-right corner (`--notch`); this is the signature shape, and it is the only notched button. Secondary: `--surface-2` with a 1px `--border-strong`. Ghost: text-2 that turns text-1 on hover. Destructive: ghost in danger colour, which turns into a filled danger button only inside a confirm dialog.

**Sign-in (IITM email + OTP).**
- Step 1: one email field (16px, `inputmode=email`, `autocomplete=email`). Validate against `@ds.study.iitm.ac.in` (and `@study.iitm.ac.in` if the program uses it; confirm). The inline error reads "Use your IITM BS student email". Primary button: **Send code**.
- Step 2, the OTP: **6 boxes, each 48x56**. At 360px: 6×48 + 5×8 = 328px, which exactly fits a 360px viewport with 16px gutters. Shrink to 44px boxes below 360. Mono 24px, `--surface-2`, 1px `--border-strong`, `--r-md`. The focused box gets the `--focus-ring`; a filled box gets a text-1 border. Build it as **one real `<input inputmode="numeric" autocomplete="one-time-code" maxlength="6">`** drawn as 6 boxes, so paste, autofill and backspace all work. It auto-submits on the 6th digit. The sub-line reads "Sent to 24f…@ds.study.iitm.ac.in · Change". Resend becomes available after a 30s countdown (mono). An "Open Gmail" secondary button links to `https://mail.google.com` (students switch apps, so keep the state in sessionStorage). Errors: the boxes shake 6px for 200ms, plus the text "That code didn't match. 4 tries left."

**Registration form (solo / squad).** A full page on mobile, not a modal. The header is a compact event strip: a 56px art thumb, the event name and the status pill. Fields are grouped under `.caps` 13px section heads over a hairline rule: *You* (locked: name, email, house as a ranger tag, shown in text-3 with a `lock` icon), then *In-game* (IGN, game UID, and any per-game fields from the game's config). For squads: the captain names the squad, then gets a **6-character invite code** (mono 28px, with `copy` and `share-2` via `navigator.share`, so it goes straight to WhatsApp). Roster slots are shown as `2 / 4 joined`, each slot a row reading "avatar · name · house tag" or "Waiting…". The primary button is sticky at the bottom above the safe area: **Register**, or **Create squad** for squads. Success is a full-screen confirmation, not a popup: a check icon, the event name, "Added to your profile", and buttons for View leaderboard (secondary) and Done (primary).

**Leaderboard (mobile layout).** Rows only, with no horizontal-scroll table on phones.
- A sticky toolbar under the top bar: a search field (40px) and a sort button that opens a bottom sheet with a radio list (Total, WWCD, Kills, Name).
- Rows are 60px on `--surface-1` with 1px dividers (no gaps, no per-row cards). Grid: `[rank 40px mono 600] [avatar 32] [name 15px text-1 + line 2: house tag · IGN in text-3] [stat right-aligned mono 17px text-1, with the secondary stat under it in text-3]`.
- Movement shows next to the rank in mono 11px: `▲2` success, `▼1` danger, `-` text-3. Ranks 1–3 keep the same row style with the rank numeral in text-1 and the rest in text-2. No gold, silver or bronze gradients.
- Columns are per game type. Battle royale: `# · Team · M · WWCD · Place · Finish · Total`. 5v5: `# · Team · W-L · RD · Pts`. Solo: `# · Player · Pts`. On mobile only rank, identity, the primary stat and one secondary stat show; tapping a row expands it in place to the full stat grid.
- At ≥768px it becomes a real `<table>` with a sticky header and `tabular-nums`; the sortable header shows the `arrow-up-down` icon and text-1 when active.
- Search filters live, highlights the match in text-1 (with no colour wash), and the empty result reads "No player named 'xyz' in this event".

**My-position sticky row.** It appears only while your own row is out of view (an IntersectionObserver watches your row). It is pinned `bottom: calc(var(--nav-h) + env(safe-area-inset-bottom))`, on `--surface-2` with a 3px marigold left bar (selected state, so the accent is allowed) and `--shadow-overlay`, using the same grid as a row with the label "YOU" as a tag. Tapping it smooth-scrolls to your real row, which then gets `--accent-tint` for 1.2s. If you aren't registered, it reads "You're not in this event · Register" as a ghost link.

**House standings.** This is the EWC club-championship pattern. A full-width list of 12 rows, 64px each: `[rank mono] [house ranger tag: 3-letter code BAN/COR/GIR/KAN/KAZ/NAL/NAM/NIL/PIC/SAR/SUN/WAY] [house name 17px wdth 100] [points mono right]`. Under the name sits a 4px bar showing points relative to the leader, in `--text-3` on `--surface-3` (data, not accent). Your own house's row gets the 3px marigold left bar. Tapping a house opens the house page: a contour-texture header with the house name in display caps, "Gir National Park, Gujarat" in text-2, then a per-game points breakdown (rows: game logo, game, placement, points) and the house's top players. **House colours:** if the houses have official crests or colours, use the crest image inside the tag. Otherwise keep the tags monochrome. Don't invent 12 extra colours.

**Profile (Me).** Header on `--surface-1`: a 64px avatar, name in 24px, the house tag, the email in text-3, then "Edit" as a secondary button. Stat strip (3 cells, mono numbers in 24px with a `.tag` label underneath): Events · Best rank · House pts contributed. "My events" list: rows with the art thumb, event name, status pill, "Rank 14 / 212" in mono, and a chevron to that event's leaderboard. Squad events show the squad name and the invite code. Admin entry (role-gated) is a row at the bottom: "Admin console". Sign out is a ghost destructive button.

**Admin tables (desktop-first, ≥1024).** Dense 40px rows, a sticky header, mono IDs and timestamps, a row checkbox (checked = marigold, as the selected state), a bulk-action bar that slides up from the bottom when anything is selected, filter chips above the table (Game, Event, House, Status), right-aligned numbers, and Export CSV as a secondary button. Score entry is a per-match form with validation, plus "Paste JSON / CSV" that **previews a diff before commit** (matched / unmatched players highlighted with an icon and label, not colour alone). Every write shows a toast with **Undo** for 8s. On mobile, the admin view collapses rows into stacked definition lists, read-mostly.

**Empty states.** A 120px fragment of the contour SVG at 10% opacity, one line in `.caps` 20px, one line of text-2 and one action. No illustrations, mascots or emoji. Examples: "NO EVENTS YET / Your registered events show up here. / Browse events" · "QUIET ON THIS TRAIL / Nobody's scored yet. Results land after match 1." · "NO MATCH FOR 'xyz' / Check the spelling or search by IGN."

**Toasts.** On mobile, bottom-centre, 8px above the bottom bar (or the my-position row); on desktop, bottom-right. `--surface-3` with a 1px `--border`, `--shadow-overlay`, a 3px status bar on the left (success, danger or text-3), a 20px Lucide icon, one line of text and an optional action ("Undo", "Copy"). They stay 4s (8s with an action), have swipe to dismiss, and sit in an `aria-live="polite"` region. Maximum one visible.

**Skeletons.** `--surface-1` blocks at the real dimensions, with no shimmer: a static block, or opacity .6 to 1 at 1.2s. Shimmer gradients cost paint on low-end phones.

---

## 4. Brand name

Checked by web search on 2026-10-24. None of these turned up an esports or tournament brand of the same name.

| Name | Meaning | Notes |
|---|---|---|
| **PUGMARK** | A tiger's footprint, the trail a ranger reads in a national park | Search found no esports or gaming brand. It's used by some Indian wildlife resorts and tour operators, which is a different category and harmless. The line writes itself: "Leave your mark." Easy to say in English and Hinglish. |
| **MACHAN** | The raised watch-platform hunters and rangers use in Indian forests | Found nothing in gaming. A nice metaphor (the view from above = leaderboards), but people outside India won't know it, and "macha" is Tamil and Kannada slang for "bro", which you could treat as a bonus or a risk. |
| **ARANYA** | Sanskrit for forest | Found nothing in esports. Elegant, but soft; it sounds like a spa or a housing society. |
| **RANN** | Hindi for battle (as in रण) | No esports team found. Short and punchy, but it overlaps with the Rann of Kutch and a 2010 film, so it is hard to search for. |
| **KSHETRA** | "Field" (as in Kurukshetra, a field of battle) | Ownable and meaningful, but hard to spell and type. |

**Recommendation: PUGMARK.** Full lockup: **PUGMARK** · *IITM BS Esports*. It ties directly to the 12 national-park houses, is ownable in its category, works as a verb ("mark your rank"), and the mark draws cleanly. Check domain and handle availability before committing (e.g. `pugmark.gg`, `@pugmark.iitm`); not checked here.

**Mark (inline SVG).** A geometric tiger pugmark: four toes plus a broad trilobed pad, drawn on a 24-unit grid in `currentColor` (text-1, **not** marigold, since the accent has one job). It sits beside the wordmark set in Archivo at wdth 72 / 800 caps with letter-spacing 0.04em. Outline the text to paths before shipping.
```svg
<svg viewBox="0 0 132 24" height="24" role="img" aria-label="Pugmark" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <g>
    <ellipse cx="5.2"  cy="9.2" rx="1.9" ry="2.6" transform="rotate(-20 5.2 9.2)"/>
    <ellipse cx="9.5"  cy="5.2" rx="2.0" ry="2.8" transform="rotate(-6 9.5 5.2)"/>
    <ellipse cx="14.5" cy="5.2" rx="2.0" ry="2.8" transform="rotate(6 14.5 5.2)"/>
    <ellipse cx="18.8" cy="9.2" rx="1.9" ry="2.6" transform="rotate(20 18.8 9.2)"/>
    <path d="M12 11.2c-3.7 0-6.7 2.9-6.7 6.3 0 2.5 1.8 4.3 3.9 4.3 1.1 0 1.8-.6 2.8-.6s1.7.6 2.8.6c2.1 0 3.9-1.8 3.9-4.3 0-3.4-3-6.3-6.7-6.3z"/>
  </g>
  <text x="30" y="19" font-family="Archivo" font-stretch="72%" font-weight="800" font-size="19" letter-spacing=".8">PUGMARK</text>
</svg>
```
Favicon and app icon: the pugmark alone, bone `#ECEFE7` on `#0B0F0D`, with a 2px marigold notch at the top-right corner of the tile (the only place the accent is used as brand, and it echoes the primary button).

---

## 5. Mobile-first page layouts (360–412px, 16px gutters)

1. **Sign-in.** No nav bars. Wordmark at the top. A contour texture header takes the top 30% of the screen, with the line "The IITM BS inter-house esports league" in h1. The email field and Send code button sit in the lower half so they're in thumb reach. The OTP step replaces the content in place, with no route change, and Back returns to the email.
2. **Events (home).** Hero first: **one** card for the most urgent thing, which is your next match (countdown in mono) or else the open event that closes soonest. It is full-width 16:9 art with a scrim, the status pill, `BGMI // SQUAD 4 // CLOSES 28 OCT`, and the **Register** primary button, which is the screen's only marigold. Below that: horizontal filter chips (All / Open / Live / Upcoming / Completed; the selected chip uses the accent-tint fill and a marigold 1px border), then the game grid (2 columns of 4:5 cards). Then a "Request a game" ghost row at the bottom.
3. **Game / event detail.** A 16:9 key-art hero with the title in display caps over the scrim and the status pill. Meta grid in 2 columns of `.tag` label plus value: Format, Team size, Starts (IST), Closes, Entrants (mono), Houses represented. Segmented tabs: Overview · Leaderboard · Rules · Schedule; the selected one has text-1 and a marigold underline. A sticky bottom CTA bar sits above the safe area (the bottom nav is hidden on this route): left shows "212 registered" in text-2, right shows **Register** (or "Registered" with a check icon as a secondary button, or "Closed" disabled).
4. **Registration.** A full page as specced in §3.5: a compact event strip, a locked "You" block, the "In-game" fields, the squad block, and the sticky primary button. The keyboard must never cover the button, so use `scrollIntoView` on focus and the `visualViewport` resize handling.
5. **Leaderboard.** Event switcher at the top (a select-style button that opens a sheet listing your events first). Sticky search plus sort. Rows run edge to edge; dividers are inset 16px. The my-position row floats above the bottom bar. Load the first 100 rows, then paginate on scroll (or virtualize past 500 rows).
6. **Houses.** A season header ("Season 1 · after 6 events") with the leader in display caps. Then the 12-row standings, with your house's row carrying the marigold left bar. Tapping a row goes to the house page (contour header, per-game breakdown, top 10 players from that house).
7. **Me / profile.** The header block, the 3-cell stat strip, the "My events" list, then Settings rows (Edit IGN per game, Notifications, Sign out). The admin row shows only for admin roles.
8. **Admin (mobile is fallback; designed for ≥1024).** Left rail with Events / Games / Scores / Players / Houses / Requests, then the dense table area. On phones it is a single-column list of stacked cards with only the critical actions (Open/close registration, Verify player); score entry gets a "Use a laptop for bulk paste" note.

**Performance budget (mid-range Android).** At most 2 font files (Archivo variable plus Plex Mono 500), each under 60 KB woff2 with the latin subset. Key art served as AVIF at 480w and 960w with `srcset`/`sizes`; card images under 60 KB. JS under 170 KB gzipped on first load. No `backdrop-filter`, no `filter: blur`, no box-shadows on scrolling lists, and one static SVG texture. LCP image (the hero art) gets `fetchpriority="high"`. Target LCP under 2.5s on a Moto G-class device over 4G.
