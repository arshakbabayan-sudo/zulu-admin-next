"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function RequestsPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.7"
      title="Requests inbox"
      description="Agent → Operator special booking requests outside the standard flow (custom packages, off-catalog rates, group bookings)."
      features={[
        "Inbox-style queue with status (open / in-progress / closed)",
        "Reply thread per request",
        "Convert accepted request into a quotable offer",
      ]}
    />
  );
}
