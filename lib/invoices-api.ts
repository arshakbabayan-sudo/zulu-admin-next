import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export type InvoiceRow = {
  id: number;
  invoice_number?: string | null;
  status: string;
  total_amount: number;
  currency: string;
  issued_at?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  company?: { id: number; name: string } | null;
  booking?: { id: number; booking_reference?: string | null } | null;
};

export async function apiInvoices(
  token: string,
  params: { page?: number; per_page?: number; status?: string }
): Promise<ApiSuccessEnvelope<InvoiceRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetchJson(`/invoices${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiInvoice(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<InvoiceRow>> {
  return apiFetchJson(`/invoices/${id}`, { method: "GET", token });
}

export async function apiIssueInvoice(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<InvoiceRow>> {
  return apiFetchJson(`/invoices/${id}/issue`, { method: "POST", token, body: {} });
}

export async function apiCancelInvoice(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<InvoiceRow>> {
  return apiFetchJson(`/invoices/${id}/cancel`, { method: "POST", token, body: {} });
}
