"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiPlatformFinanceSummary, type PlatformFinanceSummary } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";
import { Button, PageHeader } from "@/components/ui";

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="admin-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-fg-t6">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-fg-t11">{value}</div>
      {sub && <div className="mt-1 text-xs text-fg-t7">{sub}</div>}
    </div>
  );
}

export default function PlatformFinanceSummaryPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
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
    <div className="space-y-6">
      <PageHeader
        title={t("admin.finance_summary.title")}
        actions={
          <Button variant="outline" size="sm" onClick={() => load()}>
            {t("admin.finance_summary.btn_refresh")}
          </Button>
        }
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      )}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            label={t("admin.finance_summary.card_total_payments")}
            value={data.total_payments_paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            sub={t("admin.finance_summary.sub_paid_payments").replace("{n}", String(data.payments_count_paid))}
          />
          <SummaryCard
            label={t("admin.finance_summary.card_commission_accrued")}
            value={data.total_commission_accrued.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          />
          <SummaryCard
            label={t("admin.finance_summary.card_commission_pending")}
            value={data.total_commission_pending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            sub={t("admin.finance_summary.sub_commission_records").replace("{n}", String(data.commission_records_count))}
          />
        </div>
      )}
    </div>
  );
}
