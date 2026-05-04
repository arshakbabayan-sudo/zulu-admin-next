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

const INVENTORY_VIEW_PERMISSIONS = [
  "flights.view",
  "hotels.view",
  "transfers.view",
  "cars.view",
  "excursions.view",
] as const;

/** Nav: show inventory block when user can access at least one operator inventory list. */
export function canAccessInventoryOversightNav(user: AdminUser | null): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return INVENTORY_VIEW_PERMISSIONS.some((p) => user.permissions?.includes(p));
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
 * Anyone else with no operator tools → /dashboard (will show ForbiddenNotice).
 */
export function defaultLandingPath(user: AdminUser | null): string {
  if (canAccessPlatformAdminNav(user)) return "/dashboard";
  if (canAccessOperatorToolsNav(user)) return "/operator/offers";
  return "/dashboard";
}

/** Service connections: `GET|POST|PATCH /api/connections*` — `auth:sanctum`; server enforces business rules on mutations. */
export function canAccessConnectionsNav(user: AdminUser | null): boolean {
  return user != null;
}
