"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiPlatformFinanceSummary, type PlatformFinanceSummary } from "@/lib/platform-admin-api";
import { formatMoney } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";
import { Button, PageHeader } from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  StatCard,
  StatGrid,
  V2Button,
} from "@/components/ui/v2";
import { RefreshCw } from "lucide-react";

export default function PlatformFinanceSummaryPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [data, setData] = useState<PlatformFinanceSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformFinanceSummary(token);
      setData(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.finance_summary.err_load"));
    }
  }, [token, allowed, t]);

  useEffect(() => { load(); }, [load]);

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.finance_summary.title_short")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Finance summary page chrome.
          Matches docs/zulu-admin-v2.html page-view#finance (lines 603-666). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Finance" },
        ]}
        title={t("admin.finance_summary.title")}
        actions={
          <V2Button size="sm" onClick={() => load()} icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}>
            {t("admin.finance_summary.btn_refresh")}
          </V2Button>
        }
      />

      <SectionTabs
        activeHref="/platform/finance-summary"
        items={[
          { href: "/platform/finance-summary", label: "Summary" },
          { href: "/platform/invoices", label: "Invoices" },
          { href: "/platform/payments", label: "Payments" },
          { href: "/platform/commissions", label: "Commissions ledger" },
          { href: "/platform/finance", label: "Transactions" },
          { href: "/platform/vouchers", label: "Vouchers" },
        ]}
      />

      {err && (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      )}

      {data && (
        <StatGrid cols={3} className="mb-4">
          <StatCard
            value={formatMoney(data.total_payments_paid, lang)}
            label={t("admin.finance_summary.card_total_payments")}
            footer={t("admin.finance_summary.sub_paid_payments").replace("{n}", String(data.payments_count_paid))}
          />
          <StatCard
            value={formatMoney(data.total_commission_accrued, lang)}
            label={t("admin.finance_summary.card_commission_accrued")}
          />
          <StatCard
            value={formatMoney(data.total_commission_pending, lang)}
            label={t("admin.finance_summary.card_commission_pending")}
            footer={t("admin.finance_summary.sub_commission_records").replace("{n}", String(data.commission_records_count))}
          />
        </StatGrid>
      )}
    </div>
  );
}
