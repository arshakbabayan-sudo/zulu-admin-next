"use client";

/**
 * /bucket3/per-x-invoicing — unified FinancePage (Per-X invoicing tab,
 * super-admin only). 1:1 port of docs/admin_designe/6_Finance/finance.html
 * (2026-06-15).
 */

import { FinancePage } from "../../platform/_finance/FinancePage";

export default function PerXInvoicingPage() {
  return <FinancePage initialTab="perx" />;
}
