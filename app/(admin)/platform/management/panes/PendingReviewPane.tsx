"use client";

/**
 * Management — Pending review pane (admin v3). Self-contained 1:1 port of the
 * `#mp-pending-review` block in docs/admin_designe/7_Management/management.html
 * (lines 915–935 + the reject modal at 1384–1393), re-homed onto the unified
 * Management page for super-admin / platform-admin.
 *
 * Functionality ported verbatim from app/(admin)/platform/pending-review/page.tsx:
 *   - filter-card: Type / Company ID / Search title (server-side: type, company_id, q)
 *   - card-wrapped table of pending offers with row checkboxes + a bulk bar
 *   - per-row Approve / Reject (modal) / View actions
 *   - bulk approve (confirm with count, max 100) + CSV export of the rendered page
 * Lifecycle: approve → published, reject → rejected. NEVER delete.
 *
 * Rendered inside the MgmtPage shell, so the .mgmt-page-scoped management.css
 * classes apply. No admin Tailwind, no --admin-* tokens, no @/components/ui.
 */

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { formatDateTime } from "@/lib/format";
import {
  apiApproveOffer,
  apiBulkApproveOffers,
  apiPendingReviewOffers,
  apiRejectOffer,
  type PendingReviewOfferRow,
} from "@/lib/platform-admin-api";

const PER_PAGE = 20;
const BULK_MAX = 100;

const TYPE_FILTERS = [
  "",
  "hotel",
  "car",
  "transfer",
  "excursion",
  "flight",
  "package",
  "visa",
] as const;

type L = { hy: string; ru: string; en: string };

/** Trilingual label picker keyed on the active admin language. */
function pick(lang: string, map: L): string {
  if (lang === "ru") return map.ru;
  if (lang === "en") return map.en;
  return map.hy;
}

const TYPE_LABEL: Record<string, L> = {
  hotel: { hy: "Հյուրանոց", ru: "Отель", en: "Hotel" },
  car: { hy: "Մեքենա", ru: "Авто", en: "Car" },
  transfer: { hy: "Տրանսֆեր", ru: "Трансфер", en: "Transfer" },
  excursion: { hy: "Էքսկուրսիա", ru: "Экскурсия", en: "Excursion" },
  flight: { hy: "Չվերթ", ru: "Авиабилет", en: "Flight" },
  package: { hy: "Փաթեթ", ru: "Пакет", en: "Package" },
  visa: { hy: "Վիզա", ru: "Виза", en: "Visa" },
};

