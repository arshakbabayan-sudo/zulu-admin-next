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
  params: {
    page?: number;
    per_page?: number;
    status?: string;
    /** Phase 7.6 — ISO date YYYY-MM-DD (inclusive). */
    from?: string;
    /** Phase 7.6 — ISO date YYYY-MM-DD (inclusive end-of-day). */
    to?: string;
  }
): Promise<ApiSuccessEnvelope<InvoiceRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const qs = q.toString();
  return apiFetchJson(`/invoices${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

/**
 * Phase 7.6 — fetch CSV export as a Blob and trigger a browser download.
 * Uses the bearer token + same proxy path as JSON endpoints (the proxy
 * forwards arbitrary content-types).
 */
export async function downloadInvoicesCsv(
  token: string,
  params: { status?: string; from?: string; to?: string }
): Promise<void> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8008/api";
  const url = `${base}/invoices/export${q.toString() ? `?${q.toString()}` : ""}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/csv",
    },
  });
  if (!resp.ok) {
    throw new Error(`Export failed: HTTP ${resp.status}`);
  }
  const blob = await resp.blob();
  const filename =
    resp.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ??
    `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
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

/**
 * Finance group v2 — Mark paid action on issued invoices.
 * Hits POST /invoices/{id}/pay which flips the status to paid and stamps
 * paid_at. Backend: InvoiceController::pay.
 */
export async function apiPayInvoice(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<InvoiceRow>> {
  return apiFetchJson(`/invoices/${id}/pay`, { method: "POST", token, body: {} });
}

/**
 * Finance group v2 — overdue invoice "Send reminder" action.
 * Backend: InvoiceController::sendReminder dispatches SendInvoiceReminderJob.
 * Throttled to once per 24h per invoice — backend returns 429 if hit too soon.
 */
export async function apiSendInvoiceReminder(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ message: string }>> {
  return apiFetchJson(`/invoices/${id}/send-reminder`, { method: "POST", token, body: {} });
}

/**
 * Order row for the New-invoice modal typeahead. Backed by the existing
 * GET /platform-admin/bookings?search= endpoint (paginated OrderResource
 * rows) — we only type the fields the picker actually renders.
 */
export type InvoiceOrderSearchRow = {
  /** Order UUID — what POST /invoices expects as order_id. */
  id: string;
  order_number?: string | null;
  status: string;
  total?: number | null;
  currency?: string | null;
  user?: { id: number; name: string; email?: string } | null;
  company?: { id: number; name: string } | null;
};

/**
 * New-invoice modal — searchable order picker. Reuses the platform-admin
 * bookings index whose `search` param matches order_number, customer
 * name/email and company name (PlatformAdminService::listAllBookings).
 */
export async function apiSearchOrdersForInvoice(
  token: string,
  q: string
): Promise<ApiSuccessEnvelope<InvoiceOrderSearchRow[]> & { meta: ApiListMeta }> {
  const params = new URLSearchParams({ search: q, per_page: "10" });
  return apiFetchJson(`/platform-admin/bookings?${params.toString()}`, { method: "GET", token });
}

/**
 * Finance group v2 — Phase 2e Quick Actions.
 * Creates a new invoice for the given order. Backend computes the invoice
 * lines from the order's items (see InvoiceService::createForOrder).
 */
export async function apiStoreInvoice(
  token: string,
  orderId: string
): Promise<ApiSuccessEnvelope<InvoiceRow>> {
  return apiFetchJson("/invoices", { method: "POST", token, body: { order_id: orderId } });
}
