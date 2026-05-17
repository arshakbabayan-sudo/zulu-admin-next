"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function CustomersPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.1"
      title="Customers (B2C)"
      description="Manage end customers (B2C bookings) separately from operator/agent staff users. Highest-priority module in Phase 7."
      features={[
        "Customer list with contact details and booking history",
        "Per-customer notes, tags, lifetime spend",
        "Filter by loyalty tier and acquisition source",
      ]}
    />
  );
}
