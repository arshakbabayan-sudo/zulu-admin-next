# Zulu_4 — Flights

**Source:** [Figma — Zulu4_Flights](https://www.figma.com/design/JHdcMecJmsSJtFpKltw1bu/Zulu4_Flights)
**File key:** `JHdcMecJmsSJtFpKltw1bu`
**Cached:** 2026-05-04

Flights search, results list, detail view, and booking flow. Tokens come from Zulu_1.

## Screen inventory

### Desktop (1440 wide)

| # | Screen | Node ID | Size | Purpose |
|---|---|---|---|---|
| 1 | Flights (search + list) | `1:4997` | 1440 × 4954 | Search hero + filter sidebar (428px wide) + results list (892px wide), 4-column footer |
| 2 | Flights/detail | `1:5858` | 1440 × 5238 | Variant A — detail with expanded segments |
| 3 | Flights/detail | `1:7074` | 1440 × 4884 | Variant B — alternate detail layout |
| 4 | Flights/detail/book | `1:6484` | 1440 × 5497 | Booking flow with passenger forms, payment, summary |

### Mobile (375 wide)

| # | Screen | Node ID | Size | Purpose |
|---|---|---|---|---|
| 5 | home | `1:5812` | 375 × 800 | Mobile flights home / search entry |
| 6 | flights list | `1:19361` | 375 × 1613 | Mobile search results |
| 7 | Edit your search | `1:5823` | 375 × 336 | Compact "edit search" modal/sheet |
| 8 | Filter | `1:5425` | 375 × 4173 | Full-page mobile filter (long, scrollable) |
| 9 | sort | `1:22356` | 343 × 282 | Sort modal |
| 10 | flight details | `1:22166` | 375 × 1629 | Compact detail view |
| 11 | flight detail | `1:21741` | 375 × 7021 | Full long-form detail with all info |

### Modals / popovers

| Screen | Node ID | Size | Purpose |
|---|---|---|---|
| share flights | `1:26948` | 560 × 646 | Share modal for flight |
| share packages | `1:26974` | 560 × 676 | Share modal for package |
| share hotel | `1:27001` | 560 × 668 | Share modal for hotel (cross-cached here) |
| card (variant a) | `1:26231` | 479 × 511 | Standalone card preview |
| card (variant b) | `1:7019` | 384 × 323 | Compact card preview |

## Desktop Flights search/list (1:4997) layout

- **Page width:** 1440 (1200px content rail with 120px outer padding)
- **Header:** 60px top nav (instance from Zulu_1)
- **Hero / search:** at top, full-width
- **Body two-column layout** (starts at y=476, 120px from edges):
  - **Left sidebar:** 428px wide — filter panel (sticky)
  - **Right content:** 892px wide (`Frame 513845`, 1:5020) — list of flight result cards
- **Result card** = `flights item` (see detail screens, 892px wide)
- **Footer:** 386px (instance from Zulu_1)

## Desktop Flights/detail (1:5858) layout

- Shares search hero + filter sidebar + results column with the list page
- Within results column: one card expanded into `flights item` (892×1472) showing route segments
- Inner segments: `Frame 513919` (828×340) per route leg

## Desktop Flights/detail/book (1:6484) layout

Multi-section booking page:

| Section | Node ID | Size | Purpose |
|---|---|---|---|
| Trip summary card | `1:6489` | 895 × 704 | Summary of selected flight |
| Passenger info | `1:6574` | 895 × 948 | Form for passenger details (847×900 inner content) |
| Additional services | `1:6623` | 895 × 2991 | Long form (847×900 + 847 × 1422 multiple panels) |
| Payment | `1:6669` | 895 × 405 | Payment form (844×357 inner) |
| Confirmation block | `1:6754` | 895 × 1470 | Final summary + 360×688 left + 408×928 right two-col layout |

Right-column 408px sticky summary throughout.

## Mobile flight detail (1:21741) layout — long form

Full-width 343px content (16px outer padding inside 375px viewport), 7021 tall. Key blocks:

| Block | Node ID | Size | Purpose |
|---|---|---|---|
| Header card | `1:21768` | 343 × 800 | Flight summary at top |
| Section 1 | `1:21781` | 343 × 1482 | Route + segment details (319×1412 inner) |
| Frame 514251 (further sections) | (multiple) | 343 × N | Stacked content sections |

Use this when user opens a result card — far longer than the compact `flight details` (1:22166) variant.

## Mobile Filter (1:5425) layout — full-page filter

375px wide, 4173px tall. Multiple filter section groups:

| Block | y | Size | Notes |
|---|---|---|---|
| Frame 513799 | 503 | 343 × 464 | First filter group |
| Frame 513807 | 1461 | 343 × 392 | Second group |
| Frame 513815 | 3266 | 343 × 372 | Last group (pricing, etc.) |

## Reusable components used here

All from Zulu_1 (already in tokens code):
- `header` (1440×60 desktop / 375×44 mobile)
- `footer` (1440×386 desktop / 375×622 mobile)
- `Button` (40×40 icon, 135×48, 343×48, etc.)
- `card` (multiple variants — see card 1–6 in Zulu_1)
- Form/input fields, dropdowns
- `flights item` — composite card unique to Flights/Hotels (defined per result row, 892×varies)

## Implementation notes

- **Two-column with sticky sidebar:** typical Tailwind `grid grid-cols-[428px_1fr]` with `sticky top-N` on filter panel
- **Mobile filter drawer:** the `Filter` page (1:5425) implies full-page filter on mobile — use `<Sheet>` or full-screen modal instead of inline
- **Long detail view:** mobile `flight detail` is 7021px — heavy use of accordion/collapse to reduce initial scroll
- **Share modals (560 wide):** centered desktop modals; on mobile likely become full-screen sheets

## Current implementation status

- Public flights page: TBD — needs Playwright check on zulu.am once flights feature ships
- Admin flights management: TBD

---

*This spec is the local cache. Re-fetch from Figma only if design changes.*
