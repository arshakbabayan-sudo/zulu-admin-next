"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function CustomFieldsPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.4"
      title="Custom Fields"
      description="Operators add custom fields to their offer schemas (hotel amenities, flight perks, etc.) without touching code."
      features={[
        "Field types: text, number, boolean, select, multi-select",
        "Scope to a specific offer type or apply globally",
        "Render in operator forms and search filters automatically",
      ]}
    />
  );
}
