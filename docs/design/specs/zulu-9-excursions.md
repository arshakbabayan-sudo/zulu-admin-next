# Zulu_9 — Excursions

**Source:** [Figma — Zulu9_Excursions](https://www.figma.com/design/9G7rO4bwoZ4Q0RsEHHPqcd/Zulu9_Excursions)
**File key:** `9G7rO4bwoZ4Q0RsEHHPqcd`
**Cached:** 2026-05-04

Excursions and tours — guided activities at destinations. Tokens come from Zulu_1.

## Screen inventory

### Desktop (1440 wide)

| # | Screen | Node ID | Size | Purpose |
|---|---|---|---|---|
| 1 | excursions list | `1:8380` | 1440 × 2373 | Search hero + results list (compact, similar to Transfer) |
| 2 | excursion details | `1:13858` | 1440 × 5746 | Long detail page (gallery, itinerary, includes/excludes, reviews) |
| 3 | excursion book | `1:27743` | 1440 × 2581 | Booking flow with traveller info + payment |

### Mobile (375 wide)

| # | Screen | Node ID | Size | Purpose |
|---|---|---|---|---|
| 4 | Packages-mobile | `1:19488` | 375 × 2994 | Mobile list (named "Packages-mobile" — pattern reused) |
| 5 | Filter (Packages-mobile) | `1:8550` | 375 × 1277 | Mobile filter |
| 6 | Edit your search | `1:29064` | 375 × 290 | Compact edit-search panel |
| 7 | hotel-detail-mobile | `1:20018` | 375 × 5770 | Mobile detail view (uses hotel-detail layout pattern) |
| 8 | excursion book-mobile | `1:20486` | 375 × 3466 | Mobile booking flow |

### Modals / cards

| Screen | Node ID | Size | Purpose |
|---|---|---|---|
| Excursion card (large) | `1:27467` | 932 × 1185 | Large excursion result card (similar to Package card) |
| Dropdown — travelers | `1:26455` | 380 × 296 | Travellers selector (adults / children / infants) |
| card (compact) | `1:27903` | 384 × 332 | Smaller excursion card variant |
| Frame 514003 | `1:27686` | 744 × 340 | Some module / inline component |
| Frame 513989 (gallery) | `1:27705` | 894 × 770 | Image gallery block |
| Frame 368 | `1:27926` | 420 × 24 | Compact label/breadcrumb |

## Desktop excursions list (1:8380) layout — 1440×2373

Compact list (similar to Transfer):
- Header (60)
- Search hero — destination, date, travellers
- Results — `Excursion card` (932×1185) cards in single column
- Filter sidebar (likely)
- Footer (386)

## Desktop excursion details (1:13858) layout — 1440×5746

- Header (60)
- Hero gallery (894×770 image gallery from Frame 513989)
- Excursion title + duration + meeting point
- "What's included / excluded" section
- Itinerary (timeline of activities)
- Reviews
- Right-column 408px sticky booking summary
- Similar excursions
- Footer (386)

## Desktop excursion book (1:27743) layout — 1440×2581

- Selected excursion summary
- Travellers form (uses Dropdown-travelers, 1:26455)
- Pickup / meeting point selection
- Add-ons (private guide, audio guide, etc.)
- Payment form
- Sticky right-column total

## Cross-product reuse

- Mobile list named **"Packages-mobile"** — same structural pattern as Zulu_8
- Mobile detail uses **`hotel-detail-mobile`** — same pattern as Zulu_5
- `Dropdown-travelers` (380×296) — slightly different from Hotels' `room and adults` (300×208) — adds infant option

## Implementation notes

- **Itinerary timeline:** unique component for excursions — typically vertical with time markers (e.g., "9:00 AM — Hotel pickup", "10:00 AM — Arrival at site")
- **Duration vs date range:** excursions are typically single-day or multi-day, not extended like packages — affects calendar UI
- **Includes/excludes list:** standard for tour products — checkmarks + crosses
- **Group size limits:** excursions often have max-pax constraints — UI must show availability per date

## Current implementation status

- Public excursions page: TBD — likely later in roadmap

---

*This spec is the local cache. Re-fetch from Figma only if design changes.*
