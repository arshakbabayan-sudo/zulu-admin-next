# MIGRATION_TODO — Admin sidebar 8-section IA (2026-05-24)

This file tracks follow-ups from the **role-aware 8-section sidebar
reorganization**. The change was applied as a **sidebar-config rewrite
(Option B)** rather than physical file moves: page files stay in place,
all existing URLs continue to work, the sidebar config now exposes them
under the new 8-section information architecture.

Repo touched: **`zulu-admin-next/`** only (no backend changes).

---

## 1. Section mapping (old sidebar group → new 8-section bucket)

| Old group (14 total) | → | New section (8 total) | Notes |
|---|---|---|---|
| Dashboard | → | **1. Dashboard** | Unchanged |
| Inventory oversight | → | **2. Inventory** | Now scope toggle for super_admin (mine / all) |
| My inventory | → | **2. Inventory** | Same section as oversight; operators see "mine" only |
| Bookings | → | **3. Bookings** | Unchanged — all three roles |
| Agent tools | → | **4. Sales workspace** | Renamed, agent-only |
| Finance | → | **5. Finance** | **Removed:** Commission settings tab → moved to Settings → Pricing rules |
| Bucket3 (CRM modules) | → | **6. My company** | Employees, payroll, time-off, cases, bulk-notifications, PIN, customers, subscriptions, per-X-invoicing |
| Reviews & approvals | → | **7. Marketplace ops** | super_admin only (Approval queue tab merges pending-review + approvals) |
| Companies & access | → | **7. Marketplace ops** | super_admin only |
| Loyalty & promo | → | **8. Settings → Loyalty & Promo rules** | Tab inside Settings |
| Content | → | **8. Settings → Content templates** | Banners, CMS pages, system notifications, newsletter, email templates, header menu, footer |
| Localization | → | **8. Settings → Localization** | Languages, UI strings, content translations |
| Operations | → | **8. Settings → General** | Connections, support, reviews |
| System | → | **8. Settings → General** | RBAC, security, webhooks, locations, audit-logs (audit-logs ALSO surfaces in Marketplace ops) |

Source of truth: `zulu-admin-next/lib/admin-nav-config.ts`
(`ADMIN_NAV_GROUPS` array, 8 entries).

---

## 2. Route-by-route disposition

All 76 existing page routes in `zulu-admin-next/app/(admin)/**` are
**preserved**. The table below records which new section each route is
exposed under in the sidebar.

