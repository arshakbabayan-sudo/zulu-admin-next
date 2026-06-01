"use client";

/**
 * P0-3 (2026-06-02) — operator/agent's own "Seller status" page.
 *
 * Lives in the "My company" sidebar group. The operator sees which service
 * types are approved / in process / rejected and can apply to sell new ones.
 * Backend endpoints already exist (GET/POST companies/{id}/seller-applications);
 * this is the operator-facing UI gap from P0-3.
 *
 * Mirrors the Payments (Stripe Connect) page's company-resolution + access
 * pattern so operators land here the same way.
 */

import { useMemo } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { SellerStatusCard } from "@/components/company/SellerStatusCard";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessMyCompanySection } from "@/lib/access";
import { PageHeader as V2PageHeader } from "@/components/ui/v2";

export default function MyCompanySellerStatusPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();

  const allowed = canAccessMyCompanySection(user);

  // Operator/agent admins have exactly one active company; super-admin without
  // an active_company_id has nothing to act on from this self-service page.
  const companyId = useMemo<number | null>(() => {
    if (!user) return null;
    const fromContext = user.context?.active_company_id;
    if (typeof fromContext === "number" && fromContext > 0) return fromContext;
    const first = user.companies?.[0]?.id;
    if (typeof first === "number" && first > 0) return first;
    return null;
  }, [user]);

  const tx = (key: string, fallback: string): string => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  if (!user) {
    return (
      <div className="p-8 text-center text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>
        {tx("common.loading", "Loading…")}
      </div>
    );
  }

  if (!allowed) {
    return <ForbiddenNotice />;
  }

  return (
    <div className="px-4 py-6 lg:px-8">
      <V2PageHeader
        title={tx("admin.seller_status.page_title", "Seller status")}
        subtitle={tx(
          "admin.seller_status.page_subtitle",
          "Track which services you're approved to sell and apply for new ones."
        )}
      />

      <div className="mt-6 grid max-w-3xl gap-6">
        {companyId !== null ? (
          <SellerStatusCard token={token} companyId={companyId} tx={tx} />
        ) : (
          <div
            className="rounded-md border px-4 py-6 text-[13px]"
            style={{
              borderColor: "var(--admin-border)",
              backgroundColor: "var(--admin-bg-primary)",
              color: "var(--admin-text-secondary)",
            }}
          >
            {tx(
              "admin.seller_status.no_company",
              "You don't have a company assigned. Seller status is managed per company."
            )}
          </div>
        )}
      </div>
    </div>
  );
}
