/**
 * Mirrors `App\Http\Resources\Api\UserResource` for
 * POST /api/login, GET /api/account/me.
 */

export type AdminUserContext = {
  world: "super_admin" | "platform_admin" | "operator_admin" | "company_admin";
  canonical_role?: "super_admin" | "platform_admin" | "operator_admin" | string;
  active_company_id: number | null;
  is_super_admin: boolean;
  is_platform_admin?: boolean;
  operator_statistics_platform_scope: boolean;
  is_statistics_elevated_only: boolean;
};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  preferred_language?: string | null;
  avatar?: string | null;
  birth_date?: string | null;
  nationality?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
  roles?: string[];
  canonical_roles?: string[];
  canonical_role?: string;
  /** Omitted when `is_super_admin` is true — treat as unrestricted for UI gating. */
  permissions?: string[];
  is_super_admin: boolean;
  operator_statistics_platform_scope: boolean;
  is_statistics_elevated_only: boolean;
  companies: { id: number; name: string }[];
  context: AdminUserContext;
};

export const ADMIN_TOKEN_STORAGE_KEY = "zulu_admin_token";
export const ADMIN_USER_STORAGE_KEY = "zulu_admin_user_cache";
