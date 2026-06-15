"use client";

/**
 * Finance — Payments pane (admin v3). 1:1 port of the `#pane-payments` block in
 * docs/admin_designe/6_Finance/finance.html (lines 1008–1042): 4 KPI cards,
 * a filter-card, a card-wrapped table with pagination, and a payment-detail
 * drawer.
 *
 * Migrated from app/(admin)/platform/payments/page.tsx — same backend wiring
 * (apiPlatformPayments + apiPaymentsStats + retry/receipt helpers) re-homed onto
 * the shared FinancePaneProps contract. Status/from/to are server-side filters;
 * method + free-text search are applied client-side over the loaded page.
 *
 * Payments is a count-less tab — reportCount is intentionally never called so
 * the shell renders no pill on the Payments section-tab.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FinancePaneProps } from "../types";
import { financeStrings, pick } from "../finance-i18n";
import {
  money,
  fmtDateTime,
  initials,
  avatarTone,
  statusBadgeCls,
  titleCase,
} from "../finance-helpers";
import type { ApiListMeta } from "@/lib/api-envelope";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiPlatformPayments,
  downloadPaymentsCsv,
  type PlatformPaymentRow,
} from "@/lib/platform-admin-api";
import {
  apiPaymentsStats,
  apiRetryPayment,
  downloadPaymentReceiptPdf,
  type PaymentsStats,
} from "@/lib/finance-stats-api";

const PER_PAGE = 20;

const STATUS_OPTIONS = ["", "pending", "processing", "paid", "failed", "refunded", "cancelled"] as const;
const METHOD_OPTIONS = ["", "bank_transfer", "card", "wallet", "cash"] as const;

type L = { hy: string; ru: string; en: string };

/** Trilingual labels for this pane (status / method names + chrome bits). */
const STATUS_LABEL: Record<string, L> = {
  pending: { hy: "Սպասում", ru: "Ожидание", en: "Pending" },
  processing: { hy: "Մշակվում", ru: "В обработке", en: "Processing" },
  paid: { hy: "Վճարված", ru: "Оплачено", en: "Paid" },
  failed: { hy: "Ձախողված", ru: "Сбой", en: "Failed" },
  refunded: { hy: "Վերադարձված", ru: "Возврат", en: "Refunded" },
  cancelled: { hy: "Չեղարկված", ru: "Отменено", en: "Cancelled" },
};

const METHOD_LABEL: Record<string, L> = {
  bank_transfer: { hy: "Բանկային փոխանցում", ru: "Банковский перевод", en: "Bank transfer" },
  card: { hy: "Քարտ", ru: "Карта", en: "Card" },
  wallet: { hy: "Դրամապանակ", ru: "Кошелёк", en: "Wallet" },
  cash: { hy: "Կանխիկ", ru: "Наличные", en: "Cash" },
};

const T = {
  method: { hy: "Վճարման եղանակ", ru: "Способ оплаты", en: "Payment method" },
  allMethods: { hy: "Բոլոր եղանակները", ru: "Все способы", en: "All methods" },
  from: { hy: "Սկսած", ru: "С", en: "From" },
  to: { hy: "Մինչև", ru: "По", en: "To" },
  searchPh: { hy: "Վճարման ID, հղման կոդ, ամրագրման կոդ…", ru: "ID платежа, код ссылки, код брони…", en: "Payment ID, reference, booking ref…" },
  totalKpi: { hy: "Ընդամենը (30 օր)", ru: "Всего (30 дней)", en: "Total (30 days)" },
  paidKpi: { hy: "Վճարված (այս ամիս)", ru: "Оплачено (за месяц)", en: "Paid (this month)" },
  pendingKpi: { hy: "Սպասվող (բաց)", ru: "Ожидают (открыто)", en: "Pending (open)" },
  failedKpi: { hy: "Ձախողված (7 օր)", ru: "Сбой (7 дней)", en: "Failed (7 days)" },
  paymentsWord: { hy: "վճարում", ru: "платежей", en: "payments" },
  colPaidAt: { hy: "Վճարված է", ru: "Оплачено", en: "Paid at" },
  colMethod: { hy: "Եղանակ", ru: "Способ", en: "Method" },
  colInvoice: { hy: "Հաշիվ", ru: "Счёт", en: "Invoice" },
  downloadReceipt: { hy: "Ներբեռնել անդորրագիրը", ru: "Скачать квитанцию", en: "Download receipt" },
  retry: { hy: "Կրկնել", ru: "Повторить", en: "Retry" },
  retryOk: { hy: "Վճարման փորձը վերսկսված է։", ru: "Платёж запущен повторно.", en: "Retry initiated." },
  receiptErr: { hy: "Անդորրագիրը չհաջողվեց ներբեռնել։", ru: "Не удалось скачать квитанцию.", en: "Receipt download failed." },
  drawerTitle: { hy: "Վճարում", ru: "Платёж", en: "Payment" },
  secDetails: { hy: "Վճարման մանրամասներ", ru: "Детали платежа", en: "Payment details" },
  secInvoice: { hy: "Հաշիվ-ապրանքագիր", ru: "Счёт", en: "Invoice" },
  reference: { hy: "Հղման կոդ", ru: "Код ссылки", en: "Reference" },
  bookingRef: { hy: "Ամրագրման կոդ", ru: "Код брони", en: "Booking reference" },
} satisfies Record<string, L>;

