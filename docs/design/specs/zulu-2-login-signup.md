# Zulu_2 — Login / Sign up

**Source:** [Figma — Zulu_2_Login_Sign_up](https://www.figma.com/design/lCwRIXoOYmjiTPSlAckEhW/Zulu_2_Login_Sign_up)
**File key:** `lCwRIXoOYmjiTPSlAckEhW`
**Cached:** 2026-05-04

Tokens (colors, typography, spacing) come from `Zulu1_Components_Colors_Typography` and are already applied via `app/globals.css` + `tailwind.config.ts` in both `zulu-admin-next` and `zulu-frontend-next`. This file documents only layout + element specs unique to the auth flows.

## Screens inventory

### Mobile / compact card (480 × 633–715)

| Screen | Node ID | Size | Notes |
|---|---|---|---|
| Log in | `1:4580` | 480 × 691 | email + password fields, "Forgot password?" link, primary "Log in" button, "Don't have an account? Sign up" footer, OR divider, 3 social-login rows (Google/Facebook/Apple) |
| Sign up (agent variant) | `1:4620` | 480 × 715 | 2 form rows, primary button, "Have an account? Log in", OR divider, 3 social-login rows, T&C footer text |
| Forgot password | `1:4669` | 480 × 633 | title "Forgot your password?", 1 email field, primary button, "Back to Log in" link |
| Reset password | `1:4659` | 480 × 633 | title "Reset your password", 2 password fields, primary button, "Back to Log in" link |
| 2FA | `1:4678` | 480 × 633 | title "Enter your code", description with email, 6-digit OTP boxes (44×48 each, 9px gap), "Didn't get the code? Resend code", primary button |

### Desktop hero layout (1440 × 960)

All desktop screens share the same right-side hero panel (`Frame 513762`, 720 × 1372, half-screen image with circular logo overlay) plus a left-side 400-wide form column anchored at x=160.

| Screen | Node ID | Form anchor | Form size |
|---|---|---|---|
| Log in | `1:4759` | y=152 | 400 × 655 |
| Sign up /user | `1:4809` | y=140 | 400 × 679 |
| Sign up /operator | `1:26922` | y=61 | 400 × 510 (toggle Tour agent / Tour operator + 2 fields + T&C) |
| Sign up /agent (Generate password variant) | `1:4922` | y=330 | 400 × 300 |
| Forgot password | `1:4857` | y=348 | 400 × 263 |
| Reset password | `1:4874` | y=308 | 400 × 343 |
| 2FA | `1:4892` | y=338 | 400 × 304 |
| Generate password | `1:4987` | y=100 (centered) | 480 × 428 |

### Registration / onboarding (full forms)

| Screen | Node ID | Size | Notes |
|---|---|---|---|
| Join us | `1:4703` | 1440 × 1372 | header + footer + 800-wide form block, 2-column field grid (348×60 each, 24px gutter), file uploader rows for documents/license, 160×40 submit button |
| Register | `1:4938` | 1440 × 960 | centered 600-wide form, 2-column 288×60 fields, image upload block + license upload block, 160×40 submit button |

## Reusable form/component instances referenced in this file

These come from `Zulu1` (Components & tokens). The login flows just compose them:

- `froms` — input field, default size 400×60 (mobile) or 348×60 / 288×60 (desktop columns)
- `Button` — primary CTA, default size 400×40 (full-width form) or 160×40 (registration submit) or 40×40 (close icon button)
- `social-login` — full-width social row, 360×48 or 400×48, 24px icon at x=25, label left of center
- `header` — desktop top nav, 1440×60
- `footer` — desktop footer, 1440×386

## Implementation notes

**Mobile vs desktop:** Figma shows two layouts per flow. Production should use Tailwind responsive breakpoints — `sm:600px` and up gets the desktop hero layout, below stays as the 480-wide centered card.

**Hero image:** All desktop screens use the same `closeup-friendly-meeting-handshake-business-woman-businessman-with-sunlight 1` photo at 720×3284 cropped into 720×1372 frame, with a circular union vector overlay at x=327, y=-89, 650×650 (white circle + ring).

**OR divider:** 180×1 line + "OR" text + 180×1 line, 21px tall, used between primary auth and social options.

**Tokens used:**
- Buttons → `primary/primary-500` (#923081) background, white text, Roboto Medium 14/16 letter-spacing 1.25
- Body text → Inter Regular 14/20 (`Body14`)
- Headings → Inter (sizes vary: H5-24 for "Log in", H3-32 for "Forgot password" / "Reset password" titles)
- Form labels → 12/16 (`Body3-Regular`)
- Background → `Background/Bg1` (#FAFBFC) on the form column

## Current implementation status (zulu-admin-next)

- Login page exists at `/login` (admin.zulu.am/login) — verified via Playwright 2026-05-04
- Visual mismatch with Figma: production shows mobile card on desktop (no hero panel, no two-column layout). Needs comparison + fix.
- Forgot/Reset/2FA/Sign-up screens — not yet wired into admin (admin is internal-only, may not need full sign-up flow).

## Current implementation status (zulu-frontend-next)

- Public auth flows TBD — frontend is the user-facing site, may need full sign-up/login/recovery flows.

---

*This spec is the local cache. Re-fetch from Figma only if design changes.*
