"use client";

/**
 * /platform/company-applications — admin v3 (2026-06-05).
 *
 * Company applications (new B2B company registration requests) is now a
 * first-class tab of the unified Management page (1:1 port of
 * docs/admin_designe/company-applications.html), with a detail drawer +
 * approve/reject modals. The pre-v3 standalone V2 list/detail pages are gone;
 * everything renders inside MgmtPage, picked by `initialTab`.
 */
import { MgmtPage } from "../management/MgmtPage";

export default function CompanyApplicationsPage() {
  return <MgmtPage initialTab="companyApplications" />;
}