| Existing route | New section | Exposed via |
|---|---|---|
| `/dashboard` | Dashboard | sidebar link |
| `/operator/hotels` | Inventory | tab |
| `/operator/flights` | Inventory | tab |
| `/operator/transfers` | Inventory | tab |
| `/operator/cars` | Inventory | tab |
| `/operator/excursions` | Inventory | tab |
| `/operator/visas` | Inventory | tab |
| `/operator/packages` | Inventory | tab |
| `/operator/offers` | Inventory | tab |
| `/operator/contracts` | (orphan, see §3) | — |
| `/operator/external-api` | (orphan) | — |
| `/operator/commission-settings` | (orphan, replaced) | direct URL only |
| `/inventory/{flights,hotels,transfers,cars,excursions}` | Inventory (super scope=all) | scope toggle (super only) |
| `/platform/packages` | Inventory | tab (super only) |
| `/platform/bookings` | Bookings | tab |
| `/platform/package-orders` | Bookings | tab |
| `/agent/contracts` | Sales workspace | tab |
| `/agent/contracts/[id]` | Sales workspace | child route |
| `/platform/finance-summary` | Finance | tab |
| `/platform/invoices` | Finance | tab |
| `/platform/payments` | Finance | tab |
| `/platform/commissions` | Finance (Commissions ledger) | tab |
| `/platform/finance` | Finance (Transactions) | tab |
| `/platform/vouchers` | Finance | tab |
| `/bucket3/employees` | My company | tab |
| `/bucket3/payroll` | My company | tab |
| `/bucket3/non-service-hours` | My company (Time-off) | tab |
| `/bucket3/cases` | My company | tab |
| `/bucket3/bulk-notifications` | My company | tab |
| `/bucket3/pin-settings` | My company | tab |
| `/bucket3/customers` | My company | tab |
| `/bucket3/subscriptions` | My company | tab |
| `/bucket3/per-x-invoicing` | My company | tab |
| `/bucket3/requests` | (orphan, see §3) | — |
| `/platform/approvals` | Marketplace ops (Approval queue) | tab |
| `/platform/pending-review` | (orphan, merged into Approvals) | direct URL only |
| `/platform/companies` | Marketplace ops | tab |
| `/platform/companies/[id]` | Marketplace ops | child route |
| `/platform/companies/[id]/module-permissions` | Marketplace ops | child route |
| `/platform/company-applications` | (orphan, hidden 2026-05-23) | direct URL only |
| `/platform/seller-applications` | Marketplace ops | tab |
| `/platform/users` | Marketplace ops | tab |
| `/platform/users/[id]` | Marketplace ops | child route |
| `/platform/contracts` | Marketplace ops (Partnership agreements) | tab |
| `/platform/contract-templates` | Marketplace ops | tab |
| `/platform/audit-logs` | Marketplace ops + Settings → General | tab in both |
| `/bucket3/service-logs` | Marketplace ops | tab |
| `/bucket3/unverified-accounts` | Marketplace ops | tab |
| `/settings/pricing-rules` | Settings (NEW placeholder) | tab |
| `/platform/rbac` | Settings | tab (UI-level role filter applied for non-super) |
| `/localization/languages` | Settings → Localization | tab (super only) |
| `/localization/ui-translations` | Settings → Localization | tab (super only) |
| `/localization/translations` | Settings → Localization | tab |
| `/localization/templates` | Settings → Content templates | tab |
| `/platform/banners` | Settings → Content templates | tab (super only) |
| `/pages` | Settings → Content templates | tab |
| `/pages/[id]/edit` | Settings | child route |
| `/platform/notifications` | Settings → Content templates | tab |
| `/platform/newsletter` | Settings → Content templates | tab |
| `/platform/settings/header-menu` | Settings → Content templates | tab (super only) |
| `/platform/settings/footer` | Settings → Content templates | tab (super only) |
| `/platform/loyalty` | Settings → Loyalty & Promo | tab |
| `/bucket3/block-dates` | Settings → Inventory config | tab |
| `/bucket3/custom-fields` | Settings → Inventory config | tab |
| `/bucket3/service-catalog` | Settings → Inventory config | tab |
| `/platform/security` | Settings → General | tab (super only) |
| `/platform/webhooks` | Settings → General | tab (super only) |
| `/platform/locations` | Settings → General | tab (super only) |
| `/platform/api-docs` | Settings → General | tab (super only) |
| `/platform/settings/brand` | Settings → General | tab (super only) |
| `/connections` | Settings → General | tab |
| `/support/tickets` | Settings → General | tab |
| `/support/tickets/[id]` | Settings | child route |
| `/platform/reviews` | Settings → General | tab |
| `/notifications` | (top-bar bell, no sidebar) | direct URL |
| `/statistics` | (orphan, hidden since 2026-05-17) | direct URL only |
| `/platform/statistics` | (orphan, hidden) | direct URL only |
| `/platform/settings/page.tsx` | (orphan landing) | direct URL only |
| `/platform/connections` | (orphan, duplicate) | direct URL only |

---

## 3. Orphan files (no sidebar entry — review for cleanup)

These page files exist in the route tree but are no longer reachable
from the sidebar. They still respond to direct URLs (preserving
bookmarks, deep links from Telegram bot, etc.). **Do not delete in this
PR.** Schedule a cleanup PR after stakeholders confirm they don't rely
on the deep links.

- `app/(admin)/operator/commission-settings/page.tsx` — replaced by
  `/settings/pricing-rules`; keep until Phase 1 cutover.
- `app/(admin)/operator/contracts/page.tsx` + `[id]` — was inside My
  inventory; legal contract flow lives in Marketplace ops. Decide:
  expose under Marketplace ops or remove?
- `app/(admin)/operator/external-api/page.tsx` — placeholder UI, no
  backend wiring; hidden since 2026-05-17. Remove if API integration
  is parked indefinitely.
- `app/(admin)/bucket3/requests/page.tsx` — service request module;
  unclear which new section it belongs in (Marketplace ops? My company?
  Settings?). Needs product call.
