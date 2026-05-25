"use client";

/**
 * v2 admin-redesign — Payments list page (Finance group).
 *
 * Source spec: docs/admin_designe/finance_group_mocks.html (PAGE 3 PAYMENTS)
 * Migration prompt: docs/admin_designe/finance_group_implementation_prompt.md §3.A
 *
 * Chrome:
 *   - V2PageHeader with breadcrumb + Export CSV action
 *   - FinanceSectionTabs (shared across all 6 Finance pages)
 *   - 4 plain stat cards (totals + paid + pending + failed)
 *   - FilterCard (status / method / from / to / search)
 *   - Active filter chips
 *   - V2Card wrapping table
 *   - Status badges with Tabler icons
 *   - Avatar + company name (gracefully degrades to "—" if backend hasn't
 *     wired the company field on the Payment resource yet — backend TODO)
 *   - IconButton row for actions (View / Download / Retry / More)
 *   - Pagination inside V2Card
 */

import Link from "next/link";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiPlatformPayments, downloadPaymentsCsv, type PlatformPaymentRow } from "@/lib/platform-admin-api";
import { apiPaymentsStats, type PaymentsStats } from "@/lib/finance-stats-api";
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
  CheckIcon,
  ClockIcon,
  Loader2 as LoaderIcon,
  XIcon,
  RotateCcw as RotateIcon,
  Ban as BanIcon,
  Download,
  RefreshCw,
  Eye,
  MoreVertical,
  CreditCard,
  CircleCheck,
  Clock,
  CircleX,
  XCircle,
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
} from "@/components/ui/v2";
import { FinanceSectionTabs } from "@/components/finance/FinanceSectionTabs";

const PAYMENT_STATUSES = ["", "pending", "processing", "paid", "failed", "refunded", "cancelled"] as const;
const PAYMENT_METHODS = ["", "bank_transfer", "card", "wallet", "cash"] as const;

type PaymentStatusMeta = { tone: StatusTone; label: string; icon: React.ReactNode };

const STATUS_META: Record<string, PaymentStatusMeta> = {
  paid: { tone: "success", label: "Paid", icon: <CheckIcon className="h-3 w-3" /> },
  pending: { tone: "warning", label: "Pending", icon: <ClockIcon className="h-3 w-3" /> },
  processing: { tone: "info", label: "Processing", icon: <LoaderIcon className="h-3 w-3" /> },
  failed: { tone: "danger", label: "Failed", icon: <XIcon className="h-3 w-3" /> },
  refunded: { tone: "gray", label: "Refunded", icon: <RotateIcon className="h-3 w-3" /> },
  cancelled: { tone: "gray", label: "Cancelled", icon: <BanIcon className="h-3 w-3" /> },
};

