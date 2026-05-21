"use client";

/**
 * Figma layout reference: Quest CRM Copy template
 *   - Client Table (list pattern):  4393:6787
 *   - Service Logs (list w/filters): 4658:8386
 * Brand tokens: ZULU purple primary (--admin-primary).
 * Phase-2 migration to shared @/components/ui primitives.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiBookings, apiConfirmBooking, apiCancelBooking, type BookingRow } from "@/lib/bookings-api";
import { formatDate, formatMoney } from "@/lib/format";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import {
  Button,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";

const STATUSES = ["", "pending", "confirmed", "cancelled", "completed"];

// formatAmount replaced by formatMoney from @/lib/format (single source of truth).

export default function PlatformBookingsPage() {
  const { t, lang } = useLanguage();
  const { token, user } = useAdminAuth();
  const confirmDialog = useConfirm();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiBookings(token, { page, per_page: 20, status: statusFilter || undefined });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else if (e instanceof ApiRequestError && (e.status === 404 || e.message === "Not found")) {
        setRows([]);
        setMeta(null);
      } else setErr(e instanceof ApiRequestError ? e.message : t("admin.platform_bookings.err_load"));
    }
  }, [token, allowed, page, statusFilter, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConfirm(id: number) {
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

  async function handleCancel(id: number) {
    if (!token) return;
    const ok = await confirmDialog({ messageKey: "admin.platform_bookings.confirm_cancel", variant: "danger" });
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

  const filteredRows = search.trim()
    ? rows.filter((r) => {
        const q = search.toLowerCase();
        return (
          (r.booking_reference ?? "").toLowerCase().includes(q) ||
          (r.company?.name ?? "").toLowerCase().includes(q) ||
          (r.user?.name ?? "").toLowerCase().includes(q) ||
          (r.offer?.title ?? "").toLowerCase().includes(q) ||
          String(r.id).includes(q)
        );
      })
    : rows;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.platform_bookings.title")}
        subtitle={
          meta
            ? t("admin.platform_bookings.meta")
                .replace("{total}", String(meta.total))
                .replace("{page}", String(meta.current_page))
                .replace("{lastPage}", String(meta.last_page))
            : undefined
        }
      />

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-t6"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.platform_bookings.search_placeholder")}
              className="h-10 w-full rounded-zulu border border-default bg-white pl-9 pr-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">{t("admin.platform_bookings.status")}</span>
            <Select
              fieldSize="sm"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
              className="!w-auto min-w-[140px]"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s ? t(`admin.platform_bookings.status_${s}`) : t("common.all")}
                </option>
              ))}
            </Select>
          </label>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t("admin.platform_bookings.refresh")}
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <THead>
            <TR>
              <TH>{t("admin.crud.common.id")}</TH>
              <TH>{t("admin.platform_bookings.reference")}</TH>
              <TH>{t("admin.platform_bookings.status")}</TH>
              <TH>{t("admin.platform_bookings.amount")}</TH>
              <TH>{t("admin.platform_bookings.company")}</TH>
              <TH>{t("admin.platform_bookings.user")}</TH>
              <TH>{t("admin.platform_bookings.offer")}</TH>
              <TH>{t("admin.platform_bookings.created")}</TH>
              <TH align="right">{t("admin.platform_bookings.actions")}</TH>
            </TR>
          </THead>
          <TBody>
            {filteredRows.length === 0 ? (
              <TEmpty colSpan={9}>
                {search.trim() ? t("admin.platform_bookings.no_match") : t("admin.platform_bookings.empty")}
              </TEmpty>
            ) : null}
            {filteredRows.map((r) => (
              <TR key={r.id}>
                <TD className="tabular-nums">{r.id}</TD>
                <TD className="font-mono text-xs text-fg-t8">{r.booking_reference ?? "—"}</TD>
                <TD>
                  <StatusPill status={r.status}>
                    {r.status ? t(`admin.platform_bookings.status_${r.status}`) : "—"}
                  </StatusPill>
                </TD>
                <TD className="tabular-nums text-fg-t8">{formatMoney(r.total_amount, lang, r.currency)}</TD>
                <TD className="text-fg-t8">{r.company?.name ?? "—"}</TD>
                <TD>{r.user?.name ?? "—"}</TD>
                <TD>
                  {r.offer ? (
                    <span>
                      {r.offer.title}
                      <span className="ml-1 text-xs text-fg-t6">({r.offer.type})</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD className="text-xs text-fg-t6">{formatDate(r.created_at, lang)}</TD>
                <TD align="right">
                  <div className="flex justify-end gap-2">
                    {r.status === "pending" && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleConfirm(r.id);
                        }}
                        className="inline-flex h-8 items-center rounded-zulu border border-success-200 bg-success-50 px-3 text-xs font-medium text-success-700 transition hover:bg-success-100 disabled:opacity-40"
                      >
                        {t("admin.platform_bookings.confirm")}
                      </button>
                    )}
                    {(r.status === "pending" || r.status === "confirmed") && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCancel(r.id);
                        }}
                        className="inline-flex h-8 items-center rounded-zulu border border-error-200 bg-white px-3 text-xs font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
                      >
                        {t("common.cancel")}
                      </button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {filteredRows.length === 0 && (
          <div className="admin-card p-6 text-center text-sm text-fg-t6">
            {search.trim() ? t("admin.platform_bookings.no_match") : t("admin.platform_bookings.empty")}
          </div>
        )}
        {filteredRows.map((r) => (
          <div key={r.id} className="admin-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-xs text-fg-t6">#{r.id}</div>
                <div className="truncate font-medium text-fg-t8">{r.booking_reference ?? "—"}</div>
                {r.offer && (
                  <div className="mt-0.5 truncate text-xs text-fg-t6">
                    {r.offer.title} ({r.offer.type})
                  </div>
                )}
              </div>
              <StatusPill status={r.status}>
                {r.status ? t(`admin.platform_bookings.status_${r.status}`) : "—"}
              </StatusPill>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-fg-t6">{t("admin.platform_bookings.amount")}</div>
                <div className="tabular-nums text-fg-t8">{formatMoney(r.total_amount, lang, r.currency)}</div>
              </div>
              <div>
                <div className="text-fg-t6">{t("admin.platform_bookings.created")}</div>
                <div className="text-fg-t8">{formatDate(r.created_at, lang)}</div>
              </div>
              <div>
                <div className="text-fg-t6">{t("admin.platform_bookings.company")}</div>
                <div className="truncate text-fg-t8">{r.company?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-fg-t6">{t("admin.platform_bookings.user")}</div>
                <div className="truncate text-fg-t8">{r.user?.name ?? "—"}</div>
              </div>
            </div>
            {(r.status === "pending" || r.status === "confirmed") && (
              <div className="flex gap-2 border-t border-default pt-3">
                {r.status === "pending" && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void handleConfirm(r.id)}
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-zulu border border-success-200 bg-success-50 px-3 text-sm font-medium text-success-700 transition hover:bg-success-100 disabled:opacity-40"
                  >
                    {t("admin.platform_bookings.confirm")}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void handleCancel(r.id)}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-zulu border border-error-200 bg-white px-3 text-sm font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
                >
                  {t("common.cancel")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
    </div>
  );
}
