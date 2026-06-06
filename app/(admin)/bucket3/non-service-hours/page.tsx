"use client";

/**
 * 2026-06-07 — CRM consolidation (7-crm mock, WORK cluster).
 * Work hours now renders inside the unified CrmPage (Work → Work hours pane),
 * wired to the same /time-off backend. The old standalone V2 page is retired.
 */
import { CrmPage } from "../../crm/CrmPage";

export default function Bucket3NonServiceHoursPage() {
  return <CrmPage initialPage="workhours" />;
}
