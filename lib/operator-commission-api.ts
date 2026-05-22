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

export function calculationBaseLabel(base: CalculationBase): string {
  switch (base) {
    case "gross":
      return "Gross booking amount";
    case "post_platform_fee":
      return "Post platform fee (operator's net)";
    case "custom":
      return "Custom % of gross";
  }
}
