# ZULU Admin Panel — Audit Report

**Generated:** 2026-05-25
**Project:** zulu-admin-next (Next.js)
**Purpose:** Inventory of all admin pages for ZuluSpin design migration

> **Read this first.** This file is a complete, read-only inventory of every page that exists today in `zulu-admin-next`. No design opinions, no recommendations — just "what is there." Page names match the labels that appear in the running admin's sidebar (English, with Armenian fallback labels where seeded).

---

## 1. Tech Stack

- **Framework:** Next.js 14.2.35
- **Routing:** App Router (`app/` directory, route groups: `(admin)`)
- **Language:** TypeScript 5 + React 18
- **UI Library:** Custom in-house components (`components/ui/` + `components/ui/v2/`). No shadcn/MUI/Mantine. Built on Tailwind CSS 3.4 + `tailwind-merge` + `clsx`. Lucide-react icons.
- **State:** React Context only (`AdminAuthContext`, `LanguageContext`). No Zustand / Redux / React Query — data fetched via `useEffect` + plain `fetch` wrapped by per-domain helpers in `lib/*-api.ts`.
- **Rich text:** TipTap 3 (used in CMS page editor).
- **Spreadsheet:** ExcelJS (used for hotels XLSX import).
- **API:** REST. Base URL via `process.env.NEXT_PUBLIC_API_URL`, default `/api`. Bearer auth (token from `AdminAuthContext`). Backend is Laravel hosted at `https://api.zulu.am`.
- **Monitoring:** Sentry (`@sentry/nextjs` 10).
- **Tests:** Playwright (`tests-e2e/`) + axe-core for a11y.
- **Theming:** Two themes (light/dark) via `data-theme` on `<html>`. Brand color = ZULU purple (`--admin-primary`).
- **Languages:** EN / HY / RU (per-user via `LanguageContext`).

---

## 2. Sidebar / Navigation Structure

The sidebar uses an **8-section IA** (introduced 2026-05-24) with 5 v2-redesign auxiliary groups inserted after Marketplace ops. Settings was moved from position #8 to the last position (#13). The configuration lives in [`lib/admin-nav-config.ts`](lib/admin-nav-config.ts), with the active group resolved by `findActiveGroup(pathname)`. Visibility is filtered by role/permission predicates in [`lib/access.ts`](lib/access.ts).

**Top header (global, every page):** Logo + page title • global search (visual only) • language switcher (EN/HY/RU flag pills) • Open frontend website (external link) • Theme toggle (light/dark) • Notifications bell (red-dot when unread) • Apps grid (6 quick links) • User avatar dropdown (profile/logout).

### Sidebar groups (in order)

- 📊 **Dashboard** (`section_dashboard`) — `/dashboard`
- 🏨 **Inventory** (`section_inventory`) — operator-side tabs
  - Hotels → `/operator/hotels`
  - Flights → `/operator/flights`
  - Transfers → `/operator/transfers`
  - Cars → `/operator/cars`
  - Excursions → `/operator/excursions`
  - Visas → `/operator/visas`
  - Packages → `/operator/packages`
  - Offers → `/operator/offers`
  - Packages oversight → `/platform/packages` (super-admin only)
- 📅 **Bookings** (`section_bookings`)
  - All bookings → `/platform/bookings`
  - Package orders → `/platform/package-orders`
- 🧾 **Sales workspace** (`section_sales_workspace`, agent role)
  - My contracts → `/agent/contracts`
- 💰 **Finance** (`section_finance`)
  - Finance summary → `/platform/finance-summary`
  - Invoices → `/platform/invoices`
  - Payments → `/platform/payments`
  - Commissions ledger → `/platform/commissions`
  - Transactions → `/platform/finance`
  - Vouchers → `/platform/vouchers`
- 🏢 **My company** (`section_my_company`, internal CRM)
  - Employees → `/bucket3/employees`
  - Payroll → `/bucket3/payroll`
  - Non-service hours → `/bucket3/non-service-hours`
  - Cases → `/bucket3/cases`
  - Bulk notifications → `/bucket3/bulk-notifications`
  - PIN settings → `/bucket3/pin-settings`
  - Customers → `/bucket3/customers`
  - Subscriptions → `/bucket3/subscriptions`
  - Per-X invoicing → `/bucket3/per-x-invoicing`
- 🛡️ **Marketplace ops** (`section_marketplace_ops`, super-admin only)
  - Approval queue → `/platform/approvals`
  - Companies & access → `/platform/companies`
  - Seller applications → `/platform/seller-applications`
  - Users → `/platform/users`
  - Partnership agreements → `/platform/contracts`
  - Contract templates → `/platform/contract-templates`
  - Audit logs → `/platform/audit-logs`
  - Service logs → `/bucket3/service-logs`
  - Unverified accounts → `/bucket3/unverified-accounts`
- 👥 **Users** (v2 redesign) — `/admin-redesign/users` _(badge: pending users count)_
- 🔐 **Roles & permissions** (v2 redesign) — `/platform/rbac`
- 📁 **File manager** (v2 redesign) — `/admin-redesign/files`
- 👤 **My profile** (v2 redesign) — `/admin-redesign/profile`
- 🔔 **Notifications** (v2 redesign) — `/admin-redesign/notifications` _(badge: unread count, amber)_
- ⚙️ **Settings** (`section_settings`, mixed visibility)
  - Pricing rules → `/settings/pricing-rules`
  - Money flow → `/settings/money-flow` (super-admin)
  - Exchange rates → `/settings/exchange-rates`
  - RBAC → `/platform/rbac`
  - Languages → `/localization/languages` (super-admin)
  - UI strings → `/localization/ui-translations` (super-admin)
  - Content translations → `/localization/translations`
  - Email templates → `/localization/templates`
  - Banners → `/platform/banners` (super-admin)
  - CMS pages → `/pages`
  - System notifications → `/platform/notifications`
  - Newsletter → `/platform/newsletter`
  - Header menu → `/platform/settings/header-menu` (super-admin)
  - Footer → `/platform/settings/footer` (super-admin)
  - Loyalty programs → `/platform/loyalty`
  - Block dates → `/bucket3/block-dates`
  - Custom fields → `/bucket3/custom-fields`
  - Service catalog → `/bucket3/service-catalog`
  - Security → `/platform/security` (super-admin)
  - Webhooks → `/platform/webhooks` (super-admin)
  - Locations → `/platform/locations` (super-admin)
  - API docs → `/platform/api-docs` (super-admin)
  - Brand settings → `/platform/settings/brand` (super-admin)
  - Connections → `/connections`
  - Support → `/support/tickets`
  - Reviews → `/platform/reviews`

> **Note.** Inventory has a super-admin "scope toggle" that swaps between `/operator/*` (my company) and `/inventory/*` (all-companies oversight). Several pages are accessible from multiple sidebar paths.

---

## 3. Pages — Full Inventory

96 page files total (excluding `layout.tsx`, `providers.tsx`, sub-components).

### 3.1. Home (Root Redirect)
- **Route:** `/`
- **File:** `app/page.tsx`
- **Purpose:** Root redirect that sends every visitor to `/login` server-side. Avoids a blank loading state if JS fails.
- **Type:** Auth
- **Main UI elements:** — (server-side redirect only)
- **Data source:** —
- **Permissions:** —
- **Notes:** Uses Next.js `redirect()`. Handles both logged-in and anonymous users uniformly.

---

### 3.2. Login
- **Route:** `/login`
- **File:** `app/login/page.tsx`
- **Purpose:** Admin login form (email + password + remember-me + forgot-password link). Redirects authenticated users to `/dashboard`.
- **Type:** Auth
- **Main UI elements:**
  - Filters: —
  - Table columns: —
  - Action buttons: Sign in
  - Modals/dialogs: —
- **Data source:** `apiLogin` (via `AdminAuthContext`)
- **Permissions:** —
- **Notes:** Figma reference: Quest CRM Copy template (4299:7448 desktop, 10171:23225 mobile). Remember-me is currently UI-only.

---

### 3.3. Forgot password
- **Route:** `/forgot-password`
- **File:** `app/forgot-password/page.tsx`
- **Purpose:** Email entry to request a password-reset link. Shows confirmation message + spam warning after submit.
- **Type:** Auth
- **Main UI elements:**
  - Action buttons: Send link
- **Data source:** `POST /forgot-password`
- **Permissions:** —
- **Notes:** Two-state UI (form → confirmation).

---

### 3.4. Reset password
- **Route:** `/reset-password`
- **File:** `app/reset-password/page.tsx`
- **Purpose:** Password reset form (min 8 chars + confirmation) accessed via email link (`?token=…&email=…`).
- **Type:** Auth
- **Main UI elements:**
  - Action buttons: Submit, Go to login
- **Data source:** `POST /reset-password`
- **Permissions:** —
- **Notes:** Auto-redirects to `/login` after 2.5s on success. Wrapped in Suspense.

---

### 3.5. SSO
- **Route:** `/sso`
- **File:** `app/sso/page.tsx`
- **Purpose:** Single sign-on hand-off endpoint for cross-domain auth (zulu.am → admin.zulu.am). Validates token, stores in localStorage, redirects to target.
- **Type:** Auth
- **Main UI elements:** — (spinner only)
- **Data source:** `apiMe()` for token validation
- **Permissions:** —
- **Notes:** Bad/expired token redirects silently to `/login`. URL params: `?token=XXX&next=/path`.

---

### 3.6. Dashboard
- **Route:** `/dashboard`
- **File:** `app/(admin)/dashboard/page.tsx`
- **Purpose:** Platform-admin overview with hero stat cards (bookings, operators, revenue) and widgets (booking overview, monthly earnings, approvals, order summary, recent activity, top operators, active offers).
- **Type:** Dashboard
- **Main UI elements:**
  - Filters: Date range (7/30/90 days via select dropdown)
  - Table columns: User, Action, Resource, Time, Status (Recent Activity table)
  - Action buttons: Export, Date-range selector
  - Modals/dialogs: —
- **Data source:** `apiPlatformStats`, `/platform-admin/statistics/dashboard`, `/platform-admin/audit-logs`, `/platform-admin/statistics/sellers`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Phase 1 visual refresh (2026-05-23). Many cells render "—" gracefully if a backend stat is missing. Responsive 1/2/3-col grid.

---

### 3.7. Operator Statistics
- **Route:** `/statistics`
- **File:** `app/(admin)/statistics/page.tsx`
- **Purpose:** Operator-scope statistics viewer. Super-admins can query any `company_id`, non-super users auto-load their `active_company`.
- **Type:** Detail
- **Main UI elements:**
  - Filters: Company ID input (super-admin only)
  - Action buttons: Load, Export
- **Data source:** `apiOperatorStatistics(token, companyId)`
- **Permissions:** `operator_statistics_platform_scope` (super-admin only)
- **Notes:** Currently displays raw JSON in a `<pre>` block — not a polished surface.

---

### 3.8. Notifications (Platform inbox)
- **Route:** `/notifications`
- **File:** `app/(admin)/notifications/page.tsx`
- **Purpose:** Paginated notification inbox with status/priority/event filters, mark-all-read, per-row mark-read.
- **Type:** Inbox
- **Main UI elements:**
  - Filters: status, priority, event
  - Table columns: ID, Status, Priority, Event, Title, Message, Company, Created, Actions
  - Action buttons: Export CSV, Mark all as read, Mark read (per row)
  - Modals/dialogs: —
- **Data source:** `apiNotificationsPaginated`, `apiNotificationsUnreadCount`, `apiNotificationMarkRead`, `apiNotificationsMarkAllRead`
- **Permissions:** `canAccessNotificationsNav`
- **Notes:** Paginated 20 rows/page. Unread count in subtitle.

