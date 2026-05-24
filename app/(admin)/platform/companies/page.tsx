"use client";

/**
 * Figma layout reference: Quest CRM Copy template
 *   - Client Table (list pattern):  4393:6787
 *   - Modal Client Type:             4381:5202
 * Brand tokens: ZULU purple primary (--admin-primary).
 * Mobile compromise: governance dropdown + multi-action column means horizontal
 *   scroll on <md is retained for this page (high cell density). A future pass
 *   should split into list-only + detail page to enable card list.
 * Last synced: 2026-05-03
 */

import Link from "next/link";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { PartnerSettingsModal } from "@/components/PartnerSettingsModal";
import { TranslationsModal } from "@/components/TranslationsModal";
import { StatusPill, autoStatusTone } from "@/components/ui/StatusPill";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { usePrompt } from "@/contexts/PromptDialogContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import {
  apiApproveCompanyApplication,
  apiArchiveCompany,
  apiCompanyApplications,
  apiCompanyCountryPermissions,
  apiCompanySellerPermissions,
  apiPatchCompanyGovernance,
  apiPatchCompanySellerPermissions,
  apiPlatformCompanies,
  apiRejectCompanyApplication,
  apiRestoreCompany,
  apiSyncCompanyCountryPermissions,
  apiToggleCompanySeller,
  type CompanyApplicationRow,
  type CompanyArchiveFilter,
  SELLER_SERVICE_TYPES,
  type PlatformCompanyRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  V2Button,
} from "@/components/ui/v2";
import { Download, Plus } from "lucide-react";

type SortDir = "asc" | "desc";
type SortField = "id" | "name" | "type" | "status" | "governance_status" | "is_seller";

const GOVERNANCE_STATUSES = ["pending", "active", "suspended", "rejected"] as const;

