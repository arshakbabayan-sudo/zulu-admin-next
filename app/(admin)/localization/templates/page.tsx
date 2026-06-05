"use client";

/**
 * /localization/templates — admin v3 (2026-06-05).
 *
 * Migrated into the unified Settings surface (Localization cluster → Email
 * templates). Renders the consolidated SettingsPage with the email-tpl pane
 * active (event + channel + language → Load → title/body/is_active → Save). The
 * pre-v3 standalone page is retired.
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function EmailTemplatesSettingsPage() {
  return <SettingsPage initialPage="email-tpl" />;
}
