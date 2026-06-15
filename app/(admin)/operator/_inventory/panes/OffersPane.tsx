"use client";

/**
 * Offers pane — 1:1 port of #pane-offers in inventory.html.
 *
 * Read-only layer: offers are created at the module level (Hotels, Flights, …).
 * Here you only PUBLISH (draft → published) or ARCHIVE (archive-only — no
 * delete; cascades the module status). Row click opens a read-only drawer;
 * the language icon opens the shared TranslationsModal.
 *
 * Wiring: apiOffers / apiPublishOffer / apiArchiveOffer (inventory-crud-api).
 * `type` filters server-side; `status` is frontend-only (OfferController.index
 * only honors type) → applied client-side over the fetched page.
 */

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiOffers, apiPublishOffer, apiArchiveOffer, type OfferRow } from "@/lib/inventory-crud-api";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { TranslationsModal } from "@/components/TranslationsModal";
import { inventoryStrings } from "../inventory-i18n";
import type { InventoryPaneProps } from "../types";

const STATUSES = ["", "draft", "pending_review", "published", "rejected", "archived"];
const TYPES = ["", "hotel", "flight", "transfer", "car", "excursion", "visa", "package"];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "published":
    case "active":
      return "badge-success";
    case "pending_review":
      return "badge-info";
    case "draft":
      return "badge-gray";
    case "rejected":
      return "badge-danger";
    case "archived":
      return "badge-warning";
    default:
      return "badge-gray";
  }
}

