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
import { useCallback, useEffect, useMemo, useState } from "react";
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

/* ─── shared formatting / i18n helpers (kept from the previous build) ─── */

function formatValue(n: number | undefined | null, lang: string = "en"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return formatNumber(n, lang);
}

/**
 * Translation helper — returns the translated string, or the Armenian fallback
 * when the key isn't in the bundle (t() returns the key itself in that case).
 */
function tx(t: (k: string) => string, key: string, fallback: string): string {
  const r = t(key);
  return r === key ? fallback : r;
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

type ServiceMeta = { key: string; fallback: string; icon: string; tone: string };
const SERVICE_META: Record<string, ServiceMeta> = {
  flight: { key: "admin.dash2.service.flight", fallback: "Թռիչքներ", icon: "ti-plane", tone: "" },
  flights: { key: "admin.dash2.service.flights", fallback: "Թռիչքներ", icon: "ti-plane", tone: "" },
  hotel: { key: "admin.dash2.service.hotel", fallback: "Հյուրանոցներ", icon: "ti-bed", tone: "tone-info" },
  hotels: { key: "admin.dash2.service.hotels", fallback: "Հյուրանոցներ", icon: "ti-bed", tone: "tone-info" },
  package: { key: "admin.dash2.service.package", fallback: "Փաթեթներ", icon: "ti-map-pin", tone: "tone-success" },
  packages: { key: "admin.dash2.service.packages", fallback: "Փաթեթներ", icon: "ti-map-pin", tone: "tone-success" },
  transfer: { key: "admin.dash2.service.transfer", fallback: "Փոխադրումներ", icon: "ti-car", tone: "tone-light" },
  transfers: { key: "admin.dash2.service.transfers", fallback: "Փոխադրումներ", icon: "ti-car", tone: "tone-light" },
  excursion: { key: "admin.dash2.service.excursion", fallback: "Էքսկուրսիաներ", icon: "ti-compass", tone: "tone-warning" },
  excursions: { key: "admin.dash2.service.excursions", fallback: "Էքսկուրսիաներ", icon: "ti-compass", tone: "tone-warning" },
  visa: { key: "admin.dash2.service.visa", fallback: "Վիզա", icon: "ti-id-badge-2", tone: "" },
  insurance: { key: "admin.dash2.service.insurance", fallback: "Ապահովագրություն", icon: "ti-shield-half", tone: "tone-info" },
  other: { key: "admin.dash2.service.other", fallback: "Այլ", icon: "ti-dots", tone: "" },
};
function serviceMeta(service: string): ServiceMeta {
  return SERVICE_META[(service ?? "").toLowerCase()] ?? { key: `admin.dash2.service.${service}`, fallback: service, icon: "ti-dots", tone: "" };
}

const STAGE_META: Record<string, { key: string; fallback: string; tone: string }> = {
  new: { key: "admin.dash2.stage.new", fallback: "Նոր", tone: "" },
  qualified: { key: "admin.dash2.stage.qualified", fallback: "Որակավորված", tone: "" },
  proposal: { key: "admin.dash2.stage.proposal", fallback: "Առաջարկ", tone: "" },
  negotiation: { key: "admin.dash2.stage.negotiation", fallback: "Բանակցություն", tone: "" },
  won: { key: "admin.dash2.stage.won", fallback: "Շահված", tone: "tone-success" },
  lost: { key: "admin.dash2.stage.lost", fallback: "Կորցրած", tone: "" },
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

/** type → translated label + icon + color (recent-activity table). */
const TX_TYPE_META: Record<string, { key: string; fallback: string; icon: string; color: string }> = {
  payment_in: { key: "admin.dash2.ov.tx_payment_in", fallback: "Մուտքային վճարում", icon: "ti-arrow-down-left", color: "var(--success)" },
  commission: { key: "admin.dash2.ov.tx_commission", fallback: "Միջնորդավճար", icon: "ti-receipt-2", color: "var(--primary)" },
  refund: { key: "admin.dash2.ov.tx_refund", fallback: "Վերադարձ", icon: "ti-arrow-back-up", color: "var(--danger)" },
  payout: { key: "admin.dash2.ov.tx_payout", fallback: "Վճարում դուրս", icon: "ti-cash-banknote", color: "var(--text-secondary)" },
  voucher_issued: { key: "admin.dash2.ov.tx_voucher", fallback: "Վաուչեր", icon: "ti-ticket", color: "var(--info)" },
};

function OverviewPane({ token, days }: { token: string; days: number }) {
  const { t, lang } = useLanguage();
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

  if (forbidden) return <div className="card" style={{ padding: 16 }}>{tx(t, "admin.forbidden.dashboard_stats", "Հասանելի չէ")}</div>;
  if (loading && !snapshot) return <div className="card cell-muted" style={{ padding: 16 }}>{tx(t, "admin.dash2.loading", "Բեռնվում է…")}</div>;

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
            <span className="kpi-label"><i className="ti ti-calendar-event" />{tx(t, "admin.dash2.ov.total_bookings", "Ընդհանուր ամրագրումներ")}</span>
            <span className={`kpi-delta ${deltaClass(bookingsDelta.sign)}`}><i className={`ti ${deltaIcon(bookingsDelta.sign)}`} />{bookingsDelta.text}</span>
          </div>
          <div className="kpi-value">{formatValue(bookings, lang)}</div>
          <div className="kpi-sub">{tx(t, "admin.dash2.ov.vs_prev", "նախորդ {n} օրվա համեմատ").replace("{n}", String(days))}</div>
        </div>
        <div className="kpi-card c-success">
          <div className="kpi-head">
            <span className="kpi-label"><i className="ti ti-coin" />{tx(t, "admin.dash2.ov.gross_revenue", "Համախառն եկամուտ")}</span>
            <span className={`kpi-delta ${deltaClass(revenueDelta.sign)}`}><i className={`ti ${deltaIcon(revenueDelta.sign)}`} />{revenueDelta.text}</span>
          </div>
          <div className="kpi-value">{curLabel("AMD", revenue, lang)}</div>
          <div className="kpi-sub"><span className="metric-note"><i className="ti ti-info-circle" />{tx(t, "admin.dash2.ov.order_based", "Պատվեր-հիմք")}</span></div>
        </div>
        <div className="kpi-card c-info">
          <div className="kpi-head">
            <span className="kpi-label"><i className="ti ti-building-store" />{tx(t, "admin.dash2.ov.active_operators", "Ակտիվ օպերատորներ")}</span>
          </div>
          <div className="kpi-value">{formatValue(operators, lang)}</div>
          <div className="kpi-sub">{tx(t, "admin.dash2.ov.across_marketplace", "ամբողջ շուկայում")}</div>
        </div>
        <div className="kpi-card c-warning">
          <div className="kpi-head">
            <span className="kpi-label"><i className="ti ti-clock-hour-4" />{tx(t, "admin.dash2.ov.pending_approvals", "Սպասվող հաստատումներ")}</span>
            <span className="kpi-delta flat"><i className="ti ti-minus" />0</span>
          </div>
          <div className="kpi-value">{pendingApprovals == null ? "—" : formatValue(pendingApprovals, lang)}</div>
          <div className="kpi-sub">{tx(t, "admin.dash2.ov.approvals_sub", "ընկերություններ · վաճառողներ · առաջարկներ · կարծիքներ")}</div>
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{tx(t, "admin.dash2.ov.booking_overview", "Ամրագրումների ակնարկ")}</div>
              <div className="card-subtitle">{tx(t, "admin.dash2.ov.daily_revenue", "Օրական եկամուտ")} · {tx(t, "admin.dash2.ov.last_n_days", "վերջին {n} օր").replace("{n}", String(days))}</div>
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
          <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.ov.orders_by_service", "Պատվերներն ըստ ծառայության")}</div><div className="card-subtitle">{tx(t, "admin.dash2.ov.share_of_revenue", "Բաժին ընդհանուր եկամտից")}</div></div></div>
          <div className="card-body">
            {byService.length === 0 ? (
              <div className="cell-muted">{tx(t, "admin.dash2.no_data", "Տվյալներ չկան")}</div>
            ) : (
              <div className="breakdown">
                {byService.map((s) => {
                  const m = serviceMeta(s.service);
                  return (
                    <BreakdownRow
                      key={s.service}
                      label={tx(t, m.key, m.fallback)}
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
          <div><div className="card-title">{tx(t, "admin.dash2.ov.recent_activity", "Վերջին ակտիվությունը")}</div><div className="card-subtitle">{tx(t, "admin.dash2.ov.recent_activity_sub", "Վերջին վճարումներ, վերադարձներ, միջնորդավճարներ")}</div></div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{tx(t, "admin.dash2.ov.col_type", "Տեսակ")}</th><th>{tx(t, "admin.dash2.ov.col_company", "Ընկերություն")}</th><th>{tx(t, "admin.dash2.ov.col_amount", "Գումար")}</th><th>{tx(t, "admin.dash2.ov.col_time", "Ժամ")}</th><th>{tx(t, "admin.dash2.ov.col_status", "Կարգավիճակ")}</th></tr></thead>
            <tbody>
              {recentTx.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{tx(t, "admin.dash2.no_data", "Տվյալներ չկան")}</td></tr>
              ) : (
                recentTx.map((row) => {
                  const meta = TX_TYPE_META[row.type] ?? { key: "", fallback: row.type, icon: "ti-activity", color: "var(--primary)" };
                  return (
                    <tr key={row.id}>
                      <td><span className="bd-label"><i className={`ti ${meta.icon}`} style={{ color: meta.color }} />{meta.key ? tx(t, meta.key, meta.fallback) : meta.fallback}</span></td>
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
        <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.ov.top_operators", "Լավագույն օպերատորներ")}</div><div className="card-subtitle">{tx(t, "admin.dash2.ov.top_operators_sub", "Ըստ ընդհանուր եկամտի այս ժամանակահատվածում")}</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>{tx(t, "admin.dash2.ov.col_operator", "Օպերատոր")}</th><th>{tx(t, "admin.dash2.ov.col_revenue", "Եկամուտ")}</th><th>{tx(t, "admin.dash2.ov.col_orders", "Պատվերներ")}</th></tr></thead>
            <tbody>
              {topOperators.length === 0 ? (
                <tr><td colSpan={4} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{tx(t, "admin.dash2.no_data", "Տվյալներ չկան")}</td></tr>
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

function PlatformStatsPane({ token, days }: { token: string; days: number }) {
  const { t, lang } = useLanguage();
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

  if (forbidden) return <div className="card" style={{ padding: 16 }}>{tx(t, "admin.forbidden.dashboard_stats", "Հասանելի չէ")}</div>;
  if (loading && !summary) return <div className="card cell-muted" style={{ padding: 16 }}>{tx(t, "admin.dash2.loading", "Բեռնվում է…")}</div>;

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
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-cash" />{tx(t, "admin.dash2.pstats.total_revenue", "Ընդհանուր եկամուտ")}</span></div>
          <div className="kpi-value">{curLabel("AMD", summary?.total_payments_paid ?? 0, lang)}</div>
          <div className="kpi-sub"><span className="metric-note"><i className="ti ti-info-circle" />{tx(t, "admin.dash2.pstats.payments_based", "Վճարումների հիման վրա")}</span></div>
        </div>
        <div className="kpi-card c-primary">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-receipt-2" />{tx(t, "admin.dash2.pstats.commission_earned", "Վաստակած միջնորդավճար")}</span></div>
          <div className="kpi-value">{curLabel("AMD", summary?.total_commission_accrued ?? 0, lang)}</div>
          <div className="kpi-sub">{tx(t, "admin.dash2.pstats.accrued_ledger", "Հաշվեգրված մուտքերի մատյանից")}</div>
        </div>
        <div className="kpi-card c-warning">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-clock-pause" />{tx(t, "admin.dash2.pstats.pending_payouts", "Սպասվող վճարումներ")}</span></div>
          <div className="kpi-value">{curLabel("AMD", summary?.total_commission_pending ?? 0, lang)}</div>
          <div className="kpi-sub">{tx(t, "admin.dash2.pstats.awaiting", "Սպասում են օպերատորներին փոխանցմանը")}</div>
        </div>
        <div className="kpi-card c-info">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-calculator" />{tx(t, "admin.dash2.pstats.avg_order", "Միջին պատվերի արժեք")}</span></div>
          <div className="kpi-value">{curLabel("AMD", avgOrder, lang)}</div>
          <div className="kpi-sub"><span className="metric-note"><i className="ti ti-info-circle" />{tx(t, "admin.dash2.pstats.avg_formula", "Հաշվարկ՝ վճարումներ ÷ քանակ")}</span></div>
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.pstats.revenue_series", "Եկամտի շարք")}</div><div className="card-subtitle">{tx(t, "admin.dash2.pstats.daily_revenue", "Օրական եկամուտ")}</div></div></div>
          <div className="card-body">
            <CssBarChart points={revenueSeries.map((p) => ({ key: p.date.slice(-2), value: p.revenue, title: `${p.date}: ${curLabel("AMD", p.revenue, lang)} · ${p.orders}` }))} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.pstats.orders_series", "Պատվերների շարք")}</div><div className="card-subtitle">{tx(t, "admin.dash2.pstats.daily_orders", "Օրական պատվերներ")}</div></div></div>
          <div className="card-body">
            <CssBarChart alt points={ordersSeries.map((p) => ({ key: p.date.slice(-2), value: p.total, title: `${p.date}: ${p.total}` }))} />
          </div>
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.pstats.commission_split", "Միջնորդավճարի բաշխում")}</div><div className="card-subtitle">{tx(t, "admin.dash2.pstats.platform_vs_agent", "Հարթակ ընդդեմ գործակալ")}</div></div></div>
          <div className="card-body">
            <div className="split-bar"><div className="split-seg platform" style={{ width: `${platformPct}%` }} /><div className="split-seg agent" style={{ width: `${agentPct}%` }} /></div>
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot" style={{ background: "var(--primary)" }} />{tx(t, "admin.dash2.pstats.platform", "Հարթակ")} · {platformPct.toFixed(0)}% · {curLabel("AMD", split.platform, lang)}</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: "var(--info)" }} />{tx(t, "admin.dash2.pstats.agent", "Գործակալ")} · {agentPct.toFixed(0)}% · {curLabel("AMD", split.agent, lang)}</span>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.pstats.revenue_by_currency", "Եկամուտ ըստ արժույթի")}</div><div className="card-subtitle">{tx(t, "admin.dash2.pstats.current_range", "Ընթացիկ ժամանակահատված")}</div></div></div>
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
          <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.pstats.revenue_by_service", "Եկամուտ ըստ ծառայության")}</div><div className="card-subtitle">{tx(t, "admin.dash2.pstats.share_of_payments", "Վճարումների բաժին")}</div></div></div>
          <div className="card-body">
            {byService.length === 0 ? (
              <div className="cell-muted">—</div>
            ) : (
              <div className="breakdown">
                {byService.map((s) => {
                  const m = serviceMeta(s.service);
                  return (
                    <BreakdownRow key={s.service} label={tx(t, m.key, m.fallback)} icon={m.icon} tone={m.tone} pct={(s.amount / maxSvc) * 100} value={`${s.pct}%`} />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.pstats.top_sellers", "Լավագույն վաճառողներ")}</div><div className="card-subtitle">{tx(t, "admin.dash2.pstats.by_revenue", "Ըստ եկամտի այս ժամանակահատվածում")}</div></div></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{tx(t, "admin.dash2.pstats.seller", "Վաճառող")}</th><th>{tx(t, "admin.dash2.pstats.revenue", "Եկամուտ")}</th><th>{tx(t, "admin.dash2.pstats.orders", "Պատվերներ")}</th></tr></thead>
              <tbody>
                {sellers.length === 0 ? (
                  <tr><td colSpan={3} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{tx(t, "admin.dash2.no_data", "Տվյալներ չկան")}</td></tr>
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

function OperatorStatsPane({ token }: { token: string }) {
  const { t, lang } = useLanguage();
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

  if (forbidden) return <div className="card" style={{ padding: 16 }}>{tx(t, "admin.forbidden.dashboard_stats", "Հասանելի չէ")}</div>;
  if (loading && !data) return <div className="card cell-muted" style={{ padding: 16 }}>{tx(t, "admin.dash2.loading", "Բեռնվում է…")}</div>;
  if (!data) return <div className="card cell-muted" style={{ padding: 16 }}>{tx(t, "admin.dash2.no_data", "Տվյալներ չկան")}</div>;

  const revenue = splitCurrency(data.stats.revenue_by_currency, data.stats.primary_currency, lang);
  const commission = splitCurrency(data.stats.commission_by_currency, data.stats.primary_currency, lang);
  const trendPoints = data.trend.labels.map((label, i) => ({ key: label, value: data.trend.values[i] ?? 0, title: `${label}: ${formatValue(data.trend.values[i] ?? 0, lang)}` }));
  const maxSvcRev = Math.max(...data.service_breakdown.map((s) => s.revenue), 1);
  const maxDest = Math.max(...data.top_destinations.map((d) => d.bookings), 1);

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi-card c-primary">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-calendar-event" />{tx(t, "admin.dash2.op.my_bookings", "Իմ ամրագրումները")}</span></div>
          <div className="kpi-value">{formatValue(data.stats.total_bookings, lang)}</div>
          <div className="kpi-sub">{tx(t, "admin.dash2.op.this_period", "Այս ժամանակահատվածում")}</div>
        </div>
        <div className="kpi-card c-info">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-tag" />{tx(t, "admin.dash2.op.active_offers", "Ակտիվ առաջարկներ")}</span></div>
          <div className="kpi-value">{formatValue(data.stats.active_offers, lang)}</div>
          <div className="kpi-sub">{tx(t, "admin.dash2.op.live_marketplace", "Շուկայում հասանելի")}</div>
        </div>
        <div className="kpi-card c-success">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-coin" />{tx(t, "admin.dash2.op.revenue", "Եկամուտ")}</span></div>
          <div className="kpi-value">{revenue.big}</div>
          {revenue.chips.length > 0 ? <div className="cur-chips">{revenue.chips.map((c) => <span className="cur-chip" key={c}>{c}</span>)}</div> : null}
        </div>
        <div className="kpi-card c-warning">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-receipt-2" />{tx(t, "admin.dash2.op.commission", "Միջնորդավճար")}</span></div>
          <div className="kpi-value">{commission.big}</div>
          {commission.chips.length > 0 ? <div className="cur-chips">{commission.chips.map((c) => <span className="cur-chip" key={c}>{c}</span>)}</div> : null}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.op.trend_title", "12-ամսյա եկամտի միտում")}</div><div className="card-subtitle">{tx(t, "admin.dash2.op.primary_currency", "Հիմնական արժույթ")}{data.trend.currency ? ` (${data.trend.currency})` : ""}</div></div></div>
        <div className="card-body"><CssBarChart points={trendPoints} /></div>
      </div>

      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.op.by_service", "Ըստ ծառայության")}</div><div className="card-subtitle">{tx(t, "admin.dash2.op.bookings_revenue", "Ամրագրումներ և եկամուտ")}</div></div></div>
          <div className="card-body">
            {data.service_breakdown.length === 0 ? (
              <div className="cell-muted">—</div>
            ) : (
              <div className="breakdown">
                {data.service_breakdown.map((s) => {
                  const m = serviceMeta(s.type);
                  return (
                    <BreakdownRow key={s.type} label={tx(t, m.key, m.fallback)} icon={m.icon} tone={m.tone} pct={(s.revenue / maxSvcRev) * 100} value={`${formatNumber(s.bookings, lang)} · ${formatValue(s.revenue, lang)}`} />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.op.top_destinations", "Լավագույն ուղղություններ")}</div><div className="card-subtitle">{tx(t, "admin.dash2.op.by_bookings", "Ըստ ամրագրումների այս ժամանակահատվածում")}</div></div></div>
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

const QUICK_TILES: { route: string; key: string; fallback: string; subKey: string; subFallback: string; icon: string }[] = [
  { route: "/crm/pipeline", key: "admin.dash2.agent.tile_deal", fallback: "Նոր գործարք", subKey: "admin.dash2.agent.tile_deal_sub", subFallback: "Բացել խողովակը", icon: "ti-target-arrow" },
  { route: "/crm/customers", key: "admin.dash2.agent.tile_customers", fallback: "Հաճախորդներ", subKey: "admin.dash2.agent.tile_customers_sub", subFallback: "Կառավարել ցանկը", icon: "ti-users" },
  { route: "/crm/leads", key: "admin.dash2.agent.tile_leads", fallback: "Հնարավոր հաճախորդներ", subKey: "admin.dash2.agent.tile_leads_sub", subFallback: "Հետևել", icon: "ti-user-plus" },
  { route: "/inventory", key: "admin.dash2.agent.tile_inventory", fallback: "Որոնել գույքագրում", subKey: "admin.dash2.agent.tile_inventory_sub", subFallback: "Գտնել առաջարկներ", icon: "ti-search" },
  { route: "/agent/contracts", key: "admin.dash2.agent.tile_contracts", fallback: "Իմ պայմանագրերը", subKey: "admin.dash2.agent.tile_contracts_sub", subFallback: "Դիտել համաձայնագրերը", icon: "ti-file-text" },
];

function AgentPane({ token }: { token: string }) {
  const { t, lang } = useLanguage();
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

  if (forbidden) return <div className="card" style={{ padding: 16 }}>{tx(t, "admin.forbidden.dashboard_stats", "Հասանելի չէ")}</div>;
  if (loading && !crm) return <div className="card cell-muted" style={{ padding: 16 }}>{tx(t, "admin.dash2.loading", "Բեռնվում է…")}</div>;

  const byStage = crm?.by_stage ? Object.values(crm.by_stage) : [];
  const maxStageValue = Math.max(...byStage.map((s) => s.value), 1);

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi-card c-primary">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-target-arrow" />{tx(t, "admin.dash2.agent.open_deals", "Բաց գործարքներ")}</span></div>
          <div className="kpi-value">{formatValue(crm?.open_deals, lang)}</div>
          <div className="kpi-sub">{tx(t, "admin.dash2.agent.in_pipeline", "Ձեր խողովակում")}</div>
        </div>
        <div className="kpi-card c-info">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-chart-arrows-vertical" />{tx(t, "admin.dash2.agent.pipeline_value", "Խողովակի արժեք")}</span></div>
          <div className="kpi-value">{formatValue(crm?.pipeline_value, lang)}</div>
          <div className="kpi-sub">{tx(t, "admin.dash2.agent.across_deals", "Բաց գործարքների գումարը")}</div>
        </div>
        <div className="kpi-card c-success">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-users" />{tx(t, "admin.dash2.agent.active_customers", "Ակտիվ հաճախորդներ")}</span></div>
          <div className="kpi-value">{formatValue(custStats?.active, lang)}</div>
          <div className="kpi-sub">{custStats ? `${formatNumber(custStats.new_this_month, lang)} ${tx(t, "admin.dash2.agent.new_month", "նոր այս ամիս")} · ${formatNumber(custStats.with_bookings, lang)} ${tx(t, "admin.dash2.agent.with_bookings", "ամրագրումներով")}` : "—"}</div>
        </div>
        <div className="kpi-card c-warning">
          <div className="kpi-head"><span className="kpi-label"><i className="ti ti-user-plus" />{tx(t, "admin.dash2.agent.new_leads", "Նոր հնարավոր հաճախորդներ (7օր)")}</span></div>
          <div className="kpi-value">{formatValue(leadStats?.new_7d, lang)}</div>
          <div className="kpi-sub">{leadStats ? `${formatNumber(leadStats.qualified, lang)} ${tx(t, "admin.dash2.agent.qualified", "որակյալ")} · ${leadStats.conversion_rate}% ${tx(t, "admin.dash2.agent.conversion", "փոխարկում")}` : "—"}</div>
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.agent.pipeline_by_stage", "Խողովակն ըստ փուլերի")}</div><div className="card-subtitle">{tx(t, "admin.dash2.agent.open_by_stage", "Բաց գործարքներն ըստ փուլի")}</div></div></div>
          <div className="card-body">
            {byStage.length === 0 ? (
              <div className="cell-muted">—</div>
            ) : (
              <div className="breakdown">
                {byStage.map((s) => {
                  const m = STAGE_META[s.stage] ?? { key: `admin.dash2.stage.${s.stage}`, fallback: s.stage, tone: "" };
                  return (
                    <BreakdownRow key={s.stage} label={tx(t, m.key, m.fallback)} tone={m.tone} pct={(s.value / maxStageValue) * 100} value={`${formatNumber(s.count, lang)} · ${formatValue(s.value, lang)}`} />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.agent.quick_actions", "Արագ գործողություններ")}</div><div className="card-subtitle">{tx(t, "admin.dash2.agent.daily_work", "Անցնել ձեր ամենօրյա աշխատանքին")}</div></div></div>
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
                  <span className="tile-label">{tx(t, tile.key, tile.fallback)}</span>
                  <span className="tile-sub">{tx(t, tile.subKey, tile.subFallback)}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.agent.my_customers", "Իմ հաճախորդները")}</div><div className="card-subtitle">{tx(t, "admin.dash2.agent.most_recent", "Ամենավերջինները")}</div></div><button className="btn btn-sm" onClick={() => router.push("/crm/customers")}><i className="ti ti-arrow-right" />{tx(t, "admin.dash2.agent.all_customers", "Բոլոր հաճախորդները")}</button></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{tx(t, "admin.dash2.agent.col_customer", "Հաճախորդ")}</th><th>{tx(t, "admin.dash2.agent.col_email", "Էլ. փոստ")}</th><th>{tx(t, "admin.dash2.agent.col_status", "Կարգավիճակ")}</th><th>{tx(t, "admin.dash2.agent.col_bookings", "Ամրագրումներ")}</th></tr></thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={4} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{tx(t, "admin.dash2.agent.no_customers", "Հաճախորդներ դեռ չկան")}</td></tr>
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
        <div className="card-header"><div><div className="card-title">{tx(t, "admin.dash2.agent.my_contracts", "Իմ պայմանագրերը")}</div><div className="card-subtitle">{tx(t, "admin.dash2.agent.agreements", "Ձեր կառավարած համաձայնագրերը")}</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{tx(t, "admin.dash2.agent.col_number", "Համար")}</th><th>{tx(t, "admin.dash2.agent.col_counterparty", "Կողմեր")}</th><th>{tx(t, "admin.dash2.agent.col_status", "Կարգավիճակ")}</th><th>{tx(t, "admin.dash2.agent.col_expires", "Ավարտ")}</th></tr></thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr><td colSpan={4} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{tx(t, "admin.dash2.agent.no_contracts", "Պայմանագրեր դեռ չկան")}</td></tr>
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
  const { t, lang, setLang, languageOptions } = useLanguage();
  const { token, user, logout } = useAdminAuth();
  const [rangeDays, setRangeDays] = useState(30);
  const { sidebarCollapsed, onHamburger, closeNav, layoutClass } = useMgmtMobileNav();
  const [unreadCount, setUnreadCount] = useState(0);

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
      { key: "overview", label: tx(t, "admin.dash2.tab.overview", "Ընդհանուր ակնարկ"), icon: "ti-layout-dashboard", superPill: true, subtitle: tx(t, "admin.dash2.sub.overview", "Շուկայի ընդհանուր ցուցանիշները բոլոր օպերատորների համար"), show: allowedPlatformStats },
      { key: "platform-stats", label: tx(t, "admin.dash2.tab.platform_stats", "Հարթակի վիճակագրություն"), icon: "ti-chart-bar", superPill: true, subtitle: tx(t, "admin.dash2.sub.platform_stats", "Եկամուտ, միջնորդավճար և վճարումներ ամբողջ շուկայում"), show: allowedPlatformStats },
      { key: "operator-stats", label: tx(t, "admin.dash2.tab.operator_stats", "Օպերատորի վիճակագրություն"), icon: "ti-building-store", superPill: false, subtitle: tx(t, "admin.dash2.sub.operator_stats", "Ձեր ընկերության ցուցանիշները։ Թվերը՝ ըստ արժույթի, երբեք չեն գումարվում"), show: allowedOperatorStats },
      { key: "agent", label: tx(t, "admin.dash2.tab.agent", "Գործակալի աշխատանք"), icon: "ti-users", superPill: false, subtitle: tx(t, "admin.dash2.sub.agent", "Ձեր վաճառքի խողովակն ու հաճախորդները"), show: allowedAgent },
    ];
    return all.filter((tab) => tab.show).map(({ show: _show, ...rest }) => rest);
  }, [t, allowedPlatformStats, allowedOperatorStats, allowedAgent]);

  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  useEffect(() => {
    const firstTab = tabs[0];
    if (!firstTab) return;
    if (!activeTab || !tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(firstTab.key);
    }
  }, [tabs, activeTab]);

  const activeDef = tabs.find((tab) => tab.key === activeTab) ?? null;
  const greeting = user?.name
    ? `${tx(t, "admin.dashboard.title", "Վահանակ")} — ${user.name}`
    : tx(t, "admin.dashboard.title", "Վահանակ");
  const showRangeSelect = activeTab === "overview" || activeTab === "platform-stats";

  const handleExport = useCallback(() => {
    // Export is intentionally a no-op stub here (the data lives per-pane); the
    // button is kept to match the mockup's actions slot.
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
                  <a onClick={() => router.push("/dashboard")}>{tx(t, "admin.dash2.breadcrumb_home", "Գլխավոր")}</a>
                  <i className="ti ti-chevron-right" />
                  <span className="breadcrumb-current">{tx(t, "admin.dashboard.title", "Վահանակ")}</span>
                </div>
                <h1 className="page-title">
                  <span>{greeting}</span>
                  {activeDef?.superPill ? (
                    <span className="super-tag">
                      <i className="ti ti-shield-lock" style={{ fontSize: 13 }} />
                      {tx(t, "admin.dash2.super_admin", "Սուպեր ադմին")}
                    </span>
                  ) : null}
                </h1>
                <div className="page-subtitle">{activeDef?.subtitle ?? tx(t, "admin.dashboard.platform_overview", "Հարթակի ընդհանուր պատկերը")}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {showRangeSelect ? (
                  <select
                    className="range-select"
                    value={String(rangeDays)}
                    onChange={(e) => setRangeDays(Number(e.target.value))}
                    aria-label={tx(t, "admin.dashboard.date_range", "Ժամանակահատված")}
                  >
                    <option value="7">{tx(t, "admin.dashboard.last_7d", "Վերջին 7 օր")}</option>
                    <option value="30">{tx(t, "admin.dashboard.last_30d", "Վերջին 30 օր")}</option>
                    <option value="90">{tx(t, "admin.dashboard.last_90d", "Վերջին 90 օր")}</option>
                    <option value="365">{tx(t, "admin.dash2.last_12m", "Վերջին 12 ամիս")}</option>
                  </select>
                ) : null}
                {activeTab === "overview" ? (
                  <button className="btn btn-primary" onClick={handleExport}>
                    <i className="ti ti-download" />
                    {tx(t, "admin.dashboard.export", "Արտահանել")}
                  </button>
                ) : null}
              </div>
            </div>

            {!allowed ? (
              <div className="card" style={{ padding: 16 }}>{tx(t, "admin.forbidden.dashboard_stats", "Հասանելի չէ")}</div>
            ) : tabs.length === 0 ? (
              <div className="empty-state">
                <div className="es-icon"><i className="ti ti-layout-dashboard" /></div>
                <div className="es-title">{tx(t, "admin.dashboard.title", "Վահանակ")}</div>
                <div className="es-sub">{tx(t, "admin.dash2.no_panes", "Այս հաշվի համար վահանակի բաժիններ հասանելի չեն։")}</div>
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
                  <div className="page-pane active"><OverviewPane token={token} days={rangeDays} /></div>
                ) : null}
                {activeTab === "platform-stats" && token ? (
                  <div className="page-pane active"><PlatformStatsPane token={token} days={rangeDays} /></div>
                ) : null}
                {activeTab === "operator-stats" && token ? (
                  <div className="page-pane active"><OperatorStatsPane token={token} /></div>
                ) : null}
                {activeTab === "agent" && token ? (
                  <div className="page-pane active"><AgentPane token={token} /></div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
