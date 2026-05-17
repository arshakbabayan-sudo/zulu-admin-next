"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function PerXInvoicingPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.3"
      title="Per-X Invoicing"
      description="Consolidate invoicing across per-booking, per-operator, per-agent, and per-service slices."
      features={[
        "Group invoices by booking, operator, agent, or service type",
        "Bulk-generate monthly statements per slice",
        "Export to CSV / PDF for accounting hand-off",
      ]}
    />
  );
}
