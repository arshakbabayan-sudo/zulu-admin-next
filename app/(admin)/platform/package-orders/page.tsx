"use client";

/**
 * v2 admin-redesign — Package orders page (Bookings group).
 *
 * Source spec: docs/admin_designe/Bookings/bookings_mocks.html (PAGE 2)
 * Migration prompt: docs/admin_designe/Bookings/bookings_implementation_prompt.md §3.B
 *
 * Chrome:
 *   - V2PageHeader with breadcrumb + Export action
 *   - BookingsSectionTabs (shared with /platform/bookings)
 *   - 4 stat cards from /platform-admin/package-orders/stats (30d)
 *   - FilterCard (Order status / Payment status / Company / Search)
 *   - Active filter chips with per-chip dismissal
 *   - V2Card wrapping table with DUAL status columns (Order + Payment)
 *   - Retry IconButton on failed-payment rows
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessBookingsSection } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiPlatformPackageOrders, type PlatformPackageOrderRow } from "@/lib/platform-admin-api";
import { apiPackageOrdersStats, type PackageOrdersStats } from "@/lib/bookings-stats-api";
import { formatMoney } from "@/lib/format";
import {
  STATUS_BADGE_CLASS,
  avatarInitials,
  avatarStyle,
  formatRelativeTime,
  pickAvatarTone,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  CircleCheck,
  Clock,
  DollarSign,
  Download,
  Eye,
  MoreVertical,
  Package,
  Loader2 as LoaderIcon,
  RefreshCw,
  RotateCcw as RotateIcon,
  XIcon,
  XCircle,
  X as XSimple,
} from "lucide-react";
import { Pagination } from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  StatCard,
  StatGrid,
  IconButton,
  V2Drawer,
  V2DrawerSection,
  V2DrawerInfoRow,
} from "@/components/ui/v2";
import { BookingsSectionTabs } from "@/components/bookings/BookingsSectionTabs";

/**
 * Local i18n shim — returns `fallback` when the server translation row for
 * `key` hasn't been seeded yet (translateKey echoes the key on a miss).
 * Mirrors the pattern used on the bookings detail page so drawer labels are
 * still i18n-overridable but never render a raw dotted key.
 */
function tx(t: (k: string) => string, key: string, fallback: string): string {
  const v = t(key);
  return v === key ? fallback : v;
}

const ORDER_STATUSES = [
  "",
  "pending",
  "pending_payment",
  "confirmed",
  "partially_confirmed",
  "in_progress",
  "completed",
  "fulfilled",
  "cancelled",
  "failed",
] as const;

const PAYMENT_STATUSES = [
  "",
  "paid",
  "captured",
  "pending",
  "authorized",
  "partial",
  "failed",
  "refunded",
  "voided",
] as const;

type StatusMeta = { tone: StatusTone; label: string; icon: React.ReactNode };

const ORDER_STATUS_META: Record<string, StatusMeta> = {
  pending: { tone: "warning", label: "Pending", icon: <Clock className="h-3 w-3" /> },
  pending_payment: { tone: "warning", label: "Pending payment", icon: <Clock className="h-3 w-3" /> },
  confirmed: { tone: "success", label: "Confirmed", icon: <Check className="h-3 w-3" /> },
  partially_confirmed: { tone: "warning", label: "Partial", icon: <Clock className="h-3 w-3" /> },
  in_progress: { tone: "info", label: "In progress", icon: <LoaderIcon className="h-3 w-3" /> },
  completed: { tone: "info", label: "Completed", icon: <CheckCheck className="h-3 w-3" /> },
  fulfilled: { tone: "success", label: "Fulfilled", icon: <CheckCheck className="h-3 w-3" /> },
  cancelled: { tone: "danger", label: "Cancelled", icon: <XSimple className="h-3 w-3" /> },
  failed: { tone: "danger", label: "Failed", icon: <XSimple className="h-3 w-3" /> },
};

const PAYMENT_STATUS_META: Record<string, StatusMeta> = {
  paid: { tone: "success", label: "Paid", icon: <Check className="h-3 w-3" /> },
  captured: { tone: "success", label: "Captured", icon: <Check className="h-3 w-3" /> },
  pending: { tone: "warning", label: "Pending", icon: <Clock className="h-3 w-3" /> },
  authorized: { tone: "warning", label: "Authorized", icon: <Clock className="h-3 w-3" /> },
  partial: { tone: "info", label: "Partial", icon: <LoaderIcon className="h-3 w-3" /> },
  failed: { tone: "danger", label: "Failed", icon: <XSimple className="h-3 w-3" /> },
  refunded: { tone: "gray", label: "Refunded", icon: <RotateIcon className="h-3 w-3" /> },
  voided: { tone: "gray", label: "Voided", icon: <XSimple className="h-3 w-3" /> },
};

