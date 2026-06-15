"use client";

/**
 * External API pane — 1:1 port of #pane-external-api in inventory.html.
 *
 * Operator connects external supplier inventory bases (HTTP Basic Auth), tests
 * connectivity, and imports DRAFT offers (hotel / car / transfer) with a
 * per-item skip report. Disconnect removes the connection but never the
 * imported inventory. Read-only list + create form (no edit).
 *
 * Wiring: apiSupplierConnections / apiCreate / apiTest / apiImport / apiDelete
 * (supplier-connections-api).
 */

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiCreateSupplierConnection,
  apiDeleteSupplierConnection,
  apiImportSupplierConnection,
  apiSupplierConnections,
  apiTestSupplierConnection,
  type SupplierConnectionRow,
  type SupplierImportSummary,
} from "@/lib/supplier-connections-api";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { inventoryStrings } from "../inventory-i18n";
import type { InventoryPaneProps } from "../types";

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

function statusBadgeClass(status: SupplierConnectionRow["status"]): string {
  return status === "ok" ? "badge-success" : status === "failed" ? "badge-danger" : "badge-gray";
}

export function ExternalApiPane({ token, lang, registerAction, showToast }: InventoryPaneProps) {
  const s = inventoryStrings(lang);
  const confirm = useConfirm();

  const [rows, setRows] = useState<SupplierConnectionRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "create">("list");

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [lastSummary, setLastSummary] = useState<{ name: string; summary: SupplierImportSummary } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const res = await apiSupplierConnections(token);
      setRows(res.data ?? []);
    } catch (e) {
      setRows([]);
      setErr(e instanceof ApiRequestError ? e.message : s.extErrLoad);
    }
  }, [token, s.extErrLoad]);

  useEffect(() => { void load(); }, [load]);

  // top-right "+ New connection" CTA — only in list view (hidden in create).
  useEffect(() => {
    if (view === "list") {
      registerAction(
        <button className="btn btn-primary" onClick={() => { setView("create"); setFormErr(null); }}>
          <i className="ti ti-plus" />{s.extNew}
        </button>
      );
    } else {
      registerAction(null);
    }
    return () => registerAction(null);
  }, [view, registerAction, s.extNew]);

  async function handleCreate() {
    if (!token) return;
    if (!baseUrl.trim() || !login.trim() || !password.trim()) { setFormErr(s.extFillRequired); return; }
    setBusy(true);
    setFormErr(null);
    try {
      await apiCreateSupplierConnection(token, {
        name: name.trim() || undefined,
        base_url: baseUrl.trim(),
        login: login.trim(),
        password,
      });
      setName(""); setBaseUrl(""); setLogin(""); setPassword("");
      setView("list");
      showToast(s.extCreatedToast);
      await load();
    } catch (e) {
      setFormErr(e instanceof ApiRequestError ? e.message : s.extErrSave);
    } finally { setBusy(false); }
  }

  async function handleTest(id: number) {
    if (!token) return;
    setActionBusyId(id);
    try { await apiTestSupplierConnection(token, id); showToast(s.extTestedToast); await load(); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : s.extErrAction); }
    finally { setActionBusyId(null); }
  }

  async function handleImport(row: SupplierConnectionRow) {
    if (!token) return;
    setActionBusyId(row.id);
    try {
      const res = await apiImportSupplierConnection(token, row.id);
      setLastSummary({ name: row.name, summary: res.data.summary });
      showToast(s.extImportedToast);
      await load();
    } catch (e) { setErr(e instanceof ApiRequestError ? e.message : s.extErrAction); }
    finally { setActionBusyId(null); }
  }

  async function handleDisconnect(row: SupplierConnectionRow) {
    if (!token) return;
    const ok = await confirm({ message: s.extDisconnectConfirm, variant: "danger" });
    if (!ok) return;
    setActionBusyId(row.id);
    try {
      await apiDeleteSupplierConnection(token, row.id);
      setLastSummary((p) => (p && p.name === row.name ? null : p));
      showToast(s.extDisconnectedToast);
      await load();
    } catch (e) { setErr(e instanceof ApiRequestError ? e.message : s.extErrAction); }
    finally { setActionBusyId(null); }
  }

  const list = rows ?? [];
  const connected = list.filter((r) => r.status === "ok").length;
  const failed = list.filter((r) => r.status === "failed").length;
  const itemsImported = list.reduce((sum, r) => sum + (r.items_imported ?? 0), 0);

  if (view === "create") {
    return (
      <div>
        <button className="btn btn-ghost detail-back" onClick={() => setView("list")}><i className="ti ti-arrow-left" />{s.extBack}</button>
        <div className="detail-head">
          <div className="detail-logo"><i className="ti ti-plug-connected" /></div>
          <div><div className="detail-title">{s.extDetailTitle}</div><div className="detail-meta">{s.extDetailMeta}</div></div>
        </div>
        <div className="card"><div className="card-body">
          <div className="form-section"><i className="ti ti-settings" />{s.extDetailSection}</div>
          <div className="form-grid">
            <div className="fld span-2">
              <label className="fld-label">{s.extFieldName}</label>
              <input type="text" value={name} placeholder={s.extFieldNamePh} onChange={(e) => setName(e.target.value)} />
              <span className="fld-hint">{s.extFieldNameHint}</span>
            </div>
            <div className="fld span-2">
              <label className="fld-label">{s.extFieldBaseUrl} <span style={{ color: "var(--danger)" }}>*</span></label>
              <input type="url" value={baseUrl} placeholder={s.extFieldBaseUrlPh} onChange={(e) => setBaseUrl(e.target.value)} />
              <span className="fld-hint">{s.extFieldBaseUrlHint}</span>
            </div>
            <div className="fld">
              <label className="fld-label">{s.extFieldLogin} <span style={{ color: "var(--danger)" }}>*</span></label>
              <input type="text" autoComplete="off" value={login} placeholder="api-login" onChange={(e) => setLogin(e.target.value)} />
              <span className="fld-hint">{s.extFieldLoginHint}</span>
            </div>
            <div className="fld">
              <label className="fld-label">{s.extFieldPassword} <span style={{ color: "var(--danger)" }}>*</span></label>
              <input type="password" autoComplete="new-password" value={password} placeholder="••••••••" onChange={(e) => setPassword(e.target.value)} />
              <span className="fld-hint">{s.extFieldPasswordHint}</span>
            </div>
          </div>
          {formErr && <div className="help-row" style={{ color: "var(--danger-dark)" }}><i className="ti ti-alert-triangle" />{formErr}</div>}
        </div></div>
        <div className="card"><div className="card-foot">
          <button className="btn btn-ghost" onClick={() => setView("list")}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void handleCreate()}><i className="ti ti-plus" />{busy ? s.saving : s.extCreate}</button>
        </div></div>
      </div>
    );
  }

  return (
    <div>
      <div className="alert oversight-note"><i className="ti ti-info-circle" /><div><strong>{s.scopeOversight}.</strong> {s.extNoOversight}</div></div>

      <div className="stat-grid">
        <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-plug-connected" /></div><div className="stat-value">{list.length}</div><div className="stat-label">{s.statConnections}</div></div>
        <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-circle-check" /></div><div className="stat-value">{connected}</div><div className="stat-label">{s.statConnected}</div></div>
        <div className="stat-card c-danger"><div className="stat-header"><i className="ti ti-alert-triangle" /></div><div className="stat-value">{failed}</div><div className="stat-label">{s.statFailed}</div></div>
        <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-download" /></div><div className="stat-value">{itemsImported}</div><div className="stat-label">{s.statItemsImported}</div></div>
      </div>

      {err && <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}><i className="ti ti-alert-triangle" /><div>{err}</div></div>}

      <div className="card">
        <div className="card-header"><div><div className="card-title">{s.extCardTitle}</div><div className="card-subtitle">{s.extCardSub}</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>{s.extColName}</th><th>{s.status}</th><th>{s.extColBaseUrl}</th><th>{s.extColLogin}</th>
              <th>{s.extColLastTested}</th><th>{s.extColLastSynced}</th><th>{s.extColItems}</th>
              <th style={{ textAlign: "right" }}>{s.actions}</th>
            </tr></thead>
            <tbody>
              {rows === null && <tr><td colSpan={8} className="no-label" style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>{s.loading}</td></tr>}
              {rows !== null && list.length === 0 && <tr><td colSpan={8} className="no-label" style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>{s.extEmpty}</td></tr>}
              {list.map((row) => {
                const rowBusy = actionBusyId === row.id;
                return (
                  <tr key={row.id}>
                    <td className="font-semibold m-primary" data-label={s.extColName}>{row.name}{row.company_name ? <div className="text-sm cell-muted">{row.company_name}</div> : null}</td>
                    <td data-label={s.status}><span className={`badge ${statusBadgeClass(row.status)}`}>{row.status === "ok" ? s.extStatusOk : row.status === "failed" ? s.extStatusFailed : s.extStatusUntested}</span></td>
                    <td className="font-mono text-sm" data-label={s.extColBaseUrl}>{row.base_url}</td>
                    <td className="font-mono" data-label={s.extColLogin}>{row.login}</td>
                    <td className="font-mono text-sm" data-label={s.extColLastTested}>{fmtWhen(row.last_tested_at)}</td>
                    <td className="font-mono text-sm" data-label={s.extColLastSynced}>{fmtWhen(row.last_synced_at)}</td>
                    <td className="font-mono" data-label={s.extColItems}>{row.items_imported}</td>
                    <td className="no-label">
                      <div className="row-actions">
                        <button className="icon-btn" title={s.extTest} disabled={rowBusy} onClick={() => void handleTest(row.id)}><i className="ti ti-plug-connected" /></button>
                        <button className="icon-btn" title={row.status === "ok" ? s.extImport : s.extImportTestFirst} disabled={rowBusy || row.status !== "ok"} onClick={() => void handleImport(row)}><i className="ti ti-download" /></button>
                        <button className="icon-btn danger" title={s.extDisconnect} disabled={rowBusy} onClick={() => void handleDisconnect(row)}><i className="ti ti-trash" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {lastSummary && (
        <div className="card import-summary show">
          <div className="card-header">
            <div><div className="card-title">{s.extImportSummary}</div><div className="card-subtitle"><span className="font-mono">{lastSummary.name}</span> · {s.extImportSummarySub}</div></div>
            <span className={`badge ${lastSummary.summary.ok ? "badge-success" : "badge-danger"}`}>{lastSummary.summary.ok ? s.extStatusOk : s.extStatusFailed}</span>
          </div>
          <div className="card-body">
            <div className="stat-grid">
              <div className="stat-card"><div className="stat-label">{s.extCreated}</div><div className="stat-value">{lastSummary.summary.created}</div></div>
              <div className="stat-card"><div className="stat-label">{s.extUpdated}</div><div className="stat-value">{lastSummary.summary.updated}</div></div>
              <div className="stat-card"><div className="stat-label">{s.extSkipped}</div><div className="stat-value">{lastSummary.summary.skipped.length}</div></div>
              <div className="stat-card"><div className="stat-label">{s.extTotalSeen}</div><div className="stat-value">{lastSummary.summary.total_seen}</div></div>
            </div>
            {lastSummary.summary.skipped.length > 0 && (
              <>
                <div className="form-section"><i className="ti ti-alert-triangle" />{s.extSkippedItems}</div>
                {lastSummary.summary.skipped.map((sk, i) => (
                  <div className="skip-line" key={i}><span className="font-mono">{sk.type} · {sk.external_id}</span> — {sk.reason}</div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <div className="alert demo-base"><i className="ti ti-flask" /><div>{s.extDemo}</div></div>
    </div>
  );
}
