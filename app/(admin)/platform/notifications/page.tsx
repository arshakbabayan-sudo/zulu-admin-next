"use client";

/**
 * /platform/notifications — admin v3 (2026-06-05 pt3).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, Content cluster). Renders the
 * consolidated SettingsPage with the System notifications pane active
 * (stats + filters + read-only registry + detail drawer). The pre-v3
 * standalone page is retired.
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function SystemNotificationsSettingsPage() {
  return <SettingsPage initialPage="sys-notif" />;
}
