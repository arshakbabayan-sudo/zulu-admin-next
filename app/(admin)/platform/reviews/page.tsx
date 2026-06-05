"use client";

/**
 * /platform/reviews — admin v3 (2026-06-05).
 *
 * Migrated into the unified Settings surface (1:1 port of
 * docs/admin_designe/11_settings.html, Support cluster). Renders the
 * consolidated SettingsPage with the Reviews pane active (list + status/search
 * filters + moderate modal). The pre-v3 standalone page is retired.
 */
import { SettingsPage } from "../../settings/SettingsPage";

export default function ReviewsSettingsPage() {
  return <SettingsPage initialPage="reviews" />;
}
