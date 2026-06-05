"use client";

/**
 * /settings/exchange-rates — admin v3 (2026-06-05).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html). The route now renders the consolidated
 * SettingsPage with the Exchange rates pane active; the pre-v3 standalone V2
 * page (AdminShell + SettingsSubgroupTabs + per-page table) is retired.
 */
import { SettingsPage } from "../SettingsPage";

export default function ExchangeRatesSettingsPage() {
  return <SettingsPage initialPage="exchange-rates" />;
}
