/**
 * Phase 1 / Step D.3 — admin client for /api/platform-admin/pricing-rules.
 * 5 endpoints: list / create / update / delete (soft) / test (resolver
 * dry-run). Super-admin only on the backend.
 */

import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export type PricingRuleScope = "partnership" | "operator" | "category" | "global";
export type PricingRuleMarkupType = "percentage" | "fixed";
export type PricingRuleServiceCategory =
  | "hotel"
  | "flight"
  | "transfer"
  | "car"
  | "excursion"
  | "package"
  | "visa";

export type PricingRuleRow = {
  id: string;
  scope_type: PricingRuleScope;
  operator_id: number | null;
  operator_name?: string | null;
  agent_id: number | null;
  agent_name?: string | null;
  service_category: PricingRuleServiceCategory | null;
  destination_id: number | null;
  markup_type: PricingRuleMarkupType;
  markup_value: number;
  min_sell_amount: number | null;
  max_sell_amount: number | null;
  currency: string;
  effective_from: string;
  effective_until: string | null;
  priority: number;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type PricingRuleCreate = {
  scope_type: PricingRuleScope;
  operator_id?: number | null;
  agent_id?: number | null;
  service_category?: PricingRuleServiceCategory | null;
  destination_id?: number | null;
  markup_type: PricingRuleMarkupType;
  markup_value: number;
  min_sell_amount?: number | null;
  max_sell_amount?: number | null;
  currency: string;
  effective_from: string;
  effective_until?: string | null;
  priority?: number;
  is_active?: boolean;
  reason?: string;
};

export type PricingRuleUpdate = Partial<PricingRuleCreate>;

export type PricingRuleListFilters = {
  scope_type?: PricingRuleScope;
  operator_id?: number;
  currency?: string;
  service_category?: PricingRuleServiceCategory;
  is_active?: boolean;
  page?: number;
  per_page?: number;
};

export type PricingRuleTestRequest = {
  offer_id: number;
  quantity?: number;
  agent_id?: number;
  destination_id?: number;
  price_override?: number;
  buyer_type?: "client" | "agent";
};

export type PricingRuleTestResult = {
  offer_id: number;
  quantity: number;
  supplier_net: number;
  customer_price: number;
  line_total: number;
  currency: string;
  rule_id_applied: string | null;
  snapshot: Record<string, unknown>;
};

const BASE = "/platform-admin/pricing-rules";

export async function apiPricingRulesList(
  token: string,
  filters: PricingRuleListFilters = {}
): Promise<ApiSuccessEnvelope<PricingRuleRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      q.set(key, String(value));
    }
  }
  const qs = q.toString();
  return apiFetchJson(`${BASE}${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiPricingRuleCreate(
  token: string,
  payload: PricingRuleCreate
): Promise<ApiSuccessEnvelope<PricingRuleRow>> {
  return apiFetchJson(BASE, { method: "POST", token, body: payload });
}

export async function apiPricingRuleUpdate(
  token: string,
  id: string,
  payload: PricingRuleUpdate
): Promise<ApiSuccessEnvelope<PricingRuleRow>> {
  return apiFetchJson(`${BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function apiPricingRuleDelete(
  token: string,
  id: string,
  reason?: string
): Promise<{ success: boolean; message?: string }> {
  return apiFetchJson(`${BASE}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
    body: reason ? { reason } : undefined,
  });
}

export async function apiPricingRuleTest(
  token: string,
  payload: PricingRuleTestRequest
): Promise<ApiSuccessEnvelope<PricingRuleTestResult>> {
  return apiFetchJson(`${BASE}/test`, { method: "POST", token, body: payload });
}
