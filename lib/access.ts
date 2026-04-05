import type { AdminUser } from "./auth-types";

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

/** Service connections: `GET|POST|PATCH /api/connections*` — `auth:sanctum`; server enforces business rules on mutations. */
export function canAccessConnectionsNav(user: AdminUser | null): boolean {
  return user != null;
}
