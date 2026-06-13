import type { AdminUser, SellerServiceType } from "./auth-types";

/** Platform access: super admin or canonical platform admin. */
export function canAccessPlatformAdminNav(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  if (user.context?.is_platform_admin === true) return true;
  if (user.canonical_role === "platform_admin") return true;
  return user.canonical_roles?.includes("platform_admin") ?? false;
}

/** Explicit super-admin-only nav entries (avoid click -> 403 for scoped platform admins). */
export function canAccessSuperAdminOnlyPlatformNav(user: AdminUser | null): boolean {
  return user?.is_super_admin === true;
}

export function canAccessOperatorStatisticsNav(user: AdminUser | null): boolean {
  // Super / platform-scope: cross-company drill-down. Own-scope (§11): a tenant
  // operator-admin sees their own company's statistics (scoped server-side).
  return (
    user?.operator_statistics_platform_scope === true ||
    user?.operator_statistics_own_scope === true
  );
}

/** Support JSON: super admin or at least one company role (mirrors `UserResource.roles`). */
export function canAccessSupportNav(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return (user.roles?.length ?? 0) > 0;
}

/**
 * Permission checks for non–super-admin users only.
 * Super admin: `UserResource` omits `permissions`; treat as all allowed for UI.
 */
export function userHasPermission(user: AdminUser | null, permission: string): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return user.permissions?.includes(permission) ?? false;
}

const OPERATOR_TOOLS_PERMISSIONS = [
  "hotels.create",
  "flights.create",
  "cars.create",
  "transfers.create",
  "excursions.create",
  "visas.create",
  "packages.create",
] as const;

/** Operator/Agent CRUD section: any user with at least one operator-tier
 * write permission scoped to their company. Super admin always sees it.
 */
export function canAccessOperatorToolsNav(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return OPERATOR_TOOLS_PERMISSIONS.some((p) => user.permissions?.includes(p));
}

/** Whether the user's active company has the given seller service type granted. Super admin: always true. */
export function userHasSellerServiceType(user: AdminUser | null, type: SellerServiceType): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  const enabled = user.context?.active_seller_service_types ?? [];
  return enabled.includes(type);
}

/**
 * Phase 6A — whether a given admin module is visible to this user.
 * Default-allow: returns true unless the user's active company has an
 * explicit `is_allowed=false` row for the module. Super admins are never
 * restricted.
 */
export function userHasModuleAccess(user: AdminUser | null, moduleKey: string | undefined): boolean {
  if (!moduleKey) return true;
  if (!user) return false;
  if (user.is_super_admin) return true;
  const map = user.context?.module_permissions;
  if (!map) return true;
  // Explicit false denies; missing / true allows.
  return map[moduleKey] !== false;
}

/** Nav: cross-platform inventory oversight is for super/platform admin only.
 * Operators view their own inventory through the Operator Tools CRUD pages,
 * so this section would be redundant (and confusing) in their sidebar.
 */
export function canAccessInventoryOversightNav(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  if (user.context?.is_platform_admin === true) return true;
  if (user.canonical_role === "platform_admin") return true;
  return false;
}

/** Languages list + PATCH toggle — super admin only (`07` §3.6). */
export function canAccessLocalizationLanguagesNav(user: AdminUser | null): boolean {
  return user?.is_super_admin === true;
}

/** Notification templates read/update — super admin for PATCH (`07` §3.6). */
export function canAccessLocalizationTemplatesNav(user: AdminUser | null): boolean {
  return user?.is_super_admin === true;
}

/**
 * Translations POST: super admin or company member for owning entity.
 * Nav: super admin or any user with at least one company membership.
 */
export function canAccessLocalizationTranslationsNav(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return (user.companies?.length ?? 0) > 0;
}

export function canAccessLocalizationSectionNav(user: AdminUser | null): boolean {
  return (
    canAccessLocalizationLanguagesNav(user) ||
    canAccessLocalizationTemplatesNav(user) ||
    canAccessLocalizationTranslationsNav(user)
  );
}

/** In-app notifications: `GET|POST /api/notifications*` — scoped to the signed-in user (`auth:sanctum`). */
export function canAccessNotificationsNav(user: AdminUser | null): boolean {
  return user != null;
}

