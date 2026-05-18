/**
 * Phase 7.7 — Agent ↔ Operator requests inbox API client.
 * Backend: AgentOperatorRequestController @ /agent-operator-requests.
 */
import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export const REQUEST_STATUSES = ["open", "in_progress", "resolved", "rejected"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type RequestPartyRef = { id: number; name: string; email?: string };

export type RequestInboxRow = {
  id: number;
  subject: string;
  body: string;
  status: RequestStatus;
  resolution_notes: string | null;
  requester: RequestPartyRef | null;
  requester_company: { id: number; name: string } | null;
  target_company: { id: number; name: string } | null;
  resolved_by: { id: number; name: string } | null;
  resolved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type InboxBox = "all" | "inbox" | "outbox";

export async function apiRequestsInbox(
  token: string,
  params: { box?: InboxBox; status?: RequestStatus | ""; page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<RequestInboxRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.box && params.box !== "all") q.set("box", params.box);
  if (params.status) q.set("status", params.status);
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/agent-operator-requests${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiCreateRequest(
  token: string,
  body: { target_company_id: number; subject: string; body: string }
): Promise<ApiSuccessEnvelope<RequestInboxRow>> {
  return apiFetchJson(`/agent-operator-requests`, {
    method: "POST",
    token,
    body: body as unknown as Record<string, unknown>,
  });
}

export async function apiUpdateRequestStatus(
  token: string,
  id: number,
  body: { status: RequestStatus; resolution_notes?: string | null }
): Promise<ApiSuccessEnvelope<RequestInboxRow>> {
  return apiFetchJson(`/agent-operator-requests/${id}/status`, {
    method: "PATCH",
    token,
    body: body as unknown as Record<string, unknown>,
  });
}

export function requestStatusTier(s: RequestStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (s) {
    case "open":
      return "info";
    case "in_progress":
      return "warning";
    case "resolved":
      return "success";
    case "rejected":
      return "danger";
  }
}

export function requestStatusLabel(s: RequestStatus): string {
  switch (s) {
    case "open":
      return "Open";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
    case "rejected":
      return "Rejected";
  }
}
