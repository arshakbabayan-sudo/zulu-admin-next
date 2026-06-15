"use client";

/**
 * Finance — "Per-X invoicing" pane (super-admin only).
 *
 * 1:1 port of #pane-perx in docs/admin_designe/6_Finance/finance.html
 * (lines 1209–1240): a per-currency totals `.cur-chips` strip, a group-by
 * `.filter-card` control, and a `.card`/`.table` whose columns rebuild from the
 * selected group-by. When grouped by operator, each row carries a per-operator
 * monthly Statement (PDF) download.
 *
 * Read-only analytics over existing invoices. The aggregate has an implicit
 * current-month window — the active month (computed in the browser) drives the
 * statement + CSV filenames and is shown explicitly as a caption.
 *
 * Wiring copied from the legacy app/(admin)/bucket3/per-x-invoicing/page.tsx:
 *   GET /invoices/aggregate?group_by={k}  → buckets
 *   GET /invoices/export                  → CSV blob (invoices-{YYYY-MM}.csv)
 *   GET /invoices/statement?company_id&month → per-operator PDF statement
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/api-base";
import type { ApiSuccessEnvelope } from "@/lib/api-envelope";
import { financeStrings, pick } from "../finance-i18n";
import { money } from "../finance-helpers";
import type { FinancePaneProps } from "../types";

type GroupBy = "operator" | "month" | "currency" | "status";

type Bucket = {
  bucket: string | number | null;
  label: string | null;
  currency: string | null;
  invoice_count: number;
  total_sum: number;
};

type AggregateResponse = {
  group_by: GroupBy;
  buckets: Bucket[];
};

/** Current month as YYYY-MM (browser-local) — drives statement + CSV filenames. */
function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Fetch a binary response (PDF / CSV) with the bearer token and trigger a
 * browser download. Local replica of the legacy page's `downloadBlob` helper so
 * this pane stays self-contained.
 */
