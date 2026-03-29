import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export type CommissionPolicyRow = {
  id: number;
  name?: string | null;
  rate: number;
  type: string;
  status: string;
  service_type?: string | null;
  company_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
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
  id: number
): Promise<ApiSuccessEnvelope<CommissionPolicyRow>> {
  return apiFetchJson(`/commissions/${id}/deactivate`, { method: "POST", token, body: {} });
}