---

### 3.9. Users (v2 redesign list)
- **Route:** `/admin-redesign/users`
- **File:** `app/(admin)/admin-redesign/users/page.tsx`
- **Purpose:** Platform users list with search, type filter, stat cards (total, active today, new 7d, pending). Avatars + status pills + companies as badges.
- **Type:** List
- **Main UI elements:**
  - Filters: Search (name/email/ID), Type (all / customers / staff / unverified)
  - Table columns: Checkbox, ID, Name + avatar, Email, Status, Companies, Actions
  - Action buttons: Export CSV (client-side), Add user
  - Modals/dialogs: —
- **Data source:** `apiPlatformUsers`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** v2 redesign 2026-05-24. Stat cards initially counted page rows; `/platform-admin/users/stats` endpoint now returns true platform-wide counts. Links to v1 `/platform/users` for delete/anonymize.

---

### 3.10. My profile (v2 redesign)
- **Route:** `/admin-redesign/profile`
- **File:** `app/(admin)/admin-redesign/profile/page.tsx`
- **Purpose:** User profile with hero card + 5-tab content (Overview / Settings / Security / Activity / Sessions). Edit profile, manage PIN, change password, view storage and session activity.
- **Type:** Profile
- **Main UI elements:**
  - Filters: —
  - Table columns: Activity (User/Action/Resource/Time/Status), Sessions (name / created / last used / expires / current pill)
  - Action buttons: Message (mailto), Edit profile, Manage PIN, Change password, Revoke session
  - Modals/dialogs: Edit profile Drawer, Change password Drawer
- **Data source:** `/account/profile`, `/account/activity`, `/account/pin`, `/account/sessions`, `/account/change-password`, `apiFilesStorageStats`
- **Permissions:** Authenticated user
- **Notes:** 5 tabs with real content (no placeholders). Edit drawer includes name, phone, location, language. Activity chart = 29-day histogram.

---

### 3.11. File manager (v2 redesign)
- **Route:** `/admin-redesign/files`
- **File:** `app/(admin)/admin-redesign/files/page.tsx`
- **Purpose:** File manager with folder navigation, search, upload, new-folder creation. Sidebar shows My files / Recent / Trash + storage meter.
- **Type:** List
- **Main UI elements:**
  - Filters: Quick access (All / Recent / Trash), Search
  - Table columns: Name (icon + MIME + visibility), Owner (initials avatar), Size, Modified, Actions
  - Action buttons: New folder, Upload files, Download (per row), Delete (per row)
  - Modals/dialogs: Folder-name prompt, Delete confirmation
- **Data source:** `apiFilesList`, `apiFilesUpload`, `apiFilesDownload`, `apiFilesCreateFolder`, `apiFilesDelete`, `apiFilesStorageStats`
- **Permissions:** Authenticated user
- **Notes:** v2 redesign 2026-05-25. Local Laravel disk default; 50 MB per file. `.php`/`.exe`/`.bat` blocked server-side. Trash section is a placeholder for future soft-delete recovery.

---

### 3.12. Notifications (v2 redesign inbox)
- **Route:** `/admin-redesign/notifications`
- **File:** `app/(admin)/admin-redesign/notifications/page.tsx`
- **Purpose:** Inbox-style v2 notifications with date-grouped sections (Today / Yesterday / This week / Earlier) and tab filtering.
- **Type:** Inbox
- **Main UI elements:**
  - Filters: Tabs (All / Unread / Mentions / System)
  - Table columns: Avatar (icon + tone), Title, Message, Channel pills, Timestamp, Unread dot, Mark as read
  - Action buttons: Mark all as read, Preferences (links to profile)
  - Modals/dialogs: —
- **Data source:** `/notifications/paginated`, `/notifications/read-all`, `/notifications/{id}/read`, `/notifications/unread-count`
- **Permissions:** Authenticated user
- **Notes:** Classification by `type/event_type` → icon (calendar / alert / receipt / user-plus / shield-x / edit / bell) + tone (purple / teal / amber / blue). Optimistic updates.

---

### 3.13. Operator: Hotels
- **Route:** `/operator/hotels`
- **File:** `app/(admin)/operator/hotels/page.tsx`
- **Purpose:** Operator-side CRUD for hotel inventory with rooms, pricing, facilities, translations. Supports XLSX import/export.
- **Type:** List + Form
- **Main UI elements:**
  - Filters: Content language selector
  - Table columns: ID, Hotel name, City, Country, Star rating, Status, Actions
  - Action buttons: Add, Edit, Delete, Submit for review, Export CSV, Import template (XLSX)
  - Modals/dialogs: `HotelsXlsxImportModal` (lazy-loaded)
- **Data source:** `apiHotels`, `apiGetHotel`, `apiCreateHotel`, `apiUpdateHotel`, `apiDeleteHotel`
- **Permissions:** operator, `serviceType=hotel`
- **Notes:** Multi-section collapsible form with nested rooms / pricing rows. Translations tab in edit mode.

---

### 3.14. Operator: Flights
- **Route:** `/operator/flights`
- **File:** `app/(admin)/operator/flights/page.tsx`
- **Purpose:** Operator-side flight CRUD with cabin classes, schedule, policies, visibility settings.
- **Type:** List + Form
- **Main UI elements:**
  - Filters: Content language
  - Table columns: ID, Flight code, Route, Departure, Review status, Operational status, Actions
  - Action buttons: Add, Edit, Delete, Submit for review, Export CSV, Import CSV
  - Modals/dialogs: `CsvImportModal`
- **Data source:** `apiFlights`, `apiFlight`, `apiCreateFlight`, `apiUpdateFlight`, `apiDeleteFlight`, `apiFlightCabins*`
- **Permissions:** operator, `serviceType=flight`
- **Notes:** 8-section collapsible form (general, departure, arrival, schedule, ages, cabins, policies, visibility). Nested cabin rows. `diffFlightCabins` syncs via dedicated endpoints.

---

### 3.15. Operator: Flight cabin seat maps
- **Route:** `/operator/flights/[id]/cabins`
- **File:** `app/(admin)/operator/flights/[id]/cabins/page.tsx`
- **Purpose:** Visual seat map editor for a flight's cabin classes. Lists all cabins; click loads its seat map editor.
- **Type:** Detail / Editor
- **Main UI elements:**
  - Table columns: ID, Class, Seats available, Adult price, Seat map status, Action
  - Action buttons: Edit seat map (per cabin), Back to flights
  - Modals/dialogs: `SeatMapEditor`
- **Data source:** `apiFlight`, `apiFlightCabins`, `apiFlightCabinSeatMap`, `apiUpsertFlightCabinSeatMap`
- **Permissions:** operator
- **Notes:** Cabin selector above editor; breadcrumb back to flight.

---

### 3.16. Operator: Transfers
- **Route:** `/operator/transfers`
- **File:** `app/(admin)/operator/transfers/page.tsx`
- **Purpose:** Operator CRUD for point-to-point transfers via a 5-step wizard (general → route → vehicle → pricing → publication).
- **Type:** List + Wizard form
- **Main UI elements:**
  - Filters: Content language
  - Table columns: ID, Title, Vehicle category, Route (pickup → dropoff), Base price, Offer status, Actions
  - Action buttons: Add, Edit, Delete, Submit for review, Export CSV, Import CSV
  - Modals/dialogs: `CsvImportModal`
- **Data source:** `apiTransfers`, `apiGetTransfer`, `apiCreateTransfer`, `apiUpdateTransfer`, `apiDeleteTransfer`
- **Permissions:** operator
- **Notes:** Review step summarises all wizard fields. `LocationCascadeSelect` for country/city.

---

### 3.17. Operator: Cars
- **Route:** `/operator/cars`
- **File:** `app/(admin)/operator/cars/page.tsx`
- **Purpose:** Operator CRUD for car-rental inventory with vehicle specs, pricing modes (mileage, cross-border, radius), advanced options (child seats, services).
- **Type:** List + Form
- **Main UI elements:**
  - Filters: Content language
  - Table columns: ID, Vehicle info (brand, model), Category, Route, Price, Offer status, Actions
  - Action buttons: Add, Edit, Delete, Submit for review, Export CSV, Import CSV
  - Modals/dialogs: `CsvImportModal`
- **Data source:** `apiCars`, `apiCreateCar`, `apiUpdateCar`, `apiDeleteCar`, `apiOffers`
- **Permissions:** operator
- **Notes:** Auto-creates an offer if none exists. One-car-per-offer constraint. ~1886 lines — deep v2 chrome.

---

### 3.18. Operator: Excursions
- **Route:** `/operator/excursions`
- **File:** `app/(admin)/operator/excursions/page.tsx`
- **Purpose:** Tour / excursion management with a 5-step wizard (location → categories → tour info → policies → pricing). `price_by_dates` table.
- **Type:** List + Wizard form
- **Main UI elements:**
  - Filters: Content language
  - Table columns: ID, Tour name (avatar), Location (badge), Duration, Group size, Price, Offer status, Actions
  - Action buttons: Add, Edit, Delete, Submit for review, Export CSV, Import CSV
  - Modals/dialogs: `CsvImportModal`
- **Data source:** `apiExcursions`, `apiCreateExcursion`, `apiUpdateExcursion`, `apiDeleteExcursion`
- **Permissions:** operator
- **Notes:** Dynamic photos/includes arrays. `visibility_rule`: show_all / show_accepted_only / hide_rejected.

---

### 3.19. Operator: Visas
- **Route:** `/operator/visas`
- **File:** `app/(admin)/operator/visas/page.tsx`
- **Purpose:** Visa service CRUD with processing days, dual pricing (visa price + offer price), required documents.
- **Type:** List + Form
- **Main UI elements:**
  - Filters: Content language
  - Table columns: ID, Country, Visa type, Visa price, Offer price, Processing days, Offer status, Actions
  - Action buttons: Add, Edit, Delete, Submit for review, Export CSV, Import CSV
  - Modals/dialogs: `CsvImportModal`
- **Data source:** `apiVisas`, `apiGetVisa`, `apiCreateVisa`, `apiUpdateVisa`, `apiDeleteVisa`
- **Permissions:** operator, `serviceType=visa`
- **Notes:** `required_documents` as newline-separated text.

---

### 3.20. Operator: Packages
- **Route:** `/operator/packages`
- **File:** `app/(admin)/operator/packages/page.tsx`
- **Purpose:** Multi-service travel packages with destination, duration, pricing, featured flag. Activate/deactivate + submit for review.
- **Type:** List + Form
- **Main UI elements:**
  - Filters: Status (draft / active / inactive / archived)
  - Table columns: ID, Title, Package type, Destination country, Duration (days), Review status, Company, Actions
  - Action buttons: Add, Edit, Delete, Activate / Deactivate (power), Submit for review
- **Data source:** `apiPackages`, `apiCreatePackage`, `apiUpdatePackage`, `apiDeletePackage`, `apiActivatePackage`, `apiDeactivatePackage`
- **Permissions:** operator
- **Notes:** Inline form. `LatLngFields`, `MainImageDescriptionFields`. `is_featured` checkbox.

---

### 3.21. Operator: Offers
- **Route:** `/operator/offers`
- **File:** `app/(admin)/operator/offers/page.tsx`
- **Purpose:** View offers (the contracts linking inventory items to pricing). Publish/archive workflow; multilingual.
- **Type:** List
- **Main UI elements:**
  - Filters: Status (draft / published / archived), Refresh
  - Table columns: ID, Title, Type, Price, Status, Company, Actions
  - Action buttons: Publish (draft), Archive (published), Translations
  - Modals/dialogs: `TranslationsModal`
