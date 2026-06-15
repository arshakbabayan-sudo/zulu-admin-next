"use client";

/**
 * Finance — SUMMARY pane (admin v3, 1:1 port of #pane-summary in
 * docs/admin_designe/6_Finance/finance.html lines 872–972).
 *
 * Read-only dashboard. Structure reproduced verbatim from the mock:
 *   - 3 `.fin-hero` cards (revenue · commissions · pending) in `.fin-hero-grid`
 *   - `.dash-grid-2`: Revenue-by-service `.breakdown` bars + Collection-rate `.donut`
 *   - `.dash-grid-2`: Payment-methods `.breakdown` + Quick-action `.tiles`
 *   - Recent-transactions `.card` > `.table` (latest 8)
 *
 * Header action slot carries a `.range-select` (7d/30d/90d/year), Refresh,
 * Export-CSV (client-side, recent transactions), and a server-rendered PDF.
 * Every amount is per-currency (helpers.money) and NEVER summed across
 * currencies. Wiring follows the legacy finance-summary/page.tsx 1:1.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiFinanceSummaryV2,
  apiRevenueByService,
  apiPaymentMethods,
  apiRecentTransactions,
  downloadFinanceSummaryPdf,
  type FinanceRange,
  type FinanceSummaryV2,
  type RevenueByServiceRow,
  type PaymentMethodsBreakdown,
  type RecentTransactionRow,
} from "@/lib/finance-stats-api";
import { apiPlatformFinanceSummary, type PlatformFinanceSummary } from "@/lib/platform-admin-api";
import { financeStrings, pick } from "../finance-i18n";
import { money, fmtDateTime, initials, avatarTone, statusBadgeCls, titleCase } from "../finance-helpers";
import type { FinancePaneProps } from "../types";

const RANGE_KEYS: FinanceRange[] = ["7d", "30d", "90d", "year"];

/** Service → icon + bd-fill tone (mock order: hotels/flights/packages/transfers/…). */
const SERVICE_META: Record<string, { icon: string; tone: string; color: string }> = {
  hotel: { icon: "ti-bed", tone: "tone-primary", color: "var(--primary)" },
  hotels: { icon: "ti-bed", tone: "tone-primary", color: "var(--primary)" },
  flight: { icon: "ti-plane", tone: "tone-info", color: "var(--info)" },
  flights: { icon: "ti-plane", tone: "tone-info", color: "var(--info)" },
  package: { icon: "ti-package", tone: "tone-success", color: "var(--success)" },
  packages: { icon: "ti-package", tone: "tone-success", color: "var(--success)" },
  transfer: { icon: "ti-car", tone: "tone-warning", color: "var(--warning)" },
  transfers: { icon: "ti-car", tone: "tone-warning", color: "var(--warning)" },
  car: { icon: "ti-car", tone: "tone-warning", color: "var(--warning)" },
  excursion: { icon: "ti-mountain", tone: "tone-300", color: "var(--primary)" },
  excursions: { icon: "ti-mountain", tone: "tone-300", color: "var(--primary)" },
  visa: { icon: "ti-id-badge-2", tone: "tone-300", color: "var(--primary)" },
  insurance: { icon: "ti-shield-check", tone: "", color: "var(--text-tertiary)" },
};

/** Cycling tone for the payment-methods bars (no fixed icon there). */
const METHOD_TONES = ["tone-primary", "tone-info", "tone-success", "tone-warning", "tone-300"];

