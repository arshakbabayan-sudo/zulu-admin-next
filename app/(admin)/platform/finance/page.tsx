"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  apiFinanceSummary, apiFinanceEntitlements, apiFinanceSettlements,
  apiMarkEntitlementsPayable, apiUpdateSettlementStatus,
  type FinanceEntitlementRow, type FinanceSettlementRow, type CompanyFinanceSummary,
} from "@/lib/finance-api";
import { useCallback, useEffect, useState } from "react";

type Tab = "summary" | "entitlements" | "settlements";

export default function FinancePage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const companyOptions = user?.companies ?? [];
  const initialCompanyId = user?.context?.active_company_id ?? companyOptions[0]?.id ?? null;
  const [tab, setTab] = useState<Tab>("summary");
  const [companyId, setCompanyId] = useState<number | null>(initialCompanyId);

  const [summary, setSummary] = useState<CompanyFinanceSummary | null>(null);
  const [entitlements, setEntitlements] = useState<FinanceEntitlementRow[]>([]);
  const [entMeta, setEntMeta] = useState<ApiListMeta | null>(null);
  const [entPage, setEntPage] = useState(1);
  const [settlements, setSettlements] = useState<FinanceSettlementRow[]>([]);
  const [setMeta2, setSetMeta2] = useState<ApiListMeta | null>(null);
  const [setPage2, setSetPage2] = useState(1);

  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedEnt, setSelectedEnt] = useState<Set<number>>(new Set());
  const hasValidCompanyId = companyId != null && Number.isInteger(companyId) && companyId > 0;

  const loadSummary = useCallback(async () => {
    if (!token || !allowed || !hasValidCompanyId) return;
    try { const r = await apiFinanceSummary(token, companyId); setSummary(r.data); }
    catch (e) { if (e instanceof ApiRequestError && e.status === 403) setForbidden(true); }
  }, [token, allowed, hasValidCompanyId, companyId]);

  const loadEntitlements = useCallback(async () => {
    if (!token || !allowed || !hasValidCompanyId) return;
    setErr(null);
    try {
      const r = await apiFinanceEntitlements(token, { company_id: companyId, page: entPage, per_page: 20 });
      setEntitlements(r.data); setEntMeta(r.meta);
    } catch (e) { setErr(e instanceof ApiRequestError ? e.message : t("admin.platform_finance.err_failed")); }
  }, [token, allowed, hasValidCompanyId, companyId, entPage, t]);

  const loadSettlements = useCallback(async () => {
    if (!token || !allowed || !hasValidCompanyId) return;
    setErr(null);
    try {
      const r = await apiFinanceSettlements(token, { company_id: companyId, page: setPage2, per_page: 20 });
      setSettlements(r.data); setSetMeta2(r.meta);
    } catch (e) { setErr(e instanceof ApiRequestError ? e.message : t("admin.platform_finance.err_failed")); }
  }, [token, allowed, hasValidCompanyId, companyId, setPage2, t]);

  useEffect(() => {
    if (companyId != null) return;
    if (initialCompanyId != null) setCompanyId(initialCompanyId);
  }, [companyId, initialCompanyId]);

  useEffect(() => { if (tab === "summary") loadSummary(); }, [tab, loadSummary]);
  useEffect(() => { if (tab === "entitlements") loadEntitlements(); }, [tab, loadEntitlements]);
  useEffect(() => { if (tab === "settlements") loadSettlements(); }, [tab, loadSettlements]);

  async function handleMarkPayable() {
    if (!token || selectedEnt.size === 0 || !hasValidCompanyId) return;
    setBusy(true);
    try {
      await apiMarkEntitlementsPayable(token, { company_id: companyId, entitlement_ids: Array.from(selectedEnt) });
      setSelectedEnt(new Set());
      await loadEntitlements();
    }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : t("admin.platform_finance.err_failed")); }
    finally { setBusy(false); }
  }

  async function handleSettlementStatus(id: number, status: string) {
    if (!token || !hasValidCompanyId) return;
    setBusy(true);
    try { await apiUpdateSettlementStatus(token, id, status); await loadSettlements(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : t("admin.platform_finance.err_failed")); }
    finally { setBusy(false); }
  }

  function toggleEntitlement(id: number, checked: boolean) {
    setSelectedEnt(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function toggleAllEntitlements(checked: boolean) {
    if (checked) {
      setSelectedEnt(new Set(entitlements.map(r => r.id)));
    } else {
      setSelectedEnt(new Set());
    }
  }

  if (!allowed || forbidden) return (
    <div><h1 className="admin-page-title">{t("admin.platform_finance.title")}</h1><div className="mt-4"><ForbiddenNotice /></div></div>
  );

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 ${tab === t ? "border-slate-800 text-fg-t11" : "border-transparent text-fg-t7 hover:text-fg-t7"}`;

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.platform_finance.title")}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-sm text-fg-t7" htmlFor="finance-company-id">{t("admin.platform_finance.company")}</label>
        {companyOptions.length > 0 ? (
          <select
            id="finance-company-id"
            value={companyId ?? ""}
            onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
            className="rounded border border-default bg-white px-2 py-1 text-sm"
          >
            {companyOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name} (#{c.id})</option>
            ))}
          </select>
        ) : (
          <input
            id="finance-company-id"
            type="number"
            min={1}
            value={companyId ?? ""}
            onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
            placeholder={t("admin.platform_finance.enter_company_id")}
            className="w-44 rounded border border-default bg-white px-2 py-1 text-sm"
          />
        )}
      </div>
      {!hasValidCompanyId && (
        <p className="mt-2 text-sm text-warning-700">{t("admin.platform_finance.valid_company_id_required")}</p>
      )}

      <div className="mt-4 flex gap-0 border-b border-default">
        <button type="button" className={tabCls("summary")} onClick={() => setTab("summary")}>{t("admin.platform_finance.summary")}</button>
        <button type="button" className={tabCls("entitlements")} onClick={() => setTab("entitlements")}>{t("admin.platform_finance.entitlements")}</button>
        <button type="button" className={tabCls("settlements")} onClick={() => setTab("settlements")}>{t("admin.platform_finance.settlements")}</button>
      </div>

      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}

      {tab === "summary" && summary && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(summary).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-default bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-medium uppercase text-fg-t7">{k.replace(/_/g, " ")}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-fg-t11">
                {typeof v === "number" ? Number(v).toFixed(2) : String(v ?? "-")}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "entitlements" && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" disabled={busy || selectedEnt.size === 0} onClick={() => void handleMarkPayable()}
              className="admin-btn-primary">
              {t("admin.platform_finance.mark_payable")} {selectedEnt.size > 0 ? `(${selectedEnt.size}) ` : ""}
            </button>
          </div>
          <div className="mt-3 overflow-x-auto rounded border border-default bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        toggleAllEntitlements(e.target.checked);
                      }}
                    />
                  </th>
                  <th className="px-3 py-2">{t("admin.crud.common.id")}</th>
                  <th className="px-3 py-2">{t("admin.platform_finance.amount")}</th>
                  <th className="px-3 py-2">{t("admin.platform_finance.status")}</th>
                  <th className="px-3 py-2">{t("admin.platform_finance.company")}</th>
                  <th className="px-3 py-2">{t("admin.platform_finance.booking_id")}</th>
                  <th className="px-3 py-2">{t("admin.platform_finance.payable_at")}</th>
                </tr>
              </thead>
              <tbody>
                {entitlements.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-fg-t6">{t("admin.platform_finance.no_entitlements")}</td></tr>
                )}
                {entitlements.map((r) => (
                  <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedEnt.has(r.id)}
                        onChange={(e) => toggleEntitlement(r.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums text-fg-t7">{r.id}</td>
                    <td className="px-3 py-2 tabular-nums font-medium">{r.currency} {Number(r.net_amount).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        r.status === "payable" ? "bg-success-50 text-success-800" :
                        r.status === "paid" ? "bg-info-50 text-info-800" :
                        "bg-warning-50 text-warning-800"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2">{r.company_id}</td>
                    <td className="px-3 py-2 tabular-nums text-fg-t7">{r.package_order_id ?? "-"}</td>
                    <td className="px-3 py-2 text-xs text-fg-t7">
                      {r.payable_at ? new Date(r.payable_at).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {entMeta && <PaginationBar meta={entMeta} onPage={setEntPage} />}
        </>
      )}

      {tab === "settlements" && (
        <>
          <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
                <tr>
                  <th className="px-3 py-2">{t("admin.crud.common.id")}</th>
                  <th className="px-3 py-2">{t("admin.platform_finance.amount")}</th>
                  <th className="px-3 py-2">{t("admin.platform_finance.status")}</th>
                  <th className="px-3 py-2">{t("admin.platform_finance.company")}</th>
                  <th className="px-3 py-2">{t("admin.platform_finance.settled_at")}</th>
                  <th className="px-3 py-2">{t("admin.platform_finance.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {settlements.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-fg-t6">{t("admin.platform_finance.no_settlements")}</td></tr>
                )}
                {settlements.map((r) => (
                  <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                    <td className="px-3 py-2 tabular-nums text-fg-t7">{r.id}</td>
                    <td className="px-3 py-2 tabular-nums font-medium">{r.currency} {Number(r.total_net_amount).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        r.status === "completed" ? "bg-success-50 text-success-800" :
                        r.status === "pending" ? "bg-warning-50 text-warning-800" :
                        "bg-figma-bg-1 text-fg-t7"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2">{r.company?.name ?? r.company_id}</td>
                    <td className="px-3 py-2 text-xs text-fg-t7">
                      {r.settled_at ? new Date(r.settled_at).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-3 py-2">
                      {r.status === "pending" && (
                        <button type="button" disabled={busy} onClick={() => void handleSettlementStatus(r.id, "completed")}
                          className="text-xs text-info-700 underline disabled:opacity-40">{t("admin.platform_finance.mark_completed")}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {setMeta2 && <PaginationBar meta={setMeta2} onPage={setSetPage2} />}
        </>
      )}
    </div>
  );
}
