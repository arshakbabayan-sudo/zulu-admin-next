"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function UnverifiedAccountsPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.8"
      title="Unverified accounts"
      description="Extends the existing applications flow — surface accounts that signed up but never completed verification (KYC, business docs, banking)."
      features={[
        "List signups stuck mid-flow with elapsed time",
        "Nudge by email or SMS reminder",
        "Auto-suspend after N days inactive",
      ]}
    />
  );
}
