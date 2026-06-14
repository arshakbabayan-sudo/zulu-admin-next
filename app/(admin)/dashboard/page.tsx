"use client";

/**
 * Admin dashboard — 4-tab, role-scoped (regen 2026-06-14).
 *
 * One section-tab strip drives four panes; only the tabs the signed-in user is
 * entitled to render, and the first entitled one is the default. Every pane is
 * wired straight to the documented backend endpoints (no mock data).
 *
 *   overview        (super)    → platform-admin/statistics/* + finance/* + approvals/stats
 *   platform-stats  (super)    → finance-summary/v2 + statistics/* + finance/revenue-by-service
 *   operator-stats  (operator) → operator/statistics (company-scoped, currency-aware)
 *   agent           (agent)    → crm/* + seller/contracts
 *
 * Blueprint: docs/admin_designe/dashboard/{dashboard.html,INTEGRATION.md}.
 * Cells without a real API render a graceful "—"/empty state.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  canAccessDashboardSection,
  canAccessOperatorStatisticsNav,
  canAccessPlatformAdminNav,
  isAgentOnlyRole,
} from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import { apiPlatformStats, type PlatformStats } from "@/lib/platform-admin-api";
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
import { apiSellerContracts } from "@/lib/contracts-api";
import type { ContractRow } from "@/lib/contracts-api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { formatNumber, formatDateTime } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/export-csv";
import { Table, THead, TBody, TR, TH, TD, TEmpty, Badge, type BadgeTone } from "@/components/ui";
import { PageHeader as V2PageHeader, V2Button, SuperAdminTag } from "@/components/ui/v2";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  ArrowUpRight,
  PieChart,
  ArrowRight,
  Layers,
  BarChart3,
  Store,
  Users,
  Target,
  UserPlus,
  Tag,
  FileText,
  Search,
  CalendarDays,
  Coins,
  Clock,
  Info,
  ArrowDownLeft,
  Receipt,
  Undo2,
  Banknote,
  Ticket,
} from "lucide-react";

function formatValue(n: number | undefined | null, lang: string = "en"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return formatNumber(n, lang);
}

/**
 * Translation helper — returns translated string, or fallback when the key
 * isn't in the bundle (t() returns the key itself in that case). Armenian is
 * the primary locale, so every fallback below is Armenian.
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

/* ─── small building blocks ─────────────────────────────────────────── */

/**
 * HeroStatCard — Phase 1 visual refresh (2026-05-23). Solid-colored "kpi-card"
 * variant when `tone` is set, original white-bg variant otherwise.
 */
