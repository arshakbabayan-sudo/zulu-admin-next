"use client";

/**
 * /platform/settings/header-menu — admin v3 (2026-06-05 pt3).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, Layout cluster). Renders the
 * consolidated SettingsPage with the Header menu builder pane active
 * (nested items + sub-items, save-all sync). The pre-v3 standalone page
 * is retired.
 */
import { SettingsPage } from "../../../settings/SettingsPage";

export default function HeaderMenuSettingsPage() {
  return <SettingsPage initialPage="header-menu" />;
}
