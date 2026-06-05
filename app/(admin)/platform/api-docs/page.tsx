"use client";

/**
 * /platform/api-docs — admin v3 (2026-06-05 pt4).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, System cluster). Renders the
 * consolidated SettingsPage with the API-docs pane active — the Swagger UI
 * viewer (swagger-ui-dist CDN bundle, auth'd with the admin bearer token)
 * wrapped in the unified chrome. With this the LAST of the 24 Settings
 * sub-pages is in-page; the pre-v3 standalone page is retired.
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function ApiDocsSettingsPage() {
  return <SettingsPage initialPage="api-docs" />;
}
