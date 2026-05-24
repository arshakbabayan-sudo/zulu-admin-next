/**
 * Phase Զ.15 / Item 16-17 — admin client for /api/platform-admin/exchange-rates.
 * Read open to any platform-admin; write paths (POST/PATCH/DELETE) are
 * gated to super-admin server-side.
 */

import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export type FxRateSource =
  | "cba"
  | "ecb"
  | "exchangerate_api"
  | "manual"
  | "partner_override";

export type ExchangeRateRow = {
  id: number;
  source_currency: string;
  target_currency: string;
  rate: string;
  source: FxRateSource;
  fetched_at: string | null;
  is_active: boolean;
  created_at: string;
};

export type ExchangeRateCreate = {
  source_currency: string;
  target_currency: string;
  rate: number | string;
  is_active?: boolean;
};

export type ExchangeRateUpdate = {
  rate?: number | string;
  is_active?: boolean;
};

export type ExchangeRateListFilters = {
  pair?: string;
  source?: FxRateSource;
  is_active?: boolean;
  page?: number;
  per_page?: number;
};

const BASE = "/platform-admin/exchange-rates";

function buildQuery(f: ExchangeRateListFilters): string {
  const q = new URLSearchParams();
  if (f.pair) q.set("pair", f.pair);
  if (f.source) q.set("source", f.source);
  if (f.is_active !== undefined) q.set("is_active", String(f.is_active));
  if (f.page) q.set("page", String(f.page));
  if (f.per_page) q.set("per_page", String(f.per_page));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function apiExchangeRatesList(
  token: string,
  filters: ExchangeRateListFilters = {}
): Promise<ApiSuccessEnvelope<ExchangeRateRow[]> & { meta: ApiListMeta }> {
  return apiFetchJson<ApiSuccessEnvelope<ExchangeRateRow[]> & { meta: ApiListMeta }>(
    `${BASE}${buildQuery(filters)}`,
    { method: "GET", token }
  );
}

export async function apiExchangeRateCreate(
  token: string,
  payload: ExchangeRateCreate
): Promise<ApiSuccessEnvelope<ExchangeRateRow>> {
  return apiFetchJson<ApiSuccessEnvelope<ExchangeRateRow>>(BASE, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function apiExchangeRateUpdate(
  token: string,
  id: number,
  payload: ExchangeRateUpdate
): Promise<ApiSuccessEnvelope<ExchangeRateRow>> {
  return apiFetchJson<ApiSuccessEnvelope<ExchangeRateRow>>(`${BASE}/${id}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function apiExchangeRateDeactivate(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<null>> {
  return apiFetchJson<ApiSuccessEnvelope<null>>(`${BASE}/${id}`, {
    method: "DELETE",
    token,
  });
}
