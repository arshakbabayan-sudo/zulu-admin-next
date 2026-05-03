"use client";

/**
 * Figma layout reference: Quest CRM Copy template
 *   - Client Table (list pattern):  4393:6787
 *   - Service Logs (list w/filters): 4658:8386
 *   - Mobile list view:              10186:30338
 * Brand tokens: ZULU purple primary (--admin-primary).
 * Mobile rule: table converts to card list at <md (per design-system.md §7).
 * Last synced: 2026-05-03
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiBookings, apiConfirmBooking, apiCancelBooking, type BookingRow } from "@/lib/bookings-api";
import { useCallback, useEffect, useState } from "react";

const STATUSES = ["", "pending", "confirmed", "cancelled", "completed"];

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "confirmed" || status === "completed"
      ? "bg-success-50 text-success-700 border-success-100"
      : status === "cancelled"
        ? "bg-error-50 text-error-700 border-error-100"
        : status === "pending"
          ? "bg-warning-50 text-warning-700 border-warning-100"
          : "bg-figma-bg-1 text-fg-t6 border-default";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {status || "—"}
    </span>
  );
}

function formatAmount(amount: number | string | null | undefined, currency: string | null | undefined): string {
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  const formatted = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return currency ? `${currency} ${formatted}` : formatted;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export default function PlatformBookingsPage() {
  const { token, user } = useAdminAuth();
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
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
    }
  }, [token, allowed, page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConfirm(id: number) {
    if (!token || !window.confirm("Confirm this booking?")) return;
    setBusyId(id);
    try {
      await apiConfirmBooking(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(id: number) {
    if (!token || !window.confirm("Cancel this booking?")) return;
    setBusyId(id);
    try {
      await apiCancelBooking(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Bookings</h1>
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="admin-page-title">Bookings</h1>
          {meta && (
            <p className="mt-1 text-sm text-fg-t6">
              {meta.total} total · page {meta.current_page} of {meta.last_page}
            </p>
          )}
        </div>
      </header>

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-current text-fg-t6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, company, user, offer…"
              className="h-9 w-full rounded-zulu border border-default bg-white pl-9 pr-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
              className="h-9 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 items-center gap-1.5 rounded-zulu border border-default bg-white px-3 text-sm font-medium text-fg-t7 transition hover:bg-figma-bg-1"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      {/* Desktop / tablet: table */}
      <div className="admin-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-default bg-figma-bg-1 text-xs font-medium uppercase tracking-wide text-fg-t6">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Offer</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-fg-t6">
                    {search.trim() ? "No bookings match your search." : "No bookings found."}
                  </td>
                </tr>
              )}
              {filteredRows.map((r) => (
                <tr key={r.id} className="border-b border-default last:border-0 transition hover:bg-figma-bg-1">
                  <td className="px-4 py-3 tabular-nums text-fg-t7">{r.id}</td>
                  <td className="px-4 py-3 font-mono text-xs text-fg-t8">{r.booking_reference ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-fg-t8">{formatAmount(r.total_amount, r.currency)}</td>
                  <td className="px-4 py-3 text-fg-t8">{r.company?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-fg-t7">{r.user?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-fg-t7">
                    {r.offer ? (
                      <span>
                        {r.offer.title}
                        <span className="ml-1 text-xs text-fg-t6">({r.offer.type})</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-t6">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {r.status === "pending" && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void handleConfirm(r.id)}
                          className="inline-flex h-8 items-center rounded-zulu border border-success-200 bg-success-50 px-3 text-xs font-medium text-success-700 transition hover:bg-success-100 disabled:opacity-40"
                        >
                          Confirm
                        </button>
                      )}
                      {(r.status === "pending" || r.status === "confirmed") && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void handleCancel(r.id)}
                          className="inline-flex h-8 items-center rounded-zulu border border-error-200 bg-white px-3 text-xs font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {filteredRows.length === 0 && (
          <div className="admin-card p-6 text-center text-sm text-fg-t6">
            {search.trim() ? "No bookings match your search." : "No bookings found."}
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
              <StatusPill status={r.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-fg-t6">Amount</div>
                <div className="tabular-nums text-fg-t8">{formatAmount(r.total_amount, r.currency)}</div>
              </div>
              <div>
                <div className="text-fg-t6">Created</div>
                <div className="text-fg-t8">{formatDate(r.created_at)}</div>
              </div>
              <div>
                <div className="text-fg-t6">Company</div>
                <div className="truncate text-fg-t8">{r.company?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-fg-t6">User</div>
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
                    className="inline-flex h-9 flex-1 items-center justify-center rounded-zulu border border-success-200 bg-success-50 px-3 text-sm font-medium text-success-700 transition hover:bg-success-100 disabled:opacity-40"
                  >
                    Confirm
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void handleCancel(r.id)}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-zulu border border-error-200 bg-white px-3 text-sm font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
