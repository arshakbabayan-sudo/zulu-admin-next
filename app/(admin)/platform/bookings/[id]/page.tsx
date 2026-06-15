"use client";

/**
 * /platform/bookings/[id] — deep-link straight into the All-bookings full-page
 * in-pane detail of the unified BookingsPage. 1:1 port of
 * docs/admin_designe/3_Bookings/bookings.html (2026-06-15). The old standalone
 * V2 detail page was folded into the in-pane detail (Back restores the list).
 */

import { useParams } from "next/navigation";
import { BookingsPage } from "../../_bookings/BookingsPage";

export default function PlatformBookingDetailPage() {
  const params = useParams();
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  return <BookingsPage initialTab="bookings" initialBookingId={id} />;
}
