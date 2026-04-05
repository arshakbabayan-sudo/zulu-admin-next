import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

const BASE = "/connections";

/** Mirrors `ServiceConnection` API payloads (subset used by admin list). */
export type ConnectionRow = {
  id: number;
  source_type: string;
  source_id: number;
  target_type: string;
  target_id: number;
  connection_type: string;
  status: string;
  client_targeting?: string;
  selected_client_ids?: number[] | null;
  targeting?: {
    mode: "all" | "selected";
    client_ids?: number[];
  };
  city_rules?: {
    mode: "any" | "exact";
    source_cities: string[];
    target_cities: string[];
  } | null;
  status_history?: Array<{
    from: string | null;
    to: string;
    actor_id: number;
    at: string;
    notes: string | null;
  }> | null;
  company_id?: number;
  notes?: string | null;
  created_at?: string | null;
  company?: { id: number; name?: string } | null;
};

export const CONNECTION_SOURCE_TYPES = ["flight", "hotel", "transfer"] as const;
export const CONNECTION_TARGET_TYPES = ["flight", "hotel", "transfer"] as const;
export const CONNECTION_STATUSES = ["pending", "accepted", "rejected", "canceled"] as const;

export type ConnectionsListParams = {
  page?: number;
  per_page?: number;
  status?: string;
  source_type?: string;
  target_type?: string;
  company_id?: number;
};

export async function apiConnectionsList(
  token: string,
  params: ConnectionsListParams = {}
): Promise<ApiSuccessEnvelope<ConnectionRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  if (params.source_type) q.set("source_type", params.source_type);
  if (params.target_type) q.set("target_type", params.target_type);
  if (params.company_id != null && params.company_id > 0) {
    q.set("company_id", String(params.company_id));
  }
  const qs = q.toString();
  return apiFetchJson(`${BASE}${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export type ConnectionCreateBody = {
  source_type: string;
  source_id: number;
  target_type: string;
  target_id: number;
  connection_type: "only" | "both";
  targeting?: {
    mode: "all" | "selected";
    client_ids?: number[];
  };
  // Back-compat: older clients may still send these (API normalizes them).
  client_targeting?: "all" | "selected";
  selected_client_ids?: number[];
  city_rules?: {
    mode: "any" | "exact";
    source_cities?: string[];
    target_cities?: string[];
  };
  notes?: string | null;
};

export async function apiConnectionCreate(
  token: string,
  body: ConnectionCreateBody
): Promise<ApiSuccessEnvelope<ConnectionRow>> {
  return apiFetchJson(BASE, { method: "POST", token, body });
}

export type CompanyClientOption = {
  id: number;
  name: string;
  email: string;
  status?: string;
};

export async function apiCompanyClients(
  token: string,
  companyId: number
): Promise<ApiSuccessEnvelope<CompanyClientOption[]>> {
  return apiFetchJson(`/companies/${companyId}/users`, { method: "GET", token });
}

export async function apiConnectionAccept(
  token: string,
  id: number,
  notes?: string | null
): Promise<ApiSuccessEnvelope<ConnectionRow>> {
  return apiFetchJson(`${BASE}/${id}/accept`, {
    method: "PATCH",
    token,
    body: notes ? { notes } : {},
  });
}

export async function apiConnectionReject(
  token: string,
  id: number,
  notes?: string | null
): Promise<ApiSuccessEnvelope<ConnectionRow>> {
  return apiFetchJson(`${BASE}/${id}/reject`, {
    method: "PATCH",
    token,
    body: notes ? { notes } : {},
  });
}

export async function apiConnectionCancel(
  token: string,
  id: number,
  notes?: string | null
): Promise<ApiSuccessEnvelope<ConnectionRow>> {
  return apiFetchJson(`${BASE}/${id}/cancel`, {
    method: "PATCH",
    token,
    body: notes && notes.trim() ? { notes: notes.trim() } : {},
  });
}
