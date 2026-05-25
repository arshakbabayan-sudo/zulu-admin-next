"use client";

/**
 * v2 admin-redesign — Transactions page (Finance group).
 *
 * Source spec: docs/admin_designe/finance_group_mocks.html (PAGE 5 TRANSACTIONS)
 * Migration prompt: docs/admin_designe/finance_group_implementation_prompt.md §3.D
 *
 * Chrome:
 *   - V2PageHeader + breadcrumb + Company selector + Refresh + Export
 *   - FinanceSectionTabs
 *   - Pill-style sub-tabs (Summary / Entitlements / Settlements)
 *   - 4 KPI cards (Inflows / Outflows / Net position / Awaiting settlement)
 *   - Summary tab: 4 KPIs only (the mocked side-by-side mini tables read better
 *     when reduced to the KPIs while the dedicated Entitlements / Settlements
 *     sub-tabs hold the full lists)
 *   - Entitlements tab: bulk-select checkbox + Mark payable action + table
 *   - Settlements tab: table + Mark completed action per pending row
 *   - Status badges with icons
 *   - Avatar + company name
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDate, formatMoney } from "@/lib/format";
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
import {
  STATUS_BADGE_CLASS,
  avatarInitials,
  avatarStyle,
  pickAvatarTone,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
import { useCallback, useEffect, useState } from "react";
import { Pagination } from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  V2Card,
  V2Button,
  StatCard,
  StatGrid,
  IconButton,
} from "@/components/ui/v2";
import {
  ArrowDown,
  ArrowUp,
  Equal,
  Clock,
  Download,
  RefreshCw,
  Check,
  MoreVertical,
} from "lucide-react";
import { FinanceSectionTabs } from "@/components/finance/FinanceSectionTabs";

type Tab = "summary" | "entitlements" | "settlements";

const ENT_STATUS_META: Record<string, { tone: StatusTone; label: string }> = {
  pending: { tone: "warning", label: "Pending" },
  payable: { tone: "success", label: "Payable" },
  paid: { tone: "gray", label: "Paid" },
};

const SETTLE_STATUS_META: Record<string, { tone: StatusTone; label: string }> = {
  awaiting: { tone: "warning", label: "Awaiting" },
  pending: { tone: "warning", label: "Pending" },
  processing: { tone: "info", label: "Processing" },
  completed: { tone: "success", label: "Completed" },
  failed: { tone: "danger", label: "Failed" },
};

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

  useEffect(() => {
    if (tab === "summary") void loadSummary();
  }, [tab, loadSummary]);
  useEffect(() => {
    if (tab === "entitlements") void loadEntitlements();
  }, [tab, loadEntitlements]);
  useEffect(() => {
    if (tab === "settlements") void loadSettlements();
  }, [tab, loadSettlements]);

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

  const companySelector =
    companyOptions.length > 0 ? (
      <select
        value={companyId ?? ""}
        onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
        className="h-[36px] min-w-[200px] rounded-md border bg-white px-3 text-[13px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
        style={{ borderColor: "var(--admin-border)" }}
      >
        <option value="">All companies</option>
        {companyOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} (#{c.id})
          </option>
        ))}
      </select>
    ) : (
      <input
        type="number"
        min={1}
        value={companyId ?? ""}
        onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
        placeholder={t("admin.platform_finance.enter_company_id")}
        className="h-[36px] w-[200px] rounded-md border bg-white px-3 text-[13px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
        style={{ borderColor: "var(--admin-border)" }}
      />
    );

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Finance", href: "/platform/finance-summary" },
          { label: t("admin.platform_finance.title") },
        ]}
        title={t("admin.platform_finance.title")}
        subtitle={
          t("admin.platform_finance.subtitle") !== "admin.platform_finance.subtitle"
            ? t("admin.platform_finance.subtitle")
            : "Financial summaries, entitlements, and settlements per company"
        }
        actions={
          <>
            {companySelector}
            <V2Button
              onClick={() => {
                if (tab === "summary") void loadSummary();
                if (tab === "entitlements") void loadEntitlements();
                if (tab === "settlements") void loadSettlements();
              }}
              icon={<RefreshCw className="h-4 w-4" />}
              aria-label="Refresh"
            >
              {""}
            </V2Button>
            <V2Button variant="primary" icon={<Download className="h-4 w-4" />}>
              Export
            </V2Button>
          </>
        }
      />

      <FinanceSectionTabs activeHref="/platform/finance" />

      {/* Pill sub-tabs */}
      <div
        className="mb-4 inline-flex w-fit gap-1 rounded-[12px] border bg-white p-1"
        style={{ borderColor: "var(--admin-border)" }}
        role="tablist"
      >
        {(
          [
            { id: "summary", label: t("admin.platform_finance.summary") || "Summary", count: undefined },
            { id: "entitlements", label: t("admin.platform_finance.entitlements") || "Entitlements", count: entMeta?.total },
            { id: "settlements", label: t("admin.platform_finance.settlements") || "Settlements", count: setMeta2?.total },
          ] as const
        ).map((it) => (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={tab === it.id}
            onClick={() => setTab(it.id as Tab)}
            className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition"
            style={
              tab === it.id
                ? { backgroundColor: "var(--admin-primary)", color: "white" }
                : { backgroundColor: "transparent", color: "var(--admin-text-secondary)" }
            }
          >
            {it.label}
            {typeof it.count === "number" ? (
              <span
                className="rounded-full px-1.5 py-px text-[10px] font-semibold"
                style={
                  tab === it.id
                    ? { backgroundColor: "rgba(255,255,255,0.2)", color: "white" }
                    : { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }
                }
              >
                {it.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* 4 KPI cards — visible on every sub-tab so the snapshot is always in view.
          NOTE: backend currently returns total_earned / total_pending / total_settled.
          The mockup wants Inflows / Outflows / Net position / Awaiting settlement.
          Map what we have today and surface "—" for the missing ones — backend
          follow-up to add gross_revenue + platform_fee + net_position. */}
      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<ArrowDown style={{ color: "var(--admin-success)" }} className="h-[22px] w-[22px]" />}
          value={summary?.total_earned != null ? formatMoney(summary.total_earned as number, lang) : "—"}
          label="Inflows (30d)"
        />
        <StatCard
          icon={<ArrowUp style={{ color: "var(--admin-danger)" }} className="h-[22px] w-[22px]" />}
          value="—"
          label="Outflows (30d)"
        />
        <StatCard
          icon={<Equal style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={summary?.total_settled != null ? formatMoney(summary.total_settled as number, lang) : "—"}
          label="Net position"
        />
        <StatCard
          icon={<Clock style={{ color: "var(--admin-warning)" }} className="h-[22px] w-[22px]" />}
          value={summary?.total_pending != null ? formatMoney(summary.total_pending as number, lang) : "—"}
          label="Awaiting settlement"
        />
      </StatGrid>

      {!hasValidCompanyId && (
        <div
          className="mb-4 rounded-md border px-4 py-2 text-sm"
          style={{
            borderColor: "var(--admin-warning-light)",
            backgroundColor: "var(--admin-warning-light)",
            color: "var(--admin-warning-dark)",
          }}
        >
          {t("admin.platform_finance.valid_company_id_required")}
        </div>
      )}

      {err ? (
        <div
          className="mb-4 rounded-md border px-4 py-2 text-sm"
          style={{
            borderColor: "var(--admin-danger-light)",
            backgroundColor: "var(--admin-danger-light)",
            color: "var(--admin-danger-dark)",
          }}
        >
          {err}
        </div>
      ) : null}

      {tab === "summary" && summary ? (
        <V2Card>
          <div className="grid gap-px bg-[color:var(--admin-border)] sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(summary).map(([k, v]) => (
              <div key={k} className="bg-white px-4 py-3">
                <div
                  className="text-[11px] font-semibold uppercase tracking-[0.5px]"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  {k.replace(/_/g, " ")}
                </div>
                <div className="mt-1 text-[20px] font-semibold tabular-nums" style={{ color: "var(--admin-text-primary)" }}>
                  {typeof v === "number" ? formatMoney(v, lang) : String(v ?? "—")}
                </div>
              </div>
            ))}
          </div>
        </V2Card>
      ) : null}

      {tab === "entitlements" && (
        <V2Card>
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3"
            style={{ borderColor: "var(--admin-border)", backgroundColor: "var(--admin-bg-secondary)" }}
          >
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>
                Entitlements
              </span>
              <span className="text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
                Amounts owed to companies
              </span>
            </div>
            <V2Button
              variant="primary"
              size="sm"
              disabled={busy || selectedEnt.size === 0}
              onClick={() => void handleMarkPayable()}
            >
              Mark payable {selectedEnt.size > 0 ? `(${selectedEnt.size})` : ""}
            </V2Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead
                className="text-[11px] font-semibold uppercase tracking-[0.5px]"
                style={{ backgroundColor: "var(--admin-bg-secondary)", color: "var(--admin-text-secondary)" }}
              >
                <tr>
                  <th className="px-4 py-2.5 text-left" style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={entitlements.length > 0 && selectedEnt.size === entitlements.length}
                      onChange={(e) => toggleAllEntitlements(e.target.checked)}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left">{t("admin.crud.common.id")}</th>
                  <th className="px-4 py-2.5 text-left">Amount</th>
                  <th className="px-4 py-2.5 text-left">Company</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Payable At</th>
                </tr>
              </thead>
              <tbody>
                {entitlements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                      {t("admin.platform_finance.no_entitlements")}
                    </td>
                  </tr>
                ) : (
                  entitlements.map((r) => {
                    const statusMeta = ENT_STATUS_META[r.status] ?? { tone: "gray" as StatusTone, label: r.status };
                    const tone = pickAvatarTone(r.company_id);
                    return (
                      <tr
                        key={r.id}
                        className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                        style={{ borderColor: "var(--admin-border)" }}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedEnt.has(r.id)}
                            onChange={(e) => toggleEntitlement(r.id, e.target.checked)}
                            aria-label={`Select entitlement ${r.id}`}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-fg-t7">#E-{r.id}</td>
                        <td className="px-4 py-3 font-semibold text-fg-t8 tabular-nums">
                          {formatMoney(r.net_amount, lang, r.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                              style={avatarStyle(tone)}
                            >
                              {avatarInitials(`#${r.company_id}`)}
                            </span>
                            <span className="text-fg-t8">Company #{r.company_id}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusMeta.tone)}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                          {formatDate(r.payable_at, lang)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {entMeta && entMeta.last_page > 1 ? (
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 text-[12px]"
              style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}
            >
              <span>
                Showing {(entMeta.current_page - 1) * entMeta.per_page + 1}–
                {Math.min(entMeta.current_page * entMeta.per_page, entMeta.total)} of {entMeta.total} entitlements
              </span>
              <Pagination page={entMeta.current_page} lastPage={entMeta.last_page} onPage={setEntPage} />
            </div>
          ) : null}
        </V2Card>
      )}

      {tab === "settlements" && (
        <V2Card>
          <div
            className="border-b px-5 py-3"
            style={{ borderColor: "var(--admin-border)", backgroundColor: "var(--admin-bg-secondary)" }}
          >
            <div className="text-[14px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>
              Settlements
            </div>
            <div className="text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
              Completed payouts to companies
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead
                className="text-[11px] font-semibold uppercase tracking-[0.5px]"
                style={{ backgroundColor: "var(--admin-bg-secondary)", color: "var(--admin-text-secondary)" }}
              >
                <tr>
                  <th className="px-4 py-2.5 text-left">{t("admin.crud.common.id")}</th>
                  <th className="px-4 py-2.5 text-left">Amount</th>
                  <th className="px-4 py-2.5 text-left">Company</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Settled At</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {settlements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                      {t("admin.platform_finance.no_settlements")}
                    </td>
                  </tr>
                ) : (
                  settlements.map((r) => {
                    const statusMeta = SETTLE_STATUS_META[r.status] ?? { tone: "gray" as StatusTone, label: r.status };
                    const companyName = r.company?.name ?? `Company #${r.company_id}`;
                    const tone = pickAvatarTone(r.company_id);
                    return (
                      <tr
                        key={r.id}
                        className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                        style={{ borderColor: "var(--admin-border)" }}
                      >
                        <td className="px-4 py-3 font-mono text-[12px] text-fg-t7">#S-{r.id}</td>
                        <td className="px-4 py-3 font-semibold text-fg-t8 tabular-nums">
                          {formatMoney(r.total_net_amount, lang, r.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                              style={avatarStyle(tone)}
                            >
                              {avatarInitials(companyName)}
                            </span>
                            <span className="text-fg-t8">{companyName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusMeta.tone)}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                          {formatDate(r.settled_at, lang)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.status === "pending" || r.status === "awaiting" ? (
                              <IconButton
                                aria-label="Mark completed"
                                onClick={() => void handleSettlementStatus(r.id, "completed")}
                                disabled={busy}
                              >
                                <Check />
                              </IconButton>
                            ) : null}
                            <IconButton aria-label="More">
                              <MoreVertical />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {setMeta2 && setMeta2.last_page > 1 ? (
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 text-[12px]"
              style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}
            >
              <span>
                Showing {(setMeta2.current_page - 1) * setMeta2.per_page + 1}–
                {Math.min(setMeta2.current_page * setMeta2.per_page, setMeta2.total)} of {setMeta2.total} settlements
              </span>
              <Pagination page={setMeta2.current_page} lastPage={setMeta2.last_page} onPage={setSetPage2} />
            </div>
          ) : null}
        </V2Card>
      )}
    </div>
  );
}
