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
import Image from "next/image";
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
  { key: "inbox", href: "/admin-redesign/notifications", label: "Inbox", icon: "ti-inbox" },
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
        archive_filter: "active",
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
            onLogout={() => void logout().then(() => router.push("/login"))}
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
              {(Object.keys(TAB_META) as MgmtTab[]).map((k) => (
                <button
                  key={k}
                  className={`section-tab ${tab === k ? "active" : ""}`}
                  onClick={() => switchTab(k)}
                >
                  <i className={`ti ${TAB_META[k].icon}`} />
                  {TAB_META[k].label}
                </button>
              ))}
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
                      await apiSyncCompanyCountryPermissions(
                        token,
                        detailCompany.id,
                        countries.map((c) => ({ country_code: c.country_code, country_name: c.country_name }))
                      );
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

function Header({
  collapsed: _c,
  onHamburger,
  title,
  user,
  onLogout,
}: {
  collapsed: boolean;
  onHamburger: () => void;
  title: string;
  user: { name?: string | null; email?: string | null; context?: { world?: string } } | null;
  onLogout: () => void;
}) {
  return (
    <header className="header">
      <div className="header-brand">
        <Image
          src="/branding/logo-zulu.svg"
          alt="ZULU"
          width={160}
          height={38}
          className="brand-logo-svg"
          priority
        />
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
        <button className="header-lang">EN</button>
        <button className="header-icon-btn">
          <i className="ti ti-external-link" />
        </button>
        <button className="header-icon-btn">
          <i className="ti ti-moon" />
        </button>
        <button className="header-icon-btn">
          <i className="ti ti-bell" />
          <span className="dot" />
        </button>
        <button className="header-icon-btn">
          <i className="ti ti-grid-dots" />
        </button>
        <div className="header-divider" />
        <div className="header-user" onClick={onLogout} title="Click to logout">
          <span className="user-avatar">{(user?.name ?? "?").slice(0, 1).toUpperCase()}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.name ?? "User"}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{user?.context?.world ?? ""}</div>
          </div>
          <i className="ti ti-chevron-down" style={{ fontSize: 15, color: "var(--text-secondary)" }} />
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
          <button className="btn btn-sm">
            <i className="ti ti-send" />
            Send
          </button>
          <button className="btn btn-sm">
            <i className="ti ti-signature" />
            Countersign
          </button>
          <button className="btn btn-sm btn-danger">
            <i className="ti ti-ban" />
            Terminate
          </button>
          <button className="btn btn-sm" style={{ marginLeft: "auto" }}>
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