- **Data source:** `apiOffers`, `apiPublishOffer`, `apiArchiveOffer`
- **Permissions:** operator
- **Notes:** Read-only CRUD — publish/archive are the only state changes.

---

### 3.22. Operator: Commission settings
- **Route:** `/operator/commission-settings`
- **File:** `app/(admin)/operator/commission-settings/page.tsx`
- **Purpose:** Configure default and per-agent commission percentages + calculation base (gross / post-platform-fee / custom).
- **Type:** Settings
- **Main UI elements:**
  - Table columns: Agent ID, Agent name, Calculation base, Percentage, Notes, Actions (Remove)
  - Action buttons: Save default, Add override (Save)
  - Modals/dialogs: Confirmation
- **Data source:** `apiCommissionSettings`, `apiUpsertCommissionDefault`, `apiUpsertCommissionOverride`, `apiDeleteCommissionOverride`
- **Permissions:** operator
- **Notes:** Sidebar link was moved to Settings → Pricing rules in the 8-IA spec, but the page still exists at this route.

---

### 3.23. Operator: External API
- **Route:** `/operator/external-api`
- **File:** `app/(admin)/operator/external-api/page.tsx`
- **Purpose:** Placeholder UI for connecting an operator account to an external inventory base. Credential entry + connection test.
- **Type:** Settings / Integration
- **Main UI elements:**
  - Action buttons: Test connection, Import inventory (conditional), Disconnect
- **Data source:** fake endpoints (visual only)
- **Permissions:** operator
- **Notes:** **Placeholder — explicit "no live integration yet" warning banner.** No server-side credential persistence.

---

### 3.24. Operator: Contracts (list)
- **Route:** `/operator/contracts`
- **File:** `app/(admin)/operator/contracts/page.tsx`
- **Purpose:** Seller-side contracts list (agent agreements + sales contracts) with sign or view-detail.
- **Type:** List
- **Main UI elements:**
  - Filters: Status (sent / signed_by_a / …), Type, Refresh
  - Table columns: Contract #, Type, Status, Counterparty (Party A ↔ Party B), Template, Effective, Expiry, Actions
  - Action buttons: Sign (if signable), View detail
- **Data source:** `apiSellerContracts`, `apiSellerSignContract`
- **Permissions:** operator
- **Notes:** No backend pagination; filtered client-side.

---

### 3.25. Operator: Contract detail
- **Route:** `/operator/contracts/[id]`
- **File:** `app/(admin)/operator/contracts/[id]/page.tsx`
- **Purpose:** Read full contract details (parties, schedule, template, clauses, versions, signed PDF). Seller can sign if status permits.
- **Type:** Detail
- **Main UI elements:**
  - Action buttons: Back, Sign (conditional)
- **Data source:** `apiSellerContract`, `apiSellerSignContract`
- **Permissions:** operator
- **Notes:** JsonBlock for commission/payment/cancellation clauses. Signed PDF download link. Version history list.

---

### 3.26. Inventory (oversight): Hotels
- **Route:** `/inventory/hotels`
- **File:** `app/(admin)/inventory/hotels/page.tsx`
- **Purpose:** Cross-company hotel oversight with advanced multi-phase filters (company / location / pricing / availability).
- **Type:** List
- **Main UI elements:**
  - Filters: Company ID, City, Country, Lifecycle status, Availability status, Package eligible, Free cancellation, Min/Max price, Room type, Invoice ID, Date, User email (phased)
  - Table columns: ID, Company ID, Hotel name, City, Country, Lifecycle status, Starting price + currency, Offer title
  - Action buttons: Apply filters, Clear filters
- **Data source:** `InventoryOversightList` component, segment `"hotels"`
- **Permissions:** `hotels.view`
- **Notes:** Filter phases progressively reveal advanced criteria.

---

### 3.27. Inventory (oversight): Flights
- **Route:** `/inventory/flights`
- **File:** `app/(admin)/inventory/flights/page.tsx`
- **Purpose:** Cross-company flight oversight with route, date range, cabin class, price filters.
- **Type:** List
- **Main UI elements:**
  - Filters: Company ID, Departure/Arrival city, Departure/Arrival airport code, Departure date from/to, Status, Cabin class, Min/Max price
  - Table columns: ID, Company name, Route, Departure time, Status, Offer title
  - Action buttons: Apply, Clear
- **Data source:** `InventoryOversightList` segment `"flights"`
- **Permissions:** `flights.view`
- **Notes:** Status filter uses UI status labels.

---

### 3.28. Inventory (oversight): Transfers
- **Route:** `/inventory/transfers`
- **File:** `app/(admin)/inventory/transfers/page.tsx`
- **Purpose:** Cross-company transfer oversight with pickup/dropoff, vehicle category, date, pricing filters.
- **Type:** List
- **Main UI elements:**
  - Filters: Company, Status, Country, City, Fleet, Origin, Destination, Vehicle category, Trip date, Passenger count, User email, Order number, Invoice ID, Min/Max price
  - Table columns: ID, Company, Transfer title, Pickup city, Dropoff city, Transfer type, Status, Offer title
- **Data source:** `InventoryOversightList` segment `"transfers"`
- **Permissions:** `transfers.view`
- **Notes:** Supports order number + passenger count filters.

---

### 3.29. Inventory (oversight): Cars
- **Route:** `/inventory/cars`
- **File:** `app/(admin)/inventory/cars/page.tsx`
- **Purpose:** Cross-company car oversight with multi-phase filters (location / pricing / rental dates / availability).
- **Type:** List
- **Main UI elements:**
  - Filters: Company, Country, City, Fleet, Origin, Destination, Status, Availability, Min/Max price (Phase 1), Invoice ID, Booking date, Rental date, Rental from/to (Phase 2), User email (Phase 3)
  - Table columns: ID, Company, Pickup location, Dropoff location, Fleet, Vehicle class, Base price, Status, Offer title
- **Data source:** `InventoryOversightList` segment `"cars"`
- **Permissions:** `cars.view`
- **Notes:** Four-phase progressive filter UI.

---

### 3.30. Inventory (oversight): Excursions
- **Route:** `/inventory/excursions`
- **File:** `app/(admin)/inventory/excursions/page.tsx`
- **Purpose:** Cross-company excursion oversight with phased filtering (location / dates / pricing / order tracking).
- **Type:** List
- **Main UI elements:**
  - Filters: Company, Location, Country/City/Category, Date overlap/from/to/Status, Order number/Invoice/Email, Min/Max price (4 phases)
  - Table columns: ID, Company, Country, City, Category, Location, Duration, Group size, Price, Status, Offer title
- **Data source:** `InventoryOversightList` segment `"excursions"`
- **Permissions:** `excursions.view`
- **Notes:** Supports date-overlap queries.

---

### 3.31. Agent contracts (list)
- **Route:** `/agent/contracts`
- **File:** `app/(admin)/agent/contracts/page.tsx`
- **Purpose:** Re-exports `/operator/contracts` to keep agent-side surfaces in lock-step with operator-side.
- **Type:** List (re-export)
- **Notes:** Thin wrapper — same component as 3.24.

---

### 3.32. Agent contract detail
- **Route:** `/agent/contracts/[id]`
- **File:** `app/(admin)/agent/contracts/[id]/page.tsx`
- **Purpose:** Re-exports `/operator/contracts/[id]` for the agent side.
- **Type:** Detail (re-export)
- **Notes:** Thin wrapper — same component as 3.25.

---

