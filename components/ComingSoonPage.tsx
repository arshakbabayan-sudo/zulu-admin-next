"use client";

/**
 * Placeholder page used during Phase 4 of the admin redesign — sidebar nav
 * has all 15 Bucket-3 modules registered, but the real implementations are
 * still ahead. Each route renders this card with a short description so the
 * user can navigate the full admin shape before the modules are built.
 *
 * Phase 7 (per project_admin_redesign_roadmap.md) replaces these placeholders
 * with real backend + UI module-by-module.
 */

import { PageHeader } from "@/components/ui";
import { Sparkles } from "lucide-react";

export type ComingSoonPageProps = {
  title: string;
  description?: string;
  /** Optional bullet list — what this module will eventually do. */
  features?: string[];
  /** Phase 7 sub-phase identifier (e.g. "7.1") so user can read priority. */
  sub?: string;
};

export function ComingSoonPage({ title, description, features, sub }: ComingSoonPageProps) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} subtitle={sub ? `Phase ${sub}` : undefined} />

      <div className="admin-card flex flex-col items-start gap-4 p-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Coming soon
        </div>

        {description ? (
          <p className="text-sm text-fg-t7 leading-relaxed max-w-2xl">{description}</p>
        ) : null}

        {features && features.length > 0 ? (
          <ul className="mt-1 grid gap-2 text-sm text-fg-t7">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
