"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function ServiceLogsPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.9"
      title="Service Logs"
      description="Activity tracking per booking / operator / agent — every consequential action grouped into a service log entry."
      features={[
        "Per-booking timeline (booked → confirmed → fulfilled → invoiced)",
        "Filter by actor, time range, action type",
        "Export to CSV for support investigations",
      ]}
    />
  );
}
