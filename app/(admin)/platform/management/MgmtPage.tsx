"use client";

/**
 * admin v3 — Management 1:1 React port of docs/admin_designe/6_management.html.
 *
 * One client component renders the entire Management surface (sidebar +
 * header + 5 panes + drawers + modals) with markup mirroring the HTML mock
 * verbatim. All styles live in `./management.css` (also a verbatim port).
 *
 * Data wiring uses the existing backend clients:
 *   - apiPlatformCompanies / apiPlatformCompany — Companies
 *   - apiSellerApplications / apiSellerApplicationDetail — Applications
 *   - apiApprove/RejectSellerApplication — drawer actions
 *   - apiAdminContracts / apiAdminContract — Contracts
 *   - apiAdminContractTemplates / apiAdminContractTemplate /
 *     apiAdminCreateContractTemplate / apiAdminUpdateContractTemplate — Templates
 *   - raw fetch on /platform-admin/audit-logs(/{id}|/verify-integrity) — Logs
 *   - apiPatchCompanyProfile / apiPatchCompanyGovernance /
 *     apiPatchCompanyPartnerSettings — Company detail forms
 *   - apiPlatformUsers — Staff sub-pane
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./management.css";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiPlatformCompanies,
  apiPlatformCompany,
  apiPatchCompanyProfile,
  apiPatchCompanyGovernance,
  apiPatchCompanyPartnerSettings,
  apiPlatformUsers,
  apiCompanyApplications,
  apiCompanySellerPermissions,
  apiPatchCompanySellerPermissions,
  apiCompanyCountryPermissions,
  apiSyncCompanyCountryPermissions,
  apiSellerApplications,
  apiSellerApplicationDetail,
  apiApproveSellerApplication,
  apiRejectSellerApplication,
  SELLER_SERVICE_TYPES,
  type CompanyProfileEditable,
  type CompanyApplicationRow,
  type CompanyCountryPermissionApiRow,
  type CompanySellerPermissionApiRow,
  type PlatformAdminUserRow,
  type PlatformCompanyRow,
  type SellerApplicationDetail,
  type SellerApplicationRow,
} from "@/lib/platform-admin-api";
import CompanyCommissionTab from "@/components/CompanyCommissionTab";
import { AddEmployeeModal } from "@/components/employees/AddEmployeeModal";
import { PartnerSettingsModal } from "@/components/PartnerSettingsModal";
import {
  apiAdminContracts,
  apiAdminContract,
  apiAdminContractTemplates,
  apiAdminContractTemplate,
  apiAdminCreateContractTemplate,
  apiAdminUpdateContractTemplate,
  apiAdminSendContract,
  apiAdminCountersignContract,
  apiAdminTerminateContract,
  contractStatusLabel,
  contractTypeLabel,
  CONTRACT_TYPES,
  CONTRACT_LANGUAGES,
  type ContractDetail,
  type ContractRow,
  type ContractTemplateDetail,
  type ContractTemplateRow,
  type ContractType,
  type ContractLanguage,
} from "@/lib/contracts-api";

export type MgmtTab = "companies" | "applications" | "contracts" | "templates" | "logs";

const TAB_META: Record<
  MgmtTab,
  { label: string; subtitle: string; icon: string }
> = {
  companies: {
    label: "Companies",
    subtitle: "Platform partners — operators, agencies, airlines.",
    icon: "ti-building-community",
  },
  applications: {
    label: "Seller applications",
    subtitle: "Review and approve marketplace seller requests.",
    icon: "ti-user-check",
  },
  contracts: {
    label: "Contracts",
    subtitle: "Legal agreements with sellers and partners.",
    icon: "ti-file-text",
  },
  templates: {
    label: "Contract templates",
    subtitle: "Reusable contract templates and variables.",
    icon: "ti-template",
  },
  logs: {
    label: "Logs",
    subtitle: "Audit trail of who did what, when.",
    icon: "ti-history",
  },
};

const SIDEBAR_ITEMS: Array<{
  key: string;
  href: string;
  label: string;
  icon: string;
  badge?: { value: string; tone?: "warn" };
}> = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: "ti-dashboard" },
  { key: "inventory", href: "/operator/hotels", label: "Inventory", icon: "ti-building-store" },
  { key: "bookings", href: "/platform/bookings", label: "Bookings", icon: "ti-calendar-event" },
  { key: "finance", href: "/platform/finance-summary", label: "Finance", icon: "ti-coin" },
  { key: "directory", href: "/platform/users", label: "Directory", icon: "ti-id-badge-2" },
  { key: "hr", href: "/crm/team", label: "HR", icon: "ti-clipboard-list" },
  { key: "inbox", href: "/admin-redesign/notifications", label: "Inbox", icon: "ti-inbox", badge: { value: "3", tone: "warn" } },
  { key: "management", href: "/platform/companies", label: "Management", icon: "ti-shield-check" },
  { key: "files", href: "/admin-redesign/files", label: "File manager", icon: "ti-folder" },
  { key: "profile", href: "/admin-redesign/profile", label: "My profile", icon: "ti-user" },
  { key: "settings", href: "/settings/pricing-rules", label: "Settings", icon: "ti-settings" },
];

type ApiListMeta = { current_page: number; last_page: number; per_page: number; total: number };
type AuditLogRow = {
  id: string;
  category: string;
  actor_type: string;
  actor_id: number | null;
  actor_name_snapshot: string | null;
  action: string;
  subject_type: string | null;
  subject_id: number | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  hash: string;
  previous_log_hash: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

type IntegrityResult = { is_intact: boolean; limit_checked: number; corrupted_log_ids: string[] };

function avatarToneFor(id: number | string | null | undefined): "" | "avatar-teal" | "avatar-amber" | "avatar-blue" {
  if (id == null) return "";
  const n = typeof id === "number" ? id : id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const tones: ReadonlyArray<"" | "avatar-blue" | "avatar-amber" | "avatar-teal"> = [
    "",
    "avatar-blue",
    "avatar-amber",
    "avatar-teal",
  ];
  return tones[n % 4] ?? "";
}

function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function shortenSubject(s: string | null | undefined): string {
  if (!s) return "—";
  const i = s.lastIndexOf("\\");
  return (i >= 0 ? s.slice(i + 1) : s).toLowerCase();
}

const GOVERNANCE_TONE: Record<string, "badge-success" | "badge-warning" | "badge-danger" | "badge-gray"> = {
  active: "badge-success",
  pending: "badge-warning",
  rejected: "badge-danger",
  suspended: "badge-gray",
};

const TYPE_LABEL: Record<string, string> = {
  operator: "Operator",
  agency: "Agency",
  airline: "Airline",
  hotel_chain: "Hotel chain",
  other: "Other",
};

const APP_STATUS_TONE: Record<string, "badge-success" | "badge-warning" | "badge-danger" | "badge-info"> = {
  approved: "badge-success",
  pending: "badge-warning",
  under_review: "badge-info",
  rejected: "badge-danger",
};

const CONTRACT_STATUS_TONE: Record<string, "badge-success" | "badge-warning" | "badge-danger" | "badge-info" | "badge-gray"> = {
  draft: "badge-gray",
  sent: "badge-info",
  signed_by_a: "badge-info",
  signed_by_b: "badge-info",
  countersigned: "badge-success",
  active: "badge-success",
  expired: "badge-warning",
  terminated: "badge-danger",
  disputed: "badge-warning",
};

export function MgmtPage({ initialTab = "companies" }: { initialTab?: MgmtTab }) {
  const router = useRouter();
  const { token, user, logout } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);

  // ───────────────── Top-level state ─────────────────
  const [tab, setTab] = useState<MgmtTab>(initialTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Companies
  const [companies, setCompanies] = useState<PlatformCompanyRow[]>([]);
  const [companiesMeta, setCompaniesMeta] = useState<ApiListMeta | null>(null);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companiesSearch, setCompaniesSearch] = useState("");
  const [companiesFilterGov, setCompaniesFilterGov] = useState("");
  const [companiesFilterType, setCompaniesFilterType] = useState("");
  const [companiesFilterSeller, setCompaniesFilterSeller] = useState("");
  const [companiesFilterArchive, setCompaniesFilterArchive] = useState<"active" | "archived" | "all">("active");
  // List ↔ Detail
  const [detailCompanyId, setDetailCompanyId] = useState<number | null>(null);
  const [detailCompany, setDetailCompany] = useState<PlatformCompanyRow | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<"profile" | "staff" | "apps" | "perms" | "commission" | "payments">("profile");
  const [detailStaff, setDetailStaff] = useState<PlatformAdminUserRow[] | null>(null);
  const [detailApps, setDetailApps] = useState<CompanyApplicationRow[] | null>(null);
  const [detailLang, setDetailLang] = useState<"EN" | "RU" | "HY">("EN");
  const [detailPerms, setDetailPerms] = useState<CompanySellerPermissionApiRow[] | null>(null);
  const [detailCountries, setDetailCountries] = useState<CompanyCountryPermissionApiRow[] | null>(null);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);

  // Applications
  const [apps, setApps] = useState<SellerApplicationRow[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsFilterStatus, setAppsFilterStatus] = useState("");
  const [appsFilterService, setAppsFilterService] = useState("");
  const [appsSearch, setAppsSearch] = useState("");

  // Contracts
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractsFilterStatus, setContractsFilterStatus] = useState("");
  const [contractsSearch, setContractsSearch] = useState("");

  // Templates
  const [templates, setTemplates] = useState<ContractTemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Audit logs
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFilterCategory, setLogsFilterCategory] = useState("");
  const [logsFilterFrom, setLogsFilterFrom] = useState("");
  const [logsFilterTo, setLogsFilterTo] = useState("");
  const [logsSearch, setLogsSearch] = useState("");
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);

  // Drawers / modals
  const [appDrawer, setAppDrawer] = useState<SellerApplicationDetail | null>(null);
  const [appDrawerLoading, setAppDrawerLoading] = useState(false);
  const [contractDrawer, setContractDrawer] = useState<ContractDetail | null>(null);
  const [contractDrawerLoading, setContractDrawerLoading] = useState(false);
  const [auditDrawer, setAuditDrawer] = useState<AuditLogRow | null>(null);
  const [templateModal, setTemplateModal] = useState<ContractTemplateDetail | "new" | null>(null);
  const [templateModalSaving, setTemplateModalSaving] = useState(false);

  const baseURL = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am",
    []
  );

  // ───────────────── URL sync ─────────────────
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // ───────────────── Companies LIST loader ─────────────────
  const loadCompanies = useCallback(async () => {
    if (!token || !allowed) return;
    setCompaniesLoading(true);
    try {
      const sellerParam = companiesFilterSeller === "1" ? true : companiesFilterSeller === "0" ? false : undefined;
      const res = await apiPlatformCompanies(token, {
        page: companiesPage,
        per_page: 20,
        search: companiesSearch || undefined,
        governance_status: companiesFilterGov || undefined,
        type: companiesFilterType || undefined,
        is_seller: sellerParam,
        archive_filter: companiesFilterArchive,
      });
      setCompanies(res.data);
      setCompaniesMeta(res.meta);
    } catch (e) {
      console.error("companies load failed", e);
    } finally {
      setCompaniesLoading(false);
    }
  }, [
    token,
    allowed,
    companiesPage,
    companiesSearch,
    companiesFilterGov,
    companiesFilterType,
    companiesFilterSeller,
    companiesFilterArchive,
  ]);
  useEffect(() => {
    if (tab === "companies" && detailCompanyId === null) void loadCompanies();
  }, [tab, detailCompanyId, loadCompanies]);

  // ───────────────── Company DETAIL loader ─────────────────
  useEffect(() => {
    if (detailCompanyId === null || !token) {
      setDetailCompany(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiPlatformCompany(token, detailCompanyId);
        if (!cancelled) setDetailCompany(res.data);
      } catch (e) {
        if (!cancelled) console.error("company detail load failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailCompanyId, token]);

  // Staff loader
  useEffect(() => {
    if (detailSubTab !== "staff" || !detailCompany || detailStaff !== null || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiPlatformUsers(token, { type: "staff", per_page: 100 });
        if (cancelled) return;
        setDetailStaff(res.data.filter((u) => u.companies?.some((c) => c.id === detailCompany.id)));
      } catch {
        if (!cancelled) setDetailStaff([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailSubTab, detailCompany, detailStaff, token]);

  // Seller permissions + countries loader (perms tab)
  useEffect(() => {
    if (detailSubTab !== "perms" || !detailCompany || !token || detailPerms !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const [pRes, cRes] = await Promise.all([
          apiCompanySellerPermissions(token, detailCompany.id),
          apiCompanyCountryPermissions(token, detailCompany.id),
        ]);
        if (cancelled) return;
        setDetailPerms(pRes.data.permissions);
        setDetailCountries(cRes.data.permissions);
      } catch {
        if (!cancelled) {
          setDetailPerms([]);
          setDetailCountries([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailSubTab, detailCompany, detailPerms, token]);

  // Applications history loader (for Company detail Apps tab)
  useEffect(() => {
    if (detailSubTab !== "apps" || !detailCompany || detailApps !== null || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiCompanyApplications(token, { company_id: detailCompany.id });
        if (!cancelled) setDetailApps(res.data);
      } catch {
        if (!cancelled) setDetailApps([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailSubTab, detailCompany, detailApps, token]);

  // ───────────────── Applications LIST loader ─────────────────
  const loadApps = useCallback(async () => {
    if (!token || !allowed) return;
    setAppsLoading(true);
    try {
      const res = await apiSellerApplications(token, {
        page: 1,
        per_page: 50,
        status: appsFilterStatus === "" ? undefined : appsFilterStatus,
      });
      setApps(res.data);
    } catch (e) {
      console.error("apps load failed", e);
    } finally {
      setAppsLoading(false);
    }
  }, [token, allowed, appsFilterStatus]);
  useEffect(() => {
    if (tab === "applications") void loadApps();
  }, [tab, loadApps]);

  // ───────────────── Contracts LIST loader ─────────────────
  const loadContracts = useCallback(async () => {
    if (!token || !allowed) return;
    setContractsLoading(true);
    try {
      const res = await apiAdminContracts(token, {
        page: 1,
        per_page: 50,
        status: contractsFilterStatus === "" ? "" : (contractsFilterStatus as never),
        q: contractsSearch || undefined,
      });
      setContracts(res.data);
    } catch (e) {
      console.error("contracts load failed", e);
    } finally {
      setContractsLoading(false);
    }
  }, [token, allowed, contractsFilterStatus, contractsSearch]);
  useEffect(() => {
    if (tab === "contracts") void loadContracts();
  }, [tab, loadContracts]);

  // ───────────────── Templates LIST loader ─────────────────
  const loadTemplates = useCallback(async () => {
    if (!token || !allowed) return;
    setTemplatesLoading(true);
    try {
      const res = await apiAdminContractTemplates(token, { per_page: 100 });
      setTemplates(res.data);
    } catch (e) {
      console.error("templates load failed", e);
    } finally {
      setTemplatesLoading(false);
    }
  }, [token, allowed]);
  useEffect(() => {
    if (tab === "templates") void loadTemplates();
  }, [tab, loadTemplates]);

  // ───────────────── Audit logs LIST loader ─────────────────
  const loadLogs = useCallback(async () => {
    if (!token || !allowed) return;
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", per_page: "50" });
      if (logsFilterCategory) params.set("category", logsFilterCategory);
      if (logsFilterFrom) params.set("from", logsFilterFrom);
      if (logsFilterTo) params.set("to", logsFilterTo);
      if (logsSearch) params.set("q", logsSearch);
      const res = await fetch(`${baseURL}/platform-admin/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await res.json();
      if (json?.success) setLogs(json.data ?? []);
    } catch (e) {
      console.error("logs load failed", e);
    } finally {
      setLogsLoading(false);
    }
  }, [token, allowed, baseURL, logsFilterCategory, logsFilterFrom, logsFilterTo, logsSearch]);
  useEffect(() => {
    if (tab === "logs") void loadLogs();
  }, [tab, loadLogs]);

  // ───────────────── Actions ─────────────────
  async function openAppDrawer(id: number) {
    if (!token) return;
    setAppDrawerLoading(true);
    setAppDrawer({ id } as SellerApplicationDetail);
    try {
      const res = await apiSellerApplicationDetail(token, id);
      setAppDrawer(res.data);
    } catch (e) {
      console.error("app detail failed", e);
    } finally {
      setAppDrawerLoading(false);
    }
  }

  async function approveApp(id: number, notes?: string) {
    if (!token) return;
    try {
      await apiApproveSellerApplication(token, id, notes);
      setAppDrawer(null);
      void loadApps();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Approve failed");
    }
  }

  async function rejectApp(id: number) {
    if (!token) return;
    const reason = window.prompt("Rejection reason (optional)") ?? "";
    try {
      await apiRejectSellerApplication(token, id, reason);
      setAppDrawer(null);
      void loadApps();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Reject failed");
    }
  }

  async function openContractDrawer(id: string) {
    if (!token) return;
    setContractDrawerLoading(true);
    try {
      const res = await apiAdminContract(token, id);
      setContractDrawer(res.data);
    } catch (e) {
      console.error("contract detail failed", e);
    } finally {
      setContractDrawerLoading(false);
    }
  }

  async function openTemplateModal(id: string) {
    if (!token) return;
    try {
      const res = await apiAdminContractTemplate(token, id);
      setTemplateModal(res.data);
    } catch (e) {
      console.error("template detail failed", e);
    }
  }

  async function openAuditDrawer(row: AuditLogRow) {
    if (!token) {
      setAuditDrawer(row);
      return;
    }
    try {
      const res = await fetch(`${baseURL}/platform-admin/audit-logs/${row.id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await res.json();
      setAuditDrawer(json?.data ?? row);
    } catch {
      setAuditDrawer(row);
    }
  }

  async function verifyIntegrity() {
    if (!token) return;
    try {
      const res = await fetch(`${baseURL}/platform-admin/audit-logs/verify-integrity?limit=1000`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await res.json();
      setIntegrity(json?.data ?? null);
    } catch (e) {
      console.error("verify integrity failed", e);
    }
  }

  function switchTab(next: MgmtTab) {
    setTab(next);
    setDetailCompanyId(null);
    // Update URL so deep-links / refresh land on the right route
    const map: Record<MgmtTab, string> = {
      companies: "/platform/companies",
      applications: "/platform/seller-applications",
      contracts: "/platform/contracts",
      templates: "/platform/contract-templates",
      logs: "/platform/audit-logs",
    };
    router.push(map[next]);
  }

  // ───────────────── Render shell ─────────────────
  const activeMeta = TAB_META[tab];
  const inCompanyDetail = tab === "companies" && detailCompanyId !== null && detailCompany !== null;

  return (
    <div className="mgmt-page mgmt-page-host">
      <div className={`layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <Sidebar collapsed={sidebarCollapsed} activeKey="management" />
        <div className="main">
          <Header
            collapsed={sidebarCollapsed}
            onHamburger={() => setSidebarCollapsed((v) => !v)}
            title={`Management · ${inCompanyDetail ? detailCompany.name : activeMeta.label}`}
            user={user ?? null}
            token={token}
            onLogout={() => void logout().then(() => router.push("/login"))}
            onNotifications={() => router.push("/admin-redesign/notifications")}
            onApps={() => router.push("/dashboard")}
          />
          <div className="page">
            <div className="page-header">
              <div>
                <div className="breadcrumb">
                  <a onClick={() => router.push("/dashboard")}>Home</a>
                  <i className="ti ti-chevron-right" />
                  <span className="breadcrumb-current">
                    {inCompanyDetail ? detailCompany.name : activeMeta.label}
                  </span>
                </div>
                <h1 className="page-title">
                  <span>{inCompanyDetail ? detailCompany.name : activeMeta.label}</span>
                  <span className="super-tag">
                    <i className="ti ti-shield-lock" style={{ fontSize: 13 }} />
                    Super admin
                  </span>
                </h1>
                <div className="page-subtitle">
                  {inCompanyDetail ? `Company detail` : activeMeta.subtitle}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {tab === "companies" && !inCompanyDetail && (
                  <button className="btn">
                    <i className="ti ti-download" />
                    Export
                  </button>
                )}
                {tab === "applications" && (
                  <button className="btn">
                    <i className="ti ti-download" />
                    Export
                  </button>
                )}
                {tab === "contracts" && (
                  <button className="btn btn-primary" onClick={() => router.push("/platform/contracts/new")}>
                    <i className="ti ti-plus" />
                    New contract
                  </button>
                )}
                {tab === "templates" && (
                  <button className="btn btn-primary" onClick={() => setTemplateModal("new")}>
                    <i className="ti ti-plus" />
                    New template
                  </button>
                )}
              </div>
            </div>

            <div className="section-tabs">
              {(Object.keys(TAB_META) as MgmtTab[]).map((k) => {
                // Live counts from the loaded data per pane (matches the
                // HTML mock's `<span class="count">128</span>` on the first
                // 3 tabs; Templates + Logs have no count in the mock).
                let count: number | null = null;
                if (k === "companies") count = companiesMeta?.total ?? companies.length;
                else if (k === "applications") count = apps.length || null;
                else if (k === "contracts") count = contracts.length || null;
                return (
                  <button
                    key={k}
                    className={`section-tab ${tab === k ? "active" : ""}`}
                    onClick={() => switchTab(k)}
                  >
                    <i className={`ti ${TAB_META[k].icon}`} />
                    {TAB_META[k].label}
                    {count !== null && count > 0 ? <span className="count">{count}</span> : null}
                  </button>
                );
              })}
            </div>

            {/* ───────── COMPANIES pane ───────── */}
            <div className={`page-pane ${tab === "companies" ? "active" : ""}`}>
              {!inCompanyDetail ? (
                <CompaniesList
                  loading={companiesLoading}
                  rows={companies}
                  meta={companiesMeta}
                  page={companiesPage}
                  onPage={setCompaniesPage}
                  search={companiesSearch}
                  onSearch={setCompaniesSearch}
                  filterGov={companiesFilterGov}
                  onFilterGov={setCompaniesFilterGov}
                  filterType={companiesFilterType}
                  onFilterType={setCompaniesFilterType}
                  filterSeller={companiesFilterSeller}
                  onFilterSeller={setCompaniesFilterSeller}
                  filterArchive={companiesFilterArchive}
                  onFilterArchive={setCompaniesFilterArchive}
                  onOpen={(id) => setDetailCompanyId(id)}
                  onApply={loadCompanies}
                />
              ) : (
                <CompaniesDetail
                  token={token}
                  company={detailCompany}
                  subTab={detailSubTab}
                  onSubTab={setDetailSubTab}
                  lang={detailLang}
                  onLang={setDetailLang}
                  staff={detailStaff}
                  apps={detailApps}
                  perms={detailPerms}
                  countries={detailCountries}
                  onAddEmployee={() => setAddEmployeeOpen(true)}
                  onOpenLogo={() => setPartnerModalOpen(true)}
                  onBack={() => {
                    setDetailCompanyId(null);
                    setDetailCompany(null);
                    setDetailStaff(null);
                    setDetailApps(null);
                    setDetailPerms(null);
                    setDetailCountries(null);
                  }}
                  onSavePermissions={async (services, countries) => {
                    if (!token || !detailCompany) return;
                    try {
                      await apiPatchCompanySellerPermissions(token, detailCompany.id, services);
                      // The country-permissions endpoint requires the `countries`
                      // array to be non-empty (Laravel `required|array` treats
                      // `[]` as missing). If the user has no extra countries to
                      // grant (home country is implicit), skip the sync — the
                      // services PATCH alone is the meaningful change.
                      if (countries.length > 0) {
                        await apiSyncCompanyCountryPermissions(
                          token,
                          detailCompany.id,
                          countries.map((c) => ({
                            country_code: c.country_code,
                            country_name: c.country_name,
                          }))
                        );
                      }
                      const [pRes, cRes, comp] = await Promise.all([
                        apiCompanySellerPermissions(token, detailCompany.id),
                        apiCompanyCountryPermissions(token, detailCompany.id),
                        apiPlatformCompany(token, detailCompany.id),
                      ]);
                      setDetailPerms(pRes.data.permissions);
                      setDetailCountries(cRes.data.permissions);
                      setDetailCompany(comp.data);
                      alert("Permissions saved.");
                    } catch (e) {
                      alert(e instanceof ApiRequestError ? e.message : "Save failed");
                    }
                  }}
                  onSaveProfile={async (patch) => {
                    if (!token || !detailCompany) return;
                    try {
                      const res = await apiPatchCompanyProfile(token, detailCompany.id, patch);
                      setDetailCompany(res.data);
                      alert("Profile saved.");
                    } catch (e) {
                      alert(e instanceof ApiRequestError ? e.message : "Save failed");
                    }
                  }}
                  onSaveGovernance={async (next) => {
                    if (!token || !detailCompany) return;
                    try {
                      await apiPatchCompanyGovernance(token, detailCompany.id, { governance_status: next });
                      const res = await apiPlatformCompany(token, detailCompany.id);
                      setDetailCompany(res.data);
                      alert("Governance saved.");
                    } catch (e) {
                      alert(e instanceof ApiRequestError ? e.message : "Save failed");
                    }
                  }}
                  onSavePartner={async (visible) => {
                    if (!token || !detailCompany) return;
                    try {
                      await apiPatchCompanyPartnerSettings(token, detailCompany.id, { is_partner_visible: visible });
                      const res = await apiPlatformCompany(token, detailCompany.id);
                      setDetailCompany(res.data);
                      alert("Branding saved.");
                    } catch (e) {
                      alert(e instanceof ApiRequestError ? e.message : "Save failed");
                    }
                  }}
                />
              )}
            </div>

            {/* ───────── APPLICATIONS pane ───────── */}
            <div className={`page-pane ${tab === "applications" ? "active" : ""}`}>
              <ApplicationsPane
                loading={appsLoading}
                rows={apps}
                search={appsSearch}
                onSearch={setAppsSearch}
                filterStatus={appsFilterStatus}
                onFilterStatus={setAppsFilterStatus}
                filterService={appsFilterService}
                onFilterService={setAppsFilterService}
                onApply={loadApps}
                onOpenDrawer={openAppDrawer}
                onApprove={(id) => void approveApp(id)}
                onReject={(id) => void rejectApp(id)}
                onOpenCompany={(id) => {
                  switchTab("companies");
                  setDetailCompanyId(id);
                }}
              />
            </div>

            {/* ───────── CONTRACTS pane ───────── */}
            <div className={`page-pane ${tab === "contracts" ? "active" : ""}`}>
              <ContractsPane
                loading={contractsLoading}
                rows={contracts}
                search={contractsSearch}
                onSearch={setContractsSearch}
                filterStatus={contractsFilterStatus}
                onFilterStatus={setContractsFilterStatus}
                onApply={loadContracts}
                onOpenDrawer={openContractDrawer}
              />
            </div>

            {/* ───────── TEMPLATES pane ───────── */}
            <div className={`page-pane ${tab === "templates" ? "active" : ""}`}>
              <TemplatesPane
                loading={templatesLoading}
                rows={templates}
                onOpen={openTemplateModal}
                onToggleActive={async (row) => {
                  if (!token) return;
                  try {
                    await apiAdminUpdateContractTemplate(token, row.id, { active: row.active === false });
                    await loadTemplates();
                  } catch (e) {
                    alert(e instanceof ApiRequestError ? e.message : "Toggle failed");
                  }
                }}
              />
            </div>

            {/* ───────── LOGS pane ───────── */}
            <div className={`page-pane ${tab === "logs" ? "active" : ""}`}>
              <LogsPane
                loading={logsLoading}
                rows={logs}
                integrity={integrity}
                onVerify={() => void verifyIntegrity()}
                search={logsSearch}
                onSearch={setLogsSearch}
                filterCategory={logsFilterCategory}
                onFilterCategory={setLogsFilterCategory}
                filterFrom={logsFilterFrom}
                onFilterFrom={setLogsFilterFrom}
                filterTo={logsFilterTo}
                onFilterTo={setLogsFilterTo}
                onApply={loadLogs}
                onOpenDrawer={openAuditDrawer}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ───────── DRAWERS ───────── */}
      <ApplicationDrawer
        open={appDrawer !== null}
        loading={appDrawerLoading}
        detail={appDrawer}
        onClose={() => setAppDrawer(null)}
        onApprove={() => appDrawer && void approveApp(appDrawer.id)}
        onReject={() => appDrawer && void rejectApp(appDrawer.id)}
        onOpenCompany={(id) => {
          setAppDrawer(null);
          switchTab("companies");
          setDetailCompanyId(id);
        }}
      />
      <ContractDrawer
        open={contractDrawer !== null}
        loading={contractDrawerLoading}
        detail={contractDrawer}
        onClose={() => setContractDrawer(null)}
        onSend={async () => {
          if (!token || !contractDrawer) return;
          if (!confirm(`Send contract ${contractDrawer.contract_number} to the partner?`)) return;
          try {
            const res = await apiAdminSendContract(token, contractDrawer.id);
            setContractDrawer(res.data);
            await loadContracts();
            alert("Contract sent.");
          } catch (e) {
            alert(e instanceof ApiRequestError ? e.message : "Send failed");
          }
        }}
        onCountersign={async () => {
          if (!token || !contractDrawer) return;
          if (!confirm(`Countersign contract ${contractDrawer.contract_number}?`)) return;
          try {
            const res = await apiAdminCountersignContract(token, contractDrawer.id);
            setContractDrawer(res.data);
            await loadContracts();
            alert("Contract countersigned.");
          } catch (e) {
            alert(e instanceof ApiRequestError ? e.message : "Countersign failed");
          }
        }}
        onTerminate={async () => {
          if (!token || !contractDrawer) return;
          const reason = window.prompt("Termination reason (required):");
          if (!reason || reason.trim().length < 3) {
            if (reason !== null) alert("A reason of at least 3 characters is required.");
            return;
          }
          try {
            const res = await apiAdminTerminateContract(token, contractDrawer.id, reason);
            setContractDrawer(res.data);
            await loadContracts();
            alert("Contract terminated.");
          } catch (e) {
            alert(e instanceof ApiRequestError ? e.message : "Terminate failed");
          }
        }}
        onPdf={() => {
          if (!contractDrawer?.signed_pdf_url) {
            alert("No signed PDF available for this contract yet.");
            return;
          }
          window.open(contractDrawer.signed_pdf_url, "_blank", "noopener,noreferrer");
        }}
      />
      <AuditDrawer open={auditDrawer !== null} row={auditDrawer} onClose={() => setAuditDrawer(null)} />

      {/* Company-detail add-employee modal */}
      {detailCompany && (
        <AddEmployeeModal
          open={addEmployeeOpen}
          onClose={() => setAddEmployeeOpen(false)}
          token={token}
          companyId={detailCompany.id}
          companyName={detailCompany.name}
          onSuccess={() => {
            setAddEmployeeOpen(false);
            setDetailStaff(null);
          }}
        />
      )}

      {/* Company-detail branding / logo / partner-visibility modal */}
      <PartnerSettingsModal
        company={partnerModalOpen ? detailCompany : null}
        onClose={() => setPartnerModalOpen(false)}
        onSaved={(next) => {
          setDetailCompany((prev) => (prev ? { ...prev, ...next } : prev));
        }}
      />

      {/* ───────── MODALS ───────── */}
      <TemplateModal
        open={templateModal !== null}
        saving={templateModalSaving}
        target={templateModal}
        onClose={() => setTemplateModal(null)}
        onSave={async (form) => {
          if (!token) return;
          setTemplateModalSaving(true);
          try {
            let variables: Record<string, unknown> = {};
            if (form.variables_json.trim() && form.variables_json.trim() !== "{}") {
              try {
                variables = JSON.parse(form.variables_json) as Record<string, unknown>;
              } catch {
                alert("Variables: invalid JSON");
                setTemplateModalSaving(false);
                return;
              }
            }
            if (templateModal === "new") {
              await apiAdminCreateContractTemplate(token, {
                name: form.name,
                type: form.type,
                language: form.language,
                body: form.body,
                variables,
                active: form.active,
              });
            } else if (templateModal && typeof templateModal !== "string") {
              await apiAdminUpdateContractTemplate(token, templateModal.id, {
                name: form.name,
                type: form.type,
                language: form.language,
                body: form.body,
                variables,
                active: form.active,
              });
            }
            setTemplateModal(null);
            await loadTemplates();
          } catch (e) {
            alert(e instanceof ApiRequestError ? e.message : "Save failed");
          } finally {
            setTemplateModalSaving(false);
          }
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHELL — sidebar + header
// ═══════════════════════════════════════════════════════════════

function Sidebar({ collapsed: _c, activeKey }: { collapsed: boolean; activeKey: string }) {
  return (
    <aside className="sidebar">
      {SIDEBAR_ITEMS.map((it) => (
        <Link key={it.key} href={it.href} className={`sidebar-item ${activeKey === it.key ? "active" : ""}`}>
          <i className={`ti ${it.icon}`} />
          <span>{it.label}</span>
          {it.badge && <span className={`sidebar-badge ${it.badge.tone ?? ""}`}>{it.badge.value}</span>}
        </Link>
      ))}
    </aside>
  );
}

const HEADER_FRONTEND_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FRONTEND_URL) || "https://zulu.am";

function Header({
  collapsed: _c,
  onHamburger,
  title,
  user,
  token,
  onLogout,
  onNotifications,
  onApps,
}: {
  collapsed: boolean;
  onHamburger: () => void;
  title: string;
  user: { name?: string | null; email?: string | null; context?: { world?: string } } | null;
  token: string | null;
  onLogout: () => void;
  onNotifications: () => void;
  onApps: () => void;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("zulu_admin_theme");
      if (stored === "dark") {
        setTheme("dark");
        document.documentElement.classList.add("dark");
      }
    } catch {
      /* ignore */
    }
  }, []);
  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (next === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      try {
        window.localStorage.setItem("zulu_admin_theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  // Open the public website carrying the admin's token through web's /sso
  // handoff so the operator lands already logged in (same as AdminShell).
  const websiteHref = token
    ? `${HEADER_FRONTEND_URL}/sso?${new URLSearchParams({ token, next: "/" }).toString()}`
    : HEADER_FRONTEND_URL;
  return (
    <header className="header">
      <div className="header-brand">
        {/* ZULU wordmark — verbatim SVG from docs/admin_designe/6_management.html */}
        <svg className="brand-logo-svg" width="1588" height="1123" viewBox="0 0 1588 1123" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="ZULU">
          <path d="M711.017 479.667C711.017 481.8 710.483 483.778 709.409 485.6C708.391 487.383 706.891 488.974 705.014 490.293C703.138 491.612 700.944 492.659 698.426 493.434C695.906 494.17 693.282 494.558 690.442 494.558H598.447C589.766 494.558 580.98 493.86 572.088 492.502C563.193 491.145 554.567 489.051 546.262 486.221C537.958 483.352 530.135 479.747 522.792 475.364C515.454 470.981 509.078 465.746 503.558 459.737C498.094 453.727 493.753 446.825 490.591 439.07C487.485 431.316 485.879 422.63 485.879 413.09V331.663H505.207V396.88C505.207 405.668 506.548 413.664 509.137 420.8C511.776 427.936 515.393 434.295 519.952 439.823C524.556 445.355 529.875 450.177 535.993 454.214C542.119 458.248 548.642 461.564 555.567 464.205C562.495 466.81 569.688 468.736 577.107 469.987C584.521 471.24 591.849 471.88 599.089 471.88C636.398 471.88 673.707 471.778 711.017 471.778V479.667Z" fill="#483762"/>
          <path d="M1070.91 483.395C1070.91 485.58 1070.38 487.607 1069.3 489.473C1068.28 491.3 1066.78 492.93 1064.91 494.281C1063.03 495.632 1060.84 496.705 1058.32 497.498C1055.8 498.253 1053.18 498.65 1050.34 498.65H958.341C949.66 498.65 940.874 497.935 931.982 496.544C923.087 495.154 914.461 493.008 906.156 490.109C897.852 487.17 890.03 483.477 882.687 478.987C875.349 474.497 868.972 469.134 863.452 462.978C857.988 456.821 853.647 449.75 850.485 441.806C847.379 433.862 845.773 424.964 845.773 415.19V331.772H865.102V398.584C865.102 407.586 866.442 415.778 869.031 423.089C871.67 430.4 875.287 436.914 879.847 442.577C884.45 448.244 889.769 453.184 895.887 457.32C902.013 461.452 908.537 464.85 915.461 467.555C922.389 470.224 929.582 472.197 937.001 473.478C944.415 474.761 951.743 475.417 958.983 475.417C996.292 475.417 1033.6 475.313 1070.91 475.313V483.395Z" fill="#483762"/>
          <path d="M709.34 331.696H690.012V410.067H709.34V331.696Z" fill="#483762"/>
          <path d="M1402.99 483.43C1402.99 485.615 1402.46 487.643 1401.38 489.509C1400.37 491.337 1398.87 492.967 1396.99 494.318C1395.11 495.67 1392.92 496.743 1390.4 497.537C1387.88 498.291 1385.26 498.688 1382.42 498.688H1290.42C1281.74 498.688 1272.96 497.973 1264.06 496.582C1255.17 495.192 1246.54 493.046 1238.24 490.146C1229.93 487.206 1222.11 483.512 1214.77 479.021C1207.43 474.53 1201.05 469.166 1195.53 463.008C1190.07 456.85 1185.73 449.777 1182.57 441.832C1179.46 433.886 1177.85 424.986 1177.85 415.21V331.773H1197.18V398.6C1197.18 407.605 1198.52 415.798 1201.11 423.111C1203.75 430.423 1207.37 436.938 1211.93 442.604C1216.53 448.271 1221.85 453.213 1227.97 457.349C1234.09 461.482 1240.62 464.881 1247.54 467.587C1254.47 470.256 1261.66 472.23 1269.08 473.511C1276.5 474.795 1283.82 475.451 1291.06 475.451C1328.37 475.451 1365.69 475.347 1402.99 475.347V483.43Z" fill="#483762"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M182.278 477.351L366.012 354.152C302.053 352.728 237.907 353.582 173.924 353.582C173.924 348.984 173.018 343.912 176.121 340.186C177.511 338.459 179.56 336.917 182.123 335.637C184.685 334.361 187.68 333.346 191.119 332.594C194.562 331.88 198.145 331.506 202.028 331.506C226.951 331.506 251.955 331.853 276.783 331.931C312.136 332.044 347.295 331.913 382.668 331.913C389.59 331.913 399.319 335.488 403.235 341.301C405.034 343.772 405.664 346.349 405.167 349.026L234.329 472.513C287.21 473.325 359.112 472.796 413.521 472.796C413.521 477.394 414.427 482.466 411.324 486.192C409.934 487.919 407.885 489.461 405.321 490.741C402.76 492.016 399.765 493.031 396.326 493.783C392.883 494.498 389.3 494.871 385.417 494.871C360.494 494.871 335.49 494.524 310.662 494.447C275.309 494.333 240.15 494.464 204.777 494.464C197.855 494.464 188.126 490.89 184.21 485.076C182.411 482.606 181.781 480.029 182.278 477.351Z" fill="#483762"/>
          <path d="M1187.6 635.395C1187.6 633.247 1188.11 631.253 1189.15 629.418C1190.13 627.621 1191.58 626.018 1193.39 624.69C1195.2 623.36 1197.31 622.306 1199.74 621.525C1202.17 620.783 1204.7 620.393 1207.44 620.393H1296.15C1304.52 620.393 1312.99 621.096 1321.56 622.463C1330.14 623.831 1338.46 625.941 1346.47 628.792C1354.48 631.683 1362.02 635.315 1369.1 639.731C1376.17 644.147 1382.32 649.42 1387.65 655.475C1392.92 661.53 1397.1 668.484 1400.15 676.297C1403.15 684.11 1404.69 692.861 1404.69 702.474V784.513H1386.06V718.805C1386.06 709.952 1384.76 701.895 1382.27 694.705C1379.72 687.515 1376.23 681.109 1371.84 675.539C1367.4 669.966 1362.27 665.107 1356.37 661.04C1350.46 656.976 1344.17 653.634 1337.49 650.973C1330.81 648.349 1323.88 646.408 1316.72 645.149C1309.58 643.886 1302.51 643.241 1295.53 643.241C1259.55 643.241 1223.57 643.344 1187.6 643.344V635.395Z" fill="#483762"/>
          <path d="M1207.85 705.107H1189.22V784.719H1207.85V705.107Z" fill="#483762"/>
          <path d="M589.912 637.789C579.612 641.962 570.651 646.961 562.899 652.691C555.223 658.424 549.129 665.004 544.684 672.397C541.512 677.773 539.455 683.618 538.571 689.905H570.689L570.733 689.821C604.801 627.297 778.31 639.858 826.743 641.207C826.743 655.683 828.238 669.535 821.226 682.662C817.52 689.467 812.439 695.531 806.035 700.803C799.566 706.077 792.1 710.677 783.506 714.526C774.905 718.371 765.74 721.533 756.015 724.051C746.286 726.536 736.182 728.373 725.765 729.564C668.892 736.102 596.511 731.273 538.07 731.273H537.689C537.689 749.305 537.861 767.336 537.843 785.377L565.17 785.395L565.216 752.981C618.751 752.988 680.089 756.508 732.814 751.034C745.306 749.741 757.422 747.744 769.081 745.046C780.749 742.309 791.734 738.872 802.047 734.693C812.351 730.514 821.308 725.522 829.062 719.792C836.736 714.06 842.878 707.502 847.274 700.085C857.208 683.323 856.059 641.522 855.799 619.431C781.261 616.291 648.377 614.101 589.912 637.789Z" fill="#483762"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M411.682 767.237L227.949 641.982C291.907 640.534 356.054 641.403 420.037 641.403C420.037 636.728 420.943 631.571 417.84 627.783C416.45 626.028 414.401 624.46 411.837 623.158C409.276 621.862 406.281 620.83 402.842 620.065C399.399 619.339 395.816 618.959 391.933 618.959C367.009 618.959 342.006 619.312 317.178 619.391C281.825 619.506 246.666 619.373 211.293 619.373C204.371 619.373 194.642 623.007 190.726 628.917C188.926 631.429 188.297 634.049 188.794 636.771L359.632 762.318C306.75 763.144 234.848 762.605 180.44 762.605C180.44 767.28 179.534 772.437 182.637 776.225C184.027 777.981 186.076 779.549 188.639 780.85C191.201 782.147 194.195 783.178 197.634 783.943C201.078 784.669 204.66 785.05 208.544 785.05C233.467 785.05 258.47 784.697 283.299 784.617C318.652 784.502 353.811 784.635 389.184 784.635C396.105 784.635 405.835 781.001 409.751 775.091C411.55 772.579 412.18 769.959 411.682 767.237Z" fill="#483762"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M1028.7 552.382C993.515 552.382 964.992 580.904 964.992 616.088C964.992 651.273 993.515 679.795 1028.7 679.795C1063.88 679.795 1092.41 651.273 1092.41 616.088C1092.41 580.904 1063.88 552.382 1028.7 552.382ZM1028.7 563.601C999.71 563.601 976.211 587.1 976.211 616.088C976.211 645.077 999.71 668.576 1028.7 668.576C1057.69 668.576 1081.19 645.077 1081.19 616.088C1081.19 587.1 1057.69 563.601 1028.7 563.601Z" fill="#B04F9C"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M1017.88 578.974C997.383 578.974 980.766 595.591 980.766 616.088C980.766 636.586 997.383 653.203 1017.88 653.203C1038.38 653.203 1055 636.586 1055 616.088C1055 595.591 1038.38 578.974 1017.88 578.974ZM1017.88 585.51C1000.99 585.51 987.302 599.2 987.302 616.088C987.302 632.976 1000.99 646.667 1017.88 646.667C1034.77 646.667 1048.46 632.976 1048.46 616.088C1048.46 599.2 1034.77 585.51 1017.88 585.51Z" fill="#B04F9C"/>
          <path d="M1401.32 331.696H1381.99V410.067H1381.99V410.067H1401.32V331.696Z" fill="#483762"/>
          <path d="M1038.02 705.107H1019.38V784.719H1038.02V705.107Z" fill="#483762"/>
        </svg>
        {/* Collapsed icon-only ZULU mark */}
        <svg className="brand-logo-icon" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M63.7065 0C28.5225 0 0 28.5226 0 63.7066C0 98.8909 28.5225 127.413 63.7065 127.413C98.8909 127.413 127.413 98.8909 127.413 63.7066C127.413 28.5226 98.8909 0 63.7065 0ZM63.7065 11.2188C34.7183 11.2188 11.2188 34.7183 11.2188 63.7066C11.2188 92.6948 34.7183 116.194 63.7065 116.194C92.6947 116.194 116.195 92.6948 116.195 63.7066C116.195 34.7183 92.6947 11.2188 63.7065 11.2188Z" fill="#B04F9C"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M52.8884 26.592C32.3909 26.592 15.7742 43.2087 15.7742 63.7066C15.7742 84.2045 32.3909 100.821 52.8884 100.821C73.3863 100.821 90.003 84.2045 90.003 63.7066C90.003 43.2087 73.3863 26.592 52.8884 26.592ZM52.8884 33.128C36.0003 33.128 22.3097 46.8185 22.3097 63.7066C22.3097 80.5947 36.0003 94.2853 52.8884 94.2853C69.7768 94.2853 83.467 80.5947 83.467 63.7066C83.467 46.8185 69.7768 33.128 52.8884 33.128Z" fill="#B04F9C"/>
        </svg>
      </div>
      <button className="header-hamburger" onClick={onHamburger} title="Toggle menu">
        <i className="ti ti-menu-2" />
      </button>
      <div className="header-title">{title}</div>
      <div className="header-search">
        <i className="ti ti-search" />
        <input type="search" placeholder="Search anything..." />
      </div>
      <div className="header-actions">
        <button className="header-lang" title="Language">
          {/* UK flag — verbatim from HTML mock */}
          <svg className="header-lang-flag" viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <clipPath id="uk-t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>
            <rect width="60" height="30" fill="#012169"/>
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
            <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-t)" stroke="#C8102E" strokeWidth="4"/>
            <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
            <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
          </svg>
          EN
        </button>
        <a
          className="header-icon-btn"
          href={websiteHref}
          target="_blank"
          rel="noopener noreferrer"
          title="Open ZULU website"
        >
          <i className="ti ti-external-link" />
        </a>
        <button
          className="header-icon-btn"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          <i className={theme === "dark" ? "ti ti-sun" : "ti ti-moon"} />
        </button>
        <button className="header-icon-btn" onClick={onNotifications} title="Notifications">
          <i className="ti ti-bell" />
          <span className="dot" />
        </button>
        <button className="header-icon-btn" onClick={onApps} title="Apps">
          <i className="ti ti-grid-dots" />
        </button>
        <div className="header-divider" />
        <div style={{ position: "relative" }}>
          <div
            className="header-user"
            onClick={() => setUserMenuOpen((v) => !v)}
            title="Account menu"
          >
            <span className="user-avatar">{(user?.name ?? "?").slice(0, 1).toUpperCase()}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.name ?? "User"}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{user?.context?.world ?? ""}</div>
            </div>
            <i
              className="ti ti-chevron-down"
              style={{
                fontSize: 15,
                color: "var(--text-secondary)",
                transform: userMenuOpen ? "rotate(180deg)" : "none",
                transition: "transform .15s",
              }}
            />
          </div>
          {userMenuOpen && (
            <div className="row-menu open" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 200 }}>
              {user && (
                <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{user.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{user.email}</div>
                </div>
              )}
              <button
                className="menu-item danger"
                onClick={() => {
                  setUserMenuOpen(false);
                  onLogout();
                }}
              >
                <i className="ti ti-logout" />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPANIES — list + detail
// ═══════════════════════════════════════════════════════════════

function CompaniesList(props: {
  loading: boolean;
  rows: PlatformCompanyRow[];
  meta: ApiListMeta | null;
  page: number;
  onPage: (p: number) => void;
  search: string;
  onSearch: (s: string) => void;
  filterGov: string;
  onFilterGov: (s: string) => void;
  filterType: string;
  onFilterType: (s: string) => void;
  filterSeller: string;
  onFilterSeller: (s: string) => void;
  filterArchive: "active" | "archived" | "all";
  onFilterArchive: (s: "active" | "archived" | "all") => void;
  onOpen: (id: number) => void;
  onApply: () => void;
}) {
  const stats = useMemo(() => {
    const total = props.meta?.total ?? props.rows.length;
    const active = props.rows.filter((r) => r.governance_status === "active").length;
    const sellers = props.rows.filter((r) => r.is_seller).length;
    const archived = props.rows.filter((r) => r.archived_at).length;
    return { total, active, sellers, archived };
  }, [props.rows, props.meta]);

  return (
    <div>
      <div className="stat-grid">
        <Stat icon="ti-building-community" tone="primary" value={String(stats.total)} label="Total companies" />
        <Stat icon="ti-circle-check" tone="success" value={String(stats.active)} label="Active" />
        <Stat icon="ti-rosette-discount-check" tone="info" value={String(stats.sellers)} label="Verified sellers" />
        <Stat icon="ti-archive" tone="warning" value={String(stats.archived)} label="Archived" />
      </div>

      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">Search</span>
          <input
            type="text"
            placeholder="Name, legal name, slug…"
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.onApply()}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">Status</span>
          <select value={props.filterGov} onChange={(e) => props.onFilterGov(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">Type</span>
          <select value={props.filterType} onChange={(e) => props.onFilterType(e.target.value)}>
            <option value="">All types</option>
            <option value="operator">Operator</option>
            <option value="agency">Agency</option>
            <option value="airline">Airline</option>
            <option value="hotel_chain">Hotel chain</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">Seller</span>
          <select value={props.filterSeller} onChange={(e) => props.onFilterSeller(e.target.value)}>
            <option value="">All</option>
            <option value="1">Sellers only</option>
            <option value="0">Non-sellers</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">Archive</span>
          <select value={props.filterArchive} onChange={(e) => props.onFilterArchive(e.target.value as "active" | "archived" | "all")}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>
        <button className="btn" onClick={props.onApply}>
          <i className="ti ti-filter" />
          Apply
        </button>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Company</th>
                <th>Country / City</th>
                <th>Status</th>
                <th>Seller</th>
                <th>Payments-ready</th>
                <th>Created</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.loading && props.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 40 }}>
                    Loading…
                  </td>
                </tr>
              ) : props.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 40 }}>
                    No companies match these filters.
                  </td>
                </tr>
              ) : (
                props.rows.map((r) => {
                  const govTone = GOVERNANCE_TONE[r.governance_status] ?? "badge-gray";
                  const payState: "ready" | "incomplete" | "none" = !r.stripe_connect_id
                    ? "none"
                    : r.stripe_charges_enabled && r.stripe_payouts_enabled
                      ? "ready"
                      : "incomplete";
                  return (
                    <tr key={r.id} onClick={() => props.onOpen(r.id)}>
                      <td className="font-mono">#{r.id}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className={`avatar sm ${avatarToneFor(r.id)}`}>{initialsFor(r.name)}</span>
                          <span className="font-semibold">{r.name}</span>
                          {r.type && <span className="type-badge">{TYPE_LABEL[r.type] ?? r.type}</span>}
                        </div>
                      </td>
                      <td className="cell-muted">
                        {[r.country, r.city].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td>
                        <span className={`badge ${govTone}`}>
                          {r.governance_status.charAt(0).toUpperCase() + r.governance_status.slice(1)}
                        </span>
                      </td>
                      <td>
                        {r.is_seller ? (
                          <>
                            <span className="font-semibold">Yes</span>{" "}
                            <span className="cell-muted">· {r.active_seller_permissions_count ?? 0}</span>
                          </>
                        ) : (
                          <span className="cell-muted">No</span>
                        )}
                      </td>
                      <td>
                        {payState === "ready" ? (
                          <span className="badge badge-success">
                            <i className="ti ti-circle-check" style={{ fontSize: 12 }} />
                            Ready
                          </span>
                        ) : payState === "incomplete" ? (
                          <span className="badge badge-warning">
                            <i className="ti ti-clock" style={{ fontSize: 12 }} />
                            Onboarding
                          </span>
                        ) : (
                          <span className="badge badge-gray">Not connected</span>
                        )}
                      </td>
                      <td className="cell-muted">{fmtDate(r.created_at)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button className="btn btn-sm" onClick={() => props.onOpen(r.id)}>
                            <i className="ti ti-eye" />
                            View
                          </button>
                          <button
                            className="icon-btn"
                            title="More"
                            onClick={(e) => {
                              e.stopPropagation();
                              alert("Suspend / Archive actions — open the company detail to manage governance status.");
                            }}
                          >
                            <i className="ti ti-dots-vertical" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {props.meta && props.meta.last_page > 1 && (
          <div className="pagination">
            <div className="pagination-info">
              Showing {(props.meta.current_page - 1) * props.meta.per_page + 1}–
              {Math.min(props.meta.current_page * props.meta.per_page, props.meta.total)} of {props.meta.total}{" "}
              companies
            </div>
            <div className="pagination-controls">
              <button
                className="btn btn-sm"
                disabled={props.page <= 1}
                onClick={() => props.onPage(props.page - 1)}
              >
                <i className="ti ti-chevron-left" />
              </button>
              <button className="btn btn-sm btn-primary">{props.meta.current_page}</button>
              <button
                className="btn btn-sm"
                disabled={props.page >= props.meta.last_page}
                onClick={() => props.onPage(props.page + 1)}
              >
                <i className="ti ti-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompaniesDetail(props: {
  token: string | null;
  company: PlatformCompanyRow | null;
  subTab: "profile" | "staff" | "apps" | "perms" | "commission" | "payments";
  onSubTab: (s: "profile" | "staff" | "apps" | "perms" | "commission" | "payments") => void;
  lang: "EN" | "RU" | "HY";
  onLang: (l: "EN" | "RU" | "HY") => void;
  staff: PlatformAdminUserRow[] | null;
  apps: CompanyApplicationRow[] | null;
  perms: CompanySellerPermissionApiRow[] | null;
  countries: CompanyCountryPermissionApiRow[] | null;
  onAddEmployee: () => void;
  onOpenLogo: () => void;
  onBack: () => void;
  onSaveProfile: (patch: CompanyProfileEditable) => Promise<void>;
  onSaveGovernance: (next: string) => Promise<void>;
  onSavePartner: (visible: boolean) => Promise<void>;
  onSavePermissions: (
    services: string[],
    countries: Array<{ country_code: string; country_name: string }>
  ) => Promise<void>;
}) {
  const c = props.company;
  const [draft, setDraft] = useState<CompanyProfileEditable>({});
  const [draftGov, setDraftGov] = useState<string>("");
  const [partnerToggle, setPartnerToggle] = useState<boolean>(false);
  useEffect(() => {
    if (!c) return;
    setDraft({
      name: c.name,
      legal_name: c.legal_name ?? null,
      type: c.type ?? null,
      tax_id: c.tax_id ?? null,
      country: c.country ?? null,
      city: c.city ?? null,
      address: c.address ?? null,
      phone: c.phone ?? null,
      website: c.website ?? null,
      description: c.description ?? null,
    });
    setDraftGov(c.governance_status);
    setPartnerToggle(!!c.is_partner_visible);
  }, [c]);

  if (!c) {
    return (
      <div className="card">
        <div className="card-body cell-muted" style={{ textAlign: "center", padding: 40 }}>
          Loading…
        </div>
      </div>
    );
  }

  const govTone = GOVERNANCE_TONE[c.governance_status] ?? "badge-gray";

  return (
    <div>
      <button className="btn btn-sm btn-ghost detail-back" onClick={props.onBack}>
        <i className="ti ti-arrow-left" />
        Back to companies
      </button>

      <div className="detail-head">
        <div className="detail-logo">{initialsFor(c.name)}</div>
        <div>
          <div className="detail-title">
            <span>{c.name}</span>
            {c.type && <span className="type-badge">{TYPE_LABEL[c.type] ?? c.type}</span>}
            <span className={`badge ${govTone}`}>
              {c.governance_status.charAt(0).toUpperCase() + c.governance_status.slice(1)}
            </span>
          </div>
          <div className="detail-meta">
            <span className="font-mono">#{c.id}</span>
            {c.slug && (
              <>
                <span>·</span>
                <span>{c.slug}</span>
              </>
            )}
            {(c.city || c.country) && (
              <>
                <span>·</span>
                <span>
                  <i className="ti ti-map-pin" style={{ fontSize: 13 }} /> {[c.city, c.country].filter(Boolean).join(", ")}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="detail-head-right">
          <div className="lang-seg">
            {(["EN", "RU", "HY"] as const).map((l) => (
              <button key={l} className={props.lang === l ? "active" : ""} onClick={() => props.onLang(l)}>
                {l}
              </button>
            ))}
          </div>
          <button
            className="icon-btn"
            title="More"
            onClick={() =>
              alert(
                "More actions — Suspend / Archive belong on the Governance card on the Profile tab below."
              )
            }
          >
            <i className="ti ti-dots-vertical" />
          </button>
        </div>
      </div>

      <div className="sub-tabs">
        {(
          [
            ["profile", "Profile"],
            ["staff", "Staff"],
            ["apps", "Applications"],
            ["perms", "Seller permissions"],
            ["commission", "Commission"],
            ["payments", "Payments"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`sub-tab ${props.subTab === key ? "active" : ""}`}
            onClick={() => props.onSubTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* PROFILE */}
      <div className={`detail-pane ${props.subTab === "profile" ? "active" : ""}`}>
        <div className="detail-card-grid">
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Identity &amp; contact</div>
                  <div className="card-subtitle">Editable — saved to the company profile</div>
                </div>
              </div>
              <div className="card-body">
                <div className="form-grid">
                  <Fld label="Name">
                    <input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </Fld>
                  <Fld label="Legal name">
                    <input
                      value={draft.legal_name ?? ""}
                      onChange={(e) => setDraft({ ...draft, legal_name: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label="Type">
                    <select
                      value={draft.type ?? ""}
                      onChange={(e) => setDraft({ ...draft, type: e.target.value || null })}
                    >
                      <option value="">—</option>
                      <option value="operator">Operator</option>
                      <option value="agency">Agency</option>
                      <option value="airline">Airline</option>
                      <option value="hotel_chain">Hotel chain</option>
                      <option value="other">Other</option>
                    </select>
                  </Fld>
                  <Fld label="Tax ID">
                    <input
                      value={draft.tax_id ?? ""}
                      onChange={(e) => setDraft({ ...draft, tax_id: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label="Country">
                    <input
                      value={draft.country ?? ""}
                      onChange={(e) => setDraft({ ...draft, country: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label="City">
                    <input
                      value={draft.city ?? ""}
                      onChange={(e) => setDraft({ ...draft, city: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label="Address" span2>
                    <input
                      value={draft.address ?? ""}
                      onChange={(e) => setDraft({ ...draft, address: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label="Phone">
                    <input
                      value={draft.phone ?? ""}
                      onChange={(e) => setDraft({ ...draft, phone: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label="Website">
                    <input
                      value={draft.website ?? ""}
                      onChange={(e) => setDraft({ ...draft, website: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label={`Description · translatable (${props.lang})`} span2>
                    <textarea
                      value={draft.description ?? ""}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value || null })}
                    />
                  </Fld>
                </div>
              </div>
              <div className="card-foot">
                <button className="btn btn-primary" onClick={() => void props.onSaveProfile(draft)}>
                  <i className="ti ti-device-floppy" />
                  Save profile
                </button>
              </div>
            </div>
          </div>
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Branding &amp; visibility</div>
                </div>
              </div>
              <div className="card-body">
                <div className="logo-upload mb-4">
                  <div className="logo-box">{initialsFor(c.name)}</div>
                  <div>
                    <button className="btn btn-sm" onClick={props.onOpenLogo}>
                      <i className="ti ti-upload" />
                      Upload logo
                    </button>
                    <div className="fld-hint" style={{ marginTop: 6 }}>
                      PNG / SVG, up to 1MB.
                    </div>
                  </div>
                </div>
                <div className="switch-row">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={partnerToggle}
                      onChange={(e) => setPartnerToggle(e.target.checked)}
                    />
                    <span className="switch-slider" />
                  </label>
                  <span>Show on the public &ldquo;Partners&rdquo; strip</span>
                </div>
              </div>
              <div className="card-foot">
                <button className="btn btn-primary" onClick={() => void props.onSavePartner(partnerToggle)}>
                  <i className="ti ti-device-floppy" />
                  Save branding
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Governance</div>
                </div>
              </div>
              <div className="card-body">
                <div className="fld mb-4">
                  <span className="fld-label">Governance status</span>
                  <select value={draftGov} onChange={(e) => setDraftGov(e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="info-grid">
                  <div className="info-row">
                    <span className="info-label">Profile completed</span>
                    <span className="info-value">
                      <span className="ro-badge">
                        <i
                          className={c.profile_completed ? "ti ti-circle-check" : "ti ti-clock"}
                          style={{ color: c.profile_completed ? "var(--success)" : "var(--warning)" }}
                        />
                        {c.profile_completed ? "Complete" : "Pending"}
                      </span>
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Created</span>
                    <span className="info-value">{fmtDate(c.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="card-foot">
                <button className="btn btn-primary" onClick={() => void props.onSaveGovernance(draftGov)}>
                  <i className="ti ti-device-floppy" />
                  Save governance
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STAFF */}
      <div className={`detail-pane ${props.subTab === "staff" ? "active" : ""}`}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Employees</div>
              <div className="card-subtitle">People who work on behalf of this company</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={props.onAddEmployee}>
              <i className="ti ti-plus" />
              Add employee
            </button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {props.staff === null ? (
                  <tr>
                    <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                      Loading…
                    </td>
                  </tr>
                ) : props.staff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                      No employees yet.
                    </td>
                  </tr>
                ) : (
                  props.staff.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className={`avatar sm ${avatarToneFor(u.id)}`}>{initialsFor(u.name)}</span>
                          <span className="font-semibold">{u.name}</span>
                        </div>
                      </td>
                      <td className="cell-muted">{u.email}</td>
                      <td>{u.companies?.find((c) => c.id === props.company?.id)?.role ?? "—"}</td>
                      <td>
                        <span className={`badge ${u.status === "active" ? "badge-success" : "badge-gray"}`}>
                          {u.status ?? "—"}
                        </span>
                      </td>
                      <td className="cell-muted">{fmtDateTime(u.last_login_at ?? u.updated_at ?? null)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button className="btn btn-sm">
                            <i className="ti ti-key" />
                            Permissions
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* APPS */}
      <div className={`detail-pane ${props.subTab === "apps" ? "active" : ""}`}>
        <div className="note-inline">
          <i className="ti ti-link" />
          Linked by <span className="font-mono">company_id</span> — reliable, no name-matching.
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>App ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Reviewed</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {props.apps === null ? (
                  <tr>
                    <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                      Loading…
                    </td>
                  </tr>
                ) : props.apps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                      No applications.
                    </td>
                  </tr>
                ) : (
                  props.apps.map((a) => {
                    const tone = (APP_STATUS_TONE[a.status] ?? "badge-gray") as string;
                    return (
                      <tr key={a.id}>
                        <td className="font-mono">APP-{String(a.id).padStart(4, "0")}</td>
                        <td>Registration</td>
                        <td>
                          <span className={`badge ${tone}`}>
                            {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                          </span>
                        </td>
                        <td className="cell-muted">{fmtDate(a.submitted_at ?? null)}</td>
                        <td className="cell-muted">{fmtDate(a.reviewed_at ?? null)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="row-actions">
                            <button className="icon-btn" title="View">
                              <i className="ti ti-eye" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PERMS — full editor (services × countries) */}
      <div className={`detail-pane ${props.subTab === "perms" ? "active" : ""}`}>
        <PermsEditor
          perms={props.perms}
          countries={props.countries}
          homeCountry={c.country ?? null}
          onSave={props.onSavePermissions}
        />
      </div>

      {/* COMMISSION — full editor (CompanyCommissionTab reuse) */}
      <div className={`detail-pane ${props.subTab === "commission" ? "active" : ""}`}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-body">
            {props.token ? (
              <CompanyCommissionTab token={props.token} companyId={c.id} />
            ) : (
              <p className="cell-muted">Sign in to view commission settings.</p>
            )}
          </div>
        </div>
      </div>

      {/* PAYMENTS */}
      <div className={`detail-pane ${props.subTab === "payments" ? "active" : ""}`}>
        {c.stripe_connect_id ? (
          c.stripe_charges_enabled && c.stripe_payouts_enabled ? (
            <div className="pay-banner ready">
              <i className="ti ti-circle-check" />
              <div>
                <div className="pb-title">Ready to receive money</div>
                <div className="pb-sub">Stripe Connect onboarding complete — charges and payouts are enabled.</div>
              </div>
            </div>
          ) : (
            <div className="pay-banner incomplete">
              <i className="ti ti-clock" />
              <div>
                <div className="pb-title">Onboarding pending</div>
                <div className="pb-sub">Stripe still needs the operator to finish onboarding.</div>
              </div>
            </div>
          )
        ) : (
          <div className="pay-banner none">
            <i className="ti ti-circle-dashed" />
            <div>
              <div className="pb-title">Not connected</div>
              <div className="pb-sub">This company hasn&rsquo;t started Stripe Connect onboarding yet.</div>
            </div>
          </div>
        )}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Stripe Connect</div>
              <div className="card-subtitle">Read-only — mirrored from Stripe</div>
            </div>
          </div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-row">
                <span className="info-label">Connected account</span>
                <span className="info-value font-mono">{c.stripe_connect_id ?? "—"}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Charges enabled</span>
                <span className="info-value">
                  <PayBadge value={c.stripe_charges_enabled ?? null} />
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Payouts enabled</span>
                <span className="info-value">
                  <PayBadge value={c.stripe_payouts_enabled ?? null} />
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Details submitted</span>
                <span className="info-value">
                  <PayBadge value={c.stripe_details_submitted ?? null} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PERM_SERVICE_META: Record<string, { name: string; icon: string }> = {
  hotel: { name: "Hotels", icon: "ti-bed" },
  flight: { name: "Flights", icon: "ti-plane" },
  transfer: { name: "Transfers", icon: "ti-car" },
  car: { name: "Car rental", icon: "ti-steering-wheel" },
  excursion: { name: "Excursions", icon: "ti-mountain" },
  visa: { name: "Visa", icon: "ti-id" },
  package: { name: "Packages", icon: "ti-package" },
};

function PermsEditor(props: {
  perms: CompanySellerPermissionApiRow[] | null;
  countries: CompanyCountryPermissionApiRow[] | null;
  homeCountry: string | null;
  onSave: (
    services: string[],
    countries: Array<{ country_code: string; country_name: string }>
  ) => Promise<void>;
}) {
  const [draftServices, setDraftServices] = useState<Record<string, boolean>>({});
  const [draftCountries, setDraftCountries] = useState<Record<string, { code: string; name: string }>>({});
  const [allCountries, setAllCountries] = useState<Array<{ code: string; name: string }>>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (props.perms === null) return;
    const next: Record<string, boolean> = {};
    for (const t of SELLER_SERVICE_TYPES) next[t] = false;
    for (const p of props.perms) {
      if (p.status === "active" && (SELLER_SERVICE_TYPES as readonly string[]).includes(p.service_type)) {
        next[p.service_type] = true;
      }
    }
    setDraftServices(next);
  }, [props.perms]);
  useEffect(() => {
    if (props.countries === null) return;
    const next: Record<string, { code: string; name: string }> = {};
    for (const c of props.countries) {
      if (c.status === "active") next[c.country_code] = { code: c.country_code, name: c.country_name };
    }
    setDraftCountries(next);
  }, [props.countries]);

  async function loadAllCountries() {
    if (allCountries.length > 0) return;
    setAdding(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "https://api.zulu.am"}/locations/search?types=country&limit=200`,
        { headers: { Accept: "application/json" } }
      );
      const json = await res.json();
      if (Array.isArray(json?.data)) {
        const arr = json.data.map((c: { country_code: string; name: string }) => ({
          code: c.country_code,
          name: c.name,
        }));
        arr.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
        setAllCountries(arr);
      }
    } catch {
      setAllCountries([]);
    } finally {
      setAdding(false);
    }
  }

  if (props.perms === null || props.countries === null) {
    return (
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-body cell-muted">Loading…</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Seller permissions</div>
          <div className="card-subtitle">Service types this company may sell, and in which countries</div>
        </div>
      </div>
      <div className="card-body">
        {SELLER_SERVICE_TYPES.map((svc) => {
          const meta = PERM_SERVICE_META[svc] ?? { name: svc, icon: "ti-circle" };
          const active = !!draftServices[svc];
          return (
            <div key={svc} className={`perm-row ${active ? "" : "off"}`}>
              <div className="perm-svc">
                <i className={`ti ${meta.icon}`} />
                <div>
                  <div className="ps-name">{meta.name}</div>
                  <div className="ps-key font-mono">{svc}</div>
                </div>
                <label className="switch" style={{ marginLeft: "auto" }}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setDraftServices((p) => ({ ...p, [svc]: e.target.checked }))}
                  />
                  <span className="switch-slider" />
                </label>
              </div>
              <div className="perm-countries">
                {props.homeCountry && (
                  <span className="mchip on" title="Home country — always allowed">
                    {props.homeCountry}
                  </span>
                )}
                {Object.values(draftCountries)
                  .filter((c) => c.name.toLowerCase() !== (props.homeCountry ?? "").toLowerCase())
                  .map((c) => (
                    <span
                      key={c.code}
                      className="mchip on"
                      onClick={() =>
                        setDraftCountries((p) => {
                          const n = { ...p };
                          delete n[c.code];
                          return n;
                        })
                      }
                      title="Click to remove"
                    >
                      {c.name}
                      <i className="ti ti-x" style={{ fontSize: 12 }} />
                    </span>
                  ))}
                <span
                  className="mchip"
                  onClick={() => {
                    if (allCountries.length === 0) void loadAllCountries();
                    const code = window.prompt(
                      `Country code (ISO 2 letters) — e.g. AM, GE, RU.\n\nLoaded ${allCountries.length} countries.`
                    );
                    if (!code) return;
                    const found = allCountries.find((c) => c.code.toUpperCase() === code.toUpperCase());
                    if (!found) {
                      alert(`Country ${code} not in catalogue.`);
                      return;
                    }
                    setDraftCountries((p) => ({ ...p, [found.code]: { code: found.code, name: found.name } }));
                  }}
                >
                  <i className="ti ti-plus" style={{ fontSize: 12 }} />
                  Add
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="card-foot">
        <button
          className="btn btn-primary"
          disabled={saving || adding}
          onClick={async () => {
            setSaving(true);
            const services = Object.entries(draftServices)
              .filter(([, v]) => v)
              .map(([k]) => k);
            const countries = Object.values(draftCountries).map((c) => ({
              country_code: c.code,
              country_name: c.name,
            }));
            await props.onSave(services, countries);
            setSaving(false);
          }}
        >
          <i className="ti ti-device-floppy" />
          {saving ? "Saving…" : "Save permissions"}
        </button>
      </div>
    </div>
  );
}

function PayBadge({ value }: { value: boolean | null }) {
  if (value == null) {
    return <span className="ro-badge cell-muted">—</span>;
  }
  return (
    <span className="ro-badge">
      <i
        className={value ? "ti ti-circle-check" : "ti ti-circle-x"}
        style={{ color: value ? "var(--success)" : "var(--danger)" }}
      />
      {value ? "Yes" : "No"}
    </span>
  );
}

function Fld({
  label,
  children,
  span2,
}: {
  label: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <div className={`fld ${span2 ? "span-2" : ""}`}>
      <span className="fld-label">{label}</span>
      {children}
    </div>
  );
}

function Stat({
  icon,
  tone,
  value,
  label,
}: {
  icon: string;
  tone: "primary" | "success" | "warning" | "info" | "danger";
  value: string;
  label: string;
}) {
  return (
    <div className={`stat-card c-${tone}`}>
      <div className="stat-header">
        <i className={`ti ${icon}`} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APPLICATIONS pane
// ═══════════════════════════════════════════════════════════════

function ApplicationsPane(props: {
  loading: boolean;
  rows: SellerApplicationRow[];
  search: string;
  onSearch: (s: string) => void;
  filterStatus: string;
  onFilterStatus: (s: string) => void;
  filterService: string;
  onFilterService: (s: string) => void;
  onApply: () => void;
  onOpenDrawer: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onOpenCompany: (id: number) => void;
}) {
  const stats = useMemo(() => {
    const pending = props.rows.filter((r) => r.status === "pending" || r.status === "under_review").length;
    const approved = props.rows.filter((r) => r.status === "approved").length;
    const rejected = props.rows.filter((r) => r.status === "rejected").length;
    return { pending, approved, rejected };
  }, [props.rows]);
  return (
    <div>
      <div className="stat-grid">
        <Stat icon="ti-clock-hour-4" tone="warning" value={String(stats.pending)} label="Pending review" />
        <Stat icon="ti-circle-check" tone="success" value={String(stats.approved)} label="Approved" />
        <Stat icon="ti-circle-x" tone="danger" value={String(stats.rejected)} label="Rejected" />
        <Stat icon="ti-hourglass" tone="info" value="—" label="Avg review time" />
      </div>
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">Search</span>
          <input
            type="text"
            placeholder="Company, applicant, ID…"
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.onApply()}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">Status</span>
          <select value={props.filterStatus} onChange={(e) => props.onFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">Service type</span>
          <select value={props.filterService} onChange={(e) => props.onFilterService(e.target.value)}>
            <option value="">All services</option>
            <option value="hotel">Hotels</option>
            <option value="flight">Flights</option>
            <option value="package">Packages</option>
            <option value="transfer">Transfers</option>
            <option value="excursion">Excursions</option>
          </select>
        </div>
        <button className="btn" onClick={props.onApply}>
          <i className="ti ti-filter" />
          Apply
        </button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>App ID</th>
                <th>Company</th>
                <th>Service type</th>
                <th>Applied</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.loading && props.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    Loading…
                  </td>
                </tr>
              ) : props.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    No applications.
                  </td>
                </tr>
              ) : (
                props.rows
                  .filter((r) => {
                    if (props.filterService && r.service_type !== props.filterService) return false;
                    if (props.search.trim() && !`${r.company_name ?? ""} ${r.id}`.toLowerCase().includes(props.search.toLowerCase())) {
                      return false;
                    }
                    return true;
                  })
                  .map((r) => {
                    const tone = APP_STATUS_TONE[r.status] ?? "badge-gray";
                    const canAct = r.status === "pending" || r.status === "under_review";
                    return (
                      <tr key={r.id} onClick={() => props.onOpenDrawer(r.id)}>
                        <td className="font-mono">APP-{String(r.id).padStart(4, "0")}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`avatar sm ${avatarToneFor(r.company_id)}`}>
                              {initialsFor(r.company_name ?? `#${r.company_id}`)}
                            </span>
                            <span className="font-semibold">{r.company_name ?? `Company #${r.company_id}`}</span>
                          </div>
                        </td>
                        <td>{r.service_type.charAt(0).toUpperCase() + r.service_type.slice(1)}</td>
                        <td className="cell-muted">{fmtDate(r.applied_at ?? null)}</td>
                        <td>
                          <span className={`badge ${tone}`}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="row-actions">
                            {canAct ? (
                              <>
                                <button className="btn btn-sm btn-primary" onClick={() => props.onApprove(r.id)}>
                                  <i className="ti ti-check" />
                                  Approve
                                </button>
                                <button className="btn btn-sm" onClick={() => props.onReject(r.id)}>
                                  <i className="ti ti-x" />
                                  Reject
                                </button>
                              </>
                            ) : null}
                            <button
                              className="icon-btn"
                              title="View company"
                              onClick={() => props.onOpenCompany(r.company_id)}
                            >
                              <i className="ti ti-building" />
                            </button>
                            <button
                              className="icon-btn"
                              title="View application"
                              onClick={() => props.onOpenDrawer(r.id)}
                            >
                              <i className="ti ti-eye" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONTRACTS pane
// ═══════════════════════════════════════════════════════════════

function ContractsPane(props: {
  loading: boolean;
  rows: ContractRow[];
  search: string;
  onSearch: (s: string) => void;
  filterStatus: string;
  onFilterStatus: (s: string) => void;
  onApply: () => void;
  onOpenDrawer: (id: string) => void;
}) {
  const stats = useMemo(() => {
    const total = props.rows.length;
    const signed = props.rows.filter((r) => r.status === "active" || r.status === "countersigned").length;
    const drafts = props.rows.filter((r) => r.status === "draft").length;
    const now = new Date();
    const in30d = props.rows.filter((r) => {
      if (!r.expiry_date) return false;
      const d = new Date(r.expiry_date);
      const diff = (d.getTime() - now.getTime()) / 86_400_000;
      return diff > 0 && diff <= 30;
    }).length;
    return { total, signed, drafts, in30d };
  }, [props.rows]);

  return (
    <div>
      <div className="stat-grid">
        <Stat icon="ti-file-text" tone="primary" value={String(stats.total)} label="Total contracts" />
        <Stat icon="ti-signature" tone="success" value={String(stats.signed)} label="Signed" />
        <Stat icon="ti-pencil" tone="warning" value={String(stats.drafts)} label="Draft" />
        <Stat icon="ti-calendar-x" tone="danger" value={String(stats.in30d)} label="Expiring in 30d" />
      </div>
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">Search</span>
          <input
            type="text"
            placeholder="Contract #, party, title…"
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.onApply()}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">Status</span>
          <select value={props.filterStatus} onChange={(e) => props.onFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="countersigned">Countersigned</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
        <button className="btn" onClick={props.onApply}>
          <i className="ti ti-filter" />
          Apply
        </button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Contract #</th>
                <th>Type</th>
                <th>Party B</th>
                <th>Template</th>
                <th>Status</th>
                <th>Effective</th>
                <th>Expires</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.loading && props.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    Loading…
                  </td>
                </tr>
              ) : props.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    No contracts.
                  </td>
                </tr>
              ) : (
                props.rows.map((r) => {
                  const tone = CONTRACT_STATUS_TONE[r.status] ?? "badge-gray";
                  const partyB = r.partyB?.name ?? `Company #${r.party_b_company_id}`;
                  return (
                    <tr key={r.id} onClick={() => props.onOpenDrawer(r.id)}>
                      <td className="font-mono">{r.contract_number}</td>
                      <td>
                        <span className="type-badge">{r.type === "platform" ? "Platform" : "Partner"}</span>
                      </td>
                      <td>{partyB}</td>
                      <td className="cell-muted">{r.template?.name ?? "—"}</td>
                      <td>
                        <span className={`badge ${tone}`}>{contractStatusLabel(r.status)}</span>
                      </td>
                      <td className="cell-muted">{fmtDate(r.effective_date)}</td>
                      <td className="cell-muted">{fmtDate(r.expiry_date)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button className="icon-btn" title="View" onClick={() => props.onOpenDrawer(r.id)}>
                            <i className="ti ti-eye" />
                          </button>
                          <button className="icon-btn" title="Download PDF">
                            <i className="ti ti-file-download" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATES pane
// ═══════════════════════════════════════════════════════════════

function TemplatesPane(props: {
  loading: boolean;
  rows: ContractTemplateRow[];
  onOpen: (id: string) => void;
  onToggleActive: (row: ContractTemplateRow) => void;
}) {
  const stats = useMemo(() => {
    const total = props.rows.length;
    const active = props.rows.filter((r) => r.active !== false).length;
    const inactive = total - active;
    const langs = new Set(props.rows.map((r) => r.language)).size;
    return { total, active, inactive, langs };
  }, [props.rows]);
  return (
    <div>
      <div className="stat-grid">
        <Stat icon="ti-template" tone="primary" value={String(stats.total)} label="Templates" />
        <Stat icon="ti-circle-check" tone="success" value={String(stats.active)} label="Active" />
        <Stat icon="ti-pencil" tone="warning" value={String(stats.inactive)} label="Drafts" />
        <Stat icon="ti-language" tone="info" value={String(stats.langs)} label="Languages" />
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Template #</th>
                <th>Name</th>
                <th>Type</th>
                <th>Language</th>
                <th>Version</th>
                <th>Active</th>
                <th>Updated</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.loading && props.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    Loading…
                  </td>
                </tr>
              ) : props.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    No templates.
                  </td>
                </tr>
              ) : (
                props.rows.map((r) => (
                  <tr key={r.id} onClick={() => props.onOpen(r.id)}>
                    <td className="font-mono">{r.id.slice(0, 8).toUpperCase()}</td>
                    <td>
                      <div className="font-semibold">{r.name}</div>
                      <div className="cell-muted text-sm">
                        {r.type} · {r.language.toUpperCase()}
                      </div>
                    </td>
                    <td>
                      <span className="type-badge">{contractTypeLabel(r.type)}</span>
                    </td>
                    <td className="cell-muted">{r.language.toUpperCase()}</td>
                    <td className="font-mono">v{r.version ?? "1"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={r.active !== false}
                          onChange={() => props.onToggleActive(r)}
                        />
                        <span className="switch-slider" />
                      </label>
                    </td>
                    <td className="cell-muted">{fmtDate(r.updated_at ?? r.created_at ?? null)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button className="icon-btn" title="Edit" onClick={() => props.onOpen(r.id)}>
                          <i className="ti ti-edit" />
                        </button>
                        <button
                          className="icon-btn"
                          title="Clone"
                          onClick={() => alert("Clone — opens a new template draft pre-filled from this one (TODO: wire to /new?clone=" + r.id + ").")}
                        >
                          <i className="ti ti-copy" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LOGS pane
// ═══════════════════════════════════════════════════════════════

function LogsPane(props: {
  loading: boolean;
  rows: AuditLogRow[];
  integrity: IntegrityResult | null;
  onVerify: () => void;
  search: string;
  onSearch: (s: string) => void;
  filterCategory: string;
  onFilterCategory: (s: string) => void;
  filterFrom: string;
  onFilterFrom: (s: string) => void;
  filterTo: string;
  onFilterTo: (s: string) => void;
  onApply: () => void;
  onOpenDrawer: (row: AuditLogRow) => void;
}) {
  return (
    <div>
      <div className="alert">
        <i className="ti ti-shield-check" />
        <div style={{ flex: 1 }}>
          <div className="font-semibold">Hash-chained audit trail</div>
          <div className="text-sm">
            Every entry is linked to the previous one. Run a verification to confirm the chain has not been
            tampered with.
            {props.integrity && (
              <> · {props.integrity.is_intact ? "✓ Verified" : `✗ ${props.integrity.corrupted_log_ids.length} tampered`}</>
            )}
          </div>
        </div>
        <button className="btn btn-sm" onClick={props.onVerify}>
          <i className="ti ti-shield-check" />
          Verify integrity
        </button>
      </div>
      <div className="stat-grid">
        <Stat icon="ti-activity" tone="primary" value={String(props.rows.length)} label="Events (current page)" />
        <Stat icon="ti-users" tone="info" value="—" label="Active admins" />
        <Stat icon="ti-alert-triangle" tone="warning" value="—" label="Suspicious" />
        <Stat icon="ti-lock-x" tone="danger" value="—" label="Failed logins" />
      </div>
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">Search</span>
          <input
            type="text"
            placeholder="Actor, action, resource…"
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.onApply()}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">Category</span>
          <select value={props.filterCategory} onChange={(e) => props.onFilterCategory(e.target.value)}>
            <option value="">All categories</option>
            <option value="auth">auth</option>
            <option value="data_change">data_change</option>
            <option value="financial">financial</option>
            <option value="approval">approval</option>
            <option value="contract">contract</option>
            <option value="support">support</option>
            <option value="admin_actions">admin_actions</option>
            <option value="api">api</option>
            <option value="security">security</option>
            <option value="system">system</option>
            <option value="error">error</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">From</span>
          <input type="date" value={props.filterFrom} onChange={(e) => props.onFilterFrom(e.target.value)} />
        </div>
        <div className="filter-field">
          <span className="filter-label">To</span>
          <input type="date" value={props.filterTo} onChange={(e) => props.onFilterTo(e.target.value)} />
        </div>
        <button className="btn" onClick={props.onApply}>
          <i className="ti ti-filter" />
          Apply
        </button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>IP</th>
                <th style={{ textAlign: "right" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {props.loading && props.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    Loading…
                  </td>
                </tr>
              ) : props.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    No events.
                  </td>
                </tr>
              ) : (
                props.rows.map((r) => {
                  const isSystem = !r.actor_id && r.actor_type.toLowerCase().includes("system");
                  const actorName = isSystem ? "System" : r.actor_name_snapshot ?? r.actor_type ?? "Unknown";
                  return (
                    <tr key={r.id} onClick={() => props.onOpenDrawer(r)}>
                      <td className="cell-muted">{fmtDateTime(r.created_at)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className={`avatar sm ${avatarToneFor(r.actor_id ?? r.id)}`}>
                            {isSystem ? "SY" : initialsFor(actorName)}
                          </span>
                          <span>{actorName}</span>
                        </div>
                      </td>
                      <td>
                        <div className="font-semibold">{r.action}</div>
                        <div className="text-sm cell-muted">{r.category}</div>
                      </td>
                      <td className="font-mono">
                        {r.subject_type ? `${shortenSubject(r.subject_type)} ${r.subject_id ?? ""}` : "—"}
                      </td>
                      <td className="font-mono cell-muted">{r.ip_address ?? "—"}</td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                        <button className="icon-btn" onClick={() => props.onOpenDrawer(r)}>
                          <i className="ti ti-chevron-right" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DRAWERS
// ═══════════════════════════════════════════════════════════════

function ApplicationDrawer(props: {
  open: boolean;
  loading: boolean;
  detail: SellerApplicationDetail | null;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onOpenCompany: (id: number) => void;
}) {
  const d = props.detail;
  const canAct = d && (d.status === "pending" || d.status === "under_review");
  return (
    <>
      <div className={`drawer-overlay ${props.open ? "open" : ""}`} onClick={props.onClose} />
      <div className={`drawer ${props.open ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Seller application</div>
            <div className="text-sm text-secondary" style={{ marginTop: 2 }}>
              {d && (
                <>
                  <span className="font-mono">APP-{String(d.id).padStart(4, "0")}</span> ·{" "}
                  {d.service_type ?? "—"}
                </>
              )}
            </div>
          </div>
          <button className="icon-btn" onClick={props.onClose}>
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="drawer-body">
          {props.loading && !d?.company ? (
            <p className="cell-muted">Loading…</p>
          ) : d ? (
            <>
              <div className="drawer-section">Company</div>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className={`avatar ${avatarToneFor(d.company?.id ?? d.company_id)}`}>
                    {initialsFor(d.company?.name ?? d.company_name ?? `#${d.company_id}`)}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="font-semibold">{d.company?.name ?? d.company_name ?? `Company #${d.company_id}`}</div>
                    <div className="text-sm text-secondary">
                      {[d.company?.type, d.company?.country, d.company?.city].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={() => props.onOpenCompany(d.company?.id ?? d.company_id)}
                  >
                    <i className="ti ti-external-link" />
                    Open
                  </button>
                </div>
              </div>
              <div className="drawer-section">Status</div>
              <div className="timeline">
                <div className={`tl-item ${d.applied_at ? "done" : ""}`}>
                  <div className="tl-dot" />
                  <div className="tl-title">Submitted</div>
                  <div className="tl-time">{fmtDateTime(d.applied_at ?? null)}</div>
                </div>
                <div className={`tl-item ${d.reviewed_at ? "done" : "active"}`}>
                  <div className="tl-dot" />
                  <div className="tl-title">Review</div>
                  <div className="tl-time">{d.reviewed_at ? fmtDateTime(d.reviewed_at) : "Awaiting a super-admin decision"}</div>
                </div>
                <div className={`tl-item ${d.status === "rejected" ? "reject" : d.status === "approved" ? "done" : ""}`}>
                  <div className="tl-dot" />
                  <div className="tl-title">Decision</div>
                  <div className="tl-time">{d.status === "approved" ? "Approved" : d.status === "rejected" ? "Rejected" : "—"}</div>
                </div>
              </div>
              <div className="drawer-section">Reviewer</div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">Assigned to</span>
                  <span className="info-value">{d.reviewer?.name ?? "—"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Email</span>
                  <span className="info-value">{d.reviewer?.email ?? "—"}</span>
                </div>
              </div>
              {d.notes && (
                <>
                  <div className="drawer-section">Notes</div>
                  <div className="fld">
                    <textarea defaultValue={d.notes} readOnly />
                  </div>
                </>
              )}
              {d.rejection_reason && (
                <>
                  <div className="drawer-section">Rejection reason</div>
                  <div className="code-block">{d.rejection_reason}</div>
                </>
              )}
            </>
          ) : null}
        </div>
        <div className="drawer-footer">
          {canAct && (
            <>
              <button className="btn btn-primary" onClick={props.onApprove}>
                <i className="ti ti-check" />
                Approve
              </button>
              <button className="btn btn-danger" onClick={props.onReject}>
                <i className="ti ti-x" />
                Reject
              </button>
            </>
          )}
          <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

function ContractDrawer(props: {
  open: boolean;
  loading: boolean;
  detail: ContractDetail | null;
  onClose: () => void;
  onSend: () => void;
  onCountersign: () => void;
  onTerminate: () => void;
  onPdf: () => void;
}) {
  const d = props.detail;
  return (
    <>
      <div className={`drawer-overlay ${props.open ? "open" : ""}`} onClick={props.onClose} />
      <div className={`drawer ${props.open ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{d?.template?.name ?? "Contract"}</div>
            <div className="text-sm text-secondary" style={{ marginTop: 2 }}>
              {d && (
                <>
                  <span className="font-mono">{d.contract_number}</span> ·{" "}
                  <span className={`badge ${CONTRACT_STATUS_TONE[d.status] ?? "badge-gray"}`}>
                    {contractStatusLabel(d.status)}
                  </span>
                </>
              )}
            </div>
          </div>
          <button className="icon-btn" onClick={props.onClose}>
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="drawer-body">
          {props.loading && !d ? (
            <p className="cell-muted">Loading…</p>
          ) : d ? (
            <>
              <div className="drawer-section">Parties</div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">Party A</span>
                  <span className="info-value">{d.partyA?.name ?? "ZULU Platform"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Party B</span>
                  <span className="info-value">{d.partyB?.name ?? `Company #${d.party_b_company_id}`}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Template</span>
                  <span className="info-value">
                    {d.template?.name ?? "—"}
                    {d.template?.version ? ` · v${d.template.version}` : ""}
                  </span>
                </div>
              </div>
              <div className="drawer-section">Schedule</div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">Effective</span>
                  <span className="info-value">{fmtDate(d.effective_date)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Expires</span>
                  <span className="info-value">{fmtDate(d.expiry_date)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Auto-renew</span>
                  <span className="info-value">
                    {d.auto_renew ? "Yes" : "No"}
                    {d.termination_notice_days ? ` · ${d.termination_notice_days}-day notice` : ""}
                  </span>
                </div>
              </div>
              {d.commission_clause && (
                <>
                  <div className="drawer-section">Terms</div>
                  <div className="code-block">{JSON.stringify(d.commission_clause, null, 2)}</div>
                </>
              )}
            </>
          ) : null}
        </div>
        <div className="drawer-footer">
          <button className="btn btn-sm" onClick={props.onSend} disabled={!d || d.status !== "draft"}>
            <i className="ti ti-send" />
            Send
          </button>
          <button
            className="btn btn-sm"
            onClick={props.onCountersign}
            disabled={!d || (d.status !== "signed_by_a" && d.status !== "signed_by_b")}
          >
            <i className="ti ti-signature" />
            Countersign
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={props.onTerminate}
            disabled={!d || d.status === "terminated" || d.status === "expired"}
          >
            <i className="ti ti-ban" />
            Terminate
          </button>
          <button
            className="btn btn-sm"
            style={{ marginLeft: "auto" }}
            onClick={props.onPdf}
            disabled={!d?.signed_pdf_url}
          >
            <i className="ti ti-file-download" />
            PDF
          </button>
        </div>
      </div>
    </>
  );
}

function AuditDrawer(props: { open: boolean; row: AuditLogRow | null; onClose: () => void }) {
  const r = props.row;
  return (
    <>
      <div className={`drawer-overlay ${props.open ? "open" : ""}`} onClick={props.onClose} />
      <div className={`drawer ${props.open ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{r?.action ?? ""}</div>
            <div className="text-sm text-secondary" style={{ marginTop: 2 }}>
              {r?.category}
            </div>
          </div>
          <button className="icon-btn" onClick={props.onClose}>
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="drawer-body">
          {r && (
            <>
              <div className="drawer-section">Entry</div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">Event ID</span>
                  <span className="info-value font-mono">{r.id}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Timestamp</span>
                  <span className="info-value">{fmtDateTime(r.created_at)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Actor</span>
                  <span className="info-value">
                    {r.actor_name_snapshot ?? r.actor_type} {r.actor_id ? `#${r.actor_id}` : ""}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Resource</span>
                  <span className="info-value font-mono">
                    {r.subject_type ? `${shortenSubject(r.subject_type)} ${r.subject_id ?? ""}` : "—"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">IP address</span>
                  <span className="info-value font-mono">{r.ip_address ?? "—"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">User agent</span>
                  <span className="info-value">{r.user_agent ?? "—"}</span>
                </div>
              </div>
              <div className="drawer-section">Hash chain</div>
              <div className="hash-line mb-3">
                <span className="badge badge-success">
                  <i className="ti ti-shield-check" style={{ fontSize: 12 }} />
                  Linked
                </span>
              </div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">Hash</span>
                  <span className="info-value font-mono">{r.hash}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Previous hash</span>
                  <span className="info-value font-mono">{r.previous_log_hash ?? "—"}</span>
                </div>
              </div>
              {(r.before || r.after) && (
                <>
                  <div className="drawer-section">Changes</div>
                  <div className="code-block">{JSON.stringify({ before: r.before, after: r.after }, null, 2)}</div>
                </>
              )}
            </>
          )}
        </div>
        <div className="drawer-footer">
          <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE MODAL
// ═══════════════════════════════════════════════════════════════

function TemplateModal(props: {
  open: boolean;
  saving: boolean;
  target: ContractTemplateDetail | "new" | null;
  onClose: () => void;
  onSave: (form: {
    name: string;
    type: ContractType;
    language: ContractLanguage;
    body: string;
    variables_json: string;
    active: boolean;
  }) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    type: "platform" as ContractType,
    language: "en" as ContractLanguage,
    body: "",
    variables_json: "{}",
    active: true,
  });
  useEffect(() => {
    if (props.target && props.target !== "new" && typeof props.target !== "string") {
      const t = props.target;
      setForm({
        name: t.name,
        type: t.type,
        language: t.language,
        body: t.body ?? "",
        variables_json: JSON.stringify(t.variables ?? {}, null, 2),
        active: t.active !== false,
      });
    } else if (props.target === "new") {
      setForm({ name: "", type: "platform", language: "en", body: "", variables_json: "{}", active: true });
    }
  }, [props.target]);
  return (
    <div className={`modal-overlay ${props.open ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="modal lg">
        <div className="modal-header">
          <div className="modal-title">
            {props.target === "new" ? "New template" : `Contract template${form.name ? ` — ${form.name}` : ""}`}
          </div>
          <button className="icon-btn" onClick={props.onClose}>
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-grid-2">
            <Fld label="Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Fld>
            <Fld label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as ContractType })}
              >
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Fld>
            <Fld label="Language">
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value as ContractLanguage })}
              >
                {CONTRACT_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            </Fld>
            <Fld label="Active">
              <label className="switch-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  <span className="switch-slider" />
                </label>
                <span>{form.active ? "Yes" : "No"}</span>
              </label>
            </Fld>
          </div>
          <div className="fld span-2 mb-4" style={{ marginTop: 14 }}>
            <span className="fld-label">
              Body <span className="fld-hint">· use {`{{placeholder}}`} tokens</span>
            </span>
            <textarea
              style={{ minHeight: 120 }}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>
          <div className="modal-section-label">Variables (JSON)</div>
          <div className="fld">
            <textarea
              style={{ minHeight: 100, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              value={form.variables_json}
              onChange={(e) => setForm({ ...form, variables_json: e.target.value })}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={props.onClose} disabled={props.saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => props.onSave(form)} disabled={props.saving}>
            <i className="ti ti-device-floppy" />
            {props.saving ? "Saving…" : "Save template"}
          </button>
        </div>
      </div>
    </div>
  );
}
