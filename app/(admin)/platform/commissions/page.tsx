"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  apiCommissions, apiCommissionRecords, apiDeactivateCommission,
  type CommissionPolicyRow, type CommissionRecordRow,
} from "@/lib/commissions-api";
import { useCallback, useEffect, useState } from "react";

type Tab = "policies" | "records";

export default function CommissionsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [tab, setTab] = useState<Tab>("policies");

  const [policies, setPolicies] = useState<CommissionPolicyRow[]>([]);
  const [policiesMeta, setPoliciesMeta] = useState<ApiListMeta | null>(null);
  const [policiesPage, setPoliciesPage] = useState(1);

  const [records, setRecords] = useState<CommissionRecordRow[]>([]);
  const [recordsMeta, setRecordsMeta] = useState<ApiListMeta | null>(null);
  const [recordsPage, setRecordsPage] = useState(1);

  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadPolicies = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiCommissions(token, { page: policiesPage, per_page: 20 });
      setPolicies(res.data); setPoliciesMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.platform_commissions.err_failed"));
    }
  }, [token, allowed, policiesPage, t]);

  const loadRecords = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiCommissionRecords(token, { page: recordsPage, per_page: 20 });
      setRecords(res.data); setRecordsMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.platform_commissions.err_failed"));
    }
  }, [token, allowed, recordsPage, t]);

  useEffect(() => { if (tab === "policies") loadPolicies(); }, [tab, loadPolicies]);
  useEffect(() => { if (tab === "records") loadRecords(); }, [tab, loadRecords]);

  async function handleDeactivate(id: number) {
    if (!token || !window.confirm(t("admin.platform_commissions.confirm_deactivate"))) return;
    setBusyId(id);
    try { await apiDeactivateCommission(token, id); await loadPolicies(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : t("admin.platform_commissions.err_failed")); }
    finally { setBusyId(null); }
  }

  if (!allowed || forbidden) return (
    <div><h1 className="admin-page-title">{t("admin.platform_commissions.title")}</h1><div className="mt-4"><ForbiddenNotice /></div></div>
  );

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 ${tab === t ? "border-slate-800 text-fg-t11" : "border-transparent text-fg-t7 hover:text-fg-t7"}`;

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.platform_commissions.title")}</h1>

      <div className="mt-4 flex gap-0 border-b border-default">
        <button type="button" className={tabCls("policies")} onClick={() => setTab("policies")}>{t("admin.platform_commissions.policies")}</button>
        <button type="button" className={tabCls("records")} onClick={() => setTab("records")}>{t("admin.platform_commissions.records")}</button>
      </div>

      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}

      {tab === "policies" && (
        <>
          <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
                <tr>
                  <th className="px-3 py-2">{t("admin.crud.common.id")}</th>
                  <th className="px-3 py-2">{t("admin.platform_commissions.name")}</th>
                  <th className="px-3 py-2">{t("admin.platform_commissions.type")}</th>
                  <th className="px-3 py-2">{t("admin.platform_commissions.rate")}</th>
                  <th className="px-3 py-2">{t("admin.platform_commissions.service")}</th>
                  <th className="px-3 py-2">{t("admin.platform_commissions.status")}</th>
                  <th className="px-3 py-2">{t("admin.platform_commissions.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {policies.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-fg-t6">{t("admin.platform_commissions.no_policies")}</td></tr>
                )}
                {policies.map((r) => (
                  <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                    <td className="px-3 py-2 tabular-nums text-fg-t7">{r.id}</td>
                    <td className="px-3 py-2">{r.name ?? "-"}</td>
                    <td className="px-3 py-2">{r.type}</td>
                    <td className="px-3 py-2 tabular-nums">{r.rate}%</td>
                    <td className="px-3 py-2">{r.service_type ?? t("common.all")}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        r.status === "active" ? "bg-success-50 text-success-800" : "bg-figma-bg-1 text-fg-t6"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      {r.status === "active" && (
                        <button type="button" disabled={busyId === r.id} onClick={() => void handleDeactivate(r.id)}
                          className="text-xs text-error-600 underline disabled:opacity-40">{t("admin.platform_commissions.deactivate")}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {policiesMeta && <PaginationBar meta={policiesMeta} onPage={setPoliciesPage} />}
        </>
      )}

      {tab === "records" && (
        <>
          <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
                <tr>
                  <th className="px-3 py-2">{t("admin.crud.common.id")}</th>
                  <th className="px-3 py-2">{t("admin.platform_commissions.amount")}</th>
                  <th className="px-3 py-2">{t("admin.platform_commissions.status")}</th>
                  <th className="px-3 py-2">{t("admin.platform_commissions.company")}</th>
                  <th className="px-3 py-2">{t("admin.platform_commissions.booking_id")}</th>
                  <th className="px-3 py-2">{t("admin.platform_commissions.created")}</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-fg-t6">{t("admin.platform_commissions.no_records")}</td></tr>
                )}
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                    <td className="px-3 py-2 tabular-nums text-fg-t7">{r.id}</td>
                    <td className="px-3 py-2 tabular-nums font-medium">{r.currency} {Number(r.amount).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        r.status === "paid" ? "bg-success-50 text-success-800" :
                        r.status === "pending" ? "bg-warning-50 text-warning-800" :
                        "bg-figma-bg-1 text-fg-t7"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2">{r.company?.name ?? r.company_id ?? "-"}</td>
                    <td className="px-3 py-2 tabular-nums text-fg-t7">{r.booking_id ?? "-"}</td>
                    <td className="px-3 py-2 text-xs text-fg-t7">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {recordsMeta && <PaginationBar meta={recordsMeta} onPage={setRecordsPage} />}
        </>
      )}
    </div>
  );
}
