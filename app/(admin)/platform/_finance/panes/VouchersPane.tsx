"use client";

/**
 * Finance · Vouchers pane (admin v3) — 1:1 port of #pane-vouchers from
 * docs/admin_designe/6_Finance/finance.html (lines 1176–1208) plus the voucher
 * detail drawer (lines 1365–1398).
 *
 * Issued service vouchers across the platform: 4 KPIs (30d window), a status /
 * service-type / search filter, the voucher table, and a right-side detail
 * drawer with the per-scan verification log and a PDF download. Void / Reissue
 * are gated to `issued` vouchers and confirmed via the shared dialog.
 *
 * Contract: same shape as the other Finance panes — management.css only, shell
 * vocabulary via finance-i18n, local trilingual labels via `pick`, list/detail
 * wiring via lib/vouchers-api + lib/finance-stats-api.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiListVouchers,
  apiVoucherDetail,
  apiVoidVoucher,
  apiReissueVoucher,
  type VoucherRow,
  type VoucherDetailResponse,
  type VerificationLogRow,
} from "@/lib/vouchers-api";
import { apiVouchersStats, type VouchersStats } from "@/lib/finance-stats-api";
import { financeStrings, pick } from "../finance-i18n";
import {
  fmtDate,
  fmtDateTime,
  initials,
  avatarTone,
  statusBadgeCls,
  titleCase,
} from "../finance-helpers";
import type { FinancePaneProps } from "../types";

const PER_PAGE = 25;

const STATUS_OPTIONS = ["", "issued", "used", "void", "reissued", "expired"] as const;
const SERVICE_OPTIONS = [
  "",
  "hotel",
  "flight",
  "transfer",
  "car",
  "excursion",
  "visa",
  "insurance",
  "package",
] as const;

type StatusOption = (typeof STATUS_OPTIONS)[number];
type ServiceOption = (typeof SERVICE_OPTIONS)[number];

export function VouchersPane({
  token,
  lang,
  registerAction,
  reportCount,
  showToast,
}: FinancePaneProps) {
  const s = financeStrings(lang);
  const confirm = useConfirm();

  // ── local trilingual labels (pane-specific vocabulary) ──────────────────
  const L = {
    kpiTotal: pick(lang, { hy: "Ընդամենը (30 օր)", ru: "Всего (30 дней)", en: "Total (30 days)" }),
    kpiActive: pick(lang, { hy: "Ակտիվ · դուրս գրված", ru: "Активные · выпущенные", en: "Active · issued" }),
    kpiVerif: pick(lang, { hy: "Ստուգումներ (7 օր)", ru: "Проверки (7 дней)", en: "Verifications (7d)" }),
    kpiVoided: pick(lang, { hy: "Չեղարկված", ru: "Аннулированные", en: "Voided" }),

    fStatus: pick(lang, { hy: "Կարգավիճակ", ru: "Статус", en: "Status" }),
    fService: pick(lang, { hy: "Ծառայության տեսակ", ru: "Тип услуги", en: "Service type" }),
    fSearch: pick(lang, { hy: "Որոնում", ru: "Поиск", en: "Search" }),
    searchPh: pick(lang, { hy: "Վաուչերի համար, անուն…", ru: "Номер ваучера, имя…", en: "Voucher number, holder…" }),
    allStatuses: pick(lang, { hy: "Բոլոր կարգավիճակները", ru: "Все статусы", en: "All statuses" }),
    allServices: pick(lang, { hy: "Բոլոր ծառայությունները", ru: "Все услуги", en: "All services" }),

    cNumber: pick(lang, { hy: "Համար", ru: "Номер", en: "Number" }),
    cService: pick(lang, { hy: "Ծառայություն", ru: "Услуга", en: "Service" }),
    cHolder: pick(lang, { hy: "Տիրապետող", ru: "Держатель", en: "Holder" }),
    cStatus: pick(lang, { hy: "Կարգավիճակ", ru: "Статус", en: "Status" }),
    cValid: pick(lang, { hy: "Վավեր", ru: "Действителен", en: "Valid" }),
    cScans: pick(lang, { hy: "Ստուգում", ru: "Сканы", en: "Scans" }),
    cCreated: pick(lang, { hy: "Ստեղծված", ru: "Создан", en: "Created" }),

    secHolder: pick(lang, { hy: "Տիրապետողի տվյալներ", ru: "Данные держателя", en: "Holder information" }),
    secVoucher: pick(lang, { hy: "Վաուչերի մանրամասներ", ru: "Детали ваучера", en: "Voucher details" }),
    secVerif: pick(lang, { hy: "Ստուգման մատյան", ru: "Журнал проверок", en: "Verification log" }),
    secFiles: pick(lang, { hy: "Ֆայլեր", ru: "Файлы", en: "Files" }),

    lName: pick(lang, { hy: "Անուն", ru: "Имя", en: "Name" }),
    lOrder: pick(lang, { hy: "Պատվեր", ru: "Заказ", en: "Order" }),
    lLanguage: pick(lang, { hy: "Լեզու", ru: "Язык", en: "Language" }),
    lServiceType: pick(lang, { hy: "Ծառայության տեսակ", ru: "Тип услуги", en: "Service type" }),
    lIssuer: pick(lang, { hy: "Թողարկող", ru: "Эмитент", en: "Issuer" }),
    lValid: pick(lang, { hy: "Վավեր", ru: "Действителен", en: "Valid" }),
    lUsedAt: pick(lang, { hy: "Օգտագործված է", ru: "Использован", en: "Used at" }),
    lScanCount: pick(lang, { hy: "Ստուգումների քանակ", ru: "Кол-во сканов", en: "Scan count" }),
    lReissuedFrom: pick(lang, { hy: "Վերաթողարկված է #", ru: "Перевыпущен из #", en: "Reissued from" }),

    vWhen: pick(lang, { hy: "Երբ", ru: "Когда", en: "When" }),
    vIp: pick(lang, { hy: "IP", ru: "IP", en: "IP" }),
    vResult: pick(lang, { hy: "Արդյունք", ru: "Результат", en: "Result" }),
    rValid: pick(lang, { hy: "Հաջող", ru: "Успешно", en: "Valid" }),
    rRescan: pick(lang, { hy: "Կրկնասկան", ru: "Пересканирование", en: "Re-scan" }),
    noScans: pick(lang, { hy: "Ստուգումներ դեռ չկան։", ru: "Проверок пока нет.", en: "No scans yet." }),

    downloadPdf: pick(lang, { hy: "Ներբեռնել վաուչերի PDF", ru: "Скачать PDF ваучера", en: "Download voucher PDF" }),
    noPdf: pick(lang, { hy: "PDF հասանելի չէ", ru: "PDF недоступен", en: "No PDF available" }),

    void: pick(lang, { hy: "Չեղարկել", ru: "Аннулировать", en: "Void" }),
    reissue: pick(lang, { hy: "Վերաթողարկել", ru: "Перевыпустить", en: "Reissue" }),
    confirmVoid: pick(lang, {
      hy: "Չեղարկե՞լ այս վաուչերը։ Այն կդառնա անվավեր։",
      ru: "Аннулировать этот ваучер? Он станет недействительным.",
      en: "Void this voucher? It will become invalid.",
    }),
    confirmReissue: pick(lang, {
      hy: "Վերաթողարկե՞լ այս վաուչերը նոր համարով։",
      ru: "Перевыпустить этот ваучер с новым номером?",
      en: "Reissue this voucher with a new number?",
    }),
    voided: pick(lang, { hy: "Վաուչերը չեղարկվեց", ru: "Ваучер аннулирован", en: "Voucher voided" }),
    reissued: pick(lang, { hy: "Վաուչերը վերաթողարկվեց", ru: "Ваучер перевыпущен", en: "Voucher reissued" }),
  };

  const statusLabel = useCallback(
    (st: string): string => {
      const m: Record<string, { hy: string; ru: string; en: string }> = {
        issued: { hy: "Դուրս գրված", ru: "Выпущен", en: "Issued" },
        used: { hy: "Օգտագործված", ru: "Использован", en: "Used" },
        void: { hy: "Չեղարկված", ru: "Аннулирован", en: "Void" },
        reissued: { hy: "Վերաթողարկված", ru: "Перевыпущен", en: "Reissued" },
        expired: { hy: "Ժամկետանց", ru: "Истёк", en: "Expired" },
      };
      return m[st] ? pick(lang, m[st]!) : titleCase(st);
    },
    [lang],
  );

  const serviceLabel = useCallback(
    (svc: string): string => {
      const m: Record<string, { hy: string; ru: string; en: string }> = {
        hotel: { hy: "Հյուրանոց", ru: "Отель", en: "Hotel" },
        flight: { hy: "Ավիատոմս", ru: "Авиабилет", en: "Flight" },
        transfer: { hy: "Տրանսֆեր", ru: "Трансфер", en: "Transfer" },
        car: { hy: "Ավտոմեքենա", ru: "Авто", en: "Car" },
        excursion: { hy: "Էքսկուրսիա", ru: "Экскурсия", en: "Excursion" },
        visa: { hy: "Վիզա", ru: "Виза", en: "Visa" },
        insurance: { hy: "Ապահովագրություն", ru: "Страховка", en: "Insurance" },
        package: { hy: "Փաթեթ", ru: "Пакет", en: "Package" },
      };
      return m[svc] ? pick(lang, m[svc]!) : titleCase(svc);
    },
    [lang],
  );

  // ── list state ──────────────────────────────────────────────────────────
  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<VouchersStats | null>(null);

  const [status, setStatus] = useState<StatusOption>("");
  const [serviceType, setServiceType] = useState<ServiceOption>("");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── drawer state ─────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<VoucherRow | null>(null);
  const [logs, setLogs] = useState<VerificationLogRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // latest rows for the CSV export action (stable registerAction deps)
  const rowsRef = useRef<VoucherRow[]>([]);
  rowsRef.current = rows;
  const reloadRef = useRef(0);
  const [reload, setReload] = useState(0);
  reloadRef.current = reload;

  // ── load list ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setForbidden(false);

    void (async () => {
      try {
        const res = await apiListVouchers(token, {
          page,
          per_page: PER_PAGE,
          status: status || undefined,
          service_type: serviceType || undefined,
          q: q.trim() || undefined,
        });
        if (cancelled) return;
        const list = res.data ?? [];
        setRows(list);
        setMeta(res.meta ?? null);
        reportCount(res.meta?.total);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) {
          setForbidden(true);
          setRows([]);
          setMeta(null);
          reportCount(undefined);
        } else {
          setError(e instanceof Error ? e.message : s.errLoad);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, page, status, serviceType, q, reload, reportCount, s.errLoad]);

  // ── load KPI stats (30d window) ───────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void apiVouchersStats(token, "30d")
      .then((res) => {
        if (!cancelled) setStats(res.data);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, reload]);

  // ── page-header actions: Refresh + Export CSV ─────────────────────────────
  useEffect(() => {
    const exportCsv = () => {
      const list = rowsRef.current;
      if (list.length === 0) return;
      const headers = [
        "id",
        "voucher_number",
        "service_type",
        "status",
        "holder_name",
        "language",
        "valid_from",
        "valid_to",
        "used_at",
        "verification_count",
        "created_at",
      ];
      const esc = (v: unknown) => {
        const str = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      };
      const lines = [
        headers.join(","),
        ...list.map((r) =>
          [
            r.id,
            r.voucher_number,
            r.service_type,
            r.status,
            r.holder_name,
            r.language,
            r.valid_from ?? "",
            r.valid_to ?? "",
            r.used_at ?? "",
            r.verification_count,
            r.created_at,
          ]
            .map(esc)
            .join(","),
        ),
      ];
      const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vouchers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };

    registerAction(
      <>
        <button className="btn" onClick={() => setReload((n) => n + 1)}>
          <i className="ti ti-refresh" />
          {s.refresh}
        </button>
        <button className="btn" onClick={exportCsv}>
          <i className="ti ti-download" />
          {s.exportCsv}
        </button>
      </>,
    );
  }, [registerAction, s.refresh, s.exportCsv]);

  // ── open detail drawer ────────────────────────────────────────────────────
  const openDetail = useCallback(
    (row: VoucherRow) => {
      if (!token) return;
      setSelected(row);
      setLogs([]);
      setDetailLoading(true);
      void (async () => {
        try {
          const res = await apiVoucherDetail(token, row.id);
          const data = res.data as VoucherDetailResponse;
          setSelected(data.voucher);
          setLogs(data.verification_logs ?? []);
        } catch (e) {
          setError(e instanceof Error ? e.message : s.errLoad);
        } finally {
          setDetailLoading(false);
        }
      })();
    },
    [token, s.errLoad],
  );

  const closeDrawer = useCallback(() => {
    setSelected(null);
    setLogs([]);
  }, []);

  // ESC closes the drawer
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, closeDrawer]);

  // ── void / reissue ────────────────────────────────────────────────────────
  const onVoid = useCallback(async () => {
    if (!token || !selected) return;
    const ok = await confirm({ message: L.confirmVoid, variant: "danger" });
    if (!ok) return;
    setActionBusy(true);
    try {
      const res = await apiVoidVoucher(token, selected.id);
      setSelected(res.data as VoucherRow);
      showToast(L.voided);
      setReload((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errAction);
    } finally {
      setActionBusy(false);
    }
  }, [token, selected, confirm, L.confirmVoid, L.voided, showToast, s.errAction]);

  const onReissue = useCallback(async () => {
    if (!token || !selected) return;
    const ok = await confirm({ message: L.confirmReissue });
    if (!ok) return;
    setActionBusy(true);
    try {
      const res = await apiReissueVoucher(token, selected.id);
      setSelected(res.data as VoucherRow);
      showToast(L.reissued);
      setReload((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errAction);
    } finally {
      setActionBusy(false);
    }
  }, [token, selected, confirm, L.confirmReissue, L.reissued, showToast, s.errAction]);

  // ── active filter chips ────────────────────────────────────────────────────
  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (status) {
    chips.push({
      key: "status",
      label: `${L.fStatus}: ${statusLabel(status)}`,
      clear: () => {
        setStatus("");
        setPage(1);
      },
    });
  }
  if (serviceType) {
    chips.push({
      key: "service",
      label: `${L.fService}: ${serviceLabel(serviceType)}`,
      clear: () => {
        setServiceType("");
        setPage(1);
      },
    });
  }
  if (q.trim()) {
    chips.push({
      key: "q",
      label: `${L.fSearch}: "${q.trim()}"`,
      clear: () => {
        setQ("");
        setPage(1);
      },
    });
  }

  // ── forbidden empty-state (403) ────────────────────────────────────────────
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

  const currentPage = meta?.current_page ?? page;
  const lastPage = meta?.last_page ?? 1;
  const total = meta?.total ?? rows.length;
  const fromN = total === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1;
  const toN = Math.min(currentPage * PER_PAGE, total);

  const statusBadge = (st: string) => (
    <span className={`badge ${statusBadgeCls(st)}`}>{statusLabel(st)}</span>
  );

  return (
    <div>
      {error && (
        <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}>
          <i className="ti ti-alert-triangle" />
          <span>{error}</span>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="kpi-grid">
        <div className="kpi-card c-primary">
          <div className="kpi-head">
            <span className="kpi-label">
              <i className="ti ti-ticket" />
              {L.kpiTotal}
            </span>
          </div>
          <div className="kpi-value">{stats ? stats.total_count.toLocaleString() : total.toLocaleString()}</div>
        </div>
        <div className="kpi-card c-success">
          <div className="kpi-head">
            <span className="kpi-label">
              <i className="ti ti-circle-check" />
              {L.kpiActive}
            </span>
          </div>
          <div className="kpi-value">{stats ? stats.active_issued_count.toLocaleString() : "—"}</div>
        </div>
        <div className="kpi-card c-info">
          <div className="kpi-head">
            <span className="kpi-label">
              <i className="ti ti-eye-check" />
              {L.kpiVerif}
            </span>
          </div>
          <div className="kpi-value">{stats ? stats.verifications_7d.toLocaleString() : "—"}</div>
        </div>
        <div className="kpi-card c-danger">
          <div className="kpi-head">
            <span className="kpi-label">
              <i className="ti ti-ban" />
              {L.kpiVoided}
            </span>
          </div>
          <div className="kpi-value">{stats ? stats.voided_count.toLocaleString() : "—"}</div>
        </div>
      </div>

      {/* ── filter ── */}
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{L.fSearch}</span>
          <input
            type="search"
            value={q}
            placeholder={L.searchPh}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{L.fStatus}</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusOption);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt || "all"} value={opt}>
                {opt ? statusLabel(opt) : L.allStatuses}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{L.fService}</span>
          <select
            value={serviceType}
            onChange={(e) => {
              setServiceType(e.target.value as ServiceOption);
              setPage(1);
            }}
          >
            {SERVICE_OPTIONS.map((opt) => (
              <option key={opt || "all"} value={opt}>
                {opt ? serviceLabel(opt) : L.allServices}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── active filter chips ── */}
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

      {/* ── table ── */}
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{L.cNumber}</th>
                <th>{L.cService}</th>
                <th>{L.cHolder}</th>
                <th>{L.cStatus}</th>
                <th>{L.cValid}</th>
                <th>{L.cScans}</th>
                <th>{L.cCreated}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                    {s.loading}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                    {chips.length > 0 ? s.noMatch : s.empty}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} onClick={() => openDetail(r)}>
                    <td className="font-mono">{r.voucher_number}</td>
                    <td>
                      <span className="badge badge-gray">{serviceLabel(r.service_type)}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={`avatar sm ${avatarTone(r.holder_name)}`}>{initials(r.holder_name)}</span>
                        <span>{r.holder_name}</span>
                      </div>
                    </td>
                    <td>{statusBadge(r.status)}</td>
                    <td className="cell-muted">
                      {r.valid_from || r.valid_to ? `${fmtDate(r.valid_from)} – ${fmtDate(r.valid_to)}` : "—"}
                    </td>
                    <td className="font-mono" style={{ fontWeight: 600 }}>
                      {r.verification_count}
                    </td>
                    <td className="cell-muted">{fmtDate(r.created_at)}</td>
                    <td>
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn" title={s.view} onClick={() => openDetail(r)}>
                          <i className="ti ti-eye" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span className="pagination-info">
            {s.showing} {fromN}–{toN} {s.of} {total.toLocaleString()}
          </span>
          <div className="pagination-controls">
            <button className="btn btn-sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <i className="ti ti-chevron-left" />
            </button>
            <button className="btn btn-sm btn-primary" disabled>
              {currentPage}
            </button>
            <button
              className="btn btn-sm"
              disabled={currentPage >= lastPage}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            >
              <i className="ti ti-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      {/* ── detail drawer ── */}
      <div className={`drawer-overlay ${selected ? "open" : ""}`} onClick={closeDrawer} />
      <div className={`drawer ${selected ? "open" : ""}`} role="dialog" aria-label={s.tabVouchers}>
        {selected && (
          <>
            <div className="drawer-header">
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }} className="font-mono">
                  {selected.voucher_number}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, display: "flex", gap: 8, alignItems: "center" }}>
                  {statusBadge(selected.status)}
                  <span>
                    {serviceLabel(selected.service_type)} · {(selected.language || "").toUpperCase()}
                  </span>
                </div>
              </div>
              <button className="icon-btn" onClick={closeDrawer}>
                <i className="ti ti-x" />
              </button>
            </div>

            <div className="drawer-body">
              {/* Holder */}
              <div className="drawer-section">{L.secHolder}</div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">{L.lName}</span>
                  <span className="info-value">{selected.holder_name || "—"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{L.lOrder}</span>
                  <span className="info-value font-mono">
                    {selected.order?.order_number ?? (selected.order_id ? `#${selected.order_id}` : "—")}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">{L.lLanguage}</span>
                  <span className="info-value">{(selected.language || "—").toUpperCase()}</span>
                </div>
              </div>

              {/* Voucher details */}
              <div className="drawer-section">{L.secVoucher}</div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">{L.lServiceType}</span>
                  <span className="info-value">{serviceLabel(selected.service_type)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{L.lIssuer}</span>
                  <span className="info-value">{selected.issuer_company?.name ?? "—"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{L.lValid}</span>
                  <span className="info-value">
                    {selected.valid_from || selected.valid_to
                      ? `${fmtDate(selected.valid_from)} – ${fmtDate(selected.valid_to)}`
                      : "—"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">{L.lUsedAt}</span>
                  <span className="info-value">{fmtDateTime(selected.used_at)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{L.lScanCount}</span>
                  <span className="info-value font-mono">{selected.verification_count}</span>
                </div>
                {selected.reissued_from_id != null && (
                  <div className="info-row">
                    <span className="info-label">{L.lReissuedFrom}</span>
                    <span className="info-value font-mono">#{selected.reissued_from_id}</span>
                  </div>
                )}
              </div>

              {/* Verification log */}
              <div className="drawer-section">
                {L.secVerif}
                {logs.length > 0 ? ` (${logs.length})` : ""}
              </div>
              {detailLoading ? (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.loading}</div>
              ) : logs.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{L.noScans}</div>
              ) : (
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>{L.vWhen}</th>
                      <th>{L.vIp}</th>
                      <th>{L.vResult}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const valid = (log.result || "").toLowerCase() === "valid";
                      return (
                        <tr key={log.id}>
                          <td>{fmtDateTime(log.verified_at)}</td>
                          <td className="font-mono">{log.verifier_ip ?? "—"}</td>
                          <td>
                            <span className={`badge ${valid ? "badge-success" : "badge-warning"}`}>
                              {valid ? L.rValid : log.result ? titleCase(log.result) : L.rRescan}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Files */}
              <div className="drawer-section">{L.secFiles}</div>
              {selected.pdf_url ? (
                <a className="btn btn-sm" href={selected.pdf_url} target="_blank" rel="noopener noreferrer">
                  <i className="ti ti-file-type-pdf" />
                  {L.downloadPdf}
                </a>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{L.noPdf}</div>
              )}
            </div>

            <div className="drawer-footer">
              <button className="btn" onClick={closeDrawer}>
                {s.close}
              </button>
              <span style={{ flex: 1 }} />
              {selected.status === "issued" && (
                <>
                  <button className="btn btn-danger btn-sm" disabled={actionBusy} onClick={() => void onVoid()}>
                    <i className="ti ti-ban" />
                    {L.void}
                  </button>
                  <button className="btn btn-primary btn-sm" disabled={actionBusy} onClick={() => void onReissue()}>
                    <i className="ti ti-refresh" />
                    {L.reissue}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