function methodLabel(lang: string, method?: string | null): string {
  if (!method) return "—";
  const m = METHOD_LABEL[method];
  return m ? pick(lang, m) : titleCase(method);
}

function statusLabel(lang: string, status?: string | null): string {
  if (!status) return "—";
  const m = STATUS_LABEL[status];
  return m ? pick(lang, m) : titleCase(status);
}

function companyOf(r: PlatformPaymentRow): { id: number; name: string } | null {
  const c = r.invoice?.company ?? r.invoice?.agent_company;
  return c ?? null;
}

function invoiceRef(r: PlatformPaymentRow): string {
  if (r.invoice?.unique_booking_reference) return r.invoice.unique_booking_reference;
  if (r.invoice?.id) return `#${r.invoice.id}`;
  if (r.invoice_id) return `#${r.invoice_id}`;
  return "—";
}

export function PaymentsPane({ token, lang, registerAction, showToast }: FinancePaneProps) {
  const s = financeStrings(lang);

  const [rows, setRows] = useState<PlatformPaymentRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [stats, setStats] = useState<PaymentsStats | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // filters
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");

  const [detail, setDetail] = useState<PlatformPaymentRow | null>(null);

  // server-side filter inputs (status/from/to drive the request)
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformPayments(token, {
        page,
        per_page: PER_PAGE,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : s.errLoad);
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, fromDate, toDate, s.errLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void apiPaymentsStats(token, "30d")
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

  // registerAction: Refresh + Export CSV. Use a ref so the export closure always
  // reads the live filters without re-registering the action node every keystroke.
  const filtersRef = useRef({ statusFilter, fromDate, toDate });
  filtersRef.current = { statusFilter, fromDate, toDate };
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const onRefresh = () => void loadRef.current();
    const onExport = async () => {
      if (!token) return;
      try {
        await downloadPaymentsCsv(token, {
          status: filtersRef.current.statusFilter || undefined,
          from: filtersRef.current.fromDate || undefined,
          to: filtersRef.current.toDate || undefined,
        });
      } catch (e) {
        showToast(e instanceof Error ? e.message : s.errAction);
      }
    };
    registerAction(
      <>
        <button className="btn" onClick={onRefresh}>
          <i className="ti ti-refresh" />
          {s.refresh}
        </button>
        <button className="btn btn-primary" onClick={() => void onExport()}>
          <i className="ti ti-download" />
          {s.exportCsv}
        </button>
      </>,
    );
  }, [registerAction, token, showToast, s.refresh, s.exportCsv, s.errAction]);

  // client-side method + search filtering over the loaded page
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (methodFilter && r.payment_method !== methodFilter) return false;
      if (q) {
        const hay = [
          String(r.id),
          r.reference_code ?? "",
          r.invoice?.unique_booking_reference ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, methodFilter, search]);

  const chips = useMemo(() => {
    const out: Array<{ key: string; label: string; clear: () => void }> = [];
    if (statusFilter)
      out.push({
        key: "status",
        label: `${s.status}: ${statusLabel(lang, statusFilter)}`,
        clear: () => {
          setStatusFilter("");
          setPage(1);
        },
      });
    if (methodFilter)
      out.push({
        key: "method",
        label: `${pick(lang, T.method)}: ${methodLabel(lang, methodFilter)}`,
        clear: () => setMethodFilter(""),
      });
    if (fromDate)
      out.push({
        key: "from",
        label: `${pick(lang, T.from)}: ${fromDate}`,
        clear: () => {
          setFromDate("");
          setPage(1);
        },
      });
    if (toDate)
      out.push({
        key: "to",
        label: `${pick(lang, T.to)}: ${toDate}`,
        clear: () => {
          setToDate("");
          setPage(1);
        },
      });
    if (search.trim())
      out.push({
        key: "search",
        label: `${s.search}: "${search.trim()}"`,
        clear: () => setSearch(""),
      });
    return out;
  }, [statusFilter, methodFilter, fromDate, toDate, search, lang, s.status, s.search]);

  async function onRetry(r: PlatformPaymentRow) {
    if (!token) return;
    try {
      await apiRetryPayment(token, r.id);
      showToast(pick(lang, T.retryOk));
      void load();
    } catch (e) {
      showToast(e instanceof ApiRequestError ? e.message : s.errAction);
    }
  }

  async function onReceipt(r: PlatformPaymentRow) {
    if (!token) return;
    try {
      await downloadPaymentReceiptPdf(token, r.id);
    } catch (e) {
      showToast(e instanceof Error ? e.message : pick(lang, T.receiptErr));
    }
  }

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

  const totalForPager = meta?.total ?? visibleRows.length;
  const firstIdx = meta ? (meta.current_page - 1) * meta.per_page + 1 : 1;
  const lastIdx = meta ? Math.min(meta.current_page * meta.per_page, meta.total) : visibleRows.length;

  return (
    <>
      {/* KPI cards */}
      <div className="kpi-grid">
        <div className="kpi-card c-primary">
          <div className="kpi-label">
            <i className="ti ti-credit-card" />
            {pick(lang, T.totalKpi)}
          </div>
          <div className="kpi-value">{stats ? stats.total_count.toLocaleString("en-US") : "—"}</div>
        </div>
        <div className="kpi-card c-success">
          <div className="kpi-label">
            <i className="ti ti-circle-check" />
            {pick(lang, T.paidKpi)}
          </div>
          <div className="kpi-value">{stats ? money(stats.paid_amount, "AMD") : "—"}</div>
          <div className="kpi-sub">
            {stats ? `${stats.paid_count.toLocaleString("en-US")} ${pick(lang, T.paymentsWord)}` : "—"}
          </div>
        </div>
        <div className="kpi-card c-warning">
          <div className="kpi-label">
            <i className="ti ti-clock" />
            {pick(lang, T.pendingKpi)}
          </div>
          <div className="kpi-value">{stats ? money(stats.pending_amount, "AMD") : "—"}</div>
          <div className="kpi-sub">
            {stats ? `${stats.pending_count.toLocaleString("en-US")} ${pick(lang, T.paymentsWord)}` : "—"}
          </div>
        </div>
        <div className="kpi-card c-danger">
          <div className="kpi-label">
            <i className="ti ti-x" />
            {pick(lang, T.failedKpi)}
          </div>
          <div className="kpi-value">{stats ? money(stats.failed_amount, "AMD") : "—"}</div>
          <div className="kpi-sub">
            {stats ? `${stats.failed_count.toLocaleString("en-US")} ${pick(lang, T.paymentsWord)}` : "—"}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input
            type="search"
            value={search}
            placeholder={pick(lang, T.searchPh)}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.status}</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt ? statusLabel(lang, opt) : s.allStatuses}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{pick(lang, T.method)}</span>
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
            {METHOD_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt ? methodLabel(lang, opt) : pick(lang, T.allMethods)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{pick(lang, T.from)}</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{pick(lang, T.to)}</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <button className="btn" onClick={() => void load()}>
          <i className="ti ti-filter" />
          {s.apply}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="chip-row">
          {chips.map((c) => (
            <button key={c.key} className="chip active" onClick={c.clear}>
              {c.label}
              <i className="ti ti-x" />
            </button>
          ))}
        </div>
      )}

      {err && (
        <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}>
          <i className="ti ti-alert-circle" />
          {err}
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.id}</th>
                <th className="num">{s.amount}</th>
                <th>{s.currency}</th>
                <th>{s.status}</th>
                <th>{pick(lang, T.colMethod)}</th>
                <th>{s.company}</th>
                <th>{pick(lang, T.colPaidAt)}</th>
                <th>{pick(lang, T.colInvoice)}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                    {loading ? s.loading : rows.length === 0 ? s.empty : s.noMatch}
                  </td>
                </tr>
              ) : (
                visibleRows.map((r) => {
                  const co = companyOf(r);
                  return (
                    <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => setDetail(r)}>
                      <td className="font-mono">#{r.id}</td>
                      <td className="num font-mono">{money(r.amount, r.currency)}</td>
                      <td>{r.currency ? r.currency.toUpperCase() : "—"}</td>
                      <td>
                        <span className={`badge ${statusBadgeCls(r.status)}`}>{statusLabel(lang, r.status)}</span>
                      </td>
                      <td>{methodLabel(lang, r.payment_method)}</td>
                      <td>
                        {co ? (
                          <span className="flex items-center gap-2">
                            <span className={`avatar sm ${avatarTone(co.id)}`}>{initials(co.name)}</span>
                            {co.name}
                          </span>
                        ) : (
                          <span className="muted-dash">—</span>
                        )}
                      </td>
                      <td>{r.paid_at ? fmtDateTime(r.paid_at) : "—"}</td>
                      <td className="font-mono">{invoiceRef(r)}</td>
                      <td className="num">
                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            title={s.view}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetail(r);
                            }}
                          >
                            <i className="ti ti-eye" />
                          </button>
                          {r.status === "paid" && (
                            <button
                              className="icon-btn"
                              title={pick(lang, T.downloadReceipt)}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onReceipt(r);
                              }}
                            >
                              <i className="ti ti-download" />
                            </button>
                          )}
                          {r.status === "failed" && (
                            <button
                              className="icon-btn"
                              title={pick(lang, T.retry)}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onRetry(r);
                              }}
                            >
                              <i className="ti ti-refresh" />
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
        {meta && meta.last_page > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              {s.showing} {firstIdx}–{lastIdx} {s.of} {totalForPager}
            </span>
            <div className="pagination-controls">
              <button
                className="btn btn-sm"
                disabled={meta.current_page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <i className="ti ti-chevron-left" />
              </button>
              <button className="btn btn-sm btn-primary">{meta.current_page}</button>
              <button
                className="btn btn-sm"
                disabled={meta.current_page >= meta.last_page}
                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              >
                <i className="ti ti-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <div className={`drawer-overlay ${detail ? "open" : ""}`} onClick={() => setDetail(null)} />
      <div className={`drawer ${detail ? "open" : ""}`}>
        {detail && (
          <>
            <div className="drawer-header">
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {pick(lang, T.drawerTitle)} #{detail.id}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  <span className={`badge ${statusBadgeCls(detail.status)}`}>{statusLabel(lang, detail.status)}</span>
                </div>
              </div>
              <button className="icon-btn" title={s.close} onClick={() => setDetail(null)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="drawer-body">
              <div className="drawer-section">{pick(lang, T.secDetails)}</div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">{s.id}</span>
                  <span className="info-value font-mono">#{detail.id}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.amount}</span>
                  <span className="info-value font-mono">{money(detail.amount, detail.currency)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.currency}</span>
                  <span className="info-value">{detail.currency ? detail.currency.toUpperCase() : "—"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.status}</span>
                  <span className="info-value">
                    <span className={`badge ${statusBadgeCls(detail.status)}`}>{statusLabel(lang, detail.status)}</span>
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">{pick(lang, T.colMethod)}</span>
                  <span className="info-value">{methodLabel(lang, detail.payment_method)}</span>
                </div>
                {detail.reference_code && (
                  <div className="info-row">
                    <span className="info-label">{pick(lang, T.reference)}</span>
                    <span className="info-value font-mono">{detail.reference_code}</span>
                  </div>
                )}
                <div className="info-row">
                  <span className="info-label">{pick(lang, T.colPaidAt)}</span>
                  <span className="info-value">{detail.paid_at ? fmtDateTime(detail.paid_at) : "—"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.created}</span>
                  <span className="info-value">{detail.created_at ? fmtDateTime(detail.created_at) : "—"}</span>
                </div>
              </div>

              {(detail.invoice || detail.invoice_id) && (
                <>
                  <div className="drawer-section">{pick(lang, T.secInvoice)}</div>
                  <div className="info-grid">
                    <div className="info-row">
                      <span className="info-label">{s.id}</span>
                      <span className="info-value font-mono">#{detail.invoice?.id ?? detail.invoice_id}</span>
                    </div>
                    {detail.invoice?.unique_booking_reference && (
                      <div className="info-row">
                        <span className="info-label">{pick(lang, T.bookingRef)}</span>
                        <span className="info-value font-mono">{detail.invoice.unique_booking_reference}</span>
                      </div>
                    )}
                    <div className="info-row">
                      <span className="info-label">{s.company}</span>
                      <span className="info-value">{companyOf(detail)?.name ?? "—"}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
