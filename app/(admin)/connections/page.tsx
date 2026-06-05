"use client";

/**
 * /connections — admin v3 (2026-06-05 pt3).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, System cluster). Renders the
 * consolidated SettingsPage with the Connections pane active (agent↔operator
 * service connections between flights / hotels / transfers + per-client
 * targeting; propose / accept / reject / cancel + CSV export). Visible to
 * operators and agents (super:false), so it renders the unified chrome for
 * non-super users too. The pre-v3 standalone page is retired.
 */
import { SettingsPage } from "../settings/SettingsPage";

export default function ConnectionsSettingsPage() {
  return <SettingsPage initialPage="connections" />;
}
