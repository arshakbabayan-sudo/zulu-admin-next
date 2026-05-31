"use client";

/**
 * Phase 4C (2026-05-31) — redirect to Directory → B2C customers view.
 *
 * The standalone B2C customers list shipped in Phase 7.1 has been
 * consolidated into the unified Directory page at /platform/users; this
 * URL now redirects to the same backend data filtered to type=customers
 * (the chip strip at the top of the destination shows the active filter).
 *
 * The previous list page (full filters, table, export) lives in git
 * history if any of its UX needs to be ported back. The Directory grid
 * does not currently render the `bookings_count` column the old page
 * surfaced — captured as a follow-up in active_work.md (Phase 4C+).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BucketCustomersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/platform/users?type=customers");
  }, [router]);
  return (
    <div className="p-8 text-center text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>
      Redirecting to Directory → B2C customers…
    </div>
  );
}
