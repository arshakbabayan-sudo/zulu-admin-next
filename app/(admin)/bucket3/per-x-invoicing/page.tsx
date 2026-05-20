"use client";

/**
 * Phase 7.3 — Per-X Invoicing.
 *
 * Replaces the ComingSoonPage placeholder. Aggregated read-only view over
 * existing invoices, sliced by status / currency / month / operator.
 * Pure analytics surface — no schema changes.
 *
 * Bulk-generate monthly statements + CSV/PDF export are follow-ups.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiSuccessEnvelope } from "@/lib/api-envelope";
import {
  Button,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type GroupBy = "status" | "currency" | "month" | "operator";

type Bucket = {
  bucket: string | number | null;
  label: string | null;
  currency: string | null;
  invoice_count: number;
  total_sum: number;
};

type AggregateResponse = {
  group_by: GroupBy;
  buckets: Bucket[];
};

async function fetchAggregate(
  token: string,
  groupBy: GroupBy
): Promise<ApiSuccessEnvelope<AggregateResponse>> {
  return apiFetchJson(`/invoices/aggregate?group_by=${groupBy}`, { method: "GET", token });
}

function formatAmount(amount: number, currency: string | null, lang: string): string {
  const f = new Intl.NumberFormat(lang, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return currency ? `${currency} ${f}` : f;
}

function describeBucket(b: Bucket, groupBy: GroupBy): string {
  if (groupBy === "operator") {
    return b.label ?? `Company #${b.bucket ?? "?"}`;
  }
  return String(b.bucket ?? "—");
}

export default function Bucket3PerXInvoicingPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [data, setData] = useState<AggregateResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await fetchAggregate(token, groupBy);
      setData(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load aggregate");
    }
  }, [token, allowed, groupBy]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.bucket3.per_x_invoicing.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  const totalInvoices = data ? data.buckets.reduce((acc, b) => acc + b.invoice_count, 0) : 0;
  const totalsByCurrency: Record<string, number> = {};
  if (data) {
    for (const b of data.buckets) {
      const k = b.currency ?? "—";
      totalsByCurrency[k] = (totalsByCurrency[k] ?? 0) + b.total_sum;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.bucket3.per_x_invoicing.title")}
        subtitle={t("admin.bucket3.per_x_invoicing.subtitle")}
      />

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">{t("admin.bucket3.per_x_invoicing.group_by")}</span>
            <Select
              fieldSize="sm"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="!w-auto min-w-[180px]"
            >
              <option value="status">{t("admin.bucket3.per_x_invoicing.group.status")}</option>
              <option value="currency">{t("admin.bucket3.per_x_invoicing.group.currency")}</option>
              <option value="month">{t("admin.bucket3.per_x_invoicing.group.month")}</option>
              <option value="operator">{t("admin.bucket3.per_x_invoicing.group.operator")}</option>
            </Select>
          </label>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t("admin.bucket3.per_x_invoicing.refresh")}
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      {data && (
        <section className="admin-card p-4 space-y-2">
          <h2 className="text-base font-semibold">{t("admin.bucket3.per_x_invoicing.totals")}</h2>
          <p className="text-sm text-fg-t7">
            {t("admin.bucket3.per_x_invoicing.totals_count")
              .replace("{count}", String(totalInvoices))
              .replace("{buckets}", String(data.buckets.length))}
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(totalsByCurrency).map(([curr, total]) => (
              <div
                key={curr}
                className="rounded-zulu border border-default bg-figma-bg-1/50 px-3 py-1.5 text-xs"
              >
                <span className="text-fg-t6 uppercase">{curr}</span>
                <span className="ml-2 font-medium text-fg-t8 tabular-nums">
                  {new Intl.NumberFormat(lang, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(total)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Table>
        <THead>
          <TR>
            <TH>{groupBy === "operator" ? t("admin.bucket3.per_x_invoicing.col.operator") : t("admin.bucket3.per_x_invoicing.col.bucket")}</TH>
            {groupBy !== "currency" && <TH>{t("admin.bucket3.per_x_invoicing.col.currency")}</TH>}
            <TH>{t("admin.bucket3.per_x_invoicing.col.invoices")}</TH>
            <TH align="right">{t("admin.bucket3.per_x_invoicing.col.total")}</TH>
          </TR>
        </THead>
        <TBody>
          {!data || data.buckets.length === 0 ? (
            <TEmpty colSpan={4}>{t("admin.bucket3.per_x_invoicing.empty")}</TEmpty>
          ) : null}
          {data?.buckets.map((b, i) => (
            <TR key={`${b.bucket ?? "null"}-${b.currency ?? ""}-${i}`}>
              <TD className="font-medium text-fg-t8">{describeBucket(b, groupBy)}</TD>
              {groupBy !== "currency" && (
                <TD className="text-xs text-fg-t7 uppercase">{b.currency ?? "—"}</TD>
              )}
              <TD className="tabular-nums">{b.invoice_count}</TD>
              <TD align="right" className="tabular-nums font-medium text-fg-t8">
                {formatAmount(b.total_sum, b.currency, lang)}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
