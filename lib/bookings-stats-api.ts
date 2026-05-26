/**
 * Bookings group v2 — stats endpoint clients.
 *
 * Backend: app/Http/Controllers/Api/BookingsStatsController.php
 */

import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export type BookingsRange = "7d" | "30d" | "90d";

export type BookingsStats = {
  total_count: number;
  pending_count: number;
  confirmed_count: number;
  revenue_amount: number;
};

export type PackageOrdersStats = {
  total_count: number;
  paid_count: number;
  pending_count: number;
  total_value: number;
};

export async function apiBookingsStats(
  token: string,
  range: BookingsRange = "30d",
): Promise<ApiSuccessEnvelope<BookingsStats>> {
  return apiFetchJson(`/platform-admin/bookings/stats?range=${range}`, { method: "GET", token });
}

export async function apiPackageOrdersStats(
  token: string,
  range: BookingsRange = "30d",
): Promise<ApiSuccessEnvelope<PackageOrdersStats>> {
  return apiFetchJson(`/platform-admin/package-orders/stats?range=${range}`, { method: "GET", token });
}
