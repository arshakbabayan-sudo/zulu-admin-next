import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

/** Backend rule shape after `transformRuleToPolicyShape`. The id is a UUID string. */
export type CommissionPolicyRow = {
  id: string;
  name?: string | null;
  rate?: number | null;
  /** Phase 7.4 — backend exposes `percent` (number|null) for percentage rules. */
  percent?: number | null;
  type?: string | null;
  status: string;
  service_type?: string | null;
  company_id?: number | null;
  commission_mode?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** Phase 7.4 — payload accepted by POST /commissions. */
export type CommissionPolicyCreate = {
  company_id: number;
  service_type?: string | null;
  type: "percentage" | "fixed";
  percent?: number | null;
  fixed_value?: number | null;
  fixed_currency?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  status?: "active" | "inactive" | "scheduled";
  notes?: string | null;
};

export type CommissionRecordRow = {
  id: number;
  amount: number;
  currency: string;
  status: string;
  booking_id?: number | null;
  company_id?: number | null;
  created_at?: string | null;
  company?: { id: number; name: string } | null;
};

export async function apiCommissions(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<CommissionPolicyRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/commissions${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiCommissionRecords(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<CommissionRecordRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/commission-records${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiDeactivateCommission(
  token: string,
  id: string
): Promise<ApiSuccessEnvelope<CommissionPolicyRow>> {
  return apiFetchJson(`/commissions/${id}/deactivate`, { method: "POST", token, body: {} });
}

/** Phase 7.4 — POST /commissions creates a seller-scoped policy. */
export async function apiCreateCommission(
  token: string,
  body: CommissionPolicyCreate
): Promise<ApiSuccessEnvelope<CommissionPolicyRow>> {
  return apiFetchJson(`/commissions`, {
    method: "POST",
    token,
    body: body as unknown as Record<string, unknown>,
  });
}

/**
 * Fields PATCH /commissions/{ruleId} accepts (backend CommissionController::updatePolicy).
 * Only `service_type` + value/status/notes are mutable — the policy's company &
 * `type` (percentage|fixed) are fixed at creation.
 */
export type CommissionPolicyUpdate = {
  service_type?: string | null;
  percent?: number | null;
  fixed_value?: number | null;
  fixed_currency?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  status?: "active" | "inactive" | "scheduled";
  notes?: string | null;
};

/** PATCH /commissions/{ruleId} — edit an existing seller-scoped policy. */
export async function apiUpdateCommission(
  token: string,
  id: string,
  body: CommissionPolicyUpdate
): Promise<ApiSuccessEnvelope<CommissionPolicyRow>> {
  return apiFetchJson(`/commissions/${id}`, {
    method: "PATCH",
    token,
    body: body as unknown as Record<string, unknown>,
  });
}