function HeroStatCard({
  label,
  value,
  icon: Icon,
  trend,
  subRow,
  tone,
  chips,
  note,
}: {
  label: string;
  value: string;
  icon: typeof Briefcase;
  trend?: { sign: "up" | "down" | "flat"; pct: string };
  subRow?: { left: { label: string; value: string }; right: { label: string; value: string } };
  tone?: "primary" | "success" | "warning" | "info";
  /** Currency chips for the per-currency operator KPIs (never summed). */
  chips?: string[];
  /** Small caption row (e.g. "Order-based" / "Payments-based"). */
  note?: string;
}) {
  if (tone) {
    const bgClass = {
      primary: "bg-primary-600",
      success: "bg-success-900",
      warning: "bg-warning-700",
      info: "bg-info-700",
    }[tone];
    const TrendIcon = trend?.sign === "down" ? TrendingDown : trend?.sign === "flat" ? Minus : TrendingUp;
    return (
      <div className={`rounded-2xl ${bgClass} p-5 text-white shadow-zulu-card sm:p-6`}>
        <div className="flex items-start justify-between">
          <span
            className="inline-flex size-10 items-center justify-center rounded-lg bg-white/20 text-white"
            aria-hidden
          >
            <Icon className="size-5" />
          </span>
          {trend ? (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              <TrendIcon className="size-3" aria-hidden />
              {trend.pct}
            </span>
          ) : null}
        </div>
        <div className="mt-4 text-3xl font-semibold tabular-nums sm:text-[28px]">{value}</div>
        <div className="mt-0.5 text-xs text-white/85">{label}</div>
        {chips && chips.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white"
              >
                {c}
              </span>
            ))}
          </div>
        ) : null}
        {note ? <div className="mt-2 text-[11px] text-white/75">{note}</div> : null}
        {subRow ? (
          <div className="mt-5 flex items-center justify-between border-t border-white/20 pt-3 text-xs text-white/85">
            <div className="flex flex-col">
              <span className="font-medium text-white">{subRow.left.label}</span>
              <span className="mt-0.5 tabular-nums text-white/85">{subRow.left.value}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="font-medium text-white">{subRow.right.label}</span>
              <span className="mt-0.5 tabular-nums text-white/85">{subRow.right.value}</span>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const trendColor =
    trend?.sign === "up" ? "text-success-700" : trend?.sign === "down" ? "text-error-600" : "text-fg-t6";
  return (
    <div className="rounded-2xl border border-default bg-white p-5 shadow-zulu-card sm:p-6">
      <div className="flex items-center gap-3 text-sm font-medium text-fg-t6">
        <span
          className="inline-flex size-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: "var(--admin-primary-soft)", color: "var(--admin-primary)" }}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <span>{label}</span>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums text-fg-t11">{value}</span>
        {trend ? (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
            <TrendingUp className="size-3" aria-hidden />
            {trend.pct}
          </span>
        ) : null}
      </div>
      {subRow ? (
        <div className="mt-5 flex items-center justify-between border-t border-default pt-3 text-xs text-fg-t6">
          <div className="flex flex-col">
            <span className="font-medium text-fg-t7">{subRow.left.label}</span>
            <span className="mt-0.5 tabular-nums">{subRow.left.value}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="font-medium text-fg-t7">{subRow.right.label}</span>
            <span className="mt-0.5 tabular-nums">{subRow.right.value}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Card chrome matching the ZuluSpin handoff mockup (header + body). */
function WidgetCard({
  title,
  subtitle,
  icon: Icon,
  children,
  action,
  bodyClassName = "p-5",
}: {
  title: string;
  subtitle?: string;
  icon: typeof PieChart;
  children: React.ReactNode;
  action?: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-zulu-card border border-default bg-white shadow-zulu-card">
      <div className="flex items-center justify-between gap-3 border-b border-default bg-figma-bg-1 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--admin-primary-soft)", color: "var(--admin-primary)" }}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-fg-t11">{title}</h3>
            {subtitle ? <p className="truncate text-[11px] text-fg-t6">{subtitle}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/**
 * BreakdownRow — labeled horizontal bar (mockup `.bd-row` → `.bd-fill width:%`).
 * Shared by the by-service / by-currency / pipeline-by-stage / destinations
 * breakdown cards on the three new panes.
 */
function BreakdownRow({
  label,
  pct,
  value,
  color = "var(--admin-primary)",
  icon,
}: {
  label: string;
  pct: number;
  value: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  const safePct = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-28 shrink-0 items-center gap-1.5 truncate text-xs font-medium text-fg-t7">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-figma-bg-1">
        <div className="h-full rounded-full" style={{ width: `${safePct}%`, backgroundColor: color }} />
      </div>
      <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums text-fg-t11">{value}</span>
    </div>
  );
}

/** CSS-bar day chart (mockup `.chart-bars` → `.bar height:%`), like statistics/page.tsx. */
function CssBarChart({
  points,
  color = "var(--admin-primary)",
  maxLabel,
}: {
  points: { key: string; value: number; title?: string }[];
  color?: string;
  maxLabel?: string;
}) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <>
      <div className="flex h-40 items-end gap-1">
        {points.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-fg-t6">—</div>
        ) : (
          points.map((p) => (
            <div
              key={p.key}
              className="group relative flex-1 rounded-t transition-colors"
              style={{
                height: `${(p.value / max) * 100}%`,
                minHeight: p.value > 0 ? 2 : 1,
                backgroundColor: color,
              }}
              title={p.title ?? `${p.key}: ${p.value}`}
            />
          ))
        )}
      </div>
      {maxLabel ? (
        <div className="mt-2 flex justify-between text-xs text-fg-t6">
          <span>{points[0]?.key ?? ""}</span>
          <span>{maxLabel}</span>
          <span>{points[points.length - 1]?.key ?? ""}</span>
        </div>
      ) : null}
    </>
  );
}

/** KPI card used on the platform-stats pane (ported from statistics/page.tsx). */
function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "good" ? "text-success-600" : tone === "warn" ? "text-warning-600" : "text-fg-t11";
  return (
    <div className="admin-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-fg-t6">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-fg-t6">{hint}</div>}
    </div>
  );
}

/** Status word → Badge tone (mockup mapping). */
function statusTone(status: string | null | undefined): BadgeTone {
  const s = (status ?? "").toLowerCase();
  if (["paid", "settled", "confirmed", "signed", "active", "success"].includes(s)) return "success";
  if (["pending", "review", "processing", "contacted", "prospect", "draft"].includes(s)) return "warning";
  if (["cancelled", "failed", "rejected", "inactive", "lost", "unqualified"].includes(s)) return "danger";
  return "gray";
}

/* ─── overview pane (super_admin — marketplace snapshot, mockup-matched) ── */

/** Initials avatar fallback (kept — also used by the agent pane). */
function actorInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const second = parts[1];
  return `${first[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase() || first.slice(0, 2).toUpperCase();
}

/** Top-seller row shape (kept — shared with the platform-stats pane). */
type TopSellerRow = {
  company_id: number;
  company_name?: string | null;
  name?: string | null;
  total_revenue?: number;
  revenue?: number;
  order_count?: number;
  orders?: number;
};

/** Service-key → Armenian label for the by-service breakdown. */
const SERVICE_LABELS: Record<string, string> = {
  flight: "Ավիատոմս",
  flights: "Թռիչքներ",
  hotel: "Հյուրանոցներ",
  hotels: "Հյուրանոցներ",
  package: "Փաթեթներ",
  packages: "Փաթեթներ",
  transfer: "Փոխադրումներ",
  transfers: "Փոխադրումներ",
  excursion: "Էքսկուրսիաներ",
  excursions: "Էքսկուրսիաներ",
  visa: "Վիզա",
  insurance: "Ապահովագրություն",
  other: "Այլ",
};

/**
 * OverviewKpi — toned KPI card matching the mockup `.kpi-card .c-{tone}`
 * (left accent + soft icon chip + signed delta pill + sub caption).
 */
function OverviewKpi({
  label,
  value,
  icon: Icon,
  tone,
  delta,
  sub,
  note,
}: {
  label: string;
  value: string;
  icon: typeof Briefcase;
  tone: "primary" | "success" | "info" | "warning";
  delta?: { sign: "up" | "down" | "flat"; text: string } | null;
  sub?: string;
  /** Small metric caption (e.g. "Պատվեր-հիմք"), rendered with an info dot. */
  note?: string;
}) {
  const accent = {
    primary: "var(--admin-primary)",
    success: "#318137",
    info: "#1770D0",
    warning: "#FFA000",
  }[tone];
  const soft = {
    primary: "var(--admin-primary-soft)",
    success: "rgba(49,129,55,0.12)",
    info: "rgba(23,112,208,0.12)",
    warning: "rgba(255,160,0,0.14)",
  }[tone];
  const TrendIcon =
    delta?.sign === "down" ? TrendingDown : delta?.sign === "flat" ? Minus : TrendingUp;
  const deltaColor =
    delta?.sign === "up" ? "text-success-700" : delta?.sign === "down" ? "text-error-600" : "text-fg-t6";
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-default bg-white p-5 shadow-zulu-card"
      style={{ borderInlineStartWidth: 3, borderInlineStartColor: accent }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-fg-t6">
          <span
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: soft, color: accent }}
            aria-hidden
          >
            <Icon className="size-4" />
          </span>
          <span>{label}</span>
        </span>
        {delta ? (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${deltaColor}`}>
            <TrendIcon className="size-3" aria-hidden />
            {delta.text}
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums text-fg-t11">{value}</div>
      {note ? (
        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-fg-t6">
          <Info className="size-3" aria-hidden />
          {note}
        </div>
      ) : sub ? (
        <div className="mt-1.5 truncate text-[11px] text-fg-t6">{sub}</div>
      ) : null}
    </div>
  );
}

