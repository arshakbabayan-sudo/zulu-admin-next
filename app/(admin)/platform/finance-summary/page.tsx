"use client";

/**
 * v2 admin-redesign — Finance summary dashboard (Finance group).
 *
 * Source spec: docs/admin_designe/finance_group_mocks.html (PAGE 1 SUMMARY)
 * Migration prompt: docs/admin_designe/finance_group_implementation_prompt.md §3.F
 *
 * Chrome — Variant A (Overview dashboard):
 *   - V2PageHeader with breadcrumb + range select + Refresh + Export
 *   - FinanceSectionTabs (active = Finance summary)
 *   - 3 colored hero stat cards (purple / green / amber) with rich sub-lines
 *   - 3-widget grid: Revenue by service · Collection rate (donut) · Payment methods
 *   - 2:1 row: Recent transactions table (left, 2/3) · Quick actions card (right, 1/3)
 *
 * Where the backend doesn't yet return the rich breakdown the mockup shows
 * (currency split, platform vs agent commission split, avg/oldest pending),
 * the sub-lines render "—" and the donut/progress bars use sensible
 * fallbacks from the values already in apiPlatformFinanceSummary. Backend
 * follow-up is /platform-admin/finance/summary v2 with the breakdown.
 */

import Link from "next/link";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiPlatformFinanceSummary, type PlatformFinanceSummary } from "@/lib/platform-admin-api";
import { formatMoney } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";
import {
  PageHeader as V2PageHeader,
  StatCard,
  StatGrid,
  V2Button,
  V2Card,
  V2CardHeader,
  V2CardBody,
} from "@/components/ui/v2";
import {
  RefreshCw,
  Download,
  DollarSign,
  Percent,
  Clock,
  FilePlus2,
  Wallet,
  Receipt,
  ReceiptText,
  ChevronRight,
  FileDown,
} from "lucide-react";
import { FinanceSectionTabs } from "@/components/finance/FinanceSectionTabs";

type RangeKey = "7d" | "30d" | "90d" | "year";
const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  year: "This year",
};

export default function PlatformFinanceSummaryPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [data, setData] = useState<PlatformFinanceSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [range, setRange] = useState<RangeKey>("30d");

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

  useEffect(() => {
    void load();
  }, [load]);

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

  // Collection-rate donut: total_payments_paid / (paid + pending) — falls back
  // gracefully to 100% if there's no pending bucket yet.
  const totalCollected = data?.total_payments_paid ?? 0;
  const totalPending = data?.total_commission_pending ?? 0;
  const denom = totalCollected + totalPending;
  const collectionPct = denom > 0 ? Math.round((totalCollected / denom) * 100) : 100;

  return (
    <div>
      <V2PageHeader
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Finance summary" }]}
        title={t("admin.finance_summary.title")}
        subtitle={`High-level financial overview across the platform · ${RANGE_LABELS[range]}`}
        actions={
          <>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
              className="h-[36px] min-w-[160px] rounded-md border bg-white px-3 text-[13px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            >
              {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
                <option key={k} value={k}>
                  {RANGE_LABELS[k]}
                </option>
              ))}
            </select>
            <V2Button onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh">
              {""}
            </V2Button>
            <V2Button variant="primary" icon={<Download className="h-4 w-4" />}>
              Export
            </V2Button>
          </>
        }
      />

      <FinanceSectionTabs activeHref="/platform/finance-summary" />

      {err ? (
        <div
          className="mb-4 rounded-md border px-4 py-2 text-sm"
          style={{
            borderColor: "var(--admin-danger-light)",
            backgroundColor: "var(--admin-danger-light)",
            color: "var(--admin-danger-dark)",
          }}
        >
          {err}
        </div>
      ) : null}

      {/* 3 colored hero stat cards (Variant A) */}
      <StatGrid cols={3} className="mb-5">
        <StatCard
          tone="purple"
          icon={<DollarSign className="h-[22px] w-[22px]" />}
          value={data ? formatMoney(data.total_payments_paid, lang) : "—"}
          label={`Total revenue (${range})`}
          footer="Currency breakdown coming soon"
        />
        <StatCard
          tone="green"
          icon={<Percent className="h-[22px] w-[22px]" />}
          value={data ? formatMoney(data.total_commission_accrued, lang) : "—"}
          label="Commissions accrued"
          footer="Platform / Agent split — backend follow-up"
        />
        <StatCard
          tone="amber"
          icon={<Clock className="h-[22px] w-[22px]" />}
          value={data ? formatMoney(data.total_commission_pending, lang) : "—"}
          label="Pending payments"
          footer={
            data
              ? `${data.commission_records_count} pending record${data.commission_records_count === 1 ? "" : "s"}`
              : "—"
          }
        />
      </StatGrid>

      {/* 3-widget grid */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Widget 1 — Revenue by service */}
        <V2Card>
          <V2CardHeader title="Revenue by service" />
          <V2CardBody>
            <div className="space-y-3">
              {[
                { label: "Hotels", value: "—", pct: 0, bar: "primary" as const },
                { label: "Flights", value: "—", pct: 0, bar: "success" as const },
                { label: "Transfers", value: "—", pct: 0, bar: "warning" as const },
                { label: "Excursions", value: "—", pct: 0, bar: "danger" as const },
              ].map((it) => (
                <div key={it.label}>
                  <div className="mb-1.5 flex items-center justify-between text-[12px]">
                    <span>{it.label}</span>
                    <span className="font-semibold" style={{ color: "var(--admin-text-secondary)" }}>
                      {it.value}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--admin-bg-tertiary)" }}>
                    <div
                      className="h-full"
                      style={{
                        width: `${it.pct}%`,
                        backgroundColor:
                          it.bar === "success"
                            ? "var(--admin-success)"
                            : it.bar === "warning"
                            ? "var(--admin-warning)"
                            : it.bar === "danger"
                            ? "var(--admin-danger)"
                            : "var(--admin-primary)",
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="pt-2 text-[11px]" style={{ color: "var(--admin-text-tertiary)" }}>
                Per-service revenue breakdown — backend follow-up
              </p>
            </div>
          </V2CardBody>
        </V2Card>

        {/* Widget 2 — Collection rate (donut) */}
        <V2Card>
          <V2CardHeader title="Collection rate" />
          <V2CardBody>
            <div className="flex flex-col items-center text-center">
              <svg viewBox="0 0 120 120" className="h-[120px] w-[120px]">
                <circle cx="60" cy="60" r="48" fill="none" stroke="var(--admin-bg-tertiary)" strokeWidth="14" />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="var(--admin-success)"
                  strokeWidth="14"
                  strokeDasharray={`${(collectionPct / 100) * 302} 302`}
                  transform="rotate(-90 60 60)"
                  strokeLinecap="round"
                />
                <text
                  x="60"
                  y="65"
                  textAnchor="middle"
                  fontSize="18"
                  fontWeight="600"
                  fill="var(--admin-text-primary)"
                >
                  {collectionPct}%
                </text>
              </svg>
              <div className="mt-3 font-semibold" style={{ color: "var(--admin-text-primary)" }}>
                {data
                  ? `${formatMoney(totalCollected, lang)} / ${formatMoney(denom, lang)}`
                  : "—"}
              </div>
              <div className="mt-1 text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
                {collectionPct}% of invoices collected on time
              </div>
            </div>
          </V2CardBody>
        </V2Card>

        {/* Widget 3 — Payment methods */}
        <V2Card>
          <V2CardHeader title="Payment methods" />
          <V2CardBody>
            <div
              className="mb-3 text-[24px] font-semibold tabular-nums"
              style={{ color: "var(--admin-text-primary)" }}
            >
              {data ? formatMoney(totalCollected, lang) : "—"}
            </div>
            <div className="space-y-3">
              {[
                { label: "Bank transfer", pct: 0, bar: "primary" as const },
                { label: "Card", pct: 0, bar: "success" as const },
                { label: "Wallet · Other", pct: 0, bar: "warning" as const },
              ].map((it) => (
                <div key={it.label}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span>{it.label}</span>
                    <span className="font-semibold" style={{ color: "var(--admin-text-secondary)" }}>
                      —
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full"
                    style={{ backgroundColor: "var(--admin-bg-tertiary)" }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${it.pct}%`,
                        backgroundColor:
                          it.bar === "success"
                            ? "var(--admin-success)"
                            : it.bar === "warning"
                            ? "var(--admin-warning)"
                            : "var(--admin-primary)",
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="pt-2 text-[11px]" style={{ color: "var(--admin-text-tertiary)" }}>
                Payment-method split — backend follow-up
              </p>
            </div>
          </V2CardBody>
        </V2Card>
      </div>

      {/* 2:1 row — Recent transactions + Quick actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <V2Card>
            <V2CardHeader
              title="Recent transactions"
              action={
                <Link
                  href="/platform/payments"
                  className="text-[12px] font-medium"
                  style={{ color: "var(--admin-primary)" }}
                >
                  View all →
                </Link>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead
                  className="text-[11px] font-semibold uppercase tracking-[0.5px]"
                  style={{ backgroundColor: "var(--admin-bg-secondary)", color: "var(--admin-text-secondary)" }}
                >
                  <tr>
                    <th className="px-4 py-2.5 text-left">ID</th>
                    <th className="px-4 py-2.5 text-left">Type</th>
                    <th className="px-4 py-2.5 text-left">Amount</th>
                    <th className="px-4 py-2.5 text-left">Company</th>
                    <th className="px-4 py-2.5 text-left">When</th>
                    <th className="px-4 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm"
                      style={{ color: "var(--admin-text-secondary)" }}
                    >
                      Recent transactions feed — backend follow-up.
                      <br />
                      For now, see the full lists under{" "}
                      <Link
                        href="/platform/payments"
                        className="underline"
                        style={{ color: "var(--admin-primary)" }}
                      >
                        Payments
                      </Link>{" "}
                      and{" "}
                      <Link
                        href="/platform/finance"
                        className="underline"
                        style={{ color: "var(--admin-primary)" }}
                      >
                        Transactions
                      </Link>
                      .
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </V2Card>
        </div>

        <V2Card>
          <V2CardHeader title="Quick actions" />
          <V2CardBody>
            <div className="flex flex-col gap-2">
              <V2Button icon={<FilePlus2 className="h-4 w-4" />}>Issue invoice</V2Button>
              <V2Button icon={<Wallet className="h-4 w-4" />}>Record payment</V2Button>
              <V2Button icon={<Receipt className="h-4 w-4" />}>Issue voucher</V2Button>
              <V2Button icon={<ReceiptText className="h-4 w-4" />}>Run reconciliation</V2Button>
              <div className="my-1 h-px" style={{ backgroundColor: "var(--admin-border)" }} />
              <Link
                href="/bucket3/per-x-invoicing"
                className="inline-flex h-[36px] items-center justify-between rounded-md border bg-white px-3.5 text-[13px] font-medium transition hover:bg-[color:var(--admin-bg-secondary)]"
                style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <FileDown className="h-4 w-4" />
                  Monthly statement
                </span>
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href="/platform/finance"
                className="inline-flex h-[36px] items-center justify-between rounded-md border bg-white px-3.5 text-[13px] font-medium transition hover:bg-[color:var(--admin-bg-secondary)]"
                style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Percent className="h-4 w-4" />
                  Tax report
                </span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </V2CardBody>
        </V2Card>
      </div>
    </div>
  );
}