- `app/(admin)/platform/pending-review/page.tsx` — merged into
  Approval queue (`/platform/approvals`). Keep route as filter
  shortcut; remove if no inbound links.
- `app/(admin)/platform/company-applications/page.tsx` + `[id]` —
  hidden 2026-05-23 (merged into `/platform/companies`). Confirm safe
  to delete.
- `app/(admin)/statistics/page.tsx` + `app/(admin)/platform/statistics/page.tsx`
  — hidden 2026-05-17 (raw JSON dump). Will be rebuilt as HF-2 with
  charts; keep files until that work starts.
- `app/(admin)/platform/connections/page.tsx` — duplicate of
  top-level `/connections` page. Pick one and delete the other.
- `app/(admin)/platform/settings/page.tsx` — leftover landing, no
  sidebar entry. Probably safe to delete.

---

## 4. Backend follow-ups (separate task — do NOT implement in this PR)

1. **RBAC role-assignment whitelist** — `POST /api/platform-admin/users/{id}/roles`
   currently accepts any role id from a non-super caller. UI now hides
   platform-scoped roles for non-super viewers, but the backend MUST
   reject `super_admin` / `platform_admin` role ids when the caller's
   token is not super. See TODO comment in
   `zulu-admin-next/app/(admin)/platform/rbac/page.tsx`.

2. **Approval queue unification** — `/platform/approvals` currently
   shows "Generic approvals" only; `/platform/pending-review` is a
   separate page for offer-specific approvals. The Marketplace ops
   spec calls for ONE Approval queue with a type filter. Backend
   should expose a unified `GET /api/approvals?type=offer|company|other`
   endpoint, then the legacy /pending-review page can be folded in.

3. **Pricing rules service** — new backend module for the
   `/settings/pricing-rules` placeholder. Migrate
   `/operator/commission-settings` data into a `pricing_rules` table
   with a `rule_type` column (commission | markup) so the unified UI
   can render both.

4. **Bulk-notifications scope** — moving `/bucket3/bulk-notifications`
   into "My company" implies the backend should restrict recipient
   pickers to the calling company's users. Verify the existing
   endpoint already scopes correctly.

---

## 5. Translation keys to seed (run after merge)

The new section labels and a few new tab labels need rows in the
`ui_translations` table for HY / EN / RU. Without them the sidebar
falls back to plain English (handled via `labelFallback` in
`AdminNavGroup`). Keys to seed:

```
admin.nav.section.dashboard         (Dashboard          / Վահանակ          / Панель управления)
admin.nav.section.inventory         (Inventory          / Ապրանքանյութ      / Инвентарь)
admin.nav.section.bookings          (Bookings           / Ամրագրումներ      / Бронирования)
admin.nav.section.sales_workspace   (Sales workspace    / Վաճառքի աշխատանոց / Рабочее место продаж)
admin.nav.section.finance           (Finance            / Ֆինանսներ         / Финансы)
admin.nav.section.my_company        (My company         / Իմ ընկերությունը  / Моя компания)
admin.nav.section.marketplace_ops   (Marketplace ops    / Շուկայի կառավարում / Управление площадкой)
admin.nav.section.settings          (Settings           / Կարգավորումներ    / Настройки)

admin.nav.tab.commissions_ledger    (Commissions ledger / Կոմիսիաների մատյան / Журнал комиссий)
admin.nav.tab.approval_queue        (Approval queue     / Հաստատման հերթ     / Очередь одобрений)
admin.nav.tab.companies_access      (Companies & access / Ընկերություններ ու հասանելիություն / Компании и доступ)
admin.nav.tab.partnership_agreements (Partnership agreements / Գործընկերային պայմանագրեր / Партнёрские соглашения)
admin.nav.tab.pricing_rules         (Pricing rules      / Գնագոյացման կանոններ / Правила цен)
admin.nav.tab.bucket3.bulk_notifications (Bulk notifications / Զանգվածային ծանուցումներ / Массовые уведомления)
admin.nav.tab.bucket3.customers     (Customers          / Հաճախորդներ        / Клиенты)
admin.nav.tab.bucket3.unverified_accounts (Unverified accounts / Չհաստատված հաշիվներ / Неверифицированные аккаунты)

admin.inventory.scope_label         (Scope:             / Տեսանելիություն՝  / Область:)
admin.inventory.scope_mine          (Mine               / Իմը               / Мои)
admin.inventory.scope_all           (All companies      / Բոլոր ընկերությունները / Все компании)

admin.settings.pricing_rules.title             (Pricing rules / Գնագոյացման կանոններ / Правила цен)
admin.settings.pricing_rules.subtitle          (Unified Markup + Commission rules table / Միասնական ավելացում + կոմիսիա կանոնների աղյուսակ / Единая таблица правил наценок и комиссий)
admin.settings.pricing_rules.coming_soon_title (Coming in Phase 1 / Գալիս է Փուլ 1-ում / Появится в Фазе 1)
admin.settings.pricing_rules.coming_soon_body  (This page will replace the current Commission settings and add Markup rules in a unified table. / Այս էջը կփոխարինի ընթացիկ Կոմիսիաների կարգավորումները և կավելացնի Ավելացման կանոնները միասնական աղյուսակում։ / Эта страница заменит текущие настройки комиссий и добавит правила наценок в единую таблицу.)
admin.settings.pricing_rules.legacy_hint       (Legacy URL (/operator/commission-settings) still works for direct linking. / Հին URL-ը (/operator/commission-settings) դեռ աշխատում է ուղիղ հղման համար։ / Старый URL (/operator/commission-settings) по-прежнему работает для прямых ссылок.)
```

