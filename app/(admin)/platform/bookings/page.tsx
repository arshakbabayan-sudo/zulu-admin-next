"use client";

/**
 * v2 admin-redesign — All bookings page (Bookings group).
 *
 * Source spec: docs/admin_designe/Bookings/bookings_mocks.html (PAGE 1)
 * Migration prompt: docs/admin_designe/Bookings/bookings_implementation_prompt.md §3.A
 *
 * Chrome:
 *   - V2PageHeader with breadcrumb (Home › Bookings › All bookings) + Export action
 *   - BookingsSectionTabs (shared with /platform/package-orders)
 *   - 4 stat cards from /platform-admin/bookings/stats (30d)
 *   - FilterCard (Status / Service type / From / To / Search)
 *   - Active filter chips with per-chip dismissal
 *   - V2Card wrapping table
 *   - Status badges with icons (admin-v2-helpers)
 *   - Avatar + company / user columns
 *   - Inline Confirm (success border) / Cancel (danger border) — NOT primary
 *   - IconButton row (View / More) for non-actionable states
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiBookings,
  apiConfirmBooking,
  apiCancelBooking,
  type BookingRow,
} from "@/lib/bookings-api";
import { apiBookingsStats, type BookingsStats } from "@/lib/bookings-stats-api";
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
  CalendarDays,
  Check,
  CheckCheck,
  CircleCheck,
  Clock,
  Download,
  DollarSign,
  Eye,
  MoreVertical,
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
} from "@/components/ui/v2";
import { BookingsSectionTabs } from "@/components/bookings/BookingsSectionTabs";

const BOOKING_STATUSES = [
  "",
  "cart",
  "pending_payment",
  "paid",
  "confirmed",
  "cancelled",
  "refunded",
  "failed",
] as const;

const SERVICE_TYPES = [
  "",
  "hotel",
  "flight",
  "transfer",
  "car",
  "excursion",
  "visa",
] as const;

type BookingStatusMeta = { tone: StatusTone; label: string; icon: React.ReactNode };

const STATUS_META: Record<string, BookingStatusMeta> = {
  cart: { tone: "gray", label: "Cart", icon: <Clock className="h-3 w-3" /> },
  pending_payment: { tone: "warning", label: "Pending", icon: <Clock className="h-3 w-3" /> },
  paid: { tone: "success", label: "Paid", icon: <Check className="h-3 w-3" /> },
  confirmed: { tone: "success", label: "Confirmed", icon: <Check className="h-3 w-3" /> },
  completed: { tone: "info", label: "Completed", icon: <CheckCheck className="h-3 w-3" /> },
  cancelled: { tone: "danger", label: "Cancelled", icon: <XSimple className="h-3 w-3" /> },
  refunded: { tone: "gray", label: "Refunded", icon: <RotateIcon className="h-3 w-3" /> },
  failed: { tone: "danger", label: "Failed", icon: <XSimple className="h-3 w-3" /> },
};

function labelStatus(s: string): string {
  return STATUS_META[s]?.label ?? s.replace(/_/g, " ");
}

function labelServiceType(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function deriveOffer(row: BookingRow): { title: string; type: string } | null {
  if (row.offer) return { title: row.offer.title, type: row.offer.type };
  const first = row.items?.[0];
  if (!first) return null;
  return {
    title: first.title ?? `Item #${first.id}`,
    type: first.module_type ?? "—",
  };
}

export default function PlatformBookingsPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const confirmDialog = useConfirm();
  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<BookingRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [stats, setStats] = useState<BookingsStats | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await apiBookings(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        service_type: serviceTypeFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        search: search || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else if (e instanceof ApiRequestError && (e.status === 404 || e.message === "Not found")) {
        setRows([]);
        setMeta(null);
      } else {
        setErr(e instanceof ApiRequestError ? e.message : t("admin.platform_bookings.err_load"));
      }
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, statusFilter, serviceTypeFilter, fromDate, toDate, search, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiBookingsStats(token, "30d")
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  async function handleConfirm(id: string) {
    if (!token) return;
    const ok = await confirmDialog({ messageKey: "admin.platform_bookings.confirm_confirm" });
    if (!ok) return;
    setBusyId(id);
    try {
      await apiConfirmBooking(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_bookings.err_action"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(id: string) {
    if (!token) return;
    const ok = await confirmDialog({
      messageKey: "admin.platform_bookings.confirm_cancel",
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await apiCancelBooking(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_bookings.err_action"));
    } finally {
      setBusyId(null);
    }
  }

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${labelStatus(statusFilter)}`,
        clear: () => {
          setPage(1);
          setStatusFilter("");
        },
      });
    }
    if (serviceTypeFilter) {
      chips.push({
        key: "service",
        label: `Service: ${labelServiceType(serviceTypeFilter)}`,
        clear: () => {
          setPage(1);
          setServiceTypeFilter("");
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
          setSearchDraft("");
        },
      });
    }
    return chips;
  }, [statusFilter, serviceTypeFilter, fromDate, toDate, search]);

  function clearAllFilters() {
    setPage(1);
    setStatusFilter("");
    setServiceTypeFilter("");
    setFromDate("");
    setToDate("");
    setSearch("");
    setSearchDraft("");
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.platform_bookings.title")}</h1>
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
          { label: t("admin.platform_bookings.title") },
        ]}
        title={t("admin.platform_bookings.title")}
        actions={
          <>
            <V2Button onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh">
              {""}
            </V2Button>
            <V2Button icon={<Download className="h-4 w-4" />}>
              {t("admin.platform_bookings.export_csv") !== "admin.platform_bookings.export_csv"
                ? t("admin.platform_bookings.export_csv")
                : "Export CSV"}
            </V2Button>
          </>
        }
      />

      <BookingsSectionTabs activeHref="/platform/bookings" counts={{ bookings: stats?.total_count ?? meta?.total }} />

      {/* 4 plain stat cards — values from /platform-admin/bookings/stats. */}
      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<CalendarDays style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.total_count.toLocaleString() : "—"}
          label="Total bookings (30d)"
        />
        <StatCard
          icon={<Clock style={{ color: "var(--admin-warning)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.pending_count.toLocaleString() : "—"}
          label="Pending confirmation"
          footer={stats && stats.pending_count > 0 ? `${stats.pending_count} new` : undefined}
        />
        <StatCard
          icon={<CircleCheck style={{ color: "var(--admin-success)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.confirmed_count.toLocaleString() : "—"}
          label="Confirmed (30d)"
        />
        <StatCard
          icon={<DollarSign style={{ color: "var(--admin-info)" }} className="h-[22px] w-[22px]" />}
          value={stats ? formatMoney(stats.revenue_amount, lang) : "—"}
          label="Revenue (30d)"
        />
      </StatGrid>

      <FilterCard>
        <FilterField label={t("admin.platform_bookings.status")}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? labelStatus(s) : t("common.all")}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Service type">
          <select
            value={serviceTypeFilter}
            onChange={(e) => {
              setPage(1);
              setServiceTypeFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s ? labelServiceType(s) : t("common.all")}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="From">
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
        <FilterField label="To">
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
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setSearch(searchDraft.trim());
              }
            }}
            placeholder={t("admin.platform_bookings.search_placeholder")}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <V2Button
          variant="primary"
          size="md"
          onClick={() => {
            setPage(1);
            setSearch(searchDraft.trim());
          }}
        >
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
                <th className="px-4 py-2.5 text-left">{t("admin.crud.common.id")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.platform_bookings.reference")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.platform_bookings.status")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.platform_bookings.amount")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.platform_bookings.company")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.platform_bookings.user")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.platform_bookings.offer")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.platform_bookings.created")}</th>
                <th className="px-4 py-2.5 text-right">{t("admin.platform_bookings.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    {loading
                      ? "Loading…"
                      : search.trim()
                      ? t("admin.platform_bookings.no_match")
                      : t("admin.platform_bookings.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const statusMeta = STATUS_META[r.status] ?? STATUS_META.pending_payment!;
                  const reference = r.order_number ?? r.booking_reference ?? `#${r.id.slice(0, 8)}`;
                  const total = r.total ?? r.total_amount;
                  const offer = deriveOffer(r);
                  const companyName = r.company?.name ?? null;
                  const userName = r.user?.name ?? null;
                  const companyTone = pickAvatarTone(r.company?.id ?? r.id);
                  const userTone = pickAvatarTone(r.user?.id ?? r.id);
                  return (
                    <tr
                      key={r.id}
                      className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-fg-t7">#{r.id.slice(0, 8)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-mono text-[12px] font-semibold text-fg-t8">{reference}</span>
                          {offer ? (
                            <span className="text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
                              {offer.title} · {offer.type}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusMeta.tone)}>
                          {statusMeta.icon}
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-fg-t8 tabular-nums">
                        {formatMoney(total, lang, r.currency)}
                      </td>
                      <td className="px-4 py-3">
                        {companyName ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                              style={avatarStyle(companyTone)}
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
                      <td className="px-4 py-3">
                        {userName ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                              style={avatarStyle(userTone)}
                            >
                              {avatarInitials(userName)}
                            </span>
                            <span className="text-fg-t8">{userName}</span>
                          </div>
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {offer ? `${offer.title} (${offer.type})` : "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {formatRelativeTime(r.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {(r.status === "pending_payment" || r.status === "cart") && (
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleConfirm(r.id);
                              }}
                              aria-label={t("admin.platform_bookings.confirm")}
                              title={t("admin.platform_bookings.confirm")}
                              className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-md border border-success-300 bg-success-50 text-success-800 transition hover:bg-success-100 disabled:opacity-40 [&>svg]:h-[18px] [&>svg]:w-[18px]"
                            >
                              <Check />
                            </button>
                          )}
                          {(r.status === "pending_payment" ||
                            r.status === "cart" ||
                            r.status === "paid" ||
                            r.status === "confirmed") && (
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleCancel(r.id);
                              }}
                              aria-label={t("common.cancel")}
                              title={t("common.cancel")}
                              className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-md border border-error-300 bg-error-50 text-error-800 transition hover:bg-error-100 disabled:opacity-40 [&>svg]:h-[18px] [&>svg]:w-[18px]"
                            >
                              <XSimple />
                            </button>
                          )}
                          <IconButton as="link" href={`/platform/bookings/${r.id}`} aria-label="View">
                            <Eye />
                          </IconButton>
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
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} bookings
            </span>
            <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
          </div>
        ) : null}
      </V2Card>
    </div>
  );
}