/**
 * Default landing page after admin login. Everyone lands on /dashboard — it's
 * the one section every role holds by default (dashboard.view) and is always a
 * valid page. (Previously agents were sent to /agent/welcome, which doesn't
 * exist → 404; operators to /operator/offers, which a view-only operator may not
 * have inventory perms for. /dashboard avoids both.)
 */
export function defaultLandingPath(user: AdminUser | null): string {
  if (canAccessDashboardSection(user)) return "/dashboard";
  // Dashboard turned off for this role → fall back to the public site bridge.
  return "/dashboard";
}

/** Service connections: `GET|POST|PATCH /api/connections*` — `auth:sanctum`; server enforces business rules on mutations. */
export function canAccessConnectionsNav(user: AdminUser | null): boolean {
  return user != null;
}

/**
 * Agent-only sidebar group (e.g. /agent/contracts). Visible when the user
 * has the `agent` role but does not otherwise hit a higher-tier group
 * (operator tools / platform admin) — super admin always sees it.
 */
export function canAccessAgentToolsNav(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return user.roles?.includes("agent") ?? false;
}

// ─── 2026-05-24 — Role buckets for the 8-section sidebar IA ──────────────
// Three primary buckets drive section visibility in the new sidebar:
//   super_admin    → platform-wide governance (Marketplace ops, full Settings)
//   operator_admin → company-level operator (their own Inventory, their company)
//   agent          → individual sales agent (Sales workspace, no Inventory)
// A user can technically have more than one role; precedence is
// super > agent (only if not super) > operator. Super admins fall through
// to every section.

export function isSuperAdminRole(user: AdminUser | null): boolean {
  return user?.is_super_admin === true;
}

/** Pure agent — has the agent role and is NOT super admin. Drives Sales workspace visibility. */
export function isAgentOnlyRole(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return false;
  return user.roles?.includes("agent") ?? false;
}

/** Operator-side admin (company-scoped CRUD) but not super, not pure agent. */
export function isOperatorRole(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return false;
  if (isAgentOnlyRole(user)) return false;
  // operator_admin signal: has at least one CRUD permission OR holds operator-style canonical role
  if (OPERATOR_TOOLS_PERMISSIONS.some((p) => user.permissions?.includes(p))) return true;
  if (user.canonical_role && ["operator_admin", "tour_operator", "hotel_admin"].includes(user.canonical_role)) return true;
  return false;
}

// ─── Section access — STRICT, gated on the section's view permission ─────────
// RBAC #2 redo (2026-06-06): each section can be accessed by a non-super user
// IFF they hold its single `<section>.view` gate. The SAME gate drives sidebar
// visibility (AdminShell/MgmtPage via GROUP_MENU_PERMISSION) and the server
// routes — so no checkmark ⇒ no access by menu, direct URL, or API (Arshak's
// requirement). Super admins are unrestricted. NO permissive fallbacks.

export function canAccessDashboardSection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return userHasPermission(user, "dashboard.view");
}

export function canAccessInventorySection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return userHasPermission(user, "inventory.view");
}

export function canAccessBookingsSection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return userHasPermission(user, "bookings.view");
}

// 2026-06-10 — canAccessSalesWorkspaceSection() removed (0 callers). The
// Sales workspace sidebar group was retired 2026-05-28; this predicate had no
// remaining consumers.

export function canAccessFinanceSection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return userHasPermission(user, "finance.view");
}

// 2026-06-10 — canAccessMyCompanySection() + canAccessHrSection() +
// canSeeOwnCompanyNav() removed (all 0 callers). The HR sidebar group was
// folded into CRM (2026-06-06); the "My company" group was dissolved
// (2026-06-10) — its self-service pages (seller-status/payments) are now thin
// redirects into CRM → My profile → My company (MyCompanyPane gates via the
// CRM section, not these predicates). The backend `my_company.view` / `hr.view`
// permission strings are untouched; only dead frontend nav wiring is removed.

/** Management (cross-tenant governance) — super or the management.view gate. */
export function canAccessMarketplaceOpsSection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return userHasPermission(user, "management.view");
}

export function canAccessSettingsSection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return userHasPermission(user, "settings.view");
}

export function canAccessChatSection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return userHasPermission(user, "chat.view");
}

export function canAccessCrmSection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return userHasPermission(user, "crm.view");
}
