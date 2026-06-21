/**
 * B2b — seller FX-rate (operator bank rate + absolute margin) API client.
 *
 * Backend B2a shipped two surfaces (Bearer JSON, {success,data} envelope):
 *
 *  • Operator/agent SELF (company + scope pinned server-side — the UI does NOT
 *    send company_id/scope):
 *      GET /operator/seller-fx-rate
 *      PUT /operator/seller-fx-rate          body: SellerFxSelfPayload
 *
 *  • Super-admin PLATFORM/any:
 *      GET  /platform-admin/seller-fx-rates  (?scope/?company_id/?target_currency)
 *      POST /platform-admin/seller-fx-rates  body: SellerFxPlatformPayload
 *      PUT  /platform-admin/seller-fx-rates/{id}
 *
 * The model: the customer pays at the operator's chosen bank rate PLUS an
 * ABSOLUTE margin (no FX risk). source 'cba' uses the Central Bank auto rate;
 * 'manual' lets the operator enter their own bank's rate per currency. `margin`
 * is ABSOLUTE points added to the rate (e.g. 400 + 2 = 402 AMD/USD), NOT percent.
 *
 * Mirrors lib/operator-commission-api.ts — same conventions: paths WITHOUT /api
 * (api-client prepends getApiBaseUrl which already ends in /api); literal-union
 * types; {success,data} envelopes; field-level 422 errors surface through
 * ApiRequestError.message (api-client.ts) / ApiRequestError.body.errors.
 */
import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export const FX_SOURCES = ["cba", "manual"] as const;
export type SellerFxSource = (typeof FX_SOURCES)[number];

export const FX_SCOPES = ["platform", "operator", "agent"] as const;
export type SellerFxScope = (typeof FX_SCOPES)[number];

/** Per-currency manual rate to the target currency (AMD by default). */
export type SellerFxManualRates = {
  USD?: number;
  EUR?: number;
  AMD?: number;
};

/**
 * A persisted seller-fx-rate row as returned by the backend. Fields are read
 * defensively — different surfaces (self vs platform list) may omit scope/
 * company_id (self pins them server-side).
 */
export type SellerFxRateRow = {
  id: number;
  scope: SellerFxScope;
  company_id: number | null;
  company_name?: string | null;
  source: SellerFxSource;
  margin: number;
  manual_rates: SellerFxManualRates | null;
  is_active: boolean;
  target_currency: string;
  updated_at?: string | null;
};

/** Operator/agent self PUT body (company + scope are pinned server-side). */
export type SellerFxSelfPayload = {
  source: SellerFxSource;
  margin: number;
  manual_rates?: SellerFxManualRates;
  is_active?: boolean;
  target_currency?: string;
};

/** Super-admin POST/PUT body — adds scope + (for operator/agent) company_id. */
export type SellerFxPlatformPayload = SellerFxSelfPayload & {
  scope: SellerFxScope;
  company_id?: number;
};

// ── Operator / agent SELF ────────────────────────────────────────
// company + scope pinned server-side from the caller — no company picker.

export async function apiSellerFxGet(
  token: string
): Promise<ApiSuccessEnvelope<SellerFxRateRow | null>> {
  return apiFetchJson(`/operator/seller-fx-rate`, { method: "GET", token });
}

export async function apiSellerFxUpdate(
  token: string,
  body: SellerFxSelfPayload
): Promise<ApiSuccessEnvelope<SellerFxRateRow>> {
  return apiFetchJson(`/operator/seller-fx-rate`, {
    method: "PUT",
    token,
    body: body as unknown as Record<string, unknown>,
  });
}

// ── Super-admin PLATFORM / any company ───────────────────────────

export async function apiPlatformSellerFxList(
  token: string,
  params: { scope?: SellerFxScope; company_id?: number; target_currency?: string } = {}
): Promise<ApiSuccessEnvelope<SellerFxRateRow[]>> {
  const q = new URLSearchParams();
  if (params.scope) q.set("scope", params.scope);
  if (params.company_id != null) q.set("company_id", String(params.company_id));
  if (params.target_currency) q.set("target_currency", params.target_currency);
  const qs = q.toString();
  return apiFetchJson(`/platform-admin/seller-fx-rates${qs ? `?${qs}` : ""}`, {
    method: "GET",
    token,
  });
}

export async function apiPlatformSellerFxCreate(
  token: string,
  body: SellerFxPlatformPayload
): Promise<ApiSuccessEnvelope<SellerFxRateRow>> {
  return apiFetchJson(`/platform-admin/seller-fx-rates`, {
    method: "POST",
    token,
    body: body as unknown as Record<string, unknown>,
  });
}

export async function apiPlatformSellerFxUpdate(
  token: string,
  id: number,
  body: SellerFxPlatformPayload
): Promise<ApiSuccessEnvelope<SellerFxRateRow>> {
  return apiFetchJson(`/platform-admin/seller-fx-rates/${id}`, {
    method: "PUT",
    token,
    body: body as unknown as Record<string, unknown>,
  });
}
