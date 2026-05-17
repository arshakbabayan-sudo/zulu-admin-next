"use client";

import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function PayrollPlaceholderPage() {
  return (
    <ComingSoonPage
      sub="7.15"
      title="Payroll"
      description="Employee payroll for operator/agent companies — calculated from attendance data + base salaries + commission carry-over."
      features={[
        "Per-employee salary + commission accrual ledger",
        "Monthly payroll run with payslip PDFs",
        "Export bank-transfer batch file for the chosen Armenian bank",
      ]}
    />
  );
}