export function OffersPane({ token, lang, showToast }: InventoryPaneProps) {
  const s = inventoryStrings(lang);
  const confirm = useConfirm();

  const [rows, setRows] = useState<OfferRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [drawer, setDrawer] = useState<OfferRow | null>(null);
  const [translateRow, setTranslateRow] = useState<OfferRow | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      // type filters server-side; status is applied client-side (frontend-only).
      const res = await apiOffers(token, { page, per_page: 20, type: typeFilter || undefined });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page, typeFilter]);

  useEffect(() => { void load(); }, [load]);

  const shown = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;

  async function handlePublish(r: OfferRow) {
    if (!token) return;
    const ok = await confirm({ message: s.offPublishConfirm });
    if (!ok) return;
    setBusyId(r.id);
    try { await apiPublishOffer(token, r.id); setDrawer(null); showToast(s.offPublish); await load(); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  async function handleArchive(r: OfferRow) {
    if (!token) return;
    const ok = await confirm({ message: s.offArchiveConfirm, variant: "danger" });
    if (!ok) return;
    setBusyId(r.id);
    try { await apiArchiveOffer(token, r.id); setDrawer(null); showToast(s.offArchive); await load(); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  const total = meta?.total ?? shown.length;
  const published = rows.filter((r) => r.status === "published").length;
  const pending = rows.filter((r) => r.status === "pending_review").length;
  const archived = rows.filter((r) => r.status === "archived").length;
  const from = shown.length ? (page - 1) * 20 + 1 : 0;
  const to = (page - 1) * 20 + shown.length;

  return (
    <div>
      <div className="alert oversight-note">
        <i className="ti ti-info-circle" />
        <div><strong>{s.scopeOversight}.</strong> {s.extNoOversight}</div>
      </div>
      <div className="alert">
        <i className="ti ti-eye" />
        <div>{s.offReadonly}</div>
      </div>

      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.offFilterStatus}</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUSES.map((st) => <option key={st} value={st}>{st || s.offAllStatuses}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.offFilterType}</span>
          <select value={typeFilter} onChange={(e) => { setPage(1); setTypeFilter(e.target.value); }}>
            {TYPES.map((tp) => <option key={tp} value={tp}>{tp || s.offAllTypes}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => void load()}><i className="ti ti-filter" />{s.apply}</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-tag" /></div><div className="stat-value">{total}</div><div className="stat-label">{s.statTotal}</div></div>
        <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-circle-check" /></div><div className="stat-value">{published}</div><div className="stat-label">{s.statPublished}</div></div>
        <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-clock" /></div><div className="stat-value">{pending}</div><div className="stat-label">{s.statPending}</div></div>
        <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-archive" /></div><div className="stat-value">{archived}</div><div className="stat-label">{s.statArchived}</div></div>
      </div>

      {err && <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}><i className="ti ti-alert-triangle" /><div>{err}</div></div>}

      <div className="card">
        <div className="card-header"><div><div className="card-title">{s.offCardTitle}</div><div className="card-subtitle">{s.offCardSub}</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>{s.id}</th><th>{s.offColTitle}</th><th>{s.offColType}</th><th>{s.offColPrice}</th>
              <th>{s.status}</th><th>{s.company}</th><th style={{ textAlign: "right" }}>{s.actions}</th>
            </tr></thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={7} className="no-label" style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>{s.offEmpty}</td></tr>
              )}
              {shown.map((r) => (
                <tr key={r.id} onClick={() => setDrawer(r)}>
                  <td className="font-mono m-primary" data-label={s.id}>#{r.id}</td>
                  <td className="font-semibold" data-label={s.offColTitle}>{r.title ?? "—"}</td>
                  <td data-label={s.offColType}><span className="type-badge">{r.type ?? "—"}</span></td>
                  <td className="font-mono" data-label={s.offColPrice}>{r.price != null ? `${r.currency ?? ""} ${Number(r.price).toFixed(2)}` : "—"}</td>
                  <td data-label={s.status}><span className={`badge ${statusBadgeClass(r.status ?? "")}`}>{r.status ?? "—"}</span></td>
                  <td className="cell-muted" data-label={s.company}>{r.company?.name ?? r.company_id ?? "—"}</td>
                  <td className="no-label">
                    <div className="row-actions">
                      {(r.status === "draft" || r.status === "rejected") && (
                        <button className="icon-btn" title={s.offPublish} disabled={busyId === r.id}
                          onClick={(e) => { e.stopPropagation(); void handlePublish(r); }}><i className="ti ti-rocket" /></button>
                      )}
                      <button className="icon-btn" title={s.offTranslations}
                        onClick={(e) => { e.stopPropagation(); setTranslateRow(r); }}><i className="ti ti-language" /></button>
                      <button className="icon-btn danger" title={s.offArchive} disabled={busyId === r.id}
                        onClick={(e) => { e.stopPropagation(); void handleArchive(r); }}><i className="ti ti-archive" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span className="pagination-info">{s.showing} {from}–{to} {s.of} {total}</span>
          <div className="pagination-controls">
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{s.prev}</button>
            <button className="btn btn-sm btn-primary">{page}</button>
            <button className="btn btn-sm" disabled={!meta || page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>{s.next}</button>
          </div>
        </div>
      </div>

      {/* read-only offer drawer */}
      <div className={`drawer-overlay ${drawer ? "open" : ""}`} onClick={() => setDrawer(null)} />
      <div className={`drawer ${drawer ? "open" : ""}`}>
        {drawer && (
          <>
            <div className="drawer-header">
              <div><div className="card-title">{drawer.title ?? "—"}</div><div className="card-subtitle"><span className="font-mono">#{drawer.id}</span></div></div>
              <button className="icon-btn" onClick={() => setDrawer(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="drawer-body">
              <div className="drawer-section">{s.tabOffers}</div>
              <div className="info-grid">
                <div className="info-row"><span className="info-label">{s.offColType}</span><span className="info-value"><span className="type-badge">{drawer.type ?? "—"}</span></span></div>
                <div className="info-row"><span className="info-label">{s.status}</span><span className="info-value"><span className={`badge ${statusBadgeClass(drawer.status ?? "")}`}>{drawer.status ?? "—"}</span></span></div>
                <div className="info-row"><span className="info-label">{s.offColPrice}</span><span className="info-value font-mono">{drawer.price != null ? `${drawer.currency ?? ""} ${Number(drawer.price).toFixed(2)}` : "—"}</span></div>
                <div className="info-row"><span className="info-label">{s.offDrawerModule}</span><span className="info-value cell-muted text-sm">{s.offDrawerModuleNote}</span></div>
              </div>
              <div className="alert"><i className="ti ti-info-circle" /><div>{s.offDrawerReadonly}</div></div>
            </div>
            <div className="drawer-footer">
              <button className="btn" onClick={() => setDrawer(null)}>{s.offClose}</button>
              <button className="btn btn-danger" disabled={busyId === drawer.id} onClick={() => void handleArchive(drawer)}><i className="ti ti-archive" />{s.offArchive}</button>
              {(drawer.status === "draft" || drawer.status === "rejected") && (
                <button className="btn btn-primary" disabled={busyId === drawer.id} onClick={() => void handlePublish(drawer)}><i className="ti ti-rocket" />{s.offPublish}</button>
              )}
            </div>
          </>
        )}
      </div>

      <TranslationsModal
        open={translateRow !== null}
        onClose={() => setTranslateRow(null)}
        entityType="offer"
        entityId={translateRow?.id ?? null}
        entityLabel={translateRow?.title ?? undefined}
        fields={[
          { name: "title", label: "Title" },
          { name: "subtitle", label: "Subtitle" },
          { name: "description", label: "Description", multiline: true },
        ]}
      />
    </div>
  );
}
