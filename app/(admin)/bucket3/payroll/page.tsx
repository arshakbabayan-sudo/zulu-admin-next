"use client";

/**
 * 2026-06-07 — CRM consolidation (7-crm mock, WORK cluster).
 * Payroll now renders inside the unified CrmPage (Work → Payroll pane), wired
 * to the same /payroll backend. The old standalone V2 page is retired.
 */
import { CrmPage } from "../../crm/CrmPage";

export default function Bucket3PayrollPage() {
  return <CrmPage initialPage="payroll" />;
}
