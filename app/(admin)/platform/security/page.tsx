"use client";

/**
 * /platform/security — admin v3 (2026-06-05 pt3).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, System cluster). Renders the
 * consolidated SettingsPage with the Security pane active (2FA coverage stats +
 * force-logout incident block + 2FA registry with force-logout / force-disable
 * actions). The pre-v3 standalone page is retired.
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function SecuritySettingsPage() {
  return <SettingsPage initialPage="security" />;
}
