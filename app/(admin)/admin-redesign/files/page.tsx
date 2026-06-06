"use client";

/**
 * 2026-06-07 — CRM consolidation (7-crm mock, WORK cluster).
 * The file manager now renders inside the unified CrmPage (Work → Files pane),
 * wired to the same /files backend. The old standalone V2 page is retired.
 */
import { CrmPage } from "../../crm/CrmPage";

export default function AdminRedesignFilesPage() {
  return <CrmPage initialPage="files" />;
}
