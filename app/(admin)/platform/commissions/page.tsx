"use client";

/**
 * v2 admin-redesign — Commissions page (Finance group).
 *
 * Source spec: docs/admin_designe/finance_group_mocks.html (PAGE 4 COMMISSIONS)
 * Migration prompt: docs/admin_designe/finance_group_implementation_prompt.md §3.C
 *
 * Chrome:
 *   - V2PageHeader + breadcrumb + Export + New commission
 *   - FinanceSectionTabs
 *   - 4 plain stat cards (Active policies / Recorded / Pending settlement / Avg rate)
 *   - Pill-style sub-tabs (Policies / Records) — distinct from section tabs
 *   - FilterCard (status / service type / type / search) — visible on policies tab
 *   - Active filter chips
 *   - V2Card wrapping table; row-cell-stack for policy name + description
 *   - Status badges with success/gray for policy status; multiple tones for record status
 *   - Avatar + company name (where present)
 *   - IconButton row (Edit / More) on policies; modal for new commission
 *   - Pagination inside V2Card
 */

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
  apiCreateCommission,
  apiDeactivateCommission,
  type CommissionPolicyCreate,
  type CommissionPolicyRow,
  type CommissionRecordRow,
} from "@/lib/commissions-api";
import { formatMoney } from "@/lib/format";
import { apiCommissionsStats, type CommissionsStats } from "@/lib/finance-stats-api";
import {
  STATUS_BADGE_CLASS,
  avatarInitials,
  avatarStyle,
  formatRelativeTime,
  pickAvatarTone,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Download,
  Edit3,
  MoreVertical,
  Ban,
  Percent,
  Receipt,
  Clock,
  TrendingUp,
  X as XIcon,
  XCircle,
} from "lucide-react";
import { Pagination } from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  StatCard,
  StatGrid,
  IconButton,
} from "@/components/ui/v2";
import { FinanceSectionTabs } from "@/components/finance/FinanceSectionTabs";

type Tab = "policies" | "records";

const POLICY_STATUS_META: Record<string, { tone: StatusTone; label: string }> = {
  active: { tone: "success", label: "Active" },
  inactive: { tone: "gray", label: "Inactive" },
  scheduled: { tone: "info", label: "Scheduled" },
};

