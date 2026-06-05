"use client";

/**
 * /platform/webhooks — admin v3 (2026-06-05 pt3).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, System cluster). Renders the
 * consolidated SettingsPage with the Webhooks pane active (delivery / success
 * stats + Deliveries and Subscriptions tabs + replay for failed deliveries).
 * The pre-v3 standalone page is retired.
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function WebhooksSettingsPage() {
  return <SettingsPage initialPage="webhooks" />;
}
