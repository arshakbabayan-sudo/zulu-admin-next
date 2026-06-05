"use client";

/**
 * /settings/pricing-rules — admin v3 (2026-06-05).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html). Renders the consolidated SettingsPage
 * with the Pricing rules pane active (list + filters + test panel + create/edit
 * + delete). The pre-v3 standalone V2 page is retired.
 */
import { SettingsPage } from "../SettingsPage";

export default function PricingRulesSettingsPage() {
  return <SettingsPage initialPage="pricing-rules" />;
}
