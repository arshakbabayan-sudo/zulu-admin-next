# Zulu_6 — Transfer

**Source:** [Figma — Zulu6_Transfer](https://www.figma.com/design/i1smXpRF3jtcpDmqw1I6cb/Zulu6_Transfer)
**File key:** `i1smXpRF3jtcpDmqw1I6cb`
**Cached:** 2026-05-04

Airport / city transfer service — search, results, detail, payment. Smaller product than Flights/Hotels (single price tier per route, fewer filters). Tokens come from Zulu_1.

## Screen inventory

### Desktop (1440 wide)

| # | Screen | Node ID | Size | Purpose |
|---|---|---|---|---|
| 1 | transfer page | `1:11571` | 1440 × 1980 | Search hero + results list (compact, 1980 vs Hotels' 5917 = much shorter) |
| 2 | Transfer/detail | `1:23249` | 1440 × 1839 | Single transfer detail + booking summary |

### Mobile (375 wide)

| # | Screen | Node ID | Size | Purpose |
|---|---|---|---|---|
| 3 | transfer page-mobile | `1:28629` | 375 × 2372 | Mobile search + results |
| 4 | Filter | `1:28196` | 375 × 1122 | Filter (much shorter than Hotels — fewer options) |
| 5 | Edit your search | `1:29017` | 375 × 612 | Expanded edit-search panel |
| 6 | Frame 514145 | `1:23396` | 343 × 1168 | Mobile detail/booking section |

### Modals / popovers

| Screen | Node ID | Size | Purpose |
|---|---|---|---|
| Dropdown — room and adults | `1:26420` | 300 × 532 | Passengers + luggage selector (taller than Hotels' 208 — adds luggage rows) |
| Payment details | `1:26370` | 480 × 960 | Payment modal (centered desktop, becomes full-screen mobile) |
| Frame 514033 | `1:23477` | 673 × 152 | Compact card / route summary block |
| Frame 512531 | `1:23511` | 673 × 64 | Compact bar (one-line summary) |

## Desktop transfer page (1:11571) layout — 1440×1980

Compact compared to Hotels (which is 5917). Single-column or simple two-column:
- Header (60)
- Search hero — pickup, drop-off, date/time, passengers
- Results list — short list of vehicle options (sedan, van, premium, etc.)
- Footer (386)

## Desktop Transfer/detail (1:23249) layout — 1440×1839

- Selected vehicle summary
- Pickup/drop-off route map
- Passenger/luggage info form
- Sticky right-column 408px summary (consistent with Flights/Hotels)
- Pay-now CTA

## Reused elements

- All standard from Zulu_1 (header, footer, button, form inputs)
- `Payment details` modal (480×960) — generic, may be reused across products
- `Dropdown-room and adults` — 532px tall version (Hotels' was 208) — adds luggage selector

## Implementation notes

- **Simpler than Flights/Hotels:** fewer filters, fewer screens, no detail "long page" with reviews/amenities
- **Vehicle types:** likely 3-5 tiers (Economy, Standard, Business, Van, Premium) — see Zulu_1's `seat place` component which has Econom/Default/Business/Not-available variants
- **Date+time picker:** transfer needs time, not just date — UI element TBD (may differ from Hotels' calendar)

## Current implementation status

- Public transfer page: TBD

---

*This spec is the local cache. Re-fetch from Figma only if design changes.*
