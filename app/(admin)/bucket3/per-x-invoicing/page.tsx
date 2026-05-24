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
import { formatMoney } from "@/lib/format";
import type { ApiSuccessEnvelope } from "@/lib/api-envelope";
import {

  Select,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
} from "@/components/ui/v2";
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

// formatAmount replaced by formatMoney from @/lib/format — same shape, just
// imported from the shared helper so future locale tweaks happen once.

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
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "My company", href: "/bucket3/employees" },
          { label: t("admin.bucket3.per_x_invoicing.title") },
        ]}
        title={t("admin.bucket3.per_x_invoicing.title")}
        subtitle={t("admin.bucket3.per_x_invoicing.subtitle")}
      />

      <SectionTabs
        activeHref="/bucket3/per-x-invoicing"
        items={[
          { href: "/bucket3/employees", label: "Employees" },
          { href: "/bucket3/payroll", label: "Payroll" },
          { href: "/bucket3/non-service-hours", label: "Non-service hours" },
          { href: "/bucket3/cases", label: "Cases" },
          { href: "/bucket3/bulk-notifications", label: "Bulk notifications" },
          { href: "/bucket3/pin-settings", label: "PIN settings" },
          { href: "/bucket3/customers", label: "Customers" },
          { href: "/bucket3/subscriptions", label: "Subscriptions" },
          { href: "/bucket3/per-x-invoicing", label: "Per-X invoicing" },
        ]}
      />

      <FilterCard>
        <FilterField label={t("admin.bucket3.per_x_invoicing.group_by")}>
          <Select
            fieldSize="sm"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="!h-[34px] !min-w-[180px]"
          >
            <option value="status">{t("admin.bucket3.per_x_invoicing.group.status")}</option>
            <option value="currency">{t("admin.bucket3.per_x_invoicing.group.currency")}</option>
            <option value="month">{t("admin.bucket3.per_x_invoicing.group.month")}</option>
            <option value="operator">{t("admin.bucket3.per_x_invoicing.group.operator")}</option>
          </Select>
        </FilterField>
        <V2Button size="sm" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          {t("admin.bucket3.per_x_invoicing.refresh")}
        </V2Button>
      </FilterCard>

      {err && (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      {data && (
        <section className="admin-card p-4 space-y-2 mb-4">
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
                  {formatMoney(total, lang)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <V2Card>
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
                {formatMoney(b.total_sum, lang, b.currency)}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      </V2Card>
    </div>
  );
}