const RECORD_STATUS_META: Record<string, { tone: StatusTone; label: string }> = {
  paid: { tone: "success", label: "Paid" },
  settled: { tone: "success", label: "Settled" },
  pending: { tone: "warning", label: "Pending" },
  cancelled: { tone: "danger", label: "Cancelled" },
  processing: { tone: "info", label: "Processing" },
};

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

  const [statusFilter, setStatusFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
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
  const [stats, setStats] = useState<CommissionsStats | null>(null);

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

  useEffect(() => {
    if (tab === "policies") void loadPolicies();
  }, [tab, loadPolicies]);
  useEffect(() => {
    if (tab === "records") void loadRecords();
  }, [tab, loadRecords]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiCommissionsStats(token)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

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

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (statusFilter)
      chips.push({
        key: "status",
        label: `Status: ${POLICY_STATUS_META[statusFilter]?.label ?? statusFilter}`,
        clear: () => setStatusFilter(""),
      });
    if (serviceFilter) chips.push({ key: "service", label: `Service: ${serviceFilter}`, clear: () => setServiceFilter("") });
    if (typeFilter) chips.push({ key: "type", label: `Type: ${typeFilter}`, clear: () => setTypeFilter("") });
    if (search.trim()) chips.push({ key: "search", label: `“${search.trim()}”`, clear: () => setSearch("") });
    return chips;
  }, [statusFilter, serviceFilter, typeFilter, search]);

  function clearAllFilters() {
    setStatusFilter("");
    setServiceFilter("");
    setTypeFilter("");
    setSearch("");
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

  const filteredPolicies = policies.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (serviceFilter && r.service_type !== serviceFilter) return false;
    if (typeFilter && r.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!r.name?.toLowerCase().includes(q) && !String(r.id).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Finance", href: "/platform/finance-summary" },
          { label: t("admin.platform_commissions.title") },
        ]}
        title={t("admin.platform_commissions.title")}
        subtitle={
          t("admin.platform_commissions.subtitle") !== "admin.platform_commissions.subtitle"
            ? t("admin.platform_commissions.subtitle")
            : "Commission policies and recorded commission transactions"
        }
        actions={
          <>
            <V2Button icon={<Download className="h-4 w-4" />}>Export CSV</V2Button>
            <V2Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setNewOpen(true)}>
              {t("admin.platform_commissions.btn_new")}
            </V2Button>
          </>
        }
      />

      <FinanceSectionTabs
        activeHref="/platform/commissions"
        counts={{ commissions: policiesMeta?.total ?? recordsMeta?.total }}
      />

      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<Percent style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.active_policies_count.toLocaleString() : policiesMeta?.total ?? "—"}
          label="Active policies"
        />
        <StatCard
          icon={<Receipt style={{ color: "var(--admin-success)" }} className="h-[22px] w-[22px]" />}
          value={stats ? formatMoney(stats.recorded_amount, lang) : "—"}
          label="Recorded (30d)"
        />
        <StatCard
          icon={<Clock style={{ color: "var(--admin-warning)" }} className="h-[22px] w-[22px]" />}
          value={stats ? formatMoney(stats.pending_amount, lang) : "—"}
          label="Pending settlement"
          footer={stats && stats.pending_count > 0 ? `${stats.pending_count} pending` : undefined}
        />
        <StatCard
          icon={<TrendingUp style={{ color: "var(--admin-info)" }} className="h-[22px] w-[22px]" />}
          value={stats ? `${stats.avg_rate_pct.toFixed(1)}%` : "—"}
          label="Avg. commission rate"
        />
      </StatGrid>

      {/* Pill-style sub-tabs (Policies / Records) */}
      <div
        className="mb-4 inline-flex w-fit gap-1 rounded-[12px] border bg-white p-1"
        style={{ borderColor: "var(--admin-border)" }}
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "policies"}
          onClick={() => setTab("policies")}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition"
          style={
            tab === "policies"
              ? { backgroundColor: "var(--admin-primary)", color: "white" }
              : { backgroundColor: "transparent", color: "var(--admin-text-secondary)" }
          }
        >
          {t("admin.platform_commissions.policies") || "Policies"}
          <span
            className="rounded-full px-1.5 py-px text-[10px] font-semibold"
            style={
              tab === "policies"
                ? { backgroundColor: "rgba(255,255,255,0.2)", color: "white" }
                : { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }
            }
          >
            {policiesMeta?.total ?? 0}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "records"}
          onClick={() => setTab("records")}
          className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition"
          style={
            tab === "records"
              ? { backgroundColor: "var(--admin-primary)", color: "white" }
              : { backgroundColor: "transparent", color: "var(--admin-text-secondary)" }
          }
        >
          {t("admin.platform_commissions.records") || "Records"}
          <span
            className="rounded-full px-1.5 py-px text-[10px] font-semibold"
            style={
              tab === "records"
                ? { backgroundColor: "rgba(255,255,255,0.2)", color: "white" }
                : { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }
            }
          >
            {recordsMeta?.total ?? 0}
          </span>
        </button>
      </div>

      {tab === "policies" ? (
        <FilterCard>
          <FilterField label="Status">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </FilterField>
          <FilterField label="Service type">
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            >
              <option value="">All services</option>
              <option value="hotel">Hotel</option>
              <option value="flight">Flight</option>
              <option value="transfer">Transfer</option>
              <option value="excursion">Excursion</option>
              <option value="car">Car</option>
              <option value="visa">Visa</option>
              <option value="package">Package</option>
            </select>
          </FilterField>
          <FilterField label="Type">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            >
              <option value="">All</option>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed</option>
            </select>
          </FilterField>
          <FilterField label="Search" minWidth={240}>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Policy name or company..."
              className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            />
          </FilterField>
          {activeChips.length > 0 ? <V2Button onClick={clearAllFilters}>Clear</V2Button> : null}
        </FilterCard>
      ) : null}

      {tab === "policies" && activeChips.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium" style={{ color: "var(--admin-text-secondary)" }}>
            Active filters:
          </span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium transition hover:opacity-80"
              style={{
                backgroundColor: "var(--admin-primary-soft)",
                borderColor: "var(--admin-primary-light)",
                color: "var(--admin-primary)",
              }}
            >
              {chip.label}
              <XIcon className="h-3 w-3 opacity-70" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium opacity-80 hover:opacity-100"
            style={{ color: "var(--admin-text-secondary)" }}
          >
            <XCircle className="h-3 w-3" />
            Clear all
          </button>
        </div>
      ) : null}

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

      {tab === "policies" ? (
        <V2Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead
                className="text-[11px] font-semibold uppercase tracking-[0.5px]"
                style={{ backgroundColor: "var(--admin-bg-secondary)", color: "var(--admin-text-secondary)" }}
              >
                <tr>
                  <th className="px-4 py-2.5 text-left">{t("admin.crud.common.id")}</th>
                  <th className="px-4 py-2.5 text-left">Policy name</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-left">Rate</th>
                  <th className="px-4 py-2.5 text-left">Service</th>
                  <th className="px-4 py-2.5 text-left">Company</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPolicies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                      {t("admin.platform_commissions.no_policies")}
                    </td>
                  </tr>
                ) : (
                  filteredPolicies.map((r) => {
                    const statusMeta = POLICY_STATUS_META[r.status] ?? { tone: "gray" as StatusTone, label: r.status };
                    const isPercentage = (r.type ?? "percentage") === "percentage";
                    const tone = pickAvatarTone(r.company_id ?? r.id);
                    return (
                      <tr
                        key={r.id}
                        className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                        style={{ borderColor: "var(--admin-border)" }}
                      >
                        <td className="px-4 py-3 font-mono text-[12px] text-fg-t7">#{r.id.slice(0, 8)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-fg-t8">{r.name ?? "—"}</span>
                            {r.commission_mode ? (
                              <span className="text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
                                {r.commission_mode}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={STATUS_BADGE_CLASS}
                            style={statusBadgeStyle(isPercentage ? "info" : "primary")}
                          >
                            {isPercentage ? "Percentage" : "Fixed"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-fg-t8 tabular-nums">
                          {isPercentage
                            ? `${Number(r.percent ?? r.rate ?? 0).toFixed(2)}%`
                            : formatMoney(r.rate, lang, "USD")}
                        </td>
                        <td className="px-4 py-3">
                          <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle("gray")}>
                            {r.service_type ?? "All"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.company_id ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                                style={avatarStyle(tone)}
                              >
                                {avatarInitials(`#${r.company_id}`)}
                              </span>
                              <span className="text-fg-t8">Company #{r.company_id}</span>
                            </div>
                          ) : (
                            <span className="text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusMeta.tone)}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <IconButton aria-label="Edit">
                              <Edit3 />
                            </IconButton>
                            {r.status === "active" ? (
                              <IconButton
                                aria-label="Deactivate"
                                onClick={() => void handleDeactivate(r.id)}
                                disabled={busyId === r.id}
                              >
                                <Ban />
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
          {policiesMeta && policiesMeta.last_page > 1 ? (
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 text-[12px]"
              style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}
            >
              <span>
                Showing {(policiesMeta.current_page - 1) * policiesMeta.per_page + 1}–
                {Math.min(policiesMeta.current_page * policiesMeta.per_page, policiesMeta.total)} of {policiesMeta.total}{" "}
                policies
              </span>
              <Pagination page={policiesMeta.current_page} lastPage={policiesMeta.last_page} onPage={setPoliciesPage} />
            </div>
          ) : null}
        </V2Card>
      ) : (
        <V2Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead
                className="text-[11px] font-semibold uppercase tracking-[0.5px]"
                style={{ backgroundColor: "var(--admin-bg-secondary)", color: "var(--admin-text-secondary)" }}
              >
                <tr>
                  <th className="px-4 py-2.5 text-left">{t("admin.crud.common.id")}</th>
                  <th className="px-4 py-2.5 text-left">Amount</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Company</th>
                  <th className="px-4 py-2.5 text-left">Booking</th>
                  <th className="px-4 py-2.5 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                      {t("admin.platform_commissions.no_records")}
                    </td>
                  </tr>
                ) : (
                  records.map((r) => {
                    const statusMeta = RECORD_STATUS_META[r.status] ?? { tone: "gray" as StatusTone, label: r.status };
                    const tone = pickAvatarTone(r.company?.id ?? r.company_id ?? r.id);
                    return (
                      <tr
                        key={r.id}
                        className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                        style={{ borderColor: "var(--admin-border)" }}
                      >
                        <td className="px-4 py-3 font-mono text-[12px] text-fg-t7">#{r.id}</td>
                        <td className="px-4 py-3 font-semibold text-fg-t8 tabular-nums">
                          {formatMoney(r.amount, lang, r.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusMeta.tone)}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.company?.name ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                                style={avatarStyle(tone)}
                              >
                                {avatarInitials(r.company.name)}
                              </span>
                              <span className="text-fg-t8">{r.company.name}</span>
                            </div>
                          ) : (
                            <span className="text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
                              {r.company_id ? `Company #${r.company_id}` : "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px]" style={{ color: "var(--admin-primary)" }}>
                          {r.booking_id ? `#${r.booking_id}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                          {formatRelativeTime(r.created_at)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {recordsMeta && recordsMeta.last_page > 1 ? (
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 text-[12px]"
              style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}
            >
              <span>
                Showing {(recordsMeta.current_page - 1) * recordsMeta.per_page + 1}–
                {Math.min(recordsMeta.current_page * recordsMeta.per_page, recordsMeta.total)} of {recordsMeta.total} records
              </span>
              <Pagination page={recordsMeta.current_page} lastPage={recordsMeta.last_page} onPage={setRecordsPage} />
            </div>
          ) : null}
        </V2Card>
      )}

      {/* New commission policy modal */}
      {newOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNewOpen(false);
          }}
        >
          <div className="w-full max-w-[480px] overflow-hidden rounded-t-[12px] bg-white shadow-2xl sm:rounded-[12px]">
            <div className="flex items-start justify-between gap-3 border-b p-5" style={{ borderColor: "var(--admin-border)" }}>
              <h2 className="text-lg font-semibold" style={{ color: "var(--admin-text-primary)" }}>
                {t("admin.platform_commissions.new_modal_title")}
              </h2>
              <IconButton aria-label="Close" onClick={() => setNewOpen(false)}>
                <XIcon />
              </IconButton>
            </div>
            <div className="space-y-4 p-5">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium" style={{ color: "var(--admin-text-secondary)" }}>
                  {t("admin.platform_commissions.field_company_id")}
                </span>
                <input
                  type="number"
                  min="1"
                  value={newDraft.company_id || ""}
                  onChange={(e) => setNewDraft({ ...newDraft, company_id: Number(e.target.value) || 0 })}
                  className="h-[36px] rounded-md border bg-white px-3 text-[13px] outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                  style={{ borderColor: "var(--admin-border)" }}
                  placeholder={t("admin.platform_commissions.field_company_id_placeholder")}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium" style={{ color: "var(--admin-text-secondary)" }}>
                  {t("admin.platform_commissions.field_service_type")}
                </span>
                <select
                  value={newDraft.service_type ?? ""}
                  onChange={(e) => setNewDraft({ ...newDraft, service_type: e.target.value || null })}
                  className="h-[36px] rounded-md border bg-white px-3 text-[13px] outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                  style={{ borderColor: "var(--admin-border)" }}
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
                <span className="font-medium" style={{ color: "var(--admin-text-secondary)" }}>
                  {t("admin.platform_commissions.field_type")}
                </span>
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
                  className="h-[36px] rounded-md border bg-white px-3 text-[13px] outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                  style={{ borderColor: "var(--admin-border)" }}
                >
                  <option value="percentage">{t("admin.platform_commissions.type_percentage")}</option>
                  <option value="fixed">{t("admin.platform_commissions.type_fixed")}</option>
                </select>
              </label>
              {newDraft.type === "percentage" ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium" style={{ color: "var(--admin-text-secondary)" }}>
                    {t("admin.platform_commissions.field_percent")}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={newDraft.percent ?? ""}
                    onChange={(e) => setNewDraft({ ...newDraft, percent: Number(e.target.value) })}
                    className="h-[36px] rounded-md border bg-white px-3 text-[13px] outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                    style={{ borderColor: "var(--admin-border)" }}
                    placeholder="0.00"
                  />
                </label>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium" style={{ color: "var(--admin-text-secondary)" }}>
                      {t("admin.platform_commissions.field_fixed_value")}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newDraft.fixed_value ?? ""}
                      onChange={(e) => setNewDraft({ ...newDraft, fixed_value: Number(e.target.value) })}
                      className="h-[36px] rounded-md border bg-white px-3 text-[13px] outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                      style={{ borderColor: "var(--admin-border)" }}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium" style={{ color: "var(--admin-text-secondary)" }}>
                      {t("admin.platform_commissions.field_currency")}
                    </span>
                    <select
                      value={newDraft.fixed_currency ?? "AMD"}
                      onChange={(e) => setNewDraft({ ...newDraft, fixed_currency: e.target.value })}
                      className="h-[36px] rounded-md border bg-white px-3 text-[13px] outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                      style={{ borderColor: "var(--admin-border)" }}
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
                <span className="font-medium" style={{ color: "var(--admin-text-secondary)" }}>
                  {t("admin.platform_commissions.field_status")}
                </span>
                <select
                  value={newDraft.status ?? "active"}
                  onChange={(e) =>
                    setNewDraft({ ...newDraft, status: e.target.value as "active" | "inactive" | "scheduled" })
                  }
                  className="h-[36px] rounded-md border bg-white px-3 text-[13px] outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                  style={{ borderColor: "var(--admin-border)" }}
                >
                  <option value="active">{t("admin.platform_commissions.status_active")}</option>
                  <option value="inactive">{t("admin.platform_commissions.status_inactive")}</option>
                  <option value="scheduled">{t("admin.platform_commissions.status_scheduled")}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium" style={{ color: "var(--admin-text-secondary)" }}>
                  {t("admin.platform_commissions.field_notes")}
                </span>
                <textarea
                  value={newDraft.notes ?? ""}
                  onChange={(e) => setNewDraft({ ...newDraft, notes: e.target.value })}
                  className="min-h-[60px] rounded-md border bg-white px-3 py-2 text-[13px] outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                  style={{ borderColor: "var(--admin-border)" }}
                />
              </label>
            </div>
            <div
              className="flex items-center justify-end gap-2 border-t p-5"
              style={{ borderColor: "var(--admin-border)" }}
            >
              <V2Button onClick={() => setNewOpen(false)}>{t("common.cancel")}</V2Button>
              <V2Button variant="primary" disabled={newSaving} onClick={() => void handleCreatePolicy()}>
                {newSaving ? t("common.saving") : t("admin.platform_commissions.btn_create")}
              </V2Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