async function downloadBlob(
  path: string,
  token: string | null,
  filename: string,
): Promise<void> {
  if (!token) return;
  const base = getApiBaseUrl().replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
  });
  if (!res.ok) {
    throw new ApiRequestError(`HTTP ${res.status}`, res.status);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

export function PerxPane({
  token,
  lang,
  registerAction,
  showToast,
}: FinancePaneProps) {
  const s = financeStrings(lang);
  const month = useMemo(() => thisMonth(), []);

  const [groupBy, setGroupBy] = useState<GroupBy>("operator");
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // local trilingual labels (pane-specific; shell vocabulary lives in finance-i18n)
  const L = {
    groupBy: pick(lang, { hy: "Խմբավորել ըստ", ru: "Группировать по", en: "Group by" }),
    optOperator: pick(lang, { hy: "Օպերատոր", ru: "Оператор", en: "Operator" }),
    optMonth: pick(lang, { hy: "Ամիս", ru: "Месяц", en: "Month" }),
    optCurrency: pick(lang, { hy: "Արժույթ", ru: "Валюта", en: "Currency" }),
    optStatus: pick(lang, { hy: "Կարգավիճակ", ru: "Статус", en: "Status" }),
    totals: pick(lang, { hy: "Ընդամենը", ru: "Итого", en: "Totals" }),
    bucket: pick(lang, { hy: "Խումբ", ru: "Группа", en: "Bucket" }),
    invoices: pick(lang, { hy: "Հաշիվներ", ru: "Счета", en: "Invoices" }),
    total: pick(lang, { hy: "Ընդհանուր", ru: "Всего", en: "Total" }),
    statement: pick(lang, { hy: "Քաղվածք", ru: "Выписка", en: "Statement" }),
    invShort: pick(lang, { hy: "հաշիվ", ru: "сч.", en: "inv" }),
    monthCaption: pick(lang, {
      hy: "Ակտիվ ամիս",
      ru: "Активный месяц",
      en: "Active month",
    }),
    forbidden: pick(lang, {
      hy: "Դուք այս բաժնի հասանելիություն չունեք։",
      ru: "У вас нет доступа к этому разделу.",
      en: "You don't have access to this section.",
    }),
  };

  const load = useCallback(
    async (gb: GroupBy) => {
      if (!token) return;
      setLoading(true);
      setErr(null);
      setForbidden(false);
      try {
        const res = await apiFetchJson<ApiSuccessEnvelope<AggregateResponse>>(
          `/invoices/aggregate?group_by=${gb}`,
          { method: "GET", token },
        );
        setBuckets(res.data?.buckets ?? []);
      } catch (e) {
        if (e instanceof ApiRequestError && e.status === 403) {
          setForbidden(true);
        } else {
          setErr(e instanceof ApiRequestError ? e.message : s.errLoad);
        }
        setBuckets([]);
      } finally {
        setLoading(false);
      }
    },
    [token, s.errLoad],
  );

  useEffect(() => {
    void load(groupBy);
  }, [load, groupBy]);

  const downloadCsv = useCallback(async () => {
    try {
      await downloadBlob("/invoices/export", token, `invoices-${month}.csv`);
      showToast(s.exportCsv);
    } catch (e) {
      showToast(e instanceof ApiRequestError ? e.message : s.errAction);
    }
  }, [token, month, showToast, s.exportCsv, s.errAction]);

  const downloadStatement = useCallback(
    async (companyId: number) => {
      try {
        await downloadBlob(
          `/invoices/statement?company_id=${companyId}&month=${month}`,
          token,
          `statement-${companyId}-${month}.pdf`,
        );
        showToast(L.statement);
      } catch (e) {
        showToast(e instanceof ApiRequestError ? e.message : s.errAction);
      }
    },
    [token, month, showToast, L.statement, s.errAction],
  );

  // header actions: Refresh + Export CSV (stable deps)
  useEffect(() => {
    registerAction(
      <>
        <button className="btn" onClick={() => void load(groupBy)}>
          <i className="ti ti-refresh" />
          {s.refresh}
        </button>
        <button className="btn" onClick={() => void downloadCsv()}>
          <i className="ti ti-download" />
          {s.exportCsv}
        </button>
      </>,
    );
  }, [registerAction, load, groupBy, downloadCsv, s.refresh, s.exportCsv]);

  // per-currency totals — NEVER summed across currencies; one chip per currency.
  const totalsByCurrency = useMemo(() => {
    const acc = new Map<string, { sum: number; count: number }>();
    for (const b of buckets) {
      const cur = (b.currency ?? "").toUpperCase() || "—";
      const prev = acc.get(cur) ?? { sum: 0, count: 0 };
      acc.set(cur, {
        sum: prev.sum + (Number(b.total_sum) || 0),
        count: prev.count + (Number(b.invoice_count) || 0),
      });
    }
    return Array.from(acc.entries());
  }, [buckets]);

  const bucketLabel = (b: Bucket): string => {
    if (groupBy === "operator") {
      return b.label ?? `#${b.bucket ?? "?"}`;
    }
    return String(b.bucket ?? "—");
  };

  const showCurrencyCol = groupBy !== "currency";
  const showStatementCol = groupBy === "operator";
  const colCount = 2 + (showCurrencyCol ? 1 : 0) + (showStatementCol ? 1 : 0);

  if (forbidden) {
    return (
      <div className="empty-state">
        <div className="es-icon">
          <i className="ti ti-lock" />
        </div>
        <div className="es-title">{L.forbidden}</div>
      </div>
    );
  }

  return (
    <>
      {/* Totals — per-currency chips */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">{L.totals}</div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {L.monthCaption}: <span className="font-mono">{month}</span>
          </span>
        </div>
        <div className="card-body">
          {totalsByCurrency.length === 0 ? (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {loading ? s.loading : s.empty}
            </span>
          ) : (
            <div className="cur-chips">
              {totalsByCurrency.map(([cur, { sum, count }]) => (
                <span className="cur-chip" key={cur}>
                  {money(sum, cur)}
                  <span className="cc-code">
                    {cur} · {count} {L.invShort}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Group-by control */}
      <div className="filter-card">
        <div className="filter-field" style={{ maxWidth: 240 }}>
          <span className="filter-label">{L.groupBy}</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          >
            <option value="operator">{L.optOperator}</option>
            <option value="month">{L.optMonth}</option>
            <option value="currency">{L.optCurrency}</option>
            <option value="status">{L.optStatus}</option>
          </select>
        </div>
        <button className="btn" onClick={() => void load(groupBy)}>
          <i className="ti ti-refresh" />
          {s.refresh}
        </button>
      </div>

      {err && (
        <div
          className="alert"
          style={{
            marginBottom: 16,
            background: "var(--danger-light)",
            color: "var(--danger-dark)",
          }}
        >
          <i className="ti ti-alert-circle" />
          {err}
        </div>
      )}

      {/* Aggregate table — columns rebuild from the group-by */}
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{L.bucket}</th>
                {showCurrencyCol && <th>{s.currency}</th>}
                <th className="num">{L.invoices}</th>
                <th className="num">{L.total}</th>
                {showStatementCol && <th className="num">{L.statement}</th>}
              </tr>
            </thead>
            <tbody>
              {buckets.length === 0 ? (
                <tr>
                  <td
                    colSpan={colCount}
                    style={{
                      textAlign: "center",
                      padding: "32px 16px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {loading ? s.loading : s.empty}
                  </td>
                </tr>
              ) : (
                buckets.map((b, i) => (
                  <tr key={`${b.bucket ?? "null"}-${b.currency ?? ""}-${i}`}>
                    <td>{bucketLabel(b)}</td>
                    {showCurrencyCol && (
                      <td>{(b.currency ?? "").toUpperCase() || "—"}</td>
                    )}
                    <td className="num font-mono">{b.invoice_count}</td>
                    <td className="num font-mono">
                      {money(b.total_sum, b.currency)}
                    </td>
                    {showStatementCol && (
                      <td className="num">
                        <button
                          className="icon-btn"
                          title={L.statement}
                          aria-label={L.statement}
                          onClick={() =>
                            void downloadStatement(Number(b.bucket))
                          }
                        >
                          <i className="ti ti-file-text" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
