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
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import { apiPlatformStats, type PlatformStats } from "@/lib/platform-admin-api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { formatNumber } from "@/lib/format";
import { PageHeader, Table, THead, TBody, TR, TH, TD, Badge, type BadgeTone } from "@/components/ui";
import Link from "next/link";
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

function formatValue(n: number | undefined | null, lang: string = "en"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return formatNumber(n, lang);
}

/**
 * Translation helper — returns translated string, or fallback when the key
 * isn't in the bundle (t() returns the key itself in that case). Used for
 * Phase 1 visual refresh strings that haven't been seeded into ui_translations
 * yet so the dashboard renders English headers instead of raw keys.
 */
function tx(t: (k: string) => string, key: string, fallback: string): string {
  const r = t(key);
  return r === key ? fallback : r;
}

/* ─── small building blocks ─────────────────────────────────────────── */

/**
 * HeroStatCard — Phase 1 visual refresh (2026-05-23).
 *
 * Two render modes:
 *   - `tone` set ("primary" | "success" | "warning") → solid colored card
 *     matching ZuluSpin handoff mockup (white text on full brand fill).
 *     Used for the 3 hero metrics on the dashboard.
 *   - `tone` omitted → original white-bg card with soft icon chip. Kept
 *     for backwards-compat in case any callers add new stat cards later
 *     without the colored treatment.
 *
 * Responsive: padding scales p-5 → p-6 across the `sm:` breakpoint so
 * mobile (≤600px) gets tighter cards.
 */
function HeroStatCard({
  label,
  value,
  icon: Icon,
  trend,
  subRow,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Briefcase;
  trend?: { sign: "up" | "down" | "flat"; pct: string };
  subRow?: { left: { label: string; value: string }; right: { label: string; value: string } };
  tone?: "primary" | "success" | "warning";
}) {
  if (tone) {
    // ── Solid-colored variant (mockup `.stat-card.purple|green|amber|coral`) ──
    const bgClass = {
      primary: "bg-primary-600",
      success: "bg-success-900",
      warning: "bg-warning-700",
    }[tone];
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
              <TrendingUp className="size-3" aria-hidden />
              {trend.pct}
            </span>
          ) : null}
        </div>
        <div className="mt-4 text-3xl font-semibold tabular-nums sm:text-[28px]">{value}</div>
        <div className="mt-0.5 text-xs text-white/85">{label}</div>
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

  // ── Original white-bg variant (no tone — backwards compat) ──
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

/**
 * WidgetCard — Phase 1 visual refresh (2026-05-23).
 *
 * Card chrome now matches the ZuluSpin handoff mockup pattern:
 *   ┌─────────────────────────────────────────────┐
 *   │ [icon] Title          subtitle?     action? │  ← header (bg-figma-bg-1, separator below)
 *   ├─────────────────────────────────────────────┤
 *   │ body content                                │  ← body (p-5)
 *   └─────────────────────────────────────────────┘
 *
 * Optional props:
 *   - `subtitle` — small caption under the title
 *   - `bodyClassName` — override default body padding (set to "p-0" when
 *     embedding a component that brings its own border, e.g. <Table>).
 */
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
  const { t, lang } = useLanguage();
  const total = stats.bookings_total ?? 0;
  const paid = stats.package_orders_paid ?? 0;
  const pending = stats.package_orders_pending_payment ?? 0;
  const packageTotal = stats.package_orders_total ?? 0;

  // Approximate breakdown — when richer API exists, swap to real per-status counts.
  const rows = [
    { label: t("admin.dashboard.bookings_legacy"), value: total, color: "#3B82F6", pct: total === 0 ? 0 : 100 },
    { label: t("admin.dashboard.package_orders_pending"), value: pending, color: "#F59E0B", pct: packageTotal === 0 ? 0 : (pending / packageTotal) * 100 },
    { label: t("admin.dashboard.package_orders_paid"), value: paid, color: "#10B981", pct: packageTotal === 0 ? 0 : (paid / packageTotal) * 100 },
  ];

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <ProgressRow key={r.label} label={r.label} value={formatValue(r.value, lang)} pct={r.pct} color={r.color} />
      ))}
    </div>
  );
}

function MonthlyEarnings() {
  const { t } = useLanguage();
  // Placeholder until invoices/finance roll-up endpoint exists.
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs text-fg-t6">{t("admin.dashboard.this_month")}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-fg-t11">$0</p>
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success-700">
          <TrendingUp className="size-3" aria-hidden />
          —
          <span className="text-fg-t6">{t("admin.dashboard.vs_previous")}</span>
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-1 rounded-full border border-default px-3 py-1.5 text-xs font-medium text-fg-t11 hover:bg-figma-bg-1"
        >
          {t("admin.dashboard.view_more")}
          <ArrowRight className="size-3" aria-hidden />
        </button>
      </div>
      <DonutGoal pct={0} label={t("admin.dashboard.goal")} />
    </div>
  );
}

