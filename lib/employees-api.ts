/**
 * Bucket D Phase D.2 — typed client for tenant-scoped employee management.
 *
 * Backend wires into CompanyController::addUser / updateUserRole /
 * deactivateUser (existing). Bucket D Phase D.1 added the invite-mode flag
 * which generates a magic-link token and emails the new hire instead of
 * requiring the manager to pick a password.
 */

import { apiFetchJson } from "@/lib/api-client";

export type CompanyEmployeeRole =
  | "company_admin"
  | "operator_admin"
  | "company_operator"
  | "company_viewer";

export type AddEmployeePayload = {
  name: string;
  email: string;
  role_name: CompanyEmployeeRole;
  phone?: string | null;
  /** When set to "invite", backend pre-creates user + sends magic-link email. */
  mode?: "direct" | "invite";
  /** Required when mode === "direct". Ignored on invite. */
  password?: string;
};

export type AddEmployeeResponse = {
  success: boolean;
  data: {
    user: { id: number; name: string; email: string; status: string };
    mode: "direct" | "invite";
    invitation_pending: boolean;
  };
};

export async function apiAddEmployee(
  token: string,
  companyId: number,
  payload: AddEmployeePayload
): Promise<AddEmployeeResponse> {
  return apiFetchJson(`/companies/${companyId}/users`, {
    method: "POST",
    token,
    body: { mode: "invite", ...payload },
  });
}

export async function apiUpdateEmployeeRole(
  token: string,
  companyId: number,
  userId: number,
  role_name: CompanyEmployeeRole
): Promise<{ success: boolean }> {
  return apiFetchJson(`/companies/${companyId}/users/${userId}/role`, {
    method: "PATCH",
    token,
    body: { role_name },
  });
}

export async function apiDeactivateEmployee(
  token: string,
  companyId: number,
  userId: number
): Promise<{ success: boolean }> {
  return apiFetchJson(`/companies/${companyId}/users/${userId}/deactivate`, {
    method: "PATCH",
    token,
  });
}

// ─── Phase Գ.6 / Bucket D.4 — per-employee permission overrides ──────────

export type EmployeePermissionRow = {
  permission_id: number;
  name: string;
  module: string;
  action: string;
  /** Effective state today: role baseline adjusted by any override. */
  granted: boolean;
  /** Whether the employee's role grants this permission by default. */
  from_role: boolean;
  /** A standing override on top of the role, if any. */
  override: "allow" | "deny" | null;
};

export type EmployeePermissionsResponse = {
  success: boolean;
  data: {
    user: { id: number; name: string; email: string; role_name: string | null };
    company_id: number;
    can_edit: boolean;
    permissions: EmployeePermissionRow[];
  };
};

export async function apiGetEmployeePermissions(
  token: string,
  companyId: number,
  userId: number
): Promise<EmployeePermissionsResponse> {
  return apiFetchJson(`/companies/${companyId}/users/${userId}/permissions`, {
    method: "GET",
    token,
  });
}

export async function apiSyncEmployeePermissions(
  token: string,
  companyId: number,
  userId: number,
  permissions: { permission_id: number; granted: boolean }[]
): Promise<EmployeePermissionsResponse> {
  return apiFetchJson(`/companies/${companyId}/users/${userId}/permissions`, {
    method: "PUT",
    token,
    body: { permissions },
  });
}
