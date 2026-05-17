"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function BlockDatesPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.2"
      title="Block Dates"
      description="Operators block sales dates per hotel / flight / car to prevent overbooking when capacity is unavailable."
      features={[
        "Calendar view per inventory item",
        "Bulk-block ranges with reason notes",
        "Auto-block when external inventory is sold out",
      ]}
    />
  );
}
