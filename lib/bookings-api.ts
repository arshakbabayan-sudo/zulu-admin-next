import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export type BookingRow = {
  id: number;
  booking_reference?: string | null;
  status: string;
  total_amount?: number | null;
  currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  company?: { id: number; name: string } | null;
  user?: { id: number; name: string; email: string } | null;
  offer?: { id: number; title: string; type: string } | null;
};

export async function apiBookings(
  token: string,
  params: { page?: number; per_page?: number; status?: string }
): Promise<ApiSuccessEnvelope<BookingRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetchJson(`/bookings${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiBooking(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<BookingRow>> {
  return apiFetchJson(`/bookings/${id}`, { method: "GET", token });
}

export async function apiConfirmBooking(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<BookingRow>> {
  return apiFetchJson(`/bookings/${id}/confirm`, { method: "POST", token, body: {} });
}

export async function apiCancelBooking(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<BookingRow>> {
  return apiFetchJson(`/bookings/${id}/cancel`, { method: "POST", token, body: {} });
}
