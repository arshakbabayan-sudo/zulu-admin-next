"use client";

/**
 * Package orders pane — 1:1 port of #pane-packages in bookings.html.
 *
 * List view (stat-grid + filter-card + chip-row + DUAL-status table +
 * pagination) plus a read-only right-side `.drawer` built straight from the
 * already-loaded row (there is no GET /package-orders/{id} endpoint). Package
 * orders carry no status transitions on this page (read-only). Wiring:
 * apiPlatformPackageOrders (lib/platform-admin-api) + apiPackageOrdersStats
 * (lib/bookings-stats-api). Status / payment / company filters are server-side;
 * search is client-side over the loaded page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiPlatformPackageOrders, type PlatformPackageOrderRow } from "@/lib/platform-admin-api";
import { apiPackageOrdersStats, type PackageOrdersStats } from "@/lib/bookings-stats-api";
import { formatRelativeTime } from "@/lib/admin-v2-helpers";
import { bookingsStrings } from "../bookings-i18n";
import { PO_STATUS, PO_PAY, avatarTone, initials, money, fmtDateTime, titleCase } from "../bookings-helpers";
import type { BookingsPaneProps } from "../types";

const ORDER_STATUSES = ["", "pending", "pending_payment", "confirmed", "partially_confirmed", "in_progress", "completed", "fulfilled", "cancelled", "failed"];
const PAYMENT_STATUSES = ["", "paid", "captured", "pending", "authorized", "partial", "failed", "refunded", "voided"];
const PER_PAGE = 20;

function exportCsv(rows: PlatformPackageOrderRow[]): void {
  if (rows.length === 0) return;
  const headers = ["id", "order_number", "status", "payment_status", "currency", "final_total", "package_title", "package_type", "destination", "buyer_name", "buyer_email", "company", "created_at"];
  const esc = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [r.id, r.order_number, r.status, r.payment_status, r.currency, r.final_total_snapshot, r.package?.package_title ?? "", r.package?.package_type ?? "", [r.package?.destination_city, r.package?.destination_country].filter(Boolean).join(", "), r.user?.name ?? "", r.user?.email ?? "", r.company?.name ?? "", r.created_at ?? ""]
        .map(esc)
        .join(","),
    );
  }
  const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
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

export function PackageOrdersPane({ token, lang, registerAction, reportCount, setCrumbOverride, showToast }: BookingsPaneProps) {
  const s = bookingsStrings(lang);

  const [rows, setRows] = useState<PlatformPackageOrderRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [stats, setStats] = useState<PackageOrdersStats | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [companyIdDraft, setCompanyIdDraft] = useState("");
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [drawer, setDrawer] = useState<PlatformPackageOrderRow | null>(null);

  const rowsRef = useRef<PlatformPackageOrderRow[]>(rows);
  rowsRef.current = rows;

  useEffect(() => { setCrumbOverride(null); }, [setCrumbOverride]);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await apiPlatformPackageOrders(token, {
        page,
        per_page: PER_PAGE,
        status: statusFilter || undefined,
        payment_status: paymentFilter || undefined,
        company_id: companyId,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : s.errLoad);
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, paymentFilter, companyId, s.errLoad]);

  useEffect(() => { void load(); }, [load]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiPackageOrdersStats(token, "30d");
      setStats(res.data);
      reportCount(res.data.total_count);
    } catch { setStats(null); }
  }, [token, reportCount]);

  useEffect(() => { void loadStats(); }, [loadStats]);

  useEffect(() => {
    registerAction(
      <>
        <button className="btn btn-sm" title={s.refresh} onClick={() => { void load(); }}><i className="ti ti-refresh" /></button>
        <button className="btn btn-primary" onClick={() => { exportCsv(rowsRef.current); showToast(s.poExportedToast); }}><i className="ti ti-download" /> {s.exportShort}</button>
      </>,
    );
  }, [registerAction, load, s, showToast]);

  function applyCompanyFilter() {
    const raw = companyIdDraft.trim();
    if (!raw) { setCompanyId(undefined); setPage(1); return; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) { setCompanyId(undefined); setPage(1); return; }
    setCompanyId(n);
    setPage(1);
  }

  // client-side search across order_number / package title / buyer / company
  const shown = search.trim()
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

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (statusFilter) {
      const m = PO_STATUS[statusFilter];
      chips.push({ key: "status", label: `${s.poChipOrder}: ${m ? s[m.labelKey] : titleCase(statusFilter)}`, clear: () => { setPage(1); setStatusFilter(""); } });
    }
    if (paymentFilter) {
      const m = PO_PAY[paymentFilter];
      chips.push({ key: "payment", label: `${s.poChipPayment}: ${m ? s[m.labelKey] : titleCase(paymentFilter)}`, clear: () => { setPage(1); setPaymentFilter(""); } });
    }
    if (companyId != null) {
      chips.push({ key: "company", label: `${s.poChipCompany} #${companyId}`, clear: () => { setPage(1); setCompanyId(undefined); setCompanyIdDraft(""); } });
    }
    if (search.trim()) {
      chips.push({ key: "search", label: `“${search.trim()}”`, clear: () => setSearch("") });
    }
    return chips;
  }, [statusFilter, paymentFilter, companyId, search, s]);

  function clearAll() {
    setPage(1);
    setStatusFilter("");
    setPaymentFilter("");
    setCompanyId(undefined);
    setCompanyIdDraft("");
    setSearch("");
  }

  const total = meta?.total ?? shown.length;
  const from = meta && meta.total ? (meta.current_page - 1) * meta.per_page + 1 : shown.length ? 1 : 0;
  const to = meta ? Math.min(meta.current_page * meta.per_page, meta.total) : shown.length;

  if (forbidden) {
    return (
      <div className="empty-state">
        <div className="es-icon"><i className="ti ti-lock" /></div>
        <div className="es-title">{s.forbidden}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-package" /></div><div className="stat-value">{stats ? stats.total_count.toLocaleString() : "—"}</div><div className="stat-label">{s.poStatTotal}</div></div>
        <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-circle-check" /></div><div className="stat-value">{stats ? stats.paid_count.toLocaleString() : "—"}</div><div className="stat-label">{s.poStatPaid}</div></div>
        <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-clock-dollar" /></div><div className="stat-value">{stats ? stats.pending_count.toLocaleString() : "—"}</div><div className="stat-label">{s.poStatPending}</div></div>
        <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-cash" /></div><div className="stat-value">{stats ? money(stats.total_value, "USD") : "—"}</div><div className="stat-label">{s.poStatValue}</div></div>
      </div>

      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.poFilterOrderStatus}</span>
          <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}>
            {ORDER_STATUSES.map((st) => <option key={st} value={st}>{st ? (PO_STATUS[st] ? s[PO_STATUS[st]!.labelKey] : titleCase(st)) : s.allStatuses}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.poFilterPaymentStatus}</span>
          <select value={paymentFilter} onChange={(e) => { setPage(1); setPaymentFilter(e.target.value); }}>
            {PAYMENT_STATUSES.map((st) => <option key={st} value={st}>{st ? (PO_PAY[st] ? s[PO_PAY[st]!.labelKey] : titleCase(st)) : s.allPayments}</option>)}
          </select>
        </div>
        <div className="filter-field" style={{ maxWidth: 160 }}>
          <span className="filter-label">{s.poFilterCompanyId}</span>
          <input type="number" value={companyIdDraft} placeholder={s.poCompanyPlaceholder}
            onChange={(e) => setCompanyIdDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyCompanyFilter(); }} />
        </div>
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input type="text" value={search} placeholder={s.poSearchPlaceholder} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={applyCompanyFilter}><i className="ti ti-filter" /> {s.apply}</button>
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
              <th>{s.poColId}</th><th>{s.poColOrderNumber}</th><th>{s.poColStatus}</th><th>{s.poColPayment}</th>
              <th>{s.poColTotal}</th><th>{s.poColPackage}</th><th>{s.poColCompany}</th><th>{s.poColBuyer}</th>
              <th>{s.poColCreated}</th><th style={{ textAlign: "right" }}>{s.actions}</th>
            </tr></thead>
            <tbody>
              {shown.length === 0 ? (
                <tr><td colSpan={10} className="no-label" style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>{loading ? s.loading : search.trim() || activeChips.length ? s.poNoMatch : s.poEmpty}</td></tr>
              ) : (
                shown.map((r) => {
                  const om = PO_STATUS[r.status];
                  const pm = PO_PAY[r.payment_status];
                  const pid = `PO-${String(r.id).padStart(4, "0")}`;
                  const dest = r.package?.destination_city || r.package?.destination_country || "—";
                  const companyName = r.company?.name ?? `#${r.company_id}`;
                  const buyerName = r.user?.name ?? `#${r.user_id}`;
                  return (
                    <tr key={r.id} onClick={() => setDrawer(r)} style={{ cursor: "pointer" }}>
                      <td className="font-mono" data-label={s.poColId}>{pid}</td>
                      <td className="m-primary" data-label={s.poColOrderNumber}>
                        <div className="font-mono" style={{ fontWeight: 600 }}>{r.order_number}</div>
                        <div className="text-sm text-secondary">{r.adults_count}A · {r.children_count}C · {r.infants_count}I</div>
                      </td>
                      <td data-label={s.poColStatus}>{om ? <span className={`badge ${om.cls}`}><i className={`ti ${om.icon}`} />{s[om.labelKey]}</span> : <span className="badge badge-gray">{titleCase(r.status)}</span>}</td>
                      <td data-label={s.poColPayment}>{pm ? <span className={`badge ${pm.cls}`}><i className={`ti ${pm.icon}`} />{s[pm.labelKey]}</span> : <span className="badge badge-gray">{titleCase(r.payment_status)}</span>}</td>
                      <td className="num-cell font-mono" data-label={s.poColTotal}>{money(r.final_total_snapshot, r.currency)}</td>
                      <td data-label={s.poColPackage}>
                        <div style={{ fontWeight: 500 }}>{r.package?.package_title ?? `#${r.package_id}`}</div>
                        {r.package?.duration_days ? <div className="text-sm text-secondary">{r.package.duration_days} {s.poDays} · {dest}</div> : null}
                      </td>
                      <td data-label={s.poColCompany}><div className="flex items-center gap-2"><span className={`avatar sm ${avatarTone(r.company_id)}`}>{initials(companyName)}</span><span>{companyName}</span></div></td>
                      <td data-label={s.poColBuyer}><div className="flex items-center gap-2"><span className={`avatar sm ${avatarTone(r.user_id)}`}>{initials(buyerName)}</span><span>{buyerName}</span></div></td>
                      <td className="cell-muted" data-label={s.poColCreated} title={fmtDateTime(r.created_at)}>{formatRelativeTime(r.created_at)}</td>
                      <td className="no-label">
                        <div className="row-actions">
                          <button className="icon-btn" title={s.poView} onClick={(e) => { e.stopPropagation(); setDrawer(r); }}><i className="ti ti-eye" /></button>
                          {r.payment_status === "failed" && <button className="icon-btn" title={s.poRetry} onClick={(e) => e.stopPropagation()}><i className="ti ti-refresh" /></button>}
                          <button className="icon-btn" title={s.poMore} onClick={(e) => e.stopPropagation()}><i className="ti ti-dots" /></button>
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

      {/* read-only package-order drawer (built from the row) */}
      <div className={`drawer-overlay ${drawer ? "open" : ""}`} onClick={() => setDrawer(null)} />
      <div className={`drawer ${drawer ? "open" : ""}`}>
        {drawer && (
          <>
            <div className="drawer-header">
              <div>
                <div className="card-title">{s.poDrawerTitle} {drawer.order_number}</div>
                <div className="card-subtitle font-mono">PO-{String(drawer.id).padStart(4, "0")}</div>
              </div>
              <button className="icon-btn" onClick={() => setDrawer(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="drawer-body">
              <div className="drawer-section">{s.poDrwOrder}</div>
              <div className="info-grid">
                <div className="info-row"><span className="info-label">{s.poDID}</span><span className="info-value font-mono">PO-{String(drawer.id).padStart(4, "0")}</span></div>
                <div className="info-row"><span className="info-label">{s.poDOrderNumber}</span><span className="info-value font-mono">{drawer.order_number}</span></div>
                <div className="info-row"><span className="info-label">{s.poDStatus}</span><span className="info-value">{PO_STATUS[drawer.status] ? <span className={`badge ${PO_STATUS[drawer.status]!.cls}`}><i className={`ti ${PO_STATUS[drawer.status]!.icon}`} />{s[PO_STATUS[drawer.status]!.labelKey]}</span> : titleCase(drawer.status)}</span></div>
                <div className="info-row"><span className="info-label">{s.poDPayment}</span><span className="info-value">{PO_PAY[drawer.payment_status] ? <span className={`badge ${PO_PAY[drawer.payment_status]!.cls}`}><i className={`ti ${PO_PAY[drawer.payment_status]!.icon}`} />{s[PO_PAY[drawer.payment_status]!.labelKey]}</span> : titleCase(drawer.payment_status)}</span></div>
                <div className="info-row"><span className="info-label">{s.poDTotal}</span><span className="info-value font-mono">{money(drawer.final_total_snapshot, drawer.currency)}</span></div>
                <div className="info-row"><span className="info-label">{s.poDTravellers}</span><span className="info-value">{drawer.adults_count}A · {drawer.children_count}C · {drawer.infants_count}I</span></div>
                {drawer.booking_channel ? <div className="info-row"><span className="info-label">{s.poDChannel}</span><span className="info-value">{titleCase(drawer.booking_channel)}</span></div> : null}
                <div className="info-row"><span className="info-label">{s.poDCreated}</span><span className="info-value">{fmtDateTime(drawer.created_at)}</span></div>
              </div>

              <div className="drawer-section">{s.poDrwPackage}</div>
              <div className="info-grid">
                <div className="info-row"><span className="info-label">{s.poDTitle}</span><span className="info-value">{drawer.package?.package_title ?? `#${drawer.package_id}`}</span></div>
                {drawer.package?.package_type ? <div className="info-row"><span className="info-label">{s.poDType}</span><span className="info-value">{titleCase(drawer.package.package_type)}</span></div> : null}
                {drawer.package?.duration_days ? <div className="info-row"><span className="info-label">{s.poDDuration}</span><span className="info-value">{drawer.package.duration_days} {s.poDays}</span></div> : null}
                {drawer.package?.destination_city || drawer.package?.destination_country ? <div className="info-row"><span className="info-label">{s.poDDestination}</span><span className="info-value">{[drawer.package?.destination_city, drawer.package?.destination_country].filter(Boolean).join(", ")}</span></div> : null}
              </div>

              <div className="drawer-section">{s.poDrwBuyer}</div>
              <div className="info-grid">
                <div className="info-row"><span className="info-label">{s.poDName}</span><span className="info-value">{drawer.user?.name ?? `#${drawer.user_id}`}</span></div>
                {drawer.user?.email ? <div className="info-row"><span className="info-label">{s.poDEmail}</span><span className="info-value">{drawer.user.email}</span></div> : null}
              </div>

              <div className="drawer-section">{s.poDrwCompany}</div>
              <div className="info-grid">
                <div className="info-row"><span className="info-label">{s.poDName}</span><span className="info-value">{drawer.company?.name ?? `#${drawer.company_id}`}</span></div>
              </div>

              <div className="alert"><i className="ti ti-info-circle" /><div>{s.poReadonlyNote}</div></div>
            </div>
            <div className="drawer-footer">
              <button className="btn" onClick={() => setDrawer(null)}>{s.poClose}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
