/**
 * Phase 6B — operator → agent commission settings API client.
 * Backend: OperatorCommissionController @ /operator/commission-settings.
 *
 * Three calculation bases per the roadmap: gross / post_platform_fee / custom.
 * Operator sets a default for all agents and optional per-agent overrides.
 * Booking-time entitlement creation lives in Phase 6B part 2 (FinanceService
 * extension); this client surfaces the configuration only.
 */
import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export const CALCULATION_BASES = ["gross", "post_platform_fee", "custom"] as const;
export type CalculationBase = (typeof CALCULATION_BASES)[number];

export type CommissionConfig = {
  id: number;
  agent_company_id: number | null;
  agent_company_name: string | null;
  calculation_base: CalculationBase;
  default_percentage: number | null;
  custom_base_percentage: number | null;
  notes: string | null;
  updated_at: string | null;
};

export type CommissionSettingsResponse = {
  operator_company_id: number;
  available_bases: CalculationBase[];
  default: CommissionConfig | null;
  overrides: CommissionConfig[];
};

export type CommissionPayload = {
  calculation_base: CalculationBase;
  default_percentage?: number | null;
  custom_base_percentage?: number | null;
  notes?: string | null;
};

/**
 * Phase 7.3 — platform-admin viewing a specific company's commission settings
 * passes companyId; the backend scopes to that company. Without companyId the
 * endpoint falls back to the caller's own active operator company (legacy
 * Phase 6B behaviour, kept for the /operator/commission-settings page).
 */
function withCompanyQuery(path: string, companyId?: number): string {
  if (!companyId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}company_id=${companyId}`;
}

export async function apiCommissionSettings(
  token: string,
  companyId?: number
): Promise<ApiSuccessEnvelope<CommissionSettingsResponse>> {
  return apiFetchJson(withCompanyQuery(`/operator/commission-settings`, companyId), {
    method: "GET",
    token,
  });
}

export async function apiUpsertCommissionDefault(
  token: string,
  body: CommissionPayload,
  companyId?: number
): Promise<ApiSuccessEnvelope<CommissionSettingsResponse>> {
  return apiFetchJson(withCompanyQuery(`/operator/commission-settings`, companyId), {
    method: "PATCH",
    token,
    body: body as unknown as Record<string, unknown>,
  });
}

export async function apiUpsertCommissionOverride(
  token: string,
  agentCompanyId: number,
  body: CommissionPayload,
  companyId?: number
): Promise<ApiSuccessEnvelope<CommissionSettingsResponse>> {
  return apiFetchJson(
    withCompanyQuery(`/operator/commission-settings/agents/${agentCompanyId}`, companyId),
    {
      method: "PATCH",
      token,
      body: body as unknown as Record<string, unknown>,
    },
  );
}

export async function apiDeleteCommissionOverride(
  token: string,
  agentCompanyId: number,
  companyId?: number
): Promise<ApiSuccessEnvelope<CommissionSettingsResponse>> {
  return apiFetchJson(
    withCompanyQuery(`/operator/commission-settings/agents/${agentCompanyId}`, companyId),
    {
      method: "DELETE",
      token,
    },
  );
}

/** ui_translations keys for the calculation-base labels (seeded en/hy/ru). */
const CALCULATION_BASE_LABEL_KEYS: Record<CalculationBase, string> = {
  gross: "admin.commission.base_gross",
  post_platform_fee: "admin.commission.base_post_platform_fee",
  custom: "admin.commission.base_custom",
};

/** English fallbacks used before the ui_translations rows are seeded. */
const CALCULATION_BASE_LABEL_FALLBACKS: Record<CalculationBase, string> = {
  gross: "Gross booking amount",
  post_platform_fee: "Post platform fee (operator's net)",
  custom: "Custom % of gross",
};

/**
 * Human label for a calculation base. Pass LanguageContext's `t` to get the
 * localized label (admin.commission.base_* keys); without `t` — or while the
 * DB rows aren't seeded yet (t returns the key) — it falls back to English,
 * so existing `calculationBaseLabel(base)` callers keep working unchanged.
 */
export function calculationBaseLabel(
  base: CalculationBase,
  t?: (key: string) => string,
): string {
  const fallback = CALCULATION_BASE_LABEL_FALLBACKS[base];
  if (!t) return fallback;
  const key = CALCULATION_BASE_LABEL_KEYS[base];
  const translated = t(key);
  return translated === key ? fallback : translated;
}
