/**
 * Phase Ա.1 (2026-05-28) — Packages oversight moved to /inventory/packages
 * to match the Hotels/Flights/etc. scope-toggle pattern. Old bookmarks
 * keep working via this redirect.
 */

import { redirect } from "next/navigation";

export default function PlatformPackagesRedirectPage() {
  redirect("/inventory/packages");
}
