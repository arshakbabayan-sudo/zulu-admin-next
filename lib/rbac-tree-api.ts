/**
 * RBAC menu-mirror tree API client.
 * Backend: AdminRbacController@tree @ /platform-admin/rbac/tree (2026-06-01).
 *
 * Returns the admin menu shaped as a permission tree (section → item →
 * permissions) with each permission's DB id + whether the given role grants
 * it — so the Permissions page renders the sidebar as a checkbox tree.
 */
import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export type RbacTreePermission = {
  id: number;
  name: string;
  action: string;
  granted: boolean;
};

export type RbacTreeItem = {
  key: string;
  label: string;
  permissions: RbacTreePermission[];
};

export type RbacTreeSection = {
  key: string;
  label: string;
  items: RbacTreeItem[];
};

export type RbacTree = {
  role_id: number | null;
  sections: RbacTreeSection[];
};

export async function apiRbacTree(
  token: string,
  roleId?: number,
): Promise<ApiSuccessEnvelope<RbacTree>> {
  const qs = roleId != null ? `?role_id=${roleId}` : "";
  return apiFetchJson(`/platform-admin/rbac/tree${qs}`, { method: "GET", token });
}

/** Sync a role's full permission set (same endpoint the matrix view uses). */
export async function apiSyncRolePermissions(
  token: string,
  roleId: number,
  permissionIds: number[],
): Promise<ApiSuccessEnvelope<unknown>> {
  return apiFetchJson(`/platform-admin/rbac/roles/${roleId}/permissions`, {
    method: "PUT",
    token,
    body: { permission_ids: permissionIds },
  });
}
