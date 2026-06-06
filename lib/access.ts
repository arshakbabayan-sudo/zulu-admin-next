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
  return user?.operator_statistics_platform_scope === true;
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
 * Default landing page for a user after admin login.
 * Platform admins (super, platform) → /dashboard (platform KPIs).
 * Operator/agency admins → /operator/offers (their inventory home).
 * Travel agents (sell on zulu.am, no admin CRUD) → /agent/welcome.
 * Anyone else with no operator tools → /dashboard (will show ForbiddenNotice).
 */
export function defaultLandingPath(user: AdminUser | null): string {
  if (canAccessPlatformAdminNav(user)) return "/dashboard";
  if (canAccessOperatorToolsNav(user)) return "/operator/offers";
  if (user?.roles?.includes("agent")) return "/agent/welcome";
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

// ─── Section-level predicates (8 new sidebar groups, 2026-05-24) ────────
// These are intentionally permissive at the section level — fine-grained
// per-tab visibility is enforced by tab.superAdminOnly / perm / serviceType
// / moduleKey filters that AdminGroupTabs already honours.

export function canAccessDashboardSection(user: AdminUser | null): boolean {
  return user != null;
}

/** Inventory PAGE access: super, the menu permission, or operator tools.
 * Sidebar visibility is gated separately by menu.inventory.view (AdminShell);
 * this stays permissive so a granted menu item never lands on a 403. */
export function canAccessInventorySection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  if (userHasPermission(user, "menu.inventory.view")) return true;
  return canAccessOperatorToolsNav(user) || canAccessInventoryOversightNav(user);
}

/** Bookings: anyone who can view bookings (Phase R.2 — permission-gated so a
 * revoked `bookings.view` actually hides the section). Super admin always. */
export function canAccessBookingsSection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return userHasPermission(user, "menu.bookings.view") || userHasPermission(user, "bookings.view");
}

/** Sales workspace: agents only (super admin can preview via direct URL but not in sidebar). */
export function canAccessSalesWorkspaceSection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true; // sidebar parity for QA, matches existing canAccessAgentToolsNav semantics
  return user.roles?.includes("agent") ?? false;
}

/** Finance: anyone with a finance/commission view permission (Phase R.2 —
 * permission-gated). Super admin always. */
export function canAccessFinanceSection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return (
    userHasPermission(user, "menu.finance.view") ||
    userHasPermission(user, "commissions.view") ||
    userHasPermission(user, "finance.entitlements.view") ||
    userHasPermission(user, "finance.settlements.view") ||
    userHasPermission(user, "platform.finance.view")
  );
}

/** My company: page ACCESS — all three roles (each sees only their own
 * company). Super admin can open the pages too (oversight). */
export function canAccessMyCompanySection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  // Shared by the My-company AND HR pages — accept either menu permission so a
  // granted nav item always opens; falls back to plain company membership.
  if (userHasPermission(user, "menu.my_company.view")) return true;
  if (userHasPermission(user, "menu.hr.view")) return true;
  return (user.companies?.length ?? 0) > 0;
}

/** "My company" SIDEBAR visibility — operator/agent only. 2026-06-02 (Arshak):
 * super-admins manage every company via Management/Directory, so a personal
 * "My company" entry (which lands on their own seller-status) was just
 * confusing in the super menu. Page access is unchanged
 * (canAccessMyCompanySection still lets super open the pages by URL). */
export function canSeeOwnCompanyNav(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return false;
  return (user.companies?.length ?? 0) > 0;
}

/** Marketplace ops: super_admin only. */
export function canAccessMarketplaceOpsSection(user: AdminUser | null): boolean {
  return user?.is_super_admin === true;
}

/** Settings: visible to all roles; tabs inside filter based on scope. */
export function canAccessSettingsSection(user: AdminUser | null): boolean {
  return user != null;
}

/**
 * Internal chat (2026-06-01) — company-scoped messaging. Visible to anyone
 * with a company membership (option Բ: colleagues message each other), plus
 * super/platform admins for oversight/QA.
 */
export function canAccessChatSection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  if (userHasPermission(user, "menu.chat.view")) return true;
  if (canAccessPlatformAdminNav(user)) return true;
  return (user.companies?.length ?? 0) > 0;
}

/**
 * CRM (2026-05-31) — separate sales / customer-relationship section.
 * Audience (Arshak's decision): super-admin (top), operator/agent leaders and
 * their company staff. Anyone with a company membership, an agent role, or
 * platform-admin oversight sees it; pure-platform-admins included for parity.
 * Per-role scoping (which customers/deals each sees) is enforced server-side.
 */
export function canAccessCrmSection(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  if (userHasPermission(user, "menu.crm.view")) return true;
  if (canAccessPlatformAdminNav(user)) return true;
  if ((user.companies?.length ?? 0) > 0) return true;
  return user.roles?.includes("agent") ?? false;
}
