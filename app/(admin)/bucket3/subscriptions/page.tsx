"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function SubscriptionsPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.11"
      title="Subscriptions"
      description="Premium tier for operators — recurring monthly/annual plans that unlock additional features (priority placement, advanced analytics, API access)."
      features={[
        "Plan catalog (Free / Pro / Enterprise)",
        "Auto-renew via Stripe (when payment integration ships)",
        "Plan-gated features toggle in operator settings",
      ]}
    />
  );
}
