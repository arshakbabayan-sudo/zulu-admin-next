"use client";

import { CrmComingSoon } from "@/components/crm/CrmComingSoon";
import { UserPlus } from "lucide-react";

export default function CrmLeadsPage() {
  return (
    <CrmComingSoon
      activeHref="/crm/leads"
      title="Leads"
      subtitle="Inbound inquiries and lead qualification"
      icon={<UserPlus className="h-10 w-10" />}
    />
  );
}
