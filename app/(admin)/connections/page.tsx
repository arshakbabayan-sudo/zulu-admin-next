"use client";

/**
 * /connections — admin v3.
 *
 * 2026-07-01 — Connections belongs to the CRM Work cluster, so this route now
 * renders the CRM surface with the Connections pane active (was SettingsPage,
 * which put the page in the wrong chrome and made it jump when opened from CRM).
 * The pane itself (agent↔operator service connections; propose / accept / reject
 * / cancel + CSV export) is reused from SettingsPage. Visible to operators and
 * agents, so CrmPage renders its chrome for non-super users too.
 */
import { CrmPage } from "../crm/CrmPage";

export default function ConnectionsPage() {
  return <CrmPage initialPage="connections" />;
}
