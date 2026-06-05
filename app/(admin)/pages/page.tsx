"use client";

/**
 * /pages — admin v3 (2026-06-05 pt3).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, Content cluster). Renders the
 * consolidated SettingsPage with the CMS pages pane active (list + create
 * modal + status toggle + delete; view/edit still open /pages/[id]/edit).
 * The pre-v3 standalone list page is retired.
 */
import { SettingsPage } from "../settings/SettingsPage";

export default function CmsPagesSettingsPage() {
  return <SettingsPage initialPage="cms-pages" />;
}
