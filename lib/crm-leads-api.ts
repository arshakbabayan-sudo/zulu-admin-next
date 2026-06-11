/**
 * CRM Leads + Segments API client.
 * Backend: CrmController @ /platform-admin/crm/leads + /crm/segments
 * (2026-06-12, roadmap §4 — the two former "coming soon" CRM tabs).
 */
import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export const CRM_LEAD_SOURCES = ["website", "referral", "social", "walk_in", "partner"] as const;
export type CrmLeadSource = (typeof CRM_LEAD_SOURCES)[number];

export const CRM_LEAD_INTERESTS = ["hotel", "flight", "package", "tour", "transfer"] as const;
export type CrmLeadInterest = (typeof CRM_LEAD_INTERESTS)[number];

export const CRM_LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified", "converted"] as const;
export type CrmLeadStatus = (typeof CRM_LEAD_STATUSES)[number];
/** Statuses settable from the UI ('converted' only via the Convert action). */
export const CRM_LEAD_SETTABLE_STATUSES = ["new", "contacted", "qualified", "unqualified"] as const;

export type CrmLead = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  b2b_company: string | null;
  source: CrmLeadSource | null;
  interest: CrmLeadInterest | null;
  status: CrmLeadStatus;
  notes: string | null;
  company_id: number | null;
  owner: { id: number; name: string } | null;
  converted_deal_id: number | null;
  converted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CrmLeadsStats = {
  new_7d: number;
  qualified: number;
  unassigned: number;
  conversion_rate: number;
};

export const CRM_SEGMENT_TYPES = ["dynamic", "static"] as const;
export type CrmSegmentType = (typeof CRM_SEGMENT_TYPES)[number];

export type CrmSegmentRules = {
  min_bookings?: number;
  min_total_spent?: number;
  inactive_months?: number;
  active_months?: number;
};

export type CrmSegment = {
  id: number;
  name: string;
  description: string | null;
  type: CrmSegmentType;
  icon: string | null;
  rules: CrmSegmentRules | null;
  company_id: number | null;
  contacts_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type CrmSegmentContact = {
  id: number;
  name: string;
  email: string | null;
  status: string | null;
  bookings_count: number;
};

function qs(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ─── Leads ──────────────────────────────────────────────────────────────

export async function apiCrmLeads(
  token: string,
  params: { status?: string; source?: string; interest?: string; owner_user_id?: number; search?: string; per_page?: number; page?: number } = {},
): Promise<ApiSuccessEnvelope<CrmLead[]> & { meta: ApiListMeta }> {
  return apiFetchJson(`/platform-admin/crm/leads${qs(params)}`, { method: "GET", token });
}

export async function apiCrmLeadsStats(token: string): Promise<ApiSuccessEnvelope<CrmLeadsStats>> {
  return apiFetchJson(`/platform-admin/crm/leads/stats`, { method: "GET", token });
}

export type CrmLeadBody = Partial<{
  name: string;
  email: string | null;
  phone: string | null;
  b2b_company: string | null;
  source: string | null;
  interest: string | null;
  status: string;
  owner_user_id: number | null;
  notes: string | null;
}>;

export async function apiCreateCrmLead(token: string, body: CrmLeadBody): Promise<ApiSuccessEnvelope<CrmLead>> {
  return apiFetchJson(`/platform-admin/crm/leads`, { method: "POST", token, body });
}

export async function apiUpdateCrmLead(token: string, id: number, body: CrmLeadBody): Promise<ApiSuccessEnvelope<CrmLead>> {
  return apiFetchJson(`/platform-admin/crm/leads/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteCrmLead(token: string, id: number): Promise<ApiSuccessEnvelope<null>> {
  return apiFetchJson(`/platform-admin/crm/leads/${id}`, { method: "DELETE", token });
}

export async function apiConvertCrmLead(
  token: string,
  id: number,
  body: { value_amount?: number; currency?: string } = {},
): Promise<ApiSuccessEnvelope<{ lead: CrmLead; deal_id: number }>> {
  return apiFetchJson(`/platform-admin/crm/leads/${id}/convert`, { method: "POST", token, body });
}

// ─── Segments ───────────────────────────────────────────────────────────

export async function apiCrmSegments(
  token: string,
  params: { search?: string } = {},
): Promise<ApiSuccessEnvelope<CrmSegment[]>> {
  return apiFetchJson(`/platform-admin/crm/segments${qs(params)}`, { method: "GET", token });
}

export type CrmSegmentBody = Partial<{
  name: string;
  description: string | null;
  type: CrmSegmentType;
  icon: string | null;
  rules: CrmSegmentRules | null;
}>;

export async function apiCreateCrmSegment(token: string, body: CrmSegmentBody): Promise<ApiSuccessEnvelope<CrmSegment>> {
  return apiFetchJson(`/platform-admin/crm/segments`, { method: "POST", token, body });
}

export async function apiUpdateCrmSegment(token: string, id: number, body: CrmSegmentBody): Promise<ApiSuccessEnvelope<CrmSegment>> {
  return apiFetchJson(`/platform-admin/crm/segments/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteCrmSegment(token: string, id: number): Promise<ApiSuccessEnvelope<null>> {
  return apiFetchJson(`/platform-admin/crm/segments/${id}`, { method: "DELETE", token });
}

export async function apiCrmSegmentContacts(
  token: string,
  id: number,
  params: { per_page?: number; page?: number } = {},
): Promise<ApiSuccessEnvelope<CrmSegmentContact[]> & { meta: ApiListMeta }> {
  return apiFetchJson(`/platform-admin/crm/segments/${id}/contacts${qs(params)}`, { method: "GET", token });
}

export async function apiAddCrmSegmentMember(
  token: string,
  id: number,
  userId: number,
): Promise<ApiSuccessEnvelope<{ contacts_count: number }>> {
  return apiFetchJson(`/platform-admin/crm/segments/${id}/members`, { method: "POST", token, body: { user_id: userId } });
}

export async function apiRemoveCrmSegmentMember(
  token: string,
  id: number,
  userId: number,
): Promise<ApiSuccessEnvelope<{ contacts_count: number }>> {
  return apiFetchJson(`/platform-admin/crm/segments/${id}/members/${userId}`, { method: "DELETE", token });
}
