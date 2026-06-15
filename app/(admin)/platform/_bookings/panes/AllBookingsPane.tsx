"use client";

/**
 * All bookings pane — 1:1 port of #pane-bookings in bookings.html.
 *
 * List view (stat-grid + filter-card + chip-row + table + pagination) toggles
 * with a full-page IN-PANE read-only detail (5 cards: Customer · Financials ·
 * Parties · Timeline · Items). Confirm is non-destructive; Cancel goes through
 * the themed confirm dialog. Wiring: apiBookings / apiBooking / apiConfirmBooking
 * / apiCancelBooking / apiBookingsStats (lib/bookings-api, lib/bookings-stats-api).
 *
 * Row scope is enforced server-side (super = all companies; operator/agent =
 * own company; employee = view_all or own sales) — the page renders what it gets.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiBookings,
  apiBooking,
  apiConfirmBooking,
  apiCancelBooking,
  type BookingRow,
} from "@/lib/bookings-api";
import { apiBookingsStats, type BookingsStats } from "@/lib/bookings-stats-api";
import { formatRelativeTime } from "@/lib/admin-v2-helpers";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { bookingsStrings, type BookingsKey } from "../bookings-i18n";
import { BK_STATUS, avatarTone, initials, money, fmtDateTime, titleCase } from "../bookings-helpers";
import type { BookingsPaneProps } from "../types";

const STATUSES = ["", "cart", "pending_payment", "paid", "confirmed", "cancelled", "refunded", "failed"];
const SERVICE_TYPES = ["", "hotel", "flight", "transfer", "car", "excursion", "visa"];
const SERVICE_KEY: Record<string, BookingsKey> = {
  hotel: "svHotel",
  flight: "svFlight",
  transfer: "svTransfer",
  car: "svCar",
  excursion: "svExcursion",
  visa: "svVisa",
};
const PER_PAGE = 20;

function deriveOffer(row: BookingRow): { title: string; type: string } | null {
  if (row.offer) return { title: row.offer.title, type: row.offer.type };
  const first = row.items?.[0];
  if (!first) return null;
  return { title: first.title ?? `Item #${first.id}`, type: first.module_type ?? "—" };
}

function exportCsv(rows: BookingRow[]): void {
  if (rows.length === 0) return;
  const headers = ["id", "order_number", "status", "service_type", "total", "currency", "company", "buyer_name", "buyer_email", "created_at"];
  const esc = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    const offer = deriveOffer(r);
    lines.push(
      [r.id, r.order_number ?? "", r.status, offer?.type ?? "", r.total ?? r.total_amount ?? "", r.currency ?? "", r.company?.name ?? r.agent_company?.name ?? "", r.user?.name ?? "", r.user?.email ?? "", r.created_at ?? ""]
        .map(esc)
        .join(","),
    );
  }
  const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  link.href = url;
  link.download = `bookings-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AllBookingsPane({
  token,
  lang,
  registerAction,
  reportCount,
  setCrumbOverride,
  showToast,
  initialBookingId,
}: BookingsPaneProps & { initialBookingId?: string }) {
  const s = bookingsStrings(lang);
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const userIdFilter = useMemo(() => {
    const raw = searchParams?.get("user_id");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);

  const [rows, setRows] = useState<BookingRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [stats, setStats] = useState<BookingsStats | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // in-pane detail
  const [view, setView] = useState<"list" | "detail">("list");
  const [detail, setDetail] = useState<BookingRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const rowsRef = useRef<BookingRow[]>(rows);
  rowsRef.current = rows;

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await apiBookings(token, {
        page,
        per_page: PER_PAGE,
        status: statusFilter || undefined,
        service_type: serviceFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        search: search || undefined,
        user_id: userIdFilter ?? undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else if (e instanceof ApiRequestError && (e.status === 404 || e.message === "Not found")) {
        setRows([]);
        setMeta(null);
      } else setErr(e instanceof ApiRequestError ? e.message : s.errLoad);
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, serviceFilter, fromDate, toDate, search, userIdFilter, s.errLoad]);

  useEffect(() => { void load(); }, [load]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiBookingsStats(token, "30d");
      setStats(res.data);
      reportCount(res.data.total_count);
    } catch { setStats(null); }
  }, [token, reportCount]);

  useEffect(() => { void loadStats(); }, [loadStats]);

  // header action slot — Refresh + Export CSV (reads the latest page via ref)
  useEffect(() => {
    registerAction(
      <>
        <button className="btn btn-sm" title={s.refresh} onClick={() => { void load(); showToast(s.bkRefreshedToast); }}>
          <i className="ti ti-refresh" />
        </button>
        <button className="btn btn-primary" onClick={() => { exportCsv(rowsRef.current); showToast(s.bkExportedToast); }}>
          <i className="ti ti-download" /> {s.exportCsv}
        </button>
      </>,
    );
  }, [registerAction, load, s, showToast]);

  const openBooking = useCallback(async (id: string) => {
    if (!token) return;
    setView("detail");
    setDetail(null);
    setDetailLoading(true);
    document.querySelector(".mgmt-page .main")?.scrollTo({ top: 0, behavior: "smooth" });
    if (typeof window !== "undefined") window.history.replaceState(window.history.state, "", `/platform/bookings/${id}`);
    try {
      const res = await apiBooking(token, id);
      setDetail(res.data);
      setCrumbOverride(res.data.order_number ?? `#${id.slice(0, 8)}`);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errLoad);
      setView("list");
      setCrumbOverride(null);
    } finally {
      setDetailLoading(false);
    }
  }, [token, setCrumbOverride, s.errLoad]);

  const backToList = useCallback(() => {
    setView("list");
    setDetail(null);
    setCrumbOverride(null);
    if (typeof window !== "undefined") window.history.replaceState(window.history.state, "", "/platform/bookings");
  }, [setCrumbOverride]);

  // deep-link: /platform/bookings/[id] mounts straight into detail
  const didInitial = useRef(false);
  useEffect(() => {
    if (initialBookingId && !didInitial.current) {
      didInitial.current = true;
      void openBooking(initialBookingId);
    }
  }, [initialBookingId, openBooking]);

  async function handleConfirm(id: string, fromDetail = false) {
    if (!token) return;
    setBusyId(id);
    try {
      const res = await apiConfirmBooking(token, id);
      showToast(`${s.bkConfirmedToast} · ${res.data.order_number ?? ""}`.trim());
      if (fromDetail) { setDetail(res.data); } else { await load(); }
      await loadStats();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.bkActionErr);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(id: string, num: string, fromDetail = false) {
    if (!token) return;
    const ok = await confirm({
      title: s.bkCancelTitle,
      message: s.bkCancelMsg,
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(id);
    try {
      const res = await apiCancelBooking(token, id);
      showToast(`${s.bkCancelledToast} · ${res.data.order_number ?? num}`.trim());
      if (fromDetail) { setDetail(res.data); } else { await load(); }
      await loadStats();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.bkActionErr);
    } finally {
      setBusyId(null);
    }
  }

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (userIdFilter) {
      chips.push({
        key: "user",
        label: `${s.bkChipCustomer} #${userIdFilter}`,
        clear: () => {
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("user_id");
            window.history.replaceState(null, "", url.toString());
            window.location.reload();
          }
        },
      });
    }
    if (statusFilter) {
      const meta = BK_STATUS[statusFilter];
      chips.push({ key: "status", label: `${s.bkChipStatus}: ${meta ? s[meta.labelKey] : titleCase(statusFilter)}`, clear: () => { setPage(1); setStatusFilter(""); } });
    }
    if (serviceFilter) {
      const k = SERVICE_KEY[serviceFilter];
      chips.push({ key: "service", label: `${s.bkChipService}: ${k ? s[k] : titleCase(serviceFilter)}`, clear: () => { setPage(1); setServiceFilter(""); } });
    }
    if (fromDate || toDate) {
      const label = fromDate && toDate ? `${fromDate} → ${toDate}` : fromDate ? `${s.bkChipFrom} ${fromDate}` : `${s.bkChipUntil} ${toDate}`;
      chips.push({ key: "date", label, clear: () => { setPage(1); setFromDate(""); setToDate(""); } });
    }
    if (search.trim()) {
      chips.push({ key: "search", label: `“${search.trim()}”`, clear: () => { setPage(1); setSearch(""); setSearchDraft(""); } });
    }
    return chips;
  }, [userIdFilter, statusFilter, serviceFilter, fromDate, toDate, search, s]);

  function clearAll() {
    setPage(1);
    setStatusFilter("");
    setServiceFilter("");
    setFromDate("");
    setToDate("");
    setSearch("");
    setSearchDraft("");
  }

  const from = meta && meta.total ? (meta.current_page - 1) * meta.per_page + 1 : rows.length ? 1 : 0;
  const to = meta ? Math.min(meta.current_page * meta.per_page, meta.total) : rows.length;
  const total = meta?.total ?? rows.length;

  if (forbidden) {
    return (
      <div className="empty-state">
        <div className="es-icon"><i className="ti ti-lock" /></div>
        <div className="es-title">{s.forbidden}</div>
      </div>
    );
  }

  // ── DETAIL VIEW ────────────────────────────────────────────────────
  if (view === "detail") {
    const b = detail;
    const canConfirm = !!b && ["cart", "pending_payment", "paid", "confirmed"].includes(b.status);
    const canCancel = !!b && !["cancelled", "refunded"].includes(b.status);
    const num = b?.order_number ?? b?.booking_reference ?? (b ? `#${b.id.slice(0, 8)}` : "");
    const sm = b ? BK_STATUS[b.status] : null;
    const items = b?.items ?? [];
    const total2 = b?.total ?? b?.total_amount;
    return (
      <div>
        <button className="btn btn-ghost btn-sm detail-back" onClick={backToList}>
          <i className="ti ti-arrow-left" /> {s.bkBackToList}
        </button>

        {detailLoading || !b ? (
          <div className="empty-state"><div className="es-title">{s.loading}</div></div>
        ) : (
          <>
            <div className="detail-head">
              <div className="detail-logo"><i className="ti ti-calendar-event" /></div>
              <div>
                <div className="detail-title">
                  <span>{s.bkDetailTitle} {num}</span>
                  {sm && <span className={`badge ${sm.cls}`}><i className={`ti ${sm.icon}`} />{s[sm.labelKey]}</span>}
                </div>
                <div className="detail-meta">
                  {s.bkTlCreated} {fmtDateTime(b.created_at)} · <span className="font-mono">#{b.id.slice(0, 8)}</span>
                </div>
              </div>
              <div className="detail-head-right">
                {canConfirm && (
                  <button className="btn btn-sm" disabled={busyId === b.id} onClick={() => void handleConfirm(b.id, true)}>
                    <i className="ti ti-check" /> {s.bkConfirm}
                  </button>
                )}
                {canCancel && (
                  <button className="btn btn-sm btn-danger" disabled={busyId === b.id} onClick={() => void handleCancel(b.id, num, true)}>
                    <i className="ti ti-x" /> {s.bkCancel}
                  </button>
                )}
              </div>
            </div>

            {err && <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}><i className="ti ti-alert-triangle" /><div>{err}</div></div>}

            <div className="detail-card-grid">
              {/* Customer */}
              <div className="card">
                <div className="card-header"><div className="card-title">{s.bkCardCustomer}</div></div>
                <div className="card-body">
                  {b.user ? (
                    <div className="info-grid">
                      <div className="info-row"><span className="info-label">{s.bkCustName}</span><span className="info-value">{b.user.name}</span></div>
                      <div className="info-row"><span className="info-label">{s.bkCustEmail}</span><span className="info-value">{b.user.email ? <a href={`mailto:${b.user.email}`}>{b.user.email}</a> : <span className="cell-muted">—</span>}</span></div>
                      <div className="info-row"><span className="info-label">{s.bkCustId}</span><span className="info-value font-mono">{b.user.id}</span></div>
                    </div>
                  ) : (
                    <div className="note-inline"><i className="ti ti-user-off" /><span>{s.bkCustEmpty}</span></div>
                  )}
                </div>
              </div>

              {/* Financials */}
              <div className="card">
                <div className="card-header"><div className="card-title">{s.bkCardFinancials}</div></div>
                <div className="card-body">
                  <div className="info-grid">
                    <div className="info-row"><span className="info-label">{s.bkFinTotal}</span><span className="info-value font-mono">{money(total2, b.currency)}</span></div>
                    <div className="info-row"><span className="info-label">{s.bkFinCurrency}</span><span className="info-value">{b.currency || "USD"}</span></div>
                    <div className="info-row"><span className="info-label">{s.bkFinReference}</span><span className="info-value font-mono">{num}</span></div>
                  </div>
                </div>
              </div>

              {/* Parties */}
              <div className="card">
                <div className="card-header"><div className="card-title">{s.bkCardParties}</div></div>
                <div className="card-body">
                  <div className="info-grid">
                    <div className="info-row"><span className="info-label">{s.bkPartOperator}</span><span className="info-value">{b.company ? b.company.name : <span className="cell-muted">—</span>}</span></div>
                    <div className="info-row"><span className="info-label">{s.bkPartAgent}</span><span className="info-value">{b.agent_company ? b.agent_company.name : <span className="cell-muted">—</span>}</span></div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="card">
                <div className="card-header"><div className="card-title">{s.bkCardTimeline}</div></div>
                <div className="card-body">
                  <div className="info-grid">
                    <div className="info-row"><span className="info-label">{s.bkTlCreated}</span><span className="info-value">{b.created_at ? fmtDateTime(b.created_at) : <span className="cell-muted">—</span>}</span></div>
                    <div className="info-row"><span className="info-label">{s.bkTlUpdated}</span><span className="info-value">{b.updated_at ? fmtDateTime(b.updated_at) : <span className="cell-muted">—</span>}</span></div>
                  </div>
                </div>
              </div>

              {/* Items — spans both columns */}
              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <div className="card-header">
                  <div className="card-title">{s.bkCardItems}</div>
                  <div className="card-subtitle">{items.length} {s.bkItemsCount}</div>
                </div>
                <div className="card-body">
                  {items.length ? (
                    items.map((it) => (
                      <div className="info-row" key={it.id}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{it.title || `Item #${it.id}`}</div>
                          <div className="text-sm text-secondary">{it.module_type || "—"}{it.offer_id ? ` · offer #${it.offer_id}` : ""}</div>
                        </div>
                        <span className="type-badge">{it.module_type || ""}</span>
                      </div>
                    ))
                  ) : (
                    <div className="note-inline"><i className="ti ti-box-off" /><span>{s.bkItemsEmpty}</span></div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────
  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-calendar-stats" /></div><div className="stat-value">{stats ? stats.total_count.toLocaleString() : "—"}</div><div className="stat-label">{s.bkStatTotal}</div></div>
        <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-clock-hour-4" /></div><div className="stat-value">{stats ? stats.pending_count.toLocaleString() : "—"}</div><div className="stat-label">{s.bkStatPending}{stats && stats.pending_count > 0 ? <> · <span style={{ color: "var(--warning-dark)", fontWeight: 600 }}>{stats.pending_count} {s.bkStatPendingNew}</span></> : null}</div></div>
        <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-circle-check" /></div><div className="stat-value">{stats ? stats.confirmed_count.toLocaleString() : "—"}</div><div className="stat-label">{s.bkStatConfirmed}</div></div>
        <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-cash" /></div><div className="stat-value">{stats ? money(stats.revenue_amount, "USD") : "—"}</div><div className="stat-label">{s.bkStatRevenue}</div></div>
      </div>

      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.bkFilterStatus}</span>
          <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}>
            {STATUSES.map((st) => <option key={st} value={st}>{st ? (BK_STATUS[st] ? s[BK_STATUS[st]!.labelKey] : titleCase(st)) : s.allStatuses}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.bkFilterService}</span>
          <select value={serviceFilter} onChange={(e) => { setPage(1); setServiceFilter(e.target.value); }}>
            {SERVICE_TYPES.map((st) => <option key={st} value={st}>{st ? s[SERVICE_KEY[st]!] : s.allServices}</option>)}
          </select>
        </div>
        <div className="filter-field" style={{ maxWidth: 150 }}>
          <span className="filter-label">{s.bkFilterFrom}</span>
          <input type="date" value={fromDate} onChange={(e) => { setPage(1); setFromDate(e.target.value); }} />
        </div>
        <div className="filter-field" style={{ maxWidth: 150 }}>
          <span className="filter-label">{s.bkFilterTo}</span>
          <input type="date" value={toDate} onChange={(e) => { setPage(1); setToDate(e.target.value); }} />
        </div>
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input type="text" value={searchDraft} placeholder={s.bkSearchPlaceholder}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); setSearch(searchDraft.trim()); } }} />
        </div>
        <button className="btn btn-primary" onClick={() => { setPage(1); setSearch(searchDraft.trim()); }}><i className="ti ti-filter" /> {s.apply}</button>
        {activeChips.length > 0 && <button className="btn" onClick={clearAll}>{s.clear}</button>}
      </div>

      {activeChips.length > 0 && (
        <div className="chip-row">
          {activeChips.map((c) => (
            <span className="chip active" key={c.key}>{c.label} <i className="ti ti-x" style={{ cursor: "pointer" }} onClick={c.clear} /></span>
          ))}
          <button className="chip" onClick={clearAll}>{s.clearAll}</button>
        </div>
      )}

      {err && <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}><i className="ti ti-alert-triangle" /><div>{err}</div></div>}

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>{s.bkColId}</th><th>{s.bkColReference}</th><th>{s.bkColStatus}</th><th>{s.bkColAmount}</th>
              <th>{s.bkColCompany}</th><th>{s.bkColUser}</th><th>{s.bkColOffer}</th><th>{s.bkColCreated}</th>
              <th style={{ textAlign: "right" }}>{s.actions}</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="no-label" style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>{loading ? s.loading : search.trim() || activeChips.length ? s.bkNoMatch : s.bkEmpty}</td></tr>
              ) : (
                rows.map((r) => {
                  const sm = BK_STATUS[r.status];
                  const num = r.order_number ?? r.booking_reference ?? `#${r.id.slice(0, 8)}`;
                  const total2 = r.total ?? r.total_amount;
                  const offer = deriveOffer(r);
                  const canConfirm = r.status === "pending_payment" || r.status === "cart";
                  const canCancel = r.status !== "cancelled" && r.status !== "refunded";
                  return (
                    <tr key={r.id} onClick={() => void openBooking(r.id)} style={{ cursor: "pointer" }}>
                      <td className="font-mono" data-label={s.bkColId}>#{r.id.slice(0, 8)}</td>
                      <td className="m-primary" data-label={s.bkColReference}>
                        <div className="font-mono" style={{ fontWeight: 600 }}>{num}</div>
                        {offer && <div className="text-sm text-secondary">{offer.title} · {offer.type}</div>}
                      </td>
                      <td data-label={s.bkColStatus}>{sm ? <span className={`badge ${sm.cls}`}><i className={`ti ${sm.icon}`} />{s[sm.labelKey]}</span> : <span className="badge badge-gray">{titleCase(r.status)}</span>}</td>
                      <td className="num-cell font-mono" data-label={s.bkColAmount}>{money(total2, r.currency)}</td>
                      <td data-label={s.bkColCompany}>{r.company?.name ? <div className="flex items-center gap-2"><span className={`avatar sm ${avatarTone(r.company.id)}`}>{initials(r.company.name)}</span><span>{r.company.name}</span></div> : <span className="cell-muted">—</span>}</td>
                      <td data-label={s.bkColUser}>{r.user?.name ? <div className="flex items-center gap-2"><span className={`avatar sm ${avatarTone(r.user.id)}`}>{initials(r.user.name)}</span><span>{r.user.name}</span></div> : <span className="cell-muted">—</span>}</td>
                      <td className="cell-muted" data-label={s.bkColOffer}>{offer ? `${offer.title} (${offer.type})` : "—"}</td>
                      <td className="cell-muted" data-label={s.bkColCreated} title={fmtDateTime(r.created_at)}>{formatRelativeTime(r.created_at)}</td>
                      <td className="no-label">
                        <div className="row-actions">
                          {canConfirm && <button className="icon-btn" title={s.bkConfirm} disabled={busyId === r.id} onClick={(e) => { e.stopPropagation(); void handleConfirm(r.id); }}><i className="ti ti-check" /></button>}
                          {canCancel && <button className="icon-btn danger" title={s.bkCancel} disabled={busyId === r.id} onClick={(e) => { e.stopPropagation(); void handleCancel(r.id, num); }}><i className="ti ti-x" /></button>}
                          <button className="icon-btn" title={s.bkView} onClick={(e) => { e.stopPropagation(); void openBooking(r.id); }}><i className="ti ti-eye" /></button>
                          <button className="icon-btn" title={s.bkMore} onClick={(e) => e.stopPropagation()}><i className="ti ti-dots" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span className="pagination-info">{s.showing} {from}–{to} {s.of} {total}</span>
          <div className="pagination-controls">
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><i className="ti ti-chevron-left" /></button>
            <button className="btn btn-sm btn-primary">{page}</button>
            <button className="btn btn-sm" disabled={!meta || page >= meta.last_page} onClick={() => setPage((p) => p + 1)}><i className="ti ti-chevron-right" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
