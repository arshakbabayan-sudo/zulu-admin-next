import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export type FinanceEntitlementRow = {
  id: number;
  company_id: number;
  amount: number;
  currency: string;
  status: string;
  booking_id?: number | null;
  payable_at?: string | null;
  created_at?: string | null;
  company?: { id: number; name: string } | null;
};

export type FinanceSettlementRow = {
  id: number;
  company_id: number;
  amount: number;
  currency: string;
  status: string;
  settled_at?: string | null;
  created_at?: string | null;
  company?: { id: number; name: string } | null;
};

export type CompanyFinanceSummary = {
  total_earned?: number;
  total_pending?: number;
  total_settled?: number;
  currency?: string;
  [key: string]: unknown;
};

export async function apiFinanceSummary(
  token: string
): Promise<ApiSuccessEnvelope<CompanyFinanceSummary>> {
  return apiFetchJson(`/finance/summary`, { method: "GET", token });
}

export async function apiFinanceEntitlements(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<FinanceEntitlementRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/finance/entitlements${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiFinanceSettlements(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<FinanceSettlementRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/finance/settlements${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiMarkEntitlementsPayable(
  token: string,
  ids: number[]
): Promise<ApiSuccessEnvelope<{ updated: number }>> {
  return apiFetchJson(`/finance/entitlements/mark-payable`, { method: "POST", token, body: { ids } });
}

export async function apiCreateSettlement(
  token: string,
  body: { company_id: number; amount: number; currency: string; notes?: string }
): Promise<ApiSuccessEnvelope<FinanceSettlementRow>> {
  return apiFetchJson(`/finance/settlements`, { method: "POST", token, body });
}

export async function apiUpdateSettlementStatus(
  token: string,
  id: number,
  status: string
): Promise<ApiSuccessEnvelope<FinanceSettlementRow>> {
  return apiFetchJson(`/finance/settlements/${id}/status`, { method: "PATCH", token, body: { status } });
}
