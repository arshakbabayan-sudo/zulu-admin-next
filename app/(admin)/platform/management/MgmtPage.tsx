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
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./management.css";
import { mgmtStrings, type MgmtKey } from "./management-i18n";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ADMIN_NAV_GROUPS,
  type AdminNavGroup,
  findActiveGroup,
  SIDEBAR_TABLER_ICON,
} from "@/lib/admin-nav-config";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";
import {
  canAccessPlatformAdminNav,
  canAccessAgentToolsNav,
  canAccessBookingsSection,
  canAccessChatSection,
  canAccessCrmSection,
  canAccessDashboardSection,
  canAccessFinanceSection,
  canAccessInventoryOversightNav,
  canAccessInventorySection,
  canAccessLocalizationSectionNav,
  canAccessMarketplaceOpsSection,
  canAccessMyCompanySection,
  canSeeOwnCompanyNav,
  canAccessNotificationsNav,
  canAccessOperatorToolsNav,
  canAccessSalesWorkspaceSection,
  canAccessSettingsSection,
  canAccessSuperAdminOnlyPlatformNav,
  userHasModuleAccess,
  userHasPermission,
  userHasSellerServiceType,
} from "@/lib/access";
import type { AdminUser } from "@/lib/auth-types";
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
import { apiCompaniesList, type CompanyListRow } from "@/lib/inventory-crud-api";
import CompanyCommissionTab from "@/components/CompanyCommissionTab";
import { AddEmployeeModal } from "@/components/employees/AddEmployeeModal";
import { EmployeePermissionsDrawer } from "@/components/employees/EmployeePermissionsDrawer";
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
  apiAdminCreateContract,
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

// Tab → i18n keys + Tabler icon. Labels/subtitles resolve through the local
// mgmtStrings() dictionary (see ./management-i18n) so they swap instantly with
// the admin chrome language.
const TAB_META: Record<
  MgmtTab,
  { labelKey: MgmtKey; subtitleKey: MgmtKey; icon: string }
> = {
  companies: { labelKey: "tabCompanies", subtitleKey: "subCompanies", icon: "ti-building-community" },
  applications: { labelKey: "tabApplications", subtitleKey: "subApplications", icon: "ti-user-check" },
  contracts: { labelKey: "tabContracts", subtitleKey: "subContracts", icon: "ti-file-text" },
  templates: { labelKey: "tabTemplates", subtitleKey: "subTemplates", icon: "ti-template" },
  logs: { labelKey: "tabLogs", subtitleKey: "subLogs", icon: "ti-history" },
};

// Enum → dictionary key maps (resolved via mgmtStrings() at render).
const TYPE_KEY: Record<string, MgmtKey> = {
  operator: "typeOperator",
  agency: "typeAgency",
  airline: "typeAirline",
  hotel_chain: "typeHotelChain",
  other: "typeOther",
};
const GOV_KEY: Record<string, MgmtKey> = {
  active: "optActive",
  pending: "optPending",
  suspended: "optSuspended",
  rejected: "optRejected",
};
const APP_STATUS_KEY: Record<string, MgmtKey> = {
  approved: "optApproved",
  pending: "optPending",
  under_review: "optUnderReview",
  rejected: "optRejected",
};
const SVC_KEY: Record<string, MgmtKey> = {
  hotel: "svcHotel",
  flight: "svcFlight",
  transfer: "svcTransfer",
  car: "svcCar",
  excursion: "svcExcursion",
  visa: "svcVisa",
  package: "svcPackage",
};
const CSTATUS_KEY: Record<string, MgmtKey> = {
  draft: "cstatusDraft",
  sent: "cstatusSent",
  signed_by_a: "cstatusSignedByA",
  signed_by_b: "cstatusSignedByB",
  countersigned: "cstatusCountersigned",
  active: "cstatusActive",
  expired: "cstatusExpired",
  terminated: "cstatusTerminated",
  disputed: "cstatusDisputed",
};
const TTYPE_KEY: Record<string, MgmtKey> = {
  platform: "ttypePlatform",
  partner_supplier: "ttypePartnerSupplier",
  partner_reseller: "ttypePartnerReseller",
  partner_default: "ttypePartnerDefault",
};

// Sidebar Tabler-icon map is shared with AdminShell — imported from
// admin-nav-config (SIDEBAR_TABLER_ICON) so both chromes stay in sync.

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

