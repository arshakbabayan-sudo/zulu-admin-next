import { redirect } from "next/navigation";

/**
 * CRM → Staff REMOVED 2026-06-06 (Arshak). The old page listed every company's
 * owner platform-wide (apiPlatformUsers) as "staff", which is wrong — operators/
 * agents are COMPANIES (Management → Companies), not staff. The per-company
 * employee view is CRM → Team (company-scoped, owner-side Add-employee).
 * Redirect any old link there.
 */
export default function CrmStaffRedirect() {
  redirect("/crm/team");
}