/** Signed-percent delta between a current value and the previous window. */
function pctDelta(current: number, previous: number): { sign: "up" | "down" | "flat"; text: string } {
  if (previous <= 0) return { sign: "flat", text: "—" };
  const pct = ((current - previous) / previous) * 100;
  if (!Number.isFinite(pct) || pct === 0) return { sign: "flat", text: "0%" };
  return { sign: pct > 0 ? "up" : "down", text: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%` };
}

type DashboardSnapshot = {
  orders: { total_in_window: number };
  revenue: { total: number };
  sellers: { total: number };
};

type OvRevenuePoint = { date: string; revenue: number; orders: number };

/** Type → translated label + icon tone for the recent-activity table. */
const TX_TYPE_META: Record<string, { key: string; fallback: string; color: string; icon: typeof Briefcase }> = {
  payment_in: { key: "admin.dash2.ov.tx_payment_in", fallback: "Մուտքային վճարում", color: "#318137", icon: ArrowDownLeft },
  commission: { key: "admin.dash2.ov.tx_commission", fallback: "Միջնորդավճար", color: "var(--admin-primary)", icon: Receipt },
  refund: { key: "admin.dash2.ov.tx_refund", fallback: "Վերադարձ", color: "#BC3436", icon: Undo2 },
  payout: { key: "admin.dash2.ov.tx_payout", fallback: "Վճարում դուրս", color: "#6B7280", icon: Banknote },
  voucher_issued: { key: "admin.dash2.ov.tx_voucher", fallback: "Վաուչեր", color: "#1770D0", icon: Ticket },
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
      // allSettled so one missing endpoint doesn't blank the whole pane.
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

      // The dashboard snapshot is the primary call — a 403 there means no access.
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

  if (forbidden) return <div className="admin-card p-4"><ForbiddenNotice /></div>;
  if (loading && !snapshot) return <p className="text-sm text-fg-t6">{tx(t, "admin.dash2.loading", "Բեռնվում է…")}</p>;

  const bookings = snapshot?.orders?.total_in_window ?? 0;
  const revenue = snapshot?.revenue?.total ?? 0;
  const operators = snapshot?.sellers?.total ?? 0;

  // Previous-window values = (2N total) − (N total), per the INTEGRATION.md spec.
  const prevBookings = Math.max(0, (prevSnapshot?.orders?.total_in_window ?? 0) - bookings);
  const prevRevenue = Math.max(0, (prevSnapshot?.revenue?.total ?? 0) - revenue);
  const bookingsDelta = prevSnapshot ? pctDelta(bookings, prevBookings) : null;
  const revenueDelta = prevSnapshot ? pctDelta(revenue, prevRevenue) : null;

  const maxRevenue = Math.max(...revenueSeries.map((p) => p.revenue), 1);
  const maxSvc = Math.max(...byService.map((s) => s.amount), 1);
  const maxOpRev = Math.max(...topOperators.map((s) => s.revenue ?? s.total_revenue ?? 0), 1);

  const vsPrev = `${tx(t, "admin.dash2.ov.vs_prev", "նախորդ {n} օրվա համեմատ").replace("{n}", String(days))}`;

  return (
    <div className="space-y-5">
      {/* 1 ── KPI grid (4 toned cards) ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewKpi
          tone="primary"
          icon={CalendarDays}
          label={tx(t, "admin.dash2.ov.total_bookings", "Ընդհանուր ամրագրումներ")}
          value={formatValue(bookings, lang)}
          delta={bookingsDelta}
          sub={vsPrev}
        />
        <OverviewKpi
          tone="success"
          icon={Coins}
          label={tx(t, "admin.dash2.ov.gross_revenue", "Համախառն եկամուտ")}
          value={curLabel("AMD", revenue, lang)}
          delta={revenueDelta}
          note={tx(t, "admin.dash2.ov.order_based", "Պատվեր-հիմք")}
        />
        <OverviewKpi
          tone="info"
          icon={Store}
          label={tx(t, "admin.dash2.ov.active_operators", "Ակտիվ օպերատորներ")}
          value={formatValue(operators, lang)}
          sub={tx(t, "admin.dash2.ov.across_marketplace", "ամբողջ շուկայում")}
        />
        <OverviewKpi
          tone="warning"
          icon={Clock}
          label={tx(t, "admin.dash2.ov.pending_approvals", "Սպասվող հաստատումներ")}
          value={pendingApprovals == null ? "—" : formatValue(pendingApprovals, lang)}
          delta={{ sign: "flat", text: "0" }}
          sub={tx(t, "admin.dash2.ov.approvals_sub", "ընկերություններ · վաճառողներ · առաջարկներ · կարծիքներ")}
        />
      </div>

      {/* 2 ── two-column row: booking overview chart + orders by service ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetCard
          title={tx(t, "admin.dash2.ov.booking_overview", "Ամրագրումների ակնարկ")}
          subtitle={`${tx(t, "admin.dash2.ov.daily_revenue", "Օրական եկամուտ")} · ${tx(t, "admin.dash2.ov.last_n_days", "վերջին {n} օր").replace("{n}", String(days))}`}
          icon={BarChart3}
        >
          <CssBarChart
            points={revenueSeries.map((p) => ({
              key: p.date.slice(-2),
              value: p.revenue,
              title: `${p.date}: ${curLabel("AMD", p.revenue, lang)} · ${formatNumber(p.orders, lang)}`,
            }))}
            maxLabel={`${tx(t, "admin.dash2.max", "Առավելագույն")}: ${curLabel("AMD", maxRevenue, lang)}`}
          />
        </WidgetCard>
        <WidgetCard
          title={tx(t, "admin.dash2.ov.orders_by_service", "Պատվերներն ըստ ծառայության")}
          subtitle={tx(t, "admin.dash2.ov.share_of_revenue", "Բաժին ընդհանուր եկամտից")}
          icon={Layers}
        >
          {byService.length === 0 ? (
            <p className="py-2 text-sm text-fg-t6">{tx(t, "admin.dash2.no_data", "Տվյալներ չկան")}</p>
          ) : (
            <div className="space-y-3">
              {byService.map((s) => (
                <BreakdownRow
                  key={s.service}
                  label={tx(t, `admin.dash2.service.${s.service}`, SERVICE_LABELS[s.service.toLowerCase()] ?? s.service)}
                  pct={(s.amount / maxSvc) * 100}
                  value={`${curLabel("AMD", s.amount, lang)} ${s.pct}%`}
                  color={SERVICE_TONES[s.service.toLowerCase()] ?? "var(--admin-primary)"}
                />
              ))}
            </div>
          )}
        </WidgetCard>
      </div>

      {/* 3 ── recent activity ── */}
      <WidgetCard
        title={tx(t, "admin.dash2.ov.recent_activity", "Վերջին ակտիվությունը")}
        subtitle={tx(t, "admin.dash2.ov.recent_activity_sub", "Վերջին վճարումներ, վերադարձներ, միջնորդավճարներ")}
        icon={Activity}
        bodyClassName="p-0"
        action={
          <Link
            href="/platform/finance"
            className="inline-flex items-center gap-1 rounded-md border border-default px-2.5 py-1.5 text-xs font-medium text-fg-t11 transition hover:bg-figma-bg-1"
          >
            {tx(t, "admin.dash2.ov.open_finance", "Բացել ֆինանսները")}
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      >
        <Table>
          <THead>
            <TR>
              <TH>{tx(t, "admin.dash2.ov.col_type", "Տեսակ")}</TH>
              <TH>{tx(t, "admin.dash2.ov.col_company", "Ընկերություն")}</TH>
              <TH align="right">{tx(t, "admin.dash2.ov.col_amount", "Գումար")}</TH>
              <TH>{tx(t, "admin.dash2.ov.col_time", "Ժամ")}</TH>
              <TH align="right">{tx(t, "admin.dash2.ov.col_status", "Կարգավիճակ")}</TH>
            </TR>
          </THead>
          <TBody>
            {recentTx.length === 0 ? (
              <TEmpty colSpan={5}>{tx(t, "admin.dash2.no_data", "Տվյալներ չկան")}</TEmpty>
            ) : (
              recentTx.map((row) => {
                const meta = TX_TYPE_META[row.type] ?? { key: "", fallback: row.type, color: "var(--admin-primary)", icon: Activity };
                const TxIcon = meta.icon;
                return (
                  <TR key={row.id}>
                    <TD>
                      <span className="inline-flex items-center gap-1.5 font-medium text-fg-t11">
                        <TxIcon className="size-3.5" style={{ color: meta.color }} aria-hidden />
                        {meta.key ? tx(t, meta.key, meta.fallback) : meta.fallback}
                      </span>
                    </TD>
                    <TD className="text-fg-t7">{row.company?.name ?? "—"}</TD>
                    <TD align="right" className="font-mono tabular-nums">{curLabel(row.currency, row.amount, lang)}</TD>
                    <TD className="text-fg-t6">{formatDateTime(row.when, lang)}</TD>
                    <TD align="right"><Badge tone={statusTone(row.status)}>{row.status}</Badge></TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </WidgetCard>

      {/* 4 ── top operators ── */}
      <WidgetCard
        title={tx(t, "admin.dash2.ov.top_operators", "Լավագույն օպերատորներ")}
        subtitle={tx(t, "admin.dash2.ov.top_operators_sub", "Ըստ ընդհանուր եկամտի այս ժամանակահատվածում")}
        icon={ArrowUpRight}
        bodyClassName="p-0"
      >
        <Table>
          <THead>
            <TR>
              <TH>#</TH>
              <TH>{tx(t, "admin.dash2.ov.col_operator", "Օպերատոր")}</TH>
              <TH align="right">{tx(t, "admin.dash2.ov.col_revenue", "Եկամուտ")}</TH>
              <TH align="right">{tx(t, "admin.dash2.ov.col_orders", "Պատվերներ")}</TH>
            </TR>
          </THead>
          <TBody>
            {topOperators.length === 0 ? (
              <TEmpty colSpan={4}>{tx(t, "admin.dash2.no_data", "Տվյալներ չկան")}</TEmpty>
            ) : (
              topOperators.map((s, i) => {
                const rev = s.revenue ?? s.total_revenue ?? 0;
                const orders = s.orders ?? s.order_count ?? 0;
                return (
                  <TR key={s.company_id}>
                    <TD className="font-mono tabular-nums text-fg-t6">{i + 1}</TD>
                    <TD>
                      <Link href={`/platform/companies/${s.company_id}`} className="font-medium text-fg-t11 hover:underline">
                        {s.name ?? s.company_name ?? `#${s.company_id}`}
                      </Link>
                      <div className="mt-1 h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-figma-bg-1">
                        <div className="h-full rounded-full" style={{ width: `${(rev / maxOpRev) * 100}%`, backgroundColor: "var(--admin-primary)" }} />
                      </div>
                    </TD>
                    <TD align="right" className="font-mono font-semibold tabular-nums">{curLabel("AMD", rev, lang)}</TD>
                    <TD align="right" className="font-mono tabular-nums">{formatNumber(orders, lang)}</TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </WidgetCard>
    </div>
  );
}

