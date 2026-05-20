"use client";

/**
 * Phase-2 migration to shared @/components/ui primitives.
 * 3 tabs (summary / entitlements / settlements) with shared Tabs component,
 * select-all checkbox, status pills.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDate } from "@/lib/format";
import {
  apiFinanceSummary,
  apiFinanceEntitlements,
  apiFinanceSettlements,
  apiMarkEntitlementsPayable,
  apiUpdateSettlementStatus,
  type FinanceEntitlementRow,
  type FinanceSettlementRow,
  type CompanyFinanceSummary,
} from "@/lib/finance-api";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Select,
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

type Tab = "summary" | "entitlements" | "settlements";

export default function FinancePage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
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
    try {
      const r = await apiFinanceSummary(token, companyId);
      setSummary(r.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
    }
  }, [token, allowed, hasValidCompanyId, companyId]);

  const loadEntitlements = useCallback(async () => {
    if (!token || !allowed || !hasValidCompanyId) return;
    setErr(null);
    try {
      const r = await apiFinanceEntitlements(token, { company_id: companyId, page: entPage, per_page: 20 });
      setEntitlements(r.data);
      setEntMeta(r.meta);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.platform_finance.err_failed"));
    }
  }, [token, allowed, hasValidCompanyId, companyId, entPage, t]);

  const loadSettlements = useCallback(async () => {
    if (!token || !allowed || !hasValidCompanyId) return;
    setErr(null);
    try {
      const r = await apiFinanceSettlements(token, { company_id: companyId, page: setPage2, per_page: 20 });
      setSettlements(r.data);
      setSetMeta2(r.meta);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.platform_finance.err_failed"));
    }
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
      await apiMarkEntitlementsPayable(token, {
        company_id: companyId,
        entitlement_ids: Array.from(selectedEnt),
      });
      setSelectedEnt(new Set());
      await loadEntitlements();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_finance.err_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSettlementStatus(id: number, status: string) {
    if (!token || !hasValidCompanyId) return;
    setBusy(true);
    try {
      await apiUpdateSettlementStatus(token, id, status);
      await loadSettlements();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_finance.err_failed"));
    } finally {
      setBusy(false);
    }
  }

  function toggleEntitlement(id: number, checked: boolean) {
    setSelectedEnt((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllEntitlements(checked: boolean) {
    setSelectedEnt(checked ? new Set(entitlements.map((r) => r.id)) : new Set());
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.platform_finance.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.platform_finance.title")} />

      <div className="admin-card p-4">
        <FormField label={t("admin.platform_finance.company")} htmlFor="finance-company-id">
          {companyOptions.length > 0 ? (
            <Select
              id="finance-company-id"
              value={companyId ?? ""}
              onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
              fieldSize="sm"
            >
              {companyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (#{c.id})
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id="finance-company-id"
              type="number"
              min={1}
              value={companyId ?? ""}
              onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
              placeholder={t("admin.platform_finance.enter_company_id")}
            />
          )}
        </FormField>
        {!hasValidCompanyId && (
          <p className="mt-2 text-sm text-warning-700">
            {t("admin.platform_finance.valid_company_id_required")}
          </p>
        )}
      </div>

      <Tabs
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        items={[
          { id: "summary", label: t("admin.platform_finance.summary") },
          { id: "entitlements", label: t("admin.platform_finance.entitlements") },
          { id: "settlements", label: t("admin.platform_finance.settlements") },
        ]}
      />

      {err ? (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      ) : null}

      {tab === "summary" && summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(summary).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-default bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-medium uppercase text-fg-t7">{k.replace(/_/g, " ")}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-fg-t11">
                {typeof v === "number" ? Number(v).toFixed(2) : String(v ?? "—")}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "entitlements" && (
        <>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              disabled={busy || selectedEnt.size === 0}
              onClick={() => void handleMarkPayable()}
              size="sm"
            >
              {t("admin.platform_finance.mark_payable")}{" "}
              {selectedEnt.size > 0 ? `(${selectedEnt.size}) ` : ""}
            </Button>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>
                  <Checkbox
                    checked={entitlements.length > 0 && selectedEnt.size === entitlements.length}
                    onChange={(e) => toggleAllEntitlements(e.target.checked)}
                  />
                </TH>
                <TH>{t("admin.crud.common.id")}</TH>
                <TH>{t("admin.platform_finance.amount")}</TH>
                <TH>{t("admin.platform_finance.status")}</TH>
                <TH>{t("admin.platform_finance.company")}</TH>
                <TH>{t("admin.platform_finance.booking_id")}</TH>
                <TH>{t("admin.platform_finance.payable_at")}</TH>
              </TR>
            </THead>
            <TBody>
              {entitlements.length === 0 ? (
                <TEmpty colSpan={7}>{t("admin.platform_finance.no_entitlements")}</TEmpty>
              ) : null}
              {entitlements.map((r) => (
                <TR key={r.id}>
                  <TD onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedEnt.has(r.id)}
                      onChange={(e) => toggleEntitlement(r.id, e.target.checked)}
                    />
                  </TD>
                  <TD className="tabular-nums">{r.id}</TD>
                  <TD className="tabular-nums font-medium">
                    {r.currency} {Number(r.net_amount).toFixed(2)}
                  </TD>
                  <TD>
                    <StatusPill status={r.status} />
                  </TD>
                  <TD>{r.company_id}</TD>
                  <TD className="tabular-nums">{r.package_order_id ?? "—"}</TD>
                  <TD className="text-xs text-fg-t6">
                    {formatDate(r.payable_at, lang)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {entMeta && entMeta.last_page > 1 ? (
            <Pagination page={entMeta.current_page} lastPage={entMeta.last_page} onPage={setEntPage} />
          ) : null}
        </>
      )}

      {tab === "settlements" && (
        <>
          <Table>
            <THead>
              <TR>
                <TH>{t("admin.crud.common.id")}</TH>
                <TH>{t("admin.platform_finance.amount")}</TH>
                <TH>{t("admin.platform_finance.status")}</TH>
                <TH>{t("admin.platform_finance.company")}</TH>
                <TH>{t("admin.platform_finance.settled_at")}</TH>
                <TH>{t("admin.platform_finance.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {settlements.length === 0 ? (
                <TEmpty colSpan={6}>{t("admin.platform_finance.no_settlements")}</TEmpty>
              ) : null}
              {settlements.map((r) => (
                <TR key={r.id}>
                  <TD className="tabular-nums">{r.id}</TD>
                  <TD className="tabular-nums font-medium">
                    {r.currency} {Number(r.total_net_amount).toFixed(2)}
                  </TD>
                  <TD>
                    <StatusPill status={r.status} />
                  </TD>
                  <TD>{r.company?.name ?? r.company_id}</TD>
                  <TD className="text-xs text-fg-t6">
                    {formatDate(r.settled_at, lang)}
                  </TD>
                  <TD>
                    {r.status === "pending" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSettlementStatus(r.id, "completed")}
                        className="text-xs text-info-700 underline disabled:opacity-40"
                      >
                        {t("admin.platform_finance.mark_completed")}
                      </button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {setMeta2 && setMeta2.last_page > 1 ? (
            <Pagination page={setMeta2.current_page} lastPage={setMeta2.last_page} onPage={setSetPage2} />
          ) : null}
        </>
      )}
    </div>
  );
}
