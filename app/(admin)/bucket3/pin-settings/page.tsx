"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function PinSettingsPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.14"
      title="PIN settings"
      description="Per-user PIN for sensitive admin actions (refunds, voids, force-close) on top of the regular login auth."
      features={[
        "Each admin user sets a 4-6 digit PIN",
        "Required for high-risk operations (refund > $X, manual confirm)",
        "Audit trail records PIN-confirmed actions separately",
      ]}
    />
  );
}