function ApprovalsProgress({ stats }: { stats: PlatformStats }) {
  const { t, lang } = useLanguage();
  // Backed by /api/platform-admin/approvals counters in a follow-up.
  // For now, render the layout with an empty-state row.
  const total = (stats.companies_active ?? 0) + (stats.companies_suspended ?? 0);
  const rows = [
    { label: t("admin.dashboard.active_companies"), value: stats.companies_active ?? 0, color: "#10B981", pct: total === 0 ? 0 : ((stats.companies_active ?? 0) / total) * 100 },
    { label: t("admin.dashboard.suspended"), value: stats.companies_suspended ?? 0, color: "#F59E0B", pct: total === 0 ? 0 : ((stats.companies_suspended ?? 0) / total) * 100 },
    { label: t("admin.dashboard.sellers_operators"), value: stats.companies_sellers ?? 0, color: "var(--admin-primary)", pct: total === 0 ? 0 : ((stats.companies_sellers ?? 0) / total) * 100 },
  ];
  return (
    <>
      <div className="mb-5 flex flex-col items-center">
        <span className="text-3xl font-semibold tabular-nums text-fg-t11">{formatValue(total, lang)}</span>
        <span className="text-xs text-fg-t6">{t("admin.dashboard.total_companies")}</span>
      </div>
      <div className="space-y-3.5">
        {rows.map((r) => (
          <ProgressRow key={r.label} label={r.label} value={formatValue(r.value, lang)} pct={r.pct} color={r.color} />
        ))}
      </div>
    </>
  );
}

