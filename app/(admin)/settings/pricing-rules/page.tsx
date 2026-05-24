"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { PageHeader } from "@/components/ui";

/**
 * Pricing rules — 8-section IA placeholder (2026-05-24).
 *
 * Replaces the legacy /operator/commission-settings (which has been
 * removed from the Finance section) and will host the unified Markup +
 * Commission rules table in Phase 1. The legacy commission-settings
 * route still works for direct linking; sidebar entry has been removed.
 *
 * TODO Phase 1 — wire to backend endpoints (TBD):
 *   GET /api/pricing-rules                       — list rules
 *   POST /api/pricing-rules                      — create
 *   PATCH /api/pricing-rules/{id}                — update
 *   DELETE /api/pricing-rules/{id}               — archive
 */
export default function PricingRulesPlaceholderPage() {
  const { t } = useLanguage();

  const tr = (key: string, fallback: string): string => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("admin.settings.pricing_rules.title", "Pricing rules")}
        subtitle={tr(
          "admin.settings.pricing_rules.subtitle",
          "Unified Markup + Commission rules table"
        )}
      />

      <div
        className="admin-card flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
        style={{ borderColor: "var(--admin-border)" }}
      >
        <div
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--admin-primary-soft)" }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--admin-primary)" }}
            aria-hidden="true"
          >
            <path d="M12 8v4l3 3" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold">
          {tr("admin.settings.pricing_rules.coming_soon_title", "Coming in Phase 1")}
        </h2>

        <p className="max-w-md text-sm text-fg-t6">
          {tr(
            "admin.settings.pricing_rules.coming_soon_body",
            "This page will replace the current Commission settings and add Markup rules in a unified table."
          )}
        </p>

        <p className="max-w-md text-xs text-fg-t7">
          {tr(
            "admin.settings.pricing_rules.legacy_hint",
            "Legacy URL (/operator/commission-settings) still works for direct linking."
          )}
        </p>
      </div>
    </div>
  );
}
