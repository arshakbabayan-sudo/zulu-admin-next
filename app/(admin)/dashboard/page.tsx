"use client";

/**
 * Admin dashboard — rebuilt 1:1 from docs/admin_designe/dashboard/dashboard.html
 * (2026-06-14). Renders the SAME self-contained ZuluSpin chrome the CRM and
 * Settings pages use (Sidebar + Header + management.css), and the page content
 * reproduces the mockup's EXACT markup/classes (.kpi-card, .chart-bars,
 * .breakdown, .split-bar, .tiles, .table …). NO admin Tailwind in the content.
 *
 * One section-tab strip drives four role-scoped panes; only the tabs the
 * signed-in user is entitled to render, and the first entitled one is the
 * default. Every pane is wired straight to the documented backend endpoints
 * (no mock data) — see INTEGRATION.md for the field↔endpoint map:
 *
 *   overview        (super)    → platform-admin/statistics/* + finance/* + approvals/stats
 *   platform-stats  (super)    → finance-summary/v2 + statistics/* + finance/revenue-by-service
 *   operator-stats  (operator) → operator/statistics (company-scoped, currency-aware)
 *   agent           (agent)    → crm/* + seller/contracts
 *
 * Cells without a real value render a graceful "—"/empty state.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../platform/management/management.css";
import { Sidebar, Header } from "../platform/management/MgmtPage";
import { useMgmtMobileNav } from "@/lib/use-mgmt-mobile-nav";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  canAccessDashboardSection,
  canAccessNotificationsNav,
  canAccessOperatorStatisticsNav,
  canAccessPlatformAdminNav,
  isAgentOnlyRole,
} from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";
import {
  apiFinanceSummaryV2,
  apiRevenueByService,
  apiRecentTransactions,
  type FinanceRange,
  type FinanceSummaryV2,
  type RevenueByServiceRow,
  type RecentTransactionRow,
} from "@/lib/finance-stats-api";
import { apiCrmStats, type CrmStats } from "@/lib/crm-api";
import { apiCrmCustomersStats, apiCrmCustomers, type CrmCustomersStats, type CustomerRow } from "@/lib/customers-api";
import { apiCrmLeadsStats, type CrmLeadsStats } from "@/lib/crm-leads-api";
import { apiSellerContracts, type ContractRow } from "@/lib/contracts-api";
import { formatNumber, formatDateTime } from "@/lib/format";
import { dashStrings } from "./dashboard-i18n";

/* ─── shared formatting helpers (kept from the previous build) ───────── */

function formatValue(n: number | undefined | null, lang: string = "en"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return formatNumber(n, lang);
}

