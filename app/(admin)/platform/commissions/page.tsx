"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDate } from "@/lib/format";
import {
  apiCommissions,
  apiCommissionRecords,
  apiCreateCommission,
  apiDeactivateCommission,
  type CommissionPolicyCreate,
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
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  V2Card,
  V2Button,
} from "@/components/ui/v2";

type Tab = "policies" | "records";

export default function CommissionsPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
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
  const [busyId, setBusyId] = useState<string | null>(null);
  // Phase 7.4 — "+ New" modal state
  const [newOpen, setNewOpen] = useState(false);
  const [newDraft, setNewDraft] = useState<CommissionPolicyCreate>({
    company_id: 0,
    service_type: "",
    type: "percentage",
    percent: 0,
    status: "active",
    notes: "",
  });
  const [newSaving, setNewSaving] = useState(false);

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

  useEffect(() => { if (tab === "policies") void loadPolicies(); }, [tab, loadPolicies]);
  useEffect(() => { if (tab === "records") void loadRecords(); }, [tab, loadRecords]);

  async function handleDeactivate(id: string) {
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

  // Phase 7.4 — Create new commission policy
  async function handleCreatePolicy() {
    if (!token) return;
    if (!newDraft.company_id || newDraft.company_id <= 0) {
      alert(t("admin.platform_commissions.err_company_required"));
      return;
    }
    if (newDraft.type === "percentage" && (newDraft.percent == null || newDraft.percent < 0 || newDraft.percent > 100)) {
      alert(t("admin.platform_commissions.err_percent_invalid"));
      return;
    }
    if (newDraft.type === "fixed" && (newDraft.fixed_value == null || newDraft.fixed_value < 0)) {
      alert(t("admin.platform_commissions.err_fixed_invalid"));
      return;
    }
    setNewSaving(true);
    try {
      await apiCreateCommission(token, {
        ...newDraft,
        service_type: newDraft.service_type?.trim() || null,
        notes: newDraft.notes?.trim() || null,
      });
      setNewOpen(false);
      setNewDraft({
        company_id: 0,
        service_type: "",
        type: "percentage",
        percent: 0,
        status: "active",
        notes: "",
      });
      await loadPolicies();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_commissions.err_failed"));
    } finally {
      setNewSaving(false);
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
    <div>
      {/* v2 admin-redesign — Commissions ledger page chrome (Finance section). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Finance", href: "/platform/finance-summary" },
          { label: t("admin.platform_commissions.title") },
        ]}
        title={t("admin.platform_commissions.title")}
        actions={
          <V2Button variant="primary" onClick={() => setNewOpen(true)}>
            {t("admin.platform_commissions.btn_new")}
          </V2Button>
        }
      />

      <SectionTabs
        activeHref="/platform/commissions"
        items={[
          { href: "/platform/finance-summary", label: "Summary" },
          { href: "/platform/invoices", label: "Invoices" },
          { href: "/platform/payments", label: "Payments" },
          { href: "/platform/commissions", label: "Commissions ledger" },
          { href: "/platform/finance", label: "Transactions" },
          { href: "/platform/vouchers", label: "Vouchers" },
        ]}
      />

      <Tabs
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        items={[
          { id: "policies", label: t("admin.platform_commissions.policies") },
          { id: "records", label: t("admin.platform_commissions.records") },
        ]}
      />

      {err ? (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      ) : null}

      {tab === "policies" && (
        <>
          <V2Card>
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
          </V2Card>
          {policiesMeta && policiesMeta.last_page > 1 ? (
            <Pagination page={policiesMeta.current_page} lastPage={policiesMeta.last_page} onPage={setPoliciesPage} />
          ) : null}
        </>
      )}

      {tab === "records" && (
        <>
          <V2Card>
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
                    {formatDate(r.created_at, lang)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          </V2Card>
          {recordsMeta && recordsMeta.last_page > 1 ? (
            <Pagination page={recordsMeta.current_page} lastPage={recordsMeta.last_page} onPage={setRecordsPage} />
          ) : null}
        </>
      )}

      {/* Phase 7.4 — "+ New" commission policy modal */}
      {newOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNewOpen(false);
          }}
        >
          <div className="w-full max-w-zulu-modal overflow-hidden rounded-t-zulu-modal bg-white shadow-zulu-modal sm:rounded-zulu-modal">
            <div className="flex items-start justify-between gap-3 border-b border-default p-5">
              <h2 className="text-lg font-semibold text-fg-t8">
                {t("admin.platform_commissions.new_modal_title")}
              </h2>
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                className="text-fg-t6 transition hover:text-fg-t8"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t7">{t("admin.platform_commissions.field_company_id")}</span>
                <input
                  type="number"
                  min="1"
                  value={newDraft.company_id || ""}
                  onChange={(e) => setNewDraft({ ...newDraft, company_id: Number(e.target.value) || 0 })}
                  className="h-10 rounded-zulu border border-default px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                  placeholder={t("admin.platform_commissions.field_company_id_placeholder")}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t7">{t("admin.platform_commissions.field_service_type")}</span>
                <select
                  value={newDraft.service_type ?? ""}
                  onChange={(e) => setNewDraft({ ...newDraft, service_type: e.target.value || null })}
                  className="h-10 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="">{t("common.all")}</option>
                  <option value="hotel">Hotel</option>
                  <option value="flight">Flight</option>
                  <option value="transfer">Transfer</option>
                  <option value="excursion">Excursion</option>
                  <option value="car">Car</option>
                  <option value="visa">Visa</option>
                  <option value="package">Package</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t7">{t("admin.platform_commissions.field_type")}</span>
                <select
                  value={newDraft.type}
                  onChange={(e) =>
                    setNewDraft({
                      ...newDraft,
                      type: e.target.value as "percentage" | "fixed",
                      percent: e.target.value === "percentage" ? newDraft.percent : null,
                      fixed_value: e.target.value === "fixed" ? newDraft.fixed_value : null,
                    })
                  }
                  className="h-10 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="percentage">{t("admin.platform_commissions.type_percentage")}</option>
                  <option value="fixed">{t("admin.platform_commissions.type_fixed")}</option>
                </select>
              </label>
              {newDraft.type === "percentage" ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-fg-t7">{t("admin.platform_commissions.field_percent")}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={newDraft.percent ?? ""}
                    onChange={(e) => setNewDraft({ ...newDraft, percent: Number(e.target.value) })}
                    className="h-10 rounded-zulu border border-default px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                    placeholder="0.00"
                  />
                </label>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t7">{t("admin.platform_commissions.field_fixed_value")}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newDraft.fixed_value ?? ""}
                      onChange={(e) => setNewDraft({ ...newDraft, fixed_value: Number(e.target.value) })}
                      className="h-10 rounded-zulu border border-default px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                      placeholder="0.00"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t7">{t("admin.platform_commissions.field_currency")}</span>
                    <select
                      value={newDraft.fixed_currency ?? "AMD"}
                      onChange={(e) => setNewDraft({ ...newDraft, fixed_currency: e.target.value })}
                      className="h-10 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                    >
                      <option value="AMD">AMD</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="RUB">RUB</option>
                    </select>
                  </label>
                </div>
              )}
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t7">{t("admin.platform_commissions.field_status")}</span>
                <select
                  value={newDraft.status ?? "active"}
                  onChange={(e) =>
                    setNewDraft({ ...newDraft, status: e.target.value as "active" | "inactive" | "scheduled" })
                  }
                  className="h-10 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="active">{t("admin.platform_commissions.status_active")}</option>
                  <option value="inactive">{t("admin.platform_commissions.status_inactive")}</option>
                  <option value="scheduled">{t("admin.platform_commissions.status_scheduled")}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t7">{t("admin.platform_commissions.field_notes")}</span>
                <textarea
                  value={newDraft.notes ?? ""}
                  onChange={(e) => setNewDraft({ ...newDraft, notes: e.target.value })}
                  className="min-h-[60px] rounded-zulu border border-default px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-default p-5">
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                className="inline-flex h-10 items-center rounded-zulu border border-default bg-white px-4 text-sm font-medium text-fg-t8 transition hover:bg-figma-bg-1"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={newSaving}
                onClick={() => void handleCreatePolicy()}
                className="inline-flex h-10 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {newSaving ? t("common.saving") : t("admin.platform_commissions.btn_create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
