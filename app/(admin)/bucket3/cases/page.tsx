"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function CasesPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.10"
      title="Cases & Assignments"
      description="Advanced support case mgmt — long-running issues that span multiple tickets or require ownership assignment."
      features={[
        "Case = bundle of related tickets + activity timeline",
        "Assign to a specific support agent with SLA timer",
        "Escalation rules when SLA breached",
      ]}
    />
  );
}
