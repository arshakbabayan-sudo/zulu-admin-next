import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export type FinanceEntitlementRow = {
  id: number;
  company_id: number;
  package_order_id?: number | null;
  package_order_item_id?: number | null;
  service_type?: string | null;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  currency: string;
  status: string;
  settlement_id?: number | null;
  notes?: string | null;
  payable_at?: string | null;
  created_at?: string | null;
};

export type FinanceSettlementRow = {
  id: number;
  company_id: number;
  currency: string;
  total_gross_amount: number;
  total_commission_amount: number;
  total_net_amount: number;
  entitlements_count?: number;
  status: string;
  period_label?: string | null;
  notes?: string | null;
  settled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  company?: { id: number; name: string } | null;
};

export type CompanyFinanceSummary = {
  total_earned?: number;
  total_pending?: number;
  total_settled?: number;
  currency?: string;
  /**
   * Per-currency breakdown added alongside the existing scalar totals
   * (the scalars stay unchanged). Keyed by 3-letter currency code → an
   * object of the same scalar totals for that currency. OPTIONAL: absent
   * before the backend deploys, so the UI must fall back to the flat
   * scalar fields when this is missing or empty. NEVER sum across
   * currencies — render each currency on its own row.
   */
  totals_by_currency?: Record<
    string,
    { total_earned?: number; total_pending?: number; total_settled?: number }
  >;
  [key: string]: unknown;
};

export async function apiFinanceSummary(
  token: string,
  companyId: number
): Promise<ApiSuccessEnvelope<CompanyFinanceSummary>> {
  return apiFetchJson(`/finance/summary?company_id=${companyId}`, { method: "GET", token });
}

export async function apiFinanceEntitlements(
  token: string,
  params: { company_id: number; page?: number; per_page?: number; status?: string; package_order_id?: number }
): Promise<ApiSuccessEnvelope<FinanceEntitlementRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  q.set("company_id", String(params.company_id));
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  if (params.package_order_id != null) q.set("package_order_id", String(params.package_order_id));
  const qs = q.toString();
  return apiFetchJson(`/finance/entitlements${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiFinanceSettlements(
  token: string,
  params: { company_id: number; page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<FinanceSettlementRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  q.set("company_id", String(params.company_id));
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/finance/settlements${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiMarkEntitlementsPayable(
  token: string,
  body: { company_id: number; entitlement_ids: number[] }
): Promise<ApiSuccessEnvelope<{ updated_count: number }>> {
  return apiFetchJson(`/finance/entitlements/mark-payable`, { method: "POST", token, body });
}

export async function apiUpdateSettlementStatus(
  token: string,
  id: number,
  status: string
): Promise<ApiSuccessEnvelope<FinanceSettlementRow>> {
  return apiFetchJson(`/finance/settlements/${id}/status`, { method: "PATCH", token, body: { status } });
}
