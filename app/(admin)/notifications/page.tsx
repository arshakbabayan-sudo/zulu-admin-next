/**
 * Phase Ա.8 (2026-05-28) — v1 Notifications inbox replaced by redirect to
 * the v2 redesign (/admin-redesign/notifications). Same backend API, just
 * different chrome. Old bookmarks keep working via this redirect.
 *
 * Per xlsx audit Rows 71/72.
 */

import { redirect } from "next/navigation";

export default function NotificationsRedirectPage() {
  redirect("/admin-redesign/notifications");
}
