"use client";

/**
 * /localization/languages — admin v3 (2026-06-05).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, Localization cluster). Renders the
 * consolidated SettingsPage with the Languages pane active (list + create / edit
 * / delete + set-default + bulk scan). The pre-v3 standalone page is retired.
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function LanguagesSettingsPage() {
  return <SettingsPage initialPage="languages" />;
}
