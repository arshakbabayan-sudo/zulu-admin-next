"use client";

/**
 * Phase 4C (2026-05-31) — redirect to Directory → Staff view.
 *
 * The standalone cross-company employees roll-up has been consolidated
 * into the unified Directory page at /platform/users; this URL now
 * redirects to the same backend data filtered to type=staff (the chip
 * strip at the top of the destination shows the active filter).
 *
 * The Phase 7.5 page (platform-side roll-up + operator-side own-company
 * roll-up shipped in Phase R.4) lives in git history if any UX needs to
 * be ported back. The unified grid surfaces EMP-{id}, role badge, and
 * companies column — the legacy page added a Permissions drawer button
 * directly in the row actions; captured as a follow-up (Phase 4C+) in
 * active_work.md.
 *
 * Operator-side employee management gets its dedicated path back in the
 * planned final structure (Phase 4E + HR consolidation); for now the
 * redirect lands every viewer on the same Directory grid, with permission
 * gating filtering rows server-side.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BucketEmployeesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/platform/users?type=staff");
  }, [router]);
  return (
    <div className="p-8 text-center text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>
      Redirecting to Directory → Staff…
    </div>
  );
}