const T = {
  forbidden: {
    hy: "Այս բաժինը հասանելի է միայն գլխավոր ադմինիստրատորին։",
    ru: "Этот раздел доступен только главному администратору.",
    en: "This section is available to platform administrators only.",
  },
  forbiddenTitle: {
    hy: "Հասանելի չէ",
    ru: "Нет доступа",
    en: "No access",
  },
  filterType: { hy: "Տեսակ", ru: "Тип", en: "Type" },
  allTypes: { hy: "Բոլոր տեսակները", ru: "Все типы", en: "All types" },
  filterCompany: { hy: "Ընկերության ID", ru: "ID компании", en: "Company ID" },
  companyPh: { hy: "Օր․ 12", ru: "Напр. 12", en: "e.g. 12" },
  filterSearch: { hy: "Որոնել անվանումով", ru: "Поиск по названию", en: "Search title" },
  searchPh: {
    hy: "Առաջարկի անվանումը…",
    ru: "Название предложения…",
    en: "Offer title…",
  },
  apply: { hy: "Կիրառել", ru: "Применить", en: "Apply" },
  exportCsv: { hy: "Ներբեռնել CSV", ru: "Скачать CSV", en: "Export CSV" },
  bulkApprove: { hy: "Խմբային հաստատում", ru: "Массовое одобрение", en: "Bulk approve" },
  bulkApproving: { hy: "Հաստատվում է…", ru: "Одобрение…", en: "Approving…" },
  clear: { hy: "Մաքրել", ru: "Очистить", en: "Clear" },
  selected: { hy: "ընտրված", ru: "выбрано", en: "selected" },
  selectAll: { hy: "Ընտրել բոլորը էջում", ru: "Выбрать все на странице", en: "Select all on page" },
  selectOne: { hy: "Ընտրել առաջարկը", ru: "Выбрать предложение", en: "Select offer" },
  colId: { hy: "ID", ru: "ID", en: "ID" },
  colType: { hy: "Տեսակ", ru: "Тип", en: "Type" },
  colTitle: { hy: "Անվանում", ru: "Название", en: "Title" },
  colOperator: { hy: "Օպերատոր", ru: "Оператор", en: "Operator" },
  colCountry: { hy: "Երկիր", ru: "Страна", en: "Country" },
  colSubmitted: { hy: "Ներկայացված", ru: "Подано", en: "Submitted" },
  colActions: { hy: "Գործողություններ", ru: "Действия", en: "Actions" },
  approve: { hy: "Հաստատել", ru: "Одобрить", en: "Approve" },
  reject: { hy: "Մերժել", ru: "Отклонить", en: "Reject" },
  view: { hy: "Դիտել", ru: "Просмотр", en: "View" },
  empty: {
    hy: "Հաստատման սպասող առաջարկ չկա։",
    ru: "Нет предложений, ожидающих одобрения.",
    en: "No offers awaiting review.",
  },
  loading: { hy: "Բեռնվում է…", ru: "Загрузка…", en: "Loading…" },
  showing: { hy: "Ցուցադրվում է", ru: "Показано", en: "Showing" },
  of: { hy: "ընդ․", ru: "из", en: "of" },
  prev: { hy: "Նախորդ", ru: "Назад", en: "Prev" },
  next: { hy: "Հաջորդ", ru: "Вперёд", en: "Next" },
  modalTitle: { hy: "Մերժել առաջարկը", ru: "Отклонить предложение", en: "Reject offer" },
  reasonLabel: { hy: "Մերժման պատճառ", ru: "Причина отклонения", en: "Rejection reason" },
  reasonHint: {
    hy: "պարտադիր · նվազ․ 3 նիշ",
    ru: "обязательно · мин. 3 символа",
    en: "required · min 3 chars",
  },
  reasonPh: {
    hy: "Պատճառը, որ կուղարկվի օպերատորին…",
    ru: "Причина, отправляемая оператору…",
    en: "Reason sent to the operator…",
  },
  cancel: { hy: "Չեղարկել", ru: "Отмена", en: "Cancel" },
  confirmApprove: {
    hy: "Հաստատե՞լ այս առաջարկը։ Այն կհրապարակվի։",
    ru: "Одобрить это предложение? Оно будет опубликовано.",
    en: "Approve this offer? It will be published.",
  },
  confirmBulk: {
    hy: "Հաստատե՞լ ընտրված առաջարկները։",
    ru: "Одобрить выбранные предложения?",
    en: "Approve the selected offers?",
  },
  bulkResult: {
    hy: "Հաստատվեց",
    ru: "Одобрено",
    en: "Approved",
  },
  errLoad: {
    hy: "Չհաջողվեց բեռնել առաջարկները։",
    ru: "Не удалось загрузить предложения.",
    en: "Failed to load offers.",
  },
  errApprove: {
    hy: "Չհաջողվեց հաստատել առաջարկը։",
    ru: "Не удалось одобрить предложение.",
    en: "Failed to approve the offer.",
  },
  errReject: {
    hy: "Չհաջողվեց մերժել առաջարկը։",
    ru: "Не удалось отклонить предложение.",
    en: "Failed to reject the offer.",
  },
  errReasonMin: {
    hy: "Մերժման պատճառը պետք է լինի առնվազն 3 նիշ։",
    ru: "Причина отклонения должна содержать не менее 3 символов.",
    en: "Rejection reason must be at least 3 characters.",
  },
  errBulkMax: {
    hy: "Միանգամից կարելի է հաստատել առավելագույնը 100 առաջարկ։",
    ru: "За один раз можно одобрить не более 100 предложений.",
    en: "You can bulk-approve at most 100 offers at once.",
  },
} satisfies Record<string, L>;

function typeLabel(lang: string, type: string): string {
  const m = TYPE_LABEL[type];
  return m ? pick(lang, m) : type;
}

