"use client";

import { CrmComingSoon } from "@/components/crm/CrmComingSoon";
import { Briefcase } from "lucide-react";

export default function CrmDealsPage() {
  return (
    <CrmComingSoon
      activeHref="/crm/deals"
      title="Deals"
      subtitle="Opportunity pipeline by stage"
      icon={<Briefcase className="h-10 w-10" />}
    />
  );
}
