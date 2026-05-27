/**
 * Phase Ա.4 (2026-05-28) — PIN settings merged under My profile > Security.
 *
 * Per xlsx audit Row 28, the PIN management UI belongs alongside 2FA,
 * password change, and active sessions — i.e. under the Security sub-tab
 * of /admin-redesign/profile. The standalone /bucket3/pin-settings entry
 * was a sidebar duplicate; we keep the URL alive as a redirect so existing
 * bookmarks land on the right place.
 *
 * Backend untouched — PIN endpoints (/account/pin) remain as they were.
 */

import { redirect } from "next/navigation";

export default function PinSettingsRedirectPage() {
  redirect("/admin-redesign/profile?tab=security");
}