/* ─── platform-stats pane (payments-based money tab) ─────────────────── */

type RevenuePoint = { date: string; revenue: number; orders: number };
type OrdersPoint = { date: string; total: number; by_status: Record<string, number> };

const SERVICE_TONES: Record<string, string> = {
  flight: "var(--admin-primary)",
  flights: "var(--admin-primary)",
  hotel: "#1770D0",
  hotels: "#1770D0",
  package: "#318137",
  packages: "#318137",
  transfer: "#9CA0B0",
  transfers: "#9CA0B0",
  excursion: "#FFA000",
  excursions: "#FFA000",
  visa: "#923081",
  insurance: "#1770D0",
};

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", AMD: "֏", RUB: "₽", GBP: "£" };

function curLabel(code: string, amount: number, lang: string): string {
  const sym = CURRENCY_SYMBOL[code.toUpperCase()] ?? "";
  return `${sym}${sym ? " " : ""}${formatValue(amount, lang)}${sym ? "" : ` ${code.toUpperCase()}`}`;
}

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

  if (forbidden) return <div className="admin-card p-4"><ForbiddenNotice /></div>;
  if (loading && !summary) return <p className="text-sm text-fg-t6">{tx(t, "admin.dash2.loading", "Բեռնվում է…")}</p>;

  const avgOrder = summary && summary.payments_count_paid > 0 ? summary.total_payments_paid / summary.payments_count_paid : 0;
  const split = summary?.commission_split ?? { platform: 0, agent: 0 };
  const splitTotal = split.platform + split.agent || 1;
  const currencyEntries = Object.entries(summary?.currency_breakdown ?? {});
  const maxCurrency = Math.max(...currencyEntries.map(([, v]) => Math.abs(v)), 1);
  const maxRevenue = Math.max(...revenueSeries.map((p) => p.revenue), 1);
  const maxOrders = Math.max(...ordersSeries.map((p) => p.total), 1);
  const maxSvc = Math.max(...byService.map((s) => s.amount), 1);
  const maxSellerRev = Math.max(...sellers.map((s) => s.revenue ?? s.total_revenue ?? 0), 1);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label={tx(t, "admin.dash2.pstats.total_revenue", "Ընդհանուր եկամուտ")}
          value={`$${formatValue(summary?.total_payments_paid, lang)}`}
          hint={tx(t, "admin.dash2.pstats.payments_based", "Վճարումների հիման վրա")}
          tone="good"
        />
        <Kpi
          label={tx(t, "admin.dash2.pstats.commission_earned", "Վաստակած միջնորդավճար")}
          value={`$${formatValue(summary?.total_commission_accrued, lang)}`}
        />
        <Kpi
          label={tx(t, "admin.dash2.pstats.pending_payouts", "Սպասվող վճարումներ")}
          value={`$${formatValue(summary?.total_commission_pending, lang)}`}
          tone="warn"
        />
        <Kpi
          label={tx(t, "admin.dash2.pstats.avg_order", "Միջին պատվերի արժեք")}
          value={`$${formatValue(avgOrder, lang)}`}
          hint={tx(t, "admin.dash2.pstats.avg_formula", "Վճարումներ ÷ քանակ")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetCard title={tx(t, "admin.dash2.pstats.revenue_series", "Եկամտի շարք")} subtitle={tx(t, "admin.dash2.pstats.daily_revenue", "Օրական եկամուտ")} icon={BarChart3}>
          <CssBarChart
            points={revenueSeries.map((p) => ({ key: p.date, value: p.revenue, title: `${p.date}: $${formatValue(p.revenue, lang)} · ${p.orders}` }))}
            maxLabel={`${tx(t, "admin.dash2.max", "Առավելագույն")}: $${formatValue(maxRevenue, lang)}`}
          />
        </WidgetCard>
        <WidgetCard title={tx(t, "admin.dash2.pstats.orders_series", "Պատվերների շարք")} subtitle={tx(t, "admin.dash2.pstats.daily_orders", "Օրական պատվերներ")} icon={BarChart3}>
          <CssBarChart
            points={ordersSeries.map((p) => ({ key: p.date, value: p.total, title: `${p.date}: ${p.total}` }))}
            color="#318137"
            maxLabel={`${tx(t, "admin.dash2.max", "Առավելագույն")}: ${formatValue(maxOrders, lang)}`}
          />
        </WidgetCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetCard title={tx(t, "admin.dash2.pstats.commission_split", "Միջնորդավճարի բաշխում")} subtitle={tx(t, "admin.dash2.pstats.platform_vs_agent", "Հարթակ ընդդեմ գործակալ")} icon={PieChart}>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-figma-bg-1">
            <div className="h-full" style={{ width: `${(split.platform / splitTotal) * 100}%`, backgroundColor: "var(--admin-primary)" }} />
            <div className="h-full" style={{ width: `${(split.agent / splitTotal) * 100}%`, backgroundColor: "#1770D0" }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-fg-t7">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: "var(--admin-primary)" }} aria-hidden />
              {tx(t, "admin.dash2.pstats.platform", "Հարթակ")} · {((split.platform / splitTotal) * 100).toFixed(0)}% · ${formatValue(split.platform, lang)}
            </span>
            <span className="flex items-center gap-1.5 text-fg-t7">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: "#1770D0" }} aria-hidden />
              {tx(t, "admin.dash2.pstats.agent", "Գործակալ")} · {((split.agent / splitTotal) * 100).toFixed(0)}% · ${formatValue(split.agent, lang)}
            </span>
          </div>
        </WidgetCard>
        <WidgetCard title={tx(t, "admin.dash2.pstats.revenue_by_currency", "Եկամուտ ըստ արժույթի")} subtitle={tx(t, "admin.dash2.pstats.current_range", "Ընթացիկ ժամանակահատված")} icon={DollarSign}>
          {currencyEntries.length === 0 ? (
            <p className="py-2 text-sm text-fg-t6">—</p>
          ) : (
            <div className="space-y-3">
              {currencyEntries.map(([code, amount]) => (
                <BreakdownRow
                  key={code}
                  label={code.toUpperCase()}
                  pct={(Math.abs(amount) / maxCurrency) * 100}
                  value={curLabel(code, amount, lang)}
                />
              ))}
            </div>
          )}
        </WidgetCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetCard title={tx(t, "admin.dash2.pstats.revenue_by_service", "Եկամուտ ըստ ծառայության")} subtitle={tx(t, "admin.dash2.pstats.share_of_payments", "Վճարումների բաժին")} icon={Layers}>
          {byService.length === 0 ? (
            <p className="py-2 text-sm text-fg-t6">—</p>
          ) : (
            <div className="space-y-3">
              {byService.map((s) => (
                <BreakdownRow
                  key={s.service}
                  label={tx(t, `admin.dash2.service.${s.service}`, s.service)}
                  pct={(s.amount / maxSvc) * 100}
                  value={`${s.pct}%`}
                  color={SERVICE_TONES[s.service.toLowerCase()] ?? "var(--admin-primary)"}
                />
              ))}
            </div>
          )}
        </WidgetCard>
        <WidgetCard title={tx(t, "admin.dash2.pstats.top_sellers", "Լավագույն վաճառողներ")} subtitle={tx(t, "admin.dash2.pstats.by_revenue", "Ըստ եկամտի")} icon={Store} bodyClassName="p-0">
          <Table>
            <THead>
              <TR>
                <TH>{tx(t, "admin.dash2.pstats.seller", "Վաճառող")}</TH>
                <TH align="right">{tx(t, "admin.dash2.pstats.revenue", "Եկամուտ")}</TH>
                <TH align="right">{tx(t, "admin.dash2.pstats.orders", "Պատվերներ")}</TH>
              </TR>
            </THead>
            <TBody>
              {sellers.length === 0 ? (
                <TEmpty colSpan={3}>{tx(t, "admin.dash2.no_data", "Տվյալներ չկան")}</TEmpty>
              ) : (
                sellers.map((s) => {
                  const rev = s.revenue ?? s.total_revenue ?? 0;
                  return (
                    <TR key={s.company_id}>
                      <TD>
                        <Link href={`/platform/companies/${s.company_id}`} className="font-medium text-fg-t11 hover:underline">
                          {s.name ?? s.company_name ?? `#${s.company_id}`}
                        </Link>
                        <div className="mt-1 h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-figma-bg-1">
                          <div className="h-full rounded-full" style={{ width: `${(rev / maxSellerRev) * 100}%`, backgroundColor: "var(--admin-primary)" }} />
                        </div>
                      </TD>
                      <TD align="right" className="font-semibold tabular-nums">${formatValue(rev, lang)}</TD>
                      <TD align="right" className="tabular-nums">{formatNumber(s.orders ?? s.order_count ?? 0, lang)}</TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </WidgetCard>
      </div>
    </div>
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

  if (forbidden) return <div className="admin-card p-4"><ForbiddenNotice /></div>;
  if (loading && !data) return <p className="text-sm text-fg-t6">{tx(t, "admin.dash2.loading", "Բեռնվում է…")}</p>;
  if (!data) return <p className="py-2 text-sm text-fg-t6">{tx(t, "admin.dash2.no_data", "Տվյալներ չկան")}</p>;

  const revenue = splitCurrency(data.stats.revenue_by_currency, data.stats.primary_currency, lang);
  const commission = splitCurrency(data.stats.commission_by_currency, data.stats.primary_currency, lang);
  const trendPoints = data.trend.labels.map((label, i) => ({ key: label, value: data.trend.values[i] ?? 0, title: `${label}: ${formatValue(data.trend.values[i] ?? 0, lang)}` }));
  const maxSvcRev = Math.max(...data.service_breakdown.map((s) => s.revenue), 1);
  const maxDest = Math.max(...data.top_destinations.map((d) => d.bookings), 1);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStatCard tone="primary" label={tx(t, "admin.dash2.op.my_bookings", "Իմ ամրագրումները")} value={formatValue(data.stats.total_bookings, lang)} icon={Briefcase} note={tx(t, "admin.dash2.op.this_period", "Այս ժամանակահատվածում")} />
        <HeroStatCard tone="info" label={tx(t, "admin.dash2.op.active_offers", "Ակտիվ առաջարկներ")} value={formatValue(data.stats.active_offers, lang)} icon={Tag} note={tx(t, "admin.dash2.op.live_marketplace", "Շուկայում հասանելի")} />
        <HeroStatCard tone="success" label={tx(t, "admin.dash2.op.revenue", "Եկամուտ")} value={revenue.big} icon={DollarSign} chips={revenue.chips} />
        <HeroStatCard tone="warning" label={tx(t, "admin.dash2.op.commission", "Միջնորդավճար")} value={commission.big} icon={ArrowUpRight} chips={commission.chips} />
      </div>

      <WidgetCard
        title={tx(t, "admin.dash2.op.trend_title", "12-ամսյա եկամտի միտում")}
        subtitle={`${tx(t, "admin.dash2.op.primary_currency", "Հիմնական արժույթ")}${data.trend.currency ? ` (${data.trend.currency})` : ""}`}
        icon={BarChart3}
      >
        <CssBarChart points={trendPoints} />
      </WidgetCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetCard title={tx(t, "admin.dash2.op.by_service", "Ըստ ծառայության")} subtitle={tx(t, "admin.dash2.op.bookings_revenue", "Ամրագրումներ և եկամուտ")} icon={Layers}>
          {data.service_breakdown.length === 0 ? (
            <p className="py-2 text-sm text-fg-t6">—</p>
          ) : (
            <div className="space-y-3">
              {data.service_breakdown.map((s) => (
                <BreakdownRow
                  key={s.type}
                  label={tx(t, `admin.dash2.service.${s.type}`, s.type)}
                  pct={(s.revenue / maxSvcRev) * 100}
                  value={`${formatNumber(s.bookings, lang)} · ${formatValue(s.revenue, lang)}`}
                  color={SERVICE_TONES[s.type.toLowerCase()] ?? "var(--admin-primary)"}
                />
              ))}
            </div>
          )}
        </WidgetCard>
        <WidgetCard title={tx(t, "admin.dash2.op.top_destinations", "Լավագույն ուղղություններ")} subtitle={tx(t, "admin.dash2.op.by_bookings", "Ըստ ամրագրումների")} icon={Target}>
          {data.top_destinations.length === 0 ? (
            <p className="py-2 text-sm text-fg-t6">—</p>
          ) : (
            <div className="space-y-3">
              {data.top_destinations.slice(0, 6).map((d) => (
                <BreakdownRow key={d.name} label={d.name} pct={(d.bookings / maxDest) * 100} value={formatNumber(d.bookings, lang)} />
              ))}
            </div>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}

/* ─── agent pane (CRM workspace) ─────────────────────────────────────── */

const STAGE_TONES: Record<string, string> = {
  new: "#1770D0",
  qualified: "var(--admin-primary)",
  proposal: "#FFA000",
  negotiation: "#923081",
  won: "#318137",
  lost: "#BC3436",
};

function AgentPane({ token }: { token: string }) {
  const { t, lang } = useLanguage();
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
        // Each call is independent — settle all so one missing endpoint (e.g.
        // an agent without contracts) doesn't blank the whole pane.
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

  if (forbidden) return <div className="admin-card p-4"><ForbiddenNotice /></div>;
  if (loading && !crm) return <p className="text-sm text-fg-t6">{tx(t, "admin.dash2.loading", "Բեռնվում է…")}</p>;

  const byStage = crm?.by_stage ? Object.values(crm.by_stage) : [];
  const maxStageValue = Math.max(...byStage.map((s) => s.value), 1);

  const tiles: { route: string; label: string; sub: string; icon: typeof Target }[] = [
    { route: "/crm/pipeline", label: tx(t, "admin.dash2.agent.tile_deal", "Նոր գործարք"), sub: tx(t, "admin.dash2.agent.tile_deal_sub", "Բացել խողովակը"), icon: Target },
    { route: "/crm/customers", label: tx(t, "admin.dash2.agent.tile_customers", "Հաճախորդներ"), sub: tx(t, "admin.dash2.agent.tile_customers_sub", "Կառավարել ցանկը"), icon: Users },
    { route: "/crm/leads", label: tx(t, "admin.dash2.agent.tile_leads", "Հնարավոր հաճախորդներ"), sub: tx(t, "admin.dash2.agent.tile_leads_sub", "Հետևել"), icon: UserPlus },
    { route: "/inventory/hotels", label: tx(t, "admin.dash2.agent.tile_inventory", "Որոնել գույքագրում"), sub: tx(t, "admin.dash2.agent.tile_inventory_sub", "Գտնել առաջարկներ"), icon: Search },
    { route: "/agent/contracts", label: tx(t, "admin.dash2.agent.tile_contracts", "Իմ պայմանագրերը"), sub: tx(t, "admin.dash2.agent.tile_contracts_sub", "Դիտել համաձայնագրերը"), icon: FileText },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStatCard tone="primary" label={tx(t, "admin.dash2.agent.open_deals", "Բաց գործարքներ")} value={formatValue(crm?.open_deals, lang)} icon={Target} note={tx(t, "admin.dash2.agent.in_pipeline", "Ձեր խողովակում")} />
        <HeroStatCard tone="info" label={tx(t, "admin.dash2.agent.pipeline_value", "Խողովակի արժեք")} value={formatValue(crm?.pipeline_value, lang)} icon={TrendingUp} note={tx(t, "admin.dash2.agent.across_deals", "Բաց գործարքների գումարը")} />
        <HeroStatCard
          tone="success"
          label={tx(t, "admin.dash2.agent.active_customers", "Ակտիվ հաճախորդներ")}
          value={formatValue(custStats?.active, lang)}
          icon={Users}
          note={custStats ? `${formatNumber(custStats.new_this_month, lang)} ${tx(t, "admin.dash2.agent.new_month", "նոր այս ամիս")} · ${formatNumber(custStats.with_bookings, lang)} ${tx(t, "admin.dash2.agent.with_bookings", "ամրագրումներով")}` : undefined}
        />
        <HeroStatCard
          tone="warning"
          label={tx(t, "admin.dash2.agent.new_leads", "Նոր հնարավոր հաճախորդներ (7օր)")}
          value={formatValue(leadStats?.new_7d, lang)}
          icon={UserPlus}
          note={leadStats ? `${formatNumber(leadStats.qualified, lang)} ${tx(t, "admin.dash2.agent.qualified", "որակյալ")} · ${leadStats.conversion_rate}% ${tx(t, "admin.dash2.agent.conversion", "փոխարկում")}` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetCard title={tx(t, "admin.dash2.agent.pipeline_by_stage", "Խողովակն ըստ փուլերի")} subtitle={tx(t, "admin.dash2.agent.open_by_stage", "Բաց գործարքներն ըստ փուլի")} icon={BarChart3}>
          {byStage.length === 0 ? (
            <p className="py-2 text-sm text-fg-t6">—</p>
          ) : (
            <div className="space-y-3">
              {byStage.map((s) => (
                <BreakdownRow
                  key={s.stage}
                  label={tx(t, `admin.dash2.stage.${s.stage}`, s.stage)}
                  pct={(s.value / maxStageValue) * 100}
                  value={`${formatNumber(s.count, lang)} · ${formatValue(s.value, lang)}`}
                  color={STAGE_TONES[s.stage] ?? "var(--admin-primary)"}
                />
              ))}
            </div>
          )}
        </WidgetCard>
        <WidgetCard title={tx(t, "admin.dash2.agent.quick_actions", "Արագ գործողություններ")} subtitle={tx(t, "admin.dash2.agent.daily_work", "Անցնել ձեր ամենօրյա աշխատանքին")} icon={ArrowUpRight}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tiles.map((tile) => {
              const TileIcon = tile.icon;
              return (
                <Link
                  key={tile.route}
                  href={tile.route}
                  className="flex flex-col gap-1 rounded-xl border border-default bg-white p-3.5 transition hover:border-[color:var(--admin-primary)] hover:bg-figma-bg-1"
                >
                  <span className="inline-flex size-8 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--admin-primary-soft)", color: "var(--admin-primary)" }}>
                    <TileIcon className="size-4" aria-hidden />
                  </span>
                  <span className="mt-1 text-sm font-semibold text-fg-t11">{tile.label}</span>
                  <span className="text-[11px] text-fg-t6">{tile.sub}</span>
                </Link>
              );
            })}
          </div>
        </WidgetCard>
      </div>

      <WidgetCard
        title={tx(t, "admin.dash2.agent.my_customers", "Իմ հաճախորդները")}
        subtitle={tx(t, "admin.dash2.agent.most_recent", "Ամենավերջինները")}
        icon={Users}
        bodyClassName="p-0"
        action={
          <Link href="/crm/customers" className="inline-flex items-center gap-0.5 text-xs font-medium text-primary-600 hover:text-primary-800">
            {tx(t, "admin.dash2.agent.all_customers", "Բոլոր հաճախորդները")}
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      >
        <Table>
          <THead>
            <TR>
              <TH>{tx(t, "admin.dash2.agent.col_customer", "Հաճախորդ")}</TH>
              <TH>{tx(t, "admin.dash2.agent.col_email", "Էլ. փոստ")}</TH>
              <TH>{tx(t, "admin.dash2.agent.col_status", "Կարգավիճակ")}</TH>
              <TH align="right">{tx(t, "admin.dash2.agent.col_bookings", "Ամրագրումներ")}</TH>
            </TR>
          </THead>
          <TBody>
            {customers.length === 0 ? (
              <TEmpty colSpan={4}>{tx(t, "admin.dash2.agent.no_customers", "Հաճախորդներ դեռ չկան")}</TEmpty>
            ) : (
              customers.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-900" aria-hidden>
                        {actorInitials(c.name)}
                      </span>
                      <span className="truncate font-medium text-fg-t11">{c.name}</span>
                    </div>
                  </TD>
                  <TD className="text-fg-t6">{c.email}</TD>
                  <TD><Badge tone={statusTone(c.status)}>{c.status}</Badge></TD>
                  <TD align="right" className="tabular-nums">{c.bookings_count > 0 ? formatNumber(c.bookings_count, lang) : "—"}</TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </WidgetCard>

      <WidgetCard title={tx(t, "admin.dash2.agent.my_contracts", "Իմ պայմանագրերը")} subtitle={tx(t, "admin.dash2.agent.agreements", "Ձեր կառավարած համաձայնագրերը")} icon={FileText} bodyClassName="p-0">
        <Table>
          <THead>
            <TR>
              <TH>{tx(t, "admin.dash2.agent.col_number", "Համար")}</TH>
              <TH>{tx(t, "admin.dash2.agent.col_counterparty", "Կողմեր")}</TH>
              <TH>{tx(t, "admin.dash2.agent.col_status", "Կարգավիճակ")}</TH>
              <TH align="right">{tx(t, "admin.dash2.agent.col_expires", "Ավարտ")}</TH>
            </TR>
          </THead>
          <TBody>
            {contracts.length === 0 ? (
              <TEmpty colSpan={4}>{tx(t, "admin.dash2.agent.no_contracts", "Պայմանագրեր դեռ չկան")}</TEmpty>
            ) : (
              contracts.slice(0, 8).map((c) => (
                <TR key={c.id}>
                  <TD className="font-mono text-xs">{c.contract_number}</TD>
                  <TD className="text-fg-t7">
                    {[c.partyA?.name, c.partyB?.name].filter(Boolean).join(" · ") || "—"}
                  </TD>
                  <TD><Badge tone={statusTone(c.status)}>{c.status}</Badge></TD>
                  <TD align="right" className="text-fg-t6">
                    {c.expiry_date ? new Date(c.expiry_date).toLocaleDateString(lang) : "—"}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </WidgetCard>
    </div>
  );
}

/* ─── page shell ───────────────────────────────────────────────────── */

type TabKey = "overview" | "platform-stats" | "operator-stats" | "agent";

type TabDef = {
  key: TabKey;
  label: string;
  icon: typeof Layers;
  superPill: boolean;
  subtitle: string;
};

export default function DashboardPage() {
  const { t } = useLanguage();
  useDocumentTitle(t("admin.dashboard.title"));
  const { token, user } = useAdminAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [exportToast, setExportToast] = useState<string | null>(null);

  const allowed = canAccessDashboardSection(user);
  const allowedPlatformStats = allowed && canAccessPlatformAdminNav(user);
  const allowedOperatorStats = canAccessOperatorStatisticsNav(user);
  const allowedAgent = isAgentOnlyRole(user);

  // ── Entitled tabs (super sees overview+platform-stats; operator-admins see
  // operator-stats; agents see the agent workspace). Default = first entitled. ──
  const tabs = useMemo<TabDef[]>(() => {
    const all: (TabDef & { show: boolean })[] = [
      { key: "overview", label: tx(t, "admin.dash2.tab.overview", "Ընդհանուր ակնարկ"), icon: Layers, superPill: true, subtitle: tx(t, "admin.dash2.sub.overview", "Շուկայի ընդհանուր ցուցանիշները բոլոր օպերատորների համար"), show: allowedPlatformStats },
      { key: "platform-stats", label: tx(t, "admin.dash2.tab.platform_stats", "Հարթակի վիճակագրություն"), icon: BarChart3, superPill: true, subtitle: tx(t, "admin.dash2.sub.platform_stats", "Եկամուտ, միջնորդավճար և վճարումներ ամբողջ շուկայում"), show: allowedPlatformStats },
      { key: "operator-stats", label: tx(t, "admin.dash2.tab.operator_stats", "Օպերատորի վիճակագրություն"), icon: Store, superPill: false, subtitle: tx(t, "admin.dash2.sub.operator_stats", "Ձեր ընկերության ցուցանիշները։ Թվերը՝ ըստ արժույթի, երբեք չեն գումարվում"), show: allowedOperatorStats },
      { key: "agent", label: tx(t, "admin.dash2.tab.agent", "Գործակալի աշխատանք"), icon: Users, superPill: false, subtitle: tx(t, "admin.dash2.sub.agent", "Ձեր վաճառքի խողովակն ու հաճախորդները"), show: allowedAgent },
    ];
    return all.filter((tab) => tab.show).map(({ show: _show, ...rest }) => rest);
  }, [t, allowedPlatformStats, allowedOperatorStats, allowedAgent]);

  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  // Default to the first entitled tab; re-pin if the current one becomes invalid.
  useEffect(() => {
    const firstTab = tabs[0];
    if (!firstTab) return;
    if (!activeTab || !tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(firstTab.key);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    if (!exportToast) return;
    const id = setTimeout(() => setExportToast(null), 2600);
    return () => clearTimeout(id);
  }, [exportToast]);

  function handleExportDashboardCsv() {
    if (!stats) return;
    const entries = Object.entries(stats).filter(([, v]) => typeof v === "number");
    if (entries.length === 0) return;
    exportRowsAsCsv<[string, number]>(
      "dashboard-metrics",
      entries as [string, number][],
      [
        ["metric", ([k]) => k],
        ["value", ([, v]) => v],
      ],
    );
    setExportToast(tx(t, "admin.dashboard.export_done", "Ցուցանիշներն արտահանվեցին։"));
  }

  // The full /platform-admin/stats snapshot now powers ONLY the Export CSV
  // button (the overview pane fetches its own widget data). Failures are
  // swallowed — export is a no-op while `stats` is null.
  useEffect(() => {
    if (!allowedPlatformStats || !token) return;
    let cancelled = false;
    void (async () => {
      try {
        const range = rangeDays === 7 ? "7d" : rangeDays === 90 ? "90d" : "30d";
        const res = await apiPlatformStats(token, range);
        if (!cancelled) setStats(res.data);
      } catch {
        if (!cancelled) setStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowedPlatformStats, token, rangeDays]);

  const greeting = user?.name ? `${t("admin.dashboard.title")} — ${user.name}` : t("admin.dashboard.title");
  const activeDef = tabs.find((tab) => tab.key === activeTab) ?? null;

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.dashboard.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice messageKey="admin.forbidden.dashboard_stats" />
        </div>
      </div>
    );
  }

  // Signed-in but no entitled tab (e.g. dashboard.view without any pane role).
  if (tabs.length === 0) {
    return (
      <div className="space-y-4">
        <V2PageHeader breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: t("admin.dashboard.title") }]} title={greeting} subtitle={t("admin.dashboard.platform_overview")} />
        <div className="admin-card p-6 text-center text-sm text-fg-t6">{tx(t, "admin.dash2.no_panes", "Այս հաշվի համար վահանակի բաժիններ հասանելի չեն։")}</div>
      </div>
    );
  }

  const showRangeSelect = activeTab === "overview" || activeTab === "platform-stats";

  return (
    <div className="space-y-5">
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: t("admin.dashboard.title") },
        ]}
        title={greeting}
        titleBadge={activeDef?.superPill ? <SuperAdminTag /> : undefined}
        subtitle={activeDef?.subtitle ?? t("admin.dashboard.platform_overview")}
        actions={
          <>
            {showRangeSelect ? (
              <select
                value={String(rangeDays)}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                className="h-9 rounded-md border bg-white px-3 text-[13px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }}
                aria-label={tx(t, "admin.dashboard.date_range", "Ժամանակահատված")}
              >
                <option value="7">{tx(t, "admin.dashboard.last_7d", "Վերջին 7 օր")}</option>
                <option value="30">{tx(t, "admin.dashboard.last_30d", "Վերջին 30 օր")}</option>
                <option value="90">{tx(t, "admin.dashboard.last_90d", "Վերջին 90 օր")}</option>
                <option value="365">{tx(t, "admin.dash2.last_12m", "Վերջին 12 ամիս")}</option>
              </select>
            ) : null}
            {activeTab === "overview" ? (
              <V2Button
                variant="primary"
                onClick={handleExportDashboardCsv}
                icon={
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                }
              >
                {tx(t, "admin.dashboard.export", "Արտահանել")}
              </V2Button>
            ) : null}
          </>
        }
      />

      {/* ── section-tabs strip (mockup #dash-tabs). Button-driven (panes are
          state, not routes). Style matches the v2 .section-tabs underline. ── */}
      <div
        className="mb-5 flex flex-wrap gap-1 overflow-x-auto border-b"
        style={{ borderColor: "var(--admin-border)" }}
        role="tablist"
        aria-label={t("admin.dashboard.title")}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className="-mb-px inline-flex h-[40px] items-center gap-1.5 whitespace-nowrap border-b-2 px-[14px] text-[13px] font-medium transition"
              style={{
                color: isActive ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                borderBottomColor: isActive ? "var(--admin-primary)" : "transparent",
              }}
            >
              <TabIcon className="size-4" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── active pane ── */}
      {activeTab === "overview" && token ? <OverviewPane token={token} days={rangeDays} /> : null}

      {activeTab === "platform-stats" && token ? <PlatformStatsPane token={token} days={rangeDays} /> : null}
      {activeTab === "operator-stats" && token ? <OperatorStatsPane token={token} /> : null}
      {activeTab === "agent" && token ? <AgentPane token={token} /> : null}

      {exportToast ? (
        <div
          className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-md px-4 py-2.5 text-[13px] font-medium text-white shadow-lg"
          style={{ backgroundColor: "var(--admin-text-primary)" }}
          role="status"
        >
          {exportToast}
        </div>
      ) : null}
    </div>
  );
}
