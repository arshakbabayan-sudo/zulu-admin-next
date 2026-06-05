"use client";

/**
 * /support/tickets — admin v3 (2026-06-05).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, Support cluster). Renders the
 * consolidated SettingsPage with the Support tickets pane active (list +
 * filters + read drawer with the message thread + reply). The pre-v3
 * standalone page is retired.
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function SupportTicketsSettingsPage() {
  return <SettingsPage initialPage="support-tickets" />;
}
