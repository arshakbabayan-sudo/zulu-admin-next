"use client";

/**
 * admin v3 — unified CRM surface. Port of docs/admin_designe/7-crm/4_crm.html:
 * a two-level (cluster → page) navigation over the 12 CRM tabs, rendered in the
 * same self-contained chrome as Management/Settings (sidebar + header reused
 * from MgmtPage).
 *
 * Incremental migration (mirrors SettingsPage): a page is either rendered IN-PAGE
 * (new unified design, wired to the real backend) or, until migrated, its pill
 * NAVIGATES to the existing working route.
 *
 * In-page so far (2026-06-07): Pipeline · Deals · Activities · Customers · Team ·
 * Options (all wired to the real CrmController endpoints). Leads + Segments went
 * live 2026-06-12 (LeadsSegmentsPanes.tsx → /platform-admin/crm/leads +
 * /crm/segments). Contracts / Work hours / Payroll / Files still navigate out to
 * their own routes until ported.
 *
 * Every user-facing string is routed through crm-i18n.ts (crmStrings(lang)).
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "../platform/management/management.css";
import { Sidebar, Header } from "../platform/management/MgmtPage";
import { useMgmtMobileNav } from "@/lib/use-mgmt-mobile-nav";
import { crmStrings, type CrmKey } from "./crm-i18n";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessNotificationsNav, canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";
import {
  apiAdminContracts,
  apiAdminContract,
  apiSellerContracts,
  apiSellerContract,
  apiAdminSendContract,
  apiAdminCountersignContract,
  apiAdminTerminateContract,
  apiSellerSignContract,
  apiAdminCreateContract,
  apiAdminContractTemplates,
  CONTRACT_LANGUAGES,
  type ContractRow,
  type ContractDetail,
  type ContractStatus,
  type ContractTemplateRow,
  type ContractLanguage,
} from "@/lib/contracts-api";
import { apiCompaniesList, type CompanyListRow } from "@/lib/inventory-crud-api";
import {
  apiFilesList,
  apiFilesUpload,
  apiFilesDownload,
  apiFilesObjectUrl,
  apiFilesCreateFolder,
  apiFilesDelete,
  apiFilesDeleteFolder,
  apiFilesStorageStats,
  formatBytes,
  isPreviewableImage,
  mimeBucket,
  type FileAssetRow,
  type FolderSummary,
  type StorageStats,
} from "@/lib/file-assets-api";
import {
  apiCrmDeals,
  apiCreateCrmDeal,
  apiUpdateCrmDeal,
  apiDeleteCrmDeal,
  apiCrmActivities,
  apiCreateCrmActivity,
  apiUpdateCrmActivity,
  apiCrmStats,
  apiCrmTeam,
  apiCrmTeamMemberStats,
  apiSetCrmCompensation,
  apiCrmSettings,
  apiUpdateCrmSettings,
  CRM_ACTIVITY_TYPES,
  type CrmDeal,
  type CrmDealStage,
  type CrmActivity,
  type CrmActivityType,
  type CrmStats,
  type CrmTeamRow,
  type CrmTeamMemberStats,
  type CrmCompModel,
} from "@/lib/crm-api";
import { apiCrmCustomers, apiCrmCustomersStats, type CustomerRow, type CrmCustomersStats } from "@/lib/customers-api";
import { apiShowPlatformUser, type PlatformAdminUserDetail } from "@/lib/platform-admin-api";
import { apiBookings, type BookingRow } from "@/lib/bookings-api";
import { AddEmployeeModal } from "@/components/employees/AddEmployeeModal";
import {
  apiDeactivateEmployee,
  apiReactivateEmployee,
  apiRemoveEmployee,
  apiUpdateEmployeeRole,
  apiGetEmployeePermissions,
  apiSyncEmployeePermissions,
  apiSetEmployeeTwoFactorPolicy,
  type CompanyEmployeeRole,
  type EmployeePermissionRow,
} from "@/lib/employees-api";
import { AccountPane, MyCompanyPane, MyAgentsPane } from "./MyProfilePanes";
import { ConnectionsPane } from "../settings/SettingsPage";
import { SocialInboxPane } from "./SocialInboxPane";
import { MiniBars } from "./MiniBars";
import { LeadsPane, SegmentsPane } from "./LeadsSegmentsPanes";

// ── helpers ────────────────────────────────────────────────────────
function money(amount: number | null | undefined, currency: string): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function fmtDate(input: string | null | undefined): string {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB"); // dd/mm/yyyy, matches the mock
}

function fmtDateTime(input: string | null | undefined): string {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function initials(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const AVATAR_TONES = ["", "avatar-teal", "avatar-amber", "avatar-blue"] as const;
function avatarTone(key: string | number | null | undefined): string {
  if (key == null) return "";
  const sKey = String(key);
  let hash = 0;
  for (let i = 0; i < sKey.length; i++) hash = (hash * 31 + sKey.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

const STAGE_BADGE: Record<CrmDealStage, string> = {
  new: "badge-info",
  qualified: "badge-primary",
  proposal: "badge-warning",
  negotiation: "badge-warning",
  won: "badge-success",
  lost: "badge-gray",
};

const STATUS_BADGE: Record<string, string> = {
  active: "badge-success",
  inactive: "badge-gray",
  pending: "badge-warning",
  suspended: "badge-danger",
};

const CONTRACT_STATUS_BADGE: Record<ContractStatus, string> = {
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
const CONTRACT_STATUS_KEY: Record<ContractStatus, CrmKey> = {
  draft: "ctStatusDraft",
  sent: "ctStatusSent",
  signed_by_a: "ctStatusSignedA",
  signed_by_b: "ctStatusSignedB",
  countersigned: "ctStatusCountersigned",
  active: "ctStatusActive",
  expired: "ctStatusExpired",
  terminated: "ctStatusTerminated",
  disputed: "ctStatusDisputed",
};

const BOOKING_BADGE: Record<string, string> = {
  paid: "badge-success",
  confirmed: "badge-info",
  completed: "badge-success",
  pending: "badge-warning",
  pending_payment: "badge-warning",
  cancelled: "badge-danger",
  canceled: "badge-danger",
  refunded: "badge-gray",
};

type ClusterKey = "sales" | "people" | "work" | "myprofile" | "options";
export type CrmPageKey =
  | "pipeline" | "leads" | "messages" | "deals" | "activities" | "segments"
  | "customers" | "team"
  | "contracts" | "workhours" | "payroll" | "files" | "connections"
  | "account" | "mycompany" | "myteam" | "myagents"
  | "options";

type CrmMeta = {
  cluster: ClusterKey;
  labelKey: CrmKey;
  subKey: CrmKey;
  inPage: boolean;
  href: string;
};

const CLUSTERS: Array<{ key: ClusterKey; labelKey: CrmKey; icon: string }> = [
  { key: "sales", labelKey: "clSales", icon: "ti-businessplan" },
  { key: "people", labelKey: "clPeople", icon: "ti-users" },
  { key: "work", labelKey: "clWork", icon: "ti-briefcase" },
  { key: "myprofile", labelKey: "clMyProfile", icon: "ti-user-circle" },
  { key: "options", labelKey: "clOptions", icon: "ti-adjustments" },
];

export function CrmPage({ initialPage = "pipeline" }: { initialPage?: CrmPageKey }) {
  const router = useRouter();
  const { token, user, logout } = useAdminAuth();
  const { lang, setLang, languageOptions } = useLanguage();
  const s = crmStrings(lang);

  // Contracts is role-routed (Option A): super → all companies; operator/agent → own.
  const contractsHref = useMemo(() => {
    if (user?.is_super_admin || canAccessPlatformAdminNav(user)) return "/platform/contracts";
    if (user?.roles?.includes("agent")) return "/agent/contracts";
    return "/operator/contracts";
  }, [user]);

  const PAGES: Record<CrmPageKey, CrmMeta> = useMemo(() => ({
    pipeline:   { cluster: "sales",   labelKey: "pgPipeline",   subKey: "subPipeline",   inPage: true,  href: "/crm/pipeline" },
    leads:      { cluster: "sales",   labelKey: "pgLeads",      subKey: "subLeads",      inPage: true,  href: "/crm/leads" },
    messages:   { cluster: "sales",   labelKey: "pgMessages",   subKey: "subMessages",   inPage: true,  href: "/crm/messages" },
    deals:      { cluster: "sales",   labelKey: "pgDeals",      subKey: "subDeals",      inPage: true,  href: "/crm/deals" },
    activities: { cluster: "sales",   labelKey: "pgActivities", subKey: "subActivities", inPage: true,  href: "/crm/activities" },
    segments:   { cluster: "sales",   labelKey: "pgSegments",   subKey: "subSegments",   inPage: true,  href: "/crm/segments" },
    customers:  { cluster: "people",  labelKey: "pgCustomers",  subKey: "subCustomers",  inPage: true,  href: "/crm/customers" },
    team:       { cluster: "people",  labelKey: "pgTeam",       subKey: "subTeam",       inPage: true,  href: "/crm/team" },
    contracts:  { cluster: "work",    labelKey: "pgContracts",  subKey: "subContracts",  inPage: true,  href: contractsHref },
    workhours:  { cluster: "work",    labelKey: "pgWorkhours",  subKey: "subWorkhours",  inPage: true,  href: "/bucket3/non-service-hours" },
    payroll:    { cluster: "work",    labelKey: "pgPayroll",    subKey: "subPayroll",    inPage: true,  href: "/bucket3/payroll" },
    files:      { cluster: "work",    labelKey: "pgFiles",      subKey: "subFiles",      inPage: true,  href: "/admin-redesign/files" },
    // 2026-06-13 redesign — Connections relocated from Settings → CRM Work.
    // 2026-07-01 — now rendered IN-PAGE (inPage:true) so clicking the pill no
    // longer navigates out to the SettingsPage chrome (which made the page swap
    // chrome and jump). The pane is imported from SettingsPage and reused as-is.
    connections:{ cluster: "work",    labelKey: "pgConnections",subKey: "subConnections",inPage: true,  href: "/connections" },
    account:    { cluster: "myprofile", labelKey: "pgAccount",   subKey: "subAccount",    inPage: true,  href: "/crm/account" },
    mycompany:  { cluster: "myprofile", labelKey: "pgMyCompany", subKey: "subMyCompany",  inPage: true,  href: "/crm/my-company" },
    myteam:     { cluster: "myprofile", labelKey: "pgMyTeam",    subKey: "subMyTeam",     inPage: true,  href: "/crm/my-team" },
    myagents:   { cluster: "myprofile", labelKey: "pgMyAgents",  subKey: "subMyAgents",   inPage: true,  href: "/crm/my-agents" },
    options:    { cluster: "options", labelKey: "pgOptions",    subKey: "subOptions",    inPage: true,  href: "/crm/options" },
  }), [contractsHref]);
  // NOTE: options.inPage stays false in PAGES only as a fallback href; the pane
  // IS rendered in-page below. The route /crm/options renders <CrmPage> too.

  const PAGES_BY_CLUSTER = useMemo(() => {
    const m: Record<ClusterKey, CrmPageKey[]> = { sales: [], people: [], work: [], myprofile: [], options: [] };
    (Object.keys(PAGES) as CrmPageKey[]).forEach((k) => m[PAGES[k].cluster].push(k));
    return m;
  }, [PAGES]);

  const [page, setPage] = useState<CrmPageKey>(initialPage);
  const { sidebarCollapsed, onHamburger, closeNav, layoutClass } = useMgmtMobileNav();
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionNode, setActionNode] = useState<ReactNode>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string }>>([]);

  const showToast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  useEffect(() => { setPage(initialPage); }, [initialPage]);
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
    return () => { cancelled = true; };
  }, [token, user]);

  const meta = PAGES[page];
  const activeCluster = meta.cluster;
  const isSuper = !!(user?.is_super_admin || canAccessPlatformAdminNav(user));

  // My profile cluster — pill scoping (menu-level UX; the backend enforces the
  // real data access). Account = everyone. My company / My team = company
  // owners (company_admin OR agent), not super. My agents = operator owner only
  // (company_admin / operator_admin, NOT pure agents), not super.
  const isAgentOwner = !!user?.roles?.includes("agent");
  const isCompanyOwner =
    !!user?.roles?.includes("company_admin") || isAgentOwner;
  const isOperatorOwner = !isAgentOwner && !!user?.roles?.includes("company_admin");
  const visibleMyProfilePages = useMemo<CrmPageKey[]>(() => {
    const pages: CrmPageKey[] = ["account"];
    // Super (platform owner) sees ALL 4 pills — consistent with super seeing
    // everything else in the panel, and so the whole section is reviewable.
    if (isSuper) {
      pages.push("mycompany", "myteam", "myagents");
      return pages;
    }
    if (isCompanyOwner) {
      pages.push("mycompany", "myteam");
    }
    // Operator owner manages its agents; an agent owner has no sub-agents.
    if (isOperatorOwner) {
      pages.push("myagents");
    }
    return pages;
  }, [isSuper, isCompanyOwner, isOperatorOwner]);

  // In-page → swap pane + sync URL; otherwise navigate to the existing route.
  const showPage = useCallback(
    (key: CrmPageKey) => {
      // Clicking the ALREADY-active pill is a no-op. Otherwise we'd clear the
      // action-slot button (setActionNode(null)) but the pane wouldn't remount
      // (same page) so it never re-registers its button → it vanished. (Arshak
      // 2026-06-10: "+New contract" disappeared on clicking the active sub-tab.)
      if (key === page) return;
      const m = PAGES[key];
      if (m.inPage || key === "options") {
        setActionNode(null);
        setPage(key);
        if (typeof window !== "undefined" && m.href) {
          window.history.replaceState(window.history.state, "", m.href);
        }
        // `.main` is the scroll container (window is locked); reset it, not window.
        document.querySelector(".mgmt-page .main")?.scrollTo({ top: 0, behavior: "smooth" });
      } else if (m.href) {
        router.push(m.href);
      }
    },
    [PAGES, router, page]
  );

  const goCluster = useCallback(
    (c: ClusterKey) => {
      const first = PAGES_BY_CLUSTER[c][0];
      if (first) showPage(first);
    },
    [PAGES_BY_CLUSTER, showPage]
  );

  const title = s[meta.labelKey];
  const subtitle = meta.subKey ? s[meta.subKey] : "";

  return (
    <div className="mgmt-page mgmt-page-host">
      <div className={layoutClass}>
        <Sidebar collapsed={sidebarCollapsed} unreadCount={unreadCount} />
        <div className="nav-overlay" onClick={closeNav} />
        <div className="main">
          <Header
            collapsed={sidebarCollapsed}
            onHamburger={onHamburger}
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
                  <span>{s[CLUSTERS.find((c) => c.key === activeCluster)!.labelKey]}</span>
                  <i className="ti ti-chevron-right" />
                  <span className="breadcrumb-current">{title}</span>
                </div>
                <h1 className="page-title">
                  <span>{title}</span>
                  {isSuper && (
                    <span className="super-tag">
                      <i className="ti ti-shield-lock" style={{ fontSize: 13 }} />
                      {s.superAdmin}
                    </span>
                  )}
                </h1>
                {subtitle ? <div className="page-subtitle">{subtitle}</div> : null}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actionNode}</div>
            </div>

            {/* Level 1 — cluster strip */}
            <div className="section-tabs">
              {CLUSTERS.map((c) => (
                <button
                  key={c.key}
                  className={`section-tab ${c.key === activeCluster ? "active" : ""}`}
                  onClick={() => goCluster(c.key)}
                >
                  <i className={`ti ${c.icon}`} />
                  {s[c.labelKey]}
                </button>
              ))}
            </div>

            {/* Level 2 — page pills for the active cluster */}
            <div className="pills-row active">
              {(activeCluster === "myprofile"
                ? visibleMyProfilePages
                : PAGES_BY_CLUSTER[activeCluster]
              ).map((k) => (
                <button
                  key={k}
                  className={`sub-tab pg-pill ${k === page ? "active" : ""}`}
                  onClick={() => showPage(k)}
                >
                  {s[PAGES[k].labelKey]}
                </button>
              ))}
            </div>

            {/* In-page panes */}
            {page === "pipeline" && <PipelinePane token={token} lang={lang} />}
            {page === "leads" && (
              <LeadsPane token={token} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "messages" && <SocialInboxPane token={token} lang={lang} />}
            {page === "deals" && (
              <DealsPane token={token} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "activities" && (
              <ActivitiesPane token={token} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "segments" && (
              <SegmentsPane token={token} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "customers" && (
              <CustomersPane token={token} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "team" && (
              <TeamPane token={token} user={user} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "options" && <OptionsPane token={token} lang={lang} showToast={showToast} />}
            {page === "contracts" && (
              <ContractsPane token={token} user={user} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "workhours" && (
              <WorkHoursPane token={token} user={user} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "payroll" && (
              <PayrollPane token={token} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "files" && (
              <FilesPane token={token} user={user} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "connections" && <ConnectionsPane token={token} lang={lang} />}

            {/* My profile cluster — pane render is guarded by the role-scoped
                pill list: a page the user can't see falls back to Account. */}
            {page === "account" && (
              <AccountPane token={token} user={user} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "mycompany" &&
              (visibleMyProfilePages.includes("mycompany") ? (
                <MyCompanyPane token={token} user={user} lang={lang} registerAction={setActionNode} showToast={showToast} />
              ) : (
                <AccountPane token={token} user={user} lang={lang} registerAction={setActionNode} showToast={showToast} />
              ))}
            {page === "myteam" &&
              (visibleMyProfilePages.includes("myteam") ? (
                <TeamPane token={token} user={user} lang={lang} registerAction={setActionNode} showToast={showToast} />
              ) : (
                <AccountPane token={token} user={user} lang={lang} registerAction={setActionNode} showToast={showToast} />
              ))}
            {page === "myagents" &&
              (visibleMyProfilePages.includes("myagents") ? (
                <MyAgentsPane token={token} user={user} lang={lang} registerAction={setActionNode} showToast={showToast} />
              ) : (
                <AccountPane token={token} user={user} lang={lang} registerAction={setActionNode} showToast={showToast} />
              ))}
          </div>
        </div>
      </div>

      {/* Toast host */}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className="toast show" key={t.id}>
            <i className="ti ti-circle-check" />
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Pipeline (kanban) — real deals grouped client-side by stage;
// cards drag between columns (PATCH stage, optimistic + revert)
// ════════════════════════════════════════════════════════════════
const KANBAN_STAGES: CrmDealStage[] = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
const STAGE_LABEL_KEY: Record<CrmDealStage, CrmKey> = {
  new: "stageNew",
  qualified: "stageQualified",
  proposal: "stageProposal",
  negotiation: "stageNegotiation",
  won: "stageWon",
  lost: "stageLost",
};

function PipelinePane({ token, lang }: { token: string | null; lang: string }) {
  const s = crmStrings(lang);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<CrmDealStage | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiCrmDeals(token, { per_page: 200 });
      setDeals(res.data);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  // Optimistic stage move: the card jumps immediately, reverts on API error.
  const moveDeal = useCallback(
    async (dealId: number, stage: CrmDealStage) => {
      if (!token) return;
      const current = deals.find((d) => d.id === dealId);
      if (!current || current.stage === stage) return;
      const prevStage = current.stage;
      setErr(null);
      setDeals((ds) => ds.map((d) => (d.id === dealId ? { ...d, stage } : d)));
      try {
        await apiUpdateCrmDeal(token, dealId, { stage });
      } catch (e) {
        setDeals((ds) => ds.map((d) => (d.id === dealId ? { ...d, stage: prevStage } : d)));
        setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, deals]
  );

  return (
    <>
      <div className="alert">
        <i className="ti ti-info-circle" />
        <div>
          {s.pipeAlert} {s.pipeDragHint}{" "}
          <strong>
            {s.pipeAlertEmphasis} <span className="font-mono">crm.view_all</span>.
          </strong>
        </div>
      </div>
      {err ? (
        <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div>
      ) : null}
      {!loading && deals.length === 0 ? (
        <div className="empty-state">
          <div className="es-icon"><i className="ti ti-businessplan" /></div>
          <div className="es-title">{s.pgPipeline}</div>
          <div className="es-sub">{s.pipeEmpty}</div>
        </div>
      ) : (
        <div className="kanban">
          {KANBAN_STAGES.map((st) => {
            const cards = deals.filter((d) => d.stage === st);
            return (
              <div
                className={`kanban-col${overStage === st ? " drag-over" : ""}`}
                key={st}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDragEnter={() => setOverStage(st)}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = Number(e.dataTransfer.getData("text/plain"));
                  setOverStage(null);
                  setDragId(null);
                  if (Number.isFinite(id) && id > 0) void moveDeal(id, st);
                }}
              >
                <div className="kanban-col-head">
                  <span className="kanban-col-title">
                    <span className={`kdot ${st}`} />
                    {s[STAGE_LABEL_KEY[st]]}
                  </span>
                  <span className="kanban-count">{cards.length}</span>
                </div>
                <div className="kanban-body">
                  {cards.map((d) => (
                    <div
                      className={`deal-card${dragId === d.id ? " dragging" : ""}`}
                      key={d.id}
                      draggable
                      onDragStart={(e) => {
                        setDragId(d.id);
                        e.dataTransfer.setData("text/plain", String(d.id));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                    >
                      <div className="dc-title">{d.title}</div>
                      <div className="dc-customer">
                        <span className={`avatar sm ${avatarTone(d.customer?.id ?? d.id)}`}>
                          {initials(d.customer?.name)}
                        </span>
                        {d.customer?.name ?? s.dealFldCustomerNone}
                      </div>
                      <div className="dc-foot">
                        <span className="dc-value">{money(d.value_amount, d.currency)}</span>
                        <span className={`avatar sm ${avatarTone(d.owner?.id)}`}>
                          {initials(d.owner?.name)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Deals pane — stats + chip-row + filter + table + create/edit drawer
// ════════════════════════════════════════════════════════════════
type DealDrawerState = { mode: "create" } | { mode: "edit"; row: CrmDeal } | null;
const DEAL_CURRENCIES = ["AMD", "USD", "EUR", "RUB", "GBP"];
const CHIP_STAGES: Array<CrmDealStage | "all"> = ["all", "new", "qualified", "proposal", "negotiation", "won", "lost"];

export type PaneProps = {
  token: string | null;
  lang: string;
  registerAction: (node: ReactNode) => void;
  showToast: (msg: string) => void;
};

function DealsPane({ token, lang, registerAction, showToast }: PaneProps) {
  const s = crmStrings(lang);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [stats, setStats] = useState<CrmStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [chip, setChip] = useState<CrmDealStage | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<DealDrawerState>(null);
  const PER_PAGE = 10;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [dealsRes, statsRes] = await Promise.all([
        apiCrmDeals(token, { per_page: 200, search: search || undefined, stage: stageFilter || undefined }),
        apiCrmStats(token).catch(() => null),
      ]);
      setDeals(dealsRes.data);
      if (statsRes) setStats(statsRes.data);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search, stageFilter]);
  useEffect(() => { void load(); }, [load]);

  // top-right action button (rendered by the parent into the page-header)
  useEffect(() => {
    registerAction(
      <button className="btn btn-primary" onClick={() => setDrawer({ mode: "create" })}>
        <i className="ti ti-plus" />
        {s.actNewDeal}
      </button>
    );
    return () => registerAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // owners list, derived from the loaded deals
  const owners = useMemo(() => {
    const m = new Map<number, string>();
    deals.forEach((d) => { if (d.owner) m.set(d.owner.id, d.owner.name); });
    return Array.from(m.entries());
  }, [deals]);

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (chip !== "all" && d.stage !== chip) return false;
      if (ownerFilter && String(d.owner?.id ?? "") !== ownerFilter) return false;
      return true;
    });
  }, [deals, chip, ownerFilter]);

  const total = filtered.length;
  const start = (page - 1) * PER_PAGE;
  const pageRows = filtered.slice(start, start + PER_PAGE);
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  const winRate = stats && stats.won_deals + stats.open_deals > 0
    ? Math.round((stats.won_deals / (stats.won_deals + stats.open_deals)) * 100)
    : 0;

  async function remove(row: CrmDeal) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.confirmDeleteDeal)) return;
    try {
      await apiDeleteCrmDeal(token, row.id);
      showToast(s.dealDeletedToast);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card c-primary">
          <div className="stat-header"><i className="ti ti-businessplan" /></div>
          <div className="stat-value">{stats?.open_deals ?? "—"}</div>
          <div className="stat-label">{s.dealsStatOpen}</div>
        </div>
        <div className="stat-card c-success">
          <div className="stat-header"><i className="ti ti-trophy" /></div>
          <div className="stat-value">{stats?.won_deals ?? "—"}</div>
          <div className="stat-label">{s.dealsStatWon}</div>
        </div>
        <div className="stat-card c-info">
          <div className="stat-header"><i className="ti ti-coin" /></div>
          <div className="stat-value">{stats ? money(stats.pipeline_value, deals[0]?.currency ?? "AMD") : "—"}</div>
          <div className="stat-label">{s.dealsStatPipeline}</div>
        </div>
        <div className="stat-card c-warning">
          <div className="stat-header"><i className="ti ti-percentage" /></div>
          <div className="stat-value">{stats ? `${winRate}%` : "—"}</div>
          <div className="stat-label">{s.dealsStatWinRate}</div>
        </div>
      </div>

      <div className="chip-row">
        {CHIP_STAGES.map((st) => (
          <button
            key={st}
            className={`chip ${chip === st ? "active" : ""}`}
            onClick={() => { setChip(st); setPage(1); }}
          >
            {st === "all" ? s.all : s[STAGE_LABEL_KEY[st]]}
          </button>
        ))}
      </div>

      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input
            type="search"
            placeholder={s.dealsSearchPh}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setPage(1), setSearch(searchInput.trim()))}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.dealsColStage}</span>
          <select value={stageFilter} onChange={(e) => { setPage(1); setStageFilter(e.target.value); }}>
            <option value="">{s.allStages}</option>
            <option value="new">{s.stageNew}</option>
            <option value="qualified">{s.stageQualified}</option>
            <option value="proposal">{s.stageProposal}</option>
            <option value="won">{s.stageWon}</option>
            <option value="lost">{s.stageLost}</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.dealsColOwner}</span>
          <select value={ownerFilter} onChange={(e) => { setPage(1); setOwnerFilter(e.target.value); }}>
            <option value="">{s.dealsOwnerAll}</option>
            {owners.map(([id, name]) => (
              <option key={id} value={String(id)}>{name}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => { setPage(1); setSearch(searchInput.trim()); }}>
          <i className="ti ti-filter" />
          {s.apply}
        </button>
      </div>

      {err ? <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div> : null}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.dealsColTitle}</th>
                <th>{s.dealsColCustomer}</th>
                <th>{s.dealsColStage}</th>
                <th>{s.dealsColValue}</th>
                <th>{s.dealsColOwner}</th>
                <th>{s.dealsColCreated}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && deals.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.dealsEmpty}</td></tr>
              ) : (
                pageRows.map((d) => (
                  <tr key={d.id} onClick={() => setDrawer({ mode: "edit", row: d })}>
                    <td className="font-semibold">{d.title}</td>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className={`avatar sm ${avatarTone(d.customer?.id ?? d.id)}`}>{initials(d.customer?.name)}</span>
                        {d.customer?.name ?? s.none}
                      </span>
                    </td>
                    <td><span className={`badge ${STAGE_BADGE[d.stage]}`}>{s[STAGE_LABEL_KEY[d.stage]]}</span></td>
                    <td className="font-mono">{money(d.value_amount, d.currency)}</td>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className={`avatar sm ${avatarTone(d.owner?.id)}`}>{initials(d.owner?.name)}</span>
                        {d.owner?.name ?? s.dealFldOwnerNone}
                      </span>
                    </td>
                    <td className="cell-muted">{fmtDate(d.created_at)}</td>
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button className="icon-btn" title={s.edit} onClick={() => setDrawer({ mode: "edit", row: d })}>
                          <i className="ti ti-pencil" />
                        </button>
                        <button className="icon-btn danger" title={s.delete} onClick={() => void remove(d)}>
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > 0 ? (
          <div className="pagination">
            <span className="pagination-info">
              {`${start + 1}–${Math.min(start + PER_PAGE, total)} / ${total}`}
            </span>
            <div className="pagination-controls">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{s.prev}</button>
              <button className="btn btn-sm btn-primary">{page}</button>
              <button className="btn btn-sm" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>{s.next}</button>
            </div>
          </div>
        ) : null}
      </div>

      <DealDrawer
        state={drawer}
        lang={lang}
        token={token}
        onClose={() => setDrawer(null)}
        onSaved={() => { setDrawer(null); showToast(s.dealSavedToast); void load(); }}
      />
    </div>
  );
}

function DealDrawer({
  state,
  lang,
  token,
  onClose,
  onSaved,
}: {
  state: DealDrawerState;
  lang: string;
  token: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const s = crmStrings(lang);
  const isEdit = state?.mode === "edit";
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<CrmDealStage>("new");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("AMD");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      setTitle(state.row.title);
      setStage(state.row.stage);
      setValue(String(state.row.value_amount ?? ""));
      setCurrency(state.row.currency || "AMD");
      setNotes("");
    } else {
      setTitle("");
      setStage("new");
      setValue("");
      setCurrency("AMD");
      setNotes("");
    }
  }, [state]);

  async function submit() {
    if (!token || !state) return;
    setBusy(true);
    try {
      if (state.mode === "edit") {
        await apiUpdateCrmDeal(token, state.row.id, {
          title: title.trim(),
          stage,
          value_amount: Number(value) || 0,
          notes: notes || undefined,
        });
      } else {
        await apiCreateCrmDeal(token, {
          title: title.trim(),
          stage,
          value_amount: Number(value) || 0,
          currency,
          notes: notes || undefined,
        });
      }
      onSaved();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`drawer-overlay ${state ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${state ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div className="card-title">{isEdit ? s.dealDrawerEditTitle : s.dealDrawerNewTitle}</div>
            <div className="card-subtitle">{s.dealDrawerSubtitle}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          <div className="fld mb-3">
            <span className="fld-label">{s.dealFldTitle}</span>
            <input value={title} placeholder={s.dealFldTitlePh} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-grid-2">
            <div className="fld">
              <span className="fld-label">{s.dealFldStage}</span>
              <select value={stage} onChange={(e) => setStage(e.target.value as CrmDealStage)}>
                <option value="new">{s.stageNew}</option>
                <option value="qualified">{s.stageQualified}</option>
                <option value="proposal">{s.stageProposal}</option>
                <option value="negotiation">{s.stageNegotiation}</option>
                <option value="won">{s.stageWon}</option>
                <option value="lost">{s.stageLost}</option>
              </select>
            </div>
            <div className="fld">
              <span className="fld-label">{s.dealFldCurrency}</span>
              <select value={currency} disabled={isEdit} onChange={(e) => setCurrency(e.target.value)}>
                {DEAL_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="fld mb-3" style={{ marginTop: 12 }}>
            <span className="fld-label">{s.dealFldValue}</span>
            <input type="number" value={value} placeholder="0" onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="fld" style={{ marginTop: 12 }}>
            <span className="fld-label">{s.dealFldNotes}</span>
            <textarea value={notes} placeholder={s.dealFldNotesPh} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="drawer-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy || title.trim() === ""} onClick={() => void submit()}>
            <i className="ti ti-device-floppy" />
            {s.dealSaveBtn}
          </button>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Activities pane — filter + table + create/edit modal
// ════════════════════════════════════════════════════════════════
type ActivityModalState = { mode: "create" } | { mode: "edit"; row: CrmActivity } | null;
const ACTIVITY_TYPE_BADGE: Record<CrmActivityType, { badge: string; icon: string; key: CrmKey }> = {
  call: { badge: "badge-info", icon: "ti-phone", key: "actTypeCall" },
  meeting: { badge: "badge-primary", icon: "ti-users", key: "actTypeMeeting" },
  email: { badge: "badge-warning", icon: "ti-mail", key: "actTypeEmail" },
  task: { badge: "badge-gray", icon: "ti-checkbox", key: "actTypeTask" },
  note: { badge: "badge-gray", icon: "ti-note", key: "actTypeNote" },
};

function ActivitiesPane({ token, lang, registerAction, showToast }: PaneProps) {
  const s = crmStrings(lang);
  const [rows, setRows] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ActivityModalState>(null);
  const PER_PAGE = 10;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiCrmActivities(token, { per_page: 200, type: typeFilter || undefined });
      setRows(res.data);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, typeFilter]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    registerAction(
      <button className="btn btn-primary" onClick={() => setModal({ mode: "create" })}>
        <i className="ti ti-plus" />
        {s.actLogActivity}
      </button>
    );
    return () => registerAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const owners = useMemo(() => {
    const m = new Map<number, string>();
    rows.forEach((a) => { if (a.owner) m.set(a.owner.id, a.owner.name); });
    return Array.from(m.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((a) => {
      if (q && !a.subject.toLowerCase().includes(q)) return false;
      if (ownerFilter && String(a.owner?.id ?? "") !== ownerFilter) return false;
      return true;
    });
  }, [rows, search, ownerFilter]);

  const total = filtered.length;
  const start = (page - 1) * PER_PAGE;
  const pageRows = filtered.slice(start, start + PER_PAGE);
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  const relatedLabel = (a: CrmActivity): string => {
    if (!a.subject_type) return s.none;
    if (a.subject_type === "deal") return `${s.pgDeals} · #${a.subject_id}`;
    if (a.subject_type === "customer") return `${s.pgCustomers} · #${a.subject_id}`;
    return `${a.subject_type} · #${a.subject_id}`;
  };

  return (
    <div>
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input
            type="search"
            placeholder={s.actSearchPh}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setPage(1), setSearch(searchInput.trim()))}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.actColType}</span>
          <select value={typeFilter} onChange={(e) => { setPage(1); setTypeFilter(e.target.value); }}>
            <option value="">{s.actTypeAll}</option>
            {CRM_ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>{s[ACTIVITY_TYPE_BADGE[t].key]}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.actColOwner}</span>
          <select value={ownerFilter} onChange={(e) => { setPage(1); setOwnerFilter(e.target.value); }}>
            <option value="">{s.dealsOwnerAll}</option>
            {owners.map(([id, name]) => (
              <option key={id} value={String(id)}>{name}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => { setPage(1); setSearch(searchInput.trim()); }}>
          <i className="ti ti-filter" />
          {s.apply}
        </button>
      </div>

      {err ? <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div> : null}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.actColType}</th>
                <th>{s.actColSubject}</th>
                <th>{s.actColRelated}</th>
                <th>{s.actColOwner}</th>
                <th>{s.actColWhen}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.actEmpty}</td></tr>
              ) : (
                pageRows.map((a) => {
                  const tb = ACTIVITY_TYPE_BADGE[a.type] ?? ACTIVITY_TYPE_BADGE.note;
                  return (
                    <tr key={a.id} onClick={() => setModal({ mode: "edit", row: a })}>
                      <td>
                        <span className={`badge ${tb.badge}`}>
                          <i className={`ti ${tb.icon}`} style={{ fontSize: 12 }} />
                          {s[tb.key]}
                        </span>
                      </td>
                      <td className="font-semibold">{a.subject}</td>
                      <td className="cell-muted">{relatedLabel(a)}</td>
                      <td>
                        <span className="flex items-center gap-2">
                          <span className={`avatar sm ${avatarTone(a.owner?.id)}`}>{initials(a.owner?.name)}</span>
                          {a.owner?.name ?? s.none}
                        </span>
                      </td>
                      <td className="cell-muted">{fmtDateTime(a.due_at ?? a.created_at)}</td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button className="icon-btn" title={s.edit} onClick={() => setModal({ mode: "edit", row: a })}>
                            <i className="ti ti-pencil" />
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
        {total > 0 ? (
          <div className="pagination">
            <span className="pagination-info">{`${start + 1}–${Math.min(start + PER_PAGE, total)} / ${total}`}</span>
            <div className="pagination-controls">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{s.prev}</button>
              <button className="btn btn-sm btn-primary">{page}</button>
              <button className="btn btn-sm" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>{s.next}</button>
            </div>
          </div>
        ) : null}
      </div>

      <ActivityModal
        state={modal}
        lang={lang}
        token={token}
        onClose={() => setModal(null)}
        onSaved={() => { setModal(null); showToast(s.actSavedToast); void load(); }}
      />
    </div>
  );
}

function ActivityModal({
  state,
  lang,
  token,
  onClose,
  onSaved,
}: {
  state: ActivityModalState;
  lang: string;
  token: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const s = crmStrings(lang);
  const isEdit = state?.mode === "edit";
  const [type, setType] = useState<CrmActivityType>("call");
  const [when, setWhen] = useState("");
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      setType(state.row.type);
      setSubject(state.row.subject);
      setNote(state.row.body ?? "");
      setWhen(state.row.due_at ? state.row.due_at.slice(0, 16) : "");
    } else {
      setType("call");
      setSubject("");
      setNote("");
      setWhen("");
    }
  }, [state]);

  async function submit() {
    if (!token || !state) return;
    setBusy(true);
    try {
      if (state.mode === "edit") {
        await apiUpdateCrmActivity(token, state.row.id, {
          subject: subject.trim(),
          body: note,
          due_at: when ? new Date(when).toISOString() : null,
        });
      } else {
        await apiCreateCrmActivity(token, {
          type,
          subject: subject.trim(),
          body: note || undefined,
          due_at: when ? new Date(when).toISOString() : undefined,
        });
      }
      onSaved();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`modal-overlay ${state ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? s.actModalEditTitle : s.actModalNewTitle}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid-2">
            <div className="fld">
              <span className="fld-label">{s.actFldType}</span>
              <select value={type} disabled={isEdit} onChange={(e) => setType(e.target.value as CrmActivityType)}>
                {CRM_ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>{s[ACTIVITY_TYPE_BADGE[t].key]}</option>
                ))}
              </select>
            </div>
            <div className="fld">
              <span className="fld-label">{s.actFldWhen}</span>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
          </div>
          <div className="fld" style={{ marginTop: 12 }}>
            <span className="fld-label">{s.actFldSubject}</span>
            <input value={subject} placeholder={s.actFldSubjectPh} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="fld" style={{ marginTop: 12 }}>
            <span className="fld-label">{s.actFldNote}</span>
            <textarea value={note} placeholder={s.actFldNotePh} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy || subject.trim() === ""} onClick={() => void submit()}>
            <i className="ti ti-device-floppy" />
            {s.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Customers pane — stats + filter + table + in-pane full-page detail
// ════════════════════════════════════════════════════════════════
function CustomersPane({ token, lang, registerAction, showToast }: PaneProps) {
  const s = crmStrings(lang);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<CrmCustomersStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiCrmCustomers(token, { page, per_page: PER_PAGE, search, status: statusFilter });
      setRows(res.data);
      setTotal(res.meta.total ?? res.data.length);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, search, statusFilter]);
  useEffect(() => { void load(); }, [load]);

  // Full-dataset stat cards (active / with_bookings / new_this_month), fetched
  // once on mount. Defensive: on failure we fall back to page-derived counts
  // (see below) without claiming they're platform-wide totals.
  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiCrmCustomersStats(token);
      setStats(res.data);
    } catch {
      setStats(null);
    }
  }, [token]);
  useEffect(() => { void loadStats(); }, [loadStats]);

  const exportCsv = useCallback(() => {
    const header = ["Name", "Email", "Phone", "Status", "Bookings"];
    const lines = rows.map((c) =>
      [c.name, c.email, c.phone ?? "", c.status, c.bookings_count].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    if (typeof window !== "undefined") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "customers.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
    showToast(s.cuExportedToast);
  }, [rows, s, showToast]);

  // top-right action: Export CSV (hidden while a detail page is open)
  useEffect(() => {
    if (detailId != null) {
      registerAction(null);
      return;
    }
    registerAction(
      <button className="btn" onClick={exportCsv}>
        <i className="ti ti-download" />
        {s.actExportCsv}
      </button>
    );
    return () => registerAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, detailId, exportCsv]);

  if (detailId != null) {
    return <CustomerDetail token={token} lang={lang} customerId={detailId} onBack={() => setDetailId(null)} />;
  }

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const start = (page - 1) * PER_PAGE;

  // Card values prefer the real full-dataset counts from /crm/customers/stats
  // (active / with_bookings / new_this_month). If the stats call failed, fall
  // back to page-derived approximations so the cards still render a number.
  const activeCount = stats ? stats.active : rows.filter((c) => c.status === "active").length;
  const withBookings = stats ? stats.with_bookings : rows.filter((c) => c.bookings_count > 0).length;
  const newThisMonth = stats
    ? stats.new_this_month
    : (() => {
        const now = new Date();
        return rows.filter((c) => {
          if (!c.created_at) return false;
          const d = new Date(c.created_at);
          return (
            !Number.isNaN(d.getTime()) &&
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth()
          );
        }).length;
      })();

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card c-primary">
          <div className="stat-header"><i className="ti ti-user-heart" /></div>
          <div className="stat-value">{total}</div>
          <div className="stat-label">{s.cuStatTotal}</div>
        </div>
        <div className="stat-card c-success">
          <div className="stat-header"><i className="ti ti-circle-check" /></div>
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">{s.cuStatActive}</div>
        </div>
        <div className="stat-card c-info">
          <div className="stat-header"><i className="ti ti-calendar-check" /></div>
          <div className="stat-value">{withBookings}</div>
          <div className="stat-label">{s.cuStatWithBookings}</div>
        </div>
        <div className="stat-card c-warning">
          <div className="stat-header"><i className="ti ti-user-plus" /></div>
          <div className="stat-value">{newThisMonth}</div>
          <div className="stat-label">{s.cuStatNew}</div>
        </div>
      </div>

      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input
            type="search"
            placeholder={s.cuSearchPh}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setPage(1), setSearch(searchInput.trim()))}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.status}</span>
          <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}>
            <option value="">{s.cuStatusAll}</option>
            <option value="active">{s.cuStatusActive}</option>
            <option value="inactive">{s.cuStatusInactive}</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => { setPage(1); setSearch(searchInput.trim()); }}>
          <i className="ti ti-filter" />
          {s.apply}
        </button>
        <button className="btn" onClick={exportCsv}>
          <i className="ti ti-download" />
          {s.actExportCsv}
        </button>
      </div>

      {err ? <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div> : null}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.cuColCustomer}</th>
                <th>{s.cuColEmail}</th>
                <th>{s.cuColStatus}</th>
                <th className="num-cell">{s.cuColBookings}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.cuEmpty}</td></tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} onClick={() => setDetailId(c.id)}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className={`avatar sm ${avatarTone(c.id)}`}>{initials(c.name)}</span>
                        {c.name || s.none}
                      </span>
                    </td>
                    <td className="cell-muted">{c.email}</td>
                    <td><span className={`badge ${STATUS_BADGE[c.status] ?? "badge-gray"}`}>{c.status || s.none}</span></td>
                    <td className="num-cell font-mono">{c.bookings_count}</td>
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button className="icon-btn" title={s.cuBackToList} onClick={() => setDetailId(c.id)}>
                          <i className="ti ti-eye" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > 0 ? (
          <div className="pagination">
            <span className="pagination-info">{`${start + 1}–${Math.min(start + PER_PAGE, total)} / ${total}`}</span>
            <div className="pagination-controls">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{s.prev}</button>
              <button className="btn btn-sm btn-primary">{page}</button>
              <button className="btn btn-sm" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>{s.next}</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CustomerDetail({
  token,
  lang,
  customerId,
  onBack,
}: {
  token: string | null;
  lang: string;
  customerId: number;
  onBack: () => void;
}) {
  const s = crmStrings(lang);
  const [data, setData] = useState<PlatformAdminUserDetail | null>(null);
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await apiShowPlatformUser(token, customerId);
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
      try {
        const bres = await apiBookings(token, { user_id: customerId, per_page: 10 });
        if (!cancelled) setBookings(bres.data);
      } catch {
        if (!cancelled) setBookings([]);
      }
    })();
    return () => { cancelled = true; };
  }, [token, customerId]);

  const statusBadge = STATUS_BADGE[data?.status ?? ""] ?? "badge-gray";

  return (
    <div>
      <button className="btn btn-ghost detail-back" onClick={onBack}>
        <i className="ti ti-arrow-left" />
        {s.cuBackToList}
      </button>
      <div className="hero-card">
        <div className="hero-avatar">{initials(data?.name)}</div>
        <div>
          <div className="hero-name">
            <span>{data?.name ?? (loading ? s.loading : s.none)}</span>
            {data ? <span className={`badge ${statusBadge}`}>{data.status || s.none}</span> : null}
          </div>
          <div className="hero-meta">
            <span><i className="ti ti-mail" style={{ fontSize: 14 }} /> {data?.email ?? s.none}</span>
            <span><i className="ti ti-phone" style={{ fontSize: 14 }} /> {data?.phone ?? s.none}</span>
          </div>
        </div>
        <div className="hero-actions">
          {/* 2026-06-10 (roadmap §2 bug 3) — both were dead buttons. mailto, same
              as the Management B2C-detail Message action (no in-app customer
              messaging channel exists yet — roadmap §4 customer chat). */}
          <button
            className="btn"
            disabled={!data?.email}
            onClick={() => { if (data?.email) window.open(`mailto:${data.email}`, "_blank"); }}
          >
            <i className="ti ti-mail" />{s.cuHeroEmail}
          </button>
          <button
            className="btn"
            disabled={!data?.email}
            onClick={() => { if (data?.email) window.open(`mailto:${data.email}`, "_blank"); }}
          >
            <i className="ti ti-message" />{s.cuHeroMessage}
          </button>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div>
            <div className="card-title">{s.cuBookingsTitle}</div>
            <div className="card-subtitle">{s.cuBookingsSubtitle}</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.cuBkColDate}</th>
                <th>{s.cuBkColService}</th>
                <th className="num-cell">{s.cuBkColAmount}</th>
                <th>{s.cuBkColStatus}</th>
              </tr>
            </thead>
            <tbody>
              {bookings === null ? (
                <tr><td colSpan={4} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : bookings.length === 0 ? (
                <tr><td colSpan={4} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.cuBkEmpty}</td></tr>
              ) : (
                bookings.map((b) => {
                  const amount = b.total ?? b.total_amount;
                  return (
                    <tr key={b.id}>
                      <td className="cell-muted">{fmtDate(b.created_at)}</td>
                      <td className="font-semibold">
                        {b.offer?.title || b.offer?.type || b.items?.[0]?.module_type || s.none}
                      </td>
                      <td className="num-cell font-mono">
                        {amount != null ? money(amount, b.currency ?? "AMD") : s.none}
                      </td>
                      <td>
                        <span className={`badge ${BOOKING_BADGE[b.status ?? ""] ?? "badge-gray"}`}>
                          {b.status || s.none}
                        </span>
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

// ════════════════════════════════════════════════════════════════
// Team pane — alert + stats + table + compensation drawer + add-employee
// ════════════════════════════════════════════════════════════════
const TEAM_MODEL_KEY: Record<CrmCompModel, CrmKey> = {
  fixed: "teamModelFixed",
  percent: "teamModelPercent",
  fixed_plus_percent: "teamModelFixedPercent",
};

export type TeamUser = NonNullable<ReturnType<typeof useAdminAuth>["user"]>;

function TeamPane({
  token,
  user,
  lang,
  registerAction,
  showToast,
}: PaneProps & { user: TeamUser | null }) {
  const s = crmStrings(lang);
  const [rows, setRows] = useState<CrmTeamRow[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<CrmTeamRow | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const teamCompany =
    companyId != null
      ? user?.companies?.find((c) => c.id === companyId) ?? user?.companies?.[0] ?? null
      : null;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiCrmTeam(token, {});
      setRows(res.data);
      setCompanyId(res.meta.company_id);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  // The mock shows an "Add employee" action top-right. The existing add-employee
  // flow (POST /companies/{id}/users via AddEmployeeModal) needs a company
  // context; if the caller has none (e.g. a super-admin with no own company) we
  // omit the button rather than break — matching the task's allowance.
  useEffect(() => {
    if (!teamCompany) { registerAction(null); return; }
    registerAction(
      <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
        <i className="ti ti-user-plus" />
        {s.actAddEmployee}
      </button>
    );
    return () => registerAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, teamCompany]);

  const total = rows.length;
  const start = (page - 1) * PER_PAGE;
  const pageRows = rows.slice(start, start + PER_PAGE);
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  // §7 — employee lifecycle actions (deactivate / reactivate / remove).
  // Self-row shows no actions (backend blocks self-ops anyway); rank ceiling +
  // last-owner protection are server-side, surfaced here via the error banner.
  const [actBusy, setActBusy] = useState<number | null>(null);

  const toggleActive = async (r: CrmTeamRow) => {
    if (!token || companyId == null) return;
    const isActive = r.user.status !== "inactive";
    if (isActive && typeof window !== "undefined" && !window.confirm(s.teamConfirmDeactivate)) return;
    setActBusy(r.user.id);
    setErr(null);
    try {
      if (isActive) await apiDeactivateEmployee(token, companyId, r.user.id);
      else await apiReactivateEmployee(token, companyId, r.user.id);
      showToast(isActive ? s.teamDeactivatedToast : s.teamReactivatedToast);
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setActBusy(null);
    }
  };

  const removeEmployee = async (r: CrmTeamRow) => {
    if (!token || companyId == null) return;
    if (typeof window !== "undefined" && !window.confirm(s.teamConfirmRemove)) return;
    setActBusy(r.user.id);
    setErr(null);
    try {
      await apiRemoveEmployee(token, companyId, r.user.id);
      showToast(s.teamRemovedToast);
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setActBusy(null);
    }
  };

  // header stat cards derived from the loaded rows
  const totalWon = rows.reduce((acc, r) => acc + r.won_deals, 0);
  const payByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => {
      if (r.computed_pay != null) m.set(r.pay_currency, (m.get(r.pay_currency) ?? 0) + r.computed_pay);
    });
    return Array.from(m.entries());
  }, [rows]);
  const revByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => r.revenue_by_currency.forEach((rc) => m.set(rc.currency, (m.get(rc.currency) ?? 0) + rc.revenue)));
    return Array.from(m.entries());
  }, [rows]);

  const sumLabel = (entries: Array<[string, number]>) =>
    entries.length === 0 ? "—" : entries.map(([cur, v]) => money(v, cur)).join(" · ");

  // Detail view (roadmap §4, my-profile mock): the row object is looked up
  // from the CURRENT rows so a reload (role change, lifecycle action) is
  // reflected immediately; a removed member just falls back to the list.
  const detailRow = detailId != null ? rows.find((r) => r.user.id === detailId) ?? null : null;
  useEffect(() => {
    if (detailId != null && !loading && rows.length > 0 && detailRow === null) setDetailId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, loading, rows]);

  if (detailRow && token && companyId != null) {
    return (
      <div>
        <TeamMemberDetail
          row={detailRow}
          companyId={companyId}
          token={token}
          lang={lang}
          isSelf={user?.id === detailRow.user.id}
          busy={actBusy === detailRow.user.id}
          onBack={() => setDetailId(null)}
          onEditPay={() => setEditRow(detailRow)}
          onToggleActive={() => void toggleActive(detailRow)}
          onRemove={() => void removeEmployee(detailRow)}
          onChanged={() => void load()}
          showToast={showToast}
        />
        <CompensationDrawer
          row={editRow}
          companyId={companyId}
          lang={lang}
          token={token}
          onClose={() => setEditRow(null)}
          onSaved={() => { setEditRow(null); showToast(s.compSavedToast); void load(); }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="alert">
        <i className="ti ti-info-circle" />
        <div>{s.teamAlert}</div>
      </div>

      <div className="stat-grid">
        <div className="stat-card c-primary">
          <div className="stat-header"><i className="ti ti-users-group" /></div>
          <div className="stat-value">{total}</div>
          <div className="stat-label">{s.teamStatEmployees}</div>
        </div>
        <div className="stat-card c-info">
          <div className="stat-header"><i className="ti ti-coin" /></div>
          <div className="stat-value" style={{ fontSize: 18 }}>{sumLabel(revByCurrency)}</div>
          <div className="stat-label">{s.teamStatRevenue}</div>
        </div>
        <div className="stat-card c-success">
          <div className="stat-header"><i className="ti ti-trophy" /></div>
          <div className="stat-value">{totalWon}</div>
          <div className="stat-label">{s.teamStatWon}</div>
        </div>
        <div className="stat-card c-warning">
          <div className="stat-header"><i className="ti ti-cash" /></div>
          <div className="stat-value" style={{ fontSize: 18 }}>{sumLabel(payByCurrency)}</div>
          <div className="stat-label">{s.teamStatPayroll}</div>
        </div>
      </div>

      {err ? <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div> : null}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.teamColEmployee}</th>
                <th className="num-cell">{s.teamColSales}</th>
                <th className="num-cell">{s.teamColWon}</th>
                <th className="num-cell">{s.teamColRevenue}</th>
                <th>{s.teamColPayModel}</th>
                <th className="num-cell">{s.teamColComputedPay}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.teamEmpty}</td></tr>
              ) : (
                pageRows.map((r) => {
                  const revenueLabel =
                    r.revenue_by_currency.length === 0
                      ? "—"
                      : r.revenue_by_currency.map((rc) => money(rc.revenue, rc.currency)).join(" · ");
                  return (
                    <tr key={r.user.id} onClick={() => setDetailId(r.user.id)}>
                      <td>
                        <span className="flex items-center gap-2">
                          <span className={`avatar sm ${avatarTone(r.user.id)}`}>{initials(r.user.name)}</span>
                          <span>
                            <div className="font-semibold">
                              {r.user.name}
                              {r.user.status === "inactive" ? (
                                <span className="pill-warn" style={{ marginLeft: 8 }}>{s.teamStatusInactive}</span>
                              ) : null}
                            </div>
                            <div className="text-sm cell-muted">{r.user.email}</div>
                          </span>
                        </span>
                      </td>
                      <td className="num-cell font-mono">{r.orders_count}</td>
                      <td className="num-cell font-mono">{r.won_deals}</td>
                      <td className="num-cell font-mono">{revenueLabel}</td>
                      <td>
                        <span className="pay-pill">
                          {r.compensation ? s[TEAM_MODEL_KEY[r.compensation.model]] : s.teamPayNotSet}
                        </span>
                      </td>
                      <td className="num-cell font-mono">{money(r.computed_pay, r.pay_currency)}</td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                          <button className="btn btn-sm" onClick={() => setEditRow(r)}>
                            <i className="ti ti-edit" />
                            {r.compensation ? s.teamEditPay : s.teamSetPay}
                          </button>
                          {user?.id !== r.user.id ? (
                            <>
                              <button
                                className="icon-btn"
                                title={r.user.status === "inactive" ? s.teamActReactivate : s.teamActDeactivate}
                                disabled={actBusy === r.user.id}
                                onClick={() => void toggleActive(r)}
                              >
                                <i className={r.user.status === "inactive" ? "ti ti-user-check" : "ti ti-user-off"} />
                              </button>
                              <button
                                className="icon-btn danger"
                                title={s.teamActRemove}
                                disabled={actBusy === r.user.id}
                                onClick={() => void removeEmployee(r)}
                              >
                                <i className="ti ti-trash" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {total > 0 ? (
          <div className="pagination">
            <span className="pagination-info">{`${start + 1}–${Math.min(start + PER_PAGE, total)} / ${total}`}</span>
            <div className="pagination-controls">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{s.prev}</button>
              <button className="btn btn-sm btn-primary">{page}</button>
              <button className="btn btn-sm" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>{s.next}</button>
            </div>
          </div>
        ) : null}
      </div>

      <CompensationDrawer
        row={editRow}
        companyId={companyId}
        lang={lang}
        token={token}
        onClose={() => setEditRow(null)}
        onSaved={() => { setEditRow(null); showToast(s.compSavedToast); void load(); }}
      />

      {teamCompany && token ? (
        <AddEmployeeModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          token={token}
          companyId={teamCompany.id}
          companyName={teamCompany.name}
          onSuccess={() => { setAddOpen(false); void load(); }}
        />
      ) : null}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Team member detail — Profile / Performance / Pay / Permissions
// (roadmap §4, my-profile mock's myteam-detail)
// ════════════════════════════════════════════════════════════════
const TEAM_ROLE_KEY: Record<string, CrmKey> = {
  company_admin: "tmRoleOwner",
  operator_admin: "tmRoleOwner",
  company_manager: "tmRoleManager",
  company_operator: "tmRoleStaff",
  company_viewer: "tmRoleViewer",
  agent: "tmRoleAgent",
};
const TEAM_ROLE_OPTIONS: CompanyEmployeeRole[] = [
  "company_viewer",
  "company_operator",
  "company_manager",
  "company_admin",
];

const TM_ACTION_KEY: Record<string, CrmKey> = {
  view: "tmActView",
  view_all: "tmActViewAll",
  view_dashboard: "tmActViewDashboard",
  create: "tmActCreate",
  update: "tmActUpdate",
  edit: "tmActEdit",
  delete: "tmActDelete",
  manage: "tmActManage",
  publish: "tmActPublish",
  archive: "tmActArchive",
  cancel: "tmActCancel",
  confirm: "tmActConfirm",
  upload: "tmActUpload",
  issue: "tmActIssue",
  pay: "tmActPay",
  capture: "tmActCapture",
  fail: "tmActFail",
  refund: "tmActRefund",
  moderate: "tmActModerate",
  update_profile: "tmActUpdateProfile",
  edit_profile: "tmActEditProfile",
  manage_components: "tmActManageComponents",
  manage_seller_permissions: "tmActManageSellerPerms",
};
const TM_MODULE_KEY: Record<string, CrmKey> = {
  account: "tmModAccount",
  bookings: "tmModBookings",
  cars: "tmModCars",
  chat: "tmModChat",
  commission_records: "tmModCommissionRecords",
  commissions: "tmModCommissions",
  companies: "tmModCompanies",
  "company.users": "tmModCompanyUsers",
  contracts: "tmModContracts",
  crm: "tmModCrm",
  dashboard: "tmModDashboard",
  excursions: "tmModExcursions",
  files: "tmModFiles",
  finance: "tmModFinance",
  "finance.entitlements": "tmModFinanceEntitlements",
  "finance.settlements": "tmModFinanceSettlements",
  flights: "tmModFlights",
  hotels: "tmModHotels",
  hr: "tmModHr",
  imports: "tmModImports",
  inbox: "tmModInbox",
  inventory: "tmModInventory",
  invoices: "tmModInvoices",
  localization: "tmModLocalization",
  management: "tmModManagement",
  my_company: "tmModMyCompany",
  offers: "tmModOffers",
  package_orders: "tmModPackageOrders",
  packages: "tmModPackages",
  payments: "tmModPayments",
  profile: "tmModProfile",
  reviews: "tmModReviews",
  saved_items: "tmModSavedItems",
  seller_permissions: "tmModSellerPermissions",
  settings: "tmModSettings",
  transfers: "tmModTransfers",
  visas: "tmModVisas",
};

function tmPretty(raw: string): string {
  return raw.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function tmRoleLabel(role: string | null | undefined, s: Record<CrmKey, string>): string {
  if (!role) return "—";
  const key = TEAM_ROLE_KEY[role];
  return key ? s[key] : tmPretty(role);
}

function TeamMemberDetail({
  row,
  companyId,
  token,
  lang,
  isSelf,
  busy,
  onBack,
  onEditPay,
  onToggleActive,
  onRemove,
  onChanged,
  showToast,
}: {
  row: CrmTeamRow;
  companyId: number;
  token: string;
  lang: string;
  isSelf: boolean;
  busy: boolean;
  onBack: () => void;
  onEditPay: () => void;
  onToggleActive: () => void;
  onRemove: () => void;
  onChanged: () => void;
  showToast: (msg: string) => void;
}) {
  const s = crmStrings(lang);
  const [tab, setTab] = useState<"profile" | "performance" | "pay" | "permissions">("profile");
  const inactive = row.user.status === "inactive";

  return (
    <div>
      <button className="btn btn-ghost detail-back" onClick={onBack}>
        <i className="ti ti-arrow-left" />{s.tmBackToTeam}
      </button>
      <div className="hero-card">
        <div className="hero-avatar">{initials(row.user.name)}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="hero-name">
            <span>{row.user.name}</span>
            <span className="badge badge-primary">{tmRoleLabel(row.user.role_name, s)}</span>
            <span className={`badge ${inactive ? "badge-warning" : "badge-success"}`}>
              {inactive ? s.teamStatusInactive : s.tmStatusActive}
            </span>
          </div>
          <div className="hero-meta">
            <span><i className="ti ti-mail" style={{ fontSize: 14 }} /> {row.user.email}</span>
            {row.user.phone ? (
              <span><i className="ti ti-phone" style={{ fontSize: 14 }} /> {row.user.phone}</span>
            ) : null}
          </div>
        </div>
        {!isSelf ? (
          <div className="hero-actions">
            <button className="btn" disabled={busy} onClick={onToggleActive}>
              <i className={inactive ? "ti ti-player-play" : "ti ti-player-pause"} />
              {inactive ? s.teamActReactivate : s.teamActDeactivate}
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={onRemove}>
              <i className="ti ti-trash" />
              {s.teamActRemove}
            </button>
          </div>
        ) : null}
      </div>

      <div className="sub-tabs">
        <button className={`sub-tab ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>{s.tmTabProfile}</button>
        <button className={`sub-tab ${tab === "performance" ? "active" : ""}`} onClick={() => setTab("performance")}>{s.tmTabPerformance}</button>
        <button className={`sub-tab ${tab === "pay" ? "active" : ""}`} onClick={() => setTab("pay")}>{s.tmTabPay}</button>
        <button className={`sub-tab ${tab === "permissions" ? "active" : ""}`} onClick={() => setTab("permissions")}>{s.tmTabPermissions}</button>
      </div>

      {tab === "profile" ? (
        <TeamProfileTab row={row} companyId={companyId} token={token} s={s} isSelf={isSelf} onChanged={onChanged} showToast={showToast} />
      ) : null}
      {tab === "performance" ? (
        <TeamPerformanceTab row={row} companyId={companyId} token={token} s={s} lang={lang} />
      ) : null}
      {tab === "pay" ? (
        <div className="card" style={{ maxWidth: 680 }}>
          <div className="card-header">
            <div>
              <div className="card-title">{s.tmPayTitle}</div>
              <div className="card-subtitle">{s.tmPaySub}</div>
            </div>
            <button className="btn btn-sm btn-primary" onClick={onEditPay}>
              <i className="ti ti-edit" />
              {row.compensation ? s.teamEditPay : s.teamSetPay}
            </button>
          </div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-row">
                <span className="info-label">{s.compFldModel}</span>
                <span className="info-value">
                  <span className="pay-pill">
                    {row.compensation ? s[TEAM_MODEL_KEY[row.compensation.model]] : s.teamPayNotSet}
                  </span>
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">{s.compFldBase}</span>
                <span className="info-value font-mono">
                  {row.compensation?.base_amount != null ? money(row.compensation.base_amount, row.pay_currency) : "—"}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">{s.compFldCommission}</span>
                <span className="info-value font-mono">
                  {row.compensation?.commission_percent != null ? `${row.compensation.commission_percent}%` : "—"}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">{s.compFldCurrency}</span>
                <span className="info-value">{row.pay_currency}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{s.tmComputedMo}</span>
                <span className="info-value font-mono" style={{ fontWeight: 600 }}>
                  {money(row.computed_pay, row.pay_currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {tab === "permissions" ? (
        <TeamPermissionsTab userId={row.user.id} companyId={companyId} token={token} s={s} showToast={showToast} />
      ) : null}
    </div>
  );
}

function TeamProfileTab({
  row,
  companyId,
  token,
  s,
  isSelf,
  onChanged,
  showToast,
}: {
  row: CrmTeamRow;
  companyId: number;
  token: string;
  s: Record<CrmKey, string>;
  isSelf: boolean;
  onChanged: () => void;
  showToast: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [roleDraft, setRoleDraft] = useState<CompanyEmployeeRole>(
    (TEAM_ROLE_OPTIONS as string[]).includes(row.user.role_name ?? "")
      ? (row.user.role_name as CompanyEmployeeRole)
      : "company_viewer"
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const saveRole = async () => {
    setSaving(true);
    setErr(null);
    try {
      await apiUpdateEmployeeRole(token, companyId, row.user.id, roleDraft);
      showToast(s.tmRoleSavedToast);
      setEditing(false);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSaving(false);
    }
  };

  const inactive = row.user.status === "inactive";

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="card-header">
        <div className="card-title">{s.tmTabProfile}</div>
        {!isSelf && !editing ? (
          <button className="btn btn-sm" onClick={() => setEditing(true)}>
            <i className="ti ti-edit" />{s.tmEditRole}
          </button>
        ) : null}
      </div>
      <div className="card-body">
        {err ? <div style={{ color: "var(--danger)", marginBottom: 10 }}>{err}</div> : null}
        <div className="info-grid">
          <div className="info-row"><span className="info-label">{s.tmFldName}</span><span className="info-value">{row.user.name}</span></div>
          <div className="info-row"><span className="info-label">{s.tmFldEmail}</span><span className="info-value">{row.user.email}</span></div>
          <div className="info-row"><span className="info-label">{s.tmFldPhone}</span><span className="info-value">{row.user.phone ?? "—"}</span></div>
          <div className="info-row">
            <span className="info-label">{s.tmFldRole}</span>
            <span className="info-value">
              {editing ? (
                <span className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                  <select value={roleDraft} onChange={(e) => setRoleDraft(e.target.value as CompanyEmployeeRole)} disabled={saving}>
                    {TEAM_ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{tmRoleLabel(r, s)}</option>
                    ))}
                  </select>
                  <button className="btn btn-sm btn-primary" disabled={saving} onClick={() => void saveRole()}>{s.save}</button>
                  <button className="btn btn-sm" disabled={saving} onClick={() => setEditing(false)}>{s.cancel}</button>
                </span>
              ) : (
                tmRoleLabel(row.user.role_name, s)
              )}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">{s.tmFldStatus}</span>
            <span className="info-value">
              <span className={`badge ${inactive ? "badge-warning" : "badge-success"}`}>
                {inactive ? s.teamStatusInactive : s.tmStatusActive}
              </span>
            </span>
          </div>
          <div className="info-row"><span className="info-label">{s.tmFldJoined}</span><span className="info-value">{fmtDate(row.user.joined_at)}</span></div>
          <div className="info-row"><span className="info-label">{s.tmFldLastLogin}</span><span className="info-value">{fmtDate(row.user.last_login_at)}</span></div>
        </div>
      </div>
    </div>
  );
}

function TeamPerformanceTab({
  row,
  companyId,
  token,
  s,
  lang,
}: {
  row: CrmTeamRow;
  companyId: number;
  token: string;
  s: Record<CrmKey, string>;
  lang: string;
}) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [periodRow, setPeriodRow] = useState<CrmTeamRow | null>(row);
  const [stats, setStats] = useState<CrmTeamMemberStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const monthOptions = useMemo(() => {
    // Month names come from our own dictionary — Intl silently falls back to
    // the OS locale (e.g. Russian) in browsers without Armenian ICU data.
    const out: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = s[`tmMonth${d.getMonth() + 1}` as CrmKey];
      out.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${monthName} ${d.getFullYear()}`,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Stat cards re-resolve from the team endpoint for the picked month.
  useEffect(() => {
    let stale = false;
    if (month === currentMonth) { setPeriodRow(row); return; }
    setPeriodRow(null);
    apiCrmTeam(token, { month, company_id: companyId })
      .then((res) => {
        if (stale) return;
        setPeriodRow(res.data.find((r) => r.user.id === row.user.id) ?? null);
      })
      .catch((e) => { if (!stale) setErr(e instanceof ApiRequestError ? e.message : s.errGeneric); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, row, token, companyId]);

  useEffect(() => {
    let stale = false;
    apiCrmTeamMemberStats(token, row.user.id, companyId)
      .then((res) => { if (!stale) setStats(res.data); })
      .catch((e) => { if (!stale) setErr(e instanceof ApiRequestError ? e.message : s.errGeneric); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, row.user.id, companyId]);

  const revenueLabel =
    periodRow == null
      ? "…"
      : periodRow.revenue_by_currency.length === 0
        ? "—"
        : periodRow.revenue_by_currency.map((rc) => money(rc.revenue, rc.currency)).join(" · ");
  const avgDeal = (() => {
    if (periodRow == null) return "…";
    const first = periodRow.revenue_by_currency[0];
    if (!first || periodRow.won_deals === 0) return "—";
    return money(first.revenue / periodRow.won_deals, first.currency);
  })();

  // The bar chart plots the employee's dominant deal currency.
  const chart = useMemo(() => {
    if (!stats) return null;
    const totals = new Map<string, number>();
    stats.monthly.forEach((m) => m.revenue.forEach((r) => totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.total)));
    let currency: string | null = null;
    let best = 0;
    totals.forEach((v, k) => { if (v > best) { best = v; currency = k; } });
    const bars = stats.monthly.map((m) => ({
      month: m.month,
      val: currency ? m.revenue.find((r) => r.currency === currency)?.total ?? 0 : 0,
    }));
    return { currency, bars, max: Math.max(...bars.map((b) => b.val), 1) };
  }, [stats]);

  return (
    <div>
      <div className="filter-card">
        <div className="filter-field" style={{ maxWidth: 220 }}>
          <span className="filter-label">{s.tmTabPerformance}</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {err ? <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div> : null}
      <div className="stat-grid">
        <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-shopping-cart" /></div><div className="stat-value">{periodRow ? periodRow.direct_orders ?? 0 : "…"}</div><div className="stat-label">{s.tmStatSales}</div></div>
        <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-trophy" /></div><div className="stat-value">{periodRow ? periodRow.won_deals : "…"}</div><div className="stat-label">{s.tmStatWon}</div></div>
        <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-coin" /></div><div className="stat-value" style={{ fontSize: 18 }}>{revenueLabel}</div><div className="stat-label">{s.tmStatRevenue}</div></div>
        <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-chart-line" /></div><div className="stat-value" style={{ fontSize: 18 }}>{avgDeal}</div><div className="stat-label">{s.tmStatAvgDeal}</div></div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">{s.tmRevenueOverTime}{chart?.currency ? ` · ${chart.currency}` : ""}</div></div>
        <div className="card-body">
          {chart === null ? (
            <span className="cell-muted">{s.loading}</span>
          ) : chart.currency === null ? (
            <span className="cell-muted">{s.agNoData}</span>
          ) : (
            <>
              <div className="barchart tall">
                {chart.bars.map((b) => (
                  <span
                    key={b.month}
                    className="bc-bar"
                    style={{ height: `${Math.max(3, Math.round((b.val / chart.max) * 100))}%` }}
                    title={`${b.month}: ${money(b.val, chart.currency ?? "USD")}`}
                  />
                ))}
              </div>
              <div className="bc-axis">
                <span>{chart.bars[0]?.month}</span>
                <span>{chart.bars[chart.bars.length - 1]?.month}</span>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="detail-card-grid">
        <div className="card">
          <div className="card-header"><div className="card-title">{s.agTopDestinations}</div></div>
          <div className="card-body">
            {stats === null ? (
              <span className="cell-muted">{s.loading}</span>
            ) : (
              <MiniBars rows={stats.destinations.map((d) => ({ name: d.name, val: d.bookings }))} empty={s.agNoData} />
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">{s.agByService}</div></div>
          <div className="card-body">
            {stats === null ? (
              <span className="cell-muted">{s.loading}</span>
            ) : (
              <MiniBars rows={stats.services.map((r) => ({ name: crmSvcLabel(r.type, s), val: r.bookings }))} empty={s.agNoData} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Same service-type labels the My-agents detail uses. */
function crmSvcLabel(type: string, s: Record<CrmKey, string>): string {
  const map: Record<string, string> = {
    flight: s.agSvcFlight,
    hotel: s.agSvcHotel,
    transfer: s.agSvcTransfer,
    car: s.agSvcCar,
    excursion: s.agSvcExcursion,
    visa: s.agSvcVisa,
    insurance: s.agSvcInsurance,
    package: s.agSvcPackage,
  };
  return map[type] ?? tmPretty(type);
}

function TeamPermissionsTab({
  userId,
  companyId,
  token,
  s,
  showToast,
}: {
  userId: number;
  companyId: number;
  token: string;
  s: Record<CrmKey, string>;
  showToast: (msg: string) => void;
}) {
  const [rows, setRows] = useState<EmployeePermissionRow[] | null>(null);
  const [draft, setDraft] = useState<Record<number, boolean>>({});
  const [canEdit, setCanEdit] = useState(true);
  const [twoFa, setTwoFa] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setErr(null);
    apiGetEmployeePermissions(token, companyId, userId)
      .then((res) => {
        setRows(res.data.permissions);
        setCanEdit(res.data.can_edit !== false);
        setTwoFa(res.data.user.two_factor_required);
        setDraft(Object.fromEntries(res.data.permissions.map((p) => [p.permission_id, p.granted])));
      })
      .catch((e) => setErr(e instanceof ApiRequestError ? e.message : s.errGeneric));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, companyId, userId]);
  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, EmployeePermissionRow[]>();
    (rows ?? []).forEach((r) => {
      const arr = map.get(r.module) ?? [];
      arr.push(r);
      map.set(r.module, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const dirtyCount = useMemo(
    () => (rows ?? []).reduce((n, r) => n + (draft[r.permission_id] !== r.granted ? 1 : 0), 0),
    [rows, draft]
  );

  const save = async () => {
    if (!rows) return;
    const payload = rows
      .filter((r) => draft[r.permission_id] !== r.granted)
      .map((r) => ({ permission_id: r.permission_id, granted: draft[r.permission_id] === true }));
    if (payload.length === 0) return;
    setSaving(true);
    setErr(null);
    try {
      await apiSyncEmployeePermissions(token, companyId, userId, payload);
      showToast(s.tmPermsSavedToast);
      load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSaving(false);
    }
  };

  const toggleTwoFa = async (next: boolean) => {
    const prev = twoFa;
    setTwoFa(next);
    try {
      await apiSetEmployeeTwoFactorPolicy(token, companyId, userId, next);
    } catch (e) {
      setTwoFa(prev);
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  };

  const moduleLabel = (m: string) => {
    const key = TM_MODULE_KEY[m];
    return key ? s[key] : tmPretty(m);
  };
  const actionLabel = (p: EmployeePermissionRow) => {
    const key = TM_ACTION_KEY[p.action ?? ""];
    return key ? s[key] : tmPretty(p.action || p.name);
  };

  return (
    <div className="card" style={{ maxWidth: 860 }}>
      <div className="card-header">
        <div>
          <div className="card-title">{s.tmTabPermissions}</div>
          <div className="card-subtitle">{canEdit ? s.tmPermsSub : s.tmPermsReadOnly}</div>
        </div>
        {canEdit ? (
          <button className="btn btn-sm btn-primary" disabled={saving || dirtyCount === 0} onClick={() => void save()}>
            <i className="ti ti-check" />
            {s.save}{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
          </button>
        ) : null}
      </div>
      <div className="card-body">
        {err ? <div style={{ color: "var(--danger)", marginBottom: 10 }}>{err}</div> : null}
        {twoFa !== null ? (
          <label className="switch-row" style={{ justifyContent: "space-between", paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid var(--border-color)" }}>
            <span>
              <span style={{ display: "block", fontWeight: 600 }}><i className="ti ti-shield-lock" /> {s.tmForce2fa}</span>
              <span className="text-sm cell-muted">{s.tmForce2faSub}</span>
            </span>
            <input type="checkbox" checked={twoFa} disabled={!canEdit} onChange={(e) => void toggleTwoFa(e.target.checked)} />
          </label>
        ) : null}
        {rows === null ? (
          <span className="cell-muted">{s.loading}</span>
        ) : rows.length === 0 ? (
          <span className="cell-muted">{s.tmPermsEmpty}</span>
        ) : (
          grouped.map(([moduleName, perms]) => (
            <div key={moduleName} style={{ marginBottom: 14 }}>
              <div className="section-label">{moduleLabel(moduleName)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 2 }}>
                {perms.map((p) => {
                  const checked = draft[p.permission_id] ?? p.granted;
                  const changed = checked !== p.granted;
                  return (
                    <label key={p.permission_id} className="switch-row" style={{ justifyContent: "space-between", padding: "4px 6px" }} title={p.name}>
                      <span style={changed ? { color: "var(--primary)", fontWeight: 600 } : undefined}>
                        {actionLabel(p)}
                        {!p.override && p.from_role ? (
                          <span className="text-sm cell-muted" style={{ marginLeft: 6 }}>· {s.tmFromRole}</span>
                        ) : null}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canEdit}
                        onChange={(e) => setDraft((d) => ({ ...d, [p.permission_id]: e.target.checked }))}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CompensationDrawer({
  row,
  companyId,
  lang,
  token,
  onClose,
  onSaved,
}: {
  row: CrmTeamRow | null;
  companyId: number | null;
  lang: string;
  token: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const s = crmStrings(lang);
  const [model, setModel] = useState<CrmCompModel>("fixed_plus_percent");
  const [base, setBase] = useState("0");
  const [percent, setPercent] = useState("0");
  const [currency, setCurrency] = useState("AMD");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!row) return;
    setModel(row.compensation?.model ?? "fixed_plus_percent");
    setBase(String(row.compensation?.base_amount ?? 0));
    setPercent(String(row.compensation?.commission_percent ?? 0));
    setCurrency(row.compensation?.currency ?? row.pay_currency ?? "AMD");
  }, [row]);

  async function submit() {
    if (!token || !row || companyId == null) return;
    setBusy(true);
    try {
      await apiSetCrmCompensation(token, row.user.id, {
        company_id: companyId,
        model,
        base_amount: Number(base) || 0,
        commission_percent: Number(percent) || 0,
        currency,
      });
      onSaved();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`drawer-overlay ${row ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${row ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div className="card-title">{s.compTitle}</div>
            <div className="card-subtitle">{row?.user.name ?? ""}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          <div className="fld mb-4">
            <span className="fld-label">{s.compFldModel}</span>
            <select value={model} onChange={(e) => setModel(e.target.value as CrmCompModel)}>
              <option value="fixed">{s.compModelFixedLong}</option>
              <option value="percent">{s.compModelPercentLong}</option>
              <option value="fixed_plus_percent">{s.compModelFixedPercentLong}</option>
            </select>
          </div>
          <div className="form-grid-2">
            <div className="fld">
              <span className="fld-label">{s.compFldBase}</span>
              <input type="number" value={base} disabled={model === "percent"} placeholder="0" onChange={(e) => setBase(e.target.value)} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.compFldCommission}</span>
              <input type="number" step="0.1" value={percent} disabled={model === "fixed"} placeholder="0" onChange={(e) => setPercent(e.target.value)} />
            </div>
          </div>
          <div className="fld" style={{ marginTop: 12 }}>
            <span className="fld-label">{s.compFldCurrency}</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {DEAL_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="drawer-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            <i className="ti ti-device-floppy" />
            {s.save}
          </button>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Options pane — per-company CRM settings (sale definition checklist)
// ════════════════════════════════════════════════════════════════
const OPT_STATUS_KEY: Record<string, CrmKey> = {
  pending_payment: "optStatusPendingPayment",
  paid: "optStatusPaid",
  confirmed: "optStatusConfirmed",
  completed: "optStatusCompleted",
  pending: "optStatusPending",
};

function OptionsPane({
  token,
  lang,
  showToast,
}: {
  token: string | null;
  lang: string;
  showToast: (msg: string) => void;
}) {
  const s = crmStrings(lang);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiCrmSettings(token, {});
      setCompanyId(res.data.company_id);
      setOptions(res.data.sales_status_options);
      setSelected(new Set(res.data.sales_count_statuses));
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const toggle = (status: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  async function save() {
    if (!token || companyId == null) return;
    if (selected.size === 0) {
      alert(s.optMinOne);
      return;
    }
    setSaving(true);
    try {
      const res = await apiUpdateCrmSettings(token, {
        company_id: companyId,
        sales_count_statuses: Array.from(selected),
      });
      setSelected(new Set(res.data.sales_count_statuses));
      showToast(s.optSavedToast);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSaving(false);
    }
  }

  if (companyId == null && !loading) {
    return (
      <div className="empty-state">
        <div className="es-icon"><i className="ti ti-adjustments" /></div>
        <div className="es-title">{s.pgOptions}</div>
        <div className="es-sub">{s.optNoCompany}</div>
      </div>
    );
  }

  return (
    <div>
      {err ? <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div> : null}
      <div className="card" style={{ maxWidth: 680 }}>
        <div className="card-header">
          <div>
            <div className="card-title">{s.optSaleDefTitle}</div>
            <div className="card-subtitle">{s.optSaleDefSubtitle}</div>
          </div>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {loading && options.length === 0 ? (
            <span className="cell-muted">{s.loading}</span>
          ) : (
            options.map((status) => {
              const k = OPT_STATUS_KEY[status];
              return (
                <label className="switch-row" key={status}>
                  <span className="switch">
                    <input type="checkbox" checked={selected.has(status)} onChange={() => toggle(status)} />
                    <span className="switch-slider" />
                  </span>
                  {k ? s[k] : status}
                </label>
              );
            })
          )}
        </div>
        <div className="card-foot">
          <button className="btn btn-primary" disabled={saving || selected.size === 0} onClick={() => void save()}>
            <i className="ti ti-check" />
            {s.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Work hours pane — time-off ledger (filter + table + create/edit modal)
// ════════════════════════════════════════════════════════════════
const TIMEOFF_TYPES = ["vacation", "sick", "personal", "unpaid", "other"] as const;
type TimeOffType = (typeof TIMEOFF_TYPES)[number];
type TimeOffStatus = "pending" | "approved" | "rejected" | "cancelled";

type TimeOffRow = {
  id: number;
  user: { id: number; name: string; email: string } | null;
  type: TimeOffType;
  starts_on: string | null;
  ends_on: string | null;
  hours_total: number | null;
  notes: string | null;
  status: TimeOffStatus;
  created_at: string | null;
};

const TIMEOFF_TYPE_KEY: Record<TimeOffType, CrmKey> = {
  vacation: "whTypeVacation",
  sick: "whTypeSick",
  personal: "whTypePersonal",
  unpaid: "whTypeUnpaid",
  other: "whTypeOther",
};
const TIMEOFF_TYPE_BADGE: Record<TimeOffType, string> = {
  vacation: "badge-info",
  sick: "badge-warning",
  personal: "badge-primary",
  unpaid: "badge-gray",
  other: "badge-gray",
};
const TIMEOFF_STATUS_KEY: Record<TimeOffStatus, CrmKey> = {
  pending: "whStatusPending",
  approved: "whStatusApproved",
  rejected: "whStatusRejected",
  cancelled: "whStatusCancelled",
};
const TIMEOFF_STATUS_BADGE: Record<TimeOffStatus, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  rejected: "badge-danger",
  cancelled: "badge-gray",
};

function monthString(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type WorkHoursModalState = { mode: "create" } | { mode: "edit"; row: TimeOffRow } | null;

function WorkHoursPane({
  token,
  lang,
  registerAction,
  showToast,
}: PaneProps & { user: TeamUser | null }) {
  const s = crmStrings(lang);
  const [rows, setRows] = useState<TimeOffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [month, setMonth] = useState(monthString());
  const [modal, setModal] = useState<WorkHoursModalState>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetchJson<ApiSuccessEnvelope<TimeOffRow[]> & { meta: ApiListMeta }>(
        `/time-off?per_page=200`,
        { method: "GET", token }
      );
      setRows(res.data);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    registerAction(
      <button className="btn btn-primary" onClick={() => setModal({ mode: "create" })}>
        <i className="ti ti-plus" />
        {s.whAddEntry}
      </button>
    );
    return () => registerAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const employees = useMemo(() => {
    const m = new Map<number, string>();
    rows.forEach((r) => { if (r.user) m.set(r.user.id, r.user.name); });
    return Array.from(m.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (employeeFilter && String(r.user?.id ?? "") !== employeeFilter) return false;
      if (typeFilter && r.type !== typeFilter) return false;
      if (month) {
        const ref = r.starts_on ?? r.created_at;
        if (!ref || ref.slice(0, 7) !== month) return false;
      }
      return true;
    });
  }, [rows, employeeFilter, typeFilter, month]);

  async function decide(row: TimeOffRow, status: "approved" | "rejected") {
    if (!token) return;
    const msg = status === "approved" ? s.whConfirmApprove : s.whConfirmReject;
    if (typeof window !== "undefined" && !window.confirm(msg)) return;
    setBusy(true);
    try {
      await apiFetchJson(`/time-off/${row.id}/decide`, { method: "PATCH", token, body: { status } });
      showToast(status === "approved" ? s.whApprovedToast : s.whRejectedToast);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: TimeOffRow) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.whConfirmDelete)) return;
    setBusy(true);
    try {
      await apiFetchJson(`/time-off/${row.id}/decide`, { method: "PATCH", token, body: { status: "cancelled" } });
      showToast(s.whDeletedToast);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.whFilterEmployee}</span>
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
            <option value="">{s.whEmployeeAll}</option>
            {employees.map(([id, name]) => (
              <option key={id} value={String(id)}>{name}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.whFilterType}</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">{s.whTypeAll}</option>
            {TIMEOFF_TYPES.map((t) => (
              <option key={t} value={t}>{s[TIMEOFF_TYPE_KEY[t]]}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.whFilterMonth}</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        {/* 2026-06-10 (roadmap §2 bug 4) — was labeled "Apply", but the three
            filters are live client-side (filtered useMemo); the button's real
            effect is re-fetching the list. Label it honestly as a refresh. */}
        <button className="btn btn-primary" onClick={() => void load()}>
          <i className="ti ti-refresh" />
          {s.refresh}
        </button>
      </div>

      {err ? <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div> : null}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.whColEmployee}</th>
                <th>{s.whColType}</th>
                <th>{s.whColDate}</th>
                <th className="num-cell">{s.whColHours}</th>
                <th>{s.whColNote}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.whEmpty}</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} onClick={() => setModal({ mode: "edit", row: r })}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className={`avatar sm ${avatarTone(r.user?.id ?? r.id)}`}>{initials(r.user?.name)}</span>
                        {r.user?.name ?? s.none}
                      </span>
                    </td>
                    <td><span className={`badge ${TIMEOFF_TYPE_BADGE[r.type] ?? "badge-gray"}`}>{s[TIMEOFF_TYPE_KEY[r.type]]}</span></td>
                    <td className="cell-muted">{fmtDate(r.starts_on)}</td>
                    <td className="num-cell font-mono">{r.hours_total ?? "—"}</td>
                    <td className="cell-muted">
                      <span className={`badge ${TIMEOFF_STATUS_BADGE[r.status]}`} style={{ marginRight: 6 }}>
                        {s[TIMEOFF_STATUS_KEY[r.status]]}
                      </span>
                      {r.notes ?? ""}
                    </td>
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        {r.status === "pending" ? (
                          <>
                            <button className="icon-btn" title={s.whApprove} disabled={busy} onClick={() => void decide(r, "approved")}>
                              <i className="ti ti-check" />
                            </button>
                            <button className="icon-btn" title={s.whReject} disabled={busy} onClick={() => void decide(r, "rejected")}>
                              <i className="ti ti-x" />
                            </button>
                          </>
                        ) : null}
                        <button className="icon-btn danger" title={s.delete} disabled={busy} onClick={() => void remove(r)}>
                          <i className="ti ti-trash" />
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

      <WorkHoursModal
        state={modal}
        lang={lang}
        token={token}
        onClose={() => setModal(null)}
        onSaved={() => { setModal(null); showToast(s.whSavedToast); void load(); }}
      />
    </div>
  );
}

function WorkHoursModal({
  state,
  lang,
  token,
  onClose,
  onSaved,
}: {
  state: WorkHoursModalState;
  lang: string;
  token: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const s = crmStrings(lang);
  const isEdit = state?.mode === "edit";
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<TimeOffType>("vacation");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    setErr(null);
    if (state.mode === "edit") {
      setUserId(state.row.user ? String(state.row.user.id) : "");
      setType(state.row.type);
      setStarts(state.row.starts_on ? state.row.starts_on.slice(0, 10) : "");
      setEnds(state.row.ends_on ? state.row.ends_on.slice(0, 10) : "");
      setHours(state.row.hours_total != null ? String(state.row.hours_total) : "");
      setNote(state.row.notes ?? "");
    } else {
      setUserId("");
      setType("vacation");
      setStarts("");
      setEnds("");
      setHours("");
      setNote("");
    }
  }, [state]);

  async function submit() {
    if (!token || !state) return;
    if (!starts || !ends) { setErr(s.whErrDates); return; }
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        type,
        starts_on: starts,
        ends_on: ends,
        notes: note.trim() || null,
      };
      if (hours.trim()) body.hours_total = Number(hours);
      if (state.mode === "edit") {
        // Edit existing row → PATCH /time-off/{id}. The backend ignores user_id
        // on update (a row's owner is fixed at creation), so it's omitted here.
        await apiFetchJson(`/time-off/${state.row.id}`, { method: "PATCH", token, body });
      } else {
        // Create flow → POST /time-off. user_id may target another employee.
        if (userId.trim()) body.user_id = Number(userId);
        await apiFetchJson(`/time-off`, { method: "POST", token, body });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`modal-overlay ${state ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? s.whModalEditTitle : s.whModalTitle}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          {err ? <div className="card" style={{ padding: 12, marginBottom: 12, color: "var(--danger)" }}>{err}</div> : null}
          {/* The employee field is fixed once a row exists (the backend ties a
              time-off entry to its owner at creation and ignores user_id on
              update), so it stays disabled in edit mode. All other fields are
              editable and persisted via PATCH /time-off/{id}. */}
          <div className="fld mb-3">
            <span className="fld-label">{s.whFldEmployee}</span>
            <input type="number" min={1} value={userId} placeholder="—" disabled={isEdit} onChange={(e) => setUserId(e.target.value)} />
            <span className="fld-hint">{s.whFldEmployeeHint}</span>
          </div>
          <div className="form-grid-2">
            <div className="fld">
              <span className="fld-label">{s.whFldType}</span>
              <select value={type} onChange={(e) => setType(e.target.value as TimeOffType)}>
                {TIMEOFF_TYPES.map((t) => (
                  <option key={t} value={t}>{s[TIMEOFF_TYPE_KEY[t]]}</option>
                ))}
              </select>
            </div>
            <div className="fld">
              <span className="fld-label">{s.whFldHours}</span>
              <input type="number" step="0.5" min="0" value={hours} placeholder="8" onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>
          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div className="fld">
              <span className="fld-label">{s.whFldStarts}</span>
              <input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.whFldEnds}</span>
              <input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
            </div>
          </div>
          <div className="fld" style={{ marginTop: 12 }}>
            <span className="fld-label">{s.whFldNote}</span>
            <input value={note} placeholder={s.whFldNotePh} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            <i className="ti ti-device-floppy" />
            {s.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Payroll pane — month selector + stat cards + table + breakdown drawer
// ════════════════════════════════════════════════════════════════
type PayrollStatus = "draft" | "finalized" | "paid";
type PayrollRow = {
  id: number;
  user: { id: number; name: string; email: string } | null;
  period_start: string | null;
  period_end: string | null;
  base_salary: number;
  hours_worked: number | null;
  hourly_rate: number | null;
  commission_amount: number;
  bonus_amount: number;
  deductions_amount: number;
  gross_pay: number;
  net_pay: number;
  currency: string;
  status: PayrollStatus;
  paid_at: string | null;
  notes: string | null;
};

const PAYROLL_STATUS_KEY: Record<PayrollStatus, CrmKey> = {
  draft: "prStatusDraft",
  finalized: "prStatusFinalized",
  paid: "prStatusPaid",
};
const PAYROLL_STATUS_BADGE: Record<PayrollStatus, string> = {
  draft: "badge-gray",
  finalized: "badge-info",
  paid: "badge-success",
};

function PayrollPane({ token, lang, registerAction, showToast }: PaneProps) {
  const s = crmStrings(lang);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [month, setMonth] = useState(monthString());
  const [drawer, setDrawer] = useState<PayrollRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetchJson<ApiSuccessEnvelope<PayrollRow[]> & { meta: ApiListMeta }>(
        `/payroll?per_page=200`,
        { method: "GET", token }
      );
      setRows(res.data);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!month) return true;
      const ref = r.period_start ?? r.period_end;
      return !!ref && ref.slice(0, 7) === month;
    });
  }, [rows, month]);

  async function exportBatch() {
    if (!token) return;
    try {
      const base = (process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am").replace(/\/$/, "");
      const res = await fetch(`${base}/payroll/bank-batch?status=finalized`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new ApiRequestError(`HTTP ${res.status}`, res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll-batch-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(s.prExportedToast);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }

  async function finalizeMonth() {
    if (!token) return;
    const drafts = filtered.filter((r) => r.status === "draft");
    if (drafts.length === 0) { alert(s.prNoDraftsToFinalize); return; }
    if (typeof window !== "undefined" && !window.confirm(s.prConfirmFinalize)) return;
    setBusy(true);
    try {
      for (const r of drafts) {
        await apiFetchJson(`/payroll/${r.id}/status`, { method: "PATCH", token, body: { status: "finalized" } });
      }
      showToast(s.prFinalizedToast);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(row: PayrollRow, status: PayrollStatus) {
    if (!token) return;
    if (status === "paid" && typeof window !== "undefined" && !window.confirm(s.prConfirmPaid)) return;
    setBusy(true);
    try {
      await apiFetchJson(`/payroll/${row.id}/status`, { method: "PATCH", token, body: { status } });
      showToast(status === "paid" ? s.prPaidToast : s.prFinalizedToast);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    registerAction(
      <>
        <button className="btn" onClick={() => void exportBatch()}>
          <i className="ti ti-file-export" />
          {s.prActExport}
        </button>
        <button className="btn" onClick={() => setAddOpen(true)}>
          <i className="ti ti-plus" />
          {s.prActAddRecord}
        </button>
        <button className="btn btn-primary" disabled={busy} onClick={() => void finalizeMonth()}>
          <i className="ti ti-lock" />
          {s.prActFinalize}
        </button>
      </>
    );
    return () => registerAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, busy, filtered]);

  // header stats
  const currency = filtered[0]?.currency ?? "AMD";
  const totalPay = filtered.reduce((acc, r) => acc + r.net_pay, 0);
  const totalCommission = filtered.reduce((acc, r) => acc + r.commission_amount, 0);
  const employeeCount = new Set(filtered.map((r) => r.user?.id ?? r.id)).size;
  const monthStatus = useMemo<CrmKey>(() => {
    if (filtered.length === 0) return "prMonthDraft";
    const statuses = new Set(filtered.map((r) => r.status));
    if (statuses.size === 1) {
      const only = filtered[0]!.status;
      return only === "paid" ? "prMonthPaid" : only === "finalized" ? "prMonthFinalized" : "prMonthDraft";
    }
    return "prMonthMixed";
  }, [filtered]);

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card c-primary">
          <div className="stat-header"><i className="ti ti-cash" /></div>
          <div className="stat-value" style={{ fontSize: 20 }}>{money(totalPay, currency)}</div>
          <div className="stat-label">{s.prStatTotal}</div>
        </div>
        <div className="stat-card c-info">
          <div className="stat-header"><i className="ti ti-users-group" /></div>
          <div className="stat-value">{employeeCount}</div>
          <div className="stat-label">{s.prStatEmployees}</div>
        </div>
        <div className="stat-card c-success">
          <div className="stat-header"><i className="ti ti-percentage" /></div>
          <div className="stat-value" style={{ fontSize: 20 }}>{money(totalCommission, currency)}</div>
          <div className="stat-label">{s.prStatCommission}</div>
        </div>
        <div className="stat-card c-warning">
          <div className="stat-header"><i className="ti ti-file-pencil" /></div>
          <div className="stat-value" style={{ fontSize: 20 }}>{s[monthStatus]}</div>
          <div className="stat-label">{s.prStatMonthStatus}</div>
        </div>
      </div>

      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.prFilterMonth}</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => void load()}>
          <i className="ti ti-filter" />
          {s.apply}
        </button>
      </div>

      {err ? <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div> : null}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.prColEmployee}</th>
                <th className="num-cell">{s.prColBase}</th>
                <th className="num-cell">{s.prColCommission}</th>
                <th className="num-cell">{s.prColTotal}</th>
                <th>{s.prColStatus}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.prEmpty}</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} onClick={() => setDrawer(r)}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className={`avatar sm ${avatarTone(r.user?.id ?? r.id)}`}>{initials(r.user?.name)}</span>
                        {r.user?.name ?? s.none}
                      </span>
                    </td>
                    <td className="num-cell font-mono">{money(r.base_salary, r.currency)}</td>
                    <td className="num-cell font-mono">{money(r.commission_amount, r.currency)}</td>
                    <td className="num-cell font-mono">{money(r.net_pay, r.currency)}</td>
                    <td><span className={`badge ${PAYROLL_STATUS_BADGE[r.status]}`}>{s[PAYROLL_STATUS_KEY[r.status]]}</span></td>
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => setDrawer(r)}>
                          <i className="ti ti-eye" />
                          {s.prBreakdown}
                        </button>
                        {r.status === "draft" ? (
                          <button className="btn btn-sm" disabled={busy} onClick={() => void changeStatus(r, "finalized")}>
                            {s.prFinalize}
                          </button>
                        ) : null}
                        {r.status === "finalized" ? (
                          <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => void changeStatus(r, "paid")}>
                            {s.prMarkPaid}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PayrollDrawer row={drawer} lang={lang} onClose={() => setDrawer(null)} />
      <PayrollAddModal
        open={addOpen}
        lang={lang}
        token={token}
        onClose={() => setAddOpen(false)}
        onSaved={() => { setAddOpen(false); showToast(s.whSavedToast); void load(); }}
      />
    </div>
  );
}

function PayrollDrawer({ row, lang, onClose }: { row: PayrollRow | null; lang: string; onClose: () => void }) {
  const s = crmStrings(lang);
  return (
    <>
      <div className={`drawer-overlay ${row ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${row ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div className="card-title">{s.prDrawerTitle}</div>
            <div className="card-subtitle">
              {row?.user?.name ?? ""}
              {row?.period_start ? ` · ${fmtDate(row.period_start)} → ${fmtDate(row.period_end)}` : ""}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          {row ? (
            <div className="info-grid">
              <div className="info-row">
                <span className="info-label">{s.prBdBase}</span>
                <span className="info-value font-mono">{money(row.base_salary, row.currency)}</span>
              </div>
              {row.hours_worked != null && row.hourly_rate != null ? (
                <div className="info-row">
                  <span className="info-label">{s.prBdHourly}</span>
                  <span className="info-value font-mono">{`${row.hours_worked} × ${money(row.hourly_rate, row.currency)}`}</span>
                </div>
              ) : null}
              <div className="info-row">
                <span className="info-label">{s.prBdCommission}</span>
                <span className="info-value font-mono">{money(row.commission_amount, row.currency)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{s.prBdBonus}</span>
                <span className="info-value font-mono">{money(row.bonus_amount, row.currency)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{s.prBdGross}</span>
                <span className="info-value font-mono">{money(row.gross_pay, row.currency)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{s.prBdAdjustments}</span>
                <span className="info-value font-mono">{money(row.deductions_amount, row.currency)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{s.prBdTotal}</span>
                <span className="info-value font-mono" style={{ fontWeight: 600 }}>{money(row.net_pay, row.currency)}</span>
              </div>
            </div>
          ) : null}
        </div>
        <div className="drawer-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
        </div>
      </div>
    </>
  );
}

function PayrollAddModal({
  open,
  lang,
  token,
  onClose,
  onSaved,
}: {
  open: boolean;
  lang: string;
  token: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const s = crmStrings(lang);
  const [form, setForm] = useState({
    user_id: "",
    period_start: "",
    period_end: "",
    base_salary: "0",
    hours_worked: "",
    hourly_rate: "",
    commission_amount: "0",
    bonus_amount: "0",
    deductions_amount: "0",
    currency: "AMD",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setErr(null);
      setForm({
        user_id: "", period_start: "", period_end: "", base_salary: "0",
        hours_worked: "", hourly_rate: "", commission_amount: "0", bonus_amount: "0",
        deductions_amount: "0", currency: "AMD", notes: "",
      });
    }
  }, [open]);

  async function submit() {
    if (!token) return;
    if (!form.user_id.trim() || !form.period_start || !form.period_end) { setErr(s.prmErr); return; }
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        user_id: Number(form.user_id),
        period_start: form.period_start,
        period_end: form.period_end,
        base_salary: Number(form.base_salary) || 0,
        commission_amount: Number(form.commission_amount) || 0,
        bonus_amount: Number(form.bonus_amount) || 0,
        deductions_amount: Number(form.deductions_amount) || 0,
        currency: form.currency.trim().toUpperCase() || "AMD",
        notes: form.notes.trim() || null,
      };
      if (form.hours_worked.trim()) body.hours_worked = Number(form.hours_worked);
      if (form.hourly_rate.trim()) body.hourly_rate = Number(form.hourly_rate);
      await apiFetchJson(`/payroll`, { method: "POST", token, body });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`modal-overlay ${open ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal lg">
        <div className="modal-header">
          <div className="modal-title">{s.prmTitle}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          {err ? <div className="card" style={{ padding: 12, marginBottom: 12, color: "var(--danger)" }}>{err}</div> : null}
          <div className="form-grid-2">
            <div className="fld">
              <span className="fld-label">{s.prmUser}</span>
              <input type="number" min={1} value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.prmCurrency}</span>
              <input maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.prmPeriodStart}</span>
              <input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.prmPeriodEnd}</span>
              <input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.prmBase}</span>
              <input type="number" step="0.01" min="0" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.prmCommission}</span>
              <input type="number" step="0.01" min="0" value={form.commission_amount} onChange={(e) => setForm({ ...form, commission_amount: e.target.value })} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.prmHours}</span>
              <input type="number" step="0.01" min="0" value={form.hours_worked} onChange={(e) => setForm({ ...form, hours_worked: e.target.value })} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.prmRate}</span>
              <input type="number" step="0.01" min="0" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.prmBonus}</span>
              <input type="number" step="0.01" min="0" value={form.bonus_amount} onChange={(e) => setForm({ ...form, bonus_amount: e.target.value })} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.prmDeductions}</span>
              <input type="number" step="0.01" min="0" value={form.deductions_amount} onChange={(e) => setForm({ ...form, deductions_amount: e.target.value })} />
            </div>
          </div>
          <div className="fld" style={{ marginTop: 12 }}>
            <span className="fld-label">{s.prmNote}</span>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            <i className="ti ti-device-floppy" />
            {s.prmCreate}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Contracts pane — role-routed list + in-pane detail + new-contract modal
// ════════════════════════════════════════════════════════════════
type TermObj = Record<string, unknown> | null | undefined;

function fmtContractCommission(cc: TermObj, none: string): string {
  if (!cc || cc.value == null) return none;
  const v = String(cc.value);
  return cc.type === "percent" ? `${v}%` : v;
}
function fmtContractPayment(pt: TermObj, s: Record<CrmKey, string>): string {
  if (!pt) return s.none;
  const collector =
    pt.collector === "operator" || pt.collector === "partner" ? s.ctCollectorPartner : s.ctCollectorPlatform;
  const days = pt.t_plus_days != null ? ` · T+${String(pt.t_plus_days)}` : "";
  return `${collector}${days}`;
}
function fmtContractCancellation(cp: TermObj, s: Record<CrmKey, string>): string {
  if (!cp) return s.none;
  const parts: string[] = [];
  if (cp.notice_days != null) parts.push(`${String(cp.notice_days)} ${s.ctNoticeDays}`);
  if (cp.fee_percent != null) parts.push(`${String(cp.fee_percent)}%`);
  return parts.length ? parts.join(" · ") : s.none;
}
function fmtContractSignature(sig: TermObj, key: "party_a" | "party_b", none: string): string {
  if (!sig) return none;
  const entry = sig[key] as Record<string, unknown> | undefined;
  if (!entry) return none;
  const name = entry.name != null ? String(entry.name) : "";
  const at = entry.signed_at != null ? fmtDateTime(String(entry.signed_at)) : "";
  return [name, at].filter(Boolean).join(" · ") || none;
}
function fmtContractBody(rb: TermObj): string {
  if (!rb) return "";
  if (typeof rb.text === "string") return rb.text;
  if (typeof rb.body === "string") return rb.body;
  try { return JSON.stringify(rb, null, 2); } catch { return ""; }
}

const CONTRACT_DETAIL_TABS: Array<{ key: "overview" | "document" | "signatures" | "history"; labelKey: CrmKey }> = [
  { key: "overview", labelKey: "ctTabOverview" },
  { key: "document", labelKey: "ctTabDocument" },
  { key: "signatures", labelKey: "ctTabSignatures" },
  { key: "history", labelKey: "ctTabHistory" },
];

function ContractsPane({
  token,
  user,
  lang,
  registerAction,
  showToast,
}: PaneProps & { user: TeamUser | null }) {
  const s = crmStrings(lang);
  const isAdmin = !!(user?.is_super_admin || canAccessPlatformAdminNav(user));
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      if (isAdmin) {
        const res = await apiAdminContracts(token, {
          per_page: 200,
          status: (statusFilter || "") as ContractStatus | "",
          q: search || undefined,
          template_id: templateFilter || undefined,
        });
        setRows(res.data);
      } else {
        const res = await apiSellerContracts(token);
        setRows(res.data);
      }
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin, statusFilter, templateFilter, search]);
  useEffect(() => { void load(); }, [load]);

  // top-right action: New contract (admin only — sellers cannot create)
  useEffect(() => {
    if (!isAdmin || detailId != null) { registerAction(null); return; }
    registerAction(
      <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
        <i className="ti ti-plus" />
        {s.actNewContract}
      </button>
    );
    return () => registerAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, isAdmin, detailId]);

  // Template dropdown options — super/platform path only (apiSellerContracts
  // has no template_id param, so sellers never see the dropdown).
  const [templateOptions, setTemplateOptions] = useState<ContractTemplateRow[]>([]);
  useEffect(() => {
    if (!token || !isAdmin) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiAdminContractTemplates(token, { per_page: 200 });
        if (!cancelled) setTemplateOptions(res.data);
      } catch {
        // non-fatal — the dropdown just stays empty
      }
    })();
    return () => { cancelled = true; };
  }, [token, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (!isAdmin && statusFilter && r.status !== statusFilter) return false;
      if (!isAdmin && q) {
        const hay = `${r.contract_number} ${r.partyA?.name ?? ""} ${r.partyB?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, isAdmin, statusFilter, search]);

  if (detailId != null) {
    return (
      <ContractDetailView
        token={token}
        isAdmin={isAdmin}
        contractId={detailId}
        lang={lang}
        showToast={showToast}
        onBack={() => { setDetailId(null); void load(); }}
      />
    );
  }

  // stats
  const total = rows.length;
  const signed = rows.filter((r) => r.status === "active" || r.status === "countersigned").length;
  const drafts = rows.filter((r) => r.status === "draft").length;
  const now = new Date();
  const expiring = rows.filter((r) => {
    if (!r.expiry_date) return false;
    const diff = (new Date(r.expiry_date).getTime() - now.getTime()) / 86_400_000;
    return diff > 0 && diff <= 30;
  }).length;

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card c-primary">
          <div className="stat-header"><i className="ti ti-file-text" /></div>
          <div className="stat-value">{total}</div>
          <div className="stat-label">{s.ctStatTotal}</div>
        </div>
        <div className="stat-card c-success">
          <div className="stat-header"><i className="ti ti-signature" /></div>
          <div className="stat-value">{signed}</div>
          <div className="stat-label">{s.ctStatSigned}</div>
        </div>
        <div className="stat-card c-warning">
          <div className="stat-header"><i className="ti ti-pencil" /></div>
          <div className="stat-value">{drafts}</div>
          <div className="stat-label">{s.ctStatDraft}</div>
        </div>
        <div className="stat-card c-danger">
          <div className="stat-header"><i className="ti ti-calendar-x" /></div>
          <div className="stat-value">{expiring}</div>
          <div className="stat-label">{s.ctStatExpiring}</div>
        </div>
      </div>

      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input
            type="search"
            placeholder={s.ctSearchPh}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput.trim())}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.status}</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{s.allStages}</option>
            <option value="draft">{s.ctStatusDraft}</option>
            <option value="sent">{s.ctStatusSent}</option>
            <option value="countersigned">{s.ctStatusCountersigned}</option>
            <option value="active">{s.ctStatusActive}</option>
            <option value="expired">{s.ctStatusExpired}</option>
            <option value="terminated">{s.ctStatusTerminated}</option>
          </select>
        </div>
        {isAdmin ? (
          <div className="filter-field">
            <span className="filter-label">{s.ctFilterTemplate}</span>
            <select value={templateFilter} onChange={(e) => setTemplateFilter(e.target.value)}>
              <option value="">{s.ctTemplateAll}</option>
              {templateOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        ) : null}
        <button className="btn btn-primary" onClick={() => setSearch(searchInput.trim())}>
          <i className="ti ti-filter" />
          {s.apply}
        </button>
      </div>

      {err ? <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div> : null}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.ctColNumber}</th>
                <th>{s.ctColType}</th>
                <th>{s.ctColParty}</th>
                <th>{s.ctColTemplate}</th>
                <th>{s.ctColStatus}</th>
                <th>{s.ctColEffective}</th>
                <th>{s.ctColExpires}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{isAdmin ? s.ctEmpty : s.ctEmptySeller}</td></tr>
              ) : (
                filtered.map((r) => {
                  const party = r.partyB?.name ?? r.partyA?.name ?? `Company #${r.party_b_company_id}`;
                  return (
                    <tr key={r.id} onClick={() => setDetailId(r.id)}>
                      <td className="font-mono">{r.contract_number}</td>
                      <td><span className="type-badge">{r.type === "platform" ? s.ctTypePlatform : s.ctTypePartner}</span></td>
                      <td className="font-semibold">{party}</td>
                      <td className="cell-muted">{r.template?.name ?? s.none}</td>
                      <td><span className={`badge ${CONTRACT_STATUS_BADGE[r.status] ?? "badge-gray"}`}>{s[CONTRACT_STATUS_KEY[r.status]]}</span></td>
                      <td className="cell-muted">{fmtDate(r.effective_date)}</td>
                      <td className="cell-muted">{fmtDate(r.expiry_date)}</td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button className="icon-btn" title={s.ctView} onClick={() => setDetailId(r.id)}>
                            <i className="ti ti-eye" />
                          </button>
                          <button
                            className="icon-btn"
                            title={s.ctActDownloadPdf}
                            onClick={() => {
                              if (r.signed_pdf_url) window.open(r.signed_pdf_url, "_blank");
                              else showToast(s.ctActDownloadPdf);
                            }}
                          >
                            <i className="ti ti-download" />
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

      {isAdmin ? (
        <NewContractModal
          open={newOpen}
          token={token}
          lang={lang}
          onClose={() => setNewOpen(false)}
          onCreated={() => { setNewOpen(false); showToast(s.ctCreatedToast); void load(); }}
        />
      ) : null}
    </div>
  );
}

function ContractDetailView({
  token,
  isAdmin,
  contractId,
  lang,
  showToast,
  onBack,
}: {
  token: string | null;
  isAdmin: boolean;
  contractId: string;
  lang: string;
  showToast: (msg: string) => void;
  onBack: () => void;
}) {
  const s = crmStrings(lang);
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "document" | "signatures" | "history">("overview");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = isAdmin
        ? await apiAdminContract(token, contractId)
        : await apiSellerContract(token, contractId);
      setDetail(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 404) setErr(s.ctNotAvailable);
      else setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin, contractId]);
  useEffect(() => { void load(); }, [load]);

  const d = detail;

  async function doAction(kind: "send" | "countersign" | "sign" | "terminate") {
    if (!token || !d) return;
    const confirms: Record<typeof kind, string> = {
      send: s.ctConfirmSend,
      countersign: s.ctConfirmCountersign,
      sign: s.ctConfirmSign,
      terminate: s.ctConfirmTerminate,
    };
    if (typeof window !== "undefined" && !window.confirm(confirms[kind])) return;
    let reason = "";
    if (kind === "terminate") {
      reason = (typeof window !== "undefined" && window.prompt(s.ctTerminateReasonPrompt)) || "";
      if (!reason) return;
    }
    setBusy(true);
    try {
      if (kind === "send") { await apiAdminSendContract(token, d.id); showToast(s.ctSentToast); }
      else if (kind === "countersign") { await apiAdminCountersignContract(token, d.id); showToast(s.ctCountersignedToast); }
      else if (kind === "sign") { await apiSellerSignContract(token, d.id); showToast(s.ctSignedToast); }
      else { await apiAdminTerminateContract(token, d.id, reason); showToast(s.ctTerminatedToast); }
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  const sellerCanSign = !isAdmin && (d?.status === "sent" || d?.status === "signed_by_a");
  const hasSignatures = d?.signatures && Object.keys(d.signatures).length > 0;

  return (
    <div>
      <button className="btn btn-ghost detail-back" onClick={onBack}>
        <i className="ti ti-arrow-left" />
        {s.ctBackToList}
      </button>

      {err ? <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div> : null}

      <div className="detail-head">
        <div className="detail-logo">CT</div>
        <div>
          <div className="detail-title">
            <span className="font-mono">{d?.contract_number ?? (loading ? s.loading : s.none)}</span>
            {d ? <span className={`badge ${CONTRACT_STATUS_BADGE[d.status] ?? "badge-gray"}`}>{s[CONTRACT_STATUS_KEY[d.status]]}</span> : null}
          </div>
          <div className="detail-meta">
            <span>{d?.type === "platform" ? s.ctPlatformContract : s.ctPartnerContract}</span>
            <span>·</span>
            <span>{s.ctPartyLabel}: <strong>{d?.partyB?.name ?? d?.partyA?.name ?? s.none}</strong></span>
          </div>
        </div>
        <div className="detail-head-right">
          <button className="btn" disabled={!d?.signed_pdf_url} onClick={() => d?.signed_pdf_url && window.open(d.signed_pdf_url, "_blank")}>
            <i className="ti ti-download" />
            {s.ctActDownloadPdf}
          </button>
        </div>
      </div>

      <div className="sub-tabs">
        {CONTRACT_DETAIL_TABS.map((t) => (
          <button key={t.key} className={`sub-tab ct-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {s[t.labelKey]}
          </button>
        ))}
      </div>

      {/* overview */}
      {tab === "overview" ? (
        <div className="detail-card-grid">
          <div className="card">
            <div className="card-header"><div className="card-title">{s.ctParties}</div></div>
            <div className="card-body">
              <div className="info-grid">
                <div className="info-row"><span className="info-label">{s.ctPartyA}</span><span className="info-value">{d?.partyA?.name ?? "ZULU Platform"}</span></div>
                <div className="info-row"><span className="info-label">{s.ctPartyB}</span><span className="info-value">{d?.partyB?.name ?? (d ? `Company #${d.party_b_company_id}` : s.none)}</span></div>
                <div className="info-row"><span className="info-label">{s.ctLanguage}</span><span className="info-value" style={{ textTransform: "uppercase" }}>{d?.language ?? s.none}</span></div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">{s.ctTerms}</div></div>
            <div className="card-body">
              <div className="info-grid">
                <div className="info-row"><span className="info-label">{s.ctCommission}</span><span className="info-value">{fmtContractCommission(d?.commission_clause, s.none)}</span></div>
                <div className="info-row"><span className="info-label">{s.ctWhoCollects}</span><span className="info-value">{fmtContractPayment(d?.payment_terms, s)}</span></div>
                <div className="info-row"><span className="info-label">{s.ctCancellation}</span><span className="info-value">{fmtContractCancellation(d?.cancellation_policy, s)}</span></div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">{s.ctSchedule}</div></div>
            <div className="card-body">
              <div className="info-grid">
                <div className="info-row"><span className="info-label">{s.ctEffective}</span><span className="info-value">{fmtDate(d?.effective_date)}</span></div>
                <div className="info-row"><span className="info-label">{s.ctExpires}</span><span className="info-value">{fmtDate(d?.expiry_date)}</span></div>
                <div className="info-row">
                  <span className="info-label">{s.ctAutoRenew}</span>
                  <span className="info-value">
                    {d?.auto_renew ? s.yes : s.no}
                    {d?.termination_notice_days ? ` · ${d.termination_notice_days} ${s.ctNoticeDays}` : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* document */}
      {tab === "document" ? (
        <div className="card">
          <div className="card-header">
            <div className="card-title">{s.ctRenderedBody}</div>
            <button className="btn btn-sm" disabled={!d?.signed_pdf_url} onClick={() => d?.signed_pdf_url && window.open(d.signed_pdf_url, "_blank")}>
              <i className="ti ti-download" />PDF
            </button>
          </div>
          <div className="card-body">
            {d?.rendered_body && fmtContractBody(d.rendered_body) ? (
              <div className="code-block">{fmtContractBody(d.rendered_body)}</div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.ctNoBody}</p>
            )}
          </div>
        </div>
      ) : null}

      {/* signatures */}
      {tab === "signatures" ? (
        <div className="card">
          <div className="card-header"><div className="card-title">{s.ctSignaturesTitle}</div></div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-row wide"><span className="info-label">{s.ctSignedA}</span><span className="info-value">{hasSignatures ? fmtContractSignature(d!.signatures, "party_a", s.ctNotSigned) : s.ctNotSigned}</span></div>
              <div className="info-row wide"><span className="info-label">{s.ctSignedB}</span><span className="info-value">{hasSignatures ? fmtContractSignature(d!.signatures, "party_b", s.ctNotSigned) : s.ctNotSigned}</span></div>
              <div className="info-row wide">
                <span className="info-label">{s.ctSignStatus}</span>
                <span className="info-value">{d ? <span className={`badge ${CONTRACT_STATUS_BADGE[d.status] ?? "badge-gray"}`}>{s[CONTRACT_STATUS_KEY[d.status]]}</span> : s.none}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* history */}
      {tab === "history" ? (
        <div className="card">
          <div className="card-header"><div className="card-title">{s.ctVersionHistory}</div></div>
          <div className="card-body">
            {d?.versions && d.versions.length > 0 ? (
              <div className="timeline">
                {d.versions.map((v, i) => (
                  <div className={`tl-item ${i === 0 ? "active" : "done"}`} key={v.id}>
                    <span className="tl-dot" />
                    <div className="tl-title">v{v.version_number}</div>
                    <div className="tl-time">{v.created_at ? fmtDateTime(v.created_at) : ""}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.ctNoHistory}</p>
            )}
          </div>
        </div>
      ) : null}

      {/* sticky actions */}
      <div className="sticky-actions">
        {isAdmin ? (
          <>
            <button className="btn" disabled={busy || !d || d.status !== "draft"} onClick={() => void doAction("send")}>
              <i className="ti ti-send" />{s.ctActSend}
            </button>
            <button className="btn" disabled={busy || !d || (d.status !== "signed_by_a" && d.status !== "signed_by_b")} onClick={() => void doAction("countersign")}>
              <i className="ti ti-writing-sign" />{s.ctActCountersign}
            </button>
            <span className="spacer" />
            <button className="btn btn-danger" disabled={busy || !d || d.status === "terminated" || d.status === "expired"} onClick={() => void doAction("terminate")}>
              <i className="ti ti-ban" />{s.ctActTerminate}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary" disabled={busy || !sellerCanSign} onClick={() => void doAction("sign")}>
              <i className="ti ti-writing-sign" />{s.ctActSign}
            </button>
            <span className="spacer" />
          </>
        )}
        <button className="btn btn-primary" disabled={!d?.signed_pdf_url} onClick={() => d?.signed_pdf_url && window.open(d.signed_pdf_url, "_blank")}>
          <i className="ti ti-download" />{s.ctActDownloadPdf}
        </button>
      </div>
    </div>
  );
}

function NewContractModal({
  open,
  token,
  lang,
  onClose,
  onCreated,
}: {
  open: boolean;
  token: string | null;
  lang: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const s = crmStrings(lang);
  const [templates, setTemplates] = useState<ContractTemplateRow[]>([]);
  const [companies, setCompanies] = useState<CompanyListRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    template_id: "",
    party_b_company_id: "",
    language: "en" as ContractLanguage,
    commission_type: "percent" as "percent" | "amount",
    commission_value: "",
    payment_collector: "platform" as "platform" | "operator",
    payment_days: "7",
    cancellation_notice_days: "30",
    cancellation_fee_percent: "",
    effective_date: "",
    expiry_date: "",
    auto_renew: true,
    termination_notice_days: "30",
  });

  useEffect(() => {
    if (!open || !token) return;
    setErr(null);
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
      } catch { /* options best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [open, token]);

  async function submit() {
    if (!token) return;
    if (!form.template_id) { setErr(s.ctmErrTemplate); return; }
    if (!form.party_b_company_id) { setErr(s.ctmErrPartyB); return; }
    const commissionNumeric = form.commission_value.trim() === "" ? null : Number(form.commission_value);
    const paymentDaysNumeric = form.payment_days.trim() === "" ? null : Number(form.payment_days);
    const cancelDaysNumeric = form.cancellation_notice_days.trim() === "" ? null : Number(form.cancellation_notice_days);
    const cancelFeeNumeric = form.cancellation_fee_percent.trim() === "" ? null : Number(form.cancellation_fee_percent);
    const commission: Record<string, unknown> = commissionNumeric === null ? {} : { type: form.commission_type, value: commissionNumeric };
    const payment: Record<string, unknown> = paymentDaysNumeric === null
      ? { collector: form.payment_collector }
      : { collector: form.payment_collector, t_plus_days: paymentDaysNumeric };
    const cancellation: Record<string, unknown> = {};
    if (cancelDaysNumeric !== null) cancellation.notice_days = cancelDaysNumeric;
    if (cancelFeeNumeric !== null) cancellation.fee_percent = cancelFeeNumeric;

    setSaving(true);
    setErr(null);
    try {
      await apiAdminCreateContract(token, {
        template_id: form.template_id,
        party_a_company_id: null,
        party_b_company_id: Number(form.party_b_company_id),
        language: form.language,
        effective_date: form.effective_date || null,
        expiry_date: form.expiry_date || null,
        auto_renew: form.auto_renew,
        termination_notice_days: form.termination_notice_days ? Number(form.termination_notice_days) : undefined,
        commission_clause: commission,
        payment_terms: payment,
        cancellation_policy: cancellation,
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`modal-overlay ${open ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal lg">
        <div className="modal-header">
          <div className="modal-title">{s.actNewContract}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          {err ? <div className="card" style={{ padding: 12, marginBottom: 12, color: "var(--danger)" }}>{err}</div> : null}

          <div className="modal-section-label">{s.ctmPartiesTemplate}</div>
          <div className="form-grid-2">
            <div className="fld">
              <span className="fld-label">{s.ctmTemplate}</span>
              <select value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}>
                <option value="">{s.ctmPickTemplate}</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.language.toUpperCase()})</option>
                ))}
              </select>
            </div>
            <div className="fld">
              <span className="fld-label">{s.ctmLanguage}</span>
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as ContractLanguage })}>
                {CONTRACT_LANGUAGES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <div className="fld" style={{ marginTop: 12 }}>
            <span className="fld-label">{s.ctmPartyB}</span>
            <select value={form.party_b_company_id} onChange={(e) => setForm({ ...form, party_b_company_id: e.target.value })}>
              <option value="">{s.ctmPickCompany}</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name ?? `Company #${c.id}`}</option>)}
            </select>
          </div>

          <div className="modal-section-label">{s.ctmTermsLabel}</div>
          <div className="form-grid-2">
            <div className="fld">
              <span className="fld-label">{s.ctmCommissionType}</span>
              <select value={form.commission_type} onChange={(e) => setForm({ ...form, commission_type: e.target.value as "percent" | "amount" })}>
                <option value="percent">{s.ctmPercent}</option>
                <option value="amount">{s.ctmAmount}</option>
              </select>
            </div>
            <div className="fld">
              <span className="fld-label">{s.ctmCommission}</span>
              <input type="number" placeholder={s.ctmCommissionPh} value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.ctmPaymentCollector}</span>
              <select value={form.payment_collector} onChange={(e) => setForm({ ...form, payment_collector: e.target.value as "platform" | "operator" })}>
                <option value="platform">{s.ctCollectorPlatform}</option>
                <option value="operator">{s.ctCollectorPartner}</option>
              </select>
            </div>
            <div className="fld">
              <span className="fld-label">{s.ctmPaymentDays}</span>
              <input type="number" value={form.payment_days} onChange={(e) => setForm({ ...form, payment_days: e.target.value })} />
            </div>
          </div>
          <div className="fld" style={{ marginTop: 12 }}>
            <span className="fld-label">{s.ctmCancellation}</span>
            <input type="number" value={form.cancellation_notice_days} onChange={(e) => setForm({ ...form, cancellation_notice_days: e.target.value })} />
          </div>

          <div className="modal-section-label">{s.ctmScheduleLabel}</div>
          <div className="form-grid-2">
            <div className="fld">
              <span className="fld-label">{s.ctmEffective}</span>
              <input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.ctmExpiry}</span>
              <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
            <label className="switch">
              <input type="checkbox" checked={form.auto_renew} onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })} />
              <span className="switch-slider" />
            </label>
            <span className="text-sm">{s.ctmAutoRenew}</span>
            <div className="fld" style={{ marginLeft: "auto", maxWidth: 200 }}>
              <span className="fld-label">{s.ctmTerminationNotice}</span>
              <input type="number" value={form.termination_notice_days} onChange={(e) => setForm({ ...form, termination_notice_days: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={saving} onClick={() => void submit()}>
            <i className="ti ti-plus" />
            {s.ctmCreateDraft}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Files pane — folder rail + storage bar + folder grid + files table
// ════════════════════════════════════════════════════════════════
type FilesQuick = "all" | "recent" | "trash";

const FILE_ICO_CLASS: Record<string, string> = {
  pdf: "pdf",
  image: "img",
  application: "doc",
  text: "doc",
  video: "img",
  audio: "sheet",
  other: "doc",
};
function fileIcoClass(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/svg+xml") return "svg";
  if (mime.startsWith("image/")) return "img";
  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    mime === "text/csv"
  ) return "sheet";
  return FILE_ICO_CLASS[mimeBucket(mime)] ?? "doc";
}
function fileIcoIcon(mime: string): string {
  if (mime === "application/pdf") return "ti-file-type-pdf";
  if (mime.startsWith("image/")) return mime === "image/svg+xml" ? "ti-file-vector" : "ti-photo";
  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    mime === "text/csv"
  ) return "ti-file-spreadsheet";
  return "ti-file";
}

function FilesPane({
  token,
  user,
  lang,
  registerAction,
  showToast,
}: PaneProps & { user: TeamUser | null }) {
  const s = crmStrings(lang);
  const [folder, setFolder] = useState("/");
  const [files, setFiles] = useState<FileAssetRow[]>([]);
  const [subfolders, setSubfolders] = useState<FolderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<FilesQuick>("all");
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileAssetRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFolder = useCallback(async (target: string) => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFilesList(token, { folder: target });
      setFiles(res.data.files);
      setSubfolders(res.data.subfolders);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
      setFiles([]);
      setSubfolders([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFilesStorageStats(token);
      setStats(res.data);
    } catch { /* non-fatal */ }
  }, [token]);

  useEffect(() => { void loadFolder(folder); }, [folder, loadFolder]);
  useEffect(() => { void loadStats(); }, [loadStats]);

  const handleUpload = useCallback(async (selected: FileList | null) => {
    if (!selected || selected.length === 0 || !token) return;
    setUploading(true);
    setErr(null);
    try {
      let count = 0;
      for (const file of Array.from(selected)) {
        await apiFilesUpload(token, file, { folder, visibility: "private" });
        count++;
      }
      showToast(count === 1 ? s.flUploadedToast : `${count} ${s.flUploadedManyToast}`);
      await loadFolder(folder);
      await loadStats();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, folder, loadFolder, loadStats, lang]);

  const handleNewFolder = useCallback(async () => {
    if (!token) return;
    const name = window.prompt(s.flFolderPrompt);
    if (!name) return;
    const safe = name.trim().replace(/[/\\]/g, "_").replace(/^\.+/, "");
    if (!safe) return;
    const target = folder === "/" ? `/${safe}` : `${folder}/${safe}`;
    try {
      await apiFilesCreateFolder(token, target, { visibility: "private" });
      showToast(s.flNewFolderToast);
      await loadFolder(folder);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, folder, loadFolder, lang]);

  // top-right actions
  useEffect(() => {
    registerAction(
      <>
        <button className="btn" onClick={() => void handleNewFolder()}>
          <i className="ti ti-folder-plus" />
          {s.flNewFolder}
        </button>
        <button className="btn btn-primary" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          <i className="ti ti-upload" />
          {uploading ? s.flUploading : s.flUpload}
        </button>
      </>
    );
    return () => registerAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, uploading, handleNewFolder]);

  const visibleFiles = useMemo(() => {
    let arr = files;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((f) => f.filename.toLowerCase().includes(q));
    }
    if (quick === "recent") {
      arr = [...arr].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, 20);
    }
    return arr;
  }, [files, search, quick]);

  async function handleFileClick(asset: FileAssetRow) {
    if (!isPreviewableImage(asset.mime_type)) {
      if (!token) return;
      try { await apiFilesDownload(token, asset); } catch (e) { setErr(e instanceof ApiRequestError ? e.message : s.errGeneric); }
      return;
    }
    if (!token) return;
    setPreviewFile(asset);
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const objectUrl = await apiFilesObjectUrl(token, asset);
      setPreviewUrl(objectUrl);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
      setPreviewFile(null);
    } finally {
      setPreviewLoading(false);
    }
  }
  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
    setPreviewLoading(false);
  }

  async function handleDelete(asset: FileAssetRow) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(`${s.flConfirmDeleteFile}\n\n${asset.filename}`)) return;
    try {
      await apiFilesDelete(token, asset.id);
      showToast(s.flDeletedToast);
      await loadFolder(folder);
      await loadStats();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }
  async function handleDeleteFolder(sub: FolderSummary) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(`${s.flConfirmDeleteFolder}\n\n${sub.name}`)) return;
    try {
      await apiFilesDeleteFolder(token, sub.folder);
      showToast(s.flFolderDeletedToast);
      await loadFolder(folder);
      await loadStats();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }
  async function handleDownload(asset: FileAssetRow) {
    if (!token) return;
    try { await apiFilesDownload(token, asset); } catch (e) { setErr(e instanceof ApiRequestError ? e.message : s.errGeneric); }
  }

  const folderCrumbs = useMemo(() => {
    if (folder === "/") return [{ label: s.flMyFiles, path: "/" }];
    const segs = folder.split("/").filter(Boolean);
    return [
      { label: s.flMyFiles, path: "/" },
      ...segs.map((seg, i) => ({ label: seg, path: "/" + segs.slice(0, i + 1).join("/") })),
    ];
  }, [folder, s.flMyFiles]);

  const storagePct = stats && stats.quota_bytes > 0
    ? Math.min(100, Math.round((stats.total_bytes / stats.quota_bytes) * 100))
    : 0;

  function ownerLabel(uploadedBy: number): string {
    if (user?.id && uploadedBy === user.id) return s.flOwnerYou;
    return `#${uploadedBy}`;
  }

  return (
    <div>
      {err ? <div className="card" style={{ padding: 16, marginBottom: 16, color: "var(--danger)" }}>{err}</div> : null}
      <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => void handleUpload(e.target.files)} />

      <div className="fm-layout">
        {/* left rail */}
        <div className="fm-rail">
          <div className="fm-nav">
            <div
              className={`fm-nav-item ${quick === "all" ? "active" : ""}`}
              onClick={() => { setQuick("all"); setFolder("/"); }}
            >
              <i className="ti ti-folder" />{s.flMyFiles}
              {stats ? <span className="fm-nav-count">{stats.total_count}</span> : null}
            </div>
            <div className={`fm-nav-item ${quick === "recent" ? "active" : ""}`} onClick={() => setQuick("recent")}>
              <i className="ti ti-clock" />{s.flRecent}
            </div>
            <div className={`fm-nav-item ${quick === "trash" ? "active" : ""}`} onClick={() => setQuick("trash")}>
              <i className="ti ti-trash" />{s.flTrash}
            </div>
          </div>
          <div className="fm-storage">
            <div className="fm-storage-title"><i className="ti ti-database" />{s.flStorage}</div>
            <div className="storage-bar"><span style={{ width: `${storagePct}%` }} /></div>
            <div className="fm-storage-used">
              {stats
                ? `${formatBytes(stats.total_bytes)} ${s.flStorageUsed} ${formatBytes(stats.quota_bytes)} ${s.flStorageUsedSuffix}`
                : s.loading}
            </div>
            {stats ? (
              <div className="fm-legend">
                <div className="fm-legend-row"><span className="ldot doc" />{`Documents · ${formatBytes(stats.by_bucket.application?.bytes ?? 0)}`}</div>
                <div className="fm-legend-row"><span className="ldot img" />{`Images · ${formatBytes(stats.by_bucket.image?.bytes ?? 0)}`}</div>
                <div className="fm-legend-row"><span className="ldot video" />{`Video · ${formatBytes(stats.by_bucket.video?.bytes ?? 0)}`}</div>
                <div className="fm-legend-row"><span className="ldot other" />{`Other · ${formatBytes(stats.by_bucket.other?.bytes ?? 0)}`}</div>
              </div>
            ) : null}
          </div>
        </div>

        {/* main */}
        <div className="fm-main">
          <div className="fm-bar">
            <div className="fm-crumb">
              <i className="ti ti-home" style={{ fontSize: 14 }} />
              {folderCrumbs.map((c, i) => (
                <span key={c.path} className="flex items-center gap-2">
                  {i > 0 ? <i className="ti ti-chevron-right" /> : null}
                  <a onClick={() => setFolder(c.path)}>{c.label}</a>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="fm-search">
                <i className="ti ti-search" />
                <input type="search" placeholder={s.flSearchPh} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

          {quick === "all" && subfolders.length > 0 ? (
            <>
              <div className="fm-sec-label">{s.flFolders}</div>
              <div className="fm-folders">
                {subfolders.map((f) => (
                  <div className="fm-folder" key={f.folder} onClick={() => setFolder(f.folder)}>
                    <i className="ti ti-folder-filled fm-folder-ic" />
                    <div>
                      <div className="ff-name">{f.name}</div>
                      <div className="ff-meta">{`${f.file_count} ${s.flCount} · ${formatBytes(f.total_bytes)}`}</div>
                    </div>
                    <button className="icon-btn ff-menu danger" title={s.flDeleteFolder} onClick={(e) => { e.stopPropagation(); void handleDeleteFolder(f); }}>
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <div className="fm-sec-label">{s.flFiles}</div>
          <div className="card">
            {quick === "trash" ? (
              <div className="empty-state" style={{ border: "none" }}>
                <div className="es-icon"><i className="ti ti-trash" /></div>
                <div className="es-title">{s.flTrashEmpty}</div>
                <div className="es-sub">{s.flTrashHint}</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{s.flColName}</th>
                      <th>{s.flColOwner}</th>
                      <th className="num-cell">{s.flColSize}</th>
                      <th>{s.flColModified}</th>
                      <th style={{ textAlign: "right" }}>{s.colActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && files.length === 0 ? (
                      <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
                    ) : visibleFiles.length === 0 ? (
                      <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.flEmpty}</td></tr>
                    ) : (
                      visibleFiles.map((file) => (
                        <tr key={file.id} onClick={() => void handleFileClick(file)}>
                          <td>
                            <span className="flex items-center gap-2">
                              <span className={`file-ico ${fileIcoClass(file.mime_type)}`}><i className={`ti ${fileIcoIcon(file.mime_type)}`} /></span>
                              {file.filename}
                            </span>
                          </td>
                          <td className="cell-muted">{ownerLabel(file.uploaded_by)}</td>
                          <td className="num-cell font-mono">{formatBytes(file.size_bytes)}</td>
                          <td className="cell-muted">{fmtDate(file.created_at)}</td>
                          <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                            <div className="row-actions">
                              <button className="icon-btn" title={s.flDownload} onClick={() => void handleDownload(file)}>
                                <i className="ti ti-download" />
                              </button>
                              <button className="icon-btn danger" title={s.flDelete} onClick={() => void handleDelete(file)}>
                                <i className="ti ti-trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* image preview lightbox */}
      {previewFile ? (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && closePreview()}>
          <div className="modal lg">
            <div className="modal-header">
              <div className="modal-title">{previewFile.filename}</div>
              <button className="icon-btn" onClick={closePreview}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 240 }}>
              {previewLoading ? (
                <span className="cell-muted">{s.flLoadingPreview}</span>
              ) : previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={previewFile.filename} style={{ maxHeight: "70vh", maxWidth: "100%", objectFit: "contain", borderRadius: 8 }} />
              ) : null}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => void handleDownload(previewFile)}>
                <i className="ti ti-download" />
                {s.flDownload}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
