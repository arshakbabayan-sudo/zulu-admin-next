"use client";

/**
 * /platform/finance-summary — unified FinancePage (Finance summary tab).
 * 1:1 port of docs/admin_designe/6_Finance/finance.html (2026-06-15). The old
 * standalone V2 page was replaced by the in-page Summary pane.
 */

import { FinancePage } from "../_finance/FinancePage";

export default function PlatformFinanceSummaryPage() {
  return <FinancePage initialTab="summary" />;
}
