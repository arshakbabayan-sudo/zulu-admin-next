"use client";

/**
 * /localization/translations — admin v3 (2026-06-05).
 *
 * Migrated into the unified Settings surface (Localization cluster → Content
 * translations). Renders the consolidated SettingsPage with the content-tr pane
 * active (entity type + id + language → Load → editable translatable fields →
 * Save). The pre-v3 standalone page is retired.
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function ContentTranslationsSettingsPage() {
  return <SettingsPage initialPage="content-tr" />;
}
