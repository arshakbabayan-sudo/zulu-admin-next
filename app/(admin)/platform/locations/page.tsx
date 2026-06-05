"use client";

/**
 * /platform/locations — admin v3 (2026-06-05).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, System cluster). Renders the
 * consolidated SettingsPage with the Locations pane active (countries → regions
 * → cities tri-column cascade + add/edit/delete). The pre-v3 standalone page is
 * retired.
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function LocationsSettingsPage() {
  return <SettingsPage initialPage="locations" />;
}
