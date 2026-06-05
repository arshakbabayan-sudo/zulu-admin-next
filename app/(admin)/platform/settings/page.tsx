"use client";

/**
 * /platform/settings — admin v3 (2026-06-05 pt3).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, System cluster). Renders the
 * consolidated SettingsPage with the Platform settings pane active (grouped
 * key/value editor with per-setting save). The pre-v3 standalone page is retired.
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function PlatformSettingsRoute() {
  return <SettingsPage initialPage="platform-settings" />;
}
