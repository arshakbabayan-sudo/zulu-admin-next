"use client";

/**
 * /platform/loyalty — admin v3 (2026-06-05 pt3).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, Marketing cluster). Renders the
 * consolidated SettingsPage with the Loyalty pane active (stats + tier filter +
 * accounts table + detail drawer with manual point adjustment + transactions).
 * The pre-v3 standalone page is retired.
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function LoyaltySettingsPage() {
  return <SettingsPage initialPage="loyalty" />;
}
