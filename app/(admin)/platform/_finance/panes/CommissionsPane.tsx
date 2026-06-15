"use client";

/**
 * Finance · Commissions pane — admin v3, 1:1 port of
 * docs/admin_designe/6_Finance/finance.html `#pane-commissions` (lines 1043-1099).
 *
 * Two inner `.sub-tabs` sub-tabs:
 *   • Policies — 4 KPI cards + filter-card + table + pagination, with an
 *     editable detail `.drawer` and a "New policy" `.modal` (percent | fixed
 *     toggle via `.seg-choice`).
 *   • Records — read-only commission ledger table (payout rows render negative
 *     with `.amount-neg`).
 *
 * Pure management.css — no admin Tailwind, no `--admin-*`, no `@/components/ui`.
 * Shell common strings come from finance-i18n; pane-local labels are inline
 * trilingual via `pick(lang, …)`. All data flows through commissions-api +
 * finance-stats-api; client-side CSV export over the visible sub-tab rows.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiCommissions,
  apiCreateCommission,
  apiUpdateCommission,
  apiDeactivateCommission,
  apiCommissionRecords,
  type CommissionPolicyRow,
  type CommissionPolicyCreate,
  type CommissionPolicyUpdate,
  type CommissionRecordRow,
} from "@/lib/commissions-api";
import { apiCommissionsStats, type CommissionsStats } from "@/lib/finance-stats-api";
import type { FinancePaneProps } from "../types";
import { financeStrings, pick } from "../finance-i18n";
import { money, fmtDate, fmtDateTime, initials, avatarTone, statusBadgeCls, titleCase } from "../finance-helpers";

const PER_PAGE = 20;

type SubTab = "policies" | "records";

const SERVICE_TYPES = ["hotel", "flight", "transfer", "excursion", "car", "visa", "package"] as const;
const POLICY_STATUSES = ["active", "inactive", "scheduled"] as const;
const FIXED_CURRENCIES = ["AMD", "USD", "EUR", "RUB"] as const;

type PolicyStatus = (typeof POLICY_STATUSES)[number];

/** Empty create draft — company_id 0 is the "not yet filled" sentinel. */
function emptyDraft(): CommissionPolicyCreate {
  return {
    company_id: 0,
    service_type: "",
    type: "percentage",
    percent: null,
    fixed_value: null,
    fixed_currency: "AMD",
    status: "active",
    notes: "",
  };
}

/** Records whose status reads as a payout are shown as a negative ledger row. */
const PAYOUT_STATUSES = new Set(["payout", "paid_out", "settled_out", "withdrawal", "disbursed"]);

