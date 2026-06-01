"use client";

/**
 * P0-1 step 1.1 (2026-06-01) — operator/agent admin's own Stripe Connect.
 *
 * Lives in the "My company" sidebar group as the "Payments" tab. The
 * operator's company_admin user lands here, sees a single Stripe Connect
 * card, and connects (or continues setting up) their Express account so
 * the marketplace can transfer their share of each booking.
 *
 * Super-admin without an active_company_id sees a notice — they should
 * use /platform/companies/[id] to manage a specific company's Connect
 * state (that surface is a follow-up; for now this card is operator-side).
 */

import { useMemo } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { StripeConnectCard } from "@/components/company/StripeConnectCard";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessMyCompanySection } from "@/lib/access";
import { PageHeader as V2PageHeader } from "@/components/ui/v2";

export default function MyCompanyPaymentsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();

  const allowed = canAccessMyCompanySection(user);

  // Resolve the company we're operating against. Operator/agent admins
  // have exactly one active company; super-admin without active_company_id
  // has nothing to act on from this page (must use /platform/companies/[id]).
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
    // useLanguage().t returns the raw key when no translation is loaded —
    // fall back to the literal so the page never reads as "admin.foo.bar".
    return value && value !== key ? value : fallback;
  };

  if (!user) {
    return (
      <div
        className="p-8 text-center text-[13px]"
        style={{ color: "var(--admin-text-secondary)" }}
      >
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
        title={tx("admin.payments.page_title", "Payments")}
        subtitle={tx(
          "admin.payments.page_subtitle",
          "Connect Stripe to receive your share of bookings on your bank account."
        )}
      />

      <div className="mt-6 grid gap-6 max-w-3xl">
        {companyId !== null ? (
          <StripeConnectCard token={token} companyId={companyId} tx={tx} />
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
              "admin.payments.no_company",
              "You don't have a company assigned. Stripe Connect is managed per company."
            )}
          </div>
        )}
      </div>
    </div>
  );
}
