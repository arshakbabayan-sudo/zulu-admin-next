"use client";

import { CrmComingSoon } from "@/components/crm/CrmComingSoon";
import { Workflow } from "lucide-react";

export default function CrmPipelinePage() {
  return (
    <CrmComingSoon
      activeHref="/crm/pipeline"
      title="Pipeline"
      subtitle="Sales pipeline overview across leads and deals"
      icon={<Workflow className="h-10 w-10" />}
      message="The sales pipeline, leads and deals are being built. The Customers tab is already live."
    />
  );
}
