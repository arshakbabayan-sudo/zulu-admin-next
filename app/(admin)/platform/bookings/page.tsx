"use client";

/**
 * /platform/bookings — renders the unified BookingsPage (All bookings tab).
 * 1:1 port of docs/admin_designe/3_Bookings/bookings.html (2026-06-15).
 * The old standalone V2 page was replaced by the in-page All-bookings pane.
 */

import { BookingsPage } from "../_bookings/BookingsPage";

export default function PlatformBookingsPage() {
  return <BookingsPage initialTab="bookings" />;
}
