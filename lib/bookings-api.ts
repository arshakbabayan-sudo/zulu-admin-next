import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

/**
 * Bookings list row (admin "All bookings" view at /platform/bookings).
 *
 * Backed by the `orders` table excluding package orders (see
 * PlatformAdminService::listAllBookings). UUID primary key; the shape
 * matches OrderResource so this stays consistent with the package-orders
 * page that also paginates Order rows.
 */
export type BookingRow = {
  id: string;
  order_number?: string | null;
  /** Legacy alias for order_number — left here in case some legacy callers
   *  still read this property. New code should use `order_number`. */
  booking_reference?: string | null;
  status: string;
  total?: number | null;
  /** Legacy alias for `total` */
  total_amount?: number | null;
  currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  company?: { id: number; name: string } | null;
  agent_company?: { id: number; name: string } | null;
  user?: { id: number; name: string; email: string } | null;
  /** First order_item's offer-derived summary (legacy single-offer view). */
  offer?: { id: number; title: string; type: string } | null;
  /** Raw order items if backend ships them — used to surface the first
   *  one as the "offer" cell. */
  items?: Array<{
    id: number;
    offer_id?: number | null;
    module_type?: string | null;
    title?: string | null;
  }> | null;
};

export type BookingsListParams = {
  page?: number;
  per_page?: number;
  status?: string;
  from?: string;
  to?: string;
  search?: string;
  company_id?: number;
  /**
   * Phase 4G (2026-05-31) — filter by booking owner. Used by the user
   * detail page to fetch recent bookings inline (per customer).
   */
  user_id?: number;
  service_type?: string;
};

export async function apiBookings(
  token: string,
  params: BookingsListParams,
): Promise<ApiSuccessEnvelope<BookingRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.search) q.set("search", params.search);
  if (params.company_id != null) q.set("company_id", String(params.company_id));
  if (params.user_id != null) q.set("user_id", String(params.user_id));
  if (params.service_type) q.set("service_type", params.service_type);
  const qs = q.toString();
  return apiFetchJson(`/platform-admin/bookings${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

/**
 * Phase 3B (2026-05-31) — single-booking detail. Backend endpoint
 * GET /platform-admin/bookings/{id} returns the same OrderResource shape
 * the confirm/cancel endpoints return, so we reuse BookingRow here.
 */
export async function apiBooking(
  token: string,
  id: string,
): Promise<ApiSuccessEnvelope<BookingRow>> {
  return apiFetchJson(`/platform-admin/bookings/${id}`, { method: "GET", token });
}

export async function apiConfirmBooking(
  token: string,
  id: string,
): Promise<ApiSuccessEnvelope<BookingRow>> {
  return apiFetchJson(`/platform-admin/bookings/${id}/confirm`, { method: "POST", token, body: {} });
}

export async function apiCancelBooking(
  token: string,
  id: string,
): Promise<ApiSuccessEnvelope<BookingRow>> {
  return apiFetchJson(`/platform-admin/bookings/${id}/cancel`, { method: "POST", token, body: {} });
}