### 3.33. Connections
- **Route:** `/connections`
- **File:** `app/(admin)/connections/page.tsx`
- **Purpose:** Manage product connections (e.g. flight-to-hotel) with create / accept / reject / cancel actions.
- **Type:** List
- **Main UI elements:**
  - Filters: Status (pending/accepted/rejected/canceled), Source type, Target type, Company ID (super-admin), Client targeting
  - Table columns: ID, Source (type#id), Target (type#id), Connection type (only/both), Status, Company, Client targeting, Created, Actions
  - Action buttons: Accept, Reject (with notes), Cancel (with notes), Export, Create connection
  - Modals/dialogs: Create-connection form with client multi-select; Notes prompts for reject/cancel
- **Data source:** `apiConnectionsList`, `apiConnectionCreate`, `apiConnectionAccept`, `apiConnectionReject`, `apiConnectionCancel`, `apiCompanyClients`
- **Permissions:** `canAccessConnectionsNav`
- **Notes:** Super-admin can filter by any company. Client selection loads dynamically with search.

---

### 3.34. Support tickets (list)
- **Route:** `/support/tickets`
- **File:** `app/(admin)/support/tickets/page.tsx`
- **Purpose:** Support tickets with filters for status, priority, search. Users shown with deterministic-color avatars.
- **Type:** List
- **Main UI elements:**
  - Filters: Status, Priority, Search subject/text, Company ID (super-admin)
  - Table columns: ID, Subject, Status, Priority, Company ID, User (avatar + ID), Message count, View
  - Action buttons: View, Export
- **Data source:** `apiSupportTickets`
- **Permissions:** `canAccessSupportNav`
- **Notes:** Avatar tone (purple/teal/amber/blue) by user ID modulo.

---

### 3.35. Support ticket detail
- **Route:** `/support/tickets/[id]`
- **File:** `app/(admin)/support/tickets/[id]/page.tsx`
- **Purpose:** Full ticket conversation with status/priority pills, metadata, inline admin reply form.
- **Type:** Detail
- **Main UI elements:**
  - Filters: Company ID (super-admin)
  - Action buttons: Send reply, Reload
- **Data source:** `apiSupportTicket`, `apiSupportTicketReply`
- **Permissions:** `canAccessSupportNav`
- **Notes:** Messages color-coded admin vs user. Max 5000 chars per reply.

---

### 3.36. CMS pages (list)
- **Route:** `/pages`
- **File:** `app/(admin)/pages/page.tsx`
- **Purpose:** CMS pages with name/slug + status toggle. Add-page modal with auto-slugify.
- **Type:** List
- **Main UI elements:**
  - Table columns: S/N, Name (avatar), Status (dot + label), Published toggle, Created (relative), Actions
  - Action buttons: Add new page, Export, View, Edit, Delete
  - Modals/dialogs: Add Page modal
- **Data source:** `apiAdminPages`, `apiCreateAdminPage`, `apiDeleteAdminPage`, `apiPatchAdminPageStatus`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Auto-slugify unless user edits.

---

### 3.37. CMS page editor
- **Route:** `/pages/[id]/edit`
- **File:** `app/(admin)/pages/[id]/edit/page.tsx`
- **Purpose:** Full page editor with multi-language support, SEO metadata, widget management. 18 widget types.
- **Type:** Form
- **Main UI elements:**
  - Filters: Active-language selector with "copy from default" buttons
  - Action buttons: Publish/Draft toggle, View page, Add/Edit/Delete widget, Toggle widget status, Copy widget from default
- **Data source:** `apiAdminPage`, `apiAdminLanguages`, `apiAddAdminPageWidget`, `apiUpdateAdminPageWidget`, `apiDeleteAdminPageWidget`, `apiPatchAdminPage`, `apiPatchAdminPageStatus`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Default language edits hit the page; non-default writes to translations. Widget position + card-number tracked. Uses TipTap rich text editor.

---

### 3.38. Platform: Companies
- **Route:** `/platform/companies`
- **File:** `app/(admin)/platform/companies/page.tsx`
- **Purpose:** Cross-platform companies list with governance status, seller flags, permissions. Approve/reject + archive/restore.
- **Type:** List
- **Main UI elements:**
  - Filters: governance_status, is_seller, archive_filter (active/archived/all)
  - Table columns: ID, Name, Type, Status, Governance, Seller (count), Actions
  - Action buttons: Approve, Reject, Save governance, Permissions, Toggle seller, Partner settings, Translations, Archive, Restore
  - Modals/dialogs: Permissions modal, Translations modal, Partner settings modal
- **Data source:** `apiPlatformCompanies`, `apiCompanyApplications`, `apiCompanySellerPermissions`, `apiCompanyCountryPermissions`, locations API
- **Permissions:** `canAccessPlatformAdminNav`; archive/restore = super-admin
- **Notes:** Pending applications surfaced at top of list. Country-permission sync.

---

### 3.39. Platform: Company detail
- **Route:** `/platform/companies/[id]`
- **File:** `app/(admin)/platform/companies/[id]/page.tsx`
- **Purpose:** View and edit a company with tabs for profile, users, applications, permissions, partner, commission, translations.
- **Type:** Detail / Form
- **Main UI elements:**
  - Tab tables: Users (ID, Name, Email, Role, Status), Applications (ID, Email, Status, Submitted)
  - Action buttons: Save governance, Toggle seller, Deactivate, Edit translations, Edit partner settings
  - Modals/dialogs: Partner settings modal, Translations modal
- **Data source:** `apiPlatformCompany`, `apiPlatformUsers`, `apiCompanyApplications`, `CompanyCommissionTab`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Lazy-loaded tabs. Language switch EN/HY/RU. Commission tab via separate component.

---

### 3.40. Platform: Company module permissions
- **Route:** `/platform/companies/[id]/module-permissions`
- **File:** `app/(admin)/platform/companies/[id]/module-permissions/page.tsx`
- **Purpose:** Super-admin only — toggle which admin modules (inventory.*, ops.*) a company can see.
- **Type:** Settings / Form
- **Main UI elements:**
  - Table columns: Module key, is_allowed, description
  - Action buttons: Save changes, Cancel
- **Data source:** `apiCompanyModulePermissions`, `apiPatchCompanyModulePermissions`
- **Permissions:** `canAccessSuperAdminOnlyPlatformNav`
- **Notes:** Default-allow model — explicit denies are stored.

---

### 3.41. Platform: Company applications
- **Route:** `/platform/company-applications`
- **File:** `app/(admin)/platform/company-applications/page.tsx`
- **Purpose:** Company-registration applications list with status filter.
- **Type:** List
- **Main UI elements:**
  - Filters: status (pending / under_review / approved / rejected)
  - Table columns: ID, Company, Role, Email, Status, Submitted, Actions
  - Action buttons: Open detail
- **Data source:** `apiCompanyApplications`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Avatar + initials. Role inference (agent / operator / —).

---

### 3.42. Platform: Company application detail
- **Route:** `/platform/company-applications/[id]`
- **File:** `app/(admin)/platform/company-applications/[id]/page.tsx`
- **Purpose:** View an application + approve/reject if pending or under_review.
- **Type:** Detail
- **Main UI elements:**
  - Action buttons: Approve, Reject (rejection reason required)
- **Data source:** `apiCompanyApplication`, `apiApproveCompanyApplication`, `apiRejectCompanyApplication`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Two-column detail layout. 404-safe.

---

### 3.43. Platform: Users (v1)
- **Route:** `/platform/users`
- **File:** `app/(admin)/platform/users/page.tsx`
- **Purpose:** V1 platform users list (kept for delete/anonymize flows the v2 redesign page doesn't yet host).
- **Type:** List
- **Main UI elements:**
  - Filters: type (customers/staff/unverified), Search
  - Table columns: ID, Name, Email, Status, Companies, Actions
  - Action buttons: Edit, Deactivate, Anonymize, Hard-delete (super-admin)
  - Modals/dialogs: PIN prompt for hard-delete
- **Data source:** `apiPlatformUsers`, `apiDeactivatePlatformUser`, `apiAnonymizePlatformUser`, `apiHardDeletePlatformUser`
- **Permissions:** `canAccessPlatformAdminNav`; hard-delete = super-admin
- **Notes:** Mobile card list + desktop table. PIN gate on hard-delete.

---

### 3.44. Platform: User detail
- **Route:** `/platform/users/[id]`
- **File:** `app/(admin)/platform/users/[id]/page.tsx`
- **Purpose:** Edit a user (name / phone / birth_date / nationality / preferred_language / status). Read-only email. Company memberships list.
- **Type:** Detail / Form
- **Main UI elements:**
  - Table columns: Companies (Name, Role)
  - Action buttons: Deactivate, Cancel, Save
- **Data source:** `apiShowPlatformUser`, `apiUpdatePlatformUser`, `apiDeactivatePlatformUser`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Super-admin badge if applicable.

---

### 3.45. Platform: Seller applications
- **Route:** `/platform/seller-applications`
- **File:** `app/(admin)/platform/seller-applications/page.tsx`
- **Purpose:** Per-service-type seller applications with inline approve / reject (optional notes / reason).
- **Type:** List
- **Main UI elements:**
  - Filters: status
  - Table columns: ID, Company, Service type, Status, Applied at, Actions
  - Action buttons: Approve, Reject, View company
- **Data source:** `apiSellerApplications`, `apiApproveSellerApplication`, `apiRejectSellerApplication`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** PromptModal for rejection reason.

---

### 3.46. Platform: Approval queue
- **Route:** `/platform/approvals`
- **File:** `app/(admin)/platform/approvals/page.tsx`
- **Purpose:** Generic approval queue (any entity) with inline approve / reject.
- **Type:** List
- **Main UI elements:**
  - Filters: status, entity_type (free-text)
  - Table columns: ID, Entity, Status, Priority, Requested by, Created, Actions
  - Action buttons: Approve, Reject
- **Data source:** `apiPlatformApprovals`, `apiApproveGenericApproval`, `apiRejectGenericApproval`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Priority badges high/med/low. Requested_by nested (name, email).

---

### 3.47. Platform: Pending review (offers)
- **Route:** `/platform/pending-review`
- **File:** `app/(admin)/platform/pending-review/page.tsx`
- **Purpose:** Review offers pending approval. Bulk approve + per-row approve/reject with reason.
- **Type:** List + Bulk action
- **Main UI elements:**
  - Filters: type (hotel/car/transfer/excursion/flight/package/visa), search by title
  - Table columns: Checkbox, ID, Type, Title, Operator, Country, Submitted, Actions
  - Action buttons: Approve, Reject, View offer, Bulk approve selected
  - Modals/dialogs: Reject reason modal (required, ≥3 chars)
- **Data source:** `apiPendingReviewOffers`, `apiApproveOffer`, `apiRejectOffer`, `apiBulkApproveOffers`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Select-all-on-page checkbox. Relative time + tooltip.

---

### 3.48. Platform: Bookings
- **Route:** `/platform/bookings`
- **File:** `app/(admin)/platform/bookings/page.tsx`
- **Purpose:** Bookings list with status, amount, company, user, offer; confirm-pending / cancel-confirmed.
- **Type:** List
- **Main UI elements:**
  - Filters: status, search (ref/company/user/offer/ID)
  - Table columns: ID, Reference, Status, Amount, Company, User, Offer, Created, Actions
  - Action buttons: Confirm, Cancel
- **Data source:** `apiBookings`, `apiConfirmBooking`, `apiCancelBooking`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Mobile card list + desktop table. `formatMoney`. SectionTabs link to Package orders.

---

### 3.49. Platform: Package orders
- **Route:** `/platform/package-orders`
- **File:** `app/(admin)/platform/package-orders/page.tsx`
- **Purpose:** Package orders list filtered by status, payment_status, company_id. View detail.
- **Type:** List
- **Main UI elements:**
  - Filters: status, payment_status, company_id
  - Table columns: ID, Order number, Status, Payment, Total, Package, Company, Buyer, Created, Actions
  - Action buttons: View detail
- **Data source:** `apiPlatformPackageOrders`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Avatars + initials for company and buyer.

---

### 3.50. Platform: Packages oversight
- **Route:** `/platform/packages`
- **File:** `app/(admin)/platform/packages/page.tsx`
- **Purpose:** Cross-company package governance — toggle homepage feature, force-deactivate.
- **Type:** List / Settings
- **Main UI elements:**
  - Filters: status (text), company_id (numeric)
  - Table columns: ID, Title, Type, Status, Company, Public / Bookable, Actions
  - Action buttons: Homepage feature, Force deactivate
  - Modals/dialogs: `PackageHomepageFeatureModal`
- **Data source:** `apiPlatformPackages`, `apiDeactivatePlatformPackage`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Dual status dots (Public + Bookable).

---

### 3.51. Platform: Reviews
- **Route:** `/platform/reviews`
- **File:** `app/(admin)/platform/reviews/page.tsx`
- **Purpose:** Moderate user reviews — set published / hidden / rejected with notes.
- **Type:** List / Moderation
- **Main UI elements:**
  - Filters: status (pending / published / hidden / rejected)
  - Table columns: ID, Rating (stars), Text (truncated 200 chars), Status, Target (entity type + ID), User, Moderation actions
  - Action buttons: Set published, Set hidden, Set rejected
  - Modals/dialogs: Moderation notes prompt
- **Data source:** `apiPlatformReviews`, `apiModerateReview`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Star visualization. Reviewer avatar + initials.

---

### 3.52. Platform: Audit logs
- **Route:** `/platform/audit-logs`
- **File:** `app/(admin)/platform/audit-logs/page.tsx`
- **Purpose:** Audit trail with cryptographic integrity check, filters, CSV export.
- **Type:** Dashboard / Logs
- **Main UI elements:**
  - Filters: category, action, subject_type, subject_id, actor_id, from/to, search
  - Table columns: Time, Category, Action, Actor, Subject, IP, Details
  - Action buttons: Verify integrity, Export CSV (per page), Reset filters, Apply filters
  - Modals/dialogs: Audit log detail panel (right sidebar with changes/context JSON)
- **Data source:** `/platform-admin/audit-logs`, `/platform-admin/audit-logs/verify-integrity`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Hash-chain tamper detection. Relative time + full datetime hover.

---

### 3.53. Platform: Statistics
- **Route:** `/platform/statistics`
- **File:** `app/(admin)/platform/statistics/page.tsx`
- **Purpose:** Platform analytics with revenue/orders series, KPIs, top sellers, drill-down per-seller.
- **Type:** Dashboard
- **Main UI elements:**
  - Filters: days range (7 / 14 / 30 / 60 / 90 / 180 / 365)
  - Table columns: Top sellers (Rank, Name, Revenue, Orders, Drill-down)
  - Action buttons: Export revenue CSV, Drill-down on seller
  - Modals/dialogs: Seller detail panel (revenue, AOV, paid/total orders, vouchers)
- **Data source:** `/platform-admin/statistics/dashboard`, `/revenue-series`, `/orders-series`, `/sellers`, `/sellers/{companyId}`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** KPI cards + bar charts + breakdown cards (sellers, vouchers, contracts, loyalty, insurance, connections).

---

### 3.54. Platform: RBAC
- **Route:** `/platform/rbac`
- **File:** `app/(admin)/platform/rbac/page.tsx`
- **Purpose:** Roles & permissions — 2-card layout (roles overview + permission matrix).
- **Type:** Settings / Form
- **Main UI elements:**
  - Filters: Permission matrix module filter
  - Table columns: Card 1 (Roles): Role, Description, Members, Permissions, Actions; Card 2 (Matrix): Module/page, View, Create, Edit, Delete, Export
  - Action buttons: Add role, Edit role, Delete role, Toggle permissions, Export matrix CSV
  - Modals/dialogs: Drawer (create/edit role), ConfirmDialog with PIN gate
- **Data source:** `/platform-admin/rbac/stats`, `/platform-admin/rbac/roles`, `/platform-admin/rbac/permissions`, PUT `/roles/{id}/permissions`
- **Permissions:** `canAccessPlatformAdminNav`; super-admin for platform-scoped + deletion
- **Notes:** Action aliasing (CREATE/ADD/STORE → VIEW; EDIT/UPDATE/PATCH → EDIT; etc.). PIN gate on role deletion.

---

### 3.55. Platform: Invoices
- **Route:** `/platform/invoices`
- **File:** `app/(admin)/platform/invoices/page.tsx`
- **Purpose:** Platform invoices list with status tracking + CSV export.
- **Type:** List / Detail
- **Main UI elements:**
  - Filters: Status (draft / issued / paid / cancelled / overdue), Date range
  - Table columns: ID, Invoice Number, Status, Amount, Company, Issued, Due
  - Action buttons: Issue (draft), Cancel (draft/issued), Export CSV
- **Data source:** `apiInvoices`, `apiIssueInvoice`, `apiCancelInvoice`, `downloadInvoicesCsv`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Relative time formatting. Phase-2 v2 redesign chrome.

---

### 3.56. Platform: Payments
- **Route:** `/platform/payments`
- **File:** `app/(admin)/platform/payments/page.tsx`
- **Purpose:** All payment transactions with status, method, paid date.
- **Type:** List
- **Main UI elements:**
  - Filters: Status (pending/processing/paid/failed/refunded/cancelled), Date range
  - Table columns: ID, Amount, Currency, Status, Payment method, Paid at, Invoice link
  - Action buttons: Export CSV
- **Data source:** `apiPlatformPayments`, `downloadPaymentsCsv`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Links to `/platform/invoices?invoice_id=…` per row.

---

### 3.57. Platform: Commissions
- **Route:** `/platform/commissions`
- **File:** `app/(admin)/platform/commissions/page.tsx`
- **Purpose:** Manage commission policies + view recorded commission transactions.
- **Type:** List / Form
- **Main UI elements:**
  - Table columns: Policies tab (ID, Name, Type, Rate, Service, Status, Actions); Records tab (ID, Amount, Status, Company, Booking ID, Created)
  - Action buttons: New commission, Deactivate (active policies)
  - Modals/dialogs: New commission form (company, service type, type, percent/fixed, status, notes)
- **Data source:** `apiCommissions`, `apiCommissionRecords`, `apiCreateCommission`, `apiDeactivateCommission`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Two tabs (policies / records). Conditional fields by commission type.

---

### 3.58. Platform: Finance (transactions)
- **Route:** `/platform/finance`
- **File:** `app/(admin)/platform/finance/page.tsx`
- **Purpose:** Financial summaries, entitlements, settlement records per company.
- **Type:** Dashboard / List
- **Main UI elements:**
  - Filters: Company selector
  - Table columns: Entitlements (ID, Amount, Status, Company, Booking, Payable At); Settlements (ID, Amount, Status, Company, Settled At, Actions)
  - Action buttons: Mark Payable (bulk on entitlements), Mark Completed (settlements)
- **Data source:** `apiFinanceSummary`, `apiFinanceEntitlements`, `apiFinanceSettlements`, `apiMarkEntitlementsPayable`, `apiUpdateSettlementStatus`
- **Permissions:** `canAccessPlatformAdminNav` (company-scoped)
- **Notes:** Three tabs (summary / entitlements / settlements). Select-all checkbox.

---

### 3.59. Platform: Finance summary
- **Route:** `/platform/finance-summary`
- **File:** `app/(admin)/platform/finance-summary/page.tsx`
- **Purpose:** High-level financial overview (payments, commissions pending/accrued).
- **Type:** Dashboard
- **Main UI elements:**
  - Action buttons: Refresh
- **Data source:** `apiPlatformFinanceSummary`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** StatGrid with 3 cards.

---

### 3.60. Platform: Vouchers
- **Route:** `/platform/vouchers`
- **File:** `app/(admin)/platform/vouchers/page.tsx`
- **Purpose:** Issue / manage vouchers with verification logs + reissue / void actions.
- **Type:** List / Detail
- **Main UI elements:**
  - Filters: Status (issued/used/void/reissued/expired), Service type, Search (number/holder)
  - Table columns: Number, Service, Holder, Status, Valid (range), Scans, Created
  - Action buttons: View (drawer), Void (issued), Reissue (issued)
  - Modals/dialogs: Right-side detail drawer (PDF link, verification log)
- **Data source:** `apiListVouchers`, `apiVoucherDetail`, `apiVoidVoucher`, `apiReissueVoucher`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Verification log per voucher (when, IP, result).

---

### 3.61. Platform: Contracts (list)
- **Route:** `/platform/contracts`
- **File:** `app/(admin)/platform/contracts/page.tsx`
- **Purpose:** Platform partnership agreements list with filters.
- **Type:** List
- **Main UI elements:**
  - Filters: Search, Status, Type
  - Table columns: #, Type, Status, Party A, Party B, Template, Effective, Expires, Created, Actions
  - Action buttons: Export, Create new, View
- **Data source:** `apiAdminContracts`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Status tier coloring (neutral/info/success/warning/danger).

---

### 3.62. Platform: Contracts (new)
- **Route:** `/platform/contracts/new`
- **File:** `app/(admin)/platform/contracts/new/page.tsx`
- **Purpose:** Create a new contract from a published template + variable overrides.
- **Type:** Form
- **Main UI elements:**
  - Action buttons: Create, Cancel
- **Data source:** `apiAdminContractTemplates`, `apiCompaniesList`, `apiAdminCreateContract`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Multi-section form (template/parties, schedule, JSON variables). Platform-type contracts omit Party A.

---

### 3.63. Platform: Contracts (detail)
- **Route:** `/platform/contracts/[id]`
- **File:** `app/(admin)/platform/contracts/[id]/page.tsx`
- **Purpose:** View / edit contract + lifecycle (send / countersign / terminate).
- **Type:** Detail / Form
- **Main UI elements:**
  - Action buttons: Send (draft), Countersign (signed_by_b), Terminate (active/countersigned)
  - Modals/dialogs: Termination reason textarea (danger variant)
- **Data source:** `apiAdminContract`, `apiAdminSendContract`, `apiAdminCountersignContract`, `apiAdminTerminateContract`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Party A defaults to "ZULU". JsonBlock for clauses. Version history.

---

### 3.64. Platform: Contract templates (list)
- **Route:** `/platform/contract-templates`
- **File:** `app/(admin)/platform/contract-templates/page.tsx`
- **Purpose:** List of contract template definitions.
- **Type:** List
- **Main UI elements:**
  - Filters: Type, Language
  - Table columns: Name, Type, Language, Version, Published, Updated
  - Action buttons: Export, Create new
- **Data source:** `apiAdminContractTemplates`
- **Permissions:** `canAccessPlatformAdminNav`

---

### 3.65. Platform: Contract templates (new)
- **Route:** `/platform/contract-templates/new`
- **File:** `app/(admin)/platform/contract-templates/new/page.tsx`
- **Purpose:** Create a new contract template (body text + default variables).
- **Type:** Form
- **Main UI elements:**
  - Action buttons: Create, Cancel
- **Data source:** `apiAdminCreateContractTemplate`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Template body uses `{{placeholder}}` syntax. `default_variables` JSON.

---

### 3.66. Platform: Contract templates (detail)
- **Route:** `/platform/contract-templates/[id]`
- **File:** `app/(admin)/platform/contract-templates/[id]/page.tsx`
- **Purpose:** View / edit a contract template.
- **Type:** Detail / Form
- **Main UI elements:**
  - Action buttons: Save, Cancel
- **Data source:** `apiAdminContractTemplate`, `apiAdminUpdateContractTemplate`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** "Saved at HH:MM:SS" timestamp feedback.

---

### 3.67. Platform: Banners
- **Route:** `/platform/banners`
- **File:** `app/(admin)/platform/banners/page.tsx`
- **Purpose:** Manage promotional banners with image, multilingual titles, link targeting.
- **Type:** List / Form
- **Main UI elements:**
  - Table columns: Checkbox, ID (with up/down), Preview, Titles (en/ru/hy), Link, Sort, Active
  - Action buttons: Edit (inline), Delete (icon), Bulk delete, Reorder up/down
- **Data source:** `apiPlatformBanners`, `apiCreatePlatformBanner`, `apiUpdatePlatformBanner`, `apiDeletePlatformBanner`, `apiBulkDeleteBanners`, `apiReorderBanners`
- **Permissions:** `canAccessPlatformAdminNav` + super-admin
- **Notes:** Inline create/edit. Image preview. Multilingual titles.

---

### 3.68. Platform: System notifications
- **Route:** `/platform/notifications`
- **File:** `app/(admin)/platform/notifications/page.tsx`
- **Purpose:** Monitor + inspect system notifications sent to users.
- **Type:** List / Detail
- **Main UI elements:**
  - Filters: User ID, Event Type, Status (unread/read), Priority, Date range, Search
  - Table columns: When, User (avatar), Event, Title, Priority, Status
  - Action buttons: View (drawer)
  - Modals/dialogs: Right-side detail drawer (message body, verification log, JSON metadata)
- **Data source:** `/platform-admin/notifications`, `/platform-admin/notifications/stats`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Stats cards (total, unread, read, critical).

---

### 3.69. Platform: Newsletter
- **Route:** `/platform/newsletter`
- **File:** `app/(admin)/platform/newsletter/page.tsx`
- **Purpose:** Newsletter subscriptions list + subscriber engagement.
- **Type:** List
- **Main UI elements:**
  - Filters: Source (home/footer/newsletter-block/other), Language, Search email, Active-only checkbox
  - Table columns: ID, Email (avatar), Language, Source, Subscribed, Unsubscribed, Actions
  - Action buttons: Export CSV, Unsubscribe
- **Data source:** `apiNewsletterSubscriptions`, `apiNewsletterStats`, `apiDeleteNewsletterSubscription`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Stats cards (active, by_lang, by_source).

---

### 3.70. Platform: Locations
- **Route:** `/platform/locations`
- **File:** `app/(admin)/platform/locations/page.tsx`
- **Purpose:** Manage hierarchical location data — countries, regions, cities.
- **Type:** List / Form
- **Main UI elements:**
  - Table columns: Countries (ID, Name + flag, Code, Regions/Cities count, Actions); Regions (ID, Name, Cities count); Cities (ID, Name)
  - Action buttons: Add Country / Region / City, Edit (prompt), Delete, Select, Reorder up/down
- **Data source:** `apiLocationCountries`, `apiLocationRegions`, `apiLocationCities`, `apiLocationCountryCreate`, etc.
- **Permissions:** `canAccessPlatformAdminNav` + super-admin
- **Notes:** Hierarchical drill-down (country → region → city). Flag emoji.

---

### 3.71. Platform: Loyalty
- **Route:** `/platform/loyalty`
- **File:** `app/(admin)/platform/loyalty/page.tsx`
- **Purpose:** Oversee loyalty accounts + manually adjust user points.
- **Type:** List / Detail
- **Main UI elements:**
  - Filters: Tier (bronze / silver / gold / platinum)
  - Table columns: User (avatar), Tier, Points balance, Lifetime points
  - Action buttons: View (drawer)
  - Modals/dialogs: Right-side drawer (manual adjust form + transaction history)
- **Data source:** `/platform-admin/loyalty/accounts`, `/platform-admin/loyalty/stats`, `/platform-admin/loyalty/accounts/{userId}/adjust`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Stats cards (accounts, outstanding/lifetime points, gold+platinum).

---

### 3.72. Platform: Security
- **Route:** `/platform/security`
- **File:** `app/(admin)/platform/security/page.tsx`
- **Purpose:** Manage 2FA enrolment + force logout / disable 2FA.
- **Type:** List / Form
- **Main UI elements:**
  - Filters: Search (name/email)
  - Table columns: User (avatar), Role, Confirmed At, Last verified, Actions
  - Action buttons: Force logout, Disable 2FA
- **Data source:** `/platform-admin/security/two-factor`, `/platform-admin/security/stats`, `/platform-admin/security/users/{id}/force-logout`, `/platform-admin/security/users/{id}/force-disable-2fa`
- **Permissions:** `canAccessPlatformAdminNav` + super-admin
- **Notes:** Stats cards (total users, 2FA enabled, pending, coverage %). Incident section for force-logout by user ID.

---

### 3.73. Platform: Webhooks
- **Route:** `/platform/webhooks`
- **File:** `app/(admin)/platform/webhooks/page.tsx`
- **Purpose:** Monitor webhook subscriptions + delivery logs.
- **Type:** List / Dashboard
- **Main UI elements:**
  - Filters: Status (pending / success / failed)
  - Table columns: Deliveries (ID, Event, Status, URL, Attempts, HTTP Status, Last Attempt, Created); Subscriptions (ID, Company, URL, Events, Status)
  - Action buttons: Export, New webhook, Replay (failed)
- **Data source:** `/platform-admin/webhooks/stats`, `/platform-admin/webhooks/subscriptions`, `/platform-admin/webhooks/deliveries`
- **Permissions:** `canAccessPlatformAdminNav` + super-admin
- **Notes:** Two tabs (deliveries / subscriptions). HTTP status color-coded.

---

### 3.74. Platform: API docs
- **Route:** `/platform/api-docs`
- **File:** `app/(admin)/platform/api-docs/page.tsx`
- **Purpose:** Swagger UI for OpenAPI documentation.
- **Type:** Dashboard / Reference
- **Main UI elements:** — (embedded Swagger UI)
- **Data source:** Swagger UI CDN + auth-gated `/platform-admin/openapi.json`
- **Permissions:** `canAccessPlatformAdminNav` + super-admin
- **Notes:** Dynamic spec injection with Bearer token in request interceptor.

---

### 3.75. Platform: Settings (global)
- **Route:** `/platform/settings`
- **File:** `app/(admin)/platform/settings/page.tsx`
- **Purpose:** Global platform configuration settings — per-key editor with categories.
- **Type:** Form / Settings
- **Main UI elements:**
  - Filters: Category sidebar (auto-grouped by key prefix)
  - Action buttons: Save, Reset
- **Data source:** `apiPlatformSettings`, `apiPatchPlatformSetting`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Per-key edit + save. Textarea for long values. "Saved at" feedback.

---

### 3.76. Platform: Brand settings
- **Route:** `/platform/settings/brand`
- **File:** `app/(admin)/platform/settings/brand/page.tsx`
- **Purpose:** Configure brand identity — logos, contact, social, custom fields.
- **Type:** Form / Settings
- **Main UI elements:**
  - Action buttons: Save
- **Data source:** `apiBrandSettings`, `apiPatchBrandSettings`
- **Permissions:** `canAccessPlatformAdminNav` + super-admin
- **Notes:** Logo, emblem, favicon image uploads. Social platform links. Custom fields array with type selector.

---

### 3.77. Platform: Footer settings
- **Route:** `/platform/settings/footer`
- **File:** `app/(admin)/platform/settings/footer/page.tsx`
- **Purpose:** Manage footer columns and links with multilingual labels.
- **Type:** Form / Settings
- **Main UI elements:**
  - Action buttons: Add column, Save all
- **Data source:** `apiAdminFooter`, `apiSyncFooter`
- **Permissions:** `canAccessPlatformAdminNav` + super-admin
- **Notes:** 2-col grid layout. Multilingual titles per column. Nested links with visibility / new-tab toggles. Reorder buttons.

---

### 3.78. Platform: Header menu settings
- **Route:** `/platform/settings/header-menu`
- **File:** `app/(admin)/platform/settings/header-menu/page.tsx`
- **Purpose:** Configure header navigation menu items with nested children.
- **Type:** Form / Settings
- **Main UI elements:**
  - Action buttons: Add item, Save all
- **Data source:** `apiAdminHeaderMenu`, `apiSyncHeaderMenu`
- **Permissions:** `canAccessPlatformAdminNav` + super-admin
- **Notes:** Parent-child tree. Inline edit + move buttons. Optional icon. Visibility / new-tab toggles.

---

### 3.79. Platform: Connections (oversight)
- **Route:** `/platform/connections`
- **File:** `app/(admin)/platform/connections/page.tsx`
- **Purpose:** Manage partnership connections between sellers with status + termination controls.
- **Type:** List / Detail
- **Main UI elements:**
  - Filters: Status (proposed / active / paused / terminated / rejected), Type, Seller Company ID
  - Table columns: Seller A, Seller B, Type, Status, Proposed by, Proposed at, Actions
  - Action buttons: View details, Force terminate (non-terminated)
  - Modals/dialogs: Right-side detail drawer (JSON viewers, force-terminate form)
- **Data source:** `/platform-admin/connections`, `/platform-admin/connections/stats`, `/platform-admin/connections/{id}`, `/platform-admin/connections/{id}/force-terminate`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Stats cards. JSON for partner_agreement + commission_override. Force-terminate requires reason.

---

### 3.80. My company: Employees
- **Route:** `/bucket3/employees`
- **File:** `app/(admin)/bucket3/employees/page.tsx`
- **Purpose:** Cross-company employee list for super-admin oversight. Users with company memberships (operator/agent/staff).
- **Type:** List
- **Main UI elements:**
  - Filters: Search (name/email), Status (active/inactive/pending/suspended)
  - Table columns: ID, Name, Email, Status, Companies, Joined, Actions
  - Action buttons: Export, Add employee
- **Data source:** `/platform-admin/users?with_companies=1`
- **Permissions:** Platform admin
- **Notes:** Per-company management lives at `/platform/companies/[id]`. v2 redesign.

---

### 3.81. My company: Payroll
- **Route:** `/bucket3/payroll`
- **File:** `app/(admin)/bucket3/payroll/page.tsx`
- **Purpose:** Monthly payroll ledger auto-summing salary, hourly, commission, bonus, deductions to gross/net. Status flow: draft → finalized → paid.
- **Type:** List / Form
- **Main UI elements:**
  - Filters: Status (draft / finalized / paid)
  - Table columns: ID, Employee, Period, Gross pay, Deductions, Net pay, Status, Actions
  - Action buttons: Export bank batch, Add record
- **Data source:** `/payroll`
- **Permissions:** Operator tools
- **Notes:** Payslip PDF + bank-transfer batch CSV both wired.

---

### 3.82. My company: Non-service hours
- **Route:** `/bucket3/non-service-hours`
- **File:** `app/(admin)/bucket3/non-service-hours/page.tsx`
- **Purpose:** Dual page for clock-in/out tracking + time-off request workflows. Feeds payroll roll-ups.
- **Type:** List / Form
- **Main UI elements:**
  - Filters: Status (pending / approved / rejected / cancelled)
  - Table columns: Time punches (Employee, Punched in, Punched out, Duration, Actions); Time off (Employee, Type, From, To, Hours, Status, Actions)
  - Action buttons: Export, Add request, Clock in / out
- **Data source:** `/time-punches`, `/time-off`
- **Permissions:** Operator tools

---

### 3.83. My company: Cases
- **Route:** `/bucket3/cases`
- **File:** `app/(admin)/bucket3/cases/page.tsx`
- **Purpose:** Advanced case management — priority, SLA timers, assignments, status. Threaded replies (public / internal).
- **Type:** List / Detail
- **Main UI elements:**
  - Filters: Search, Status (open / in_progress / pending_customer / resolved / closed / escalated), Priority (low / normal / high / urgent)
  - Table columns: Case #, Title, Status, Priority, SLA, Assigned to, Opened, Actions
  - Action buttons: Export, New case
  - Modals/dialogs: Detail drawer (conversation, reply composer, status/priority/assignment editors)
- **Data source:** `/cases`, `/cases/{id}/replies`
- **Permissions:** Operator tools or platform admin
- **Notes:** SLA countdown badge. Escalate-overdue command runs daily.

---

### 3.84. My company: Bulk notifications
- **Route:** `/bucket3/bulk-notifications`
- **File:** `app/(admin)/bucket3/bulk-notifications/page.tsx`
- **Purpose:** Super-admin broadcast to segments (all B2C / all staff / by company / specific users) via channels (in-app / email / SMS / push).
- **Type:** Form
- **Main UI elements:**
  - Action buttons: Export, Send
- **Data source:** `/platform-admin/notifications/bulk-send`
- **Permissions:** Super-admin only
- **Notes:** Channel toggles. Priority (low / normal / high). SMS + Push providers configurable — fall back to "log channel" until Twilio / Firebase creds added.

---

### 3.85. My company: PIN settings
- **Route:** `/bucket3/pin-settings`
- **File:** `app/(admin)/bucket3/pin-settings/page.tsx`
- **Purpose:** Personal PIN (4–8 digits) management for sensitive-action gating. Set / change / verify / clear.
- **Type:** Form / Settings
- **Main UI elements:**
  - Action buttons: Export, Set / Change PIN
- **Data source:** `/account/pin`, `/account/pin/verify`
- **Permissions:** Any authenticated user
- **Notes:** Status badge (PIN set / not set). Verify form with live test. Danger zone clear section.

---

### 3.86. My company: Customers
- **Route:** `/bucket3/customers`
- **File:** `app/(admin)/bucket3/customers/page.tsx`
- **Purpose:** B2C customer list (zero company memberships). Booking count, language, nationality.
- **Type:** List
- **Main UI elements:**
  - Filters: Search (name/email/phone), Status (all / active / pending / suspended / banned)
  - Table columns: ID, Name, Email, Phone, Status, Bookings, Language, Nationality, Joined, Actions
  - Action buttons: Export, Add customer
- **Data source:** `/platform-admin/customers` via `apiCustomers`
- **Permissions:** Platform admin
- **Notes:** Lifetime spend + loyalty tier are planned future columns.

---

### 3.87. My company: Subscriptions
- **Route:** `/bucket3/subscriptions`
- **File:** `app/(admin)/bucket3/subscriptions/page.tsx`
- **Purpose:** Subscription plan catalog CRUD + company assignments. Manual billing (mark paid, extend period).
- **Type:** List / Form
- **Main UI elements:**
  - Table columns: Plan catalog (Code, Name, Monthly price, Annual price, Features, Display order, Active); Assignments (Company, Plan, Status, Billing, Period, Notes)
  - Action buttons: Export, Add plan, Assign plan
- **Data source:** `/subscription-plans`, `/company-subscriptions`, `/subscription-plans/feature-catalog`
- **Permissions:** Super-admin only
- **Notes:** Features CRUD with bool / limit types. Billing is manual by design.

---

### 3.88. My company: Per-X invoicing
- **Route:** `/bucket3/per-x-invoicing`
- **File:** `app/(admin)/bucket3/per-x-invoicing/page.tsx`
- **Purpose:** Read-only invoice aggregation by status/currency/month/operator with CSV export + monthly PDF statement.
- **Type:** Dashboard / Report
- **Main UI elements:**
  - Filters: Group by (status / currency / month / operator), Refresh
  - Table columns: Bucket / Operator, Currency (conditional), Invoice count, Total
  - Action buttons: Export CSV, Refresh, Download statement PDF (operator view only)
- **Data source:** `/invoices/aggregate`, `/invoices/export`, `/invoices/statement`
- **Permissions:** `canAccessPlatformAdminNav`
- **Notes:** Running totals by currency in summary.

---

### 3.89. My company: Requests
- **Route:** `/bucket3/requests`
- **File:** `app/(admin)/bucket3/requests/page.tsx`
- **Purpose:** Agent ↔ Operator request inbox. Two-tab view (inbox / outbox). Status flow: open → in_progress → resolved / rejected. Threaded chat replies.
- **Type:** List / Detail
- **Main UI elements:**
  - Filters: View (all / inbox / outbox), Status
  - Table columns: ID, Subject, From, To, Status, Created
  - Action buttons: Export, New request
  - Modals/dialogs: Detail modal (message thread, reply composer, status actions, resolution notes), Compose modal
- **Data source:** `lib/requests-inbox-api.ts`
- **Permissions:** Operator tools or platform admin
- **Notes:** Conversation thread = original message + replies. Reply re-opens a resolved request.

---

### 3.90. My company: Service catalog
- **Route:** `/bucket3/service-catalog`
- **File:** `app/(admin)/bucket3/service-catalog/page.tsx`
- **Purpose:** Operator-scoped CRUD for custom bookable services (airport transfers, luggage storage, etc.) outside the standard inventory verticals.
- **Type:** List / Form
- **Main UI elements:**
  - Filters: Search
  - Table columns: ID, Name, Category, Base price, Unit, Active, Actions
  - Action buttons: Export, Add service
- **Data source:** `/service-catalog`
- **Permissions:** Operator tools
- **Notes:** Inline edit form at top. Category / unit / currency / pricing fields. A public storefront `/api/catalog/services` endpoint is wired (frontend UI is a follow-up).

---

### 3.91. My company: Service logs
- **Route:** `/bucket3/service-logs`
- **File:** `app/(admin)/bucket3/service-logs/page.tsx`
- **Purpose:** Curated operations-focused audit log subset (`data_change` / `financial` / `approval` / `contract`). Wraps `/platform-admin/audit-logs`.
- **Type:** List
- **Main UI elements:**
  - Filters: Search, Category
  - Table columns: ID, Category, Action, Actor, Subject, When
  - Action buttons: Export, Full audit log (link)
- **Data source:** `/platform-admin/audit-logs`
- **Permissions:** Platform admin
- **Notes:** Relative time + tooltip.

---

### 3.92. My company: Unverified accounts
- **Route:** `/bucket3/unverified-accounts`
- **File:** `app/(admin)/bucket3/unverified-accounts/page.tsx`
- **Purpose:** Queue of pending users (status='pending' or email unconfirmed). Sorted oldest-first.
- **Type:** List
- **Main UI elements:**
  - Filters: Search
  - Table columns: ID, Name, Email, Status, Email verified, Intended role, Companies, Registered
  - Action buttons: Export
- **Data source:** `/platform-admin/unverified-accounts`
- **Permissions:** Platform admin

---

### 3.93. My company: Block dates
- **Route:** `/bucket3/block-dates`
- **File:** `app/(admin)/bucket3/block-dates/page.tsx`
- **Purpose:** Operator-side blocked date ranges per item type (hotel / flight / car / etc.) with optional reason. Enforced inside `BookingService::assertItemsAvailability`.
- **Type:** List / Form
- **Main UI elements:**
  - Filters: Item type, Item ID
  - Table columns: ID, Type, Item, From, To, Reason, Company, Actions
  - Action buttons: Export, Add block
- **Data source:** `/blocked-dates`
- **Permissions:** Operator tools
- **Notes:** Item ID optional (all items of type if omitted). Date validation (from < to).

---

### 3.94. My company: Custom fields
- **Route:** `/bucket3/custom-fields`
- **File:** `app/(admin)/bucket3/custom-fields/page.tsx`
- **Purpose:** Operator-scoped CRUD for custom field schema applied to offer forms / filters. Types: text / number / bool / select / multi_select / date.
- **Type:** List / Form
- **Main UI elements:**
  - Table columns: Scope, Key, Label, Type, Flags (required / filter), Display order, Active, Actions
  - Action buttons: Export, Add field
- **Data source:** `/custom-fields`
- **Permissions:** Operator tools
- **Notes:** Key immutable on edit. `options` (CSV) shown only for select/multi_select. A reusable `CustomFieldsRenderer` component is available for embedding in offer forms.

---

### 3.95. Localization: Languages
- **Route:** `/localization/languages`
- **File:** `app/(admin)/localization/languages/page.tsx`
- **Purpose:** Language catalog CRUD. Set default, edit native + English names, toggle RTL. Includes AI translator panel.
- **Type:** List / Settings
- **Main UI elements:**
  - Table columns: S/N, Name (with flag), Code, RTL toggle, Default toggle, Actions
  - Action buttons: Export, Add new language
  - Modals/dialogs: Edit modal (native name, English name, RTL), Add modal
- **Data source:** `apiAdminLanguages`
- **Permissions:** Super-admin only
- **Notes:** AI translator panel (dry-run, scan UI, scan content, scan both). Flag icons from flagcdn.

---

### 3.96. Localization: UI translations
- **Route:** `/localization/ui-translations`
- **File:** `app/(admin)/localization/ui-translations/page.tsx`
- **Purpose:** Per-language UI string translations. Paginated search + inline editing with bulk save.
- **Type:** List / Form
- **Main UI elements:**
  - Filters: Language selector, Search, Pagination
  - Table columns: Hash #, Key (mono), Value (editable textarea)
  - Action buttons: Export, Go back, Search, Save (with count badge)
- **Data source:** `/localization/ui-translations`
- **Permissions:** Super-admin only
- **Notes:** 50 per page. Edits tracked in local state.

---

### 3.97. Localization: Content translations
- **Route:** `/localization/translations`
- **File:** `app/(admin)/localization/translations/page.tsx`
- **Purpose:** Manage content translations (packages, offers, etc.) by entity type + entity ID + language. Field-by-field translation.
- **Type:** Form
- **Main UI elements:**
  - Filters: Entity type, Entity ID, Language
  - Action buttons: Load, Save, Delete (super-admin only)
- **Data source:** `/localization/translations`
- **Permissions:** Localization translations access
- **Notes:** Super-admin danger zone for bulk delete by language / all.

---

### 3.98. Localization: Email templates
- **Route:** `/localization/templates`
- **File:** `app/(admin)/localization/templates/page.tsx`
- **Purpose:** Notification template CRUD per event + channel + language. Title + body templates with variable support.
- **Type:** Form
- **Main UI elements:**
  - Filters: Event, Language, Channel (in_app / email)
  - Action buttons: Load, Save, Export
- **Data source:** `/localization/templates`
- **Permissions:** Localization templates access
- **Notes:** Mono-font body textarea. `is_active` checkbox. 404-safe for missing templates.

---

### 3.99. Settings: Pricing rules
- **Route:** `/settings/pricing-rules`
- **File:** `app/(admin)/settings/pricing-rules/page.tsx`
- **Purpose:** Unified markup + commission rules CRUD + test panel. Rules scoped global / category / operator / partnership; percentage or fixed amount.
- **Type:** List / Form / Dashboard
- **Main UI elements:**
  - Filters: Search by name, Scope (all / global / category / operator / partnership)
  - Table columns: Scope description, Markup, Bounds (min/max), Currency, Priority, Status, Effective dates
  - Action buttons: Create, Edit (drawer), Delete (confirm), Test pricing
  - Modals/dialogs: Create / Edit drawer with scope selector; Delete confirmation; Test panel (dry-run resolver)
- **Data source:** `/pricing-rules`, `/pricing-rules/test`
- **Permissions:** Super-admin (CRUD); operator/platform admin (read-only)
- **Notes:** Partnership scope requires operator_id + agent_id. Test panel validates rules before creation.

---

### 3.100. Settings: Money flow
- **Route:** `/settings/money-flow`
- **File:** `app/(admin)/settings/money-flow/page.tsx`
- **Purpose:** Super-admin money-flow terms. Models: Zulu collects (T+N remittance), Operator collects (periodic invoice), Agent collects (full pass-through).
- **Type:** List / Form
- **Main UI elements:**
  - Filters: Scope (global / operator / partnership), Collection model
  - Table columns: Scope, Money flow, Status, Effective dates, Actions
  - Action buttons: New term
  - Modals/dialogs: Drawer (scope/model/schedule/audit), Confirm delete
- **Data source:** `/money-flow-terms`
- **Permissions:** Super-admin only
- **Notes:** Conditional form fields by model (remittance_days for A, invoicing_period for B).

---

### 3.101. Settings: Exchange rates
- **Route:** `/settings/exchange-rates`
- **File:** `app/(admin)/settings/exchange-rates/page.tsx`
- **Purpose:** Manual FX rate overrides. Shows rates from all sources (cba / ecb / exchangerate_api / manual / partner_override). Manual rates take precedence.
- **Type:** List / Form
- **Main UI elements:**
  - Filters: Pair (e.g. USD-AMD), Source, Active status
  - Table columns: Pair, Rate, Source, Fetched, Status (Live / Active / Inactive), Actions
  - Action buttons: New manual rate
  - Modals/dialogs: Drawer (pair, rate, activation), PIN gate (deactivate), Confirm deactivate
- **Data source:** `/exchange-rates`
- **Permissions:** Platform admin (read), Super-admin (write)
- **Notes:** "Live" badge for the winning rate per pair. PIN gate on deactivate.

---

## 4. Page Categories Summary

### Operations (Inventory + Bookings + Reviews + Connections)
- Inventory operator-side (3.13–3.22): Hotels, Flights, Flight cabins, Transfers, Cars, Excursions, Visas, Packages, Offers, Commission settings — **10 pages**
- Inventory oversight (3.26–3.30): Hotels, Flights, Transfers, Cars, Excursions — **5 pages**
- Bookings (3.48, 3.49): Bookings, Package orders — **2 pages**
- Pending review + Approvals + Packages oversight (3.46, 3.47, 3.50): **3 pages**
- Reviews (3.51): **1 page**
- Connections + oversight (3.33, 3.79): **2 pages**

### Finance
- Invoices, Payments, Commissions, Finance (transactions), Finance summary, Vouchers (3.55–3.60): **6 pages**
- Per-X invoicing (3.88): **1 page**

### Marketplace / Suppliers / Agents
- Companies + Company detail + Module permissions (3.38, 3.39, 3.40): **3 pages**
- Company applications + detail (3.41, 3.42): **2 pages**
- Seller applications (3.45): **1 page**
- Users (v1 + v2 + user detail + employees + customers + unverified) (3.9, 3.43, 3.44, 3.80, 3.86, 3.92): **6 pages**
- Contracts: Operator/Agent + Platform + new + detail + templates (3.24, 3.25, 3.31, 3.32, 3.61–3.66): **10 pages**

### Configuration / Settings (the big bucket)
- RBAC (3.54): **1 page**
- Pricing rules + Money flow + Exchange rates + Commission settings (3.22, 3.99–3.101): **4 pages**
- Platform settings (global / brand / footer / header menu) (3.75–3.78): **4 pages**
- Localization (Languages / UI strings / Content / Email templates) (3.95–3.98): **4 pages**
- CMS pages (list + editor) (3.36, 3.37): **2 pages**
- Banners + Newsletter + System notifications (3.67–3.69): **3 pages**
- Loyalty + Security + Webhooks + API docs + Locations (3.70–3.74): **5 pages**
- Block dates + Custom fields + Service catalog (3.93, 3.94, 3.90): **3 pages**
- Subscriptions (3.87): **1 page**
- External API integration (3.23): **1 page**

### Profile & Account
- Profile + PIN + My profile (v2) (3.10, 3.85): **2 pages**
- Notifications inboxes (v1 + v2) (3.8, 3.12): **2 pages**
- File manager (3.11): **1 page**
- Auth pages (3.1–3.5): Home redirect, Login, Forgot password, Reset password, SSO — **5 pages**

### Reports & Analytics
- Dashboard + Operator statistics + Platform statistics + Audit logs + Service logs (3.6, 3.7, 3.52, 3.53, 3.91): **5 pages**

### Customer support
- Support tickets list + detail (3.34, 3.35): **2 pages**

### Bulk operations
- Bulk notifications (3.84): **1 page**

### Internal ops (HR-style)
- Payroll (3.81): **1 page**
- Non-service hours (3.82): **1 page**
- Cases (3.83): **1 page**
- Requests (3.89): **1 page**

> **Largest category:** Configuration / Settings — **27 pages**. Marketplace / Suppliers / Agents — **22 pages**. Operations — **23 pages**. The settings bucket is the densest because the ZULU admin centralises every "platform knob" (RBAC, pricing, money flow, FX, branding, localization, CMS, etc.) under one sidebar group.

---

## 5. Cross-cutting Components

### Layout / Chrome
- `AdminShell` (`components/AdminShell.tsx`) — top header (logo, search, language, theme, notifications, apps grid, user menu) + sidebar (8-section IA + v2 redesign groups) + main content area
- `AdminGroupTabs` — horizontal tab bar rendered inside each group page
- `AutoDocumentTitle` — sets `<title>` from `resolveAdminPageTitle(pathname, t)`
- `AdminRedesignPlaceholder` — generic v1 "Phase 2 placeholder" shell (only a few uses remain)
- `ForbiddenNotice` — 403 surface when access predicates fail

### v1 design-system primitives (`components/ui/`)
`ActiveFiltersChips`, `Badge`, `Button`, `Card`, `Checkbox`, `ConfirmDialog`, `Drawer`, `FormField`, `Input`, `Modal`, `PageHeader`, `Pagination`, `Radio`, `Select`, `StatusPill`, `Switch`, `Table`, `Tabs`

### v2 design-system primitives (`components/ui/v2/`)
`Breadcrumb`, `Button` (V2Button), `Card` (V2Card), `EmptyState`, `FilterCard`, `IconButton`, `PageHeader` (V2PageHeader), `SectionTabs`, `StatCard`

### Domain-specific shared components
- `ContentLanguagePill` — preview-language switcher on inventory list pages
- `CompanyCommissionTab` — commission settings tab embedded inside company detail
- `CsvImportModal` — generic CSV import dialog (used by 6+ inventory pages)
- `HotelsXlsxImportModal` — XLSX-specific import (hotels)
- `CustomFieldsRenderer` — drop-in renderer for offer forms reading `/custom-fields`
- `ImageUploadField` — image upload primitive (uses files API)
- `ImportExportButtons` — pair of CSV import / export buttons
- `LatLngFields` — paired lat/lng inputs with a map picker
- `LocationCascadeSelect` — country → region → city cascade
- `MainImageDescriptionFields` — primary image + description pair (re-used across inventory)
- `OfferStatusBadge` — colored badge for offer review/publication state
- `PackageHomepageFeatureModal` — homepage-feature toggle dialog
- `PaginationBar` — paginator under list tables
- `PartnerSettingsModal` — partner settings dialog (companies page)
- `PinPromptDialog` — PIN gate for sensitive actions (hard-delete user, role delete, FX deactivate)
- `PromptModal` — free-text confirm/reason prompt
- `SourceLanguagePicker` — picker for selecting source language in translation flows
- `TranslationTabs` — multi-language tab editor inside detail forms
- `TranslationsModal` — popup for editing translations for a single entity

### Sub-component folders
- `components/flights/` — flight-specific subcomponents (e.g. `SeatMapEditor`)
- `app/(admin)/inventory/_components/InventoryOversightList.tsx` — generic oversight list used by all 5 inventory-oversight pages
- `app/(admin)/pages/[id]/edit/RichTextEditor.tsx` + `WidgetForm.tsx` — CMS page editor sub-parts

### Shared lib helpers (`lib/`)
- API clients per domain: `auth-api`, `bookings-api`, `commissions-api`, `connections-api`, `contracts-api`, `customers-api`, `exchange-rates-api`, `file-assets-api`, `finance-api`, `inventory-crud-api`, `invoices-api`, `localization-api`, `locations-api`, `money-flow-terms-api`, `notifications-api`, `operator-commission-api`, `operator-inventory-api`, `pages-api`, `platform-admin-api`, `pricing-rules-api`, `requests-inbox-api`, `support-api`, `translations-api`, `vouchers-api`, `account-sessions-api`, `company-module-permissions-api`
- Access predicates: `lib/access.ts` (15+ section/permission helpers)
- Navigation config: `lib/admin-nav-config.ts` (sidebar + page-title resolver)
- Formatters: `lib/format.ts`, `lib/zulu-lang.ts`
- CSV/XLSX: `lib/csv-import-export.ts`, `lib/csv-orchestrator.ts`, `lib/csv-parser.ts`, `lib/csv-primitives.ts`, `lib/hotels-xlsx.ts`
- Status/UI helpers: `lib/flight-status.ts`, `lib/flight-ui.ts`, `lib/hotel-ui.ts`, `lib/transfers/transfer-ui.ts`, `lib/visa-ui.ts`, `lib/flight-cabin-class.ts`
- Wizard state: `lib/excursions/excursion-wizard-state.ts`, `lib/transfers/use-transfer-builder.ts`
- Telemetry: `lib/rollout-telemetry.ts` (admin screen-view pings)
- Server-side: `lib/server-lang.ts`, `lib/use-document-title.ts`

### Contexts (`contexts/`)
- `AdminAuthContext` — bearer token, user, login/logout, bootstrap flow
- `LanguageContext` — current language (EN/HY/RU), `t()` translator, language options

---

## 6. Open Questions / Gaps

These are explicit placeholders, unfinished surfaces, or scope notes called out by `TODO` comments + "placeholder" / "Phase 2" markers in the code. **No design recommendations — just inventory.**

### Pages with explicit "placeholder" / "no live integration" banners
1. **`/operator/external-api` (3.23)** — Visible banner: *"Placeholder UI — no live integration yet."* No credential persistence, no real connector.
2. **`/admin-redesign/files` (3.11) — Trash tab** — Listed in sidebar quick access but body is a placeholder (Phase 2 soft-delete recovery).

### Pages whose UI is functional but a feature is "next step" / external creds blocked
3. **Bulk notifications (3.84)** — SMS + Push channels work via provider abstraction; with no Twilio / Firebase creds they fall back to logging. Banner says "(provider not configured — sent to log)".
4. **External API operator integration (3.23)** — Awaiting business decision on which inventory APIs to support.
5. **Payment gateway integration** — Not represented as a page; explicitly parked indefinitely per project policy.
6. **Subscriptions billing (3.87)** — Manual by design per the operations model (the page comment says: "Billing is manual by design, not 'parked'.").

### Routes / pages that exist but are re-exports
7. **`/agent/contracts` (3.31)** — Thin re-export of `/operator/contracts`.
8. **`/agent/contracts/[id]` (3.32)** — Thin re-export of `/operator/contracts/[id]`.
9. **`/operator/commission-settings` (3.22)** — Sidebar moved this to Settings → Pricing rules but the route still exists.

### Surfaces that wrap raw output instead of polished UI
10. **`/statistics` (3.7)** — Operator statistics is currently a raw `<pre>JSON</pre>` dump pending a polished surface.

### v2 redesign pages — Phase 2 follow-ups in comments
11. **Users page stat cards (3.9)** — Originally counted current-page rows. `/platform-admin/users/stats` endpoint now exists. Code comment: "(Phase 2: dedicated `/platform-admin/users/stats` endpoint pending)" is stale and could be deleted.
12. **Pending users badge in sidebar** — `pendingUsersCount` is hard-coded to 0 with a TODO: *"wire to `/api/admin/users/pending-count` once that endpoint exists."*
13. **Server-side PIN enforcement (3.54, 3.43, 3.101)** — PIN gate is UX-only at the frontend. Server-side enforcement (signed PIN-token header scheme) is listed as a Phase 2 follow-up in multiple files.

### Detail / edit / new form pages
14. **Detail/[id]/new/[id]/edit pages still on v1 chrome** — All list pages have v2 chrome + cells. The form pages (e.g. operator hotel edit, package detail, user detail) are still on the older PageHeader / FormField primitives. Listed in `project_active_work.md` as "low priority polish."

### Search / storefront wiring
15. **Header search bar (3.13–3.101)** — In `AdminShell.tsx` header: "Currently visual-only; wiring up the search backend is a separate task." Search input does nothing.
16. **Public service-catalog UI** — Backend endpoint `/api/catalog/services` shipped (3.90). Customer-facing storefront UI is the follow-up.

### Shared helpers not yet extracted
17. **`pickAvatarTone` / `avatarStyle` / `statusBadgeStyle` / `formatRelativeTime`** — Copy-pasted in ~30 list pages. Roadmap candidate `lib/admin-v2-helpers.ts` mentioned in session notes.

### Existing pages whose purpose may overlap (worth verifying with product)
18. **Approvals (3.46) vs Pending review (3.47)** — Generic approval queue vs offer-specific approval. Both are linked from the sidebar's Marketplace ops.
19. **Notifications v1 (3.8) vs v2 (3.12)** — Two notification inboxes coexist (`/notifications` and `/admin-redesign/notifications`).
20. **Users v1 (3.43) vs Users v2 (3.9)** — V2 page exists for redesign; v1 is kept "for full delete / anonymize flow."
21. **My company (`bucket3/*`) vs Marketplace ops** — `bucket3/service-logs` and `bucket3/unverified-accounts` appear under Marketplace ops in the sidebar but live under `bucket3/` in code.

### i18n keys without seeded translations
22. **Sidebar fallback labels** — `admin-nav-config.ts` includes `labelFallback` for each group because some `admin.nav.section.*` translation rows are not yet seeded in HY/RU. The fallbacks are English. Visible to non-EN users on first deploy until the migrations seed the labels.

---

## Quick summary

- **Total pages:** **101** distinct `page.tsx` files (96 under `app/(admin)/*` + 5 public/auth at the app root).
- **Largest category:** **Configuration / Settings** — 27 pages (RBAC, pricing, money flow, FX, branding, localization, CMS, banners, newsletter, loyalty, security, webhooks, API docs, locations, custom fields, block dates, service catalog, subscriptions, external API).
- **Pages that look unfinished or scope-flagged:** roughly **15** — explicit placeholder banner on `/operator/external-api`; Trash tab in File manager; raw-JSON `/statistics`; hard-coded `pendingUsersCount=0` badge; PIN gate is UX-only (server-side enforcement is the Phase 2 follow-up); SMS/Push channels are scaffolded but no-op until creds; header search bar is visual-only; v1 ↔ v2 duplicate surfaces for Users and Notifications; `/agent/contracts*` are re-exports of `/operator/contracts*`; detail/edit/new form pages still on v1 chrome.

Everything else is functionally complete as of 2026-05-25 (Phase Զ.16 "ZERO PLACEHOLDERS" sweep).