function formatMethod(method: string | null | undefined): string {
  if (!method) return "—";
  // Mask card numbers in the form "card:**4242" or "Card · **4242" if backend ever provides masked PAN.
  // For now, normalise the snake_case to spaced label.
  return method
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export default function PlatformPaymentsPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformPaymentRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PaymentsStats | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await apiPlatformPayments(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.payments.err_load"));
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, statusFilter, fromDate, toDate, t]);

  async function handleExport() {
    if (!token) return;
    setExporting(true);
    try {
      await downloadPaymentsCsv(token, {
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : t("admin.payments.err_export"));
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiPaymentsStats(token, "30d")
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${STATUS_META[statusFilter]?.label ?? statusFilter}`,
        clear: () => {
          setPage(1);
          setStatusFilter("");
        },
      });
    }
    if (methodFilter) {
      chips.push({
        key: "method",
        label: `Method: ${formatMethod(methodFilter)}`,
        clear: () => {
          setPage(1);
          setMethodFilter("");
        },
      });
    }
    if (fromDate || toDate) {
      const label = fromDate && toDate ? `${fromDate} → ${toDate}` : fromDate ? `From ${fromDate}` : `Until ${toDate}`;
      chips.push({
        key: "date",
        label,
        clear: () => {
          setPage(1);
          setFromDate("");
          setToDate("");
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
  }, [statusFilter, methodFilter, fromDate, toDate, search]);

  function clearAllFilters() {
    setPage(1);
    setStatusFilter("");
    setMethodFilter("");
    setFromDate("");
    setToDate("");
    setSearch("");
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.payments.title_short")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  // Filter rows client-side for the search query (until backend search param ships).
  const filteredRows = search.trim()
    ? rows.filter((r) => {
        const q = search.trim().toLowerCase();
        return (
          String(r.id).includes(q) ||
          r.reference_code?.toLowerCase().includes(q) ||
          r.invoice?.unique_booking_reference?.toLowerCase().includes(q)
        );
      })
    : rows;

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Finance", href: "/platform/finance-summary" },
          { label: t("admin.payments.title") },
        ]}
        title={t("admin.payments.title")}
        subtitle={
          t("admin.payments.subtitle") !== "admin.payments.subtitle"
            ? t("admin.payments.subtitle")
            : "All payment transactions across the platform"
        }
        actions={
          <>
            <V2Button onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh">
              {""}
            </V2Button>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              {exporting ? t("admin.payments.exporting") : t("admin.payments.btn_export_csv")}
            </V2Button>
          </>
        }
      />

      <FinanceSectionTabs activeHref="/platform/payments" counts={{ payments: meta?.total }} />

      {/* 4 plain stat cards — values from /platform-admin/payments/stats. */}
      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<CreditCard style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.total_count.toLocaleString() : "—"}
          label="Total payments (30d)"
        />
        <StatCard
          icon={<CircleCheck style={{ color: "var(--admin-success)" }} className="h-[22px] w-[22px]" />}
          value={stats ? formatMoney(stats.paid_amount, lang) : "—"}
          label="Paid this month"
          footer={stats ? `${stats.paid_count} payment${stats.paid_count === 1 ? "" : "s"}` : undefined}
        />
        <StatCard
          icon={<Clock style={{ color: "var(--admin-warning)" }} className="h-[22px] w-[22px]" />}
          value={stats ? formatMoney(stats.pending_amount, lang) : "—"}
          label="Pending"
          footer={stats && stats.pending_count > 0 ? `${stats.pending_count} new` : undefined}
        />
        <StatCard
          icon={<CircleX style={{ color: "var(--admin-danger)" }} className="h-[22px] w-[22px]" />}
          value={stats ? formatMoney(stats.failed_amount, lang) : "—"}
          label="Failed (last 7d)"
          footer={stats && stats.failed_count > 0 ? `${stats.failed_count} failed` : undefined}
        />
      </StatGrid>

      <FilterCard>
        <FilterField label={t("admin.approvals.filter_status")}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? STATUS_META[s]?.label ?? s : t("common.all")}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Payment method">
          <select
            value={methodFilter}
            onChange={(e) => {
              setPage(1);
              setMethodFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m ? formatMethod(m) : t("common.all")}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label={t("admin.invoices.filter_from")}>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setPage(1);
              setFromDate(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <FilterField label={t("admin.invoices.filter_to")}>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setPage(1);
              setToDate(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <FilterField label="Search" minWidth={240}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, reference, or company..."
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <V2Button variant="primary" size="md" onClick={() => void load()}>
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
                <th className="px-4 py-2.5 text-left">{t("admin.invoices.col_amount")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.payments.col_currency")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.invoices.col_status")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.payments.col_method")}</th>
                <th className="px-4 py-2.5 text-left">Company</th>
                <th className="px-4 py-2.5 text-left">{t("admin.payments.col_paid_at")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.payments.col_invoice")}</th>
                <th className="px-4 py-2.5 text-right">{t("admin.invoices.col_actions") ?? "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    {loading ? "Loading…" : t("admin.payments.empty") || "No payments found."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const statusMeta = STATUS_META[r.status] ?? STATUS_META.pending!;
                  // Finance group v2 — backend now surfaces invoice.order.company
                  // via the eager-load chain in PlatformAdminService.
                  const companyName = r.invoice?.company?.name ?? r.invoice?.agent_company?.name ?? null;
                  const companyKey = r.invoice?.company?.id ?? r.invoice?.agent_company?.id ?? r.invoice?.id ?? r.id;
                  const tone = pickAvatarTone(companyKey);
                  return (
                    <tr
                      key={r.id}
                      className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-fg-t7">#{r.id}</td>
                      <td className="px-4 py-3 font-semibold text-fg-t8 tabular-nums">{formatMoney(r.amount, lang)}</td>
                      <td className="px-4 py-3 font-mono text-[12px] text-fg-t7">{r.currency?.toUpperCase() ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusMeta.tone)}>
                          {statusMeta.icon}
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-fg-t8">{formatMethod(r.payment_method)}</td>
                      <td className="px-4 py-3">
                        {companyName ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                              style={avatarStyle(tone)}
                            >
                              {avatarInitials(companyName)}
                            </span>
                            <span className="text-fg-t8">{companyName}</span>
                          </div>
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {formatRelativeTime(r.paid_at)}
                      </td>
                      <td className="px-4 py-3 text-[12px]">
                        {r.invoice ? (
                          <Link
                            href={`/platform/invoices?focus=${r.invoice.id}`}
                            className="font-mono underline hover:opacity-80"
                            style={{ color: "var(--admin-primary)" }}
                          >
                            #{r.invoice.id}
                            {r.invoice.unique_booking_reference ? ` ${r.invoice.unique_booking_reference}` : ""}
                          </Link>
                        ) : r.invoice_id ? (
                          <Link
                            href={`/platform/invoices?focus=${r.invoice_id}`}
                            className="font-mono underline hover:opacity-80"
                            style={{ color: "var(--admin-primary)" }}
                          >
                            #{r.invoice_id}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton aria-label="View">
                            <Eye />
                          </IconButton>
                          {r.status === "paid" ? (
                            <IconButton aria-label="Download receipt">
                              <Download />
                            </IconButton>
                          ) : null}
                          {r.status === "failed" ? (
                            <IconButton aria-label="Retry">
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
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} payments
            </span>
            <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
          </div>
        ) : null}
      </V2Card>
    </div>
  );
}