export function SummaryPane({ token, lang, registerAction, showToast }: FinancePaneProps) {
  const s = financeStrings(lang);

  // pane-specific trilingual labels (plain product-Armenian, no Cyrillic)
  const L = {
    rangeOpt: (k: FinanceRange): string =>
      pick(lang, {
        hy: { "7d": "Վերջին 7 օր", "30d": "Վերջին 30 օր", "90d": "Վերջին 90 օր", year: "Այս տարի" }[k],
        ru: { "7d": "За 7 дней", "30d": "За 30 дней", "90d": "За 90 дней", year: "За год" }[k],
        en: { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", year: "This year" }[k],
      }),
    pdf: pick(lang, { hy: "PDF ներբեռնել", ru: "Скачать PDF", en: "Download PDF" }),
    totalRevenue: pick(lang, { hy: "Ընդհանուր եկամուտ", ru: "Общий доход", en: "Total revenue" }),
    commissionsAccrued: pick(lang, { hy: "Հաշվարկված միջնորդավճար", ru: "Начисленные комиссии", en: "Commissions accrued" }),
    pendingPayments: pick(lang, { hy: "Սպասվող վճարումներ", ru: "Ожидающие платежи", en: "Pending payments" }),
    platform: pick(lang, { hy: "Հարթակ", ru: "Платформа", en: "Platform" }),
    agent: pick(lang, { hy: "Գործակալ", ru: "Агент", en: "Agent" }),
    pendingMeta: (count: number, avg: number): string =>
      pick(lang, {
        hy: `${count} սպասվող · միջ. տարիք ${avg} օր`,
        ru: `${count} ожидает · ср. возраст ${avg} дн.`,
        en: `${count} pending · avg age ${avg} days`,
      }),
    revenueByService: pick(lang, { hy: "Եկամուտ ըստ ծառայության", ru: "Доход по услугам", en: "Revenue by service" }),
    topServices: pick(lang, { hy: "Առաջատար ծառայություններ", ru: "Топ услуги", en: "Top services" }),
    collectionRate: pick(lang, { hy: "Հավաքագրման տոկոս", ru: "Уровень сбора", en: "Collection rate" }),
    settledVsPending: pick(lang, { hy: "Փակված ընդդեմ սպասվողի", ru: "Закрыто против ожидающих", en: "Settled vs pending" }),
    collected: pick(lang, { hy: "Հավաքագրված", ru: "Собрано", en: "Collected" }),
    settled: pick(lang, { hy: "Փակված", ru: "Закрыто", en: "Settled" }),
    pending: pick(lang, { hy: "Սպասվող", ru: "Ожидает", en: "Pending" }),
    paymentMethods: pick(lang, { hy: "Վճարման եղանակներ", ru: "Способы оплаты", en: "Payment methods" }),
    topMethods: pick(lang, { hy: "Առաջատար եղանակներ", ru: "Топ способы", en: "Top methods" }),
    quickActions: pick(lang, { hy: "Արագ գործողություններ", ru: "Быстрые действия", en: "Quick actions" }),
    issueInvoice: pick(lang, { hy: "Դուրս գրել հաշիվ", ru: "Выставить счёт", en: "Issue invoice" }),
    recordPayment: pick(lang, { hy: "Գրանցել վճարում", ru: "Записать платёж", en: "Record payment" }),
    issueVoucher: pick(lang, { hy: "Տրամադրել վաուչեր", ru: "Выдать ваучер", en: "Issue voucher" }),
    recentTransactions: pick(lang, { hy: "Վերջին գործարքները", ru: "Последние транзакции", en: "Recent transactions" }),
    last8: pick(lang, { hy: "Վերջին 8-ը՝ բոլոր տեսակների գծով", ru: "Последние 8 по всем типам", en: "Latest 8 across all service types" }),
    colType: pick(lang, { hy: "Տեսակ", ru: "Тип", en: "Type" }),
    colWhen: pick(lang, { hy: "Երբ", ru: "Когда", en: "When" }),
    txType: (t: RecentTransactionRow["type"]): string =>
      pick(lang, {
        hy: {
          payment_in: "Մուտքային վճարում",
          commission: "Միջնորդավճար",
          refund: "Վերադարձ",
          voucher_issued: "Վաուչեր տրված",
          payout: "Վճարում դուրս",
        }[t],
        ru: {
          payment_in: "Входящий платёж",
          commission: "Комиссия",
          refund: "Возврат",
          voucher_issued: "Ваучер выдан",
          payout: "Выплата",
        }[t],
        en: {
          payment_in: "Payment in",
          commission: "Commission",
          refund: "Refund",
          voucher_issued: "Voucher issued",
          payout: "Payout",
        }[t],
      }),
    exportedToast: pick(lang, {
      hy: "Վերջին գործարքները արտահանվեցին CSV-ով",
      ru: "Последние транзакции экспортированы в CSV",
      en: "Exported recent transactions to CSV",
    }),
    pdfToast: pick(lang, { hy: "Ամփոփ PDF-ը պատրաստվում է…", ru: "Готовится сводный PDF…", en: "Generating summary PDF…" }),
  };

  const [summary, setSummary] = useState<PlatformFinanceSummary | null>(null);
  const [v2, setV2] = useState<FinanceSummaryV2 | null>(null);
  const [revenue, setRevenue] = useState<RevenueByServiceRow[]>([]);
  const [methods, setMethods] = useState<PaymentMethodsBreakdown | null>(null);
  const [recent, setRecent] = useState<RecentTransactionRow[]>([]);
  const [range, setRange] = useState<FinanceRange>("30d");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // latest snapshots for the export handlers, so the registerAction effect
  // doesn't need data in its dep list.
  const recentRef = useRef<RecentTransactionRow[]>(recent);
  recentRef.current = recent;
  const rangeRef = useRef<FinanceRange>(range);
  rangeRef.current = range;

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setForbidden(false);
    try {
      const [resSummary, resV2, resRev, resMethods, resTx] = await Promise.all([
        apiPlatformFinanceSummary(token),
        apiFinanceSummaryV2(token, range),
        apiRevenueByService(token, range),
        apiPaymentMethods(token, range),
        apiRecentTransactions(token, 8),
      ]);
      setSummary(resSummary.data);
      setV2(resV2.data);
      setRevenue(resRev.data);
      setMethods(resMethods.data);
      setRecent(resTx.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : s.errLoad);
    }
  }, [token, range, s.errLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  // client-side CSV of the recent-transactions snapshot.
  const exportCsv = useCallback((): void => {
    const rows = recentRef.current;
    if (rows.length === 0) return;
    const esc = (v: unknown): string => {
      const str = v == null ? "" : String(v);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const headers = ["id", "type", "amount", "currency", "company", "when", "status"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(
        [r.id, r.type, r.amount, r.currency, r.company?.name ?? "", r.when, r.status].map(esc).join(","),
      );
    }
    const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-summary-transactions-${rangeRef.current}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const downloadPdf = useCallback(async (): Promise<void> => {
    if (!token) return;
    setPdfBusy(true);
    showToast(L.pdfToast);
    try {
      await downloadFinanceSummaryPdf(token, rangeRef.current);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errLoad);
    } finally {
      setPdfBusy(false);
    }
    // L.pdfToast / showToast intentionally read fresh on each call; deps stay stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, s.errLoad]);

  // header action slot — range select + Refresh + Export CSV + PDF
  useEffect(() => {
    registerAction(
      <>
        <select
          className="range-select"
          value={range}
          onChange={(e) => setRange(e.target.value as FinanceRange)}
        >
          {RANGE_KEYS.map((k) => (
            <option key={k} value={k}>
              {L.rangeOpt(k)}
            </option>
          ))}
        </select>
        <button className="btn btn-sm" title={s.refresh} onClick={() => void load()}>
          <i className="ti ti-refresh" />
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            exportCsv();
            showToast(L.exportedToast);
          }}
        >
          <i className="ti ti-download" /> {s.exportCsv}
        </button>
        <button className="btn btn-primary btn-sm" disabled={pdfBusy} onClick={() => void downloadPdf()}>
          <i className={`ti ${pdfBusy ? "ti-loader-2" : "ti-file-type-pdf"}`} /> {L.pdf}
        </button>
      </>,
    );
    // L.* / range read fresh each render via the closure; the listed deps are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerAction, load, s, showToast, range, pdfBusy, exportCsv, downloadPdf]);

  if (forbidden) {
    return (
      <div className="empty-state">
        <div className="es-icon"><i className="ti ti-lock" /></div>
        <div className="es-title">{s.forbidden}</div>
      </div>
    );
  }

  // collection-rate donut: paid / (paid + pending). Falls back to 100% with no pending.
  const paid = summary?.total_payments_paid ?? 0;
  const pendingAmt = summary?.total_commission_pending ?? 0;
  const denom = paid + pendingAmt;
  const collectionPct = denom > 0 ? Math.round((paid / denom) * 100) : 100;

  // commission split → segment widths
  const splitPlatform = v2?.commission_split.platform ?? 0;
  const splitAgent = v2?.commission_split.agent ?? 0;
  const splitTotal = splitPlatform + splitAgent;
  const platformPct = splitTotal > 0 ? Math.round((splitPlatform / splitTotal) * 100) : 50;
  const agentPct = 100 - platformPct;

  const currencyChips = v2 ? Object.entries(v2.currency_breakdown) : [];

  return (
    <div>
      {err && (
        <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}>
          <i className="ti ti-alert-triangle" />
          <div>{err}</div>
        </div>
      )}

      {/* ── 3 hero cards ─────────────────────────────────────────────── */}
      <div className="fin-hero-grid">
        <div className="fin-hero tone-primary">
          <div className="fh-label"><i className="ti ti-cash" />{L.totalRevenue}</div>
          <div className="fh-value">{money(summary?.total_payments_paid, "AMD")}</div>
          <div className="fh-sub">
            {currencyChips.length > 0 ? (
              <div className="cur-chips">
                {currencyChips.map(([cur, amt]) => (
                  <span className="cur-chip" key={cur}>
                    {money(amt, cur)} <span className="cc-code">{cur.toUpperCase()}</span>
                  </span>
                ))}
              </div>
            ) : (
              "—"
            )}
          </div>
        </div>

        <div className="fin-hero tone-success">
          <div className="fh-label"><i className="ti ti-coins" />{L.commissionsAccrued}</div>
          <div className="fh-value">{money(summary?.total_commission_accrued, "AMD")}</div>
          <div className="fh-sub">
            {v2 ? (
              <>
                <div className="split-bar">
                  <div className="split-seg platform" style={{ width: `${platformPct}%` }} />
                  <div className="split-seg agent" style={{ width: `${agentPct}%` }} />
                </div>
                <div className="split-legend">
                  <span className="dl-row" style={{ fontSize: 12 }}>
                    <span className="dl-dot" style={{ background: "var(--primary)" }} />
                    {L.platform} {money(splitPlatform, "AMD")}
                  </span>
                  <span className="dl-row" style={{ fontSize: 12 }}>
                    <span className="dl-dot" style={{ background: "var(--primary-300)" }} />
                    {L.agent} {money(splitAgent, "AMD")}
                  </span>
                </div>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>

        <div className="fin-hero tone-warning">
          <div className="fh-label"><i className="ti ti-clock-dollar" />{L.pendingPayments}</div>
          <div className="fh-value">{money(summary?.total_commission_pending, "AMD")}</div>
          <div className="fh-sub">
            {v2 && v2.pending_meta.count > 0
              ? L.pendingMeta(v2.pending_meta.count, Math.round(v2.pending_meta.avg_age_days))
              : "—"}
          </div>
        </div>
      </div>

      {/* ── Revenue by service + Collection rate ─────────────────────── */}
      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{L.revenueByService}</div>
              <div className="card-subtitle">{L.topServices} · {L.rangeOpt(range)}</div>
            </div>
          </div>
          <div className="card-body">
            {revenue.length === 0 ? (
              <div className="empty-state"><div className="es-title">{s.empty}</div></div>
            ) : (
              <div className="breakdown">
                {revenue.slice(0, 6).map((row) => {
                  const meta = SERVICE_META[row.service.toLowerCase()] ?? {
                    icon: "ti-circle",
                    tone: "tone-300",
                    color: "var(--text-tertiary)",
                  };
                  return (
                    <div className="bd-row" key={row.service}>
                      <div className="bd-head">
                        <span className="bd-name">
                          <i className={`ti ${meta.icon}`} style={{ color: meta.color }} />
                          {titleCase(row.service)}
                        </span>
                        <span className="bd-val">{money(row.amount, "AMD")}</span>
                      </div>
                      <div className="bd-track">
                        <div
                          className={`bd-fill ${meta.tone}`}
                          style={
                            meta.tone
                              ? { width: `${Math.min(row.pct, 100)}%` }
                              : { width: `${Math.min(row.pct, 100)}%`, background: meta.color }
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{L.collectionRate}</div>
              <div className="card-subtitle">{L.settledVsPending}</div>
            </div>
          </div>
          <div className="card-body">
            <div className="donut-wrap">
              <div
                className="donut"
                style={{
                  background: `conic-gradient(var(--success) 0% ${collectionPct}%, var(--warning-light) ${collectionPct}% 100%)`,
                }}
              >
                <div className="donut-hole">
                  <span className="dh-pct">{collectionPct}%</span>
                  <span className="dh-cap">{L.collected}</span>
                </div>
              </div>
              <div className="donut-legend">
                <div className="dl-row">
                  <span className="dl-dot" style={{ background: "var(--success)" }} />
                  {L.settled}<span className="dl-val">{money(paid, "AMD")}</span>
                </div>
                <div className="dl-row">
                  <span className="dl-dot" style={{ background: "var(--warning)" }} />
                  {L.pending}<span className="dl-val">{money(pendingAmt, "AMD")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment methods + Quick actions ──────────────────────────── */}
      <div className="dash-grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{L.paymentMethods}</div>
              <div className="card-subtitle">{L.topMethods} · {L.rangeOpt(range)}</div>
            </div>
          </div>
          <div className="card-body">
            {!methods || methods.breakdown.length === 0 ? (
              <div className="empty-state"><div className="es-title">{s.empty}</div></div>
            ) : (
              <div className="breakdown">
                {methods.breakdown.slice(0, 5).map((m, i) => (
                  <div className="bd-row" key={m.method}>
                    <div className="bd-head">
                      <span className="bd-name">{titleCase(m.method)}</span>
                      <span className="bd-val">{m.pct}%</span>
                    </div>
                    <div className="bd-track">
                      <div
                        className={`bd-fill ${METHOD_TONES[i % METHOD_TONES.length]}`}
                        style={{ width: `${Math.min(m.pct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div><div className="card-title">{L.quickActions}</div></div></div>
          <div className="card-body">
            <div className="tiles">
              <button className="tile" onClick={() => window.location.assign("/platform/invoices")}>
                <i className="ti ti-file-invoice" />
                <span className="tile-label">{L.issueInvoice}</span>
              </button>
              <button className="tile" onClick={() => window.location.assign("/platform/payments")}>
                <i className="ti ti-credit-card" />
                <span className="tile-label">{L.recordPayment}</span>
              </button>
              <button className="tile" onClick={() => window.location.assign("/platform/vouchers")}>
                <i className="ti ti-ticket" />
                <span className="tile-label">{L.issueVoucher}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent transactions ──────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">{L.recentTransactions}</div>
            <div className="card-subtitle">{L.last8}</div>
          </div>
          <button className="btn btn-sm" onClick={() => { exportCsv(); showToast(L.exportedToast); }}>
            <i className="ti ti-download" /> {s.exportCsv}
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.id}</th>
                <th>{L.colType}</th>
                <th className="num">{s.amount}</th>
                <th>{s.company}</th>
                <th>{L.colWhen}</th>
                <th>{s.status}</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="no-label" style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>
                    {s.empty}
                  </td>
                </tr>
              ) : (
                recent.map((tx) => {
                  const negative = tx.amount < 0;
                  return (
                    <tr key={tx.id}>
                      <td className="font-mono" data-label={s.id}>{tx.id}</td>
                      <td data-label={L.colType}><span className="type-badge">{L.txType(tx.type)}</span></td>
                      <td className={`num font-mono${negative ? " amount-neg" : ""}`} data-label={s.amount}>
                        {money(tx.amount, tx.currency)}
                      </td>
                      <td data-label={s.company}>
                        {tx.company ? (
                          <span className="flex items-center gap-2">
                            <span className={`avatar sm ${avatarTone(tx.company.id)}`}>{initials(tx.company.name)}</span>
                            {tx.company.name}
                          </span>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                      <td className="tx-when" data-label={L.colWhen}>{fmtDateTime(tx.when)}</td>
                      <td data-label={s.status}>
                        <span className={`badge ${statusBadgeCls(tx.status)}`}>{titleCase(tx.status)}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
