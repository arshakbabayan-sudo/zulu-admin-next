"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  apiCommissions,
  apiCommissionRecords,
  apiDeactivateCommission,
  type CommissionPolicyRow,
  type CommissionRecordRow,
} from "@/lib/commissions-api";
import { useCallback, useEffect, useState } from "react";
import {
  PageHeader,
  Pagination,
  StatusPill,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  Tabs,
  TR,
} from "@/components/ui";

type Tab = "policies" | "records";

export default function CommissionsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const confirm = useConfirm();
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
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiCommissions(token, { page: policiesPage, per_page: 20 });
      setPolicies(res.data);
      setPoliciesMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.platform_commissions.err_failed"));
    }
  }, [token, allowed, policiesPage, t]);

  const loadRecords = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiCommissionRecords(token, { page: recordsPage, per_page: 20 });
      setRecords(res.data);
      setRecordsMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.platform_commissions.err_failed"));
    }
  }, [token, allowed, recordsPage, t]);

  useEffect(() => { if (tab === "policies") loadPolicies(); }, [tab, loadPolicies]);
  useEffect(() => { if (tab === "records") loadRecords(); }, [tab, loadRecords]);

  async function handleDeactivate(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.platform_commissions.confirm_deactivate" });
    if (!ok) return;
    setBusyId(id);
    try {
      await apiDeactivateCommission(token, id);
      await loadPolicies();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_commissions.err_failed"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.platform_commissions.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.platform_commissions.title")} />

      <Tabs
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        items={[
          { id: "policies", label: t("admin.platform_commissions.policies") },
          { id: "records", label: t("admin.platform_commissions.records") },
        ]}
      />

      {err ? (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      ) : null}

      {tab === "policies" && (
        <>
          <Table>
            <THead>
              <TR>
                <TH>{t("admin.crud.common.id")}</TH>
                <TH>{t("admin.platform_commissions.name")}</TH>
                <TH>{t("admin.platform_commissions.type")}</TH>
                <TH>{t("admin.platform_commissions.rate")}</TH>
                <TH>{t("admin.platform_commissions.service")}</TH>
                <TH>{t("admin.platform_commissions.status")}</TH>
                <TH>{t("admin.platform_commissions.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {policies.length === 0 ? (
                <TEmpty colSpan={7}>{t("admin.platform_commissions.no_policies")}</TEmpty>
              ) : null}
              {policies.map((r) => (
                <TR key={r.id}>
                  <TD className="tabular-nums">{r.id}</TD>
                  <TD>{r.name ?? "—"}</TD>
                  <TD>{r.type}</TD>
                  <TD className="tabular-nums">{r.rate}%</TD>
                  <TD>{r.service_type ?? t("common.all")}</TD>
                  <TD>
                    <StatusPill status={r.status} />
                  </TD>
                  <TD>
                    {r.status === "active" && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void handleDeactivate(r.id)}
                        className="text-xs text-error-600 underline disabled:opacity-40"
                      >
                        {t("admin.platform_commissions.deactivate")}
                      </button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {policiesMeta && policiesMeta.last_page > 1 ? (
            <Pagination page={policiesMeta.current_page} lastPage={policiesMeta.last_page} onPage={setPoliciesPage} />
          ) : null}
        </>
      )}

      {tab === "records" && (
        <>
          <Table>
            <THead>
              <TR>
                <TH>{t("admin.crud.common.id")}</TH>
                <TH>{t("admin.platform_commissions.amount")}</TH>
                <TH>{t("admin.platform_commissions.status")}</TH>
                <TH>{t("admin.platform_commissions.company")}</TH>
                <TH>{t("admin.platform_commissions.booking_id")}</TH>
                <TH>{t("admin.platform_commissions.created")}</TH>
              </TR>
            </THead>
            <TBody>
              {records.length === 0 ? (
                <TEmpty colSpan={6}>{t("admin.platform_commissions.no_records")}</TEmpty>
              ) : null}
              {records.map((r) => (
                <TR key={r.id}>
                  <TD className="tabular-nums">{r.id}</TD>
                  <TD className="tabular-nums font-medium">
                    {r.currency} {Number(r.amount).toFixed(2)}
                  </TD>
                  <TD>
                    <StatusPill status={r.status} />
                  </TD>
                  <TD>{r.company?.name ?? r.company_id ?? "—"}</TD>
                  <TD className="tabular-nums">{r.booking_id ?? "—"}</TD>
                  <TD className="text-xs text-fg-t6">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {recordsMeta && recordsMeta.last_page > 1 ? (
            <Pagination page={recordsMeta.current_page} lastPage={recordsMeta.last_page} onPage={setRecordsPage} />
          ) : null}
        </>
      )}
    </div>
  );
}
