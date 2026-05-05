"use client";

/**
 * Admin dashboard — layout adapted from Quest CRM Copy template
 * (Figma frame 9350:15768, Dashboard 1920) but mapped to ZULU's travel
 * domain. ZULU brand tokens (purple primary, Inter typography) are used
 * throughout, only the structural pattern is borrowed.
 *
 * Layout:
 *   Row 1: 3 hero stat cards (Bookings / Operators / Revenue)
 *   Row 2: 3 widgets (Booking overview / Monthly earnings / Approvals progress)
 *   Row 3: 2 widgets (Order summary donut / Recent activity)
 *   Row 4: 2 widgets (Top operators by revenue / Active offers)
 *
 * Cells that don't yet have a real API hooked up render a graceful
 * empty state with "—" — they'll light up when the matching backend
 * endpoint is wired in a follow-up sprint. The layout itself is
 * production-ready.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiPlatformStats, type PlatformStats } from "@/lib/platform-admin-api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  DollarSign,
  TrendingUp,
  Activity,
  ArrowUpRight,
  PieChart,
  ArrowRight,
  Layers,
  CheckCircle2,
} from "lucide-react";

function formatValue(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat().format(n);
}

/* ─── small building blocks ─────────────────────────────────────────── */

function HeroStatCard({
  label,
  value,
  icon: Icon,
  trend,
  subRow,
}: {
  label: string;
  value: string;
  icon: typeof Briefcase;
  trend?: { sign: "up" | "down" | "flat"; pct: string };
  subRow?: { left: { label: string; value: string }; right: { label: string; value: string } };
}) {
  const trendColor =
    trend?.sign === "up" ? "text-success-700" : trend?.sign === "down" ? "text-error-600" : "text-fg-t6";
  return (
    <div className="rounded-2xl border border-default bg-white p-6 shadow-zulu-card">
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

function WidgetCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: typeof PieChart;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-default bg-white p-6 shadow-zulu-card">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex size-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--admin-primary-soft)", color: "var(--admin-primary)" }}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <h3 className="text-sm font-semibold text-fg-t11">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Horizontal progress bar row used inside Booking overview / Approvals progress. */
function ProgressRow({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: string | number;
  pct: number;
  color: string;
}) {
  const safePct = Math.max(0, Math.min(100, pct));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-fg-t7">
          <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          <span className="font-medium">{value}</span>
          <span className="text-fg-t6">{label}</span>
        </div>
        <span className="tabular-nums text-fg-t7">{safePct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-figma-bg-1">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${safePct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/** Donut chart for Monthly earnings goal. Pure SVG, no chart lib. */
function DonutGoal({ pct, label }: { pct: number; label: string }) {
  const safe = Math.max(0, Math.min(100, pct));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safe / 100);
  return (
    <div className="relative flex size-32 items-center justify-center">
      <svg viewBox="0 0 120 120" className="size-32 -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--admin-primary-soft)" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--admin-primary)"
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-semibold tabular-nums text-fg-t11">{safe.toFixed(0)}%</span>
        <span className="text-[10px] uppercase tracking-wide text-fg-t6">{label}</span>
      </div>
    </div>
  );
}

