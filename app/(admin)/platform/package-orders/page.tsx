"use client";

/**
 * /platform/package-orders — renders the unified BookingsPage (Package orders
 * tab). 1:1 port of docs/admin_designe/3_Bookings/bookings.html (2026-06-15).
 * The old standalone V2 page was replaced by the in-page Package-orders pane.
 */

import { BookingsPage } from "../_bookings/BookingsPage";

export default function PlatformPackageOrdersPage() {
  return <BookingsPage initialTab="packages" />;
}
