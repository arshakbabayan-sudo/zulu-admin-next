# Zulu_1 — Components, Colors, Typography (Design Tokens)

**Source:** [Figma — Zulu1_Components_Colors_Typography](https://www.figma.com/design/A6KZcUWQanpfKiU2jjMYGj/Zulu1_Components_Colors_Typography)
**File key:** `A6KZcUWQanpfKiU2jjMYGj`
**Cached:** 2026-05-04

This is the **base design system** — colors, typography, components. All other 9 Figma files reference these tokens. **These tokens are ALREADY applied in code** at:
- `zulu-admin-next/app/globals.css` + `zulu-admin-next/tailwind.config.ts`
- `zulu-frontend-next/app/globals.css` + `zulu-frontend-next/tailwind.config.ts`

This file documents what's in Figma so you don't need to open Figma again. If anything in the code does NOT match this spec, the code is the bug.

## Top-level frame inventory

| Frame | Node ID | Notes |
|---|---|---|
| color (section) | `1:15326` | All color swatches: primary, secondary, tertiary, text, background, validation |
| Components | `1:18918` | Buttons, inputs, cards, social-login, header, footer, etc. |
| Typography | `1:22396` | Inter type specimen with all heading + body styles |
| Iconography | `1:23817` | Icon set (24×24 base) |
| zulu 1 | `1:19165` | Logo (1587×1122 source) |
| Thumb | `1:19182` | File thumbnail (1000×600) |

## Color palette

### Primary (purple/magenta — main brand color)
| Token | Hex |
|---|---|
| primary-900 | #631351 |
| primary-800 | #751E64 |
| primary-700 | #7F246E |
| primary-600 | #8A2B79 |
| **primary-500** (default) | **#923081** |
| primary-400 | #A24F94 |
| primary-300 | #B36EA7 |
| primary-200 | #C998C0 |
| primary-100 | #DEC1D9 |
| primary-50 | #F2E6F0 |
| primary-10 | #FBF8FB |

### Secondary (dark navy)
| Token | Hex |
|---|---|
| secondary-900 | #0A0614 |
| secondary-800 | #120C20 |
| secondary-700 | #170F27 |
| secondary-600 | #1B122E |
| secondary-500 | #1F1533 |
| secondary-400 | #413852 |
| secondary-300 | #625B70 |
| secondary-200 | #8F8A99 |
| secondary-100 | #BCB9C2 |
| secondary-50 | #E4E3E7 |
| secondary-10 | #ECEBEE |

### Tertiary (purple-dark accent)
| Token | Hex |
|---|---|
| tertiary-900 | #2C144D |
| tertiary-800 | #3C1F60 |
| tertiary-700 | #46256A |
| tertiary-600 | #4F2B75 |
| tertiary-500 | #57307C |
| tertiary-400 | #704F90 |
| tertiary-300 | #896EA4 |
| tertiary-200 | #AB97BE |
| tertiary-100 | #CDC1D7 |
| tertiary-50 | #EBE6F0 |

### Text colors (foreground)
| Token | Hex | Use |
|---|---|---|
| Text/T9 | #161343 | Darkest — strong headings on light bg |
| Text/T8 | #2B2C34 | Body text default |
| Text/T7 | #3B3D45 | Secondary body |
| Text/T6 | #717689 | Muted / placeholder |
| Text/T4 | #C2C3CC | Disabled |
| Text/T3 | #D5D6DC | Borders |
| Text/T2 | #ECEEF0 | Surface tint |
| Text/T1 | #FFFFFF | White |
| Typography/T8 (specimen) | #354153 | Used in Typography frame body text |
| Typography/T6 (specimen) | #9EA0A4 | Used in Typography frame muted |

### Background
| Token | Hex |
|---|---|
| bg-1 | #F7F7F7 (Color section) / #FAFBFC (used in Components) |
| bg-2 | #FAFAFA (Color section) / #FFFFFF (used in Components) |
| white | #FFFFFF |

### Grays
| Token | Hex |
|---|---|
| gray-2 | #464B56 |
| Grey/700 (Components frame) | #5F6368 |

### Validation — Error (red)
| Token | Hex |
|---|---|
| Error-900 | #AC2C2B |
| Error-800 | #BC3436 |
| Error-700 | #C93A3D |
| Error-600 | #DB4343 |
| **Error-500** | **#EA4B45** |
| Error-400 | #E55A5B |
| Error-300 | #DB777B |
| Error-200 | #E79C9F |
| Error-100 | #FACED4 |
| Error-50 | #FCEDF0 |

### Validation — Success (green)
| Token | Hex |
|---|---|
| Success-900 | #1F6225 |
| Success-800 | #318137 |
| Success-700 | #3B9241 |
| Success-600 | #46A44C |
| **Success-500** | **#4FB356** |
| Success-400 | #69BF6F |
| Success-300 | #83CA88 |
| Success-200 | #A7D8AA |
| Success-100 | #C9E7CB |
| Success-50 | #E8F6EA |

### Validation — Info (blue)
| Token | Hex |
|---|---|
| Info-900 | #0F409F |
| Info-800 | #145EBE |
| Info-700 | #1770D0 |
| Info-600 | #1981E3 |
| **Info-500** | **#198FF1** |
| Info-400 | #3D9FF4 |
| Info-300 | #60B0F5 |
| Info-200 | #8DC6F8 |
| Info-100 | #BADCFB |
| Info-50 | #E2F1FD |

### Validation — Warning (orange/yellow)
| Token | Hex |
|---|---|
| Warning-900 | #FF6E01 |
| Warning-800 | #FF8E00 |
| Warning-700 | #FFA000 |
| Warning-600 | #FFB300 |
| **Warning-500** | **#FFC007** |
| Warning-400 | #FFCA28 |
| Warning-300 | #FFCA28 |
| Warning-200 | #FFE082 |
| Warning-100 | #FFECB3 |
| Warning-50 | #FFF8E1 |

## Typography

**Primary font family:** Inter (loaded via `next/font` in `layout.tsx`)
**Secondary (button only):** Roboto

### Type scale

| Style | Family | Weight | Size / line-height | Letter spacing | Use |
|---|---|---|---|---|---|
| H1 (display) | Inter | 300 (Light) | 288 / 250 | 0 | Hero / display |
| H1-60 | Inter | 700 (Bold) | 60 / 76 | 0 | Page title |
| H2-48 | Inter | 700 (Bold) | 48 / 56 | 0 | Section title |
| H3-32 | Inter | 700 (Bold) | 32 / 44 | 0 | Sub-section |
| H5-24 | Inter | 600 (Semi Bold) | 24 / 36 | 0 | Card title / "Log in" heading |
| H6-20 | Inter | 600 (Semi Bold) | 20 / 32 | 0 | List heading |
| Body1-16 | Inter | 400 (Regular) | 16 / 24 | 0 | Default body |
| Body14 | Inter | 400 (Regular) | 14 / 20 | 0 | Compact body |
| Body3-12 | Inter | 400 (Regular) | 12 / 16 | 0 | Helper / caption |
| Caption-12 | Inter | 400 (Regular) | 12 / 18 | 0 | Caption variant |
| Button | Roboto | 500 (Medium) | 14 / 16 | 1.25 | All button labels |
| Time Input | Roboto | 400 (Regular) | 56 / 64 | 0 | Time picker (special) |

## Components inventory (Components frame, 1:18918)

The Components frame contains reusable UI primitives. Notable instances:
- **froms** — input field, default 400×60 (label + input + helper)
- **Button** — primary CTA, 400×40 (full width), 160×40 (compact), 40×40 (icon-only)
- **social-login** — full-width social row, 360×48 / 400×48
- **Avatar** — 6 sizes: XXS 24, XS 28/32, S 36, M 40, L 48, XL 56 (with/without image)
- **Tooltip** — popover with arrow
- **header** — desktop nav, 1440×60
- **footer** — desktop footer, 1440×386
- **seat place** — 4 types (Econom, Default, Business, Not available) × 3 sizes (Default 36, Small 28, extra small 24)
- **Iconography** — 24×24 icon system (Material Symbols + Material Design icons)

## Implementation status

✅ **All tokens are 1:1 mapped in code:**
- `app/globals.css` — CSS variables (`--color-primary-500`, `--text-t8`, etc.)
- `tailwind.config.ts` — Tailwind utilities (`bg-primary-500`, `text-fg-t8`, etc.)
- Both `zulu-admin-next` and `zulu-frontend-next` carry identical token files

✅ **Typography:** Inter loaded via `next/font` in both apps' `layout.tsx`. Tailwind exposes `ds-h1`, `ds-h2`, … `ds-body-14`, `ds-caption-12`, `ds-button-l/m/s` text-size utilities.

⚠️ **Components are NOT yet a shared library.** Each app implements its own `<Button>`, `<Input>`, `<Avatar>` etc. matching the Figma specs. If we ever extract a shared package, it'd live at `packages/ui/` (not currently planned).

---

*This spec is the local cache. Source of truth = code. Re-fetch from Figma only if design tokens change.*