function labelServiceType(t: string): string {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

export default function PlatformCompaniesPage() {
  const { t } = useLanguage();
  useDocumentTitle(t("admin.companies.title"));
  const { token, user } = useAdminAuth();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const allowed = canAccessPlatformAdminNav(user);
  const isSuperAdmin = user?.is_super_admin === true;
  const [archiveFilter, setArchiveFilter] = useState<CompanyArchiveFilter>("active");
  const [rows, setRows] = useState<PlatformCompanyRow[]>([]);
  const [pendingApps, setPendingApps] = useState<CompanyApplicationRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [governanceFilter, setGovernanceFilter] = useState<string>("");
  const [sellerFilter, setSellerFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortField>("id");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [draftGovernance, setDraftGovernance] = useState<Record<number, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [permModalCompany, setPermModalCompany] = useState<PlatformCompanyRow | null>(null);
  const [translateRow, setTranslateRow] = useState<PlatformCompanyRow | null>(null);
  const [partnerRow, setPartnerRow] = useState<PlatformCompanyRow | null>(null);
  const [permSelected, setPermSelected] = useState<Record<string, boolean>>({});
  const [permLoadErr, setPermLoadErr] = useState<string | null>(null);
  const [permLoading, setPermLoading] = useState(false);
  // Country permissions (per-(company, country) seller licenses)
  const [countrySelected, setCountrySelected] = useState<Record<string, { code: string; name: string }>>({});
  // Full list of countries from the location tree (one fetch on modal open).
  const [countriesAll, setCountriesAll] = useState<Array<{ code: string; name: string; flag: string | null }>>([]);
  const [countryFilter, setCountryFilter] = useState<string>("");

  const sellerParam = useMemo((): boolean | undefined => {
    if (sellerFilter === "1") return true;
    if (sellerFilter === "0") return false;
    return undefined;
  }, [sellerFilter]);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      // Phase 6.1 (extended) — load companies + pending applications in
      // parallel. Pending applications surface as additional rows at the
      // top of the table so super-admin doesn't have to navigate between
      // pages to approve/reject incoming registrations.
      const [companiesRes, appsRes] = await Promise.all([
        apiPlatformCompanies(token, {
          page,
          per_page: 20,
          search: search || undefined,
          governance_status: governanceFilter || undefined,
          is_seller: sellerParam,
          sort_by: sortBy,
          sort_dir: sortDir,
          archive_filter: archiveFilter,
        }),
        // Only fetch pending apps on page 1 + no filters that would hide
        // them (so the union view doesn't get confusing when paginating).
        page === 1 && !search && !governanceFilter && !sellerParam
          ? apiCompanyApplications(token, { status: "pending" })
          : Promise.resolve({ data: [] as CompanyApplicationRow[] }),
      ]);
      setRows(companiesRes.data);
      setMeta(companiesRes.meta);
      setPendingApps(appsRes.data ?? []);
      setDraftGovernance((prev) => {
        const next = { ...prev };
        for (const r of companiesRes.data) {
          next[r.id] = r.governance_status;
        }
        return next;
      });
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_load"));
    }
  }, [token, allowed, page, search, governanceFilter, sellerParam, sortBy, sortDir, archiveFilter, t]);

  // Approve a pending company_applications row inline from the list.
  async function approveApplication(app: CompanyApplicationRow) {
    if (!token) return;
    const ok = await confirm({
      message: t("admin.platform_companies.confirm_approve_app").replace("{name}", app.company_name),
      variant: "default",
    });
    if (!ok) return;
    setBusyId(-app.id); // negative id namespace to avoid collision with company ids
    try {
      await apiApproveCompanyApplication(token, app.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_approve_app"));
    } finally {
      setBusyId(null);
    }
  }

  async function rejectApplication(app: CompanyApplicationRow) {
    if (!token) return;
    const reason = await prompt({
      title: t("admin.platform_companies.inline_reject_title").replace("{name}", app.company_name),
      description: t("admin.platform_companies.inline_reject_description"),
      placeholder: t("admin.platform_companies.reject_reason_placeholder"),
      required: true,
      minLength: 3,
      variant: "danger",
      confirmLabel: t("admin.platform_companies.btn_reject"),
    });
    if (reason === null) return;
    setBusyId(-app.id);
    try {
      await apiRejectCompanyApplication(token, app.id, reason);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_reject_app"));
    } finally {
      setBusyId(null);
    }
  }

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  function sortIndicator(field: SortField): string {
    if (sortBy !== field) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  useEffect(() => {
    void load();
  }, [load]);

  async function openPermissionsModal(row: PlatformCompanyRow) {
    if (!token) return;
    setPermModalCompany(row);
    setPermLoadErr(null);
    setPermLoading(true);
    setPermSelected({});
    setCountrySelected({});
    setCountryFilter("");
    setCountriesAll([]);
    try {
      const [permRes, countryRes, allCountriesRes] = await Promise.all([
        apiCompanySellerPermissions(token, row.id),
        apiCompanyCountryPermissions(token, row.id),
        // Pull all countries from the location tree — one shot, no auth.
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8008/api"}/locations/search?types=country&limit=200`,
          { headers: { Accept: "application/json" } }
        )
          .then((r) => (r.ok ? r.json() : { data: [] }))
          .catch(() => ({ data: [] })),
      ]);
      const all = Array.isArray(allCountriesRes?.data)
        ? allCountriesRes.data.map(
            (c: { country_code: string; name: string; flag_emoji: string | null }) => ({
              code: c.country_code,
              name: c.name,
              flag: c.flag_emoji,
            })
          )
        : [];
      // Sort alphabetically for predictable UX
      all.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
      setCountriesAll(all);
      const next: Record<string, boolean> = {};
      for (const t of SELLER_SERVICE_TYPES) next[t] = false;
      for (const p of permRes.data.permissions) {
        if (p.status === "active" && (SELLER_SERVICE_TYPES as readonly string[]).includes(p.service_type)) {
          next[p.service_type] = true;
        }
      }
      setPermSelected(next);

      // Country permissions: keep only active rows in the editable set.
      const cs: Record<string, { code: string; name: string }> = {};
      for (const cp of countryRes.data.permissions) {
        if (cp.status === "active") {
          cs[cp.country_code] = { code: cp.country_code, name: cp.country_name };
        }
      }
      setCountrySelected(cs);
    } catch (e) {
      setPermLoadErr(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_load_permissions"));
    } finally {
      setPermLoading(false);
    }
  }

  function closePermissionsModal() {
    setPermModalCompany(null);
    setPermLoadErr(null);
    setPermSelected({});
    setCountrySelected({});
    setCountryFilter("");
    setCountriesAll([]);
    setPermLoading(false);
  }

  async function savePermissions() {
    if (!token || !permModalCompany) return;
    const permissions = SELLER_SERVICE_TYPES.filter((t) => permSelected[t]);
    setBusyId(permModalCompany.id);
    try {
      await apiPatchCompanySellerPermissions(token, permModalCompany.id, [...permissions]);
      // Country permissions: send the desired set; backend revokes anything else.
      await apiSyncCompanyCountryPermissions(
        token,
        permModalCompany.id,
        Object.values(countrySelected).map(({ code, name }) => ({ country_code: code, country_name: name }))
      );
      closePermissionsModal();
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_update"));
    } finally {
      setBusyId(null);
    }
  }

  // Phase 7.2 — archive (super-admin only)
  // 2-step confirmation: type exact company name + mandatory reason.
  // Phase 6.1 — inline approve/reject for pending governance_status rows.
  // Reuses apiPatchCompanyGovernance — no new endpoint needed.
  async function inlineApprove(row: PlatformCompanyRow) {
    if (!token) return;
    const ok = await confirm({
      message: t("admin.platform_companies.confirm_inline_approve").replace("{name}", row.name),
      variant: "default",
    });
    if (!ok) return;
    setBusyId(row.id);
    try {
      await apiPatchCompanyGovernance(token, row.id, { governance_status: "active" });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_update"));
    } finally {
      setBusyId(null);
    }
  }

  async function inlineReject(row: PlatformCompanyRow) {
    if (!token) return;
    const reason = await prompt({
      title: t("admin.platform_companies.inline_reject_title").replace("{name}", row.name),
      description: t("admin.platform_companies.inline_reject_description"),
      placeholder: t("admin.platform_companies.reject_reason_placeholder"),
      required: true,
      minLength: 3,
      variant: "danger",
      confirmLabel: t("admin.platform_companies.btn_reject"),
    });
    if (reason === null) return;
    setBusyId(row.id);
    try {
      await apiPatchCompanyGovernance(token, row.id, {
        governance_status: "rejected",
        reason,
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_update"));
    } finally {
      setBusyId(null);
    }
  }

  async function archive(row: PlatformCompanyRow) {
    if (!token || !isSuperAdmin) return;
    const typed = await prompt({
      title: t("admin.platform_companies.archive_title").replace("{name}", row.name),
      description: t("admin.platform_companies.archive_description"),
      placeholder: row.name,
      required: true,
      variant: "danger",
      confirmLabel: t("admin.platform_companies.btn_archive_confirm"),
    });
    if (typed === null) return;
    if (typed.trim() !== row.name.trim()) {
      alert(t("admin.platform_companies.confirm_name_mismatch"));
      return;
    }
    const reason = await prompt({
      title: t("admin.platform_companies.archive_reason_title"),
      description: t("admin.platform_companies.archive_reason_description"),
      placeholder: t("admin.platform_companies.reason_placeholder"),
      required: true,
      minLength: 3,
      variant: "danger",
    });
    if (reason === null) return;
    setBusyId(row.id);
    try {
      await apiArchiveCompany(token, row.id, reason);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_archive"));
    } finally {
      setBusyId(null);
    }
  }

  // Phase 7.2 — restore archived company (super-admin only)
  async function restore(row: PlatformCompanyRow) {
    if (!token || !isSuperAdmin) return;
    const ok = await confirm({
      message: t("admin.platform_companies.confirm_restore").replace("{name}", row.name),
      variant: "default",
    });
    if (!ok) return;
    setBusyId(row.id);
    try {
      await apiRestoreCompany(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_restore"));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSeller(row: PlatformCompanyRow) {
    if (!token) return;
    const nextLabel = row.is_seller ? t("admin.platform_companies.disable_seller") : t("admin.platform_companies.enable_seller");
    const ok = await confirm({
      message: t("admin.platform_companies.confirm_toggle_seller")
        .replace("{action}", nextLabel)
        .replace("{name}", row.name),
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(row.id);
    try {
      await apiToggleCompanySeller(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_toggle"));
    } finally {
      setBusyId(null);
    }
  }

  async function saveGovernance(companyId: number) {
    if (!token) return;
    const governance_status = draftGovernance[companyId];
    if (!governance_status) return;
    const row = rows.find((r) => r.id === companyId);
    if (row && governance_status === row.governance_status) {
      alert(t("admin.platform_companies.no_change_to_save"));
      return;
    }
    const reason = window.prompt(t("admin.platform_companies.optional_reason")) ?? "";
    setBusyId(companyId);
    try {
      await apiPatchCompanyGovernance(token, companyId, {
        governance_status,
        reason: reason.trim() || undefined,
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_update"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.platform_companies.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Marketplace ops → Companies page chrome. */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.platform_companies.title") },
        ]}
        title={t("admin.platform_companies.title")}
        subtitle={
          meta
            ? t("admin.platform_companies.meta")
                .replace("{total}", String(meta.total))
                .replace("{page}", String(meta.current_page))
                .replace("{lastPage}", String(meta.last_page))
            : undefined
        }
        actions={
          <>
            <V2Button icon={<Download className="h-4 w-4" />}>Export</V2Button>
            <V2Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              Add company
            </V2Button>
          </>
        }
      />

      <SectionTabs
        activeHref="/platform/companies"
        items={[
          { href: "/platform/approvals", label: "Approval queue" },
          { href: "/platform/companies", label: "Companies access", count: meta?.total },
          { href: "/platform/seller-applications", label: "Seller applications" },
          { href: "/platform/contracts", label: "Partnership agreements" },
          { href: "/platform/contract-templates", label: "Contract templates" },
          { href: "/platform/audit-logs", label: "Audit logs" },
          { href: "/bucket3/service-logs", label: "Service logs" },
          { href: "/bucket3/unverified-accounts", label: "Unverified accounts" },
        ]}
      />

      {pendingApps.length > 0 && (
        <div className="mb-4 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          {t("admin.platform_companies.pending_apps_count").replace(
            "{count}",
            String(pendingApps.length),
          )}
        </div>
      )}

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-current text-fg-t6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setSearch(searchDraft.trim());
                }
              }}
              placeholder={t("admin.platform_companies.search_placeholder")}
              className="h-10 w-full rounded-zulu border border-default bg-white pl-10 pr-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setSearch(searchDraft.trim());
            }}
            className="inline-flex h-10 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {t("common.apply")}
          </button>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">{t("admin.platform_companies.governance")}</span>
            <select
              value={governanceFilter}
              onChange={(e) => {
                setPage(1);
                setGovernanceFilter(e.target.value);
              }}
              className="h-10 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">{t("common.any")}</option>
              {GOVERNANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">{t("admin.platform_companies.seller")}</span>
            <select
              value={sellerFilter}
              onChange={(e) => {
                setPage(1);
                setSellerFilter(e.target.value);
              }}
              className="h-10 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">{t("common.any")}</option>
              <option value="1">{t("admin.platform_companies.yes")}</option>
              <option value="0">{t("admin.platform_companies.no")}</option>
            </select>
          </label>
          {/* Phase 7.2 — archive filter (super-admin only) */}
          {isSuperAdmin ? (
            <label className="flex items-center gap-2 text-sm text-fg-t6">
              <span className="font-medium text-fg-t7">{t("admin.platform_companies.archive")}</span>
              <select
                value={archiveFilter}
                onChange={(e) => {
                  setPage(1);
                  setArchiveFilter(e.target.value as CompanyArchiveFilter);
                }}
                className="h-10 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="active">{t("admin.platform_companies.archive_active")}</option>
                <option value="archived">{t("admin.platform_companies.archive_only")}</option>
                <option value="all">{t("admin.platform_companies.archive_all")}</option>
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      )}

      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-default bg-figma-bg-1 text-xs font-medium uppercase tracking-wide text-fg-t6">
              <tr>
                <th scope="col" className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("id")}
                    className="inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-primary"
                  >
                    {t("admin.crud.common.id")}
                    <span className="tabular-nums">{sortIndicator("id")}</span>
                  </button>
                </th>
                <th scope="col" className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-primary"
                  >
                    {t("admin.platform_companies.name")}
                    <span className="tabular-nums">{sortIndicator("name")}</span>
                  </button>
                </th>
                <th scope="col" className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("type")}
                    className="inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-primary"
                  >
                    {t("admin.platform_companies.type")}
                    <span className="tabular-nums">{sortIndicator("type")}</span>
                  </button>
                </th>
                <th scope="col" className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("status")}
                    className="inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-primary"
                  >
                    {t("admin.platform_companies.status")}
                    <span className="tabular-nums">{sortIndicator("status")}</span>
                  </button>
                </th>
                <th scope="col" className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("governance_status")}
                    className="inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-primary"
                  >
                    {t("admin.platform_companies.governance")}
                    <span className="tabular-nums">{sortIndicator("governance_status")}</span>
                  </button>
                </th>
                <th scope="col" className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("is_seller")}
                    className="inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-primary"
                  >
                    {t("admin.platform_companies.seller")}
                    <span className="tabular-nums">{sortIndicator("is_seller")}</span>
                  </button>
                </th>
                <th scope="col" className="px-4 py-3 text-right">{t("admin.platform_companies.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && pendingApps.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-fg-t6">
                    {t("admin.platform_companies.empty")}
                  </td>
                </tr>
              )}
              {/* Pending applications — rendered above company rows. Each has
                  a distinct visual treatment (amber band + "Pending application"
                  badge) + inline Approve / Reject / Open-detail actions. */}
              {pendingApps.map((a) => (
                <tr
                  key={`app-${a.id}`}
                  className="border-b border-default bg-amber-50/40 transition hover:bg-amber-50"
                >
                  <td className="px-4 py-3 tabular-nums text-fg-t7">
                    <Link
                      href={`/platform/company-applications/${a.id}`}
                      className="text-amber-700 transition hover:underline"
                      title={t("admin.platform_companies.app_id_tooltip")}
                    >
                      A-{a.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-fg-t8">
                    <Link
                      href={`/platform/company-applications/${a.id}`}
                      className="text-fg-t8 transition hover:text-primary hover:underline"
                    >
                      {a.company_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-fg-t7 capitalize">{a.company_type ?? "—"}</td>
                  <td className="px-4 py-3" colSpan={3}>
                    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      {t("admin.platform_companies.pending_application")}
                    </span>
                    <span className="ml-2 text-xs text-fg-t6">{a.business_email}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === -a.id}
                        onClick={() => void approveApplication(a)}
                        className="inline-flex h-8 items-center rounded-zulu border border-success-300 bg-success-50 px-2.5 text-xs font-semibold text-success-800 transition hover:bg-success-100 disabled:opacity-40"
                      >
                        {t("admin.platform_companies.btn_approve")}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === -a.id}
                        onClick={() => void rejectApplication(a)}
                        className="inline-flex h-8 items-center rounded-zulu border border-error-300 bg-error-50 px-2.5 text-xs font-semibold text-error-800 transition hover:bg-error-100 disabled:opacity-40"
                      >
                        {t("admin.platform_companies.btn_reject")}
                      </button>
                      <Link
                        href={`/platform/company-applications/${a.id}`}
                        className="inline-flex h-8 items-center rounded-zulu border border-default bg-white px-2.5 text-xs font-medium text-fg-t7 transition hover:bg-figma-bg-1"
                      >
                        {t("admin.company_applications.btn_open")}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.map((r) => {
                const initials = (r.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                const tone = pickAvatarTone(r.id);
                const statusColor =
                  r.status === "active"
                    ? "var(--admin-success)"
                    : r.status === "suspended" || r.status === "banned"
                      ? "var(--admin-danger)"
                      : r.status === "pending"
                        ? "var(--admin-warning)"
                        : "var(--admin-text-tertiary)";
                return (
                <tr key={r.id} className="border-b border-default last:border-0 transition hover:bg-figma-bg-1">
                  <td className="px-4 py-3 tabular-nums font-mono text-xs text-fg-t7">
                    <Link
                      href={`/platform/companies/${r.id}`}
                      className="text-primary transition hover:underline"
                    >
                      #{r.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/platform/companies/${r.id}`}
                      className="flex items-center gap-3 transition hover:text-primary"
                    >
                      <span
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold"
                        style={avatarStyle(tone)}
                        aria-hidden
                      >
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-fg-t8 truncate">{r.name}</div>
                        {r.type ? <div className="text-[11px] text-fg-t6 truncate capitalize">{r.type}</div> : null}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-fg-t7">
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                      style={{
                        backgroundColor: "var(--admin-bg-tertiary)",
                        color: "var(--admin-text-secondary)",
                      }}
                    >
                      {r.type ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.status ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px]">
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: statusColor }}
                        />
                        <span className="capitalize">{r.status}</span>
                      </span>
                    ) : <span className="text-fg-t6">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={draftGovernance[r.id] ?? r.governance_status}
                        onChange={(e) =>
                          setDraftGovernance((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        className="h-8 rounded-zulu border border-default bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                      >
                        {GOVERNANCE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                      <StatusPill status={r.governance_status} tone={autoStatusTone(r.governance_status)} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.is_seller ? (
                      <StatusPill status="yes" tone="success">
                        {t("admin.platform_companies.yes")}
                        {r.active_seller_permissions_count != null && (
                          <span className="ml-1 tabular-nums">В· {r.active_seller_permissions_count}</span>
                        )}
                      </StatusPill>
                    ) : (
                      <StatusPill status="no" tone="muted">{t("admin.platform_companies.no")}</StatusPill>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {/* Phase 6.1 — inline approve/reject for pending rows */}
                      {r.governance_status === "pending" ? (
                        <>
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void inlineApprove(r)}
                            className="inline-flex h-8 items-center rounded-zulu border border-success-300 bg-success-50 px-2.5 text-xs font-semibold text-success-800 transition hover:bg-success-100 disabled:opacity-40"
                          >
                            {t("admin.platform_companies.btn_approve")}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void inlineReject(r)}
                            className="inline-flex h-8 items-center rounded-zulu border border-error-300 bg-error-50 px-2.5 text-xs font-semibold text-error-800 transition hover:bg-error-100 disabled:opacity-40"
                          >
                            {t("admin.platform_companies.btn_reject")}
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => saveGovernance(r.id)}
                        className="inline-flex h-8 items-center rounded-zulu border border-default bg-white px-2.5 text-xs font-medium text-fg-t7 transition hover:bg-figma-bg-1 disabled:opacity-40"
                      >
                        {t("admin.platform_companies.save_gov")}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void openPermissionsModal(r)}
                        className="inline-flex h-8 items-center rounded-zulu border border-default bg-white px-2.5 text-xs font-medium text-fg-t7 transition hover:bg-figma-bg-1 disabled:opacity-40"
                      >
                        {t("admin.platform_companies.permissions")}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void toggleSeller(r)}
                        className="inline-flex h-8 items-center rounded-zulu border border-primary-100 bg-primary-50 px-2.5 text-xs font-medium text-primary transition hover:bg-primary-100 disabled:opacity-40"
                      >
                        {r.is_seller ? t("admin.platform_companies.disable_seller") : t("admin.platform_companies.enable_seller")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartnerRow(r)}
                        className={`inline-flex h-8 items-center rounded-zulu border px-2.5 text-xs font-medium transition ${
                          r.is_partner_visible
                            ? "border-success-200 bg-success-50 text-success-800 hover:bg-success-100"
                            : "border-default bg-white text-fg-t7 hover:bg-figma-bg-1"
                        }`}
                      >
                        {r.is_partner_visible
                          ? t("admin.platform_companies.partner_on")
                          : t("admin.platform_companies.partner_off")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTranslateRow(r)}
                        title={t("admin.platform_companies.translations_tooltip")}
                        className="inline-flex h-8 items-center rounded-zulu border border-default bg-white px-2.5 text-xs font-medium text-fg-t7 transition hover:bg-figma-bg-1"
                      >
                        {t("admin.platform_companies.translations")}
                      </button>
                      {/* Phase 7.2 — archive / restore (super-admin only) */}
                      {isSuperAdmin && !r.archived_at ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void archive(r)}
                          title={t("admin.platform_companies.btn_archive_tooltip")}
                          className="inline-flex h-8 items-center rounded-zulu border border-error-200 bg-white px-2.5 text-xs font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
                        >
                          {t("admin.platform_companies.btn_archive")}
                        </button>
                      ) : null}
                      {isSuperAdmin && r.archived_at ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void restore(r)}
                          title={r.archived_reason ?? undefined}
                          className="inline-flex h-8 items-center rounded-zulu border border-warning-200 bg-warning-50 px-2.5 text-xs font-medium text-warning-700 transition hover:bg-warning-100 disabled:opacity-40"
                        >
                          {t("admin.platform_companies.btn_restore")}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}

      {permModalCompany && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="perm-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePermissionsModal();
          }}
        >
          <div className="w-full max-w-zulu-modal overflow-hidden rounded-t-zulu-modal bg-white shadow-zulu-modal sm:rounded-zulu-modal">
            <div className="flex items-start justify-between gap-3 border-b border-default p-5">
              <div>
                <h2 id="perm-modal-title" className="text-base font-semibold text-fg-t8">
                  {t("admin.platform_companies.seller_service_types")}
                </h2>
                <p className="mt-1 text-xs text-fg-t6">
                  {t("admin.platform_companies.modal_subtitle").replace("{name}", permModalCompany.name)}
                </p>
              </div>
              <button
                type="button"
                onClick={closePermissionsModal}
                aria-label={t("common.close")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-zulu text-fg-t6 transition hover:bg-figma-bg-1"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              {permLoadErr && (
                <div className="mb-3 rounded-zulu border border-error-100 bg-error-50 px-3 py-2 text-sm text-error-700">
                  {permLoadErr}
                </div>
              )}
              {permLoading ? (
                <p className="text-sm text-fg-t6">{t("admin.platform_companies.loading")}</p>
              ) : !permLoadErr ? (
                <>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-t6">
                    Service Types (what they sell)
                  </h3>
                  <ul className="mb-5 space-y-2">
                    {SELLER_SERVICE_TYPES.map((tp) => (
                      <li key={tp}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-zulu border border-default bg-white px-3 py-2 text-sm transition hover:bg-figma-bg-1">
                          <input
                            type="checkbox"
                            checked={!!permSelected[tp]}
                            onChange={(e) =>
                              setPermSelected((prev) => ({ ...prev, [tp]: e.target.checked }))
                            }
                            style={{ accentColor: "var(--admin-primary)" }}
                            className="h-4 w-4"
                          />
                          <span className="text-fg-t8">{labelServiceType(tp)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>

                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-t6">
                    Allowed Countries (where they can sell)
                  </h3>
                  {permModalCompany?.country && (
                    <div className="mb-3 rounded-zulu border border-success-100 bg-success-50 px-3 py-2 text-sm text-success-700">
                      рџЏ  Home country: <span className="font-medium">{permModalCompany.country}</span>
                      <span className="ml-1 text-xs text-success-600">(always allowed)</span>
                    </div>
                  )}

                  {/* Quick filter — handy for 40+ countries */}
                  <input
                    type="text"
                    placeholder="Filter list…"
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className="mb-2 w-full rounded-zulu border border-default bg-white px-3 py-2 text-sm"
                  />

                  {countriesAll.length === 0 ? (
                    <p className="text-xs text-fg-t6">Loading countries…</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto rounded-zulu border border-default bg-white">
                      {countriesAll
                        .filter((c) => {
                          // Exclude home country (it's the always-allowed banner above).
                          const homeName = (permModalCompany?.country ?? "").toLowerCase();
                          if (c.name.toLowerCase() === homeName) return false;
                          if (!countryFilter) return true;
                          const q = countryFilter.toLowerCase();
                          return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
                        })
                        .map((c) => {
                          const checked = !!countrySelected[c.code];
                          return (
                            <label
                              key={c.code}
                              className="flex cursor-pointer items-center gap-2 border-b border-default px-3 py-2 text-sm last:border-b-0 hover:bg-figma-bg-1"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setCountrySelected((prev) => {
                                    const n = { ...prev };
                                    if (e.target.checked) n[c.code] = { code: c.code, name: c.name };
                                    else delete n[c.code];
                                    return n;
                                  });
                                }}
                                style={{ accentColor: "var(--admin-primary)" }}
                                className="h-4 w-4"
                              />
                              {c.flag && <span className="text-base leading-none">{c.flag}</span>}
                              <span className="text-fg-t8">{c.name}</span>
                              <span className="ml-auto text-xs text-fg-t6">{c.code}</span>
                            </label>
                          );
                        })}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-fg-t6">
                    {Object.keys(countrySelected).length} additional countries granted
                  </p>
                </>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-default bg-figma-bg-1 p-4">
              <button
                type="button"
                onClick={closePermissionsModal}
                className="inline-flex h-10 items-center rounded-zulu border border-default bg-white px-4 text-sm font-medium text-fg-t7 transition hover:bg-white/70"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={!!permLoadErr || permLoading || busyId === permModalCompany.id}
                onClick={() => void savePermissions()}
                className="inline-flex h-10 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {t("admin.platform_companies.save_permissions")}
              </button>
            </div>
          </div>
        </div>
      )}
      <TranslationsModal
        open={translateRow !== null}
        onClose={() => setTranslateRow(null)}
        entityType="company"
        entityId={translateRow?.id ?? null}
        entityLabel={translateRow?.name ?? undefined}
        fields={[
          { name: "title", label: "Company name" },
          { name: "description", label: "Description", multiline: true },
        ]}
      />
      <PartnerSettingsModal
        company={partnerRow}
        onClose={() => setPartnerRow(null)}
        onSaved={(next) =>
          setRows((prev) => prev.map((r) => (r.id === next.id ? { ...r, ...next } : r)))
        }
      />
    </div>
  );
}

// v2 admin-redesign helpers — avatar tone picker.
function pickAvatarTone(id: number): "purple" | "teal" | "amber" | "blue" {
  const tones: Array<"purple" | "teal" | "amber" | "blue"> = ["purple", "teal", "amber", "blue"];
  return tones[id % tones.length]!;
}

function avatarStyle(tone: "purple" | "teal" | "amber" | "blue"): React.CSSProperties {
  const map: Record<"purple" | "teal" | "amber" | "blue", React.CSSProperties> = {
    purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
    teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  };
  return map[tone];
}
