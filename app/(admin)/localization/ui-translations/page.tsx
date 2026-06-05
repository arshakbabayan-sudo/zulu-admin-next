"use client";

/**
 * /localization/ui-translations — admin v3 (2026-06-05).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, Localization cluster → UI strings).
 * Renders the consolidated SettingsPage with the UI-strings pane active
 * (language picker + search + paginated key/value editor + Save all). The
 * pre-v3 standalone page is retired.
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function UiTranslationsSettingsPage() {
  return <SettingsPage initialPage="ui-strings" />;
}
