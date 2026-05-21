"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Layout-level fallback that sets `document.title` from the current
 * route so every admin page gets a meaningful browser-tab name + WCAG
 * 2.4.2 screen-reader page announcement without each page having to
 * call `useDocumentTitle` explicitly.
 *
 * Strategy:
 *   1. Try resolving `admin.nav.<segments>.title` from the i18n catalog
 *      (matches the sidebar label keys, so the tab title and the
 *      sidebar item read the same).
 *   2. Fall back to `admin.<lastSegment>.title` for older keys that
 *      pre-date the admin.nav.* convention.
 *   3. Fall back further to a titlecased copy of the last URL segment
 *      so a brand-new page without i18n still gets something readable.
 *
 * Pages that need a more specific title (e.g., dashboard with a user
 * name) can still call `useDocumentTitle(...)` directly — that runs
 * after this effect and overrides the value, because component
 * effects fire bottom-up after the parent layout's effect resolves.
 */
export function AutoDocumentTitle() {
  const pathname = usePathname();
  const { t } = useLanguage();

  useEffect(() => {
    if (typeof document === "undefined" || !pathname) return;

    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      document.title = "ZULU Admin";

      return;
    }

    const candidates = [
      `admin.nav.${segments.join(".")}.title`,
      `admin.nav.${segments.join(".")}`,
      `admin.${segments.join(".")}.title`,
      `admin.${segments[segments.length - 1]}.title`,
    ];

    let resolved: string | null = null;
    for (const key of candidates) {
      const value = t(key);
      // useLanguage's t() returns the key itself when nothing matches —
      // treat that as miss and try the next candidate.
      if (value && value !== key) {
        resolved = value;
        break;
      }
    }

    if (!resolved) {
      const last = segments[segments.length - 1] ?? "Admin";
      resolved = last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    document.title = `${resolved} | ZULU Admin`;
  }, [pathname, t]);

  return null;
}
