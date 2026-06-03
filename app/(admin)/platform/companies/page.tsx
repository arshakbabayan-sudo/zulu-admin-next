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
import { StatusPill } from "@/components/ui/StatusPill";
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
import { apiCompaniesStats, type CompaniesStats } from "@/lib/marketplace-stats-api";
import { STATUS_BADGE_CLASS, statusBadgeStyle } from "@/lib/admin-v2-helpers";
import { RowActionsMenu } from "@/components/admin/RowActionsMenu";
import { exportRowsAsCsv } from "@/lib/export-csv";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PageHeader as V2PageHeader,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  StatCard,
  StatGrid,
  IconButton,
  SuperAdminTag,
} from "@/components/ui/v2";
import { MarketplaceOpsSectionTabs } from "@/components/marketplace/MarketplaceOpsSectionTabs";
import {
  Archive,
  ArchiveRestore,
  Briefcase,
  Building,
  Check,
  CircleCheck,
  Download,
  ExternalLink,
  Languages,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  Store,
  X as XIcon,
  XCircle,
} from "lucide-react";

type SortDir = "asc" | "desc";
type SortField = "id" | "name" | "type" | "status" | "governance_status" | "is_seller";

const GOVERNANCE_STATUSES = ["pending", "active", "suspended", "rejected"] as const;

