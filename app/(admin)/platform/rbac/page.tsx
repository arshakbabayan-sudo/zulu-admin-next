"use client";

/**
 * /platform/rbac — admin v3 (2026-06-05 pt4).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, Permissions cluster). Renders the
 * consolidated SettingsPage with the RBAC pane active: role overview (stats +
 * role table + create/edit modal + PIN-gated delete) above the embedded
 * RbacMenuTree permission editor for the selected role. The pre-v3 standalone
 * page is retired. This is the LAST in-page Settings migration — api-docs stays
 * navigate-out (Swagger-UI CDN embed).
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function RbacSettingsPage() {
  return <SettingsPage initialPage="rbac" />;
}
