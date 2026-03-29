import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

const BASE = "/support/tickets";

export type SupportTicketListRow = {
  id: number;
  subject: string;
  status: string;
  priority: string;
  company_id: number | null;
  messages_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  user?: { id: number; name: string; email: string } | null;
};

export type SupportTicketMessage = {
  id: number;
  message: string;
  is_admin_reply: boolean;
  created_at?: string | null;
  user?: { id: number; name: string; email: string } | null;
};

export type SupportTicketDetail = {
  id: number;
  subject: string;
  status: string;
  priority: string;
  company_id: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  user?: { id: number; name: string; email: string } | null;
  messages: SupportTicketMessage[];
};

export async function apiSupportTickets(
  token: string,
  params: {
    page?: number;
    per_page?: number;
    status?: string;
    priority?: string;
    search?: string;
    company_id?: number;
  }
): Promise<ApiSuccessEnvelope<SupportTicketListRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  if (params.priority) q.set("priority", params.priority);
  if (params.search) q.set("search", params.search);
  if (params.company_id != null && params.company_id > 0) {
    q.set("company_id", String(params.company_id));
  }
  const qs = q.toString();
  return apiFetchJson(`${BASE}${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiSupportTicket(
  token: string,
  id: number,
  companyId?: number
): Promise<ApiSuccessEnvelope<SupportTicketDetail>> {
  const q = new URLSearchParams();
  if (companyId != null && companyId > 0) q.set("company_id", String(companyId));
  const qs = q.toString();
  return apiFetchJson(`${BASE}/${id}${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiSupportTicketReply(
  token: string,
  id: number,
  message: string,
  companyId?: number
): Promise<ApiSuccessEnvelope<{ message: SupportTicketMessage }> & { message?: string }> {
  const q = new URLSearchParams();
  if (companyId != null && companyId > 0) q.set("company_id", String(companyId));
  const qs = q.toString();
  return apiFetchJson(`${BASE}/${id}/messages${qs ? `?${qs}` : ""}`, {
    method: "POST",
    token,
    body: { message },
  });
}
