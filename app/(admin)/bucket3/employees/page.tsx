"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function EmployeesPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.5"
      title="Employees"
      description="Internal team management within an operator or agent company — multi-user accounts under one company umbrella."
      features={[
        "Add staff users with per-role permissions",
        "Track who closed which booking",
        "Invite by email with auto-onboarding",
      ]}
    />
  );
}
