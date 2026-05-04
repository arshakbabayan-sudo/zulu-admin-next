# Zulu_7 — Car Rental

**Source:** [Figma — Zulu7_Car_rental](https://www.figma.com/design/zZlZ7zTrCLIx3EcaGNa5Uh/Zulu7_Car_rental)
**File key:** `zZlZ7zTrCLIx3EcaGNa5Uh`
**Cached:** 2026-05-04

Car rental search, results list, detail, payment. Tokens come from Zulu_1.

## Screen inventory

### Desktop (1440 wide)

| # | Screen | Node ID | Size | Purpose |
|---|---|---|---|---|
| 1 | car rental | `1:12158` | 1440 × 2282 | Search hero + results list |
| 2 | car rental/detail | `1:23527` | 1440 × 1456 | Single car detail (selected vehicle, options, summary) |
| 3 | car rental/payment | `1:23665` | 1440 × 2311 | Booking + payment form |

### Mobile (375 wide)

| # | Screen | Node ID | Size | Purpose |
|---|---|---|---|---|
| 4 | cars-mobile (variant a) | `1:28327` | 375 × 2372 | Mobile search results |
| 5 | cars-mobile (variant b) | `1:28760` | 375 × 2121 | Detail variant |
| 6 | cars-mobile (variant c) | `1:28899` | 375 × 2590 | Booking/long form variant |
| 7 | Filter | `1:27982` | 375 × 1522 | Mobile filter |
| 8 | Edit your search | `1:29000` | 375 × 332 | Compact edit-search panel |

### Reusable card variants

| Card | Node ID | Size | Use |
|---|---|---|---|
| car-rental-card (full) | `1:12789` | 343 × 347 | Mobile card with photo, specs, price |
| car-rental-card (compact) | `1:12745` | 892 × 132 | Desktop list-row variant |

## Desktop car rental list (1:12158) layout — 1440×2282

- Header (60)
- Search hero — pickup location, drop-off location, date range, driver age
- Results list using `car-rental-card` (892×132 — horizontal compact rows with car image + specs + price + "Select" CTA)
- Filter sidebar (assumed left, similar to Flights/Hotels pattern)
- Footer (386)

## Desktop car rental/detail (1:23527) layout — 1440×1456

Compact detail page (much shorter than Hotel's 6152). Likely:
- Car summary block (image gallery, specs, included items)
- Optional add-ons (insurance, GPS, child seat)
- Right-column 408px sticky summary
- Pay-now CTA

## Desktop car rental/payment (1:23665) layout — 1440×2311

- Selected car summary card
- Driver info form
- Insurance / add-ons
- Payment form
- Sticky right-column summary

## Mobile flow

Three `cars-mobile` variants (2372/2121/2590) suggest list view, detail view, and booking flow respectively.

## Reused components

- All standard from Zulu_1 (header, footer, button, form)
- Filter pattern matches Flights/Hotels (lighter — only 1522 tall vs Hotels' 5072)
- Payment form likely shares structure with Flights/Hotels Book pages

## Implementation notes

- **Vehicle category icons:** car rental UIs typically show fuel/transmission/seats icons — likely using the `Iconography` set from Zulu_1
- **Driver age field:** unique to car rental (not in Flights/Hotels) — affects pricing
- **Pickup / drop-off locations:** can differ (one-way rental) — UI must support same-vs-different toggle

## Current implementation status

- Public car rental page: TBD

---

*This spec is the local cache. Re-fetch from Figma only if design changes.*