/** Donut summary used for Order summary card — multi-segment. */
function MultiDonut({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;
  return (
    <div className="relative flex size-36 items-center justify-center">
      <svg viewBox="0 0 120 120" className="size-36 -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--admin-primary-soft)" strokeWidth="12" />
        {segments.map((s) => {
          const fraction = s.value / total;
          const segLen = circumference * fraction;
          const dashArray = `${segLen} ${circumference - segLen}`;
          const dashOffset = -circumference * cumulative;
          cumulative += fraction;
          return (
            <circle
              key={s.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth="12"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-semibold tabular-nums text-fg-t11">{centerValue}</span>
        <span className="text-[10px] uppercase tracking-wide text-fg-t6">{centerLabel}</span>
      </div>
    </div>
  );
}

/* ─── widget bodies ────────────────────────────────────────────────── */

function BookingOverview({ stats }: { stats: PlatformStats }) {
  const total = stats.bookings_total ?? 0;
  const paid = stats.package_orders_paid ?? 0;
  const pending = stats.package_orders_pending_payment ?? 0;
  const packageTotal = stats.package_orders_total ?? 0;

  // Approximate breakdown — when richer API exists, swap to real per-status counts.
  const rows = [
    { label: "Bookings (legacy)", value: total, color: "#3B82F6", pct: total === 0 ? 0 : 100 },
    { label: "Package orders pending", value: pending, color: "#F59E0B", pct: packageTotal === 0 ? 0 : (pending / packageTotal) * 100 },
    { label: "Package orders paid", value: paid, color: "#10B981", pct: packageTotal === 0 ? 0 : (paid / packageTotal) * 100 },
  ];

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <ProgressRow key={r.label} label={r.label} value={formatValue(r.value)} pct={r.pct} color={r.color} />
      ))}
    </div>
  );
}

function MonthlyEarnings() {
  // Placeholder until invoices/finance roll-up endpoint exists.
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs text-fg-t6">This month</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-fg-t11">$0</p>
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success-700">
          <TrendingUp className="size-3" aria-hidden />
          —
          <span className="text-fg-t6">vs previous</span>
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-1 rounded-full border border-default px-3 py-1.5 text-xs font-medium text-fg-t11 hover:bg-figma-bg-1"
        >
          View more
          <ArrowRight className="size-3" aria-hidden />
        </button>
      </div>
      <DonutGoal pct={0} label="Goal" />
    </div>
  );
}

function ApprovalsProgress({ stats }: { stats: PlatformStats }) {
  // Backed by /api/platform-admin/approvals counters in a follow-up.
  // For now, render the layout with an empty-state row.
  const total = (stats.companies_active ?? 0) + (stats.companies_suspended ?? 0);
  const rows = [
    { label: "Active companies", value: stats.companies_active ?? 0, color: "#10B981", pct: total === 0 ? 0 : ((stats.companies_active ?? 0) / total) * 100 },
    { label: "Suspended", value: stats.companies_suspended ?? 0, color: "#F59E0B", pct: total === 0 ? 0 : ((stats.companies_suspended ?? 0) / total) * 100 },
    { label: "Sellers (operators)", value: stats.companies_sellers ?? 0, color: "var(--admin-primary)", pct: total === 0 ? 0 : ((stats.companies_sellers ?? 0) / total) * 100 },
  ];
  return (
    <>
      <div className="mb-5 flex flex-col items-center">
        <span className="text-3xl font-semibold tabular-nums text-fg-t11">{formatValue(total)}</span>
        <span className="text-xs text-fg-t6">Total companies</span>
      </div>
      <div className="space-y-3.5">
        {rows.map((r) => (
          <ProgressRow key={r.label} label={r.label} value={formatValue(r.value)} pct={r.pct} color={r.color} />
        ))}
      </div>
    </>
  );
}

function OrderSummaryDonut({ stats }: { stats: PlatformStats }) {
  const paid = stats.package_orders_paid ?? 0;
  const pending = stats.package_orders_pending_payment ?? 0;
  const total = stats.package_orders_total ?? 0;
  const other = Math.max(0, total - paid - pending);

  const segments = [
    { label: "Paid", value: paid, color: "#10B981" },
    { label: "Pending payment", value: pending, color: "#F59E0B" },
    { label: "Other / draft", value: other, color: "#94A3B8" },
  ];
  const totalLabel = formatValue(total);
  return (
    <div className="flex flex-col items-center gap-5 md:flex-row md:items-center md:justify-around">
      <MultiDonut segments={segments} centerLabel="Orders" centerValue={totalLabel} />
      <ul className="space-y-2 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="text-fg-t7">{s.label}</span>
            <span className="ml-auto tabular-nums text-fg-t11">{formatValue(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecentActivity() {
  // Placeholder — wire to /api/platform-admin/audit-logs?limit=5 in a follow-up.
  return (
    <ul className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <li key={i} className="flex items-start gap-3 border-b border-default pb-3 last:border-b-0 last:pb-0">
          <span className="mt-1 size-2 shrink-0 rounded-full bg-fg-t6" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-fg-t6">— ago</p>
            <p className="mt-0.5 text-sm font-medium text-fg-t11">Activity feed pending</p>
            <p className="mt-0.5 text-xs text-fg-t6">
              Wire to <code className="font-mono">/api/platform-admin/audit-logs</code>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TopOperatorsByRevenue() {
  // Placeholder — needs aggregate revenue-per-company endpoint.
  return (
    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-default bg-figma-bg-1">
      <div className="text-center">
        <PieChart className="mx-auto size-8 text-fg-t6" aria-hidden />
        <p className="mt-2 text-sm font-medium text-fg-t11">Revenue chart pending</p>
        <p className="mt-1 text-xs text-fg-t6 max-w-xs px-4">
          Top operators by revenue line chart — needs aggregate endpoint
        </p>
      </div>
    </div>
  );
}

function ActiveOffers({ stats }: { stats: PlatformStats }) {
  const published = stats.offers_published ?? 0;
  const total = stats.offers_total ?? 0;
  const draft = Math.max(0, total - published);
  return (
    <>
      <div className="mb-5 flex flex-col items-center">
        <span className="text-3xl font-semibold tabular-nums text-fg-t11">{formatValue(total)}</span>
        <span className="text-xs text-fg-t6">Total offers</span>
      </div>
      <div className="space-y-3.5">
        <ProgressRow
          label="Published"
          value={formatValue(published)}
          pct={total === 0 ? 0 : (published / total) * 100}
          color="#10B981"
        />
        <ProgressRow
          label="Draft / archived"
          value={formatValue(draft)}
          pct={total === 0 ? 0 : (draft / total) * 100}
          color="#94A3B8"
        />
      </div>
    </>
  );
}

/* ─── page shell ───────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { t } = useLanguage();
  const { token, user } = useAdminAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const allowed = canAccessPlatformAdminNav(user);

  useEffect(() => {
    if (!allowed || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiPlatformStats(token);
        if (!cancelled) setStats(res.data);
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiRequestError && e.status === 403) {
            setErr("forbidden");
          } else {
            setErr(
              e instanceof ApiRequestError
                ? e.message
                : e instanceof Error
                  ? e.message
                  : t("admin.dashboard.load_failed")
            );
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, token, t]);

  const greeting = user?.name ? `${t("admin.dashboard.title")} — ${user.name}` : t("admin.dashboard.title");

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

  if (err === "forbidden") {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.dashboard.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-3">
        <h1 className="admin-page-title">{t("admin.dashboard.title")}</h1>
        <p className="text-sm text-error-600">{err}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="admin-page-title">{greeting}</h1>
          <p className="mt-1 text-sm text-fg-t6">{t("admin.dashboard.loading_stats")}</p>
        </header>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-default bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="mt-4 h-8 w-24 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="admin-page-title">{greeting}</h1>
        <p className="mt-1 text-sm text-fg-t6">{t("admin.dashboard.platform_overview")}</p>
      </header>

      {/* Row 1 — three hero stat cards */}
      <div className="grid gap-5 lg:grid-cols-3">
        <HeroStatCard
          label="Total bookings"
          value={formatValue((stats.bookings_total ?? 0) + (stats.package_orders_total ?? 0))}
          icon={Briefcase}
          subRow={{
            left: { label: "Bookings (legacy)", value: formatValue(stats.bookings_total) },
            right: { label: "Package orders", value: formatValue(stats.package_orders_total) },
          }}
        />
        <HeroStatCard
          label="Total operators"
          value={formatValue(stats.companies_total)}
          icon={Building2}
          subRow={{
            left: { label: "Active", value: formatValue(stats.companies_active) },
            right: { label: "Sellers", value: formatValue(stats.companies_sellers) },
          }}
        />
        <HeroStatCard
          label="Daily revenue"
          value="$0"
          icon={DollarSign}
          subRow={{
            left: { label: "vs Yesterday", value: "—" },
            right: { label: "Monthly avg", value: "—" },
          }}
        />
      </div>

      {/* Row 2 — three widgets */}
      <div className="grid gap-5 lg:grid-cols-3">
        <WidgetCard title="Booking overview" icon={Layers}>
          <BookingOverview stats={stats} />
        </WidgetCard>
        <WidgetCard title="Monthly earnings" icon={DollarSign}>
          <MonthlyEarnings />
        </WidgetCard>
        <WidgetCard title="Companies on platform" icon={CheckCircle2}>
          <ApprovalsProgress stats={stats} />
        </WidgetCard>
      </div>

      {/* Row 3 — order summary + recent activity */}
      <div className="grid gap-5 lg:grid-cols-3">
        <WidgetCard title="Order summary" icon={PieChart}>
          <OrderSummaryDonut stats={stats} />
        </WidgetCard>
        <div className="lg:col-span-2">
          <WidgetCard
            title="Recent activity"
            icon={Activity}
            action={
              <button type="button" className="text-xs font-medium text-primary-500 hover:text-primary-700">
                View all
              </button>
            }
          >
            <RecentActivity />
          </WidgetCard>
        </div>
      </div>

      {/* Row 4 — top operators + active offers */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WidgetCard
            title="Top operators by revenue"
            icon={ArrowUpRight}
            action={<span className="text-xs text-fg-t6">Total revenue —</span>}
          >
            <TopOperatorsByRevenue />
          </WidgetCard>
        </div>
        <WidgetCard title="Active offers" icon={Layers}>
          <ActiveOffers stats={stats} />
        </WidgetCard>
      </div>
    </div>
  );
}
