"use client";

/**
 * Settings → Content & CMS → Widgets.
 *
 * Standalone widget catalog. The widget system today is page-bound:
 * widget instances live in `widget_contents` (page_id NOT NULL) and are
 * created/edited inside the Page editor (/pages/[id]/edit). This page
 * surfaces the full catalog of available widget TYPES so admins can see
 * what exists and jump to a page to place them.
 *
 * Page-independent ("reusable") widget instances would need a schema change
 * (nullable page_id or a widget_templates table) + new CRUD endpoints — that
 * is intentionally a placeholder here until the backend model is decided
 * (per Arshak 2026-06-02: surface what matches now, placeholder the rest).
 */

import Link from "next/link";
import { Boxes, FileEdit, Sparkles } from "lucide-react";
import { PageHeader as V2PageHeader, V2Card } from "@/components/ui/v2";
import { SettingsShell } from "@/components/settings/SettingsShell";

type WidgetKind = "content" | "home" | "deferred";

type CatalogWidget = {
  slug: string;
  name: string;
  kind: WidgetKind;
};

/**
 * Mirrors the seeded `widgets` registry + the public renderer registry
 * (components/widgets/registry.ts). `content` = has a live renderer and is
 * placeable on any CMS page; `home` = rendered by the homepage shell;
 * `deferred` = placeable but the renderer is not shipped yet.
 */
const WIDGET_CATALOG: CatalogWidget[] = [
  { slug: "text-editor", name: "Text editor", kind: "content" },
  { slug: "code-editor", name: "Code editor", kind: "content" },
  { slug: "cta", name: "Call to action", kind: "content" },
  { slug: "about-us", name: "About us", kind: "content" },
  { slug: "contact-us", name: "Contact us", kind: "content" },
  { slug: "faq", name: "FAQ", kind: "content" },
  { slug: "features", name: "Features", kind: "content" },
  { slug: "fun-facts", name: "Fun facts", kind: "content" },
  { slug: "testimonials", name: "Testimonials", kind: "content" },
  { slug: "why-choose-us", name: "Why choose us", kind: "content" },
  { slug: "home-hero", name: "Home hero", kind: "home" },
  { slug: "home-special-offers", name: "Home special offers", kind: "home" },
  { slug: "home-popular-destinations", name: "Home popular destinations", kind: "home" },
  { slug: "home-partners", name: "Home partners", kind: "home" },
  { slug: "home-newsletter", name: "Home newsletter", kind: "home" },
  { slug: "sliders", name: "Sliders", kind: "deferred" },
  { slug: "search", name: "Search", kind: "deferred" },
  { slug: "blogs", name: "Blogs", kind: "deferred" },
];

const KIND_BADGE: Record<WidgetKind, { label: string; bg: string; color: string }> = {
  content: { label: "Page widget", bg: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
  home: { label: "Homepage", bg: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
  deferred: { label: "Renderer pending", bg: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" },
};

function WidgetIcon({ slug }: { slug: string }) {
  // Two-letter mnemonic chip (same style as the page-editor widget picker).
  const initials = slug
    .split("-")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold"
      style={{ background: "var(--admin-primary-soft)", color: "var(--admin-primary)" }}
    >
      {initials}
    </span>
  );
}

export default function PlatformWidgetsPage() {
  return (
    <SettingsShell active="/platform/widgets">
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: "Widgets" },
        ]}
        title="Widgets"
        subtitle="The catalog of building blocks you can place on CMS pages"
      />

      {/* How-to / where-to-create note. Widgets are created inside the Page
          editor today; this links there so the section is actionable. */}
      <V2Card className="mb-4">
        <div className="flex items-start gap-3 p-4">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{ background: "var(--admin-primary-soft)", color: "var(--admin-primary)" }}
          >
            <FileEdit className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--admin-text-primary)" }}>
              How to add a widget
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>
              Widgets are placed on a specific page. Open a page in{" "}
              <Link href="/pages" className="font-medium underline" style={{ color: "var(--admin-primary)" }}>
                CMS pages
              </Link>{" "}
              → edit → “Add widget”, pick a type below, fill its content (with per-language
              translations), then drag to order. Reusable, page-independent widgets are coming
              once the data model is finalized.
            </p>
          </div>
        </div>
      </V2Card>

      <V2Card>
        <div className="flex items-center gap-2 border-b px-5 py-3.5" style={{ borderColor: "var(--admin-border)" }}>
          <Boxes className="h-[18px] w-[18px]" style={{ color: "var(--admin-primary)" }} />
          <span className="text-sm font-semibold">Available widget types</span>
          <span className="text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
            ({WIDGET_CATALOG.length})
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {WIDGET_CATALOG.map((w) => {
            const badge = KIND_BADGE[w.kind];
            return (
              <div
                key={w.slug}
                className="flex items-center gap-3 rounded-lg border p-3"
                style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-secondary)" }}
              >
                <WidgetIcon slug={w.slug} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium" style={{ color: "var(--admin-text-primary)" }}>
                    {w.name}
                  </p>
                  <p className="truncate font-mono text-[11px]" style={{ color: "var(--admin-text-tertiary)" }}>
                    {w.slug}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.3px]"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      </V2Card>

      {/* Placeholder for the page-independent widget library (needs backend). */}
      <V2Card className="mt-4">
        <div className="flex items-start gap-3 p-4">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{ background: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
          >
            <Sparkles className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--admin-text-primary)" }}>
              Reusable widgets — coming soon
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>
              Building a widget here once and reusing it across multiple pages needs a small
              backend change (widget instances are page-bound today). Placeholder until we
              confirm the model.
            </p>
          </div>
        </div>
      </V2Card>
    </SettingsShell>
  );
}