function OrderSummaryDonut({ stats }: { stats: PlatformStats }) {
  const { t, lang } = useLanguage();
  const paid = stats.package_orders_paid ?? 0;
  const pending = stats.package_orders_pending_payment ?? 0;
  const total = stats.package_orders_total ?? 0;
  const other = Math.max(0, total - paid - pending);

  const segments = [
    { label: t("admin.dashboard.paid"), value: paid, color: "#10B981" },
    { label: t("admin.dashboard.pending_payment"), value: pending, color: "#F59E0B" },
    { label: t("admin.dashboard.other_draft"), value: other, color: "#94A3B8" },
  ];
  const totalLabel = formatValue(total, lang);
  return (
    <div className="flex flex-col items-center gap-5 md:flex-row md:items-center md:justify-around">
      <MultiDonut segments={segments} centerLabel={t("admin.dashboard.orders")} centerValue={totalLabel} />
      <ul className="space-y-2 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="text-fg-t7">{s.label}</span>
            <span className="ml-auto tabular-nums text-fg-t11">{formatValue(s.value, lang)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type AuditLogRow = {
  id: string;
  category: string;
  actor_name_snapshot: string | null;
  subject_type: string | null;
  subject_id: string | null;
  action: string;
  created_at: string;
};

/** Friendly relative-time formatter — "5 mins ago", "2 hours ago", "3 days ago". */
function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min > 1 ? "s" : ""} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? "s" : ""} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day > 1 ? "s" : ""} ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} month${month > 1 ? "s" : ""} ago`;
  return `${Math.floor(month / 12)} year${Math.floor(month / 12) > 1 ? "s" : ""} ago`;
}

/** Map an audit-log category to a Badge tone for the activity table. */
function categoryTone(cat: string): BadgeTone {
  switch (cat) {
    case "auth":
    case "data_change":
      return "info";
    case "approval":
    case "admin_actions":
      return "primary";
    case "financial":
      return "success";
    case "security":
      return "danger";
    default:
      return "gray";
  }
}

/** Initials for the actor avatar — first letter of first two name parts. */
function actorInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const second = parts[1];
  return `${first[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase() || first.slice(0, 2).toUpperCase();
}

function RecentActivity({ token, allowed }: { token: string | null; allowed: boolean }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<AuditLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed || !token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetchJson<{ success: boolean; data: AuditLogRow[] }>(
          "/platform-admin/audit-logs?per_page=5",
          { token }
        );
        if (!cancelled) setRows((res.data ?? []).slice(0, 5));
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 404) {
          setRows([]);
        } else {
          setError(e instanceof Error ? e.message : "load failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, allowed]);

  // ── Loading skeleton — table rows ──
  if (rows === null && !error) {
    return (
      <Table>
        <THead>
          <TR>
            <TH>{tx(t, "admin.dashboard.activity_col_user", "User")}</TH>
            <TH>{tx(t, "admin.dashboard.activity_col_action", "Action")}</TH>
            <TH>{tx(t, "admin.dashboard.activity_col_resource", "Resource")}</TH>
            <TH>{tx(t, "admin.dashboard.activity_col_time", "Time")}</TH>
            <TH align="right">{tx(t, "admin.dashboard.activity_col_status", "Status")}</TH>
          </TR>
        </THead>
        <TBody>
          {[1, 2, 3, 4].map((i) => (
            <TR key={i}>
              <TD>
                <div className="flex items-center gap-2.5">
                  <span className="size-8 shrink-0 animate-pulse rounded-full bg-slate-100" aria-hidden />
                  <div className="space-y-1.5">
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-100" aria-hidden />
                    <div className="h-2.5 w-32 animate-pulse rounded bg-slate-100" aria-hidden />
                  </div>
                </div>
              </TD>
              <TD>
                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" aria-hidden />
              </TD>
              <TD>
                <div className="h-3 w-28 animate-pulse rounded bg-slate-100" aria-hidden />
              </TD>
              <TD>
                <div className="h-3 w-16 animate-pulse rounded bg-slate-100" aria-hidden />
              </TD>
              <TD align="right">
                <div className="ml-auto h-4 w-14 animate-pulse rounded bg-slate-100" aria-hidden />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-error-600">
        {t("admin.dashboard.activity_load_failed") === "admin.dashboard.activity_load_failed"
          ? "Couldn't load activity feed."
          : t("admin.dashboard.activity_load_failed")}
      </p>
    );
  }

  if (rows && rows.length === 0) {
    return (
      <p className="py-2 text-sm text-fg-t6">
        {t("admin.dashboard.activity_empty") === "admin.dashboard.activity_empty"
          ? "No activity yet."
          : t("admin.dashboard.activity_empty")}
      </p>
    );
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>{tx(t, "admin.dashboard.activity_col_user", "User")}</TH>
          <TH>{tx(t, "admin.dashboard.activity_col_action", "Action")}</TH>
          <TH>{tx(t, "admin.dashboard.activity_col_resource", "Resource")}</TH>
          <TH>{tx(t, "admin.dashboard.activity_col_time", "Time")}</TH>
          <TH align="right">{tx(t, "admin.dashboard.activity_col_status", "Status")}</TH>
        </TR>
      </THead>
      <TBody>
        {rows!.map((row) => {
          const tone = categoryTone(row.category);
          const subject = row.subject_type
            ? `${row.subject_type}${row.subject_id ? ` #${row.subject_id}` : ""}`
            : "—";
          return (
            <TR key={row.id}>
              <TD>
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-900"
                    aria-hidden
                  >
                    {actorInitials(row.actor_name_snapshot)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg-t11">
                      {row.actor_name_snapshot || "system"}
                    </p>
                    <p className="truncate text-xs capitalize text-fg-t6">
                      {row.category.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              </TD>
              <TD className="text-fg-t7">{row.action.replace(/_/g, " ")}</TD>
              <TD className="text-fg-t7">{subject}</TD>
              <TD className="text-fg-t6">{timeAgo(row.created_at)}</TD>
              <TD align="right">
                <Badge tone={tone}>{row.category.replace(/_/g, " ")}</Badge>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

function TopOperatorsByRevenue() {
  const { t } = useLanguage();
  // Placeholder — needs aggregate revenue-per-company endpoint.
  return (
    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-default bg-figma-bg-1">
      <div className="text-center">
        <PieChart className="mx-auto size-8 text-fg-t6" aria-hidden />
        <p className="mt-2 text-sm font-medium text-fg-t11">{t("admin.dashboard.revenue_chart_pending")}</p>
        <p className="mt-1 text-xs text-fg-t6 max-w-xs px-4">
          {t("admin.dashboard.top_operators_chart_hint")}
        </p>
      </div>
    </div>
  );
}

function ActiveOffers({ stats }: { stats: PlatformStats }) {
  const { t, lang } = useLanguage();
  const published = stats.offers_published ?? 0;
  const total = stats.offers_total ?? 0;
  const draft = Math.max(0, total - published);
  return (
    <>
      <div className="mb-5 flex flex-col items-center">
        <span className="text-3xl font-semibold tabular-nums text-fg-t11">{formatValue(total, lang)}</span>
        <span className="text-xs text-fg-t6">{t("admin.dashboard.total_offers")}</span>
      </div>
      <div className="space-y-3.5">
        <ProgressRow
          label={t("admin.dashboard.published")}
          value={formatValue(published, lang)}
          pct={total === 0 ? 0 : (published / total) * 100}
          color="#10B981"
        />
        <ProgressRow
          label={t("admin.dashboard.draft_archived")}
          value={formatValue(draft, lang)}
          pct={total === 0 ? 0 : (draft / total) * 100}
          color="#94A3B8"
        />
      </div>
    </>
  );
}

/* ─── page shell ───────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { t, lang } = useLanguage();
  useDocumentTitle(t("admin.dashboard.title"));
  const { token, user } = useAdminAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const allowed = canAccessPlatformAdminNav(user);

  useEffect(() => {
    if (!allowed || !token) return;
    let cancelled = false;
    void (async () => {
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
        <PageHeader title={greeting} subtitle={t("admin.dashboard.loading_stats")} />
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-default bg-white p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-9 animate-pulse rounded-lg bg-slate-100" />
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
      <PageHeader title={greeting} subtitle={t("admin.dashboard.platform_overview")} />

      {/* Row 1 — three hero stat cards (Phase 1 visual refresh: solid colors per mockup).
          Grid: 1 col on mobile (default), 2 cols on tablet (sm: 600px+), 3 cols on desktop (lg: 1280px+). */}
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        <HeroStatCard
          tone="primary"
          label={t("admin.dashboard.total_bookings")}
          value={formatValue((stats.bookings_total ?? 0) + (stats.package_orders_total ?? 0), lang)}
          icon={Briefcase}
          subRow={{
            left: { label: t("admin.dashboard.bookings_legacy"), value: formatValue(stats.bookings_total, lang) },
            right: { label: t("admin.dashboard.package_orders"), value: formatValue(stats.package_orders_total, lang) },
          }}
        />
        <HeroStatCard
          tone="success"
          label={t("admin.dashboard.total_operators")}
          value={formatValue(stats.companies_total, lang)}
          icon={Building2}
          subRow={{
            left: { label: t("admin.dashboard.active"), value: formatValue(stats.companies_active, lang) },
            right: { label: t("admin.dashboard.sellers"), value: formatValue(stats.companies_sellers, lang) },
          }}
        />
        <HeroStatCard
          tone="warning"
          label={t("admin.dashboard.daily_revenue")}
          value="$0"
          icon={DollarSign}
          subRow={{
            left: { label: t("admin.dashboard.vs_yesterday"), value: "—" },
            right: { label: t("admin.dashboard.monthly_avg"), value: "—" },
          }}
        />
      </div>

      {/* Row 2 — three widgets. Mobile 1col → tablet 2col → desktop 3col. */}
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        <WidgetCard title={t("admin.dashboard.booking_overview")} icon={Layers}>
          <BookingOverview stats={stats} />
        </WidgetCard>
        <WidgetCard title={t("admin.dashboard.monthly_earnings")} icon={DollarSign}>
          <MonthlyEarnings />
        </WidgetCard>
        <WidgetCard title={t("admin.dashboard.companies_on_platform")} icon={CheckCircle2}>
          <ApprovalsProgress stats={stats} />
        </WidgetCard>
      </div>

      {/* Row 3 — order summary (1col) + recent activity (2col on desktop).
          On tablet, donut sits beside activity (1+1 split). On mobile, stacked.
          `min-w-0` on grid items lets a child <Table> with min-w-[640px]
          trigger its own overflow-x-auto INSIDE the widget instead of
          forcing the whole page to scroll horizontally (CSS Grid items
          default to min-width: auto which is content-size). */}
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        <div className="min-w-0">
          <WidgetCard title={t("admin.dashboard.order_summary")} icon={PieChart}>
            <OrderSummaryDonut stats={stats} />
          </WidgetCard>
        </div>
        <div className="min-w-0 lg:col-span-2">
          <WidgetCard
            title={t("admin.dashboard.recent_activity")}
            icon={Activity}
            bodyClassName="p-0"
            action={
              <Link
                href="/platform/audit-logs"
                className="inline-flex items-center gap-0.5 text-xs font-medium text-primary-600 hover:text-primary-800"
              >
                {t("admin.dashboard.view_all")}
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          >
            <RecentActivity token={token} allowed={allowed} />
          </WidgetCard>
        </div>
      </div>

      {/* Row 4 — top operators (2col on desktop) + active offers (1col).
          Tablet shows 1+1; mobile stacks. */}
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <WidgetCard
            title={t("admin.dashboard.top_operators_by_revenue")}
            icon={ArrowUpRight}
            action={<span className="text-xs text-fg-t6">{t("admin.dashboard.total_revenue_placeholder")}</span>}
          >
            <TopOperatorsByRevenue />
          </WidgetCard>
        </div>
        <div className="min-w-0">
          <WidgetCard title={t("admin.dashboard.active_offers")} icon={Layers}>
            <ActiveOffers stats={stats} />
          </WidgetCard>
        </div>
      </div>
    </div>
  );
}
