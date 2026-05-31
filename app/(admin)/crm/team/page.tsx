"use client";

import { CrmComingSoon } from "@/components/crm/CrmComingSoon";
import { Trophy } from "lucide-react";

export default function CrmTeamPage() {
  return (
    <CrmComingSoon
      activeHref="/crm/team"
      title="Team"
      subtitle="Sales performance by employee — who sold what this period"
      icon={<Trophy className="h-10 w-10" />}
      message="Per-employee sales tracking and the flexible payroll (fixed + percent) is being built next."
    />
  );
}
