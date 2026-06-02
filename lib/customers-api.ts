/**
 * Phase 7.1 — B2C customers API client.
 * Backend: PlatformAdminController::listCustomers @ /platform-admin/customers.
 *
 * A "customer" is a user with zero company memberships — i.e. a B2C user
 * separate from operator / agent / platform admin staff.
 */
import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export type CustomerRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  preferred_language: string | null;
  nationality: string | null;
  bookings_count: number;
  created_at: string | null;
};

export const CUSTOMER_STATUSES = ["", "active", "inactive", "pending", "suspended"] as const;

export async function apiCustomers(
  token: string,
  params: { page?: number; per_page?: number; search?: string; status?: string }
): Promise<ApiSuccessEnvelope<CustomerRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.search) q.set("search", params.search);
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetchJson(`/platform-admin/customers${qs ? `?${qs}` : ""}`, {
    method: "GET",
    token,
  });
}

/**
 * CRM Customers = the company's OWN buyers (people who placed an order with
 * this company), scoped server-side to the caller's visible companies. An
 * operator sees only their buyers; a super-admin sees every buyer. This is the
 * correct source for the CRM section — NOT apiCustomers (the platform-wide B2C
 * registry, which is super-admin oversight and 403s for operators).
 * Backend: CrmController::customers @ /platform-admin/crm/customers.
 */
export async function apiCrmCustomers(
  token: string,
  params: { page?: number; per_page?: number; search?: string; status?: string }
): Promise<ApiSuccessEnvelope<CustomerRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.search) q.set("search", params.search);
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetchJson(`/platform-admin/crm/customers${qs ? `?${qs}` : ""}`, {
    method: "GET",
    token,
  });
}