export function CommissionsPane({
  token,
  lang,
  registerAction,
  reportCount,
  showToast,
}: FinancePaneProps) {
  const s = financeStrings(lang);
  const confirm = useConfirm();

  const L = useMemo(
    () => ({
      tabPolicies: pick(lang, { hy: "Քաղաքականություններ", ru: "Политики", en: "Policies" }),
      tabRecords: pick(lang, { hy: "Գրառումներ", ru: "Записи", en: "Records" }),
      kpiActive: pick(lang, { hy: "Ակտիվ քաղաքականություններ", ru: "Активные политики", en: "Active policies" }),
      kpiRecorded: pick(lang, { hy: "Գրանցված (30 օր)", ru: "Начислено (30 дн.)", en: "Recorded (30d)" }),
      kpiPending: pick(lang, { hy: "Սպասվող", ru: "Ожидает", en: "Pending" }),
      kpiPendingFoot: (n: number) =>
        pick(lang, { hy: `${n} գրառում`, ru: `${n} записей`, en: `${n} records` }),
      kpiAvgRate: pick(lang, { hy: "Միջին դրույք", ru: "Средняя ставка", en: "Avg rate" }),
      colId: pick(lang, { hy: "ID", ru: "ID", en: "ID" }),
      colName: pick(lang, { hy: "Անվանում", ru: "Название", en: "Policy name" }),
      colType: pick(lang, { hy: "Տեսակ", ru: "Тип", en: "Type" }),
      colRate: pick(lang, { hy: "Դրույք", ru: "Ставка", en: "Rate" }),
      colService: pick(lang, { hy: "Ծառայություն", ru: "Услуга", en: "Service" }),
      colStatus: pick(lang, { hy: "Կարգավիճակ", ru: "Статус", en: "Status" }),
      colBooking: pick(lang, { hy: "Ամրագրում", ru: "Бронь", en: "Booking" }),
      serviceType: pick(lang, { hy: "Ծառայության տեսակ", ru: "Тип услуги", en: "Service type" }),
      allServices: pick(lang, { hy: "Բոլոր ծառայությունները", ru: "Все услуги", en: "All services" }),
      typeFilter: pick(lang, { hy: "Տեսակ", ru: "Тип", en: "Type" }),
      allTypes: pick(lang, { hy: "Բոլոր տեսակները", ru: "Все типы", en: "All types" }),
      typePercentage: pick(lang, { hy: "Տոկոս", ru: "Процент", en: "Percentage" }),
      typeFixed: pick(lang, { hy: "Ֆիքսված", ru: "Фиксированный", en: "Fixed" }),
      searchPh: pick(lang, { hy: "Քաղաքականության անվանում…", ru: "Название политики…", en: "Policy name…" }),
      newPolicy: pick(lang, { hy: "Նոր քաղաքականություն", ru: "Новая политика", en: "New policy" }),
      detailTitle: pick(lang, { hy: "Միջնորդավճարի քաղաքականություն", ru: "Политика комиссии", en: "Commission policy" }),
      editTitle: pick(lang, { hy: "Խմբագրել քաղաքականությունը", ru: "Редактировать политику", en: "Edit policy" }),
      deactivate: pick(lang, { hy: "Ապաակտիվացնել", ru: "Деактивировать", en: "Deactivate" }),
      edit: pick(lang, { hy: "Խմբագրել", ru: "Редактировать", en: "Edit" }),
      companyId: pick(lang, { hy: "Ընկերության ID", ru: "ID компании", en: "Company ID" }),
      companyIdPh: pick(lang, { hy: "Օր.՝ 12", ru: "Напр. 12", en: "e.g. 12" }),
      percent: pick(lang, { hy: "Տոկոս (%)", ru: "Процент (%)", en: "Percent (%)" }),
      fixedValue: pick(lang, { hy: "Ֆիքսված գումար", ru: "Фикс. сумма", en: "Fixed amount" }),
      mode: pick(lang, { hy: "Ռեժիմ", ru: "Режим", en: "Mode" }),
      notes: pick(lang, { hy: "Նշումներ", ru: "Заметки", en: "Notes" }),
      effFrom: pick(lang, { hy: "Գործում է սկսած", ru: "Действует с", en: "Effective from" }),
      effTo: pick(lang, { hy: "Գործում է մինչև", ru: "Действует до", en: "Effective to" }),
      pctChoiceSub: pick(lang, { hy: "Պատվերի գումարի տոկոս", ru: "Процент от суммы заказа", en: "Percent of order amount" }),
      fixedChoiceSub: pick(lang, { hy: "Ֆիքսված գումար մեկ ամրագրման համար", ru: "Фикс. сумма за бронь", en: "Flat amount per booking" }),
      required: pick(lang, { hy: "Ընկերության ID-ն պարտադիր է", ru: "ID компании обязателен", en: "Company ID is required" }),
      percentInvalid: pick(lang, { hy: "Տոկոսը պետք է լինի 0-ից 100", ru: "Процент должен быть от 0 до 100", en: "Percent must be between 0 and 100" }),
      fixedInvalid: pick(lang, { hy: "Ֆիքսված գումարը պետք է լինի 0 կամ ավելի", ru: "Фикс. сумма должна быть ≥ 0", en: "Fixed amount must be ≥ 0" }),
      saved: pick(lang, { hy: "Պահպանված է", ru: "Сохранено", en: "Saved" }),
      created: pick(lang, { hy: "Քաղաքականությունը ստեղծված է", ru: "Политика создана", en: "Policy created" }),
      deactivated: pick(lang, { hy: "Ապաակտիվացված է", ru: "Деактивировано", en: "Deactivated" }),
      confirmDeactivate: pick(lang, {
        hy: "Ապաակտիվացնե՞լ այս միջնորդավճարի քաղաքականությունը։",
        ru: "Деактивировать эту политику комиссии?",
        en: "Deactivate this commission policy?",
      }),
      nothingToExport: pick(lang, { hy: "Արտահանելու բան չկա", ru: "Нечего экспортировать", en: "Nothing to export" }),
      exported: pick(lang, { hy: "CSV-ն արտահանված է", ru: "CSV экспортирован", en: "CSV exported" }),
      noPolicies: pick(lang, { hy: "Քաղաքականություններ չկան", ru: "Нет политик", en: "No policies" }),
      noRecords: pick(lang, { hy: "Գրառումներ չկան", ru: "Нет записей", en: "No records" }),
    }),
    [lang],
  );

  const [subTab, setSubTab] = useState<SubTab>("policies");

  // Policies
  const [policies, setPolicies] = useState<CommissionPolicyRow[]>([]);
  const [policiesMeta, setPoliciesMeta] = useState<ApiListMeta | null>(null);
  const [policiesPage, setPoliciesPage] = useState(1);
  const [stats, setStats] = useState<CommissionsStats | null>(null);

  // Records
  const [records, setRecords] = useState<CommissionRecordRow[]>([]);
  const [recordsMeta, setRecordsMeta] = useState<ApiListMeta | null>(null);
  const [recordsPage, setRecordsPage] = useState(1);

  // Filters (client-side over the loaded policy page)
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [detail, setDetail] = useState<CommissionPolicyRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<CommissionPolicyUpdate>({});
  const [editSaving, setEditSaving] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newDraft, setNewDraft] = useState<CommissionPolicyCreate>(emptyDraft());
  const [newSaving, setNewSaving] = useState(false);

  // ── loaders ───────────────────────────────────────────────────────────────
  const loadPolicies = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiCommissions(token, { page: policiesPage, per_page: PER_PAGE });
      setPolicies(res.data);
      setPoliciesMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : s.errLoad);
    } finally {
      setLoading(false);
    }
  }, [token, policiesPage, s.errLoad]);

  const loadRecords = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiCommissionRecords(token, { page: recordsPage, per_page: PER_PAGE });
      setRecords(res.data);
      setRecordsMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : s.errLoad);
    } finally {
      setLoading(false);
    }
  }, [token, recordsPage, s.errLoad]);

  useEffect(() => {
    if (subTab === "policies") void loadPolicies();
  }, [subTab, loadPolicies]);

  useEffect(() => {
    if (subTab === "records") void loadRecords();
  }, [subTab, loadRecords]);

  // Commissions count pill = policies total (load the stats + first page once).
  useEffect(() => {
    if (!token) return;
    void apiCommissionsStats(token)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token]);

  useEffect(() => {
    reportCount(policiesMeta?.total);
  }, [policiesMeta?.total, reportCount]);

  // ── header actions ──────────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    if (subTab === "policies") {
      void loadPolicies();
      if (token) void apiCommissionsStats(token).then((res) => setStats(res.data)).catch(() => undefined);
    } else {
      void loadRecords();
    }
  }, [subTab, loadPolicies, loadRecords, token]);

  const exportCsv = useCallback(() => {
    const esc = (v: unknown) => {
      const str = v == null ? "" : String(v);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    let header: string[];
    let rows: string[][];
    let filename: string;
    if (subTab === "policies") {
      if (policies.length === 0) {
        showToast(L.nothingToExport);
        return;
      }
      filename = "commission-policies.csv";
      header = ["id", "name", "type", "rate", "currency", "service_type", "company_id", "status", "created_at"];
      rows = policies.map((r) => {
        const isPct = (r.type ?? "percentage") === "percentage";
        return [
          r.id,
          r.name ?? "",
          isPct ? "percentage" : "fixed",
          isPct ? String(r.percent ?? r.rate ?? "") : String(r.rate ?? ""),
          isPct ? "" : "",
          r.service_type ?? "",
          r.company_id == null ? "" : String(r.company_id),
          r.status,
          r.created_at ?? "",
        ];
      });
    } else {
      if (records.length === 0) {
        showToast(L.nothingToExport);
        return;
      }
      filename = "commission-records.csv";
      header = ["id", "amount", "currency", "status", "company", "booking_id", "created_at"];
      rows = records.map((r) => [
        String(r.id),
        String(r.amount),
        r.currency,
        r.status,
        r.company?.name ?? (r.company_id == null ? "" : `Company #${r.company_id}`),
        r.booking_id == null ? "" : String(r.booking_id),
        r.created_at ?? "",
      ]);
    }
    const csv = [header, ...rows].map((line) => line.map(esc).join(",")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(L.exported);
  }, [subTab, policies, records, L, showToast]);

  useEffect(() => {
    registerAction(
      <>
        <button className="btn" onClick={refresh}>
          <i className="ti ti-refresh" />
          {s.refresh}
        </button>
        <button className="btn" onClick={exportCsv}>
          <i className="ti ti-download" />
          {s.exportCsv}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            setNewDraft(emptyDraft());
            setNewOpen(true);
          }}
        >
          <i className="ti ti-plus" />
          {L.newPolicy}
        </button>
      </>,
    );
  }, [registerAction, refresh, exportCsv, s.refresh, s.exportCsv, L.newPolicy]);

  // ── derived ─────────────────────────────────────────────────────────────────
  const filteredPolicies = useMemo(() => {
    return policies.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (serviceFilter && (r.service_type ?? "") !== serviceFilter) return false;
      const rowType = (r.type ?? "percentage") === "percentage" ? "percentage" : "fixed";
      if (typeFilter && rowType !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${r.name ?? ""} ${r.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [policies, statusFilter, serviceFilter, typeFilter, search]);

  function policyRate(r: CommissionPolicyRow): string {
    const isPct = (r.type ?? "percentage") === "percentage";
    if (isPct) return `${Number(r.percent ?? r.rate ?? 0).toFixed(2)}%`;
    return money(r.rate, null);
  }

  // ── mutations ────────────────────────────────────────────────────────────────
  function openDetail(r: CommissionPolicyRow) {
    setDetail(r);
    setEditing(false);
  }

  function openEdit(r: CommissionPolicyRow) {
    const isPct = (r.type ?? "percentage") === "percentage";
    setDetail(r);
    setEditing(true);
    setEditDraft({
      service_type: r.service_type ?? "",
      percent: isPct ? r.percent ?? r.rate ?? null : null,
      fixed_value: isPct ? null : r.rate ?? null,
      status: (POLICY_STATUSES as readonly string[]).includes(r.status) ? (r.status as PolicyStatus) : "active",
    });
  }

  async function handleSaveEdit() {
    if (!token || !detail) return;
    const isPct = (detail.type ?? "percentage") === "percentage";
    if (isPct && editDraft.percent != null && (editDraft.percent < 0 || editDraft.percent > 100)) {
      showToast(L.percentInvalid);
      return;
    }
    if (!isPct && editDraft.fixed_value != null && editDraft.fixed_value < 0) {
      showToast(L.fixedInvalid);
      return;
    }
    setEditSaving(true);
    try {
      const body: CommissionPolicyUpdate = {
        service_type: editDraft.service_type?.toString().trim() || null,
        status: editDraft.status,
      };
      if (isPct) body.percent = editDraft.percent ?? null;
      else body.fixed_value = editDraft.fixed_value ?? null;
      await apiUpdateCommission(token, detail.id, body);
      setDetail(null);
      setEditing(false);
      await loadPolicies();
      showToast(L.saved);
    } catch (e) {
      showToast(e instanceof ApiRequestError ? e.message : s.errAction);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!token) return;
    const ok = await confirm({ message: L.confirmDeactivate, variant: "danger" });
    if (!ok) return;
    setBusyId(id);
    try {
      await apiDeactivateCommission(token, id);
      setDetail(null);
      await loadPolicies();
      showToast(L.deactivated);
    } catch (e) {
      showToast(e instanceof ApiRequestError ? e.message : s.errAction);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate() {
    if (!token) return;
    if (!newDraft.company_id || newDraft.company_id <= 0) {
      showToast(L.required);
      return;
    }
    if (newDraft.type === "percentage" && (newDraft.percent == null || newDraft.percent < 0 || newDraft.percent > 100)) {
      showToast(L.percentInvalid);
      return;
    }
    if (newDraft.type === "fixed" && (newDraft.fixed_value == null || newDraft.fixed_value < 0)) {
      showToast(L.fixedInvalid);
      return;
    }
    setNewSaving(true);
    try {
      await apiCreateCommission(token, {
        ...newDraft,
        service_type: newDraft.service_type?.trim() || null,
        notes: newDraft.notes?.trim() || null,
      });
      setNewOpen(false);
      setNewDraft(emptyDraft());
      await loadPolicies();
      if (token) void apiCommissionsStats(token).then((res) => setStats(res.data)).catch(() => undefined);
      showToast(L.created);
    } catch (e) {
      showToast(e instanceof ApiRequestError ? e.message : s.errAction);
    } finally {
      setNewSaving(false);
    }
  }

  // ── empty states ──────────────────────────────────────────────────────────────
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

  const recCount = recordsMeta?.total ?? records.length;

  return (
    <>
      {/* inner sub-tabs */}
      <div className="sub-tabs" role="tablist">
        <button
          className={`sub-tab ${subTab === "policies" ? "active" : ""}`}
          role="tab"
          aria-selected={subTab === "policies"}
          onClick={() => setSubTab("policies")}
        >
          {L.tabPolicies}
          {policiesMeta?.total != null && <span className="pill-count">{policiesMeta.total}</span>}
        </button>
        <button
          className={`sub-tab ${subTab === "records" ? "active" : ""}`}
          role="tab"
          aria-selected={subTab === "records"}
          onClick={() => setSubTab("records")}
        >
          {L.tabRecords}
          {recCount != null && <span className="pill-count">{recCount}</span>}
        </button>
      </div>

      {err && (
        <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}>
          <i className="ti ti-alert-triangle" />
          <span>{err}</span>
        </div>
      )}

      {subTab === "policies" ? (
        <>
          {/* KPI grid (4) */}
          <div className="kpi-grid">
            <div className="kpi-card c-primary">
              <div className="kpi-head">
                <div className="kpi-label">
                  <i className="ti ti-percentage" />
                  {L.kpiActive}
                </div>
              </div>
              <div className="kpi-value">
                {stats ? stats.active_policies_count.toLocaleString("en-US") : policiesMeta?.total ?? "—"}
              </div>
            </div>
            <div className="kpi-card c-success">
              <div className="kpi-head">
                <div className="kpi-label">
                  <i className="ti ti-coins" />
                  {L.kpiRecorded}
                </div>
              </div>
              <div className="kpi-value">{stats ? money(stats.recorded_amount, "AMD") : "—"}</div>
            </div>
            <div className="kpi-card c-warning">
              <div className="kpi-head">
                <div className="kpi-label">
                  <i className="ti ti-clock" />
                  {L.kpiPending}
                </div>
              </div>
              <div className="kpi-value">{stats ? money(stats.pending_amount, "AMD") : "—"}</div>
              {stats && stats.pending_count > 0 && <div className="kpi-sub">{L.kpiPendingFoot(stats.pending_count)}</div>}
            </div>
            <div className="kpi-card c-info">
              <div className="kpi-head">
                <div className="kpi-label">
                  <i className="ti ti-chart-bar" />
                  {L.kpiAvgRate}
                </div>
              </div>
              <div className="kpi-value">{stats ? `${stats.avg_rate_pct.toFixed(1)}%` : "—"}</div>
            </div>
          </div>

          {/* filters */}
          <div className="filter-card">
            <div className="filter-field" style={{ flex: 2 }}>
              <span className="filter-label">{s.search}</span>
              <input
                type="search"
                value={search}
                placeholder={L.searchPh}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-field">
              <span className="filter-label">{s.status}</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">{s.allStatuses}</option>
                {POLICY_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {titleCase(st)}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <span className="filter-label">{L.serviceType}</span>
              <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
                <option value="">{L.allServices}</option>
                {SERVICE_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {titleCase(st)}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <span className="filter-label">{L.typeFilter}</span>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">{L.allTypes}</option>
                <option value="percentage">{L.typePercentage}</option>
                <option value="fixed">{L.typeFixed}</option>
              </select>
            </div>
          </div>

          {/* table */}
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{L.colId}</th>
                    <th>{L.colName}</th>
                    <th>{L.colType}</th>
                    <th className="num">{L.colRate}</th>
                    <th>{L.colService}</th>
                    <th>{s.company}</th>
                    <th>{L.colStatus}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading && policies.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", color: "var(--text-secondary)", cursor: "default" }}>
                        {s.loading}
                      </td>
                    </tr>
                  ) : filteredPolicies.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", color: "var(--text-secondary)", cursor: "default" }}>
                        {policies.length === 0 ? L.noPolicies : s.noMatch}
                      </td>
                    </tr>
                  ) : (
                    filteredPolicies.map((r) => {
                      const isPct = (r.type ?? "percentage") === "percentage";
                      return (
                        <tr key={r.id} onClick={() => openDetail(r)}>
                          <td className="font-mono">{r.id.slice(0, 8)}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{r.name ?? "—"}</div>
                            {r.commission_mode && (
                              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.commission_mode}</div>
                            )}
                          </td>
                          <td>
                            <span className="type-badge">{isPct ? L.typePercentage : L.typeFixed}</span>
                          </td>
                          <td className="num font-mono">{policyRate(r)}</td>
                          <td>
                            <span className="badge badge-gray">{r.service_type ? titleCase(r.service_type) : s.all}</span>
                          </td>
                          <td>
                            {r.company_id != null ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span className={`avatar sm ${avatarTone(r.company_id)}`}>
                                  {initials(`Company ${r.company_id}`)}
                                </span>
                                <span>{`Company #${r.company_id}`}</span>
                              </div>
                            ) : (
                              <span className="muted-dash">—</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${statusBadgeCls(r.status)}`}>{titleCase(r.status)}</span>
                          </td>
                          <td className="num">
                            <div className="row-actions">
                              <button
                                className="icon-btn"
                                title={L.edit}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(r);
                                }}
                              >
                                <i className="ti ti-pencil" />
                              </button>
                              {r.status === "active" && (
                                <button
                                  className="icon-btn danger"
                                  title={L.deactivate}
                                  disabled={busyId === r.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleDeactivate(r.id);
                                  }}
                                >
                                  <i className="ti ti-ban" />
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
            {policiesMeta && policiesMeta.last_page > 1 && (
              <div className="pagination">
                <span className="pagination-info">
                  {s.showing} {(policiesMeta.current_page - 1) * policiesMeta.per_page + 1}–
                  {Math.min(policiesMeta.current_page * policiesMeta.per_page, policiesMeta.total)} {s.of}{" "}
                  {policiesMeta.total}
                </span>
                <div className="pagination-controls">
                  <button
                    className="btn btn-sm"
                    disabled={policiesMeta.current_page <= 1}
                    onClick={() => setPoliciesPage((p) => Math.max(1, p - 1))}
                  >
                    <i className="ti ti-chevron-left" />
                  </button>
                  <button className="btn btn-sm btn-primary">{policiesMeta.current_page}</button>
                  <button
                    className="btn btn-sm"
                    disabled={policiesMeta.current_page >= policiesMeta.last_page}
                    onClick={() => setPoliciesPage((p) => p + 1)}
                  >
                    <i className="ti ti-chevron-right" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Records ledger (read-only) */
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{L.colId}</th>
                  <th className="num">{s.amount}</th>
                  <th>{L.colStatus}</th>
                  <th>{s.company}</th>
                  <th>{L.colBooking}</th>
                  <th>{s.created}</th>
                </tr>
              </thead>
              <tbody>
                {loading && records.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)", cursor: "default" }}>
                      {s.loading}
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)", cursor: "default" }}>
                      {L.noRecords}
                    </td>
                  </tr>
                ) : (
                  records.map((r) => {
                    const negative = PAYOUT_STATUSES.has((r.status ?? "").toLowerCase()) || r.amount < 0;
                    const magnitude = Math.abs(r.amount);
                    return (
                      <tr key={r.id} style={{ cursor: "default" }}>
                        <td className="font-mono">#{r.id}</td>
                        <td className={`num font-mono ${negative ? "amount-neg" : ""}`}>
                          {negative ? `− ${money(magnitude, r.currency)}` : money(magnitude, r.currency)}
                        </td>
                        <td>
                          <span className={`badge ${statusBadgeCls(r.status)}`}>{titleCase(r.status)}</span>
                        </td>
                        <td>
                          {r.company?.name ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className={`avatar sm ${avatarTone(r.company.id)}`}>{initials(r.company.name)}</span>
                              <span>{r.company.name}</span>
                            </div>
                          ) : r.company_id != null ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className={`avatar sm ${avatarTone(r.company_id)}`}>
                                {initials(`Company ${r.company_id}`)}
                              </span>
                              <span>{`Company #${r.company_id}`}</span>
                            </div>
                          ) : (
                            <span className="muted-dash">—</span>
                          )}
                        </td>
                        <td className="font-mono">{r.booking_id != null ? `#${r.booking_id}` : "—"}</td>
                        <td>{fmtDate(r.created_at)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {recordsMeta && recordsMeta.last_page > 1 && (
            <div className="pagination">
              <span className="pagination-info">
                {s.showing} {(recordsMeta.current_page - 1) * recordsMeta.per_page + 1}–
                {Math.min(recordsMeta.current_page * recordsMeta.per_page, recordsMeta.total)} {s.of} {recordsMeta.total}
              </span>
              <div className="pagination-controls">
                <button
                  className="btn btn-sm"
                  disabled={recordsMeta.current_page <= 1}
                  onClick={() => setRecordsPage((p) => Math.max(1, p - 1))}
                >
                  <i className="ti ti-chevron-left" />
                </button>
                <button className="btn btn-sm btn-primary">{recordsMeta.current_page}</button>
                <button
                  className="btn btn-sm"
                  disabled={recordsMeta.current_page >= recordsMeta.last_page}
                  onClick={() => setRecordsPage((p) => p + 1)}
                >
                  <i className="ti ti-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── policy detail / edit drawer ───────────────────────────────────── */}
      <div className={`drawer-overlay ${detail ? "open" : ""}`} onClick={() => setDetail(null)} />
      <div className={`drawer ${detail ? "open" : ""}`} role="dialog" aria-modal="true">
        {detail && (
          <>
            <div className="drawer-header">
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{editing ? L.editTitle : L.detailTitle}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {detail.name ?? `#${detail.id.slice(0, 8)}`}
                </div>
              </div>
              <button className="icon-btn" title={s.close} onClick={() => setDetail(null)}>
                <i className="ti ti-x" />
              </button>
            </div>

            <div className="drawer-body">
              {editing ? (
                <div className="form-grid">
                  <div className="fld span-2">
                    <span className="fld-label">{L.serviceType}</span>
                    <select
                      value={editDraft.service_type ?? ""}
                      onChange={(e) => setEditDraft({ ...editDraft, service_type: e.target.value || null })}
                    >
                      <option value="">{L.allServices}</option>
                      {SERVICE_TYPES.map((st) => (
                        <option key={st} value={st}>
                          {titleCase(st)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(detail.type ?? "percentage") === "percentage" ? (
                    <div className="fld">
                      <span className="fld-label">{L.percent}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={editDraft.percent ?? ""}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, percent: e.target.value === "" ? null : Number(e.target.value) })
                        }
                        placeholder="0.00"
                      />
                    </div>
                  ) : (
                    <div className="fld">
                      <span className="fld-label">{L.fixedValue}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editDraft.fixed_value ?? ""}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            fixed_value: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  <div className="fld">
                    <span className="fld-label">{s.status}</span>
                    <select
                      value={editDraft.status ?? "active"}
                      onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value as PolicyStatus })}
                    >
                      {POLICY_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {titleCase(st)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  <div className="info-row">
                    <span className="info-label">{L.colId}</span>
                    <span className="info-value font-mono">{detail.id.slice(0, 8)}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{L.colName}</span>
                    <span className="info-value">{detail.name ?? "—"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{L.colType}</span>
                    <span className="info-value">
                      {(detail.type ?? "percentage") === "percentage" ? L.typePercentage : L.typeFixed}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{L.colRate}</span>
                    <span className="info-value font-mono">{policyRate(detail)}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{L.colService}</span>
                    <span className="info-value">{detail.service_type ? titleCase(detail.service_type) : s.all}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{s.company}</span>
                    <span className="info-value">{detail.company_id != null ? `Company #${detail.company_id}` : "—"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{s.status}</span>
                    <span className="info-value">
                      <span className={`badge ${statusBadgeCls(detail.status)}`}>{titleCase(detail.status)}</span>
                    </span>
                  </div>
                  {detail.commission_mode && (
                    <div className="info-row">
                      <span className="info-label">{L.mode}</span>
                      <span className="info-value">{detail.commission_mode}</span>
                    </div>
                  )}
                  {detail.effective_from && (
                    <div className="info-row">
                      <span className="info-label">{L.effFrom}</span>
                      <span className="info-value">{fmtDate(detail.effective_from)}</span>
                    </div>
                  )}
                  {detail.effective_to && (
                    <div className="info-row">
                      <span className="info-label">{L.effTo}</span>
                      <span className="info-value">{fmtDate(detail.effective_to)}</span>
                    </div>
                  )}
                  {detail.created_at && (
                    <div className="info-row">
                      <span className="info-label">{s.created}</span>
                      <span className="info-value">{fmtDateTime(detail.created_at)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="drawer-footer">
              {editing ? (
                <>
                  <button className="btn" onClick={() => setEditing(false)}>
                    {s.cancel}
                  </button>
                  <button className="btn btn-primary" disabled={editSaving} onClick={() => void handleSaveEdit()}>
                    {editSaving ? s.saving : s.save}
                  </button>
                </>
              ) : (
                <>
                  {detail.status === "active" && (
                    <button
                      className="btn btn-danger"
                      disabled={busyId === detail.id}
                      onClick={() => void handleDeactivate(detail.id)}
                    >
                      <i className="ti ti-ban" />
                      {L.deactivate}
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={() => openEdit(detail)}>
                    <i className="ti ti-pencil" />
                    {L.edit}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── new-policy modal ──────────────────────────────────────────────── */}
      <div className={`modal-overlay ${newOpen ? "open" : ""}`} onClick={() => setNewOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{L.newPolicy}</div>
            <button className="icon-btn" title={s.close} onClick={() => setNewOpen(false)}>
              <i className="ti ti-x" />
            </button>
          </div>
          <div className="modal-body">
            <div className="form-grid">
              <div className="fld">
                <span className="fld-label">
                  {L.companyId} <span style={{ color: "var(--danger)" }}>*</span>
                </span>
                <input
                  type="number"
                  min="1"
                  value={newDraft.company_id || ""}
                  placeholder={L.companyIdPh}
                  onChange={(e) => setNewDraft({ ...newDraft, company_id: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="fld">
                <span className="fld-label">{L.serviceType}</span>
                <select
                  value={newDraft.service_type ?? ""}
                  onChange={(e) => setNewDraft({ ...newDraft, service_type: e.target.value || null })}
                >
                  <option value="">{L.allServices}</option>
                  {SERVICE_TYPES.map((st) => (
                    <option key={st} value={st}>
                      {titleCase(st)}
                    </option>
                  ))}
                </select>
              </div>

              {/* percent | fixed toggle */}
              <div className="span-2">
                <span className="fld-label" style={{ display: "block", marginBottom: 6 }}>
                  {L.typeFilter}
                </span>
                <div className="seg-choice">
                  <div
                    className={`seg-opt ${newDraft.type === "percentage" ? "on" : ""}`}
                    onClick={() =>
                      setNewDraft({ ...newDraft, type: "percentage", fixed_value: null, percent: newDraft.percent })
                    }
                  >
                    <i className="ti ti-percentage" style={{ fontSize: 18, color: "var(--primary)" }} />
                    <div>
                      <div className="so-title">{L.typePercentage}</div>
                      <div className="so-sub">{L.pctChoiceSub}</div>
                    </div>
                  </div>
                  <div
                    className={`seg-opt ${newDraft.type === "fixed" ? "on" : ""}`}
                    onClick={() =>
                      setNewDraft({ ...newDraft, type: "fixed", percent: null, fixed_value: newDraft.fixed_value })
                    }
                  >
                    <i className="ti ti-currency-dram" style={{ fontSize: 18, color: "var(--primary)" }} />
                    <div>
                      <div className="so-title">{L.typeFixed}</div>
                      <div className="so-sub">{L.fixedChoiceSub}</div>
                    </div>
                  </div>
                </div>
              </div>

              {newDraft.type === "percentage" ? (
                <div className="fld span-2">
                  <span className="fld-label">
                    {L.percent} <span style={{ color: "var(--danger)" }}>*</span>
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={newDraft.percent ?? ""}
                    placeholder="0.00"
                    onChange={(e) => setNewDraft({ ...newDraft, percent: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
              ) : (
                <>
                  <div className="fld">
                    <span className="fld-label">
                      {L.fixedValue} <span style={{ color: "var(--danger)" }}>*</span>
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newDraft.fixed_value ?? ""}
                      placeholder="0.00"
                      onChange={(e) =>
                        setNewDraft({ ...newDraft, fixed_value: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="fld">
                    <span className="fld-label">{s.currency}</span>
                    <select
                      value={newDraft.fixed_currency ?? "AMD"}
                      onChange={(e) => setNewDraft({ ...newDraft, fixed_currency: e.target.value })}
                    >
                      {FIXED_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="fld">
                <span className="fld-label">{s.status}</span>
                <select
                  value={newDraft.status ?? "active"}
                  onChange={(e) => setNewDraft({ ...newDraft, status: e.target.value as PolicyStatus })}
                >
                  {POLICY_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {titleCase(st)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="fld span-2">
                <span className="fld-label">{L.notes}</span>
                <textarea
                  value={newDraft.notes ?? ""}
                  onChange={(e) => setNewDraft({ ...newDraft, notes: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setNewOpen(false)}>
              {s.cancel}
            </button>
            <button className="btn btn-primary" disabled={newSaving} onClick={() => void handleCreate()}>
              {newSaving ? s.saving : L.newPolicy}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