/**
 * Client-side CSV export for the currently-loaded package orders rows.
 * Phase 1 — exports current page only. Future server-side endpoint can stream
 * the full dataset; this keeps the «Export» button functional today.
 */
function exportPackageOrdersCsv(rows: PlatformPackageOrderRow[]): void {
  if (rows.length === 0) return;
  const headers = [
    "id",
    "order_number",
    "status",
    "payment_status",
    "currency",
    "final_total",
    "package_title",
    "package_type",
    "destination",
    "buyer_name",
    "buyer_email",
    "company",
    "created_at",
  ];
  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.order_number,
        r.status,
        r.payment_status,
        r.currency,
        r.final_total_snapshot,
        r.package?.package_title ?? "",
        r.package?.package_type ?? "",
        [r.package?.destination_city, r.package?.destination_country].filter(Boolean).join(", "),
        r.user?.name ?? "",
        r.user?.email ?? "",
        r.company?.name ?? "",
        r.created_at ?? "",
      ]
        .map(escape)
        .join(","),
    );
  }
  const csv = lines.join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  link.href = url;
  link.download = `package-orders-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function labelStatus(meta: Record<string, StatusMeta>, s: string): string {
  return meta[s]?.label ?? s.replace(/_/g, " ");
}

export default function PlatformPackageOrdersPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  // Phase 6 frontend gate: package-orders list + stats are tenant-scoped.
  const allowed = canAccessBookingsSection(user);
  const [rows, setRows] = useState<PlatformPackageOrderRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [companyIdDraft, setCompanyIdDraft] = useState("");
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PackageOrdersStats | null>(null);
  // Detail drawer. No GET /package-orders/{id} endpoint exists, so the "View"
  // action opens a drawer populated from the already-loaded list row instead of
  // navigating to a non-existent /[id] route (which 404'd). See TODO(backend).
  const [detail, setDetail] = useState<PlatformPackageOrderRow | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await apiPlatformPackageOrders(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        payment_status: paymentStatusFilter || undefined,
        company_id: companyId,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.package_orders.err_load"));
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, statusFilter, paymentStatusFilter, companyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiPackageOrdersStats(token, "30d")
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  function applyCompanyFilter() {
    const raw = companyIdDraft.trim();
    if (!raw) {
      setCompanyId(undefined);
      setPage(1);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setErr(t("admin.package_orders.err_invalid_company"));
      return;
    }
    setErr(null);
    setCompanyId(n);
    setPage(1);
  }

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Order: ${labelStatus(ORDER_STATUS_META, statusFilter)}`,
        clear: () => {
          setPage(1);
          setStatusFilter("");
        },
      });
    }
    if (paymentStatusFilter) {
      chips.push({
        key: "payment",
        label: `Payment: ${labelStatus(PAYMENT_STATUS_META, paymentStatusFilter)}`,
        clear: () => {
          setPage(1);
          setPaymentStatusFilter("");
        },
      });
    }
    if (companyId != null) {
      chips.push({
        key: "company",
        label: `Company #${companyId}`,
        clear: () => {
          setPage(1);
          setCompanyId(undefined);
          setCompanyIdDraft("");
        },
      });
    }
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `“${search.trim()}”`,
        clear: () => {
          setPage(1);
          setSearch("");
        },
      });
    }
    return chips;
  }, [statusFilter, paymentStatusFilter, companyId, search]);

  function clearAllFilters() {
    setPage(1);
    setStatusFilter("");
    setPaymentStatusFilter("");
    setCompanyId(undefined);
    setCompanyIdDraft("");
    setSearch("");
  }

  // Client-side search across order_number / package title / buyer name.
  const filteredRows = search.trim()
    ? rows.filter((r) => {
        const q = search.trim().toLowerCase();
        return (
          r.order_number.toLowerCase().includes(q) ||
          (r.package?.package_title ?? "").toLowerCase().includes(q) ||
          (r.user?.name ?? "").toLowerCase().includes(q) ||
          (r.company?.name ?? "").toLowerCase().includes(q)
        );
      })
    : rows;

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.package_orders.title_short")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Bookings", href: "/platform/bookings" },
          { label: t("admin.package_orders.title") },
        ]}
        title={t("admin.package_orders.title")}
        subtitle="Package orders across the platform with payment status."
        actions={
          <>
            <V2Button onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh">
              {""}
            </V2Button>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              onClick={() => exportPackageOrdersCsv(rows)}
              disabled={rows.length === 0}
            >
              Export
            </V2Button>
          </>
        }
      />

      <BookingsSectionTabs
        activeHref="/platform/package-orders"
        counts={{ packageOrders: stats?.total_count ?? meta?.total }}
      />

      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<Package style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.total_count.toLocaleString() : "—"}
          label="Total orders (30d)"
        />
        <StatCard
          icon={<CircleCheck style={{ color: "var(--admin-success)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.paid_count.toLocaleString() : "—"}
          label="Paid"
        />
        <StatCard
          icon={<Clock style={{ color: "var(--admin-warning)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.pending_count.toLocaleString() : "—"}
          label="Pending payment"
        />
        <StatCard
          icon={<DollarSign style={{ color: "var(--admin-info)" }} className="h-[22px] w-[22px]" />}
          value={stats ? formatMoney(stats.total_value, lang) : "—"}
          label="Total value (30d)"
        />
      </StatGrid>

      <FilterCard>
        <FilterField label="Order status">
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? labelStatus(ORDER_STATUS_META, s) : t("common.all")}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label={t("admin.package_orders.filter_payment_status")}>
          <select
            value={paymentStatusFilter}
            onChange={(e) => {
              setPage(1);
              setPaymentStatusFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? labelStatus(PAYMENT_STATUS_META, s) : t("common.all")}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Company ID">
          <input
            type="number"
            value={companyIdDraft}
            onChange={(e) => setCompanyIdDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyCompanyFilter();
            }}
            placeholder={t("admin.package_orders.placeholder_optional")}
            className="h-[34px] tabular-nums rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <FilterField label="Search" minWidth={240}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order #, package, buyer..."
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <V2Button variant="primary" size="md" onClick={applyCompanyFilter}>
          Apply
        </V2Button>
        {activeChips.length > 0 ? (
          <V2Button size="md" onClick={clearAllFilters}>
            Clear
          </V2Button>
        ) : null}
      </FilterCard>

      {activeChips.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium" style={{ color: "var(--admin-text-secondary)" }}>
            Active filters:
          </span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium transition hover:opacity-80"
              style={{
                backgroundColor: "var(--admin-primary-soft)",
                borderColor: "var(--admin-primary-light)",
                color: "var(--admin-primary)",
              }}
            >
              {chip.label}
              <XIcon className="h-3 w-3 opacity-70" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium opacity-80 hover:opacity-100"
            style={{ color: "var(--admin-text-secondary)" }}
          >
            <XCircle className="h-3 w-3" />
            Clear all
          </button>
        </div>
      ) : null}

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

      <V2Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead
              className="text-[11px] font-semibold uppercase tracking-[0.5px]"
              style={{ backgroundColor: "var(--admin-bg-secondary)", color: "var(--admin-text-secondary)" }}
            >
              <tr>
                <th className="px-4 py-2.5 text-left">{t("admin.invoices.col_id")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.package_orders.col_order_number")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.invoices.col_status")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.package_orders.col_payment")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.package_orders.col_total")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.package_orders.col_package")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.invoices.col_company")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.package_orders.col_buyer")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.approvals.col_created")}</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    {loading ? "Loading…" : t("admin.package_orders.empty") || "No package orders."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const orderMeta = ORDER_STATUS_META[r.status] ?? ORDER_STATUS_META.pending!;
                  const payMeta = PAYMENT_STATUS_META[r.payment_status] ?? PAYMENT_STATUS_META.pending!;
                  const companyName = r.company?.name ?? `#${r.company_id}`;
                  const buyerName = r.user?.name ?? `#${r.user_id}`;
                  const companyTone = pickAvatarTone(r.company_id);
                  const buyerTone = pickAvatarTone(r.user_id);
                  return (
                    <tr
                      key={r.id}
                      className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-fg-t7">PO-{String(r.id).padStart(4, "0")}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-mono text-[12px] font-semibold text-fg-t8">{r.order_number}</span>
                          <span className="text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
                            {r.adults_count}A · {r.children_count}C · {r.infants_count}I
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(orderMeta.tone)}>
                          {orderMeta.icon}
                          {orderMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(payMeta.tone)}>
                          {payMeta.icon}
                          {payMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-fg-t8 tabular-nums">
                        {formatMoney(r.final_total_snapshot, lang, r.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-fg-t8 truncate max-w-[200px]">
                            {r.package?.package_title ?? `#${r.package_id}`}
                          </span>
                          {r.package?.duration_days ? (
                            <span className="text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
                              {r.package.duration_days} days · {r.package.destination_city ?? r.package.destination_country ?? "—"}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                            style={avatarStyle(companyTone)}
                          >
                            {avatarInitials(companyName)}
                          </span>
                          <span className="text-fg-t8 truncate max-w-[150px]">{companyName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                            style={avatarStyle(buyerTone)}
                          >
                            {avatarInitials(buyerName)}
                          </span>
                          <span className="text-fg-t8 truncate max-w-[150px]">{buyerName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {formatRelativeTime(r.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton onClick={() => setDetail(r)} aria-label="View">
                            <Eye />
                          </IconButton>
                          {r.payment_status === "failed" ? (
                            <IconButton aria-label="Retry payment">
                              <RefreshCw />
                            </IconButton>
                          ) : null}
                          <IconButton aria-label="More">
                            <MoreVertical />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {meta && meta.last_page > 1 ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 text-[12px]"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}
          >
            <span>
              Showing {(meta.current_page - 1) * meta.per_page + 1}–
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} orders
            </span>
            <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
          </div>
        ) : null}
      </V2Card>

      <V2Drawer
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={
          detail
            ? `${tx(t, "admin.package_orders.detail_title", "Package order")} ${detail.order_number}`
            : undefined
        }
      >
        {detail ? (
          <>
            <V2DrawerSection>{tx(t, "admin.package_orders.detail_order", "Order")}</V2DrawerSection>
            <V2DrawerInfoRow
              label={tx(t, "admin.invoices.col_id", "ID")}
              value={`PO-${String(detail.id).padStart(4, "0")}`}
            />
            <V2DrawerInfoRow
              label={tx(t, "admin.package_orders.col_order_number", "Order number")}
              value={detail.order_number}
            />
            <V2DrawerInfoRow
              label={tx(t, "admin.invoices.col_status", "Status")}
              value={labelStatus(ORDER_STATUS_META, detail.status)}
            />
            <V2DrawerInfoRow
              label={tx(t, "admin.package_orders.col_payment", "Payment")}
              value={labelStatus(PAYMENT_STATUS_META, detail.payment_status)}
            />
            <V2DrawerInfoRow
              label={tx(t, "admin.package_orders.col_total", "Total")}
              value={formatMoney(detail.final_total_snapshot, lang, detail.currency)}
            />
            <V2DrawerInfoRow
              label={tx(t, "admin.package_orders.travellers", "Travellers")}
              value={`${detail.adults_count}A · ${detail.children_count}C · ${detail.infants_count}I`}
            />
            {detail.booking_channel ? (
              <V2DrawerInfoRow
                label={tx(t, "admin.package_orders.channel", "Channel")}
                value={detail.booking_channel}
              />
            ) : null}
            <V2DrawerInfoRow
              label={tx(t, "admin.approvals.col_created", "Created")}
              value={formatRelativeTime(detail.created_at)}
            />

            <V2DrawerSection>{tx(t, "admin.package_orders.col_package", "Package")}</V2DrawerSection>
            <V2DrawerInfoRow
              label={tx(t, "admin.package_orders.package_title", "Title")}
              value={detail.package?.package_title ?? `#${detail.package_id}`}
            />
            {detail.package?.package_type ? (
              <V2DrawerInfoRow
                label={tx(t, "admin.package_orders.package_type", "Type")}
                value={detail.package.package_type}
              />
            ) : null}
            {detail.package?.duration_days ? (
              <V2DrawerInfoRow
                label={tx(t, "admin.package_orders.duration", "Duration")}
                value={`${detail.package.duration_days} ${tx(t, "admin.package_orders.days", "days")}`}
              />
            ) : null}
            {detail.package?.destination_city || detail.package?.destination_country ? (
              <V2DrawerInfoRow
                label={tx(t, "admin.package_orders.destination", "Destination")}
                value={[detail.package?.destination_city, detail.package?.destination_country]
                  .filter(Boolean)
                  .join(", ")}
              />
            ) : null}

            <V2DrawerSection>{tx(t, "admin.package_orders.col_buyer", "Buyer")}</V2DrawerSection>
            <V2DrawerInfoRow
              label={tx(t, "admin.package_orders.buyer_name", "Name")}
              value={detail.user?.name ?? `#${detail.user_id}`}
            />
            {detail.user?.email ? (
              <V2DrawerInfoRow
                label={tx(t, "admin.package_orders.buyer_email", "Email")}
                value={detail.user.email}
              />
            ) : null}

            <V2DrawerSection>{tx(t, "admin.invoices.col_company", "Company")}</V2DrawerSection>
            <V2DrawerInfoRow
              label={tx(t, "admin.package_orders.company_name", "Name")}
              value={detail.company?.name ?? `#${detail.company_id}`}
            />
          </>
        ) : null}
      </V2Drawer>
    </div>
  );
}
