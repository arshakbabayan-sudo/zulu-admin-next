"use client";

import { CrmComingSoon } from "@/components/crm/CrmComingSoon";
import { ListChecks } from "lucide-react";

export default function CrmActivitiesPage() {
  return (
    <CrmComingSoon
      activeHref="/crm/activities"
      title="Activities"
      subtitle="Calls, emails, meetings, tasks and follow-ups"
      icon={<ListChecks className="h-10 w-10" />}
    />
  );
}
