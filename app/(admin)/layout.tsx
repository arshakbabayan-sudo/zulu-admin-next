"use client";

import { AdminShell } from "@/components/AdminShell";
import { AutoDocumentTitle } from "@/components/AutoDocumentTitle";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * v2 admin-redesign (2026-05-24) — AdminGroupTabs removed.
 *
 * The old shell-level <AdminGroupTabs /> was rendering BEFORE the page's
 * own <V2PageHeader />, putting section-tabs ABOVE the page title. v2
 * mockup has tabs BELOW the title. Every migrated page (Phase Դ + Ե)
 * has its own in-page V2 <SectionTabs /> rendered after V2PageHeader.
 *
 * Unmigrated pages (if any remain) lose their section-tab navigation
 * temporarily until they're migrated — acceptable trade-off so that the
 * 95+ already-migrated pages render in the correct v2 order.
 */
export default function AdminSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, bootstrapped } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (bootstrapped && !token) {
      router.replace("/login");
    }
  }, [bootstrapped, token, router]);

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-figma-bg-1 text-sm text-fg-t6">
        Loading session…
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <AdminShell>
      <AutoDocumentTitle />
      {children}
    </AdminShell>
  );
}
