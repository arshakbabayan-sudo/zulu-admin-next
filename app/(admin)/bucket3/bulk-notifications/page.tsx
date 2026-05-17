"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function BulkNotificationsPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.6"
      title="Send Notifications (bulk)"
      description="Operator marketing tool — broadcast SMS / email / push to a filtered customer segment."
      features={[
        "Filter recipients by tier, region, last booking",
        "Template library with merge fields",
        "Throttle limits + send-time scheduling",
      ]}
    />
  );
}
