"use client";

/**
 * /platform/invoices — unified FinancePage (Invoices tab). 1:1 port of
 * docs/admin_designe/6_Finance/finance.html (2026-06-15).
 */

import { FinancePage } from "../_finance/FinancePage";

export default function PlatformInvoicesPage() {
  return <FinancePage initialTab="invoices" />;
}
