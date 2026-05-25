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
import {
  apiFinanceSummaryV2,
  apiRevenueByService,
  apiPaymentMethods,
  apiRecentTransactions,
  type FinanceSummaryV2,
  type RevenueByServiceRow,
  type PaymentMethodsBreakdown,
  type RecentTransactionRow,
} from "@/lib/finance-stats-api";
import {
  STATUS_BADGE_CLASS,
  avatarInitials,
  avatarStyle,
  formatRelativeTime,
  pickAvatarTone,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
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
import { FinanceQuickActionDrawer, type QuickActionMode } from "@/components/finance/FinanceQuickActionDrawer";

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
  const [v2, setV2] = useState<FinanceSummaryV2 | null>(null);
  const [revenueByService, setRevenueByService] = useState<RevenueByServiceRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsBreakdown | null>(null);
  const [recentTx, setRecentTx] = useState<RecentTransactionRow[]>([]);
  const [quickMode, setQuickMode] = useState<QuickActionMode | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [range, setRange] = useState<RangeKey>("30d");

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const [res, resV2, resRev, resMethods, resTx] = await Promise.all([
        apiPlatformFinanceSummary(token),
        apiFinanceSummaryV2(token, range).catch(() => null),
        apiRevenueByService(token, range).catch(() => null),
        apiPaymentMethods(token, range).catch(() => null),
        apiRecentTransactions(token, 8).catch(() => null),
      ]);
      setData(res.data);
      if (resV2) setV2(resV2.data);
      if (resRev) setRevenueByService(resRev.data);
      if (resMethods) setPaymentMethods(resMethods.data);
      if (resTx) setRecentTx(resTx.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.finance_summary.err_load"));
    }
  }, [token, allowed, range, t]);

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
          footer={
            v2 && Object.keys(v2.currency_breakdown).length > 0
              ? Object.entries(v2.currency_breakdown)
                  .map(([cur, amt]) => `${cur}: ${formatMoney(amt, lang)}`)
                  .join(" · ")
              : "—"
          }
        />
        <StatCard
          tone="green"
          icon={<Percent className="h-[22px] w-[22px]" />}
          value={data ? formatMoney(data.total_commission_accrued, lang) : "—"}
          label="Commissions accrued"
          footer={
            v2
              ? `Platform: ${formatMoney(v2.commission_split.platform, lang)} · Agent: ${formatMoney(v2.commission_split.agent, lang)}`
              : "—"
          }
        />
        <StatCard
          tone="amber"
          icon={<Clock className="h-[22px] w-[22px]" />}
          value={
            v2 && v2.pending_meta.count > 0
              ? `${v2.pending_meta.count} pending`
              : data
              ? formatMoney(data.total_commission_pending, lang)
              : "—"
          }
          label="Pending payments"
          footer={
            v2 && v2.pending_meta.avg_age_days > 0
              ? `Avg. age: ${v2.pending_meta.avg_age_days.toFixed(1)} days · Oldest: ${v2.pending_meta.oldest_days.toFixed(0)} days`
              : data
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
              {revenueByService.length === 0 ? (
                <p className="py-4 text-center text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
                  No paid payments in this range yet.
                </p>
              ) : (
                revenueByService.slice(0, 6).map((row, i) => {
                  const bar =
                    i === 0
                      ? "primary"
                      : i === 1
                      ? "success"
                      : i === 2
                      ? "warning"
                      : "danger";
                  return (
                    <div key={row.service}>
                      <div className="mb-1.5 flex items-center justify-between text-[12px]">
                        <span className="capitalize">{row.service}</span>
                        <span className="font-semibold" style={{ color: "var(--admin-text-secondary)" }}>
                          {formatMoney(row.amount, lang)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--admin-bg-tertiary)" }}>
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.min(row.pct, 100)}%`,
                            backgroundColor:
                              bar === "success"
                                ? "var(--admin-success)"
                                : bar === "warning"
                                ? "var(--admin-warning)"
                                : bar === "danger"
                                ? "var(--admin-danger)"
                                : "var(--admin-primary)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
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
              {paymentMethods ? formatMoney(paymentMethods.total, lang) : data ? formatMoney(totalCollected, lang) : "—"}
            </div>
            <div className="space-y-3">
              {paymentMethods && paymentMethods.breakdown.length > 0 ? (
                paymentMethods.breakdown.slice(0, 5).map((m, i) => {
                  const bar = i === 0 ? "primary" : i === 1 ? "success" : "warning";
                  const label = m.method
                    .split("_")
                    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                    .join(" ");
                  return (
                    <div key={m.method}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span>{label}</span>
                        <span className="font-semibold" style={{ color: "var(--admin-text-secondary)" }}>
                          {formatMoney(m.amount, lang)} ({m.pct}%)
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-1.5 overflow-hidden rounded-full"
                        style={{ backgroundColor: "var(--admin-bg-tertiary)" }}
                      >
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.min(m.pct, 100)}%`,
                            backgroundColor:
                              bar === "success"
                                ? "var(--admin-success)"
                                : bar === "warning"
                                ? "var(--admin-warning)"
                                : "var(--admin-primary)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="py-4 text-center text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
                  No paid payments in this range yet.
                </p>
              )}
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
                  {recentTx.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm"
                        style={{ color: "var(--admin-text-secondary)" }}
                      >
                        No recent transactions yet.
                      </td>
                    </tr>
                  ) : (
                    recentTx.map((tx) => {
                      const typeLabel = ({
                        payment_in: "Payment in",
                        commission: "Commission",
                        refund: "Refund",
                        voucher_issued: "Voucher issued",
                        payout: "Payout",
                      } as const)[tx.type];
                      const statusTone: StatusTone =
                        tx.status === "settled" || tx.status === "completed"
                          ? "success"
                          : tx.status === "failed"
                          ? "danger"
                          : tx.status === "processing"
                          ? "info"
                          : "warning";
                      const statusLabel = tx.status.charAt(0).toUpperCase() + tx.status.slice(1);
                      const tone = pickAvatarTone(tx.company?.id ?? tx.id);
                      return (
                        <tr
                          key={tx.id}
                          className="border-t"
                          style={{ borderColor: "var(--admin-border)" }}
                        >
                          <td className="px-4 py-3 font-mono text-[12px] text-fg-t7">{tx.id}</td>
                          <td className="px-4 py-3 text-[13px]">{typeLabel}</td>
                          <td
                            className="px-4 py-3 font-semibold tabular-nums"
                            style={{ color: tx.amount < 0 ? "var(--admin-danger)" : "var(--admin-text-primary)" }}
                          >
                            {tx.amount < 0
                              ? `-${formatMoney(Math.abs(tx.amount), lang, tx.currency)}`
                              : formatMoney(tx.amount, lang, tx.currency)}
                          </td>
                          <td className="px-4 py-3">
                            {tx.company ? (
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                                  style={avatarStyle(tone)}
                                >
                                  {avatarInitials(tx.company.name)}
                                </span>
                                <span className="text-fg-t8">{tx.company.name}</span>
                              </div>
                            ) : (
                              <span className="text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                            {formatRelativeTime(tx.when)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusTone)}>
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </V2Card>
        </div>

        <V2Card>
          <V2CardHeader title="Quick actions" />
          <V2CardBody>
            <div className="flex flex-col gap-2">
              <V2Button icon={<FilePlus2 className="h-4 w-4" />} onClick={() => setQuickMode("issue-invoice")}>
                Issue invoice
              </V2Button>
              <V2Button icon={<Wallet className="h-4 w-4" />} onClick={() => setQuickMode("record-payment")}>
                Record payment
              </V2Button>
              <V2Button icon={<Receipt className="h-4 w-4" />} onClick={() => setQuickMode("issue-voucher")}>
                Issue voucher
              </V2Button>
              <V2Button icon={<ReceiptText className="h-4 w-4" />} disabled title="Reconciliation tool coming soon">
                Run reconciliation
              </V2Button>
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

      <FinanceQuickActionDrawer
        mode={quickMode}
        token={token ?? null}
        onClose={() => setQuickMode(null)}
        onSuccess={(_m, payload) => {
          setQuickMode(null);
          alert(payload.message);
          void load();
        }}
      />
    </div>
  );
}
