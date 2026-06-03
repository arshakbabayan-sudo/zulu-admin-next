/**
 * Contract & Contract Template API — Phase 5 of admin redesign.
 *
 * Admin endpoints under /platform-admin/contracts and /platform-admin/contract-templates
 * (see AdminContractController + AdminContractTemplateController).
 * Seller-side endpoints under /seller/contracts (see SellerContractController).
 *
 * 2026-06-04 admin v3 — CONTRACT_TYPES, ContractTemplateRow/Detail, and the
 * Create/Update payload were realigned with the backend `ContractTemplate`
 * model (`docs/blueprints/html-handoff/Management_tab.md` TAB 4):
 *   - 4 type values: platform · partner_supplier · partner_reseller · partner_default
 *     (the old `["platform","partner"]` only allowed the first; PATCH would 422 on the
 *     other 3 even though seeded templates carry them).
 *   - `body` / `variables` / `active` replace the wrong `body_template` /
 *     `default_variables` / `is_published` names. The old names were silently
 *     dropped by Laravel's validate() — that's why the edit form opened EMPTY.
 *   - `version` is a server-managed int, not a free-text string.
 *
 * Status flow: draft → sent → signed_by_a/signed_by_b → countersigned → active → expired/terminated/disputed.
 */
import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

const PA = "/platform-admin";

