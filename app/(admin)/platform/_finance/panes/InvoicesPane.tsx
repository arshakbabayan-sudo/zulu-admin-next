"use client";

/**
 * Finance → Invoices pane (admin v3). 1:1 port of #pane-invoices from
 * docs/admin_designe/6_Finance/finance.html (lines 973–1007) plus its detail
 * drawer (#invoiceDrawer) and create modal (#invoiceModal).
 *
 * Pure management.css presentation — no admin Tailwind, no `--admin-*`, no
 * @/components/ui*. Wiring mirrors app/(admin)/platform/invoices/page.tsx:
 *  - GET /invoices (paginated, status/from/to server-side; search client-side)
 *  - GET /platform-admin/invoices/stats (KPI cards)
 *  - POST issue / pay / send-reminder / cancel  (status-gated, confirm-guarded)
 *  - POST /invoices (New invoice) via an order typeahead
 *  - GET /invoices/export (Export CSV)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiInvoices,
  apiStoreInvoice,
  apiIssueInvoice,
  apiCancelInvoice,
  apiPayInvoice,
  apiSendInvoiceReminder,
  apiSearchOrdersForInvoice,
  downloadInvoicesCsv,
  type InvoiceRow,
  type InvoiceOrderSearchRow,
} from "@/lib/invoices-api";
import { apiInvoicesStats, type InvoicesStats } from "@/lib/finance-stats-api";
import type { FinancePaneProps } from "../types";
import { financeStrings, pick } from "../finance-i18n";
import {
  money,
  fmtDate,
  fmtDateTime,
  initials,
  avatarTone,
  statusBadgeCls,
  titleCase,
} from "../finance-helpers";

const STATUS_OPTS = ["", "draft", "issued", "paid", "cancelled", "overdue"] as const;
type StatusOpt = (typeof STATUS_OPTS)[number];

const PER_PAGE = 20;

/** A `due_date` is "late" when it's in the past and the invoice isn't closed. */
function isOverdueDue(due: string | null | undefined, status: string): boolean {
  if (status === "overdue") return true;
  if (!due || status === "paid" || status === "cancelled") return false;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

export function InvoicesPane({
  token,
  lang,
  registerAction,
  reportCount,
  showToast,
}: FinancePaneProps) {
  const s = financeStrings(lang);
  const confirm = useConfirm();

  // ── pane-local trilingual labels ───────────────────────────────────────────
  const L = useMemo(
    () => ({
      newInvoice: pick(lang, { hy: "Նոր հաշիվ-ապրանքագիր", ru: "Новый счёт", en: "New invoice" }),
      kpiTotal: pick(lang, { hy: "Ընդամենը (30 օր)", ru: "Всего (30 дн.)", en: "Total (30 days)" }),
      kpiPaid: pick(lang, { hy: "Վճարված", ru: "Оплачено", en: "Paid" }),
      kpiOfTotal: pick(lang, { hy: "ընդհանուրից", ru: "от общего", en: "of total" }),
      kpiIssued: pick(lang, { hy: "Դուրս գրված · սպասում է", ru: "Выставлено · в ожидании", en: "Issued · pending" }),
      kpiOverdue: pick(lang, { hy: "Ժամկետանց", ru: "Просрочено", en: "Overdue" }),
      kpiOverdueCount: pick(lang, { hy: "ժամկետանց հաշիվ", ru: "просроченных счетов", en: "overdue invoices" }),
      fltSearch: pick(lang, { hy: "Որոնում", ru: "Поиск", en: "Search" }),
      fltSearchPh: pick(lang, { hy: "Հաշվի համար, ընկերություն…", ru: "Номер счёта, компания…", en: "Invoice number, company…" }),
      fltFrom: pick(lang, { hy: "Սկսած", ru: "С даты", en: "From date" }),
      fltTo: pick(lang, { hy: "Մինչև", ru: "По дату", en: "To date" }),
      stDraft: pick(lang, { hy: "Սևագիր", ru: "Черновик", en: "Draft" }),
      stIssued: pick(lang, { hy: "Դուրս գրված", ru: "Выставлен", en: "Issued" }),
      stPaid: pick(lang, { hy: "Վճարված", ru: "Оплачен", en: "Paid" }),
      stCancelled: pick(lang, { hy: "Չեղարկված", ru: "Отменён", en: "Cancelled" }),
      stOverdue: pick(lang, { hy: "Ժամկետանց", ru: "Просрочен", en: "Overdue" }),
      colInvoiceNumber: pick(lang, { hy: "Հաշվի համար", ru: "Номер счёта", en: "Invoice number" }),
      colIssued: pick(lang, { hy: "Դուրս գրված", ru: "Выставлен", en: "Issued" }),
      colDue: pick(lang, { hy: "Վերջնաժամկետ", ru: "Срок оплаты", en: "Due" }),
      issue: pick(lang, { hy: "Դուրս գրել", ru: "Выставить", en: "Issue" }),
      markPaid: pick(lang, { hy: "Նշել վճարված", ru: "Отметить оплаченным", en: "Mark paid" }),
      sendReminder: pick(lang, { hy: "Ուղարկել հիշեցում", ru: "Отправить напоминание", en: "Send reminder" }),
      detailTitle: pick(lang, { hy: "Հաշվի մանրամասներ", ru: "Детали счёта", en: "Invoice details" }),
      companyInfo: pick(lang, { hy: "Ընկերության տվյալներ", ru: "Данные компании", en: "Company info" }),
      bookingRef: pick(lang, { hy: "Ամրագրման հղում", ru: "Ссылка на бронь", en: "Booking reference" }),
      bookingRefField: pick(lang, { hy: "Ամրագրման համար", ru: "Номер брони", en: "Booking ref" }),
      paidAt: pick(lang, { hy: "Վճարված է", ru: "Оплачен", en: "Paid at" }),
      modalOrder: pick(lang, { hy: "Պատվեր", ru: "Заказ", en: "Order" }),
      orderPh: pick(lang, { hy: "Որոնիր ամրագրումը կամ տեղադրիր պատվերի UUID", ru: "Ищите бронь или вставьте UUID заказа", en: "Search bookings or paste order UUID" }),
      orderHint: pick(lang, {
        hy: "Հաշվի տողերը ինքնաշխատ կազմվում են այս պատվերից։",
        ru: "Строки счёта формируются из этого заказа автоматически.",
        en: "The invoice lines are generated from this order automatically.",
      }),
      searching: pick(lang, { hy: "Որոնում…", ru: "Поиск…", en: "Searching…" }),
      noOrders: pick(lang, { hy: "Պատվերներ չգտնվեցին։", ru: "Заказы не найдены.", en: "No orders found." }),
      clearOrder: pick(lang, { hy: "Մաքրել ընտրված պատվերը", ru: "Очистить выбранный заказ", en: "Clear selected order" }),
      createInvoice: pick(lang, { hy: "Ստեղծել հաշիվ", ru: "Создать счёт", en: "Create invoice" }),
      orderIdRequired: pick(lang, { hy: "Ընտրիր կամ տեղադրիր պատվեր։", ru: "Выберите или вставьте заказ.", en: "Select or paste an order." }),
      okCreated: pick(lang, { hy: "Հաշիվը ստեղծվեց։", ru: "Счёт создан.", en: "Invoice created." }),
      okIssued: pick(lang, { hy: "Հաշիվը դուրս գրվեց։", ru: "Счёт выставлен.", en: "Invoice issued." }),
      okPaid: pick(lang, { hy: "Նշվեց որպես վճարված։", ru: "Отмечено как оплачено.", en: "Marked as paid." }),
      okReminder: pick(lang, { hy: "Հիշեցումը ուղարկվեց։", ru: "Напоминание отправлено.", en: "Reminder sent." }),
      okCancelled: pick(lang, { hy: "Հաշիվը չեղարկվեց։", ru: "Счёт отменён.", en: "Invoice cancelled." }),
      confirmIssueTitle: pick(lang, { hy: "Դուրս գրե՞լ հաշիվը", ru: "Выставить счёт?", en: "Issue invoice?" }),
      confirmIssueMsg: pick(lang, {
        hy: "Սևագիր հաշիվը կդառնա դուրս գրված և կուղարկվի ընկերությանը։",
        ru: "Черновик станет выставленным и будет отправлен компании.",
        en: "The draft becomes issued and is sent to the company.",
      }),
      confirmPaidTitle: pick(lang, { hy: "Նշե՞լ վճարված", ru: "Отметить оплаченным?", en: "Mark paid?" }),
      confirmPaidMsg: pick(lang, {
        hy: "Հաշիվը կնշվի որպես ամբողջությամբ վճարված։",
        ru: "Счёт будет отмечен как полностью оплаченный.",
        en: "The invoice will be marked fully paid.",
      }),
      confirmReminderTitle: pick(lang, { hy: "Ուղարկե՞լ հիշեցում", ru: "Отправить напоминание?", en: "Send reminder?" }),
      confirmReminderMsg: pick(lang, {
        hy: "Ընկերությանը կուղարկվի վճարման հիշեցում։",
        ru: "Компании будет отправлено напоминание об оплате.",
        en: "A payment reminder is sent to the company.",
      }),
      confirmCancelTitle: pick(lang, { hy: "Չեղարկե՞լ հաշիվը", ru: "Отменить счёт?", en: "Cancel invoice?" }),
      confirmCancelMsg: pick(lang, {
        hy: "Սևագիր/դուրս գրված հաշիվները կդառնան չեղարկված։ Այս քայլը հնարավոր չէ հետ բերել։",
        ru: "Черновик/выставленный счёт станет отменённым. Это действие необратимо.",
        en: "Draft/issued invoices become cancelled. This cannot be undone.",
      }),
    }),
    [lang],
  );

  const statusLabel = useCallback(
    (st: string): string => {
      switch (st) {
        case "draft": return L.stDraft;
        case "issued": return L.stIssued;
        case "paid": return L.stPaid;
        case "cancelled": return L.stCancelled;
        case "overdue": return L.stOverdue;
        default: return titleCase(st);
      }
    },
    [L],
  );

  // ── state ──────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [stats, setStats] = useState<InvoicesStats | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusOpt>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [detail, setDetail] = useState<InvoiceRow | null>(null);

  // New-invoice modal + order typeahead
  const [modalOpen, setModalOpen] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderResults, setOrderResults] = useState<InvoiceOrderSearchRow[]>([]);
  const [orderSearching, setOrderSearching] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<InvoiceOrderSearchRow | null>(null);
  const [manualUuid, setManualUuid] = useState("");
  const [creating, setCreating] = useState(false);

  // Ref of latest rows so the (stable) Export action always sees current data.
  const rowsRef = useRef<InvoiceRow[]>([]);
  rowsRef.current = rows;

  // ── data load ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiInvoices(token, {
        page,
        per_page: PER_PAGE,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
      reportCount(res.meta.total);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : s.errLoad);
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, fromDate, toDate, reportCount, s.errLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void apiInvoicesStats(token, "30d")
      .then((res) => {
        if (!cancelled) setStats(res.data);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!token) return;
    try {
      await downloadInvoicesCsv(token, {
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : s.errAction);
    }
  }, [token, statusFilter, fromDate, toDate, showToast, s.errAction]);

  // ── header actions (Refresh · Export CSV · New invoice) ────────────────────
  useEffect(() => {
    registerAction(
      <>
        <button className="btn btn-sm" onClick={() => void load()} type="button">
          <i className="ti ti-refresh" />
          {s.refresh}
        </button>
        <button className="btn btn-sm" onClick={() => void handleExport()} type="button">
          <i className="ti ti-download" />
          {s.exportCsv}
        </button>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)} type="button">
          <i className="ti ti-plus" />
          {L.newInvoice}
        </button>
      </>,
    );
  }, [registerAction, load, handleExport, s.refresh, s.exportCsv, L.newInvoice]);

  // ── order typeahead (debounced 400ms) ──────────────────────────────────────
  useEffect(() => {
    if (!token || !modalOpen || selectedOrder) return;
    const q = orderQuery.trim();
    if (q.length < 2) {
      setOrderResults([]);
      setOrderSearching(false);
      return;
    }
    setOrderSearching(true);
    let cancelled = false;
    const id = setTimeout(() => {
      apiSearchOrdersForInvoice(token, q)
        .then((res) => {
          if (!cancelled) setOrderResults(res.data);
        })
        .catch(() => {
          if (!cancelled) setOrderResults([]);
        })
        .finally(() => {
          if (!cancelled) setOrderSearching(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [token, modalOpen, selectedOrder, orderQuery]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setOrderQuery("");
    setOrderResults([]);
    setOrderSearching(false);
    setSelectedOrder(null);
    setManualUuid("");
  }, []);

  const handleCreate = useCallback(async () => {
    if (!token) return;
    const orderId = (selectedOrder?.id ?? manualUuid).trim();
    if (!orderId) {
      showToast(L.orderIdRequired);
      return;
    }
    setCreating(true);
    try {
      await apiStoreInvoice(token, orderId);
      closeModal();
      await load();
      showToast(L.okCreated);
    } catch (e) {
      showToast(e instanceof ApiRequestError ? e.message : s.errAction);
    } finally {
      setCreating(false);
    }
  }, [token, selectedOrder, manualUuid, showToast, L.orderIdRequired, L.okCreated, closeModal, load, s.errAction]);

  // ── status-gated row actions ───────────────────────────────────────────────
  const runAction = useCallback(
    async (id: number, fn: () => Promise<unknown>, okMsg: string) => {
      setBusyId(id);
      try {
        await fn();
        showToast(okMsg);
        await load();
      } catch (e) {
        showToast(e instanceof ApiRequestError ? e.message : s.errAction);
      } finally {
        setBusyId(null);
      }
    },
    [showToast, load, s.errAction],
  );

  const handleIssue = useCallback(
    async (id: number) => {
      if (!token) return;
      const ok = await confirm({ title: L.confirmIssueTitle, message: L.confirmIssueMsg });
      if (!ok) return;
      await runAction(id, () => apiIssueInvoice(token, id), L.okIssued);
    },
    [token, confirm, runAction, L.confirmIssueTitle, L.confirmIssueMsg, L.okIssued],
  );

  const handlePay = useCallback(
    async (id: number) => {
      if (!token) return;
      const ok = await confirm({ title: L.confirmPaidTitle, message: L.confirmPaidMsg });
      if (!ok) return;
      await runAction(id, () => apiPayInvoice(token, id), L.okPaid);
    },
    [token, confirm, runAction, L.confirmPaidTitle, L.confirmPaidMsg, L.okPaid],
  );

  const handleReminder = useCallback(
    async (id: number) => {
      if (!token) return;
      const ok = await confirm({ title: L.confirmReminderTitle, message: L.confirmReminderMsg });
      if (!ok) return;
      await runAction(id, () => apiSendInvoiceReminder(token, id), L.okReminder);
    },
    [token, confirm, runAction, L.confirmReminderTitle, L.confirmReminderMsg, L.okReminder],
  );

  const handleCancel = useCallback(
    async (id: number) => {
      if (!token) return;
      const ok = await confirm({ title: L.confirmCancelTitle, message: L.confirmCancelMsg, variant: "danger" });
      if (!ok) return;
      await runAction(id, () => apiCancelInvoice(token, id), L.okCancelled);
      setDetail(null);
    },
    [token, confirm, runAction, L.confirmCancelTitle, L.confirmCancelMsg, L.okCancelled],
  );

  // ── client-side search over the current page ───────────────────────────────
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.id).includes(q) ||
        (r.invoice_number ?? "").toLowerCase().includes(q) ||
        (r.company?.name ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  // ── active-filter chips ────────────────────────────────────────────────────
  const chips = useMemo(() => {
    const out: Array<{ key: string; label: string; clear: () => void }> = [];
    if (statusFilter) {
      out.push({
        key: "status",
        label: `${s.status}: ${statusLabel(statusFilter)}`,
        clear: () => {
          setPage(1);
          setStatusFilter("");
        },
      });
    }
    if (fromDate || toDate) {
      const label =
        fromDate && toDate
          ? `${fmtDate(fromDate)} – ${fmtDate(toDate)}`
          : fromDate
            ? `${L.fltFrom}: ${fmtDate(fromDate)}`
            : `${L.fltTo}: ${fmtDate(toDate)}`;
      out.push({
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
      out.push({ key: "search", label: `“${search.trim()}”`, clear: () => setSearch("") });
    }
    return out;
  }, [statusFilter, fromDate, toDate, search, s.status, statusLabel, L.fltFrom, L.fltTo]);

  const clearAll = useCallback(() => {
    setPage(1);
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setSearch("");
  }, []);

  // ── forbidden empty-state ──────────────────────────────────────────────────
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

  const lastPage = meta?.last_page ?? 1;
  const total = meta?.total ?? 0;
  const fromRow = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const toRow = Math.min(page * PER_PAGE, total);

  return (
    <div>
      {/* ── KPI cards ── */}
      <div className="kpi-grid">
        <div className="kpi-card c-primary">
          <div className="kpi-head">
            <span className="kpi-label">
              <i className="ti ti-file-invoice" />
              {L.kpiTotal}
            </span>
          </div>
          <div className="kpi-value">{stats ? stats.total_count.toLocaleString("en-US") : "—"}</div>
        </div>
        <div className="kpi-card c-success">
          <div className="kpi-head">
            <span className="kpi-label">
              <i className="ti ti-circle-check" />
              {L.kpiPaid}
            </span>
          </div>
          <div className="kpi-value">{stats ? stats.paid_count.toLocaleString("en-US") : "—"}</div>
          <div className="kpi-sub">{stats ? `${Math.round(stats.paid_pct)}% ${L.kpiOfTotal}` : "—"}</div>
        </div>
        <div className="kpi-card c-warning">
          <div className="kpi-head">
            <span className="kpi-label">
              <i className="ti ti-clock" />
              {L.kpiIssued}
            </span>
          </div>
          <div className="kpi-value">{stats ? stats.issued_pending_count.toLocaleString("en-US") : "—"}</div>
        </div>
        <div className="kpi-card c-danger">
          <div className="kpi-head">
            <span className="kpi-label">
              <i className="ti ti-alert-triangle" />
              {L.kpiOverdue}
            </span>
          </div>
          <div className="kpi-value">{stats ? money(stats.overdue_amount, "AMD") : "—"}</div>
          <div className="kpi-sub">
            {stats ? `${stats.overdue_count.toLocaleString("en-US")} ${L.kpiOverdueCount}` : "—"}
          </div>
        </div>
      </div>

      {/* ── filters ── */}
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{L.fltSearch}</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L.fltSearchPh}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.status}</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as StatusOpt);
            }}
          >
            {STATUS_OPTS.map((st) => (
              <option key={st || "all"} value={st}>
                {st ? statusLabel(st) : s.allStatuses}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{L.fltFrom}</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setPage(1);
              setFromDate(e.target.value);
            }}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{L.fltTo}</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setPage(1);
              setToDate(e.target.value);
            }}
          />
        </div>
        <button className="btn btn-primary" onClick={() => void load()} type="button">
          <i className="ti ti-filter" />
          {s.apply}
        </button>
      </div>

      {/* ── active-filter chips ── */}
      {chips.length > 0 && (
        <div className="chip-row">
          <span style={{ fontSize: 12, color: "var(--text-secondary)", alignSelf: "center" }}>
            {s.activeFilters}
          </span>
          {chips.map((c) => (
            <button key={c.key} className="chip active" onClick={c.clear} type="button">
              {c.label}
              <i className="ti ti-x" style={{ fontSize: 13 }} />
            </button>
          ))}
          <button className="chip" onClick={clearAll} type="button">
            <i className="ti ti-x" style={{ fontSize: 13 }} />
            {s.clearAll}
          </button>
        </div>
      )}

      {/* ── error ── */}
      {err && (
        <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}>
          <i className="ti ti-alert-circle" />
          <span>{err}</span>
        </div>
      )}

      {/* ── table ── */}
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.id}</th>
                <th>{L.colInvoiceNumber}</th>
                <th>{s.status}</th>
                <th className="num">{s.amount}</th>
                <th>{s.company}</th>
                <th>{L.colIssued}</th>
                <th>{L.colDue}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-secondary)" }}>
                    {loading ? s.loading : search.trim() || chips.length > 0 ? s.noMatch : s.empty}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const late = isOverdueDue(r.due_date, r.status);
                  return (
                    <tr key={r.id} onClick={() => setDetail(r)}>
                      <td className="font-mono">#{r.id}</td>
                      <td className="font-mono">{r.invoice_number ?? "—"}</td>
                      <td>
                        <span className={`badge ${statusBadgeCls(r.status)}`}>{statusLabel(r.status)}</span>
                      </td>
                      <td className="num font-mono">{money(r.total_amount, r.currency)}</td>
                      <td>
                        {r.company?.name ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className={`avatar sm ${avatarTone(r.company.id)}`}>
                              {initials(r.company.name)}
                            </span>
                            <span>{r.company.name}</span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-tertiary)" }}>—</span>
                        )}
                      </td>
                      <td>{fmtDate(r.issued_at)}</td>
                      <td style={late ? { color: "var(--danger)", fontWeight: 500 } : undefined}>
                        {fmtDate(r.due_date)}
                      </td>
                      <td className="num">
                        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="icon-btn"
                            title={s.view}
                            onClick={() => setDetail(r)}
                            type="button"
                          >
                            <i className="ti ti-eye" />
                          </button>
                          {r.status === "draft" && (
                            <button
                              className="icon-btn"
                              title={L.issue}
                              disabled={busyId === r.id}
                              onClick={() => void handleIssue(r.id)}
                              type="button"
                            >
                              <i className="ti ti-send" />
                            </button>
                          )}
                          {r.status === "issued" && (
                            <button
                              className="icon-btn"
                              title={L.markPaid}
                              disabled={busyId === r.id}
                              onClick={() => void handlePay(r.id)}
                              type="button"
                            >
                              <i className="ti ti-circle-check" />
                            </button>
                          )}
                          {(r.status === "issued" || r.status === "overdue") && (
                            <button
                              className="icon-btn"
                              title={L.sendReminder}
                              disabled={busyId === r.id}
                              onClick={() => void handleReminder(r.id)}
                              type="button"
                            >
                              <i className="ti ti-bell" />
                            </button>
                          )}
                          {(r.status === "draft" || r.status === "issued") && (
                            <button
                              className="icon-btn danger"
                              title={s.cancel}
                              disabled={busyId === r.id}
                              onClick={() => void handleCancel(r.id)}
                              type="button"
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

        {/* ── pagination ── */}
        <div className="pagination">
          <span className="pagination-info">
            {s.showing} {fromRow}–{toRow} {s.of} {total.toLocaleString("en-US")}
          </span>
          <div className="pagination-controls">
            <button
              className="btn btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              <i className="ti ti-chevron-left" />
            </button>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", alignSelf: "center", padding: "0 6px" }}>
              {page} / {lastPage}
            </span>
            <button
              className="btn btn-sm"
              disabled={page >= lastPage || loading}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              type="button"
            >
              <i className="ti ti-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      {/* ── invoice detail drawer ── */}
      <div className={`drawer-overlay ${detail ? "open" : ""}`} onClick={() => setDetail(null)} />
      <div className={`drawer ${detail ? "open" : ""}`}>
        {detail && (
          <>
            <div className="drawer-header">
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{detail.invoice_number ?? `#${detail.id}`}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  <span className={`badge ${statusBadgeCls(detail.status)}`}>{statusLabel(detail.status)}</span>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setDetail(null)} type="button">
                <i className="ti ti-x" />
              </button>
            </div>

            <div className="drawer-body">
              <div className="drawer-section">{L.detailTitle}</div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">{s.id}</span>
                  <span className="info-value font-mono">#{detail.id}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{L.colInvoiceNumber}</span>
                  <span className="info-value font-mono">{detail.invoice_number ?? "—"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.status}</span>
                  <span className="info-value">
                    <span className={`badge ${statusBadgeCls(detail.status)}`}>{statusLabel(detail.status)}</span>
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.amount}</span>
                  <span className="info-value font-mono">{money(detail.total_amount, detail.currency)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{L.colIssued}</span>
                  <span className="info-value">{fmtDate(detail.issued_at)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{L.colDue}</span>
                  <span
                    className="info-value"
                    style={isOverdueDue(detail.due_date, detail.status) ? { color: "var(--danger)" } : undefined}
                  >
                    {fmtDate(detail.due_date)}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.created}</span>
                  <span className="info-value">{fmtDateTime(detail.created_at)}</span>
                </div>
              </div>

              <div className="drawer-section">{L.companyInfo}</div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">{s.company}</span>
                  <span className="info-value">
                    {detail.company?.name ?? (detail.company?.id ? `#${detail.company.id}` : "—")}
                  </span>
                </div>
              </div>

              {detail.booking && (
                <>
                  <div className="drawer-section">{L.bookingRef}</div>
                  <div className="info-grid">
                    <div className="info-row">
                      <span className="info-label">{L.bookingRefField}</span>
                      <span className="info-value font-mono">
                        {detail.booking.booking_reference ?? `#${detail.booking.id}`}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="drawer-footer" style={{ flexWrap: "wrap" }}>
              {detail.status === "draft" && (
                <button
                  className="btn btn-sm"
                  disabled={busyId === detail.id}
                  onClick={() => void handleIssue(detail.id)}
                  type="button"
                >
                  <i className="ti ti-send" />
                  {L.issue}
                </button>
              )}
              {detail.status === "issued" && (
                <button
                  className="btn btn-sm"
                  disabled={busyId === detail.id}
                  onClick={() => void handlePay(detail.id)}
                  type="button"
                >
                  <i className="ti ti-circle-check" />
                  {L.markPaid}
                </button>
              )}
              {(detail.status === "issued" || detail.status === "overdue") && (
                <button
                  className="btn btn-sm"
                  disabled={busyId === detail.id}
                  onClick={() => void handleReminder(detail.id)}
                  type="button"
                >
                  <i className="ti ti-bell" />
                  {L.sendReminder}
                </button>
              )}
              {(detail.status === "draft" || detail.status === "issued") && (
                <button
                  className="btn btn-sm btn-danger"
                  disabled={busyId === detail.id}
                  onClick={() => void handleCancel(detail.id)}
                  type="button"
                >
                  <i className="ti ti-ban" />
                  {s.cancel}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── new-invoice modal (order picker) ── */}
      <div className={`modal-overlay ${modalOpen ? "open" : ""}`}>
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title">{L.newInvoice}</div>
            <button className="icon-btn" onClick={closeModal} type="button">
              <i className="ti ti-x" />
            </button>
          </div>
          <div className="modal-body">
            <div className="fld">
              <span className="fld-label">
                {L.modalOrder} <span style={{ color: "var(--danger)" }}>*</span>
              </span>
              {selectedOrder ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 12px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-secondary)",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span className="font-mono" style={{ color: "var(--primary)" }}>
                      {selectedOrder.order_number ?? selectedOrder.id}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-secondary)" }}>
                      {[selectedOrder.user?.name, selectedOrder.company?.name].filter(Boolean).join(" · ") || "—"}
                      {selectedOrder.total != null
                        ? ` · ${money(selectedOrder.total, selectedOrder.currency)}`
                        : ""}
                    </span>
                  </span>
                  <button
                    className="icon-btn"
                    title={L.clearOrder}
                    onClick={() => setSelectedOrder(null)}
                    type="button"
                  >
                    <i className="ti ti-x" />
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={orderQuery || manualUuid}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOrderQuery(v);
                    setManualUuid(v);
                  }}
                  placeholder={L.orderPh}
                />
              )}
            </div>

            {!selectedOrder && orderQuery.trim().length >= 2 && (
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 220,
                  overflowY: "auto",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                {orderSearching ? (
                  <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>
                    {L.searching}
                  </div>
                ) : orderResults.length === 0 ? (
                  <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>
                    {L.noOrders}
                  </div>
                ) : (
                  orderResults.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setSelectedOrder(o);
                        setOrderQuery("");
                        setManualUuid("");
                        setOrderResults([]);
                      }}
                      style={{
                        display: "flex",
                        width: "100%",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "9px 12px",
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        borderBottom: "1px solid var(--border-color)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        color: "var(--text-primary)",
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span className="font-mono" style={{ color: "var(--primary)" }}>
                          {o.order_number ?? o.id}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {[o.user?.name, o.company?.name].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </span>
                      <span className="font-mono" style={{ flexShrink: 0, fontWeight: 600 }}>
                        {o.total != null ? money(o.total, o.currency) : "—"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            <div className="fld-hint" style={{ marginTop: 6 }}>
              {L.orderHint}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={closeModal} type="button">
              {s.cancel}
            </button>
            <button
              className="btn btn-primary"
              disabled={creating}
              onClick={() => void handleCreate()}
              type="button"
            >
              <i className="ti ti-check" />
              {creating ? s.saving : L.createInvoice}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
