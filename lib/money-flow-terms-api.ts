/**
 * Phase 1 / Step D.2 — admin client for /api/platform-admin/money-flow-terms.
 * Super-admin only on the backend.
 */

import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export type MoneyFlowScope = "partnership" | "operator" | "global";
export type CollectionModel = "zulu_collects" | "operator_collects" | "agent_collects";
export type InvoicingPeriod = "weekly" | "monthly";

export type MoneyFlowTermRow = {
  id: number;
  scope_type: MoneyFlowScope;
  operator_id: number | null;
  operator_name?: string | null;
  agent_id: number | null;
  agent_name?: string | null;
  collection_model: CollectionModel;
  remittance_days: number | null;
  invoicing_period: InvoicingPeriod | null;
  is_active: boolean;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
};

export type MoneyFlowTermCreate = {
  scope_type: MoneyFlowScope;
  operator_id?: number | null;
  agent_id?: number | null;
  collection_model: CollectionModel;
  remittance_days?: number | null;
  invoicing_period?: InvoicingPeriod | null;
  is_active?: boolean;
  effective_from?: string;
  effective_until?: string | null;
  reason?: string;
};

export type MoneyFlowTermUpdate = Partial<MoneyFlowTermCreate>;

export type MoneyFlowTermListFilters = {
  scope_type?: MoneyFlowScope;
  operator_id?: number;
  collection_model?: CollectionModel;
  is_active?: boolean;
  page?: number;
  per_page?: number;
};

const BASE = "/platform-admin/money-flow-terms";

export async function apiMoneyFlowTermsList(
  token: string,
  filters: MoneyFlowTermListFilters = {}
): Promise<ApiSuccessEnvelope<MoneyFlowTermRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && String(value) !== "") {
      q.set(key, String(value));
    }
  }
  const qs = q.toString();
  return apiFetchJson(`${BASE}${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiMoneyFlowTermCreate(
  token: string,
  payload: MoneyFlowTermCreate
): Promise<ApiSuccessEnvelope<MoneyFlowTermRow>> {
  return apiFetchJson(BASE, { method: "POST", token, body: payload });
}

export async function apiMoneyFlowTermUpdate(
  token: string,
  id: number,
  payload: MoneyFlowTermUpdate
): Promise<ApiSuccessEnvelope<MoneyFlowTermRow>> {
  return apiFetchJson(`${BASE}/${id}`, { method: "PATCH", token, body: payload });
}

export async function apiMoneyFlowTermDelete(
  token: string,
  id: number,
  reason?: string
): Promise<{ success: boolean; message?: string }> {
  return apiFetchJson(`${BASE}/${id}`, {
    method: "DELETE",
    token,
    body: reason ? { reason } : undefined,
  });
}