export const CONTRACT_TYPES = [
  "platform",
  "partner_supplier",
  "partner_reseller",
  "partner_default",
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_STATUSES = [
  "draft",
  "sent",
  "signed_by_a",
  "signed_by_b",
  "countersigned",
  "active",
  "expired",
  "terminated",
  "disputed",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_LANGUAGES = ["hy", "en", "ru"] as const;
export type ContractLanguage = (typeof CONTRACT_LANGUAGES)[number];

export type ContractParty = { id: number; name: string };

export type ContractTemplateRow = {
  id: string;
  name: string;
  type: ContractType;
  language: ContractLanguage;
  /** Server int — bumped on body change. Older code passed/parsed it as
   *  string; both forms accepted for backward compat while pages migrate. */
  version: number | string | null;
  /** Live boolean toggle from the backend model. Replaces the old phantom
   *  `is_published` which the backend silently ignored. */
  active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ContractTemplateDetail = ContractTemplateRow & {
  /** Body text with `{{placeholders}}` (backend `body` column). */
  body?: string | null;
  /** Default `{{placeholder}} → value` map (backend `variables` jsonb). */
  variables?: Record<string, unknown> | null;
};

export type ContractRow = {
  id: string;
  contract_number: string;
  type: ContractType;
  status: ContractStatus;
  party_a_company_id: number | null;
  party_b_company_id: number;
  template_id: string;
  language: ContractLanguage;
  effective_date: string | null;
  expiry_date: string | null;
  auto_renew: boolean | null;
  termination_notice_days: number | null;
  signed_pdf_url: string | null;
  terminated_at?: string | null;
  termination_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  partyA?: ContractParty | null;
  partyB?: ContractParty | null;
  template?: Pick<ContractTemplateRow, "id" | "name" | "type" | "language" | "version"> | null;
};

export type ContractVersionRow = {
  id: string;
  contract_id: string;
  version_number: number;
  body_snapshot?: Record<string, unknown> | null;
  created_by_user_id?: number | null;
  created_at?: string | null;
};

export type ContractDetail = ContractRow & {
  commission_clause?: Record<string, unknown> | null;
  payment_terms?: Record<string, unknown> | null;
  cancellation_policy?: Record<string, unknown> | null;
  rendered_body?: Record<string, unknown> | null;
  signatures?: Record<string, unknown> | null;
  createdBy?: { id: number; name: string; email: string } | null;
  versions?: ContractVersionRow[];
};

/* ------------------------------ Admin: contracts ------------------------------ */

export async function apiAdminContracts(
  token: string,
  params: { page?: number; per_page?: number; status?: ContractStatus | ""; type?: ContractType | ""; q?: string }
): Promise<ApiSuccessEnvelope<ContractRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  if (params.type) q.set("type", params.type);
  if (params.q && params.q.trim() !== "") q.set("q", params.q.trim());
  const qs = q.toString();
  return apiFetchJson(`${PA}/contracts${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiAdminContract(
  token: string,
  id: string
): Promise<ApiSuccessEnvelope<ContractDetail>> {
  return apiFetchJson(`${PA}/contracts/${id}`, { method: "GET", token });
}

export type CreateContractPayload = {
  template_id: string;
  party_a_company_id?: number | null;
  party_b_company_id: number;
  variables?: Record<string, unknown>;
  commission_clause?: Record<string, unknown>;
  payment_terms?: Record<string, unknown>;
  cancellation_policy?: Record<string, unknown>;
  effective_date?: string | null;
  expiry_date?: string | null;
  auto_renew?: boolean;
  termination_notice_days?: number;
  language?: ContractLanguage;
};

export async function apiAdminCreateContract(
  token: string,
  body: CreateContractPayload
): Promise<ApiSuccessEnvelope<ContractDetail>> {
  return apiFetchJson(`${PA}/contracts`, {
    method: "POST",
    token,
    body: body as unknown as Record<string, unknown>,
  });
}

export async function apiAdminSendContract(
  token: string,
  id: string
): Promise<ApiSuccessEnvelope<ContractDetail>> {
  return apiFetchJson(`${PA}/contracts/${id}/send`, { method: "POST", token, body: {} });
}

export async function apiAdminCountersignContract(
  token: string,
  id: string
): Promise<ApiSuccessEnvelope<ContractDetail>> {
  return apiFetchJson(`${PA}/contracts/${id}/countersign`, { method: "POST", token, body: {} });
}

export async function apiAdminTerminateContract(
  token: string,
  id: string,
  reason: string
): Promise<ApiSuccessEnvelope<ContractDetail>> {
  return apiFetchJson(`${PA}/contracts/${id}/terminate`, {
    method: "POST",
    token,
    body: { reason },
  });
}

/* ----------------------------- Admin: templates ----------------------------- */

export async function apiAdminContractTemplates(
  token: string,
  params: { page?: number; per_page?: number; type?: ContractType | ""; language?: ContractLanguage | "" }
): Promise<ApiSuccessEnvelope<ContractTemplateRow[]> & { meta?: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.type) q.set("type", params.type);
  if (params.language) q.set("language", params.language);
  const qs = q.toString();
  return apiFetchJson(`${PA}/contract-templates${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiAdminContractTemplate(
  token: string,
  id: string
): Promise<ApiSuccessEnvelope<ContractTemplateDetail>> {
  return apiFetchJson(`${PA}/contract-templates/${id}`, { method: "GET", token });
}

export type CreateContractTemplatePayload = {
  name: string;
  type: ContractType;
  language: ContractLanguage;
  body: string;
  variables?: Record<string, unknown>;
  active?: boolean;
};

export async function apiAdminCreateContractTemplate(
  token: string,
  body: CreateContractTemplatePayload
): Promise<ApiSuccessEnvelope<ContractTemplateDetail>> {
  return apiFetchJson(`${PA}/contract-templates`, {
    method: "POST",
    token,
    body: body as unknown as Record<string, unknown>,
  });
}

export async function apiAdminUpdateContractTemplate(
  token: string,
  id: string,
  body: Partial<CreateContractTemplatePayload>
): Promise<ApiSuccessEnvelope<ContractTemplateDetail>> {
  return apiFetchJson(`${PA}/contract-templates/${id}`, {
    method: "PATCH",
    token,
    body: body as Record<string, unknown>,
  });
}

/* ------------------------------ Seller-side ------------------------------ */

/** Seller endpoint returns plain array (no pagination wrapper). */
export async function apiSellerContracts(
  token: string
): Promise<ApiSuccessEnvelope<ContractRow[]>> {
  return apiFetchJson(`/seller/contracts`, { method: "GET", token });
}

export async function apiSellerContract(
  token: string,
  id: string
): Promise<ApiSuccessEnvelope<ContractDetail>> {
  return apiFetchJson(`/seller/contracts/${id}`, { method: "GET", token });
}

export async function apiSellerSignContract(
  token: string,
  id: string
): Promise<ApiSuccessEnvelope<ContractDetail>> {
  return apiFetchJson(`/seller/contracts/${id}/sign`, { method: "POST", token, body: {} });
}

/* -------------------------------- Helpers -------------------------------- */

/** Status pill color tier — used by StatusPill / OfferStatusBadge-style chip. */
export function contractStatusTier(status: ContractStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "draft":
      return "neutral";
    case "sent":
    case "signed_by_a":
    case "signed_by_b":
      return "info";
    case "countersigned":
    case "active":
      return "success";
    case "expired":
    case "disputed":
      return "warning";
    case "terminated":
      return "danger";
  }
}

export function contractStatusLabel(status: ContractStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent to partner";
    case "signed_by_a":
      return "Signed by ZULU";
    case "signed_by_b":
      return "Signed by partner";
    case "countersigned":
      return "Countersigned";
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "terminated":
      return "Terminated";
    case "disputed":
      return "Disputed";
  }
}

export function contractTypeLabel(type: ContractType): string {
  switch (type) {
    case "platform":
      return "Platform (ZULU ↔ partner)";
    case "partner_supplier":
      return "Partner — supplier";
    case "partner_reseller":
      return "Partner — reseller";
    case "partner_default":
      return "Partner — default";
  }
}
