/**
 * Phase Ա.6 (2026-05-28) — Unverified accounts merged into Users page filter.
 *
 * Per xlsx audit Row 41, this cleanup workflow is a subset of the platform-wide
 * Users list. /platform/users already exposes a `type=unverified` filter option,
 * so the separate /bucket3/unverified-accounts entry just multiplied sidebar
 * clutter without adding capability. We keep the URL alive as a redirect for
 * back-compat with bookmarks and any Telegram alert deep links.
 */

import { redirect } from "next/navigation";

export default function UnverifiedAccountsRedirectPage() {
  redirect("/platform/users?type=unverified");
}
