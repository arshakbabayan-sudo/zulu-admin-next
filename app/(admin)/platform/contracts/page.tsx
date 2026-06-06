"use client";

/**
 * 2026-06-07 — CRM consolidation (7-crm mock, WORK cluster).
 * /platform/contracts now renders the unified CrmPage (Work → Contracts pane).
 * For super / platform-admins the pane fetches ALL companies' contracts
 * (/platform-admin/contracts) and exposes the admin actions
 * (send / countersign / terminate / new contract). Contract TEMPLATES remain in
 * the Management surface (MgmtPage → Templates tab).
 */
import { CrmPage } from "../../crm/CrmPage";

export default function PlatformContractsPage() {
  return <CrmPage initialPage="contracts" />;
}
