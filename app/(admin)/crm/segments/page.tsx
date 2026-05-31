"use client";

import { CrmComingSoon } from "@/components/crm/CrmComingSoon";
import { Filter } from "lucide-react";

export default function CrmSegmentsPage() {
  return (
    <CrmComingSoon
      activeHref="/crm/segments"
      title="Segments"
      subtitle="Saved contact segments for campaigns"
      icon={<Filter className="h-10 w-10" />}
    />
  );
}
