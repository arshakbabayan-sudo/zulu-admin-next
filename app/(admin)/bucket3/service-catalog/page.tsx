"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function ServiceCatalogPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.12"
      title="Service Catalog"
      description="Generic catalog of bookable services that sits alongside the inventory verticals (hotels, flights, etc.) — for one-off, custom, or composite services."
      features={[
        "Add ad-hoc service entries that aren't a standard inventory type",
        "Combine with existing inventory items into curated bundles",
        "Surface in homepage search alongside standard offers",
      ]}
    />
  );
}