After deploying:

```bash
ssh hetzner
sudo -u www-data php /var/www/zulu/artisan tinker
# bulk insert via DB::table('ui_translations')->insert([...])
sudo -u www-data php /var/www/zulu/artisan cache:forget ui_translations_hy
sudo -u www-data php /var/www/zulu/artisan cache:forget ui_translations_en
sudo -u www-data php /var/www/zulu/artisan cache:forget ui_translations_ru
```

---

## 6. What changed in code (file list)

- ✏️ `zulu-admin-next/lib/admin-nav-config.ts` — `ADMIN_NAV_GROUPS`
  full replace (14 → 8 groups); new `AdminNavTabScope` type;
  `labelFallback` field on `AdminNavGroup`; `SECTION_ALIAS_PREFIXES`
  + `findActiveGroup` fallback for `/inventory/*` and `/settings/*`.
- ✏️ `zulu-admin-next/lib/access.ts` — added role-bucket helpers
  (`isSuperAdminRole`, `isAgentOnlyRole`, `isOperatorRole`) and
  eight section-level predicates
  (`canAccessDashboardSection` …
  `canAccessSettingsSection`).
- ✏️ `zulu-admin-next/components/AdminShell.tsx` — wired new
  visibility predicates into the `isGroupVisible` switch; sidebar
  label rendering now uses `labelFallback` when `t()` returns the key.
- ✏️ `zulu-admin-next/components/AdminGroupTabs.tsx` — added
  Inventory scope toggle (super_admin only) above the tab bar; tabs
  rewrite `/operator/*` → `/inventory/*` when on the oversight URL;
  added `moduleKey` to tab filter.
- ✏️ `zulu-admin-next/app/(admin)/platform/rbac/page.tsx` — added
  UI-level company-scoped role filter for non-super viewers; TODO
  comment points at backend whitelist follow-up.
- ➕ `zulu-admin-next/app/(admin)/settings/pricing-rules/page.tsx` —
  NEW placeholder page (Phase 1 stub).
- ➕ `MIGRATION_TODO.md` — this file.

---

## 7. Smoke-test checklist (post-merge)

- [ ] super_admin login → sidebar shows 8 sections in order:
      Dashboard, Inventory, Bookings, Finance, My company,
      Marketplace ops, Settings (Sales workspace also visible since
      super passes the agent gate)
- [ ] Inventory section → scope toggle visible; clicking "All companies"
      navigates to /inventory/hotels and active pill follows
- [ ] /settings/pricing-rules renders with placeholder card
- [ ] /platform/rbac renders matrix (super sees all roles)
- [ ] operator_admin login → no Marketplace ops; Inventory shows only
      /operator/* tabs (no scope toggle)
- [ ] agent login → no Inventory section; Sales workspace visible
- [ ] non-super on /platform/rbac → only company-scoped roles render
- [ ] legacy URLs still respond (no 404):
      /platform/pending-review, /platform/banners,
      /operator/commission-settings, /bucket3/requests
