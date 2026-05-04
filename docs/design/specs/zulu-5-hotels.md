# Zulu_5 — Hotels

**Source:** [Figma — Zulu5_Hotels](https://www.figma.com/design/ZiD41EZvbXyYEJUMvLaauY/Zulu5_Hotels)
**File key:** `ZiD41EZvbXyYEJUMvLaauY`
**Cached:** 2026-05-04

Hotels search, results list, single hotel detail, booking flow. Tokens come from Zulu_1.

## Screen inventory

### Desktop (1440 wide)

| # | Screen | Node ID | Size | Purpose |
|---|---|---|---|---|
| 1 | Hotels list | `1:7696` | 1440 × 5917 | Search hero + filter sidebar + results list |
| 2 | Hotel | `1:12926` | 1440 × 6152 | Single hotel detail page (gallery, rooms, reviews, map) |
| 3 | Book Hotel | `1:22843` | 1440 × 3026 | Booking flow with guest info + payment |

### Mobile (375 wide)

| # | Screen | Node ID | Size | Purpose |
|---|---|---|---|---|
| 4 | home-mobile | `1:19401` | 375 × 1682 | Hotels mobile home / search entry |
| 5 | Edit your search (compact) | `1:20619` | 375 × 72 | Sticky bar variant |
| 6 | Edit your search (expanded) | `1:5843` | 375 × 291 | Expanded edit search panel |
| 7 | Filter (hotel) | `1:8729` | 375 × 5072 | Full-page mobile filter |
| 8 | sort (hotel) | `1:22378` | 343 × 249 | Sort modal |
| 9 | hotel-detail-mobile | `1:19520` | 375 × 5758 | Single hotel detail mobile |
| 10 | Book Hotel (mobile) | `1:23048` | 375 × 3761 | Booking flow mobile |
| 11 | map popup (mobile) | `1:22736` | 375 × 800 | Map view mobile |

### Modals / popovers (desktop)

| Screen | Node ID | Size | Purpose |
|---|---|---|---|
| Airlines | `1:26301` | 700 × 352 | Filter popover (airlines selector — cross-cached from Flights) |
| Dropdown — room and adults | `1:22601` | 300 × 208 | Guests/rooms selector |
| Dropdown — date picker | `1:22566` | 777 × 424 | Calendar with 2 months side-by-side |
| Dropdown — Search hotel | `1:22561` | 390 × 288 | Hotel/destination autocomplete |
| Sign up /agent | `1:15151` | 480 × 715 | Auth modal (cross-cached from Zulu_2) |
| Leave Review | `1:15207` | 560 × 849 | Post-stay review form |
| Map popup | `1:22629` | 1420 × 3269 | Full-canvas map with results overlay |
| Success | `1:15194` | 480 × 350 | Post-booking success modal |

## Desktop Hotels list (1:7696) layout

- Page width 1440 (1200 content rail with 120px outer padding)
- Header (60) at top
- Search hero with destination + dates + guests filters
- Two-column body:
  - **Left filter sidebar** — sticky filter panel (matches Flights pattern)
  - **Right results column** — list of hotel cards with image gallery, rating, price, "View deal" CTA
- Footer (386) at bottom

## Desktop Hotel detail (1:12926) layout — 1440×6152

Long-scroll detail page. Section ordering:

1. Header (60)
2. Hotel hero — full-width image gallery + title/breadcrumbs
3. Rooms list — selectable room types with prices
4. Hotel description + amenities
5. Map embed (likely uses `map popup` content, 1420×3269)
6. Reviews section — uses `Leave Review` modal trigger
7. Similar hotels suggestions
8. Footer (386)

## Desktop Book Hotel (1:22843) layout — 1440×3026

Three-step booking:
- Selected hotel summary (left/top)
- Guest info form (passenger details — likely reused from Flights/detail/book)
- Payment form
- Right-column 408px sticky summary (consistent with Flights pattern)

## Mobile flows

- **home-mobile (1:19401):** Search hero + popular hotels carousel + recent searches
- **hotel-detail-mobile (1:19520):** Long-scroll equivalent of desktop Hotel page
- **Filter(hotel) (1:8729):** Full-page filter — same pattern as Flights filter (multiple grouped sections)
- **Book Hotel (1:23048):** Mobile booking — sequential sections instead of two-column

## Reusable components from Zulu_1

- `header` (1440×60 / 375×44)
- `footer` (1440×386 / 375×622)
- `Button` (40×40, 343×48, 135×48, etc.)
- Card variants — hotel result card likely uses a hotel-specific composite (gallery + content)
- Form inputs, dropdowns, calendar — reused across Flights/Hotels/Transfer

## Cross-product reuse

- `Sign up /agent` modal — from Zulu_2 (auth required for booking)
- `Airlines` filter popover — also appears in Zulu_4 Flights
- `share hotel` modal — defined in Zulu_4 (560×668)
- Hero/hand-shake circular logo — same image as Login screens + Subscribe band

## Implementation notes

- **Map popup:** 1420×3269 desktop suggests full-screen map view triggered from a "View on map" CTA. Mobile is 375×800 (much smaller — likely modal sheet)
- **Filter sticky:** mobile filter is a full page (5072 tall) — needs separate route or full-screen sheet
- **Date picker:** 777×424 = 2-month side-by-side calendar (consistent with Booking.com / standard travel UX)
- **Edit search compact (375×72):** sticky bar pattern — appears once user scrolls past hero, lets them quickly modify search

## Current implementation status

- Public hotels page: TBD
- Booking flow: TBD
- Likely shared codebase with Flights for sticky summary, payment form, success modal

---

*This spec is the local cache. Re-fetch from Figma only if design changes.*
