"use client";

/**
 * /platform/users — DEPRECATED redirect (2026-06-04, Arshak's Directory
 * cleanup).
 *
 * Was the unified People page (B2C customers / Staff / Unverified chips on
 * one route). When the Directory sidebar group was deleted, its three views
 * split into dedicated destinations:
 *   - B2C customers       → /platform/b2c-customers   (Management chrome)
 *   - Unverified accounts → /platform/unverified      (Management chrome)
 *   - Staff               → /crm/staff                (CRM workspace)
 * This file forwards old bookmarks / hardcoded breadcrumb links to the new
 * homes; the `?type=` query param still works so existing deep links from
 * other admin pages land on the right view. The detail route
 * `/platform/users/{id}` is unchanged — every new list page links to it.
 */

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PlatformUsersDeprecatedRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const type = searchParams?.get("type") ?? "";
    let href = "/platform/b2c-customers";
    if (type === "staff") href = "/crm/staff";
    else if (type === "unverified") href = "/platform/unverified";
    router.replace(href);
  }, [router, searchParams]);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "60vh",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--admin-text-secondary, #666)",
        fontSize: 13,
      }}
    >
      Redirecting…
    </div>
  );
}
