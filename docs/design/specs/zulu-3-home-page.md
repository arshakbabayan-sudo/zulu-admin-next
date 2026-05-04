# Zulu_3 — Home page (Landing)

**Source:** [Figma — Zulu3_Home_page](https://www.figma.com/design/02fQ1tdpnODhsvgHJp4fGx/Zulu3_Home_page)
**File key:** `02fQ1tdpnODhsvgHJp4fGx`
**Cached:** 2026-05-04

Public-facing landing page for `zulu.am` / `www.zulu.am`. Tokens come from Zulu_1 (already in code).

## Screen inventory

| Screen | Node ID | Size | Purpose |
|---|---|---|---|
| Landing (desktop) | `1:4428` | 1440 × 4638 | Full home page, all sections stacked |
| home-mobile | `1:19184` | 375 × 3796 | Mobile version, same sections, vertical |
| Dropdown-language | `1:4699` | 180 × 160 | Language picker (3 items × 48 tall) |
| search bar-mobile | `1:26495` | 711 × 3527 | 7 variants of mobile search panel |
| tabs (symbol) | `1:26663` | 375 × 36 | Mobile tab strip |

## Desktop Landing layout (1:4428)

Outer container: 1440px wide, 4638px tall. Sections stack with consistent 120px horizontal page padding inside the 1200px content rail.

### Section 1 — Hero (y: 0–640)

| Element | Node ID | Position | Size | Notes |
|---|---|---|---|---|
| Hero image (mask) | `1:4429` | 0,0 | 1440 × 640 | unsplash:mSESwdMZr-A — full-bleed image |
| Header (instance) | `1:4435` | 0,0 | 1440 × 60 | Standard top nav (from Zulu_1 components) |
| Title block | `1:4432` | 120,184 | 1200 × 110 | "Book your perfect travel" h1 (1200×70) + "The best travel for your jouney begins now" subhead (1200×24) |
| Search bar (instance) | `1:4579` | 120,434 | 1200 × 312 | Search component spans most of hero bottom |

### Section 2 — Your recent searches (y: 823–1033)

| Element | Position (rel) | Size | Notes |
|---|---|---|---|
| Heading "Your recent searches" | 0,0 | 247 × 29 | with 1px underline accent |
| Card row | 0,90 | 1200 × 120 | 3 × `card 4` (378.67×120), 32px gap |

### Section 3 — Special offers (y: 1153–1771)

- Heading: "Special offers" (161×29) + subtitle "Promotions, deals and special offers for you" (336×19)
- 3 large cards: `card 1`, `card 2`, `card 1` — 378.67×440 each, 32px gap
- Prev/next buttons (40×40 each) at y=214 spanning 1240px (one at x=0, one at x=1200)
- Dot pagination (152×5) at y=613 — 5 dots, with second dot expanded (32 wide vs 18) indicating active

### Section 4 — Explore popular destinations (y: 2208–3085)

- Heading: "Explore popular destinations" (332×29) + subtitle "The best tours and excursions in every city" (329×19)
- 2 rows × 3 cards (378.67×360 each, 32px column gap, 32px row gap)
- Row 1: `card 3`, `card 5`, `card 6`
- Row 2: `card 4`, `card 5`, `card 6`

### Section 5 — Subscribe band (y: 3205–3627)

- Full-width band 1200×422 with hero image cutout (handshake photo, same as login screens)
- Circular logo overlay (Union vector, 650×650 at x=867, y=-284)
- Title "Subscribe to our newsletter" (549×40)
- Body lorem (537×78)
- Submit button (135×48) — primary, "Subscribe" label

### Section 6 — Our partners (y: 3747–4018)

- Heading: "Our partners" (149×29)
- 5 logos in a row (1200×110): Lufthansa (154×110), ITP (150×110), Hotailors (209×110), FCM (186×110), CWT (122×110)
- Dot pagination (92×5) at y=180 — 3 dots, first expanded to 32 (active)

### Section 7 — Newsletter signup (y: 3804–4252)

| Element | Position | Size | Notes |
|---|---|---|---|
| Frame container | 0,3804 | 1440 × 448 | Background band |
| Inner content | 120,64 | 1200 × 320 | 2-column: text+input on left (719), image right |
| Title "Subscribe to our newsletter" | 0,0 | 408 × 44 | h2 |
| Description | 0,68 | 408 × 48 | "Be the first to receive exclusive offers..." |
| Email input + button | 0,164 | 500 × 48 | 340-wide input + 140-wide "Subscribe" button (16px gap) |
| Disclaimer "*You can easily unsubscribe any time" | 0,220 | 460 × 24 | small caption |
| Image (right column) | 720,0 | 480 × 320 | unsplash:a-w7wDtNWmo |

### Section 8 — Footer (y: 4252–4638)

- Footer instance (1:4563) — 1440 × 386 — standard from Zulu_1 components

## Mobile layout (1:19184)

375px wide, 3796px tall. Sections stack vertically with 16px horizontal padding (343px content rail). Same content as desktop but rearranged:

| Section | y range | Notes |
|---|---|---|
| Status bar | 0–20 | iOS status bar (system) |
| Header | 20–64 | 375 × 44 (height differs from desktop's 60) |
| Hero image | 20–240 | 458×220, slightly extends beyond viewport |
| Title block | 96–146 | 280 × 50 (smaller text) |
| Search bar mobile | 196–640 | 375 × 444 (larger than desktop, full-width with form fields stacked) |
| Recent searches | 688–836 | Horizontal-scroll 3 cards (290–296×100) |
| Special offers | 884–1232 | Horizontal-scroll 4 cards (290–306×300) |
| Explore destinations | 1280–1633 | Horizontal-scroll 2 cards (290 + 342 × 300) |
| Subscribe band | 1713–2121 | 375 × 408 with circular logo overlay (370×370 at x=256) |
| Our partners | 2201–2398 | 343 × 144 — 2 rows of logos (3 + 2) |
| Newsletter signup | 2478–3174 | 375 × 696 — image above form (343×228) |
| Footer | 3174–3796 | 375 × 622 (much taller than desktop) |

## Reusable card variants

Cards `card 1` through `card 6` are defined in Zulu_1 components. Different aspect ratios used here:
- `card 1`, `card 2` — 378.67×440 (Special offers, large hero card)
- `card 3`, `card 5`, `card 6` — 378.67×360 (destinations grid)
- `card 4` — 378.67×120 (recent searches, compact)
- Mobile sizes: 290×100, 290×300, 296×300, 306×300, 342×300

Re-fetch from Zulu_1 if implementing — those are the source of truth for visual styling.

## Search bar variants (1:26495)

Mobile search has 7 states (671×varying):
- Default — 444 tall (collapsed)
- Variant2 — 400 tall
- Variant3 — 622 tall (expanded with calendar)
- Variant4–7 — 486/486/422/294 tall (different field expansion states)

## Implementation notes

- **Content rail:** desktop 1200px (with 120px outer padding inside 1440px viewport); mobile 343px (with 16px outer padding inside 375px viewport)
- **Card grid:** 3-column desktop with 32px gap; mobile uses horizontal scroll
- **Hero image:** Same handshake photo reused 3 times (login hero, Subscribe band, possibly other pages)
- **Reused components:** `header`, `footer`, `search`, `Button`, `card 1–6` — all from Zulu_1
- **Newsletter signup:** Two distinct treatments — "Subscribe band" mid-page (with logo overlay, button-only CTA) and "Newsletter signup" above footer (with email input + submit button + disclaimer)

## Current implementation status (zulu-frontend-next)

- Public site URL: [zulu.am](https://zulu.am) — 307 redirect to www.zulu.am
- Implementation status: TBD — needs Playwright check + Figma comparison
- Likely deltas: search bar (most complex element), card grid spacing, hero image, partner logo carousel

---

*This spec is the local cache. Re-fetch from Figma only if design changes.*
