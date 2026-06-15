"use client";

/**
 * Finance → Transactions pane (admin v3, 1:1 port of
 * docs/admin_designe/6_Finance/finance.html #pane-transactions, lines 1103-1173).
 *
 * Per-company entitlements + settlements. A company selector gates everything:
 * nothing loads until a company is chosen. Three inner sub-tabs share one
 * always-visible 4-card KPI snapshot (Inflows / Outflows / Net / Awaiting):
 *   - Summary      → every key/value of the finance-summary object
 *   - Entitlements → bulk-select table + "Mark payable" bulk action
 *   - Settlements  → table + per-row "Mark completed"
 *
 * Chrome is registered into the FinancePage header slot (Refresh + Export CSV).
 * Only management.css classes + inline var(--…); no admin Tailwind, no UI kit.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FinancePaneProps } from "../types";
import { financeStrings, pick } from "../finance-i18n";
import { money, fmtDate, initials, avatarTone, statusBadgeCls, titleCase } from "../finance-helpers";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import type { ApiListMeta } from "@/lib/api-envelope";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiFinanceSummary,
  apiFinanceEntitlements,
  apiFinanceSettlements,
  apiMarkEntitlementsPayable,
  apiUpdateSettlementStatus,
  type FinanceEntitlementRow,
  type FinanceSettlementRow,
  type CompanyFinanceSummary,
} from "@/lib/finance-api";
import { downloadFinanceCsv } from "@/lib/finance-stats-api";

type SubTab = "summary" | "entitlements" | "settlements";

const PER_PAGE = 20;

/** statuses where a settlement can still be marked "completed" */
const SETTLE_OPEN = new Set(["pending", "awaiting", "ready_to_settle"]);

