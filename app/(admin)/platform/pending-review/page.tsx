"use client";

/**
 * /platform/pending-review — unified Management page (Pending review tab).
 * 1:1 port of docs/admin_designe/7_Management/management.html (2026-06-15):
 * Pending review is now an in-page pane (Approvals cluster) of MgmtPage instead
 * of a standalone V2 page.
 */

import { MgmtPage } from "../management/MgmtPage";

export default function PlatformPendingReviewPage() {
  return <MgmtPage initialTab="pendingReview" />;
}
