"use client";

/**
 * /platform/integrations — admin.
 *
 * 2026-07-01 — Integrations belongs to the Settings System cluster, so this
 * route now renders the Settings surface with the Integrations pane active (was
 * a standalone page with its own chrome, which made the page swap chrome and
 * jump when opened from Settings). The pane itself (Google Drive connect /
 * disconnect, per-company) lives in IntegrationsPane.tsx and is reused by
 * SettingsPage. Super-admin only (enforced by the pane + the Settings nav).
 */

import { SettingsPage } from "../../settings/SettingsPage";

export default function IntegrationsPage() {
  return <SettingsPage initialPage="integrations" />;
}
