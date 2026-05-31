/**
 * CRM API client — deals (sales pipeline) + activities (interaction log).
 * Backend: CrmController @ /platform-admin/crm/* (2026-06-01).
 */
import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export const CRM_DEAL_STAGES = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;
export type CrmDealStage = (typeof CRM_DEAL_STAGES)[number];

export const CRM_ACTIVITY_TYPES = ["call", "email", "meeting", "task", "note"] as const;
export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number];

export type CrmParty = { id: number; name: string; email?: string } | null;

export type CrmDeal = {
  id: number;
  title: string;
  value_amount: number;
  currency: string;
  service_type: string | null;
  stage: CrmDealStage;
  probability: number;
  source: string | null;
  expected_close_date: string | null;
  company_id: number | null;
  customer: CrmParty;
  owner: CrmParty;
  created_at: string | null;
  updated_at: string | null;
};

export type CrmActivity = {
  id: number;
  type: CrmActivityType;
  subject: string;
  body: string | null;
  subject_type: "customer" | "deal" | "lead" | null;
  subject_id: number | null;
  status: "open" | "done" | "overdue";
  due_at: string | null;
  completed_at: string | null;
  company_id: number | null;
  owner: CrmParty;
  created_at: string | null;
};

export type CrmStats = {
  open_deals: number;
  pipeline_value: number;
  won_deals: number;
  by_stage: Record<string, { stage: string; count: number; value: number }>;
};

function qs(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ─── Deals ──────────────────────────────────────────────────────────────

export async function apiCrmDeals(
  token: string,
  params: { stage?: string; owner_user_id?: number; search?: string; per_page?: number; page?: number } = {},
): Promise<ApiSuccessEnvelope<CrmDeal[]> & { meta: ApiListMeta }> {
  return apiFetchJson(`/platform-admin/crm/deals${qs(params)}`, { method: "GET", token });
}

export async function apiCreateCrmDeal(
  token: string,
  body: Partial<Pick<CrmDeal, "title" | "value_amount" | "currency" | "service_type" | "stage" | "probability" | "source" | "expected_close_date">> & {
    customer_user_id?: number;
    owner_user_id?: number;
    notes?: string;
  },
): Promise<ApiSuccessEnvelope<CrmDeal>> {
  return apiFetchJson(`/platform-admin/crm/deals`, { method: "POST", token, body });
}

export async function apiUpdateCrmDeal(
  token: string,
  id: number,
  body: Partial<{ stage: CrmDealStage; title: string; value_amount: number; probability: number; expected_close_date: string | null; notes: string }>,
): Promise<ApiSuccessEnvelope<CrmDeal>> {
  return apiFetchJson(`/platform-admin/crm/deals/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteCrmDeal(token: string, id: number): Promise<ApiSuccessEnvelope<null>> {
  return apiFetchJson(`/platform-admin/crm/deals/${id}`, { method: "DELETE", token });
}

// ─── Activities ─────────────────────────────────────────────────────────

export async function apiCrmActivities(
  token: string,
  params: { type?: string; status?: string; subject_type?: string; subject_id?: number; per_page?: number; page?: number } = {},
): Promise<ApiSuccessEnvelope<CrmActivity[]> & { meta: ApiListMeta }> {
  return apiFetchJson(`/platform-admin/crm/activities${qs(params)}`, { method: "GET", token });
}

export async function apiCreateCrmActivity(
  token: string,
  body: { type: CrmActivityType; subject: string; body?: string; subject_type?: "customer" | "deal" | "lead"; subject_id?: number; status?: string; due_at?: string },
): Promise<ApiSuccessEnvelope<CrmActivity>> {
  return apiFetchJson(`/platform-admin/crm/activities`, { method: "POST", token, body });
}

export async function apiUpdateCrmActivity(
  token: string,
  id: number,
  body: Partial<{ subject: string; body: string; status: string; due_at: string | null; completed_at: string | null }>,
): Promise<ApiSuccessEnvelope<CrmActivity>> {
  return apiFetchJson(`/platform-admin/crm/activities/${id}`, { method: "PATCH", token, body });
}

// ─── Stats ──────────────────────────────────────────────────────────────

export async function apiCrmStats(token: string): Promise<ApiSuccessEnvelope<CrmStats>> {
  return apiFetchJson(`/platform-admin/crm/stats`, { method: "GET", token });
}