/** Quote a single CSV cell per RFC 4180 (wrap + double internal quotes). */
function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string from rows and trigger a client-side Blob download. */
function downloadCsv(filenameBase: string, rows: (string | number)[][]): void {
  if (typeof window === "undefined") return;
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  // BOM so Excel reads UTF-8 (Armenian/Russian headers) correctly.
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Map the documented FinanceRange string from the rangeDays selector. */
function rangeFromDays(days: number): FinanceRange {
  if (days <= 7) return "7d";
  if (days >= 365) return "year";
  if (days >= 90) return "90d";
  return "30d";
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", AMD: "֏", RUB: "₽", GBP: "£" };

/** "֏ 542.8M" / "$ 12,400" — symbol-prefixed compact label (mockup convention). */
function curLabel(code: string, amount: number, lang: string): string {
  const sym = CURRENCY_SYMBOL[(code ?? "").toUpperCase()] ?? "";
  return `${sym}${sym ? " " : ""}${formatValue(amount, lang)}${sym ? "" : ` ${(code ?? "").toUpperCase()}`}`;
}

/** Signed-percent delta between a current value and the previous window. */
function pctDelta(current: number, previous: number): { sign: "up" | "down" | "flat"; text: string } {
  if (previous <= 0) return { sign: "flat", text: "—" };
  const pct = ((current - previous) / previous) * 100;
  if (!Number.isFinite(pct) || pct === 0) return { sign: "flat", text: "0%" };
  return { sign: pct > 0 ? "up" : "down", text: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%` };
}

/** Delta → kpi-delta tone class + tabler trend icon (mockup `.kpi-delta.up/.down/.flat`). */
function deltaClass(sign: "up" | "down" | "flat"): string {
  return sign === "up" ? "up" : sign === "down" ? "down" : "flat";
}
function deltaIcon(sign: "up" | "down" | "flat"): string {
  return sign === "up" ? "ti-trending-up" : sign === "down" ? "ti-trending-down" : "ti-minus";
}

/** Status word → mockup badge class (.badge-success / -warning / -danger / -gray). */
function statusBadge(status: string | null | undefined): string {
  const sLower = (status ?? "").toLowerCase();
  if (["paid", "settled", "confirmed", "signed", "active", "success", "countersigned"].includes(sLower)) return "badge-success";
  if (["pending", "review", "processing", "contacted", "prospect", "draft", "sent"].includes(sLower)) return "badge-warning";
  if (["cancelled", "canceled", "failed", "rejected", "inactive", "lost", "unqualified", "terminated"].includes(sLower)) return "badge-gray";
  return "badge-gray";
}
/** Same map but danger for the truly-failed states (recent-activity table). */
function txStatusBadge(status: string | null | undefined): string {
  const sLower = (status ?? "").toLowerCase();
  if (["paid", "settled", "confirmed", "success", "completed"].includes(sLower)) return "badge-success";
  if (["pending", "review", "processing"].includes(sLower)) return "badge-warning";
  if (["failed", "cancelled", "canceled", "rejected"].includes(sLower)) return "badge-danger";
  return "badge-gray";
}

/** Initials avatar fallback (agent "My customers" table). */
function actorInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const second = parts[1];
  return `${first[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase() || first.slice(0, 2).toUpperCase();
}

/* ─── service / stage label + tone maps (mockup uses tabler icons + bd-fill tones) ── */

/* The label for each service/stage now comes from the dict (d.service[code] /
 * d.stage[code]); these maps only keep the icon + bd-fill tone. */
type ServiceMeta = { icon: string; tone: string };
const SERVICE_META: Record<string, ServiceMeta> = {
  flight: { icon: "ti-plane", tone: "" },
  flights: { icon: "ti-plane", tone: "" },
  hotel: { icon: "ti-bed", tone: "tone-info" },
  hotels: { icon: "ti-bed", tone: "tone-info" },
  package: { icon: "ti-map-pin", tone: "tone-success" },
  packages: { icon: "ti-map-pin", tone: "tone-success" },
  transfer: { icon: "ti-car", tone: "tone-light" },
  transfers: { icon: "ti-car", tone: "tone-light" },
  excursion: { icon: "ti-compass", tone: "tone-warning" },
  excursions: { icon: "ti-compass", tone: "tone-warning" },
  visa: { icon: "ti-id-badge-2", tone: "" },
  insurance: { icon: "ti-shield-half", tone: "tone-info" },
  other: { icon: "ti-dots", tone: "" },
};
function serviceMeta(service: string): ServiceMeta {
  return SERVICE_META[(service ?? "").toLowerCase()] ?? { icon: "ti-dots", tone: "" };
}

const STAGE_META: Record<string, { tone: string }> = {
  new: { tone: "" },
  qualified: { tone: "" },
  proposal: { tone: "" },
  negotiation: { tone: "" },
  won: { tone: "tone-success" },
  lost: { tone: "" },
};

/* ─── tiny widgets reused by panes (all in mockup classes) ─────────── */

/** CSS-bar chart — mockup `.chart > .chart-bars > .chart-bar > .bar(.alt)`. */
function CssBarChart({ points, alt = false }: { points: { key: string; value: number; title?: string }[]; alt?: boolean }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="chart">
      <div className="chart-bars">
        {points.length === 0 ? (
          <div className="chart-xlabel" style={{ margin: "auto" }}>—</div>
        ) : (
          points.map((p, i) => (
            <div className="chart-bar" key={`${p.key}-${i}`} title={p.title ?? `${p.key}: ${p.value}`}>
              <div className={`bar${alt ? " alt" : ""}`} style={{ height: `${Math.max(p.value > 0 ? 2 : 0, (p.value / max) * 100)}%` }} />
              <div className="chart-xlabel">{p.key}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Breakdown row — mockup `.bd-row > .bd-label / .bd-track > .bd-fill / .bd-val`. */
function BreakdownRow({
  label,
  pct,
  value,
  pctText,
  tone = "",
  icon,
  mono = false,
}: {
  label: string;
  pct: number;
  value: string;
  pctText?: string;
  tone?: string;
  icon?: string;
  mono?: boolean;
}) {
  const safe = Math.max(0, Math.min(100, pct));
  return (
    <div className="bd-row">
      <span className="bd-label">
        {icon ? <i className={`ti ${icon}`} /> : null}
        {label}
      </span>
      <div className="bd-track">
        <div className={`bd-fill ${tone}`.trim()} style={{ width: `${safe}%` }} />
      </div>
      <span className={`bd-val${mono ? " font-mono" : ""}`}>
        {value}
        {pctText ? <span className="bd-pct">{pctText}</span> : null}
      </span>
    </div>
  );
}

/* ─── overview pane (super_admin — marketplace snapshot) ───────────── */

type TopSellerRow = {
  company_id: number;
  company_name?: string | null;
  name?: string | null;
  total_revenue?: number;
  revenue?: number;
  order_count?: number;
  orders?: number;
};

type DashboardSnapshot = {
  orders: { total_in_window: number };
  revenue: { total: number };
  sellers: { total: number };
};

type OvRevenuePoint = { date: string; revenue: number; orders: number };

/** type → icon + color (recent-activity table). Label comes from d.txType[type]. */
const TX_TYPE_META: Record<string, { icon: string; color: string }> = {
  payment_in: { icon: "ti-arrow-down-left", color: "var(--success)" },
  commission: { icon: "ti-receipt-2", color: "var(--primary)" },
  refund: { icon: "ti-arrow-back-up", color: "var(--danger)" },
  payout: { icon: "ti-cash-banknote", color: "var(--text-secondary)" },
  voucher_issued: { icon: "ti-ticket", color: "var(--info)" },
};

function OverviewPane({ token, days, onExportReady }: { token: string; days: number; onExportReady?: (fn: (() => void) | null) => void }) {
  const { lang } = useLanguage();
  const d = dashStrings(lang);
  const range = rangeFromDays(days);

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState<DashboardSnapshot | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);
  const [revenueSeries, setRevenueSeries] = useState<OvRevenuePoint[]>([]);
  const [byService, setByService] = useState<RevenueByServiceRow[]>([]);
  const [recentTx, setRecentTx] = useState<RecentTransactionRow[]>([]);
  const [topOperators, setTopOperators] = useState<TopSellerRow[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setForbidden(false);
    void (async () => {
      const [snapR, prevR, apprR, revR, svcR, txR, opR] = await Promise.allSettled([
        apiFetchJson<{ success: boolean; data: DashboardSnapshot }>(`/platform-admin/statistics/dashboard?days=${days}`, { token }),
        apiFetchJson<{ success: boolean; data: DashboardSnapshot }>(`/platform-admin/statistics/dashboard?days=${days * 2}`, { token }),
        apiFetchJson<{ success: boolean; data: { total_pending: number } }>(`/platform-admin/approvals/stats`, { token }),
        apiFetchJson<{ success: boolean; data: OvRevenuePoint[] }>(`/platform-admin/statistics/revenue-series?days=${days}`, { token }),
        apiRevenueByService(token, range),
        apiRecentTransactions(token, 8),
        apiFetchJson<{ success: boolean; data: TopSellerRow[] }>(`/platform-admin/statistics/sellers?days=${days}&limit=5`, { token }),
      ]);
      if (cancelled) return;

      if (snapR.status === "rejected" && snapR.reason instanceof ApiRequestError && snapR.reason.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      if (snapR.status === "fulfilled") setSnapshot(snapR.value.data);
      if (prevR.status === "fulfilled") setPrevSnapshot(prevR.value.data);
      if (apprR.status === "fulfilled") setPendingApprovals(apprR.value.data?.total_pending ?? 0);
      if (revR.status === "fulfilled") setRevenueSeries(revR.value.data ?? []);
      if (svcR.status === "fulfilled") setByService(svcR.value.data ?? []);
      if (txR.status === "fulfilled") setRecentTx(txR.value.data ?? []);
      if (opR.status === "fulfilled") setTopOperators(opR.value.data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, days, range]);

  // expose a CSV export of the top-operators table to the page shell
  useEffect(() => {
    if (!onExportReady) return;
    const fn = () => {
      const rows = topOperators.map((s, i) => [
        i + 1,
        s.name ?? s.company_name ?? `#${s.company_id}`,
        s.revenue ?? s.total_revenue ?? 0,
        s.orders ?? s.order_count ?? 0,
      ]);
      downloadCsv("dashboard-top-operators", [["#", d.ovColOperator, d.ovColRevenue, d.ovColOrders], ...rows]);
    };
    onExportReady(fn);
    return () => onExportReady(null);
  }, [onExportReady, topOperators, d]);

  if (forbidden) return <div className="card" style={{ padding: 16 }}>{d.forbidden}</div>;
  if (loading && !snapshot) return <div className="card cell-muted" style={{ padding: 16 }}>{d.loading}</div>;

  const bookings = snapshot?.orders?.total_in_window ?? 0;
  const revenue = snapshot?.revenue?.total ?? 0;
  const operators = snapshot?.sellers?.total ?? 0;

  const prevBookings = Math.max(0, (prevSnapshot?.orders?.total_in_window ?? 0) - bookings);
  const prevRevenue = Math.max(0, (prevSnapshot?.revenue?.total ?? 0) - revenue);
  const bookingsDelta = prevSnapshot ? pctDelta(bookings, prevBookings) : { sign: "flat" as const, text: "—" };
  const revenueDelta = prevSnapshot ? pctDelta(revenue, prevRevenue) : { sign: "flat" as const, text: "—" };

  const maxSvc = Math.max(...byService.map((s) => s.amount), 1);

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi-card c-primary">
          <div className="kpi-head">
            <span className="kpi-label"><i className="ti ti-calendar-event" />{d.ovTotalBookings}</span>
            <span className={`kpi-delta ${deltaClass(bookingsDelta.sign)}`}><i className={`ti ${deltaIcon(bookingsDelta.sign)}`} />{bookingsDelta.text}</span>
          </div>
          <div className="kpi-value">{formatValue(bookings, lang)}</div>
          <div className="kpi-sub">{d.ovVsPrev.replace("{n}", String(days))}</div>
        </div>
        <div className="kpi-card c-success">
          <div className="kpi-head">
            <span className="kpi-label"><i className="ti ti-coin" />{d.ovGrossRevenue}</span>
            <span className={`kpi-delta ${deltaClass(revenueDelta.sign)}`}><i className={`ti ${deltaIcon(revenueDelta.sign)}`} />{revenueDelta.text}</span>
          </div>
          <div className="kpi-value">{curLabel("AMD", revenue, lang)}</div>
          <div className="kpi-sub"><span className="metric-note"><i className="ti ti-info-circle" />{d.ovOrderBased}</span></div>
        </div>
        <div className="kpi-card c-info">
          <div className="kpi-head">
            <span className="kpi-label"><i className="ti ti-building-store" />{d.ovActiveOperators}</span>
          </div>
          <div className="kpi-value">{formatValue(operators, lang)}</div>
          <div className="kpi-sub">{d.ovAcrossMarketplace}</div>
        </div>
        <div className="kpi-card c-warning">
          <div className="kpi-head">
            <span className="kpi-label"><i className="ti ti-clock-hour-4" />{d.ovPendingApprovals}</span>
            <span className="kpi-delta flat"><i className="ti ti-minus" />0</span>
          </div>
          <div className="kpi-value">{pendingApprovals == null ? "—" : formatValue(pendingApprovals, lang)}</div>
          <div className="kpi-sub">{d.ovApprovalsSub}</div>
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{d.ovBookingOverview}</div>
              <div className="card-subtitle">{d.ovDailyRevenue} · {d.ovLastNDays.replace("{n}", String(days))}</div>
            </div>
            <span className={`badge ${deltaClass(revenueDelta.sign) === "down" ? "badge-danger" : "badge-success"}`}><i className={`ti ${deltaIcon(revenueDelta.sign)}`} style={{ fontSize: 13 }} />{revenueDelta.text}</span>
          </div>
          <div className="card-body">
            <CssBarChart
              points={revenueSeries.map((p) => ({
                key: p.date.slice(-2),
                value: p.revenue,
                title: `${p.date}: ${curLabel("AMD", p.revenue, lang)} · ${formatNumber(p.orders, lang)}`,
              }))}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div><div className="card-title">{d.ovOrdersByService}</div><div className="card-subtitle">{d.ovShareOfRevenue}</div></div></div>
          <div className="card-body">
            {byService.length === 0 ? (
              <div className="cell-muted">{d.noData}</div>
            ) : (
              <div className="breakdown">
                {byService.map((s) => {
                  const m = serviceMeta(s.service);
                  return (
                    <BreakdownRow
                      key={s.service}
                      label={d.service[(s.service ?? "").toLowerCase()] ?? s.service}
                      icon={m.icon}
                      tone={m.tone}
                      pct={(s.amount / maxSvc) * 100}
                      value={curLabel("AMD", s.amount, lang)}
                      pctText={`${s.pct}%`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div><div className="card-title">{d.ovRecentActivity}</div><div className="card-subtitle">{d.ovRecentActivitySub}</div></div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{d.ovColType}</th><th>{d.ovColCompany}</th><th>{d.ovColAmount}</th><th>{d.ovColTime}</th><th>{d.ovColStatus}</th></tr></thead>
            <tbody>
              {recentTx.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{d.noData}</td></tr>
              ) : (
                recentTx.map((row) => {
                  const meta = TX_TYPE_META[row.type] ?? { icon: "ti-activity", color: "var(--primary)" };
                  return (
                    <tr key={row.id}>
                      <td><span className="bd-label"><i className={`ti ${meta.icon}`} style={{ color: meta.color }} />{d.txType[row.type] ?? row.type}</span></td>
                      <td>{row.company?.name ?? "—"}</td>
                      <td className="font-mono">{curLabel(row.currency, row.amount, lang)}</td>
                      <td className="cell-muted">{formatDateTime(row.when, lang)}</td>
                      <td><span className={`badge ${txStatusBadge(row.status)}`}>{row.status}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div><div className="card-title">{d.ovTopOperators}</div><div className="card-subtitle">{d.ovTopOperatorsSub}</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>{d.ovColOperator}</th><th>{d.ovColRevenue}</th><th>{d.ovColOrders}</th></tr></thead>
            <tbody>
              {topOperators.length === 0 ? (
                <tr><td colSpan={4} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{d.noData}</td></tr>
              ) : (
                topOperators.map((s, i) => {
                  const rev = s.revenue ?? s.total_revenue ?? 0;
                  const orders = s.orders ?? s.order_count ?? 0;
                  return (
                    <tr key={s.company_id}>
                      <td className="font-mono">{i + 1}</td>
                      <td>{s.name ?? s.company_name ?? `#${s.company_id}`}</td>
                      <td className="font-mono">{curLabel("AMD", rev, lang)}</td>
                      <td className="font-mono">{formatNumber(orders, lang)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ─── platform-stats pane (payments-based money tab) ─────────────────── */

type RevenuePoint = { date: string; revenue: number; orders: number };
type OrdersPoint = { date: string; total: number; by_status: Record<string, number> };

function PlatformStatsPane({ token, days, onExportReady }: { token: string; days: number; onExportReady?: (fn: (() => void) | null) => void }) {
  const { lang } = useLanguage();
  const d = dashStrings(lang);
  const range = rangeFromDays(days);

  const [summary, setSummary] = useState<FinanceSummaryV2 | null>(null);
  const [revenueSeries, setRevenueSeries] = useState<RevenuePoint[]>([]);
  const [ordersSeries, setOrdersSeries] = useState<OrdersPoint[]>([]);
  const [byService, setByService] = useState<RevenueByServiceRow[]>([]);
  const [sellers, setSellers] = useState<TopSellerRow[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setForbidden(false);
    void (async () => {
      try {
        const [sum, rev, ord, svc, sel] = await Promise.all([
          apiFinanceSummaryV2(token, range),
          apiFetchJson<{ success: boolean; data: RevenuePoint[] }>(`/platform-admin/statistics/revenue-series?days=${days}`, { token }),
          apiFetchJson<{ success: boolean; data: OrdersPoint[] }>(`/platform-admin/statistics/orders-series?days=${days}`, { token }),
          apiRevenueByService(token, range),
          apiFetchJson<{ success: boolean; data: TopSellerRow[] }>(`/platform-admin/statistics/sellers?days=${days}&limit=5`, { token }),
        ]);
        if (cancelled) return;
        setSummary(sum.data);
        setRevenueSeries(rev.data ?? []);
        setOrdersSeries(ord.data ?? []);
        setByService(svc.data ?? []);
        setSellers(sel.data ?? []);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, days, range]);

  // expose a CSV export of the top-sellers table to the page shell
  useEffect(() => {
    if (!onExportReady) return;
    const fn = () => {
      const rows = sellers.map((s) => [
        s.name ?? s.company_name ?? `#${s.company_id}`,
        s.revenue ?? s.total_revenue ?? 0,
        s.orders ?? s.order_count ?? 0,
      ]);
      downloadCsv("dashboard-top-sellers", [[d.psSeller, d.psRevenue, d.psOrders], ...rows]);
    };
    onExportReady(fn);
    return () => onExportReady(null);
  }, [onExportReady, sellers, d]);

  if (forbidden) return <div className="card" style={{ padding: 16 }}>{d.forbidden}</div>;
  if (loading && !summary) return <div className="card cell-muted" style={{ padding: 16 }}>{d.loading}</div>;

  const avgOrder = summary && summary.payments_count_paid > 0 ? summary.total_payments_paid / summary.payments_count_paid : 0;
  const split = summary?.commission_split ?? { platform: 0, agent: 0 };
  const splitTotal = split.platform + split.agent || 1;
  const platformPct = (split.platform / splitTotal) * 100;
  const agentPct = (split.agent / splitTotal) * 100;
  const currencyEntries = Object.entries(summary?.currency_breakdown ?? {});
  const maxCurrency = Math.max(...currencyEntries.map(([, v]) => Math.abs(v)), 1);
  const maxSvc = Math.max(...byService.map((s) => s.amount), 1);

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi-card c-success">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-cash" />{d.psTotalRevenue}</span></div>
          <div className="kpi-value">{curLabel("AMD", summary?.total_payments_paid ?? 0, lang)}</div>
          <div className="kpi-sub"><span className="metric-note"><i className="ti ti-info-circle" />{d.psPaymentsBased}</span></div>
        </div>
        <div className="kpi-card c-primary">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-receipt-2" />{d.psCommissionEarned}</span></div>
          <div className="kpi-value">{curLabel("AMD", summary?.total_commission_accrued ?? 0, lang)}</div>
          <div className="kpi-sub">{d.psAccruedLedger}</div>
        </div>
        <div className="kpi-card c-warning">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-clock-pause" />{d.psPendingPayouts}</span></div>
          <div className="kpi-value">{curLabel("AMD", summary?.total_commission_pending ?? 0, lang)}</div>
          <div className="kpi-sub">{d.psAwaiting}</div>
        </div>
        <div className="kpi-card c-info">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-calculator" />{d.psAvgOrder}</span></div>
          <div className="kpi-value">{curLabel("AMD", avgOrder, lang)}</div>
          <div className="kpi-sub"><span className="metric-note"><i className="ti ti-info-circle" />{d.psAvgFormula}</span></div>
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header"><div><div className="card-title">{d.psRevenueSeries}</div><div className="card-subtitle">{d.psDailyRevenue}</div></div></div>
          <div className="card-body">
            <CssBarChart points={revenueSeries.map((p) => ({ key: p.date.slice(-2), value: p.revenue, title: `${p.date}: ${curLabel("AMD", p.revenue, lang)} · ${p.orders}` }))} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div><div className="card-title">{d.psOrdersSeries}</div><div className="card-subtitle">{d.psDailyOrders}</div></div></div>
          <div className="card-body">
            <CssBarChart alt points={ordersSeries.map((p) => ({ key: p.date.slice(-2), value: p.total, title: `${p.date}: ${p.total}` }))} />
          </div>
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header"><div><div className="card-title">{d.psCommissionSplit}</div><div className="card-subtitle">{d.psPlatformVsAgent}</div></div></div>
          <div className="card-body">
            <div className="split-bar"><div className="split-seg platform" style={{ width: `${platformPct}%` }} /><div className="split-seg agent" style={{ width: `${agentPct}%` }} /></div>
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot" style={{ background: "var(--primary)" }} />{d.psPlatform} · {platformPct.toFixed(0)}% · {curLabel("AMD", split.platform, lang)}</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: "var(--info)" }} />{d.psAgent} · {agentPct.toFixed(0)}% · {curLabel("AMD", split.agent, lang)}</span>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div><div className="card-title">{d.psRevenueByCurrency}</div><div className="card-subtitle">{d.psCurrentRange}</div></div></div>
          <div className="card-body">
            {currencyEntries.length === 0 ? (
              <div className="cell-muted">—</div>
            ) : (
              <div className="breakdown">
                {currencyEntries.map(([code, amount], i) => (
                  <BreakdownRow
                    key={code}
                    label={code.toUpperCase()}
                    tone={["", "tone-info", "tone-success", "tone-warning"][i % 4]}
                    pct={(Math.abs(amount) / maxCurrency) * 100}
                    value={curLabel(code, amount, lang)}
                    mono
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header"><div><div className="card-title">{d.psRevenueByService}</div><div className="card-subtitle">{d.psShareOfPayments}</div></div></div>
          <div className="card-body">
            {byService.length === 0 ? (
              <div className="cell-muted">—</div>
            ) : (
              <div className="breakdown">
                {byService.map((s) => {
                  const m = serviceMeta(s.service);
                  return (
                    <BreakdownRow key={s.service} label={d.service[(s.service ?? "").toLowerCase()] ?? s.service} icon={m.icon} tone={m.tone} pct={(s.amount / maxSvc) * 100} value={`${s.pct}%`} />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div><div className="card-title">{d.psTopSellers}</div><div className="card-subtitle">{d.psByRevenue}</div></div></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{d.psSeller}</th><th>{d.psRevenue}</th><th>{d.psOrders}</th></tr></thead>
              <tbody>
                {sellers.length === 0 ? (
                  <tr><td colSpan={3} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{d.noData}</td></tr>
                ) : (
                  sellers.map((s) => {
                    const rev = s.revenue ?? s.total_revenue ?? 0;
                    return (
                      <tr key={s.company_id}>
                        <td>{s.name ?? s.company_name ?? `#${s.company_id}`}</td>
                        <td className="font-mono">{curLabel("AMD", rev, lang)}</td>
                        <td className="font-mono">{formatNumber(s.orders ?? s.order_count ?? 0, lang)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── operator-stats pane (currency-aware, company-scoped) ───────────── */

type OperatorStatistics = {
  stats: {
    total_bookings: number;
    active_offers: number;
    revenue_by_currency: Record<string, number>;
    commission_by_currency: Record<string, number>;
    primary_currency: string | null;
  };
  trend: { currency: string | null; labels: string[]; values: number[] };
  service_breakdown: { type: string; bookings: number; revenue: number }[];
  top_destinations: { name: string; bookings: number }[];
};

/** Split a per-currency map into the primary big value + the secondary chips. */
function splitCurrency(map: Record<string, number>, primary: string | null, lang: string): { big: string; chips: string[] } {
  const entries = Object.entries(map ?? {});
  const first = entries[0];
  if (!first) return { big: "—", chips: [] };
  const primaryCode = primary ?? first[0];
  const primaryAmount = map[primaryCode] ?? 0;
  const chips = entries.filter(([code]) => code !== primaryCode).map(([code, amount]) => curLabel(code, amount, lang));
  return { big: curLabel(primaryCode, primaryAmount, lang), chips };
}

function OperatorStatsPane({ token, onExportReady }: { token: string; onExportReady?: (fn: (() => void) | null) => void }) {
  const { lang } = useLanguage();
  const d = dashStrings(lang);
  const [data, setData] = useState<OperatorStatistics | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setForbidden(false);
    void (async () => {
      try {
        const res = await apiFetchJson<{ success: boolean; data: OperatorStatistics }>("/operator/statistics", { token });
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // expose a CSV export of the by-service breakdown to the page shell
  useEffect(() => {
    if (!onExportReady) return;
    const fn = () => {
      const rows = (data?.service_breakdown ?? []).map((s) => [
        d.service[(s.type ?? "").toLowerCase()] ?? s.type,
        s.bookings,
        s.revenue,
      ]);
      downloadCsv("dashboard-operator-by-service", [[d.opByService, d.opMyBookings, d.opRevenue], ...rows]);
    };
    onExportReady(fn);
    return () => onExportReady(null);
  }, [onExportReady, data, d]);

  if (forbidden) return <div className="card" style={{ padding: 16 }}>{d.forbidden}</div>;
  if (loading && !data) return <div className="card cell-muted" style={{ padding: 16 }}>{d.loading}</div>;
  if (!data) return <div className="card cell-muted" style={{ padding: 16 }}>{d.noData}</div>;

  const revenue = splitCurrency(data.stats.revenue_by_currency, data.stats.primary_currency, lang);
  const commission = splitCurrency(data.stats.commission_by_currency, data.stats.primary_currency, lang);
  const trendPoints = data.trend.labels.map((label, i) => ({ key: label, value: data.trend.values[i] ?? 0, title: `${label}: ${formatValue(data.trend.values[i] ?? 0, lang)}` }));
  const maxSvcRev = Math.max(...data.service_breakdown.map((s) => s.revenue), 1);
  const maxDest = Math.max(...data.top_destinations.map((d) => d.bookings), 1);

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi-card c-primary">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-calendar-event" />{d.opMyBookings}</span></div>
          <div className="kpi-value">{formatValue(data.stats.total_bookings, lang)}</div>
          <div className="kpi-sub">{d.opThisPeriod}</div>
        </div>
        <div className="kpi-card c-info">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-tag" />{d.opActiveOffers}</span></div>
          <div className="kpi-value">{formatValue(data.stats.active_offers, lang)}</div>
          <div className="kpi-sub">{d.opLiveMarketplace}</div>
        </div>
        <div className="kpi-card c-success">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-coin" />{d.opRevenue}</span></div>
          <div className="kpi-value">{revenue.big}</div>
          {revenue.chips.length > 0 ? <div className="cur-chips">{revenue.chips.map((c) => <span className="cur-chip" key={c}>{c}</span>)}</div> : null}
        </div>
        <div className="kpi-card c-warning">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-receipt-2" />{d.opCommission}</span></div>
          <div className="kpi-value">{commission.big}</div>
          {commission.chips.length > 0 ? <div className="cur-chips">{commission.chips.map((c) => <span className="cur-chip" key={c}>{c}</span>)}</div> : null}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div><div className="card-title">{d.opTrendTitle}</div><div className="card-subtitle">{d.opPrimaryCurrency}{data.trend.currency ? ` (${data.trend.currency})` : ""}</div></div></div>
        <div className="card-body"><CssBarChart points={trendPoints} /></div>
      </div>

      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header"><div><div className="card-title">{d.opByService}</div><div className="card-subtitle">{d.opBookingsRevenue}</div></div></div>
          <div className="card-body">
            {data.service_breakdown.length === 0 ? (
              <div className="cell-muted">—</div>
            ) : (
              <div className="breakdown">
                {data.service_breakdown.map((s) => {
                  const m = serviceMeta(s.type);
                  return (
                    <BreakdownRow key={s.type} label={d.service[(s.type ?? "").toLowerCase()] ?? s.type} icon={m.icon} tone={m.tone} pct={(s.revenue / maxSvcRev) * 100} value={`${formatNumber(s.bookings, lang)} · ${formatValue(s.revenue, lang)}`} />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div><div className="card-title">{d.opTopDestinations}</div><div className="card-subtitle">{d.opByBookings}</div></div></div>
          <div className="card-body">
            {data.top_destinations.length === 0 ? (
              <div className="cell-muted">—</div>
            ) : (
              <div className="breakdown">
                {data.top_destinations.slice(0, 6).map((d) => (
                  <BreakdownRow key={d.name} label={d.name} pct={(d.bookings / maxDest) * 100} value={formatNumber(d.bookings, lang)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── agent pane (CRM workspace) ─────────────────────────────────────── */

/* tile labels come from d.tile[code] / d.tile[`${code}Sub`]; this map keeps the
 * route + icon + the dict-key codes only. */
const QUICK_TILES: { route: string; code: string; icon: string }[] = [
  { route: "/crm/pipeline", code: "deal", icon: "ti-target-arrow" },
  { route: "/crm/customers", code: "customers", icon: "ti-users" },
  { route: "/crm/leads", code: "leads", icon: "ti-user-plus" },
  { route: "/inventory", code: "inventory", icon: "ti-search" },
  { route: "/agent/contracts", code: "contracts", icon: "ti-file-text" },
];

function AgentPane({ token, onExportReady }: { token: string; onExportReady?: (fn: (() => void) | null) => void }) {
  const { lang } = useLanguage();
  const d = dashStrings(lang);
  const router = useRouter();
  const [crm, setCrm] = useState<CrmStats | null>(null);
  const [custStats, setCustStats] = useState<CrmCustomersStats | null>(null);
  const [leadStats, setLeadStats] = useState<CrmLeadsStats | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setForbidden(false);
    void (async () => {
      try {
        const [crmR, custR, leadR, listR, contractR] = await Promise.allSettled([
          apiCrmStats(token),
          apiCrmCustomersStats(token),
          apiCrmLeadsStats(token),
          apiCrmCustomers(token, { per_page: 8 }),
          apiSellerContracts(token),
        ]);
        if (cancelled) return;
        const isForbidden = (r: PromiseSettledResult<unknown>) =>
          r.status === "rejected" && r.reason instanceof ApiRequestError && r.reason.status === 403;
        if (isForbidden(crmR) && isForbidden(custR) && isForbidden(leadR)) {
          setForbidden(true);
          return;
        }
        if (crmR.status === "fulfilled") setCrm(crmR.value.data);
        if (custR.status === "fulfilled") setCustStats(custR.value.data);
        if (leadR.status === "fulfilled") setLeadStats(leadR.value.data);
        if (listR.status === "fulfilled") setCustomers(listR.value.data ?? []);
        if (contractR.status === "fulfilled") setContracts(contractR.value.data ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // expose a CSV export of the my-customers table to the page shell
  useEffect(() => {
    if (!onExportReady) return;
    const fn = () => {
      const rows = customers.map((c) => [c.name, c.email, c.status, c.bookings_count]);
      downloadCsv("dashboard-my-customers", [[d.agColCustomer, d.agColEmail, d.agColStatus, d.agColBookings], ...rows]);
    };
    onExportReady(fn);
    return () => onExportReady(null);
  }, [onExportReady, customers, d]);

  if (forbidden) return <div className="card" style={{ padding: 16 }}>{d.forbidden}</div>;
  if (loading && !crm) return <div className="card cell-muted" style={{ padding: 16 }}>{d.loading}</div>;

  const byStage = crm?.by_stage ? Object.values(crm.by_stage) : [];
  const maxStageValue = Math.max(...byStage.map((s) => s.value), 1);

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi-card c-primary">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-target-arrow" />{d.agOpenDeals}</span></div>
          <div className="kpi-value">{formatValue(crm?.open_deals, lang)}</div>
          <div className="kpi-sub">{d.agInPipeline}</div>
        </div>
        <div className="kpi-card c-info">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-chart-arrows-vertical" />{d.agPipelineValue}</span></div>
          <div className="kpi-value">{formatValue(crm?.pipeline_value, lang)}</div>
          <div className="kpi-sub">{d.agAcrossDeals}</div>
        </div>
        <div className="kpi-card c-success">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-users" />{d.agActiveCustomers}</span></div>
          <div className="kpi-value">{formatValue(custStats?.active, lang)}</div>
          <div className="kpi-sub">{custStats ? `${formatNumber(custStats.new_this_month, lang)} ${d.agNewMonth} · ${formatNumber(custStats.with_bookings, lang)} ${d.agWithBookings}` : "—"}</div>
        </div>
        <div className="kpi-card c-warning">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-user-plus" />{d.agNewLeads}</span></div>
          <div className="kpi-value">{formatValue(leadStats?.new_7d, lang)}</div>
          <div className="kpi-sub">{leadStats ? `${formatNumber(leadStats.qualified, lang)} ${d.agQualified} · ${leadStats.conversion_rate}% ${d.agConversion}` : "—"}</div>
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header"><div><div className="card-title">{d.agPipelineByStage}</div><div className="card-subtitle">{d.agOpenByStage}</div></div></div>
          <div className="card-body">
            {byStage.length === 0 ? (
              <div className="cell-muted">—</div>
            ) : (
              <div className="breakdown">
                {byStage.map((s) => {
                  const m = STAGE_META[s.stage] ?? { tone: "" };
                  return (
                    <BreakdownRow key={s.stage} label={d.stage[s.stage] ?? s.stage} tone={m.tone} pct={(s.value / maxStageValue) * 100} value={`${formatNumber(s.count, lang)} · ${formatValue(s.value, lang)}`} />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div><div className="card-title">{d.agQuickActions}</div><div className="card-subtitle">{d.agDailyWork}</div></div></div>
          <div className="card-body">
            <div className="tiles">
              {QUICK_TILES.map((tile) => (
                <a
                  className="tile"
                  key={tile.route}
                  href={tile.route}
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(tile.route);
                  }}
                >
                  <i className={`ti ${tile.icon}`} />
                  <span className="tile-label">{d.tile[tile.code] ?? tile.code}</span>
                  <span className="tile-sub">{d.tile[`${tile.code}Sub`] ?? ""}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div><div className="card-title">{d.agMyCustomers}</div><div className="card-subtitle">{d.agMostRecent}</div></div><button className="btn btn-sm" onClick={() => router.push("/crm/customers")}><i className="ti ti-arrow-right" />{d.agAllCustomers}</button></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{d.agColCustomer}</th><th>{d.agColEmail}</th><th>{d.agColStatus}</th><th>{d.agColBookings}</th></tr></thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={4} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{d.agNoCustomers}</td></tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id}>
                    <td><span className="bd-label"><span className="avatar sm">{actorInitials(c.name)}</span>{c.name}</span></td>
                    <td className="cell-muted">{c.email}</td>
                    <td><span className={`badge ${statusBadge(c.status)}`}>{c.status}</span></td>
                    <td className={c.bookings_count > 0 ? "font-mono" : "muted-dash"}>{c.bookings_count > 0 ? formatNumber(c.bookings_count, lang) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div><div className="card-title">{d.agMyContracts}</div><div className="card-subtitle">{d.agAgreements}</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{d.agColNumber}</th><th>{d.agColCounterparty}</th><th>{d.agColStatus}</th><th>{d.agColExpires}</th></tr></thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr><td colSpan={4} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{d.agNoContracts}</td></tr>
              ) : (
                contracts.slice(0, 8).map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono">{c.contract_number}</td>
                    <td>{[c.partyA?.name, c.partyB?.name].filter(Boolean).join(" · ") || "—"}</td>
                    <td><span className={`badge ${statusBadge(c.status)}`}>{c.status}</span></td>
                    <td className={c.expiry_date ? "cell-muted" : "muted-dash"}>{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString(lang) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ─── page shell (mgmt chrome — copied from CrmPage) ──────────────────── */

type TabKey = "overview" | "platform-stats" | "operator-stats" | "agent";

type TabDef = {
  key: TabKey;
  label: string;
  icon: string;
  superPill: boolean;
  subtitle: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const { lang, setLang, languageOptions } = useLanguage();
  const d = dashStrings(lang);
  const { token, user, logout } = useAdminAuth();
  const [rangeDays, setRangeDays] = useState(30);
  const { sidebarCollapsed, onHamburger, closeNav, layoutClass } = useMgmtMobileNav();
  const [unreadCount, setUnreadCount] = useState(0);
  // The active pane registers its CSV-export handler here; the header Export
  // button invokes whatever the current pane published (null = nothing to export).
  const exportFnRef = useRef<(() => void) | null>(null);
  const [canExport, setCanExport] = useState(false);
  const handleExportReady = useCallback((fn: (() => void) | null) => {
    exportFnRef.current = fn;
    setCanExport(!!fn);
  }, []);

  const allowed = canAccessDashboardSection(user);
  const allowedPlatformStats = allowed && canAccessPlatformAdminNav(user);
  const allowedOperatorStats = canAccessOperatorStatisticsNav(user);
  const allowedAgent = isAgentOnlyRole(user);

  // unread badge for the sidebar (same approach as CrmPage)
  useEffect(() => {
    if (!token || !canAccessNotificationsNav(user)) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiNotificationsUnreadCount(token);
        if (!cancelled) setUnreadCount(res.data.unread_count ?? 0);
      } catch {
        /* badge is non-critical chrome */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  // ── Entitled tabs. Default = first entitled. ──
  const tabs = useMemo<TabDef[]>(() => {
    const all: (TabDef & { show: boolean })[] = [
      { key: "overview", label: d.tabOverview, icon: "ti-layout-dashboard", superPill: true, subtitle: d.subOverview, show: allowedPlatformStats },
      { key: "platform-stats", label: d.tabPlatformStats, icon: "ti-chart-bar", superPill: true, subtitle: d.subPlatformStats, show: allowedPlatformStats },
      { key: "operator-stats", label: d.tabOperatorStats, icon: "ti-building-store", superPill: false, subtitle: d.subOperatorStats, show: allowedOperatorStats },
      { key: "agent", label: d.tabAgent, icon: "ti-users", superPill: false, subtitle: d.subAgent, show: allowedAgent },
    ];
    return all.filter((tab) => tab.show).map(({ show: _show, ...rest }) => rest);
  }, [d, allowedPlatformStats, allowedOperatorStats, allowedAgent]);

  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  useEffect(() => {
    const firstTab = tabs[0];
    if (!firstTab) return;
    if (!activeTab || !tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(firstTab.key);
    }
  }, [tabs, activeTab]);

  const activeDef = tabs.find((tab) => tab.key === activeTab) ?? null;
  const greeting = user?.name ? `${d.title} — ${user.name}` : d.title;
  const showRangeSelect = activeTab === "overview" || activeTab === "platform-stats";

  const handleExport = useCallback(() => {
    exportFnRef.current?.();
  }, []);

  // ── mgmt chrome wrapper (copied from CrmPage) ──
  return (
    <div className="mgmt-page mgmt-page-host">
      <div className={layoutClass}>
        <Sidebar collapsed={sidebarCollapsed} unreadCount={unreadCount} />
        <div className="nav-overlay" onClick={closeNav} />
        <div className="main">
          <Header
            collapsed={sidebarCollapsed}
            onHamburger={onHamburger}
            user={user ?? null}
            token={token}
            lang={lang}
            languageOptions={languageOptions}
            onSetLang={setLang}
            unreadCount={unreadCount}
            onLogout={() => void logout().then(() => router.push("/login"))}
            onNavigate={(href) => router.push(href)}
          />
          <div className="page">
            <div className="page-header">
              <div>
                <div className="breadcrumb">
                  <a onClick={() => router.push("/dashboard")}>{d.breadcrumbHome}</a>
                  <i className="ti ti-chevron-right" />
                  <span className="breadcrumb-current">{d.title}</span>
                </div>
                <h1 className="page-title">
                  <span>{greeting}</span>
                  {activeDef?.superPill ? (
                    <span className="super-tag">
                      <i className="ti ti-shield-lock" style={{ fontSize: 13 }} />
                      {d.superAdmin}
                    </span>
                  ) : null}
                </h1>
                <div className="page-subtitle">{activeDef?.subtitle ?? d.platformOverview}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {showRangeSelect ? (
                  <select
                    className="range-select"
                    value={String(rangeDays)}
                    onChange={(e) => setRangeDays(Number(e.target.value))}
                    aria-label={d.dateRange}
                  >
                    <option value="7">{d.last7d}</option>
                    <option value="30">{d.last30d}</option>
                    <option value="90">{d.last90d}</option>
                    <option value="365">{d.last12m}</option>
                  </select>
                ) : null}
                {canExport ? (
                  <button className="btn btn-primary" onClick={handleExport}>
                    <i className="ti ti-download" />
                    {d.export}
                  </button>
                ) : null}
              </div>
            </div>

            {!allowed ? (
              // 2026-07-06 — explanatory empty-state instead of a bare
              // "Not available" card: tells the operator WHY the dashboard is
              // closed (no admin access / partner application still pending).
              <div className="empty-state">
                <div className="es-icon"><i className="ti ti-lock" /></div>
                <div className="es-title">{d.forbiddenTitle}</div>
                <div className="es-sub">{d.forbiddenBody}</div>
              </div>
            ) : tabs.length === 0 ? (
              <div className="empty-state">
                <div className="es-icon"><i className="ti ti-layout-dashboard" /></div>
                <div className="es-title">{d.title}</div>
                <div className="es-sub">{d.noPanes}</div>
              </div>
            ) : (
              <>
                {/* section-tabs strip (mockup #dash-tabs) */}
                <div className="section-tabs" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={tab.key === activeTab}
                      className={`section-tab ${tab.key === activeTab ? "active" : ""}`}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      <i className={`ti ${tab.icon}`} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* active pane */}
                {activeTab === "overview" && token ? (
                  <div className="page-pane active"><OverviewPane token={token} days={rangeDays} onExportReady={handleExportReady} /></div>
                ) : null}
                {activeTab === "platform-stats" && token ? (
                  <div className="page-pane active"><PlatformStatsPane token={token} days={rangeDays} onExportReady={handleExportReady} /></div>
                ) : null}
                {activeTab === "operator-stats" && token ? (
                  <div className="page-pane active"><OperatorStatsPane token={token} onExportReady={handleExportReady} /></div>
                ) : null}
                {activeTab === "agent" && token ? (
                  <div className="page-pane active"><AgentPane token={token} onExportReady={handleExportReady} /></div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
