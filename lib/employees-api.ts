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
