# Quest CRM Design (Copy) — Admin layout reference

**Source:** [Figma — Quest CRM Design (Copy)](https://www.figma.com/design/bEqM5rja1g3DjRugNRPjJr/Quest-CRM-Design--Copy-)
**File key:** `bEqM5rja1g3DjRugNRPjJr`
**Cached:** 2026-05-04

This is the **admin/internal-tool layout reference** that ZULU borrows for `admin.zulu.am`. NOT a ZULU-specific design — it's a generic CRM template (Quest CRM) whose patterns we copy. Per `project_admin_design_reference.md`: brand stays ZULU purple, only the layout patterns are borrowed.

**Pages in the file (Figma left panel):**
- CRM (main)
- Mobile Application
- SLSPro Landing Page
- Draft

Most desktop pages are **1920×1080** (different from ZULU public site's 1440 — Quest CRM targets large desktop screens, suitable for admin operations).

## Layout pattern (universal across all admin pages)

Every Quest CRM desktop page uses the same shell:

| Element | Width | Notes |
|---|---|---|
| Left sidebar nav | ~250-300px | Collapsible (compare `Admin/Employees menu collapsed1920x1080`) |
| Top bar | full × 60 | Search, notifications, user menu |
| Content area | ~1572-1775 | Main work area |
| Inner card containers | 1542 | Standard card width inside content area |
| Inner content frame | 632-680 height | Standard form section height |

**Sidebar collapsed variant exists** (saves screen space when working with wide tables).

## Page inventory (grouped by domain)

### Auth (5 pages)

| Page | Purpose |
|---|---|
| Login/Registration | Sign in form |
| OTP Verification | 2FA code entry |
| Forget Password | Email submission |
| Reset Password | New password form |
| Send Account Invite | Admin invites new user |

### Dashboard (6 pages)

| Page | Purpose |
|---|---|
| Dashboard | Main admin dashboard |
| Dashboard 1920 | Wide variant |
| Employee Dashboard / my assignments | Employee tab — assignments view |
| Employee Dashboard / my cases | Employee — cases view |
| Employee Dashboard / my Requests | Employee — requests view |
| Employee Dashboard / My service | Employee — services view |

### Admin/Employees (8 pages)

| Page | Purpose |
|---|---|
| Admin/Employees 1920x1080 | Employees list table |
| Admin/Employees menu collapsed | Same with collapsed sidebar |
| Admin/Add Service Employee | New service employee form |
| Admin/Add Service Employee/Table | With employment table |
| Admin/Add none-Service Employee | Non-service employee form (2 variants) |
| Admin Employee Forms | Custom forms config |
| Admin/Employee Forms/create | Create form |
| Admin/Forms/Edit | Edit form |
| Edit Employee | Employee edit page |
| Edit Employee/Adding Emergency contact | With emergency contact modal |
| Edit Employee/Adding Employment | With employment modal (2 variants) |

### Admin/Clients (7 pages)

| Page | Purpose |
|---|---|
| Add client | New client form |
| Add Client/with service table | New client + service config |
| Add Parent client | New parent (multi-tenant) client |
| Admin client Forms | Custom forms config |
| Admin/ClientForms/create | Create client form |
| Admin/ClientForms/Edit | Edit client form |
| Client Table /1920x1080 | Clients list table |
| Parent Client Table /1920x1080 | Parent clients table |

### Admin/Services (2 pages)

| Page | Purpose |
|---|---|
| Admin/Services 1920x1080 | Services catalog |
| Admin/Edit Service 1920x1080 | Service edit form |

### Service Logs (8 pages)

| Page | Purpose |
|---|---|
| Service Log | View service log |
| Service Log Reports | Aggregate reports |
| Custom Service Log | Custom log type |
| Add Regular Service Log | Quick add |
| Create Custom Log | Create custom log |
| Create Custom Log Per Assignment/Case | Per-context log |
| Report Service Log | Submit log report |
| Service Log/3 dots Menu open | Action menu |
| Service Log/filters | Filter panel |
| Custom Service Log/3 dots Menu | Action menu |
| Custom Service Log/Filters | Filter panel |

### Cases & Assignments (5 pages)

| Page | Purpose |
|---|---|
| Project/Cases | Cases list |
| Project/Cases/Filters | With filter panel |
| View Case | Case detail |
| Edit Case/Assignment | Edit form |
| Create NewCase | New case form |
| Employee Cases | Employee's cases tab |

### Requests (6 pages)

| Page | Purpose |
|---|---|
| Requests | Requests list |
| Requests/Filters | With filter panel |
| My Requests | User's own requests |
| Create New Request | New request form |
| Review Request/Form Tab | Request review |
| Request Service logs | Linked service logs |
| View Request | Request detail |

### Invoices & Payments (10 pages)

| Page | Purpose |
|---|---|
| Invoices | Invoices list |
| Invoice Details | Single invoice |
| Invoices /Filters | Filter panel |
| Invoices /Top 3 dot menu | Action menu |
| Export Invoice | Export modal |
| Create Invoices per Assignment/Case | Generate by case |
| Create Invoices per Employee | Generate by employee |
| Create Invoices per Request | Generate by request |
| Create Invoices per Service | Generate by service |
| Invoices/Payments | Payments tab |
| Invoices/Payments/Filters | Payments filters |
| Payment/Remind form | Payment reminder |
| Payroll | Payroll page |
| Payroll Filters | Payroll filters |

### Non-service Hours (3 pages)

| Page | Purpose |
|---|---|
| Non-service Hours | List |
| Non-service Hours View | Detail |
| Non-service Hours/Filters | Filter panel |

### Settings (15 pages)

| Page | Purpose |
|---|---|
| Settings/My Profile | Personal profile |
| Settings/Company Profile | Company info |
| Settings/Company Profile/Localization | Language/currency |
| Settings/Admins | Admin users management |
| Settings/Roles | Roles list |
| Settings/Edit Roles | Role edit |
| Settings/Custom Fields | Custom fields list |
| Settings/Creating Custom Fields | Create field |
| Settings/Passwords | Password policy |
| Settings/Notifications | Notification preferences |
| Settings/PIN | PIN settings |
| Settings/Set New PIN | PIN setup |
| Settings/PIN Setup Done | PIN done |
| Settings/Reset PIN | PIN reset |
| Settings/Change or Disable PIN | PIN management |
| Settings/Subscriptions | Subscription mgmt |

### Employee Actions (4 pages)

| Page | Purpose |
|---|---|
| Employee Actions/Unverified Accounts | List of pending |
| Employee Actions/Employee block Days | Block specific days |
| Employee Actions/Send Notifications | Bulk notify |
| Employee Actions/Restore Weeks | Restore deleted |
| Set/Unset Block Days | Calendar view |
| Set/Unset Block Days/Filters | With filters |
| Send Notifications | Notify form |

### Misc (5 pages)

| Page | Purpose |
|---|---|
| Error | 404/500 page |
| Success | Generic success state |
| Note View | Note detail |
| Edit Access Status | User access mgmt |
| Table View | Generic table component |

### Mobile Application (separate page)

| Section | Notes |
|---|---|
| Admin View | Admin views on mobile |
| Employee View | Employee views on mobile |
| Admin View Redesign | Updated admin mobile |
| Employee View Redesign | Updated employee mobile |
| For App store | App Store screenshots |
| For google Play | Google Play screenshots |

## Key takeaways for ZULU admin

**Reusable patterns to borrow:**
1. **Collapsible left sidebar** at ~250px (collapses to icon-only ~64px)
2. **Top bar** with search + notifications + user menu (60px)
3. **Standard list/table pages** at 1920×1080 — use for Bookings, Users, Suppliers, Commissions in ZULU admin
4. **Slide-in filter panel** — shown on `*/Filters` variants — right-side drawer pattern
5. **3-dot menu pattern** — row-level actions on tables (`*/3 dots Menu`)
6. **Modal-in-page editing** — `Edit Employee/Adding Emergency contact` shows editing parent + opening sub-modal pattern
7. **Settings sidebar within Settings** — 15 settings pages share a Settings-specific second-level nav
8. **Form-as-page** — `Create *` pages are full-page forms, not modals. Use for ZULU's Add Booking, Add Supplier, etc.
9. **Per-X invoicing** — 4 variants of "Create Invoices per Assignment/Employee/Request/Service" — same pattern, different parent — useful for ZULU's commission/payout flows
10. **PIN flow** — 4 PIN-related pages (Set, Change, Reset, Done) — borrow if ZULU adds PIN-protected admin actions

**What NOT to borrow:**
- Quest CRM color scheme (we use ZULU purple from Zulu_1 tokens)
- Exact form field labels (Quest CRM is service-business specific; ZULU is travel)
- Service Log / Case / Assignment terminology (those are Quest CRM domain concepts)

**What to borrow as-is:**
- Layout grid (sidebar + topbar + content)
- Component shells (table layout, filter drawer, action menus, form sections)
- Icon placements
- Spacing rhythm (Quest CRM uses 32-40px between sections, 16-24px within)

## Total page count

~95 unique pages on Desktop CRM page + Mobile Application sub-pages. Far more than ZULU admin needs (~20-30 pages estimated for MVP). Cherry-pick patterns, don't replicate everything.

## Related files

- Source of truth for ZULU brand tokens: [zulu-1-components-tokens.md](zulu-1-components-tokens.md)
- ZULU public-side designs: zulu-2 through zulu-10 in this folder
- Project memory: `~/.claude/projects/D--zulu-platform/memory/project_admin_design_reference.md`

---

*This spec is the local cache. Quest CRM is a stable reference template — unlikely to change. Re-fetch only if the layout grid changes.*
