"use client";

/**
 * /platform/settings/brand — admin v3 (2026-06-05 pt3).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, Layout cluster). Renders the
 * consolidated SettingsPage with the Brand settings form pane active
 * (imagery + contact + social + custom fields). The pre-v3 standalone page
 * is retired.
 */
import { SettingsPage } from "../../../settings/SettingsPage";

export default function BrandSettingsPage() {
  return <SettingsPage initialPage="brand" />;
}
