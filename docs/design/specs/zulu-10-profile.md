# Zulu_10 — Profile / Account

**Source:** [Figma — Zulu10_Profile](https://www.figma.com/design/vOVR1omppvSIqPPdzcpisV/Zulu10_Profile)
**File key:** `vOVR1omppvSIqPPdzcpisV`
**Cached:** 2026-05-04

User account area — saved items, trips, reviews, payment, profile settings. Tokens come from Zulu_1.

## Screen inventory

### Desktop (1440 × 1482) — same template, multiple tabs

All desktop profile screens share the same 1440×1482 layout (sidebar nav + content area). Different tabs swap the content panel:

| # | Screen | Node ID | Purpose |
|---|---|---|---|
| 1 | Profile (variant a) | `1:15005` | Personal info — name, email, phone, photo, language, currency |
| 2 | Profile (variant b) | `1:15123` | Profile alternate (e.g., edit mode or different content state) |
| 3 | Saved Hotels (variant a) | `1:14382` | Bookmarked hotels list |
| 4 | Saved Hotels (variant b) | `1:14578` | Saved hotels alternate (empty state vs populated?) |
| 5 | Saved Flights | `1:14933` | Bookmarked flights list |
| 6 | Trips | `1:14803` | Booking history (upcoming + past trips) |
| 7 | Reviews | `1:14865` | Reviews user has written |

### Mobile (375 × 1858)

| # | Screen | Node ID | Purpose |
|---|---|---|---|
| 8 | Profile | `1:15050` | Mobile profile main |
| 9 | Profile-payment | `1:15095` | Payment methods on mobile |

### Modals

| Screen | Node ID | Size | Purpose |
|---|---|---|---|
| Leave Review | `1:27269` | 1096 × 1133 | Post-trip review modal (rating, photos, text) |
| Add a credit card | `1:26896` | 600 × 500 | Add payment method modal |
| Frame 512472 | `1:14568` | 384 × 234 | Small inline card / confirmation block |

## Desktop Profile layout — 1440×1482 (template for all tabs)

- Header (60) at top
- Two-column body:
  - **Left sidebar nav** — links to Profile / Saved Hotels / Saved Flights / Trips / Reviews / Payment / Logout. Sticky.
  - **Right content area** — tab-specific content (forms, lists, etc.)
- Footer (386)

All 7 desktop screens fit in this template; the right panel changes based on selected tab.

## Profile tab content (1:15005 / 1:15123)

Personal info form fields (typical):
- Avatar / photo upload
- First name, Last name
- Email, Phone
- Language preference
- Currency preference
- Password change link
- Notification preferences

Variant b (1:15123) likely shows the form in **edit mode** vs the static display variant a, OR vice versa.

## Saved Hotels / Flights tabs

- Title + count
- List of saved items using the standard `card` component (likely smaller variants from cards 1-6)
- Empty state when none saved (probably variant b for Saved Hotels)
- Remove / unsave action per item

## Trips tab (1:14803)

- "Upcoming" + "Past" sections
- Each trip card shows: destination, dates, total, status (confirmed/cancelled)
- "View details" / "Leave review" CTAs (review button triggers `Leave Review` modal — 1:27269)

## Reviews tab (1:14865)

- List of reviews user has written
- Each review: hotel/excursion name, rating, date, review text, photos
- Edit / delete actions
- "Leave Review" CTA opens 1096×1133 modal

## Payment (mobile-only screen here, 1:15095)

- List of saved cards
- "Add card" CTA opens `Add a credit card` modal (600×500)
- Default card indicator
- Remove card action

(Desktop Payment tab likely exists but is not present as a separate canvas frame — possibly part of the Profile screen's sidebar with content swap, or shown in Profile variant b.)

## Modals detail

### Leave Review (1:27269) — 1096×1133

- Star rating (overall)
- Per-category ratings (cleanliness, service, value, location)
- Photo upload
- Free text review
- Submit button

### Add a credit card (1:26896) — 600×500

- Card number
- Expiry MM/YY
- CVC
- Cardholder name
- Set as default checkbox
- Save / Cancel

## Implementation notes

- **Sidebar nav pattern:** standard pattern — left fixed nav, right scrollable content. On mobile becomes top tab strip or hamburger menu.
- **Avatar component:** uses Zulu_1's Avatar variants (XXS 24 → XL 56)
- **Empty states:** Saved Hotels has 2 variants — probably populated vs empty. Implement empty illustration + "browse hotels" CTA
- **Review trigger:** "Leave Review" appears from past trips (Trips tab) AND from Reviews tab — same modal component
- **Mobile parity:** mobile Profile/Profile-payment are 1858 tall vs desktop 1482 — vertical stacking adds height

## Current implementation status

- User profile area: TBD — implement after auth flows are wired
- Likely depends on: User model in backend, JWT/session, file upload (avatar), payment provider integration (Stripe/equivalent)

---

*This spec is the local cache. Re-fetch from Figma only if design changes.*
