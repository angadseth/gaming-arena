# Pugmark design v2: "Holo League" (24 Oct 2026)

Angad's feedback on v1 (RANGER, near-black + marigold): visibility too low, theme not fun, wants something
unique: not plain black/white, not neon; different things that work together; motion, buttons, cursor
researched; a top-notch "made by" credit. v1 is kept at git tag `theme-ranger-v1`.

## Research → what was picked
| Source | Idea | Used as |
|---|---|---|
| simeydotme/pokemon-cards-css (GitHub, ~7.7k stars), hover-tilt.simey.me | Holo foil cards: pointer-driven tilt, rainbow foil layer with blend modes, glare | Every event is a collectible card; the featured event is the big card. THE one bold element. |
| masteryder/splitflap, FlipOff (CSS 3D tile flips) | Split-flap departure-board characters | Points, ranks and house totals flip into place when standings load. |
| Motion+ Cursor (magnetic cursors, cursor zones), Framer magnetic buttons | Magnetic pull towards the pointer | Primary buttons lean towards the pointer (max 6 px), fine pointers only. |
| Valorant site breakdown (condensed display face, hard shapes) | Condensed sports display type | Big Shoulders Display for display, numbers and stat lines. |
| React Router view transitions | Cross-route transitions | Quick rise between top-level pages. |
| 2026 trend roundups (texture, imperfection, tactility) | Tactile UI | Keycap buttons with real depth that press down. |
| Own subject (houses = Indian national parks, brand = tiger pugmark) | Animal tracks | Desktop cursor leaves fading paw prints; footer is a walking trail with the credit. |

## Tokens
- Base "peacock night" #0E2629, surfaces #133236 / #193D41 / #21494E, borders #2A5459 / #3A6A70.
- Text #FBF7EC / #CFDCD6 / #9DB3AE (all ≥ 6:1 on base).
- Haldi #FFC23D is the only action colour (primary button, selected, focus); depth #B9860F.
- Status: live sindoor #FF5B3A, open neem #7EE08A.
- Every game has its own foil hue (src/lib/format.ts GAME_HUE); every house its own colour (HOUSE_META.color).
- Type: Big Shoulders Display 700–900 (display, numbers, stat lines), Instrument Sans 400–700 (body, UI).

## Rules
- Boldness lives in the cards. Lists, forms and admin stay quiet and readable.
- Motion answers the person (tilt, press, magnetic, flaps on data load); the only ambient motion is
  the LIVE dot and the hero card's slow foil sheen. All of it is off under prefers-reduced-motion.
- Touch devices: tilt follows the finger while it is on a card; no cursor trail, no magnetism.
