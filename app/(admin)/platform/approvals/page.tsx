"use client";

/**
 * Phase 2C step 2 (2026-05-31) — redirect placeholder.
 *
 * The Approval queue page used to be a unified inbox that visually
 * surfaced pending company applications / seller applications / offer
 * reviews / customer-review moderation. In practice it never owned the
 * approve/reject actions — those happen on the entity pages themselves
 * (Companies, Seller applications, Reviews, individual offer pages).
 *
 * Phase 1 removed the sidebar entry; Phase 2 dropped the Approval queue
 * tab from the Management strip. This file now redirects any remaining
 * bookmarks / breadcrumb back-links to /platform/companies — the most
 * common reason someone landed on the old Approval queue (new B2B partner
 * applications surface as pending companies there).
 *
 * The original page (~600 lines, MarketplaceOpsSectionTabs + 4 stat cards
 * + filter card + table + Approve/Reject row buttons) lives in git
 * history if any of its UX needs to be ported back to /platform/companies.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ApprovalsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/platform/companies");
  }, [router]);
  return (
    <div className="p-8 text-center text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>
      Redirecting to Management → Companies…
    </div>
  );
}
