"use client";

/**
 * 2026-06-07 — CRM consolidation (7-crm mock, WORK cluster).
 * Contracts now render inside the unified CrmPage (Work → Contracts pane). The
 * pane fetches the role-appropriate list: operators/agents see their own
 * contracts (/seller/contracts), super/platform-admins see all
 * (/platform-admin/contracts). Same component serves /agent/contracts (re-export)
 * and /platform/contracts.
 *
 * The /operator/contracts/[id] deep-link detail route is left untouched as a
 * standalone fallback (the pane shows an in-pane detail of its own).
 */
import { CrmPage } from "../../crm/CrmPage";

export default function OperatorContractsPage() {
  return <CrmPage initialPage="contracts" />;
}