export function TransactionsPane({ token, user, lang, registerAction, showToast }: FinancePaneProps) {
  const s = financeStrings(lang);
  const confirm = useConfirm();

  const L = useMemo(
    () => ({
      selectCompany: pick(lang, {
        hy: "Ընտրեք ընկերությունը՝ տվյալները բեռնելու համար։",
        ru: "Выберите компанию, чтобы загрузить данные.",
        en: "Select a company to load its finance data.",
      }),
      companyId: pick(lang, { hy: "Ընկերության ID", ru: "ID компании", en: "Company ID" }),
      sumSummary: pick(lang, { hy: "Ամփոփում", ru: "Сводка", en: "Summary" }),
      sumEntitlements: pick(lang, { hy: "Հասույթներ", ru: "Начисления", en: "Entitlements" }),
      sumSettlements: pick(lang, { hy: "Կարգավորումներ", ru: "Расчёты", en: "Settlements" }),
      inflows: pick(lang, { hy: "Մուտքեր (30 օր)", ru: "Поступления (30 дн.)", en: "Inflows (30d)" }),
      outflows: pick(lang, { hy: "Ելքեր (30 օր)", ru: "Списания (30 дн.)", en: "Outflows (30d)" }),
      net: pick(lang, { hy: "Զուտ դիրք", ru: "Чистая позиция", en: "Net position" }),
      awaiting: pick(lang, { hy: "Սպասվող կարգավորում", ru: "Ожидает расчёта", en: "Awaiting settlement" }),
      noSource: pick(lang, { hy: "Տվյալների աղբյուր դեռ չկա", ru: "Источник данных пока отсутствует", en: "No data source yet" }),
      summaryCard: pick(lang, { hy: "Ընկերության ֆինանսական ամփոփում", ru: "Финансовая сводка компании", en: "Company finance summary" }),
      payableAt: pick(lang, { hy: "Վճարման ենթակա", ru: "К выплате", en: "Payable at" }),
      settledAt: pick(lang, { hy: "Կարգավորված", ru: "Рассчитано", en: "Settled at" }),
      markPayable: pick(lang, { hy: "Նշել վճարման ենթակա", ru: "Отметить к выплате", en: "Mark payable" }),
      markCompleted: pick(lang, { hy: "Նշել կատարված", ru: "Отметить завершённым", en: "Mark completed" }),
      selected: pick(lang, { hy: "ընտրված", ru: "выбрано", en: "selected" }),
      noEntitlements: pick(lang, { hy: "Հասույթներ չկան։", ru: "Начислений нет.", en: "No entitlements yet." }),
      noSettlements: pick(lang, { hy: "Կարգավորումներ չկան։", ru: "Расчётов нет.", en: "No settlements yet." }),
      markPayableDone: pick(lang, { hy: "Նշված է որպես վճարման ենթակա։", ru: "Отмечено к выплате.", en: "Marked as payable." }),
      markCompletedDone: pick(lang, { hy: "Կարգավորումը նշված է կատարված։", ru: "Расчёт отмечен завершённым.", en: "Settlement marked completed." }),
      markCompletedConfirm: pick(lang, {
        hy: "Նշե՞լ այս կարգավորումը որպես կատարված։",
        ru: "Отметить этот расчёт как завершённый?",
        en: "Mark this settlement as completed?",
      }),
    }),
    [lang],
  );

  // ── company selector ────────────────────────────────────────────────────
  const companies = user?.companies ?? [];
  const hasCompanyList = companies.length > 0;
  const activeCompanyId = ((): number | null => {
    const raw = user?.context?.active_company_id;
    return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  })();

  const [companyId, setCompanyId] = useState<number | null>(activeCompanyId);
  const [companyInput, setCompanyInput] = useState<string>(activeCompanyId != null ? String(activeCompanyId) : "");

  const hasCompany = companyId != null && Number.isInteger(companyId) && companyId > 0;

  // ── sub-tab + data state ───────────────────────────────────────────────
  const [sub, setSub] = useState<SubTab>("summary");

  const [summary, setSummary] = useState<CompanyFinanceSummary | null>(null);

  const [entRows, setEntRows] = useState<FinanceEntitlementRow[]>([]);
  const [entMeta, setEntMeta] = useState<ApiListMeta | null>(null);
  const [entPage, setEntPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [setRows, setSetRows] = useState<FinanceSettlementRow[]>([]);
  const [setMeta, setSetMeta] = useState<ApiListMeta | null>(null);
  const [setPage, setSetPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  function applyError(e: unknown) {
    if (e instanceof ApiRequestError && e.status === 403) {
      setForbidden(true);
      return;
    }
    setError(e instanceof ApiRequestError ? e.message : s.errLoad);
  }

  // ── loaders ─────────────────────────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    if (!token || !hasCompany) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiFinanceSummary(token, companyId!);
      setSummary(r.data);
    } catch (e) {
      applyError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hasCompany, companyId, s.errLoad]);

  const loadEntitlements = useCallback(async () => {
    if (!token || !hasCompany) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiFinanceEntitlements(token, { company_id: companyId!, page: entPage, per_page: PER_PAGE });
      setEntRows(r.data);
      setEntMeta(r.meta);
      setSelected(new Set());
    } catch (e) {
      applyError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hasCompany, companyId, entPage, s.errLoad]);

  const loadSettlements = useCallback(async () => {
    if (!token || !hasCompany) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiFinanceSettlements(token, { company_id: companyId!, page: setPage, per_page: PER_PAGE });
      setSetRows(r.data);
      setSetMeta(r.meta);
    } catch (e) {
      applyError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hasCompany, companyId, setPage, s.errLoad]);

  const reload = useCallback(() => {
    if (!hasCompany) return;
    void loadSummary();
    if (sub === "entitlements") void loadEntitlements();
    if (sub === "settlements") void loadSettlements();
  }, [hasCompany, sub, loadSummary, loadEntitlements, loadSettlements]);

  // KPI summary + active sub-tab data load whenever company / page / sub change
  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (sub === "entitlements") void loadEntitlements();
  }, [sub, loadEntitlements]);

  useEffect(() => {
    if (sub === "settlements") void loadSettlements();
  }, [sub, loadSettlements]);

  // ── header actions (Refresh + Export CSV) ───────────────────────────────
  const handleExport = useCallback(async () => {
    if (!token || !hasCompany) return;
    const kind = sub === "entitlements" ? "entitlements" : sub === "settlements" ? "settlements" : "all";
    try {
      await downloadFinanceCsv(token, companyId!, kind);
    } catch {
      showToast(s.errAction);
    }
  }, [token, hasCompany, companyId, sub, showToast, s.errAction]);

  useEffect(() => {
    registerAction(
      <>
        <button className="btn" onClick={() => reload()} disabled={!hasCompany || loading}>
          <i className="ti ti-refresh" />
          {s.refresh}
        </button>
        <button className="btn btn-primary" onClick={() => void handleExport()} disabled={!hasCompany}>
          <i className="ti ti-download" />
          {s.exportCsv}
        </button>
      </>,
    );
  }, [registerAction, reload, handleExport, hasCompany, loading, s.refresh, s.exportCsv]);

  // ── bulk select handlers ─────────────────────────────────────────────────
  function toggleRow(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(entRows.map((r) => r.id)) : new Set());
  }

  async function handleMarkPayable() {
    if (!token || !hasCompany || selected.size === 0) return;
    setBusy(true);
    try {
      await apiMarkEntitlementsPayable(token, { company_id: companyId!, entitlement_ids: Array.from(selected) });
      showToast(L.markPayableDone);
      setSelected(new Set());
      await loadEntitlements();
      void loadSummary();
    } catch (e) {
      showToast(e instanceof ApiRequestError ? e.message : s.errAction);
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkCompleted(id: number) {
    if (!token || !hasCompany) return;
    const ok = await confirm({ title: L.markCompleted, message: L.markCompletedConfirm });
    if (!ok) return;
    setBusy(true);
    try {
      await apiUpdateSettlementStatus(token, id, "completed");
      showToast(L.markCompletedDone);
      await loadSettlements();
      void loadSummary();
    } catch (e) {
      showToast(e instanceof ApiRequestError ? e.message : s.errAction);
    } finally {
      setBusy(false);
    }
  }

  // ── forbidden empty-state ─────────────────────────────────────────────────
  if (forbidden) {
    return (
      <div className="empty-state">
        <div className="es-icon">
          <i className="ti ti-lock" />
        </div>
        <div className="es-title">{s.forbidden}</div>
      </div>
    );
  }

  const allChecked = entRows.length > 0 && entRows.every((r) => selected.has(r.id));

  // ── KPI snapshot (shown across every sub-tab) ────────────────────────────
  const kpis = [
    { cls: "c-success", icon: "ti-arrow-down", label: L.inflows, value: money(summary?.total_earned ?? null), sub: undefined as string | undefined },
    { cls: "c-danger", icon: "ti-arrow-up", label: L.outflows, value: "—", sub: L.noSource },
    { cls: "c-primary", icon: "ti-equal", label: L.net, value: money(summary?.total_settled ?? null), sub: undefined },
    { cls: "c-warning", icon: "ti-clock", label: L.awaiting, value: money(summary?.total_pending ?? null), sub: undefined },
  ];

  return (
    <div>
      {/* company selector */}
      <div className="filter-card" style={{ marginBottom: 16 }}>
        <div className="filter-field" style={{ maxWidth: 280 }}>
          <span className="filter-label">{s.company}</span>
          {hasCompanyList ? (
            <select
              value={companyId ?? ""}
              onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">—</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (#{c.id})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min={1}
              inputMode="numeric"
              placeholder={L.companyId}
              value={companyInput}
              onChange={(e) => {
                setCompanyInput(e.target.value);
                const n = e.target.value ? Number(e.target.value) : null;
                setCompanyId(n != null && Number.isInteger(n) && n > 0 ? n : null);
              }}
            />
          )}
        </div>
      </div>

      {!hasCompany ? (
        <div className="empty-state">
          <div className="es-icon">
            <i className="ti ti-building-bank" />
          </div>
          <div className="es-title">{L.selectCompany}</div>
        </div>
      ) : (
        <>
          {/* inner sub-tabs */}
          <div className="sub-tabs">
            <button className={`sub-tab ${sub === "summary" ? "active" : ""}`} onClick={() => setSub("summary")}>
              {L.sumSummary}
            </button>
            <button className={`sub-tab ${sub === "entitlements" ? "active" : ""}`} onClick={() => setSub("entitlements")}>
              {L.sumEntitlements}
              {entMeta?.total != null && <span className="pill-count">{entMeta.total}</span>}
            </button>
            <button className={`sub-tab ${sub === "settlements" ? "active" : ""}`} onClick={() => setSub("settlements")}>
              {L.sumSettlements}
              {setMeta?.total != null && <span className="pill-count">{setMeta.total}</span>}
            </button>
          </div>

          {error && (
            <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}>
              <i className="ti ti-alert-triangle" />
              <span>{error}</span>
            </div>
          )}

          {/* KPI snapshot — visible on every sub-tab */}
          <div className="kpi-grid">
            {kpis.map((k) => (
              <div key={k.label} className={`kpi-card ${k.cls}`}>
                <div className="kpi-head">
                  <span className="kpi-label">
                    <i className={`ti ${k.icon}`} />
                    {k.label}
                  </span>
                </div>
                <div className="kpi-value">{k.value}</div>
                {k.sub && <div className="kpi-sub">{k.sub}</div>}
              </div>
            ))}
          </div>

          {/* ── SUMMARY ────────────────────────────────────────────────── */}
          {sub === "summary" && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">{L.summaryCard}</div>
              </div>
              <div className="card-body">
                {summary && Object.keys(summary).length > 0 ? (
                  <div className="sum-grid">
                    {Object.entries(summary).map(([key, val]) => (
                      <div className="sum-row" key={key}>
                        <span className="sr-key">{titleCase(key)}</span>
                        <span className="sr-val">
                          {typeof val === "number" ? money(val, summary.currency) : String(val ?? "—")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                    {loading ? s.loading : s.empty}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ENTITLEMENTS ──────────────────────────────────────────── */}
          {sub === "entitlements" && (
            <div className="card">
              <div className={`bulk-bar ${selected.size > 0 ? "show" : ""}`}>
                <span className="bulk-count">
                  {selected.size} {L.selected}
                </span>
                <button className="btn btn-sm btn-primary" onClick={() => void handleMarkPayable()} disabled={busy}>
                  <i className="ti ti-cash" />
                  {L.markPayable}
                </button>
                <button className="btn btn-sm" onClick={() => setSelected(new Set())} disabled={busy}>
                  {s.clear}
                </button>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="check-cell">
                        <input
                          type="checkbox"
                          className="check-all"
                          checked={allChecked}
                          onChange={(e) => toggleAll(e.target.checked)}
                          aria-label="Select all"
                        />
                      </th>
                      <th>{s.id}</th>
                      <th className="num">{s.amount}</th>
                      <th>{s.company}</th>
                      <th>{s.status}</th>
                      <th>{L.payableAt}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-secondary)" }}>
                          {loading ? s.loading : L.noEntitlements}
                        </td>
                      </tr>
                    ) : (
                      entRows.map((r) => {
                        const amount = r.gross_amount ?? r.net_amount;
                        return (
                          <tr key={r.id}>
                            <td className="check-cell" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="row-check"
                                checked={selected.has(r.id)}
                                onChange={(e) => toggleRow(r.id, e.target.checked)}
                                aria-label={`Select entitlement ${r.id}`}
                              />
                            </td>
                            <td className="font-mono">#E-{r.id}</td>
                            <td className="num font-mono">{money(amount, r.currency)}</td>
                            <td>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <span className={`avatar sm ${avatarTone(r.company_id)}`}>
                                  {initials(`Company #${r.company_id}`)}
                                </span>
                                Company #{r.company_id}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${statusBadgeCls(r.status)}`}>{titleCase(r.status)}</span>
                            </td>
                            <td>{fmtDate(r.payable_at)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {entMeta && entMeta.last_page > 1 && (
                <div className="pagination">
                  <span className="pagination-info">
                    {s.showing} {(entMeta.current_page - 1) * entMeta.per_page + 1}–
                    {Math.min(entMeta.current_page * entMeta.per_page, entMeta.total)} {s.of} {entMeta.total}
                  </span>
                  <div className="pagination-controls">
                    <button
                      className="btn btn-sm"
                      disabled={entMeta.current_page <= 1}
                      onClick={() => setEntPage((p) => Math.max(1, p - 1))}
                    >
                      <i className="ti ti-chevron-left" />
                    </button>
                    <button className="btn btn-sm btn-primary">{entMeta.current_page}</button>
                    <button
                      className="btn btn-sm"
                      disabled={entMeta.current_page >= entMeta.last_page}
                      onClick={() => setEntPage((p) => p + 1)}
                    >
                      <i className="ti ti-chevron-right" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SETTLEMENTS ───────────────────────────────────────────── */}
          {sub === "settlements" && (
            <div className="card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{s.id}</th>
                      <th className="num">{s.amount}</th>
                      <th>{s.company}</th>
                      <th>{s.status}</th>
                      <th>{L.settledAt}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {setRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-secondary)" }}>
                          {loading ? s.loading : L.noSettlements}
                        </td>
                      </tr>
                    ) : (
                      setRows.map((r) => {
                        const companyName = r.company?.name ?? `Company #${r.company_id}`;
                        const canComplete = SETTLE_OPEN.has((r.status ?? "").toLowerCase());
                        return (
                          <tr key={r.id}>
                            <td className="font-mono">#S-{r.id}</td>
                            <td className="num font-mono">{money(r.total_net_amount, r.currency)}</td>
                            <td>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <span className={`avatar sm ${avatarTone(r.company_id)}`}>{initials(companyName)}</span>
                                {companyName}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${statusBadgeCls(r.status)}`}>{titleCase(r.status)}</span>
                            </td>
                            <td>{fmtDate(r.settled_at)}</td>
                            <td className="num">
                              <div className="row-actions">
                                {canComplete && (
                                  <button
                                    className="btn btn-sm"
                                    onClick={() => void handleMarkCompleted(r.id)}
                                    disabled={busy}
                                  >
                                    {L.markCompleted}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {setMeta && setMeta.last_page > 1 && (
                <div className="pagination">
                  <span className="pagination-info">
                    {s.showing} {(setMeta.current_page - 1) * setMeta.per_page + 1}–
                    {Math.min(setMeta.current_page * setMeta.per_page, setMeta.total)} {s.of} {setMeta.total}
                  </span>
                  <div className="pagination-controls">
                    <button
                      className="btn btn-sm"
                      disabled={setMeta.current_page <= 1}
                      onClick={() => setSetPage((p) => Math.max(1, p - 1))}
                    >
                      <i className="ti ti-chevron-left" />
                    </button>
                    <button className="btn btn-sm btn-primary">{setMeta.current_page}</button>
                    <button
                      className="btn btn-sm"
                      disabled={setMeta.current_page >= setMeta.last_page}
                      onClick={() => setSetPage((p) => p + 1)}
                    >
                      <i className="ti ti-chevron-right" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
