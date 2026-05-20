"use client";

import { useEffect } from "react";

/**
 * Sets `document.title` to `${title} | ZULU Admin` while the component is mounted.
 * Restores the previous title on unmount.
 *
 * Used on admin client pages because Next.js metadata API only applies to
 * server-rendered routes; admin pages are SPA-style so we need to drive the
 * browser tab title imperatively for screen-reader page announcement
 * (WCAG 2.4.2 Page Title).
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = `${title} | ZULU Admin`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
