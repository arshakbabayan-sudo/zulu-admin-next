"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function NonServiceHoursPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.13"
      title="Non-service Hours"
      description="HR tooling — employee attendance, off-hours tracking, time-off requests. Only visible to operator/agent companies that enable HR features."
      features={[
        "Clock in / clock out per employee",
        "Time-off request workflow (request → approve)",
        "Roll up into a monthly attendance report",
      ]}
    />
  );
}
