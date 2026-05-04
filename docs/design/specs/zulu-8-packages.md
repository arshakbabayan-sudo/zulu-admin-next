# Zulu_8 — Packages

**Source:** [Figma — Zulu8_Packages](https://www.figma.com/design/xdLcbOxtAnDtoSDnruiMEh/Zulu8_Packages)
**File key:** `xdLcbOxtAnDtoSDnruiMEh`
**Cached:** 2026-05-04

Travel packages — bundled product (flight + hotel + visa + insurance). Most complex product after Hotels. Tokens come from Zulu_1.

## Screen inventory

### Desktop (1440 wide)

| # | Screen | Node ID | Size | Purpose |
|---|---|---|---|---|
| 1 | Packages (list) | `1:9729` | 1440 × 4666 | Search hero + filter sidebar + package cards list |
| 2 | Packages detail | `1:10237` | 1440 × 7426 | Long detail page (flight info + hotel + visa + insurance + itinerary) |
| 3 | Packages book | `1:11356` | 1440 × 2529 | Booking flow with traveller info + payment |

### Mobile (375 wide)

| # | Screen | Node ID | Size | Purpose |
|---|---|---|---|---|
| 4 | Packages-mobile | `1:19445` | 375 × 3140 | Mobile list/results |
| 5 | Filter (hotel) | `1:9302` | 375 × 3758 | Mobile filter (reused/adapted from Hotels) |
| 6 | Edit your search | `1:29047` | 375 × 332 | Compact edit-search panel |
| 7 | hotel-detail-mobile (long) | `1:20621` | 375 × 7977 | Hotel-detail variant (cross-cached from Zulu_5) |
| 8 | hotel-detail-mobile (compact) | `1:21441` | 375 × 3149 | Shorter detail variant |

### Modals / popovers / cards

| Screen | Node ID | Size | Purpose |
|---|---|---|---|
| Package card | `1:27034` | 932 × 1492 | Large package summary card (likely the package result row in list) |
| Airlines (large) | `1:26682` | 700 × 396 | Airlines filter popover |
| Airlines (compact) | `1:26728` | 420 × 316 | Compact airlines selector |
| Insurance package | `1:26818` | 600 × 1272 | Insurance options modal — package add-on |
| online_vIsa | `1:26759` | 600 × 1120 | Visa application modal — package add-on |
| card (small) | `1:11534` | 384 × 480 | Compact package card |
| Frame 513738 (sticky bar) | `1:11344` | 1200 × 72 | Sticky compare/CTA bar |

## Desktop Packages list (1:9729) layout — 1440×4666

- Header (60)
- Search hero (destination + dates + travellers)
- Two-column body:
  - Left filter sidebar (sticky)
  - Right results column with `Package card` (932×1492) — large rich cards with flight summary + hotel image + price breakdown
- Frame 513738 sticky bar (1200×72) likely a comparison toolbar that appears when items are selected
- Footer (386)

## Desktop Packages detail (1:10237) layout — 1440×7426

Longest detail page in the system (7426px). Sections:

1. Header (60)
2. Package hero — destination + image gallery + dates + total price
3. **Flight section** — outbound + return flight cards (reuses `flights item` from Zulu_4)
4. **Hotel section** — hotel card + room selection (reuses Zulu_5 hotel detail components)
5. **Visa section** — application status / triggers `online_vIsa` modal (1:26759)
6. **Insurance section** — coverage options / triggers `Insurance package` modal (1:26818)
7. **Itinerary** — day-by-day breakdown
8. Reviews (if available)
9. Right-column 408px sticky summary throughout
10. Footer (386)

## Desktop Packages book (1:11356) layout — 1440×2529

- All travellers info (multiple passengers)
- Visa info per passenger (if applicable)
- Insurance selection
- Payment form
- Sticky right-column total summary

## Cross-product reuse

**Heavily reuses from other Zulu files:**
- `flights item` from Zulu_4 (flight rows in package detail)
- `hotel-detail-mobile` from Zulu_5 (hotel section reused)
- `Filter (hotel)` from Zulu_5 (filter pattern reused)
- `Airlines` filter from Zulu_4/5

This is the "hub" product that aggregates the others.

## Implementation notes

- **Bundled pricing:** package price = flight + hotel + (optional) visa + (optional) insurance — needs total + breakdown
- **Day-by-day itinerary:** unique to packages — likely vertical timeline component
- **Visa add-on:** triggers `online_vIsa` (1:26759, 600×1120) modal — separate visa application form
- **Insurance add-on:** triggers `Insurance package` (1:26818, 600×1272) modal — coverage tiers
- **Sticky compare bar (1:11344):** lets user compare 2-3 packages side by side
- **Package card (1:27034) is large (932×1492):** much richer than Hotels' result card, includes flight + hotel preview inline

## Current implementation status

- Public packages page: TBD — likely not in MVP scope, comes after Flights/Hotels stabilize

---

*This spec is the local cache. Re-fetch from Figma only if design changes.*