// ── Contract-drawer term formatters (Fix #7) ──────────────────────────────
// The contract Terms objects are free-form JSON the new-contract form writes
// ({type,value} / {collector,t_plus_days} / {notice_days,fee_percent}). These
// render them as a compact human line, falling back to "—" when empty.
type TermObj = Record<string, unknown> | null | undefined;
function fmtCommission(cc: TermObj, s: Record<MgmtKey, string>): string {
  if (!cc || cc.value == null) return "—";
  const v = String(cc.value);
  return cc.type === "percent" ? `${v}% · ${s.cdCommission.toLowerCase()}` : v;
}
function fmtPayment(pt: TermObj, s: Record<MgmtKey, string>): string {
  if (!pt) return "—";
  const collector =
    pt.collector === "operator" || pt.collector === "partner" ? s.cmCollectorOperator : s.cmCollectorPlatform;
  const days = pt.t_plus_days != null ? ` · T+${String(pt.t_plus_days)}` : "";
  return `${collector}${days}`;
}
function fmtCancellation(cp: TermObj, s: Record<MgmtKey, string>): string {
  if (!cp) return "—";
  const parts: string[] = [];
  if (cp.notice_days != null) parts.push(`${String(cp.notice_days)} ${s.cdNoticeDays}`);
  if (cp.fee_percent != null) parts.push(`${String(cp.fee_percent)}%`);
  return parts.length ? parts.join(" · ") : "—";
}
function fmtSignature(sig: TermObj, key: "party_a" | "party_b"): string {
  if (!sig) return "—";
  const entry = sig[key] as Record<string, unknown> | undefined;
  if (!entry) return "—";
  const name = entry.name != null ? String(entry.name) : "";
  const at = entry.signed_at != null ? fmtDateTime(String(entry.signed_at)) : "";
  return [name, at].filter(Boolean).join(" · ") || "—";
}
function fmtRenderedBody(rb: TermObj): string {
  if (!rb) return "";
  if (typeof rb.text === "string") return rb.text;
  if (typeof rb.body === "string") return rb.body;
  try {
    return JSON.stringify(rb, null, 2);
  } catch {
    return "";
  }
}

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
  const { lang, setLang, languageOptions } = useLanguage();
  const s = mgmtStrings(lang);
  const allowed = canAccessPlatformAdminNav(user);

  // ───────────────── Top-level state ─────────────────
  const [tab, setTab] = useState<MgmtTab>(initialTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Unread notification count — single source for the header bell dot AND the
  // Inbox sidebar badge (mirrors AdminShell). Fetched once on mount.
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!token || !canAccessNotificationsNav(user)) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiNotificationsUnreadCount(token);
        if (!cancelled) setUnreadCount(res.data.unread_count ?? 0);
      } catch {
        /* badge is non-critical chrome */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  // New-contract modal (admin v3 — replaces the old /platform/contracts/new page).
  const [newContractOpen, setNewContractOpen] = useState(false);
  // Staff → Permissions drawer (company detail Staff tab).
  const [permDrawerUser, setPermDrawerUser] = useState<PlatformAdminUserRow | null>(null);

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
  // When cloning, the modal opens in "new" mode pre-filled from this source (R2-6).
  const [templateClone, setTemplateClone] = useState<ContractTemplateDetail | null>(null);

  // Section-tab count badges. The HTML mock shows the count next to
  // Companies / Seller applications / Contracts from the very first paint
  // (Templates + Logs have no count). We fetch all three totals once on
  // mount so the numbers are there immediately — not only after the tab is
  // opened. Each tab's own loader keeps its number fresh afterwards.
  const [tabCounts, setTabCounts] = useState<{
    companies?: number;
    applications?: number;
    contracts?: number;
  }>({});

  const baseURL = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am",
    []
  );

  useEffect(() => {
    if (!token || !allowed) return;
    let cancelled = false;
    (async () => {
      try {
        const [c, a, ct] = await Promise.all([
          apiPlatformCompanies(token, { page: 1, per_page: 1, archive_filter: "active" }),
          apiSellerApplications(token, { page: 1, per_page: 1 }),
          apiAdminContracts(token, { page: 1, per_page: 1, status: "", type: "" }),
        ]);
        if (cancelled) return;
        setTabCounts({
          companies: c.meta?.total,
          applications: a.meta?.total,
          contracts: ct.meta?.total,
        });
      } catch {
        /* counts are non-critical chrome */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, allowed]);

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
        // Pin the content language to the detail EN/RU/HY segment so the
        // translatable description comes back in the picked language (2a).
        const res = await apiPlatformCompany(token, detailCompanyId, detailLang.toLowerCase());
        if (!cancelled) setDetailCompany(res.data);
      } catch (e) {
        if (!cancelled) console.error("company detail load failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailCompanyId, token, detailLang]);

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
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }

  async function rejectApp(id: number) {
    if (!token) return;
    const reason = window.prompt(s.promptRejection) ?? "";
    try {
      await apiRejectSellerApplication(token, id, reason);
      setAppDrawer(null);
      void loadApps();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
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
      setTemplateClone(null);
      setTemplateModal(res.data);
    } catch (e) {
      console.error("template detail failed", e);
    }
  }

  // Clone a template — fetch it, then open the modal in "new" mode pre-filled
  // from the source so saving creates a copy (R2-6).
  async function cloneTemplate(id: string) {
    if (!token) return;
    try {
      const res = await apiAdminContractTemplate(token, id);
      setTemplateClone(res.data);
      setTemplateModal("new");
    } catch (e) {
      console.error("template clone load failed", e);
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
    // 2026-06-04 — switch the tab PURELY client-side, exactly like the HTML
    // mock (which just toggles `.page-pane.active` with no navigation). We
    // previously called router.push() here, which triggered a full Next.js
    // navigation on every tab click → re-render + data refetch + scroll/
    // layout jump ("ամբողջ էջը աջ ու ձախ"). history.replaceState updates the
    // address bar (so deep-link / refresh still land on the right tab via
    // initialTab) WITHOUT any navigation, reload, or jump. The tab strip
    // stays put; only the pane below changes.
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", map[next]);
    }
  }

  // ───────────────── Render shell ─────────────────
  const activeMeta = TAB_META[tab];
  const activeLabel = s[activeMeta.labelKey];
  const inCompanyDetail = tab === "companies" && detailCompanyId !== null && detailCompany !== null;

  return (
    <div className="mgmt-page mgmt-page-host">
      <div className={`layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <Sidebar collapsed={sidebarCollapsed} unreadCount={unreadCount} />
        <div className="main">
          <Header
            collapsed={sidebarCollapsed}
            onHamburger={() => setSidebarCollapsed((v) => !v)}
            title={`${s.sectionManagement} · ${inCompanyDetail ? detailCompany.name : activeLabel}`}
            user={user ?? null}
            token={token}
            lang={lang}
            languageOptions={languageOptions}
            onSetLang={setLang}
            unreadCount={unreadCount}
            onLogout={() => void logout().then(() => router.push("/login"))}
            onNavigate={(href) => router.push(href)}
          />
          <div className="page">
            <div className="page-header">
              <div>
                <div className="breadcrumb">
                  <a onClick={() => router.push("/dashboard")}>{s.breadcrumbHome}</a>
                  <i className="ti ti-chevron-right" />
                  <span className="breadcrumb-current">
                    {inCompanyDetail ? detailCompany.name : activeLabel}
                  </span>
                </div>
                <h1 className="page-title">
                  <span>{inCompanyDetail ? detailCompany.name : activeLabel}</span>
                  <span className="super-tag">
                    <i className="ti ti-shield-lock" style={{ fontSize: 13 }} />
                    {s.superAdmin}
                  </span>
                </h1>
                <div className="page-subtitle">
                  {inCompanyDetail ? s.companyDetail : s[activeMeta.subtitleKey]}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {tab === "companies" && !inCompanyDetail && (
                  <button className="btn">
                    <i className="ti ti-download" />
                    {s.actionExport}
                  </button>
                )}
                {tab === "applications" && (
                  <button className="btn">
                    <i className="ti ti-download" />
                    {s.actionExport}
                  </button>
                )}
                {tab === "contracts" && (
                  <button className="btn btn-primary" onClick={() => setNewContractOpen(true)}>
                    <i className="ti ti-plus" />
                    {s.actionNewContract}
                  </button>
                )}
                {tab === "templates" && (
                  <button className="btn btn-primary" onClick={() => setTemplateModal("new")}>
                    <i className="ti ti-plus" />
                    {s.actionNewTemplate}
                  </button>
                )}
              </div>
            </div>

            <div className="section-tabs">
              {(Object.keys(TAB_META) as MgmtTab[]).map((k) => {
                // Counts shown on Companies / Seller applications / Contracts
                // from first paint (mock's `<span class="count">`). Prefer the
                // live total from the open tab; fall back to the mount-time
                // fetch so all three show immediately. Templates + Logs: none.
                let count: number | null = null;
                if (k === "companies") count = companiesMeta?.total ?? tabCounts.companies ?? null;
                else if (k === "applications") count = tabCounts.applications ?? (apps.length || null);
                else if (k === "contracts") count = tabCounts.contracts ?? (contracts.length || null);
                return (
                  <button
                    key={k}
                    className={`section-tab ${tab === k ? "active" : ""}`}
                    onClick={() => switchTab(k)}
                  >
                    <i className={`ti ${TAB_META[k].icon}`} />
                    {s[TAB_META[k].labelKey]}
                    {count !== null ? <span className="count">{count}</span> : null}
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
                  onEditPermissions={(u) => setPermDrawerUser(u)}
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
                      alert(s.okSaved);
                    } catch (e) {
                      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
                    }
                  }}
                  onSaveProfile={async (patch) => {
                    if (!token || !detailCompany) return;
                    try {
                      const res = await apiPatchCompanyProfile(token, detailCompany.id, patch);
                      setDetailCompany(res.data);
                      alert(s.okSaved);
                    } catch (e) {
                      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
                    }
                  }}
                  onSaveGovernance={async (next) => {
                    if (!token || !detailCompany) return;
                    try {
                      await apiPatchCompanyGovernance(token, detailCompany.id, { governance_status: next });
                      const res = await apiPlatformCompany(token, detailCompany.id);
                      setDetailCompany(res.data);
                      alert(s.okSaved);
                    } catch (e) {
                      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
                    }
                  }}
                  onSavePartner={async (visible) => {
                    if (!token || !detailCompany) return;
                    try {
                      await apiPatchCompanyPartnerSettings(token, detailCompany.id, { is_partner_visible: visible });
                      const res = await apiPlatformCompany(token, detailCompany.id);
                      setDetailCompany(res.data);
                      alert(s.okSaved);
                    } catch (e) {
                      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
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
                onClone={(id) => void cloneTemplate(id)}
                onToggleActive={async (row) => {
                  if (!token) return;
                  try {
                    await apiAdminUpdateContractTemplate(token, row.id, { active: row.active === false });
                    await loadTemplates();
                  } catch (e) {
                    alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
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
          if (!confirm(s.confirmSend)) return;
          try {
            const res = await apiAdminSendContract(token, contractDrawer.id);
            setContractDrawer(res.data);
            await loadContracts();
            alert(s.okSent);
          } catch (e) {
            alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
          }
        }}
        onCountersign={async () => {
          if (!token || !contractDrawer) return;
          if (!confirm(s.confirmCountersign)) return;
          try {
            const res = await apiAdminCountersignContract(token, contractDrawer.id);
            setContractDrawer(res.data);
            await loadContracts();
            alert(s.okCountersigned);
          } catch (e) {
            alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
          }
        }}
        onTerminate={async () => {
          if (!token || !contractDrawer) return;
          const reason = window.prompt(s.promptTermination);
          if (!reason || reason.trim().length < 3) {
            if (reason !== null) alert(s.errTerminationShort);
            return;
          }
          try {
            const res = await apiAdminTerminateContract(token, contractDrawer.id, reason);
            setContractDrawer(res.data);
            await loadContracts();
            alert(s.okTerminated);
          } catch (e) {
            alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
          }
        }}
        onPdf={() => {
          if (!contractDrawer?.signed_pdf_url) {
            alert(s.errNoPdf);
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

      {/* Company-detail Staff → per-employee permissions drawer (Ե.2). Reuses
          the existing per-employee override editor (richer than the mock's
          5-switch sketch — keeps the real allow/deny-per-action capability). */}
      {detailCompany && (
        <EmployeePermissionsDrawer
          open={permDrawerUser !== null}
          onClose={() => setPermDrawerUser(null)}
          token={token ?? ""}
          companyId={detailCompany.id}
          userId={permDrawerUser?.id ?? null}
          userName={permDrawerUser?.name}
          onSaved={() => setDetailStaff(null)}
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
        cloneFrom={templateClone}
        onClose={() => {
          setTemplateModal(null);
          setTemplateClone(null);
        }}
        onSave={async (form) => {
          if (!token) return;
          setTemplateModalSaving(true);
          try {
            let variables: Record<string, unknown> = {};
            if (form.variables_json.trim() && form.variables_json.trim() !== "{}") {
              try {
                variables = JSON.parse(form.variables_json) as Record<string, unknown>;
              } catch {
                alert(s.errInvalidJson);
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
            setTemplateClone(null);
            await loadTemplates();
          } catch (e) {
            alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
          } finally {
            setTemplateModalSaving(false);
          }
        }}
      />

      {/* New-contract modal (Fix #6 / Ժ.1) — replaces the old V2-styled
          /platform/contracts/new page; opens in-place over the Management
          chrome exactly like the HTML mock's contractModal. */}
      <NewContractModal
        open={newContractOpen}
        token={token}
        onClose={() => setNewContractOpen(false)}
        onCreated={() => {
          setNewContractOpen(false);
          void loadContracts();
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHELL — sidebar + header
// ═══════════════════════════════════════════════════════════════

// Visibility predicate per group — mirrors AdminShell.tsx exactly so the
// Management chrome shows the same items each role is allowed elsewhere.
function isMgmtGroupVisible(g: AdminNavGroup, user: AdminUser | null): boolean {
  switch (g.visibility) {
    case "always":
      return true;
    case "platform_admin":
      return canAccessPlatformAdminNav(user);
    case "operator_tools":
      return canAccessOperatorToolsNav(user);
    case "inventory_oversight":
      return canAccessInventoryOversightNav(user);
    case "localization":
      return canAccessLocalizationSectionNav(user);
    case "super_admin":
      return canAccessSuperAdminOnlyPlatformNav(user);
    case "bucket3":
      return canAccessPlatformAdminNav(user);
    case "agent_tools":
      return canAccessAgentToolsNav(user);
    case "section_dashboard":
      return canAccessDashboardSection(user);
    case "section_inventory":
      return canAccessInventorySection(user);
    case "section_bookings":
      return canAccessBookingsSection(user);
    case "section_crm":
      return canAccessCrmSection(user);
    case "section_chat":
      return canAccessChatSection(user);
    case "section_sales_workspace":
      return canAccessSalesWorkspaceSection(user);
    case "section_finance":
      return canAccessFinanceSection(user);
    case "section_my_company":
      return canAccessMyCompanySection(user);
    case "section_own_company":
      return canSeeOwnCompanyNav(user);
    case "section_marketplace_ops":
      return canAccessMarketplaceOpsSection(user);
    case "section_settings":
      return canAccessSettingsSection(user);
    default:
      return false;
  }
}

function isMgmtTabVisible(
  tab: {
    superAdminOnly?: boolean;
    perm?: string;
    serviceType?: import("@/lib/auth-types").SellerServiceType;
    moduleKey?: string;
  },
  user: AdminUser | null,
): boolean {
  if (tab.superAdminOnly && !canAccessSuperAdminOnlyPlatformNav(user) && !user?.is_super_admin) return false;
  if (tab.perm && !userHasPermission(user, tab.perm)) return false;
  if (tab.serviceType && !userHasSellerServiceType(user, tab.serviceType)) return false;
  if (tab.moduleKey && !userHasModuleAccess(user, tab.moduleKey)) return false;
  return true;
}

function Sidebar({ collapsed: _c, unreadCount }: { collapsed: boolean; unreadCount: number }) {
  const pathname = usePathname();
  const { user } = useAdminAuth();
  const { t } = useLanguage();

  const visibleGroups = ADMIN_NAV_GROUPS.filter((g) => {
    if (!isMgmtGroupVisible(g, user)) return false;
    if (g.tabs.length === 0) return true;
    return g.tabs.some((tab) => isMgmtTabVisible(tab, user));
  });
  const activeGroup = findActiveGroup(pathname ?? "");

  return (
    <aside className="sidebar">
      {visibleGroups.map((g) => {
        const firstVisibleTab = g.tabs.find((tab) => isMgmtTabVisible(tab, user));
        const href = firstVisibleTab?.href ?? g.defaultHref;
        const active = activeGroup?.key === g.key;
        const rawLabel = t(g.labelKey);
        const label = rawLabel === g.labelKey && g.labelFallback ? g.labelFallback : rawLabel;
        const icon = SIDEBAR_TABLER_ICON[g.key] ?? "ti-point";
        const badgeValue = g.badgeSource === "notifications_unread" ? unreadCount : 0;
        return (
          <Link key={g.key} href={href} className={`sidebar-item ${active ? "active" : ""}`}>
            <i className={`ti ${icon}`} />
            <span>{label}</span>
            {badgeValue > 0 && (
              <span className={`sidebar-badge ${g.badgeKind === "warn" ? "warn" : ""}`}>
                {badgeValue > 99 ? "99+" : badgeValue}
              </span>
            )}
          </Link>
        );
      })}
    </aside>
  );
}

const HEADER_FRONTEND_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FRONTEND_URL) || "https://zulu.am";

// Dominant flag assets (Arshak 2026-06-04) — public/flags/{GB,AM,RU}.png.
// Used for the active-language flag in the header and the language dropdown.
const LANG_FLAG: Record<string, string> = {
  en: "/flags/GB.png",
  hy: "/flags/AM.png",
  ru: "/flags/RU.png",
};

// Header apps-launcher (grid-dots) quick links. Replaces the old behaviour
// where the icon wrongly navigated straight to /dashboard.
const APPS_QUICKLINKS: Array<{ href: string; icon: string; labelKey: MgmtKey }> = [
  { href: "/dashboard", icon: "ti-dashboard", labelKey: "navDashboard" },
  { href: "/platform/companies", icon: "ti-building", labelKey: "tabCompanies" },
  { href: "/platform/bookings", icon: "ti-calendar-event", labelKey: "navBookings" },
  { href: "/platform/finance-summary", icon: "ti-coin", labelKey: "navFinance" },
  { href: "/platform/users", icon: "ti-id-badge-2", labelKey: "navDirectory" },
  { href: "/settings/pricing-rules", icon: "ti-settings", labelKey: "navSettings" },
];

function Header({
  collapsed: _c,
  onHamburger,
  title,
  user,
  token,
  lang,
  languageOptions,
  onSetLang,
  unreadCount,
  onLogout,
  onNavigate,
}: {
  collapsed: boolean;
  onHamburger: () => void;
  title: string;
  user: { name?: string | null; email?: string | null; context?: { world?: string } } | null;
  token: string | null;
  lang: string;
  languageOptions: Array<{ code: string; label: string }>;
  onSetLang: (code: string) => void;
  unreadCount: number;
  onLogout: () => void;
  onNavigate: (href: string) => void;
}) {
  const s = mgmtStrings(lang);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [appsMenuOpen, setAppsMenuOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const appsRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  // Close any open header dropdown on an outside click or Escape (Arshak:
  // the avatar menu wouldn't close when clicking elsewhere).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (langRef.current && !langRef.current.contains(t)) setLangMenuOpen(false);
      if (appsRef.current && !appsRef.current.contains(t)) setAppsMenuOpen(false);
      if (userRef.current && !userRef.current.contains(t)) setUserMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLangMenuOpen(false);
        setAppsMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
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
        {/* ZULU SPIN wordmark — dominant asset public/logo_1.png (Arshak 2026-06-04) */}
        <img className="brand-logo-svg" src="/logo_1.png" alt="ZULU" />
        {/* Collapsed icon-only mark — public/logo_icon.png */}
        <img className="brand-logo-icon" src="/logo_icon.png" alt="ZULU" />
      </div>
      <button className="header-hamburger" onClick={onHamburger} title={s.toggleSidebar}>
        <i className="ti ti-menu-2" />
      </button>
      <div className="header-title">{title}</div>
      <div className="header-search">
        <i className="ti ti-search" />
        <input type="search" placeholder={s.searchPlaceholder} />
      </div>
      <div className="header-actions">
        <div ref={langRef} style={{ position: "relative" }}>
          <button className="header-lang" title={languageOptions.find((o) => o.code === lang)?.label ?? "Language"} onClick={() => setLangMenuOpen((v) => !v)}>
            {/* Active-language flag — dominant assets public/flags/{GB,AM,RU}.png (Arshak 2026-06-04) */}
            <img className="header-lang-flag" src={LANG_FLAG[lang] ?? LANG_FLAG.en} alt="" />
            {(languageOptions.find((o) => o.code === lang)?.code ?? lang).toUpperCase()}
          </button>
          {langMenuOpen && (
            <div className="row-menu open" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 160 }}>
              {languageOptions.map((o) => (
                <button
                  key={o.code}
                  className="menu-item"
                  onClick={() => {
                    onSetLang(o.code);
                    setLangMenuOpen(false);
                  }}
                  style={o.code === lang ? { color: "var(--primary)", fontWeight: 600 } : undefined}
                >
                  {LANG_FLAG[o.code] ? (
                    <img className="header-lang-flag" src={LANG_FLAG[o.code]} alt="" />
                  ) : null}
                  <span style={{ textTransform: "uppercase", fontSize: 11, fontWeight: 600, minWidth: 22 }}>
                    {o.code}
                  </span>
                  <span>{o.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <a
          className="header-icon-btn"
          href={websiteHref}
          target="_blank"
          rel="noopener noreferrer"
          title={s.openWebsite}
        >
          <i className="ti ti-external-link" />
        </a>
        <button
          className="header-icon-btn"
          onClick={toggleTheme}
          title={theme === "dark" ? s.themeLight : s.themeDark}
        >
          <i className={theme === "dark" ? "ti ti-sun" : "ti ti-moon"} />
        </button>
        <button
          className="header-icon-btn"
          onClick={() => onNavigate("/admin-redesign/notifications")}
          title={s.notifications}
        >
          <i className="ti ti-bell" />
          {unreadCount > 0 && <span className="dot" />}
        </button>
        <div ref={appsRef} style={{ position: "relative" }}>
          <button className="header-icon-btn" onClick={() => setAppsMenuOpen((v) => !v)} title={s.apps}>
            <i className="ti ti-grid-dots" />
          </button>
          {appsMenuOpen && (
            <div className="row-menu open" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 190 }}>
              {APPS_QUICKLINKS.map((a) => (
                <button
                  key={a.href}
                  className="menu-item"
                  onClick={() => {
                    onNavigate(a.href);
                    setAppsMenuOpen(false);
                  }}
                >
                  <i className={`ti ${a.icon}`} />
                  <span>{s[a.labelKey]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="header-divider" />
        <div ref={userRef} style={{ position: "relative" }}>
          <div
            className="header-user"
            onClick={() => setUserMenuOpen((v) => !v)}
            title={s.accountMenu}
          >
            <span className="user-avatar">{(user?.name ?? "?").slice(0, 1).toUpperCase()}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.name ?? s.userFallback}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{user?.context?.world || user?.email || ""}</div>
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
                <span>{s.logout}</span>
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
  const { lang } = useLanguage();
  const s = mgmtStrings(lang);
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
        <Stat icon="ti-building-community" tone="primary" value={String(stats.total)} label={s.coStatTotal} />
        <Stat icon="ti-circle-check" tone="success" value={String(stats.active)} label={s.coStatActive} />
        <Stat icon="ti-rosette-discount-check" tone="info" value={String(stats.sellers)} label={s.coStatSellers} />
        <Stat icon="ti-archive" tone="warning" value={String(stats.archived)} label={s.coStatArchived} />
      </div>

      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.filterSearch}</span>
          <input
            type="text"
            placeholder={s.coSearchPh}
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.onApply()}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.filterStatus}</span>
          <select value={props.filterGov} onChange={(e) => props.onFilterGov(e.target.value)}>
            <option value="">{s.optAllStatuses}</option>
            <option value="pending">{s.optPending}</option>
            <option value="active">{s.optActive}</option>
            <option value="suspended">{s.optSuspended}</option>
            <option value="rejected">{s.optRejected}</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.filterType}</span>
          <select value={props.filterType} onChange={(e) => props.onFilterType(e.target.value)}>
            <option value="">{s.optAllTypes}</option>
            <option value="operator">{s.typeOperator}</option>
            <option value="agency">{s.typeAgency}</option>
            <option value="airline">{s.typeAirline}</option>
            <option value="hotel_chain">{s.typeHotelChain}</option>
            <option value="other">{s.typeOther}</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.filterSeller}</span>
          <select value={props.filterSeller} onChange={(e) => props.onFilterSeller(e.target.value)}>
            <option value="">{s.optAll}</option>
            <option value="1">{s.optSellersOnly}</option>
            <option value="0">{s.optNonSellers}</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.filterArchive}</span>
          <select value={props.filterArchive} onChange={(e) => props.onFilterArchive(e.target.value as "active" | "archived" | "all")}>
            <option value="active">{s.optActive}</option>
            <option value="archived">{s.optArchived}</option>
            <option value="all">{s.optAll}</option>
          </select>
        </div>
        <button className="btn" onClick={props.onApply}>
          <i className="ti ti-filter" />
          {s.actionApply}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.coColId}</th>
                <th>{s.coColCompany}</th>
                <th>{s.coColLocation}</th>
                <th>{s.coColStatus}</th>
                <th>{s.coColSeller}</th>
                <th>{s.coColPayments}</th>
                <th>{s.coColCreated}</th>
                <th style={{ textAlign: "right" }}>{s.coColActions}</th>
              </tr>
            </thead>
            <tbody>
              {props.loading && props.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 40 }}>
                    {s.loading}
                  </td>
                </tr>
              ) : props.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 40 }}>
                    {s.coEmpty}
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
                          {r.type && <span className="type-badge">{s[TYPE_KEY[r.type] ?? "typeOther"]}</span>}
                        </div>
                      </td>
                      <td className="cell-muted">
                        {[r.country, r.city].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td>
                        <span className={`badge ${govTone}`}>
                          {s[GOV_KEY[r.governance_status] ?? "optActive"]}
                        </span>
                      </td>
                      <td>
                        {r.is_seller ? (
                          <>
                            <span className="font-semibold">{s.yes}</span>{" "}
                            <span className="cell-muted">· {r.active_seller_permissions_count ?? 0}</span>
                          </>
                        ) : (
                          <span className="cell-muted">{s.no}</span>
                        )}
                      </td>
                      <td>
                        {payState === "ready" ? (
                          <span className="badge badge-success">
                            <i className="ti ti-circle-check" style={{ fontSize: 12 }} />
                            {s.payReady}
                          </span>
                        ) : payState === "incomplete" ? (
                          <span className="badge badge-warning">
                            <i className="ti ti-clock" style={{ fontSize: 12 }} />
                            {s.payOnboarding}
                          </span>
                        ) : (
                          <span className="badge badge-gray">{s.payNotConnected}</span>
                        )}
                      </td>
                      <td className="cell-muted">{fmtDate(r.created_at)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button className="btn btn-sm" onClick={() => props.onOpen(r.id)}>
                            <i className="ti ti-eye" />
                            {s.actionView}
                          </button>
                          <button
                            className="icon-btn"
                            title={s.actionMore}
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onOpen(r.id);
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
              {s.showing} {(props.meta.current_page - 1) * props.meta.per_page + 1}–
              {Math.min(props.meta.current_page * props.meta.per_page, props.meta.total)} {s.of}{" "}
              {props.meta.total} {s.coUnit}
            </div>
            <div className="pagination-controls">
              <button
                className="btn btn-sm"
                disabled={props.page <= 1}
                onClick={() => props.onPage(props.page - 1)}
              >
                <i className="ti ti-chevron-left" />
              </button>
              {pageWindow(props.meta.current_page, props.meta.last_page).map((p) => (
                <button
                  key={p}
                  className={`btn btn-sm ${p === props.meta!.current_page ? "btn-primary" : ""}`}
                  onClick={() => props.onPage(p)}
                >
                  {p}
                </button>
              ))}
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

// Compact page-number window around the current page (mirrors the mock's
// 1 / 2 / 3 strip). Shows up to 3 numbers centred on current, clamped to
// [1, lastPage].
function pageWindow(current: number, lastPage: number): number[] {
  const start = Math.max(1, Math.min(current - 1, lastPage - 2));
  const end = Math.min(lastPage, start + 2);
  const out: number[] = [];
  for (let p = start; p <= end; p++) out.push(p);
  return out;
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
  onEditPermissions: (u: PlatformAdminUserRow) => void;
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
  // props.lang is the CONTENT field language segment (EN/RU/HY for the
  // translatable description); the chrome language comes from useLanguage().
  const { lang: chromeLang } = useLanguage();
  const s = mgmtStrings(chromeLang);
  const router = useRouter();
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
          {s.loading}
        </div>
      </div>
    );
  }

  const govTone = GOVERNANCE_TONE[c.governance_status] ?? "badge-gray";

  return (
    <div>
      <button className="btn btn-sm btn-ghost detail-back" onClick={props.onBack}>
        <i className="ti ti-arrow-left" />
        {s.actionBackToCompanies}
      </button>

      <div className="detail-head">
        <div className="detail-logo">{initialsFor(c.name)}</div>
        <div>
          <div className="detail-title">
            <span>{c.name}</span>
            {c.type && <span className="type-badge">{s[TYPE_KEY[c.type] ?? "typeOther"]}</span>}
            <span className={`badge ${govTone}`}>
              {s[GOV_KEY[c.governance_status] ?? "optActive"]}
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
            title={s.actionMore}
            onClick={() => props.onSubTab("profile")}
          >
            <i className="ti ti-dots-vertical" />
          </button>
        </div>
      </div>

      <div className="sub-tabs">
        {(
          [
            ["profile", s.dTabProfile],
            ["staff", s.dTabStaff],
            ["apps", s.dTabApps],
            ["perms", s.dTabPerms],
            ["commission", s.dTabCommission],
            ["payments", s.dTabPayments],
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
                  <div className="card-title">{s.dIdentityTitle}</div>
                  <div className="card-subtitle">{s.dIdentitySub}</div>
                </div>
              </div>
              <div className="card-body">
                <div className="form-grid">
                  <Fld label={s.fldName}>
                    <input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </Fld>
                  <Fld label={s.fldLegalName}>
                    <input
                      value={draft.legal_name ?? ""}
                      onChange={(e) => setDraft({ ...draft, legal_name: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label={s.fldType}>
                    <select
                      value={draft.type ?? ""}
                      onChange={(e) => setDraft({ ...draft, type: e.target.value || null })}
                    >
                      <option value="">—</option>
                      <option value="operator">{s.typeOperator}</option>
                      <option value="agency">{s.typeAgency}</option>
                      <option value="airline">{s.typeAirline}</option>
                      <option value="hotel_chain">{s.typeHotelChain}</option>
                      <option value="other">{s.typeOther}</option>
                    </select>
                  </Fld>
                  <Fld label={s.fldTaxId}>
                    <input
                      value={draft.tax_id ?? ""}
                      onChange={(e) => setDraft({ ...draft, tax_id: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label={s.fldCountry}>
                    <input
                      value={draft.country ?? ""}
                      onChange={(e) => setDraft({ ...draft, country: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label={s.fldCity}>
                    <input
                      value={draft.city ?? ""}
                      onChange={(e) => setDraft({ ...draft, city: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label={s.fldAddress} span2>
                    <input
                      value={draft.address ?? ""}
                      onChange={(e) => setDraft({ ...draft, address: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label={s.fldPhone}>
                    <input
                      value={draft.phone ?? ""}
                      onChange={(e) => setDraft({ ...draft, phone: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label={s.fldWebsite}>
                    <input
                      value={draft.website ?? ""}
                      onChange={(e) => setDraft({ ...draft, website: e.target.value || null })}
                    />
                  </Fld>
                  <Fld label={`${s.fldDescription} · ${s.translatable} (${props.lang})`} span2>
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
                  {s.actionSaveProfile}
                </button>
              </div>
            </div>
          </div>
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">{s.dBrandingTitle}</div>
                </div>
              </div>
              <div className="card-body">
                <div className="logo-upload mb-4">
                  <div className="logo-box">{initialsFor(c.name)}</div>
                  <div>
                    <button className="btn btn-sm" onClick={props.onOpenLogo}>
                      <i className="ti ti-upload" />
                      {s.actionUploadLogo}
                    </button>
                    <div className="fld-hint" style={{ marginTop: 6 }}>
                      {s.dLogoHint}
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
                  <span>{s.dPartnersToggle}</span>
                </div>
              </div>
              <div className="card-foot">
                <button className="btn btn-primary" onClick={() => void props.onSavePartner(partnerToggle)}>
                  <i className="ti ti-device-floppy" />
                  {s.actionSaveBranding}
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">{s.dGovernanceTitle}</div>
                </div>
              </div>
              <div className="card-body">
                <div className="fld mb-4">
                  <span className="fld-label">{s.dGovernanceStatus}</span>
                  <select value={draftGov} onChange={(e) => setDraftGov(e.target.value)}>
                    <option value="pending">{s.optPending}</option>
                    <option value="active">{s.optActive}</option>
                    <option value="suspended">{s.optSuspended}</option>
                    <option value="rejected">{s.optRejected}</option>
                  </select>
                </div>
                <div className="info-grid">
                  <div className="info-row">
                    <span className="info-label">{s.dProfileCompleted}</span>
                    <span className="info-value">
                      <span className="ro-badge">
                        <i
                          className={c.profile_completed ? "ti ti-circle-check" : "ti ti-clock"}
                          style={{ color: c.profile_completed ? "var(--success)" : "var(--warning)" }}
                        />
                        {c.profile_completed ? s.dComplete : s.dIncomplete}
                      </span>
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{s.dCreated}</span>
                    <span className="info-value">{fmtDate(c.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="card-foot">
                <button className="btn btn-primary" onClick={() => void props.onSaveGovernance(draftGov)}>
                  <i className="ti ti-device-floppy" />
                  {s.actionSaveGovernance}
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
              <div className="card-title">{s.stTitle}</div>
              <div className="card-subtitle">{s.stSubtitle}</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={props.onAddEmployee}>
              <i className="ti ti-plus" />
              {s.actionAddEmployee}
            </button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{s.stColName}</th>
                  <th>{s.stColEmail}</th>
                  <th>{s.stColRole}</th>
                  <th>{s.stColStatus}</th>
                  <th>{s.stColLastLogin}</th>
                  <th style={{ textAlign: "right" }}>{s.stColActions}</th>
                </tr>
              </thead>
              <tbody>
                {props.staff === null ? (
                  <tr>
                    <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                      {s.loading}
                    </td>
                  </tr>
                ) : props.staff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                      {s.stEmpty}
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
                          {u.status === "active" ? s.optActive : (u.status ?? "—")}
                        </span>
                      </td>
                      <td className="cell-muted">{fmtDateTime(u.last_login_at ?? u.updated_at ?? null)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button className="btn btn-sm" onClick={() => props.onEditPermissions(u)}>
                            <i className="ti ti-key" />
                            {s.actionPermissions}
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
          {s.apNotePrefix} <span className="font-mono">company_id</span> {s.apNoteSuffix}
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{s.apColAppId}</th>
                  <th>{s.apColType}</th>
                  <th>{s.apColStatus}</th>
                  <th>{s.apColSubmitted}</th>
                  <th>{s.apColReviewed}</th>
                  <th style={{ textAlign: "right" }}>{s.apColActions}</th>
                </tr>
              </thead>
              <tbody>
                {props.apps === null ? (
                  <tr>
                    <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                      {s.loading}
                    </td>
                  </tr>
                ) : props.apps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                      {s.apEmpty}
                    </td>
                  </tr>
                ) : (
                  props.apps.map((a) => {
                    const tone = (APP_STATUS_TONE[a.status] ?? "badge-gray") as string;
                    return (
                      <tr key={a.id}>
                        <td className="font-mono">APP-{String(a.id).padStart(4, "0")}</td>
                        <td>{s.apTypeRegistration}</td>
                        <td>
                          <span className={`badge ${tone}`}>
                            {s[APP_STATUS_KEY[a.status] ?? "optPending"]}
                          </span>
                        </td>
                        <td className="cell-muted">{fmtDate(a.submitted_at ?? null)}</td>
                        <td className="cell-muted">{fmtDate(a.reviewed_at ?? null)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="row-actions">
                            <button
                              className="icon-btn"
                              title={s.actionView}
                              onClick={() => router.push(`/platform/company-applications/${a.id}`)}
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
              <p className="cell-muted">{s.commissionSignIn}</p>
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
                <div className="pb-title">{s.payReadyTitle}</div>
                <div className="pb-sub">{s.payReadySub}</div>
              </div>
            </div>
          ) : (
            <div className="pay-banner incomplete">
              <i className="ti ti-clock" />
              <div>
                <div className="pb-title">{s.payPendingTitle}</div>
                <div className="pb-sub">{s.payPendingSub}</div>
              </div>
            </div>
          )
        ) : (
          <div className="pay-banner none">
            <i className="ti ti-circle-dashed" />
            <div>
              <div className="pb-title">{s.payNoneTitle}</div>
              <div className="pb-sub">{s.payNoneSub}</div>
            </div>
          </div>
        )}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <div className="card-title">{s.payConnectTitle}</div>
              <div className="card-subtitle">{s.payConnectSub}</div>
            </div>
          </div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-row">
                <span className="info-label">{s.payConnectedAccount}</span>
                <span className="info-value font-mono">{c.stripe_connect_id ?? "—"}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{s.payChargesEnabled}</span>
                <span className="info-value">
                  <PayBadge value={c.stripe_charges_enabled ?? null} />
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">{s.payPayoutsEnabled}</span>
                <span className="info-value">
                  <PayBadge value={c.stripe_payouts_enabled ?? null} />
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">{s.payDetailsSubmitted}</span>
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
  const { lang } = useLanguage();
  const s = mgmtStrings(lang);
  const [draftServices, setDraftServices] = useState<Record<string, boolean>>({});
  const [draftCountries, setDraftCountries] = useState<Record<string, { code: string; name: string }>>({});
  const [allCountries, setAllCountries] = useState<Array<{ code: string; name: string }>>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  // Country-picker modal (replaces the old window.prompt — R2-5).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

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
        <div className="card-body cell-muted">{s.loading}</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">{s.permTitle}</div>
          <div className="card-subtitle">{s.permSubtitle}</div>
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
                  <div className="ps-name">{s[SVC_KEY[svc] ?? "svcHotel"]}</div>
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
                  <span className="mchip on" title={s.permHomeCountry}>
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
                      title={s.permRemoveCountry}
                    >
                      {c.name}
                      <i className="ti ti-x" style={{ fontSize: 12 }} />
                    </span>
                  ))}
                <span
                  className="mchip"
                  onClick={() => {
                    void loadAllCountries();
                    setPickerSearch("");
                    setPickerOpen(true);
                  }}
                >
                  <i className="ti ti-plus" style={{ fontSize: 12 }} />
                  {s.actionAdd}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Country picker modal — R2-5 (replaces the browser prompt). Searchable
          list, click to toggle; a check marks already-granted countries. */}
      <div
        className={`modal-overlay ${pickerOpen ? "open" : ""}`}
        onClick={(e) => e.target === e.currentTarget && setPickerOpen(false)}
      >
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title">{s.pickCountryTitle}</div>
            <button className="icon-btn" onClick={() => setPickerOpen(false)}>
              <i className="ti ti-x" />
            </button>
          </div>
          <div className="modal-body" style={{ paddingTop: 14 }}>
            <div className="fld" style={{ marginBottom: 12 }}>
              <input
                type="text"
                placeholder={s.pickCountrySearch}
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {adding ? (
                <div className="cell-muted" style={{ padding: 12 }}>{s.loading}</div>
              ) : (
                (() => {
                  const home = (props.homeCountry ?? "").toLowerCase();
                  const q = pickerSearch.trim().toLowerCase();
                  const list = allCountries
                    .filter((c) => c.name.toLowerCase() !== home)
                    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
                  if (list.length === 0) {
                    return <div className="cell-muted" style={{ padding: 12 }}>{s.errCountryNotFound}</div>;
                  }
                  return list.map((c) => {
                    const selected = !!draftCountries[c.code];
                    return (
                      <button
                        key={c.code}
                        className="menu-item"
                        style={selected ? { color: "var(--primary)", fontWeight: 600 } : undefined}
                        onClick={() =>
                          setDraftCountries((p) => {
                            const n = { ...p };
                            if (n[c.code]) delete n[c.code];
                            else n[c.code] = { code: c.code, name: c.name };
                            return n;
                          })
                        }
                      >
                        <i
                          className={selected ? "ti ti-square-check" : "ti ti-square"}
                          style={{ fontSize: 16, color: selected ? "var(--primary)" : "var(--text-tertiary)" }}
                        />
                        <span style={{ flex: 1, textAlign: "left" }}>{c.name}</span>
                        <span className="font-mono cell-muted" style={{ fontSize: 11 }}>{c.code}</span>
                      </button>
                    );
                  });
                })()
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={() => setPickerOpen(false)}>
              {s.actionClose}
            </button>
          </div>
        </div>
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
          {saving ? s.saving : s.actionSavePermissions}
        </button>
      </div>
    </div>
  );
}

function PayBadge({ value }: { value: boolean | null }) {
  const { lang } = useLanguage();
  const s = mgmtStrings(lang);
  if (value == null) {
    return <span className="ro-badge cell-muted">—</span>;
  }
  return (
    <span className="ro-badge">
      <i
        className={value ? "ti ti-circle-check" : "ti ti-circle-x"}
        style={{ color: value ? "var(--success)" : "var(--danger)" }}
      />
      {value ? s.yes : s.no}
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
  const { lang } = useLanguage();
  const s = mgmtStrings(lang);
  const stats = useMemo(() => {
    const pending = props.rows.filter((r) => r.status === "pending" || r.status === "under_review").length;
    const approved = props.rows.filter((r) => r.status === "approved").length;
    const rejected = props.rows.filter((r) => r.status === "rejected").length;
    return { pending, approved, rejected };
  }, [props.rows]);
  return (
    <div>
      <div className="stat-grid">
        <Stat icon="ti-clock-hour-4" tone="warning" value={String(stats.pending)} label={s.apStatPending} />
        <Stat icon="ti-circle-check" tone="success" value={String(stats.approved)} label={s.apStatApproved} />
        <Stat icon="ti-circle-x" tone="danger" value={String(stats.rejected)} label={s.apStatRejected} />
        <Stat icon="ti-hourglass" tone="info" value="—" label={s.apStatAvgTime} />
      </div>
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.filterSearch}</span>
          <input
            type="text"
            placeholder={s.apSearchPh}
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.onApply()}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.filterStatus}</span>
          <select value={props.filterStatus} onChange={(e) => props.onFilterStatus(e.target.value)}>
            <option value="">{s.optAllStatuses}</option>
            <option value="pending">{s.optPending}</option>
            <option value="approved">{s.optApproved}</option>
            <option value="rejected">{s.optRejected}</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.filterServiceType}</span>
          <select value={props.filterService} onChange={(e) => props.onFilterService(e.target.value)}>
            <option value="">{s.optAllServices}</option>
            <option value="hotel">{s.svcHotel}</option>
            <option value="flight">{s.svcFlight}</option>
            <option value="package">{s.svcPackage}</option>
            <option value="transfer">{s.svcTransfer}</option>
            <option value="excursion">{s.svcExcursion}</option>
          </select>
        </div>
        <button className="btn" onClick={props.onApply}>
          <i className="ti ti-filter" />
          {s.actionApply}
        </button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.apColAppId}</th>
                <th>{s.apColCompany}</th>
                <th>{s.apColServiceType}</th>
                <th>{s.apColApplied}</th>
                <th>{s.apColStatus}</th>
                <th style={{ textAlign: "right" }}>{s.apColActions}</th>
              </tr>
            </thead>
            <tbody>
              {props.loading && props.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    {s.loading}
                  </td>
                </tr>
              ) : props.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    {s.apEmpty}
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
                        <td>{s[SVC_KEY[r.service_type] ?? "svcHotel"]}</td>
                        <td className="cell-muted">{fmtDate(r.applied_at ?? null)}</td>
                        <td>
                          <span className={`badge ${tone}`}>
                            {s[APP_STATUS_KEY[r.status] ?? "optPending"]}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="row-actions">
                            {canAct ? (
                              <>
                                <button className="btn btn-sm btn-primary" onClick={() => props.onApprove(r.id)}>
                                  <i className="ti ti-check" />
                                  {s.actionApprove}
                                </button>
                                <button className="btn btn-sm" onClick={() => props.onReject(r.id)}>
                                  <i className="ti ti-x" />
                                  {s.actionReject}
                                </button>
                              </>
                            ) : null}
                            <button
                              className="icon-btn"
                              title={s.actionViewCompany}
                              onClick={() => props.onOpenCompany(r.company_id)}
                            >
                              <i className="ti ti-building" />
                            </button>
                            <button
                              className="icon-btn"
                              title={s.actionViewApplication}
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
  const { lang } = useLanguage();
  const s = mgmtStrings(lang);
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
        <Stat icon="ti-file-text" tone="primary" value={String(stats.total)} label={s.ctStatTotal} />
        <Stat icon="ti-signature" tone="success" value={String(stats.signed)} label={s.ctStatSigned} />
        <Stat icon="ti-pencil" tone="warning" value={String(stats.drafts)} label={s.ctStatDraft} />
        <Stat icon="ti-calendar-x" tone="danger" value={String(stats.in30d)} label={s.ctStatExpiring} />
      </div>
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.filterSearch}</span>
          <input
            type="text"
            placeholder={s.ctSearchPh}
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.onApply()}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.filterStatus}</span>
          <select value={props.filterStatus} onChange={(e) => props.onFilterStatus(e.target.value)}>
            <option value="">{s.optAllStatuses}</option>
            <option value="draft">{s.cstatusOptDraft}</option>
            <option value="sent">{s.cstatusOptSent}</option>
            <option value="countersigned">{s.cstatusOptCountersigned}</option>
            <option value="active">{s.cstatusOptActive}</option>
            <option value="expired">{s.cstatusOptExpired}</option>
            <option value="terminated">{s.cstatusOptTerminated}</option>
          </select>
        </div>
        <button className="btn" onClick={props.onApply}>
          <i className="ti ti-filter" />
          {s.actionApply}
        </button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.ctColNumber}</th>
                <th>{s.ctColType}</th>
                <th>{s.ctColPartyB}</th>
                <th>{s.ctColTemplate}</th>
                <th>{s.ctColStatus}</th>
                <th>{s.ctColEffective}</th>
                <th>{s.ctColExpires}</th>
                <th style={{ textAlign: "right" }}>{s.ctColActions}</th>
              </tr>
            </thead>
            <tbody>
              {props.loading && props.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    {s.loading}
                  </td>
                </tr>
              ) : props.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    {s.ctEmpty}
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
                        <span className="type-badge">{s[r.type === "platform" ? "ctypePlatform" : "ctypePartner"]}</span>
                      </td>
                      <td>{partyB}</td>
                      <td className="cell-muted">{r.template?.name ?? "—"}</td>
                      <td>
                        <span className={`badge ${tone}`}>{s[CSTATUS_KEY[r.status] ?? "cstatusDraft"]}</span>
                      </td>
                      <td className="cell-muted">{fmtDate(r.effective_date)}</td>
                      <td className="cell-muted">{fmtDate(r.expiry_date)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button className="icon-btn" title={s.actionView} onClick={() => props.onOpenDrawer(r.id)}>
                            <i className="ti ti-eye" />
                          </button>
                          <button className="icon-btn" title={s.actionDownloadPdf}>
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
  onClone: (id: string) => void;
  onToggleActive: (row: ContractTemplateRow) => void;
}) {
  const { lang } = useLanguage();
  const s = mgmtStrings(lang);
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
        <Stat icon="ti-template" tone="primary" value={String(stats.total)} label={s.tplStatTotal} />
        <Stat icon="ti-circle-check" tone="success" value={String(stats.active)} label={s.tplStatActive} />
        <Stat icon="ti-pencil" tone="warning" value={String(stats.inactive)} label={s.tplStatDrafts} />
        <Stat icon="ti-language" tone="info" value={String(stats.langs)} label={s.tplStatLangs} />
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.tplColNumber}</th>
                <th>{s.tplColName}</th>
                <th>{s.tplColType}</th>
                <th>{s.tplColLanguage}</th>
                <th>{s.tplColVersion}</th>
                <th>{s.tplColActive}</th>
                <th>{s.tplColUpdated}</th>
                <th style={{ textAlign: "right" }}>{s.tplColActions}</th>
              </tr>
            </thead>
            <tbody>
              {props.loading && props.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    {s.loading}
                  </td>
                </tr>
              ) : props.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    {s.tplEmpty}
                  </td>
                </tr>
              ) : (
                props.rows.map((r) => (
                  <tr key={r.id} onClick={() => props.onOpen(r.id)}>
                    <td className="font-mono">TPL-{r.id.slice(0, 6).toUpperCase()}</td>
                    <td>
                      <div className="font-semibold">{r.name}</div>
                      <div className="cell-muted text-sm">
                        {r.type} · {r.language.toUpperCase()}
                      </div>
                    </td>
                    <td>
                      <span className="type-badge">{s[TTYPE_KEY[r.type] ?? "ttypePlatform"]}</span>
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
                        <button className="icon-btn" title={s.actionEdit} onClick={() => props.onOpen(r.id)}>
                          <i className="ti ti-edit" />
                        </button>
                        <button
                          className="icon-btn"
                          title={s.actionClone}
                          onClick={() => props.onClone(r.id)}
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
  const { lang } = useLanguage();
  const s = mgmtStrings(lang);
  // Stat cards computed from the loaded page (honest, current-page scoped) —
  // replaces the three hardcoded "—" placeholders (Թ.2/Թ.3).
  const logStats = useMemo(() => {
    const admins = new Set(props.rows.filter((r) => r.actor_id != null).map((r) => r.actor_id)).size;
    const suspicious = props.rows.filter(
      (r) => r.category === "security" || r.action.toLowerCase().includes("suspicious")
    ).length;
    const failed = props.rows.filter(
      (r) => r.action.toLowerCase().includes("login") && r.action.toLowerCase().includes("fail")
    ).length;
    return { admins, suspicious, failed };
  }, [props.rows]);
  return (
    <div>
      <div className="alert">
        <i className="ti ti-shield-check" />
        <div style={{ flex: 1 }}>
          <div className="font-semibold">{s.logAlertTitle}</div>
          <div className="text-sm">
            {s.logAlertBody}
            {props.integrity && (
              <> · {props.integrity.is_intact ? `✓ ${s.logVerified}` : `✗ ${props.integrity.corrupted_log_ids.length} ${s.logTampered}`}</>
            )}
          </div>
        </div>
        <button className="btn btn-sm" onClick={props.onVerify}>
          <i className="ti ti-shield-check" />
          {s.actionVerifyIntegrity}
        </button>
      </div>
      <div className="stat-grid">
        <Stat icon="ti-activity" tone="primary" value={String(props.rows.length)} label={s.logStatEvents} />
        <Stat icon="ti-users" tone="info" value={String(logStats.admins)} label={s.logStatAdmins} />
        <Stat icon="ti-alert-triangle" tone="warning" value={String(logStats.suspicious)} label={s.logStatSuspicious} />
        <Stat icon="ti-lock-x" tone="danger" value={String(logStats.failed)} label={s.logStatFailed} />
      </div>
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.filterSearch}</span>
          <input
            type="text"
            placeholder={s.logSearchPh}
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.onApply()}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.filterCategory}</span>
          <select value={props.filterCategory} onChange={(e) => props.onFilterCategory(e.target.value)}>
            <option value="">{s.optAllCategories}</option>
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
          <span className="filter-label">{s.filterFrom}</span>
          <input type="date" value={props.filterFrom} onChange={(e) => props.onFilterFrom(e.target.value)} />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.filterTo}</span>
          <input type="date" value={props.filterTo} onChange={(e) => props.onFilterTo(e.target.value)} />
        </div>
        <button className="btn" onClick={props.onApply}>
          <i className="ti ti-filter" />
          {s.actionApply}
        </button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.logColWhen}</th>
                <th>{s.logColActor}</th>
                <th>{s.logColAction}</th>
                <th>{s.logColResource}</th>
                <th>{s.logColIp}</th>
                <th style={{ textAlign: "right" }}>{s.logColDetails}</th>
              </tr>
            </thead>
            <tbody>
              {props.loading && props.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    {s.loading}
                  </td>
                </tr>
              ) : props.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>
                    {s.logEmpty}
                  </td>
                </tr>
              ) : (
                props.rows.map((r) => {
                  const isSystem = !r.actor_id && r.actor_type.toLowerCase().includes("system");
                  const actorName = isSystem ? s.logSystem : r.actor_name_snapshot ?? r.actor_type ?? s.logUnknown;
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
  const { lang } = useLanguage();
  const s = mgmtStrings(lang);
  const d = props.detail;
  const canAct = d && (d.status === "pending" || d.status === "under_review");
  return (
    <>
      <div className={`drawer-overlay ${props.open ? "open" : ""}`} onClick={props.onClose} />
      <div className={`drawer ${props.open ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{s.adTitle}</div>
            <div className="text-sm text-secondary" style={{ marginTop: 2 }}>
              {d && (
                <>
                  <span className="font-mono">APP-{String(d.id).padStart(4, "0")}</span> ·{" "}
                  {d.service_type ? s[SVC_KEY[d.service_type] ?? "svcHotel"] : "—"}
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
            <p className="cell-muted">{s.loading}</p>
          ) : d ? (
            <>
              <div className="drawer-section">{s.adCompany}</div>
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
                    {s.actionOpen}
                  </button>
                </div>
              </div>
              <div className="drawer-section">{s.adStatus}</div>
              <div className="timeline">
                <div className={`tl-item ${d.applied_at ? "done" : ""}`}>
                  <div className="tl-dot" />
                  <div className="tl-title">{s.adTlSubmitted}</div>
                  <div className="tl-time">{fmtDateTime(d.applied_at ?? null)}</div>
                </div>
                <div className={`tl-item ${d.reviewed_at ? "done" : "active"}`}>
                  <div className="tl-dot" />
                  <div className="tl-title">{s.adTlReview}</div>
                  <div className="tl-time">{d.reviewed_at ? fmtDateTime(d.reviewed_at) : s.adTlAwaiting}</div>
                </div>
                <div className={`tl-item ${d.status === "rejected" ? "reject" : d.status === "approved" ? "done" : ""}`}>
                  <div className="tl-dot" />
                  <div className="tl-title">{s.adTlDecision}</div>
                  <div className="tl-time">{d.status === "approved" ? s.optApproved : d.status === "rejected" ? s.optRejected : "—"}</div>
                </div>
              </div>
              <div className="drawer-section">{s.adReviewer}</div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">{s.adAssigned}</span>
                  <span className="info-value">{d.reviewer?.name ?? "—"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.adEmail}</span>
                  <span className="info-value">{d.reviewer?.email ?? "—"}</span>
                </div>
              </div>
              {d.notes && (
                <>
                  <div className="drawer-section">{s.adNotes}</div>
                  <div className="fld">
                    <textarea defaultValue={d.notes} readOnly />
                  </div>
                </>
              )}
              {d.rejection_reason && (
                <>
                  <div className="drawer-section">{s.adRejection}</div>
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
                {s.actionApprove}
              </button>
              <button className="btn btn-danger" onClick={props.onReject}>
                <i className="ti ti-x" />
                {s.actionReject}
              </button>
            </>
          )}
          <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={props.onClose}>
            {s.actionClose}
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
  const { lang } = useLanguage();
  const s = mgmtStrings(lang);
  const d = props.detail;
  return (
    <>
      <div className={`drawer-overlay ${props.open ? "open" : ""}`} onClick={props.onClose} />
      <div className={`drawer ${props.open ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{d?.template?.name ?? s.cdTitle}</div>
            <div className="text-sm text-secondary" style={{ marginTop: 2 }}>
              {d && (
                <>
                  <span className="font-mono">{d.contract_number}</span> ·{" "}
                  <span className={`badge ${CONTRACT_STATUS_TONE[d.status] ?? "badge-gray"}`}>
                    {s[CSTATUS_KEY[d.status] ?? "cstatusDraft"]}
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
            <p className="cell-muted">{s.loading}</p>
          ) : d ? (
            <>
              <div className="drawer-section">{s.cdParties}</div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">{s.cdPartyA}</span>
                  <span className="info-value">{d.partyA?.name ?? "ZULU Platform"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.cdPartyB}</span>
                  <span className="info-value">{d.partyB?.name ?? `Company #${d.party_b_company_id}`}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.cdTemplate}</span>
                  <span className="info-value">
                    {d.template?.name ?? "—"}
                    {d.template?.version ? ` · v${d.template.version}` : ""}
                  </span>
                </div>
              </div>

              {/* Terms — structured (Fix #7). Reads the commission / payment /
                  cancellation objects the new-contract form writes. */}
              {(d.commission_clause || d.payment_terms || d.cancellation_policy) && (
                <>
                  <div className="drawer-section">{s.cdTerms}</div>
                  <div className="info-grid">
                    <div className="info-row">
                      <span className="info-label">{s.cdCommission}</span>
                      <span className="info-value">{fmtCommission(d.commission_clause, s)}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">{s.cdPaymentTerms}</span>
                      <span className="info-value">{fmtPayment(d.payment_terms, s)}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">{s.cdCancellation}</span>
                      <span className="info-value">{fmtCancellation(d.cancellation_policy, s)}</span>
                    </div>
                  </div>
                </>
              )}

              <div className="drawer-section">{s.cdSchedule}</div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">{s.cdEffective}</span>
                  <span className="info-value">{fmtDate(d.effective_date)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.cdExpires}</span>
                  <span className="info-value">{fmtDate(d.expiry_date)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.cdAutoRenew}</span>
                  <span className="info-value">
                    {d.auto_renew ? s.yes : s.no}
                    {d.termination_notice_days ? ` · ${d.termination_notice_days}-${s.cdNoticeDays}` : ""}
                  </span>
                </div>
              </div>

              {/* Signatures (Fix #7) */}
              {d.signatures && Object.keys(d.signatures).length > 0 && (
                <>
                  <div className="drawer-section">{s.cdSignatures}</div>
                  <div className="info-grid">
                    <div className="info-row">
                      <span className="info-label">{s.cdPartyA}</span>
                      <span className="info-value">{fmtSignature(d.signatures, "party_a")}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">{s.cdPartyB}</span>
                      <span className="info-value">{fmtSignature(d.signatures, "party_b")}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Rendered body (Fix #7) */}
              {d.rendered_body && (
                <>
                  <div className="drawer-section">{s.cdBody}</div>
                  <div className="code-block">{fmtRenderedBody(d.rendered_body) || s.cdNoBody}</div>
                </>
              )}

              {/* Version history (Fix #7) */}
              {d.versions && d.versions.length > 0 && (
                <>
                  <div className="drawer-section">{s.cdVersions}</div>
                  <div className="info-grid">
                    {d.versions.map((v, i) => (
                      <div className="info-row" key={v.id}>
                        <span className="info-label">v{v.version_number}</span>
                        <span className="info-value">
                          {i === 0 ? s.cdCurrent : s.cdSuperseded}
                          {v.created_at ? ` · ${fmtDate(v.created_at)}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
        <div className="drawer-footer">
          <button className="btn btn-sm" onClick={props.onSend} disabled={!d || d.status !== "draft"}>
            <i className="ti ti-send" />
            {s.actionSend}
          </button>
          <button
            className="btn btn-sm"
            onClick={props.onCountersign}
            disabled={!d || (d.status !== "signed_by_a" && d.status !== "signed_by_b")}
          >
            <i className="ti ti-signature" />
            {s.actionCountersign}
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={props.onTerminate}
            disabled={!d || d.status === "terminated" || d.status === "expired"}
          >
            <i className="ti ti-ban" />
            {s.actionTerminate}
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
  const { lang } = useLanguage();
  const s = mgmtStrings(lang);
  const router = useRouter();
  const r = props.row;
  const resourceHref = r ? auditResourceHref(r.subject_type, r.subject_id) : null;
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
              <div className="drawer-section">{s.auEntry}</div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">{s.auEventId}</span>
                  <span className="info-value font-mono">{r.id}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.auTimestamp}</span>
                  <span className="info-value">{fmtDateTime(r.created_at)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.auActor}</span>
                  <span className="info-value">
                    {r.actor_name_snapshot ?? r.actor_type} {r.actor_id ? `#${r.actor_id}` : ""}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.auResource}</span>
                  <span className="info-value font-mono">
                    {r.subject_type ? `${shortenSubject(r.subject_type)} ${r.subject_id ?? ""}` : "—"}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.auIp}</span>
                  <span className="info-value font-mono">{r.ip_address ?? "—"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.auUserAgent}</span>
                  <span className="info-value">{r.user_agent ?? "—"}</span>
                </div>
              </div>
              <div className="drawer-section">{s.auHashChain}</div>
              <div className="hash-line mb-3">
                <span className="badge badge-success">
                  <i className="ti ti-shield-check" style={{ fontSize: 12 }} />
                  {s.auVerified}
                </span>
              </div>
              <div className="info-grid">
                <div className="info-row">
                  <span className="info-label">{s.auHash}</span>
                  <span className="info-value font-mono">{r.hash}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{s.auPrevHash}</span>
                  <span className="info-value font-mono">{r.previous_log_hash ?? "—"}</span>
                </div>
              </div>
              {(r.before || r.after) && (
                <>
                  <div className="drawer-section">{s.auChanges}</div>
                  <div className="code-block">{JSON.stringify({ before: r.before, after: r.after }, null, 2)}</div>
                </>
              )}
            </>
          )}
        </div>
        <div className="drawer-footer">
          {resourceHref && (
            <button className="btn btn-sm" onClick={() => router.push(resourceHref)}>
              <i className="ti ti-external-link" />
              {s.actionOpenResource}
            </button>
          )}
          <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={props.onClose}>
            {s.actionClose}
          </button>
        </div>
      </div>
    </>
  );
}

// Map an audit subject (e.g. "App\Models\Company" + id) to an admin route so
// the AuditDrawer "Open resource" button (Թ.10) can deep-link. Returns null
// when the subject type has no admin page.
function auditResourceHref(subjectType: string | null | undefined, subjectId: number | null | undefined): string | null {
  if (!subjectType || subjectId == null) return null;
  const name = shortenSubject(subjectType);
  const map: Record<string, string> = {
    company: `/platform/companies/${subjectId}`,
    booking: `/platform/bookings/${subjectId}`,
    user: `/platform/users/${subjectId}`,
    contract: `/platform/contracts/${subjectId}`,
  };
  return map[name] ?? null;
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE MODAL
// ═══════════════════════════════════════════════════════════════

function TemplateModal(props: {
  open: boolean;
  saving: boolean;
  target: ContractTemplateDetail | "new" | null;
  /** When opening in "new" mode to CLONE, pre-fill the form from this source (R2-6). */
  cloneFrom?: ContractTemplateDetail | null;
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
  const { lang } = useLanguage();
  const s = mgmtStrings(lang);
  const [form, setForm] = useState({
    name: "",
    type: "platform" as ContractType,
    language: "en" as ContractLanguage,
    body: "",
    active: true,
  });
  // Fix #8 — variables are edited as key/value rows (kv-editor) instead of a
  // raw JSON textarea. Serialized back to a JSON object on save.
  const [kvRows, setKvRows] = useState<Array<{ key: string; value: string }>>([]);
  useEffect(() => {
    const fillFrom = (t: ContractTemplateDetail, copy: boolean) => {
      setForm({
        name: copy ? `${t.name} (copy)` : t.name,
        type: t.type,
        language: t.language,
        body: t.body ?? "",
        active: t.active !== false,
      });
      const vars = (t.variables ?? {}) as Record<string, unknown>;
      setKvRows(Object.entries(vars).map(([key, value]) => ({ key, value: String(value ?? "") })));
    };
    if (props.target && props.target !== "new" && typeof props.target !== "string") {
      fillFrom(props.target, false);
    } else if (props.target === "new") {
      if (props.cloneFrom) {
        fillFrom(props.cloneFrom, true);
      } else {
        setForm({ name: "", type: "platform", language: "en", body: "", active: true });
        setKvRows([]);
      }
    }
  }, [props.target, props.cloneFrom]);

  function handleSave() {
    const obj: Record<string, string> = {};
    for (const row of kvRows) {
      const k = row.key.trim();
      if (k) obj[k] = row.value;
    }
    props.onSave({ ...form, variables_json: JSON.stringify(obj) });
  }

  return (
    <div className={`modal-overlay ${props.open ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="modal lg">
        <div className="modal-header">
          <div className="modal-title">
            {props.target === "new" ? s.tmNew : `${s.tmEdit}${form.name ? ` — ${form.name}` : ""}`}
          </div>
          <button className="icon-btn" onClick={props.onClose}>
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-grid-2">
            <Fld label={s.tmName}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Fld>
            <Fld label={s.tmType}>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as ContractType })}
              >
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {s[TTYPE_KEY[t] ?? "ttypePlatform"]}
                  </option>
                ))}
              </select>
            </Fld>
            <Fld label={s.tmLanguage}>
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
            <Fld label={s.tmActive}>
              <label className="switch-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  <span className="switch-slider" />
                </label>
                <span>{form.active ? s.yes : s.no}</span>
              </label>
            </Fld>
          </div>
          <div className="fld span-2 mb-4" style={{ marginTop: 14 }}>
            <span className="fld-label">
              {s.tmBody} <span className="fld-hint">· {s.tmBodyHint}</span>
            </span>
            <textarea
              style={{ minHeight: 120 }}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>
          <div className="modal-section-label">{s.tmVariables}</div>
          <div className="kv-editor">
            {kvRows.map((row, i) => (
              <div className="kv-row" key={i}>
                <input
                  className="kv-key"
                  placeholder={s.tmVarKey}
                  value={row.key}
                  onChange={(e) =>
                    setKvRows((rows) => rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))
                  }
                />
                <input
                  placeholder={s.tmVarValue}
                  value={row.value}
                  onChange={(e) =>
                    setKvRows((rows) => rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                  }
                />
                <button
                  className="icon-btn danger"
                  onClick={() => setKvRows((rows) => rows.filter((_, j) => j !== i))}
                >
                  <i className="ti ti-trash" />
                </button>
              </div>
            ))}
          </div>
          <button
            className="btn btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => setKvRows((rows) => [...rows, { key: "", value: "" }])}
          >
            <i className="ti ti-plus" />
            {s.tmAddVariable}
          </button>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={props.onClose} disabled={props.saving}>
            {s.actionCancel}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={props.saving}>
            <i className="ti ti-device-floppy" />
            {props.saving ? s.saving : s.actionSaveTemplate}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NEW CONTRACT MODAL (Fix #6 / Ժ.1)
// ═══════════════════════════════════════════════════════════════

function NewContractModal(props: {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { lang } = useLanguage();
  const s = mgmtStrings(lang);
  const [templates, setTemplates] = useState<ContractTemplateRow[]>([]);
  const [companies, setCompanies] = useState<CompanyListRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    template_id: "",
    party_b_company_id: "",
    language: "en" as ContractLanguage,
    commission_type: "percent" as "percent" | "amount",
    commission_value: "",
    payment_collector: "platform" as "platform" | "operator",
    payment_days: "30",
    cancellation_notice_days: "30",
    cancellation_fee_percent: "",
    effective_date: "",
    expiry_date: "",
    auto_renew: false,
    termination_notice_days: "30",
    variables_json: "{}",
  });

  useEffect(() => {
    if (!props.open || !props.token) return;
    const token = props.token;
    let cancelled = false;
    void (async () => {
      try {
        const [tpl, co] = await Promise.all([
          apiAdminContractTemplates(token, { per_page: 100 }),
          apiCompaniesList(token),
        ]);
        if (cancelled) return;
        setTemplates(tpl.data);
        setCompanies(co.data);
      } catch {
        /* options are best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open, props.token]);

  const selectedTemplate = templates.find((t) => t.id === form.template_id);
  const isPlatformType = selectedTemplate?.type === "platform";

  async function handleCreate() {
    if (!props.token) return;
    if (!form.template_id) {
      alert(s.cmErrTemplate);
      return;
    }
    if (!form.party_b_company_id) {
      alert(s.cmErrPartyB);
      return;
    }
    let variables: Record<string, unknown> = {};
    if (form.variables_json.trim() && form.variables_json.trim() !== "{}") {
      try {
        variables = JSON.parse(form.variables_json) as Record<string, unknown>;
      } catch {
        alert(s.errInvalidJson);
        return;
      }
    }
    const commissionNumeric = form.commission_value.trim() === "" ? null : Number(form.commission_value);
    const paymentDaysNumeric = form.payment_days.trim() === "" ? null : Number(form.payment_days);
    const cancelDaysNumeric =
      form.cancellation_notice_days.trim() === "" ? null : Number(form.cancellation_notice_days);
    const cancelFeeNumeric =
      form.cancellation_fee_percent.trim() === "" ? null : Number(form.cancellation_fee_percent);
    const commission: Record<string, unknown> =
      commissionNumeric === null ? {} : { type: form.commission_type, value: commissionNumeric };
    const payment: Record<string, unknown> =
      paymentDaysNumeric === null
        ? { collector: form.payment_collector }
        : { collector: form.payment_collector, t_plus_days: paymentDaysNumeric };
    const cancellation: Record<string, unknown> = {};
    if (cancelDaysNumeric !== null) cancellation.notice_days = cancelDaysNumeric;
    if (cancelFeeNumeric !== null) cancellation.fee_percent = cancelFeeNumeric;

    setSaving(true);
    try {
      await apiAdminCreateContract(props.token, {
        template_id: form.template_id,
        party_a_company_id: isPlatformType ? null : null,
        party_b_company_id: Number(form.party_b_company_id),
        language: form.language,
        effective_date: form.effective_date || null,
        expiry_date: form.expiry_date || null,
        auto_renew: form.auto_renew,
        termination_notice_days: form.termination_notice_days ? Number(form.termination_notice_days) : undefined,
        variables,
        commission_clause: commission,
        payment_terms: payment,
        cancellation_policy: cancellation,
      });
      props.onCreated();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`modal-overlay ${props.open ? "open" : ""}`}
      onClick={(e) => e.target === e.currentTarget && props.onClose()}
    >
      <div className="modal lg">
        <div className="modal-header">
          <div className="modal-title">{s.cmTitle}</div>
          <button className="icon-btn" onClick={props.onClose}>
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-section-label">{s.cmPartiesTemplate}</div>
          <div className="form-grid-2">
            <Fld label={s.cmTemplate}>
              <select
                value={form.template_id}
                onChange={(e) => setForm({ ...form, template_id: e.target.value })}
              >
                <option value="">{s.cmPickTemplate}</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.language.toUpperCase()})
                  </option>
                ))}
              </select>
            </Fld>
            <Fld label={s.cmLanguage}>
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
            <Fld label={s.cmPartyB}>
              <select
                value={form.party_b_company_id}
                onChange={(e) => setForm({ ...form, party_b_company_id: e.target.value })}
              >
                <option value="">{s.cmPickCompany}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Fld>
            <Fld label={s.cmPartyA}>
              <input value="ZULU Platform" disabled style={{ opacity: 0.7 }} />
            </Fld>
          </div>

          <div className="modal-section-label">{s.cmTerms}</div>
          <div className="form-grid-2">
            <Fld label={s.cmCommissionType}>
              <select
                value={form.commission_type}
                onChange={(e) => setForm({ ...form, commission_type: e.target.value as "percent" | "amount" })}
              >
                <option value="percent">{s.cmPercent}</option>
                <option value="amount">{s.cmAmount}</option>
              </select>
            </Fld>
            <Fld label={s.cmCommission}>
              <input
                type="number"
                placeholder={s.cmCommissionPh}
                value={form.commission_value}
                onChange={(e) => setForm({ ...form, commission_value: e.target.value })}
              />
            </Fld>
            <Fld label={s.cmPaymentCollector}>
              <select
                value={form.payment_collector}
                onChange={(e) => setForm({ ...form, payment_collector: e.target.value as "platform" | "operator" })}
              >
                <option value="platform">{s.cmCollectorPlatform}</option>
                <option value="operator">{s.cmCollectorOperator}</option>
              </select>
            </Fld>
            <Fld label={s.cmPaymentDays}>
              <input
                type="number"
                value={form.payment_days}
                onChange={(e) => setForm({ ...form, payment_days: e.target.value })}
              />
            </Fld>
            <Fld label={s.cmCancellationNotice}>
              <input
                type="number"
                value={form.cancellation_notice_days}
                onChange={(e) => setForm({ ...form, cancellation_notice_days: e.target.value })}
              />
            </Fld>
            <Fld label={s.cmCancellationFee}>
              <input
                type="number"
                value={form.cancellation_fee_percent}
                onChange={(e) => setForm({ ...form, cancellation_fee_percent: e.target.value })}
              />
            </Fld>
          </div>

          <div className="modal-section-label">{s.cmSchedule}</div>
          <div className="form-grid-2">
            <Fld label={s.cmEffectiveDate}>
              <input
                type="date"
                value={form.effective_date}
                onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
              />
            </Fld>
            <Fld label={s.cmExpiryDate}>
              <input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
              />
            </Fld>
          </div>
          <div className="flex items-center gap-3" style={{ marginTop: 4 }}>
            <div className="switch-row">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={form.auto_renew}
                  onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })}
                />
                <span className="switch-slider" />
              </label>
              <span>{s.cmAutoRenew}</span>
            </div>
            <Fld label={s.cmTerminationNotice}>
              <input
                type="number"
                value={form.termination_notice_days}
                onChange={(e) => setForm({ ...form, termination_notice_days: e.target.value })}
              />
            </Fld>
          </div>

          <details style={{ marginTop: 14 }} open={showAdvanced}>
            <summary
              className="fld-label"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.preventDefault();
                setShowAdvanced((v) => !v);
              }}
            >
              {s.cmAdvanced}
            </summary>
            <div className="fld" style={{ marginTop: 8 }}>
              <textarea
                style={{ minHeight: 80, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
                value={form.variables_json}
                onChange={(e) => setForm({ ...form, variables_json: e.target.value })}
              />
            </div>
          </details>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={props.onClose} disabled={saving}>
            {s.actionCancel}
          </button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            <i className="ti ti-plus" />
            {saving ? s.saving : s.actionCreateContract}
          </button>
        </div>
      </div>
    </div>
  );
}
