"use client";

/**
 * Index page for static-page editing. Lists the 5 pages with a link
 * to the per-slug editor. Sprint 3 Step 3.4.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { STATIC_PAGE_SLUGS } from "@/lib/platform-admin-api";
import Link from "next/link";

const PAGE_LABELS: Record<(typeof STATIC_PAGE_SLUGS)[number], string> = {
  about: "About us",
  contact: "Contact",
  terms: "Terms & Conditions",
  privacy: "Privacy Policy",
  cookies: "Cookies Policy",
};

export default function StaticPagesIndexPage() {
  const { user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);

  if (!allowed) {
    return (
      <div>
        <h1 className="admin-page-title">Static pages</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="admin-page-title">Static pages</h1>
      <p className="mt-1 text-sm text-fg-t7">
        Edit the marketing pages shown on zulu.am. EN / RU / HY tabs per page.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {STATIC_PAGE_SLUGS.map((slug) => (
          <li key={slug}>
            <Link
              href={`/platform/settings/pages/${slug}`}
              className="flex items-center justify-between rounded-lg border border-default bg-white px-4 py-3 hover:border-violet-300 hover:bg-figma-bg-1"
            >
              <span>
                <span className="text-sm font-semibold text-fg-t11">{PAGE_LABELS[slug]}</span>
                <span className="ml-2 text-xs text-fg-t7 font-mono">/{slug}</span>
              </span>
              <span className="text-xs text-violet-700">Edit →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