function labelServiceType(t: string): string {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function governanceTone(status: string | null | undefined): "success" | "warning" | "danger" | "gray" {
  switch (status) {
    case "approved":
    case "active":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
    case "suspended":
      return "danger";
    default:
      return "gray";
  }
}

function titleCase(s: string | null | undefined): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  // v2 admin-redesign — Marketplace ops stat cards (Companies & access).
  const [stats, setStats] = useState<CompaniesStats | null>(null);

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

  useEffect(() => {
    if (!token || !allowed) return;
    void apiCompaniesStats(token)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  // v2 admin-redesign — active filter chips (Companies page).
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (governanceFilter) {
      chips.push({
        key: "governance",
        label: `Governance: ${governanceFilter.charAt(0).toUpperCase() + governanceFilter.slice(1)}`,
        clear: () => {
          setPage(1);
          setGovernanceFilter("");
        },
      });
    }
    if (sellerFilter) {
      chips.push({
        key: "seller",
        label: `Seller: ${sellerFilter === "1" ? "Yes" : "No"}`,
        clear: () => {
          setPage(1);
          setSellerFilter("");
        },
      });
    }
    if (archiveFilter !== "active") {
      chips.push({
        key: "archive",
        label: `Archive: ${archiveFilter}`,
        clear: () => {
          setPage(1);
          setArchiveFilter("active");
        },
      });
    }
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `“${search.trim()}”`,
        clear: () => {
          setPage(1);
          setSearch("");
          setSearchDraft("");
        },
      });
    }
    return chips;
  }, [governanceFilter, sellerFilter, archiveFilter, search]);

  function clearAllFilters() {
    setPage(1);
    setGovernanceFilter("");
    setSellerFilter("");
    setArchiveFilter("active");
    setSearch("");
    setSearchDraft("");
  }

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

  // Edit governance via More menu — window.prompt is intentional placeholder;
  // a richer modal can replace this in a later pass without touching the menu.
  async function editGovernance(row: PlatformCompanyRow) {
    if (!token) return;
    const allowed = GOVERNANCE_STATUSES.join(" / ");
    const next = window.prompt(`${t("admin.platform_companies.governance")} (${allowed})`, row.governance_status);
    if (!next) return;
    const trimmed = next.trim().toLowerCase();
    if (!(GOVERNANCE_STATUSES as readonly string[]).includes(trimmed)) {
      alert(`Unknown status. Allowed: ${allowed}`);
      return;
    }
    if (trimmed === row.governance_status) return;
    const reason = window.prompt(t("admin.platform_companies.optional_reason")) ?? "";
    setBusyId(row.id);
    try {
      await apiPatchCompanyGovernance(token, row.id, {
        governance_status: trimmed,
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
          { label: "Management", href: "/platform/companies" },
          { label: t("admin.platform_companies.title") },
        ]}
        title={t("admin.platform_companies.title")}
        titleBadge={<SuperAdminTag />}
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
            <V2Button onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh">
              {""}
            </V2Button>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              disabled={rows.length === 0}
              onClick={() =>
                exportRowsAsCsv("companies", rows, [
                  ["id", (r) => r.id],
                  ["name", (r) => r.name],
                  ["type", (r) => r.type ?? ""],
                  ["status", (r) => r.status ?? ""],
                  ["governance", (r) => r.governance_status],
                  ["is_seller", (r) => (r.is_seller ? "yes" : "no")],
                  ["partner_visible", (r) => (r.is_partner_visible ? "yes" : "no")],
                  ["archived_at", (r) => r.archived_at ?? ""],
                ])
              }
            >
              Export
            </V2Button>
            {/* Phase 2C step 7 (2026-05-31) — "Add company" placeholder dropped.
                Companies are created via the application-approval flow (a
                signup at zulu.am → /platform/companies application → super
                admin Approve). There is no admin-side ad-hoc create flow,
                so the button was deceptive (no onClick). */}
          </>
        }
      />

      {/* 2026-06-02 (Arshak) — /platform/companies is owned by the MANAGEMENT
          group. It used to render the Directory [People | Companies] strip,
          so a "People" tab sat on a Management page and clicking it jumped to
          Directory — confusing. Show the real Management sibling strip instead
          (Companies · Seller applications · Contracts · Logs …). Directory =
          People only; this page lives under Management. */}
      <MarketplaceOpsSectionTabs activeHref="/platform/companies" />

      {/* 4 stat cards — values from /platform-admin/companies/stats. */}
      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<Building style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.total.toLocaleString() : "—"}
          label="Total companies"
        />
        <StatCard
          icon={<CircleCheck style={{ color: "var(--admin-success)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.active.toLocaleString() : "—"}
          label="Active"
        />
        <StatCard
          icon={<Briefcase style={{ color: "var(--admin-info)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.sellers.toLocaleString() : "—"}
          label="Verified sellers"
        />
        <StatCard
          icon={<Archive style={{ color: "var(--admin-text-tertiary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.archived.toLocaleString() : "—"}
          label="Archived"
        />
      </StatGrid>

      {pendingApps.length > 0 && (
        <div
          className="mb-3 inline-flex items-center rounded-md border px-3 py-1 text-[12px] font-semibold"
          style={{
            backgroundColor: "var(--admin-warning-light)",
            borderColor: "var(--admin-warning-light)",
            color: "var(--admin-warning-dark)",
          }}
        >
          {t("admin.platform_companies.pending_apps_count").replace("{count}", String(pendingApps.length))}
        </div>
      )}

      <FilterCard>
        <FilterField label={t("admin.platform_companies.governance")}>
          <select
            value={governanceFilter}
            onChange={(e) => {
              setPage(1);
              setGovernanceFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">{t("common.all")}</option>
            {GOVERNANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label={t("admin.platform_companies.seller")}>
          <select
            value={sellerFilter}
            onChange={(e) => {
              setPage(1);
              setSellerFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">{t("common.all")}</option>
            <option value="1">Verified seller</option>
            <option value="0">Not a seller</option>
          </select>
        </FilterField>
        {isSuperAdmin ? (
          <FilterField label={t("admin.platform_companies.archive")}>
            <select
              value={archiveFilter}
              onChange={(e) => {
                setPage(1);
                setArchiveFilter(e.target.value as CompanyArchiveFilter);
              }}
              className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            >
              <option value="active">{t("admin.platform_companies.archive_active")}</option>
              <option value="archived">{t("admin.platform_companies.archive_only")}</option>
              <option value="all">{t("admin.platform_companies.archive_all")}</option>
            </select>
          </FilterField>
        ) : null}
        <FilterField label="Search" minWidth={240}>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--admin-text-tertiary)" }}
            />
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setSearch(searchDraft.trim());
                }
              }}
              placeholder={t("admin.platform_companies.search_placeholder")}
              className="h-[34px] w-full rounded-md border bg-white pl-9 pr-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            />
          </div>
        </FilterField>
        <V2Button
          variant="primary"
          size="md"
          onClick={() => {
            setPage(1);
            setSearch(searchDraft.trim());
          }}
        >
          {t("common.apply")}
        </V2Button>
        {activeChips.length > 0 ? (
          <V2Button size="md" onClick={clearAllFilters}>
            Clear
          </V2Button>
        ) : null}
      </FilterCard>

      {activeChips.length > 0 ? (
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

      {err && (
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
      )}

      <V2Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
            <thead
              className="text-[11px] font-semibold uppercase tracking-[0.5px]"
              style={{ backgroundColor: "var(--admin-bg-secondary)", color: "var(--admin-text-secondary)" }}
            >
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
              {pendingApps.map((a) => {
                // Spec §3.B — pending applications waiting >7 days get danger badge.
                const createdMs = a.submitted_at ? new Date(a.submitted_at).getTime() : NaN;
                const ageDays = !Number.isNaN(createdMs) ? Math.floor((Date.now() - createdMs) / 86_400_000) : 0;
                const isStale = ageDays > 7;
                return (
                <tr
                  key={`app-${a.id}`}
                  className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                  style={{ borderColor: "var(--admin-border)" }}
                >
                  <td className="px-4 py-3 tabular-nums font-mono text-[12px]">
                    <Link
                      href={`/platform/company-applications/${a.id}`}
                      className="hover:underline"
                      style={{ color: "var(--admin-warning-dark)" }}
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
                    <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(isStale ? "danger" : "warning")}>
                      {t("admin.platform_companies.pending_application")}
                      {ageDays > 0 ? ` · ${ageDays}d` : ""}
                    </span>
                    <span className="ml-2 text-xs text-fg-t6">{a.business_email}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === -a.id}
                        onClick={() => void approveApplication(a)}
                        aria-label={t("admin.platform_companies.btn_approve")}
                        title={t("admin.platform_companies.btn_approve")}
                        className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-md border border-success-300 bg-success-50 text-success-800 transition hover:bg-success-100 disabled:opacity-40 [&>svg]:h-[18px] [&>svg]:w-[18px]"
                      >
                        <Check />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === -a.id}
                        onClick={() => void rejectApplication(a)}
                        aria-label={t("admin.platform_companies.btn_reject")}
                        title={t("admin.platform_companies.btn_reject")}
                        className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-md border border-error-300 bg-error-50 text-error-800 transition hover:bg-error-100 disabled:opacity-40 [&>svg]:h-[18px] [&>svg]:w-[18px]"
                      >
                        <XIcon />
                      </button>
                      <IconButton
                        as="link"
                        href={`/platform/company-applications/${a.id}`}
                        aria-label={t("admin.company_applications.btn_open")}
                      >
                        <ExternalLink />
                      </IconButton>
                    </div>
                  </td>
                </tr>
                );
              })}
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
                    <span
                      className={STATUS_BADGE_CLASS}
                      style={statusBadgeStyle(governanceTone(r.governance_status))}
                    >
                      {titleCase(r.governance_status)}
                    </span>
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
                    <div className="flex justify-end gap-1.5">
                      {/* Pending rows surface inline Approve/Reject icon buttons
                          per spec 3.B. All other actions move into the More
                          dropdown (no more 7-button cluster of v1). */}
                      {r.governance_status === "pending" ? (
                        <>
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void inlineApprove(r)}
                            aria-label={t("admin.platform_companies.btn_approve")}
                            title={t("admin.platform_companies.btn_approve")}
                            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-md border border-success-300 bg-success-50 text-success-800 transition hover:bg-success-100 disabled:opacity-40 [&>svg]:h-[18px] [&>svg]:w-[18px]"
                          >
                            <Check />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void inlineReject(r)}
                            aria-label={t("admin.platform_companies.btn_reject")}
                            title={t("admin.platform_companies.btn_reject")}
                            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-md border border-error-300 bg-error-50 text-error-800 transition hover:bg-error-100 disabled:opacity-40 [&>svg]:h-[18px] [&>svg]:w-[18px]"
                          >
                            <XIcon />
                          </button>
                        </>
                      ) : (
                        <>
                          <IconButton
                            aria-label={t("admin.platform_companies.permissions")}
                            title={t("admin.platform_companies.permissions")}
                            disabled={busyId === r.id}
                            onClick={() => void openPermissionsModal(r)}
                          >
                            <Shield />
                          </IconButton>
                          <IconButton
                            aria-label={t("admin.platform_companies.translations")}
                            title={t("admin.platform_companies.translations_tooltip")}
                            onClick={() => setTranslateRow(r)}
                          >
                            <Languages />
                          </IconButton>
                        </>
                      )}
                      <RowActionsMenu
                        disabled={busyId === r.id}
                        items={[
                          {
                            key: "edit-governance",
                            label: t("admin.platform_companies.governance"),
                            icon: <Pencil />,
                            onSelect: () => void editGovernance(r),
                          },
                          {
                            key: "toggle-seller",
                            label: r.is_seller
                              ? t("admin.platform_companies.disable_seller")
                              : t("admin.platform_companies.enable_seller"),
                            icon: <Store />,
                            onSelect: () => void toggleSeller(r),
                          },
                          {
                            key: "partner",
                            label: r.is_partner_visible
                              ? t("admin.platform_companies.partner_on")
                              : t("admin.platform_companies.partner_off"),
                            icon: <Briefcase />,
                            onSelect: () => setPartnerRow(r),
                          },
                          ...(isSuperAdmin && !r.archived_at
                            ? [
                                {
                                  key: "archive",
                                  label: t("admin.platform_companies.btn_archive"),
                                  icon: <Archive />,
                                  onSelect: () => void archive(r),
                                  destructive: true,
                                },
                              ]
                            : []),
                          ...(isSuperAdmin && r.archived_at
                            ? [
                                {
                                  key: "restore",
                                  label: t("admin.platform_companies.btn_restore"),
                                  icon: <ArchiveRestore />,
                                  onSelect: () => void restore(r),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {meta && meta.last_page > 1 ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 text-[12px]"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}
          >
            <span>
              Showing {(meta.current_page - 1) * meta.per_page + 1}–
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} companies
            </span>
            <PaginationBar meta={meta} onPage={setPage} />
          </div>
        ) : null}
      </V2Card>

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