/** Deterministic avatar tone per id — mirrors the mockup's rotating tints. */
function avatarTone(id: number): string {
  const tones = ["", "avatar-teal", "avatar-amber", "avatar-blue"];
  return tones[id % tones.length] ?? "";
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/** Build + download a CSV from the rendered rows (client-side). */
function exportRows(rows: PendingReviewOfferRow[]): void {
  const headers = [
    "id",
    "type",
    "title",
    "status",
    "company_id",
    "company_name",
    "company_country",
    "submitted_for_review_at",
    "reviewed_at",
    "rejection_reason",
  ];
  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.type,
        r.title,
        r.status,
        r.company_id ?? "",
        r.company?.name ?? "",
        r.company?.country ?? "",
        r.submitted_for_review_at ?? "",
        r.reviewed_at ?? "",
        r.rejection_reason ?? "",
      ]
        .map(escape)
        .join(","),
    ),
  ];
  const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pending-review-offers-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function PendingReviewPane() {
  const { token, user } = useAdminAuth();
  const { lang } = useLanguage();
  const confirm = useConfirm();

  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<PendingReviewOfferRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // filter inputs (draft) vs applied (drives the request)
  const [typeFilter, setTypeFilter] = useState("");
  const [companyDraft, setCompanyDraft] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // reject modal
  const [rejectOffer, setRejectOffer] = useState<PendingReviewOfferRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setLoading(true);
    setErr(null);
    try {
      const companyNum = Number(companyId);
      const res = await apiPendingReviewOffers(token, {
        page,
        per_page: PER_PAGE,
        type: typeFilter || undefined,
        company_id: companyId && Number.isFinite(companyNum) && companyNum > 0 ? companyNum : undefined,
        q: search || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : pick(lang, T.errLoad));
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, typeFilter, companyId, search, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    setCompanyId(companyDraft.trim());
    setSearch(searchDraft.trim());
    setPage(1);
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (rows.every((r) => next.has(r.id))) {
        for (const r of rows) next.delete(r.id);
      } else {
        for (const r of rows) next.add(r.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleApprove(row: PendingReviewOfferRow) {
    if (!token) return;
    const ok = await confirm({ message: pick(lang, T.confirmApprove) });
    if (!ok) return;
    setBusyId(row.id);
    setErr(null);
    try {
      await apiApproveOffer(token, row.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : pick(lang, T.errApprove));
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulkApprove() {
    if (!token || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (ids.length > BULK_MAX) {
      setErr(pick(lang, T.errBulkMax));
      return;
    }
    const ok = await confirm({
      message: `${pick(lang, T.confirmBulk)} (${ids.length})`,
    });
    if (!ok) return;
    setBulkBusy(true);
    setErr(null);
    try {
      const res = await apiBulkApproveOffers(token, ids);
      const r = res.data;
      // Positive result banner (the danger `err` banner is for failures only).
      setBulkResult(`${pick(lang, T.bulkResult)}: ${r.approved_count} / ${r.total}`);
      clearSelection();
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : pick(lang, T.errApprove));
    } finally {
      setBulkBusy(false);
    }
  }

  function openReject(row: PendingReviewOfferRow) {
    setRejectOffer(row);
    setRejectReason("");
  }

  function closeReject() {
    setRejectOffer(null);
    setRejectReason("");
  }

  async function submitReject() {
    if (!token || !rejectOffer) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      setErr(pick(lang, T.errReasonMin));
      return;
    }
    setBusyId(rejectOffer.id);
    setErr(null);
    try {
      await apiRejectOffer(token, rejectOffer.id, reason);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (rejectOffer) next.delete(rejectOffer.id);
        return next;
      });
      closeReject();
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : pick(lang, T.errReject));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return (
      <div className="empty-state">
        <div className="es-icon">
          <i className="ti ti-lock" />
        </div>
        <div className="es-title">{pick(lang, T.forbiddenTitle)}</div>
        <div className="es-sub">{pick(lang, T.forbidden)}</div>
      </div>
    );
  }

  const firstIdx = meta ? (meta.current_page - 1) * meta.per_page + 1 : 0;
  const lastIdx = meta ? Math.min(meta.current_page * meta.per_page, meta.total) : 0;

  return (
    <>
      {/* Filters — Type / Company ID / Search title */}
      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{pick(lang, T.filterType)}</span>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            {TYPE_FILTERS.map((tf) => (
              <option key={tf} value={tf}>
                {tf ? typeLabel(lang, tf) : pick(lang, T.allTypes)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{pick(lang, T.filterCompany)}</span>
          <input
            type="text"
            inputMode="numeric"
            value={companyDraft}
            placeholder={pick(lang, T.companyPh)}
            onChange={(e) => setCompanyDraft(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
          />
        </div>
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{pick(lang, T.filterSearch)}</span>
          <input
            type="search"
            value={searchDraft}
            placeholder={pick(lang, T.searchPh)}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
          />
        </div>
        <button className="btn btn-primary" onClick={applyFilters}>
          <i className="ti ti-filter" />
          {pick(lang, T.apply)}
        </button>
        <button className="btn" disabled={rows.length === 0} onClick={() => exportRows(rows)}>
          <i className="ti ti-download" />
          {pick(lang, T.exportCsv)}
        </button>
      </div>

      {err && (
        <div
          className="alert"
          style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}
        >
          <i className="ti ti-alert-circle" />
          {err}
        </div>
      )}

      {bulkResult && (
        <div
          className="alert"
          style={{ background: "var(--success-light)", color: "var(--success-dark)" }}
        >
          <i className="ti ti-circle-check" />
          {bulkResult}
        </div>
      )}

      {/* Table + bulk bar */}
      <div className="card">
        <div className={`bulk-bar${selectedIds.size > 0 ? " show" : ""}`}>
          <span className="bulk-count">
            {selectedIds.size} {pick(lang, T.selected)}
          </span>
          <button
            className="btn btn-sm btn-primary"
            disabled={bulkBusy}
            onClick={() => void handleBulkApprove()}
          >
            <i className="ti ti-checks" />
            {bulkBusy ? pick(lang, T.bulkApproving) : pick(lang, T.bulkApprove)}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={clearSelection}>
            {pick(lang, T.clear)}
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
                    aria-label={pick(lang, T.selectAll)}
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                  />
                </th>
                <th>{pick(lang, T.colId)}</th>
                <th>{pick(lang, T.colType)}</th>
                <th>{pick(lang, T.colTitle)}</th>
                <th>{pick(lang, T.colOperator)}</th>
                <th>{pick(lang, T.colCountry)}</th>
                <th>{pick(lang, T.colSubmitted)}</th>
                <th style={{ textAlign: "right" }}>{pick(lang, T.colActions)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}
                  >
                    {loading ? pick(lang, T.loading) : pick(lang, T.empty)}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const opName = r.company?.name ?? null;
                  const busy = busyId === r.id;
                  return (
                    <tr key={r.id} style={{ cursor: "default" }}>
                      <td className="check-cell">
                        <input
                          type="checkbox"
                          className="row-check"
                          aria-label={`${pick(lang, T.selectOne)} #${r.id}`}
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelected(r.id)}
                        />
                      </td>
                      <td className="font-mono">#{r.id}</td>
                      <td>
                        <span className="type-badge">{typeLabel(lang, r.type)}</span>
                      </td>
                      <td className="font-semibold">{r.title}</td>
                      <td>
                        {opName ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span className={`avatar ${avatarTone(r.id)}`}>{initials(opName)}</span>
                            {opName}
                          </div>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                      <td className="cell-muted">{r.company?.country ?? "—"}</td>
                      <td
                        className="cell-muted"
                        title={r.submitted_for_review_at ?? undefined}
                      >
                        {formatDateTime(r.submitted_for_review_at, lang)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            title={pick(lang, T.approve)}
                            disabled={busy}
                            onClick={() => void handleApprove(r)}
                          >
                            <i className="ti ti-check" />
                          </button>
                          <button
                            className="icon-btn danger"
                            title={pick(lang, T.reject)}
                            disabled={busy}
                            onClick={() => openReject(r)}
                          >
                            <i className="ti ti-x" />
                          </button>
                          <a
                            className="icon-btn"
                            title={pick(lang, T.view)}
                            href={`/platform/offers/${r.id}`}
                          >
                            <i className="ti ti-eye" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.last_page > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              {pick(lang, T.showing)} {firstIdx}–{lastIdx} {pick(lang, T.of)} {meta.total}
            </span>
            <div className="pagination-controls">
              <button
                className="btn btn-sm"
                disabled={meta.current_page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {pick(lang, T.prev)}
              </button>
              <button className="btn btn-sm btn-primary">{meta.current_page}</button>
              <button
                className="btn btn-sm"
                disabled={meta.current_page >= meta.last_page}
                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              >
                {pick(lang, T.next)}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject offer modal */}
      <div className={`modal-overlay${rejectOffer ? " open" : ""}`}>
        <div className="modal" style={{ width: 460 }}>
          <div className="modal-header">
            <div className="modal-title">{pick(lang, T.modalTitle)}</div>
            <button className="icon-btn" title={pick(lang, T.cancel)} onClick={closeReject}>
              <i className="ti ti-x" />
            </button>
          </div>
          <div className="modal-body">
            {rejectOffer && (
              <div className="cell-muted" style={{ marginBottom: 12, fontSize: 13 }}>
                #{rejectOffer.id} — {rejectOffer.title}
              </div>
            )}
            <div className="fld">
              <span className="fld-label">
                {pick(lang, T.reasonLabel)}{" "}
                <span className="fld-hint" style={{ display: "inline" }}>
                  {pick(lang, T.reasonHint)}
                </span>
              </span>
              <textarea
                value={rejectReason}
                maxLength={1000}
                placeholder={pick(lang, T.reasonPh)}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={closeReject}>
              {pick(lang, T.cancel)}
            </button>
            <button
              className="btn btn-danger"
              disabled={
                rejectReason.trim().length < 3 ||
                (rejectOffer != null && busyId === rejectOffer.id)
              }
              onClick={() => void submitReject()}
            >
              <i className="ti ti-x" />
              {pick(lang, T.reject)}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
