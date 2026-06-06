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
 * Options (all wired to the real CrmController endpoints), plus Leads/Segments
 * (coming-soon). Contracts / Work hours / Payroll / Files still navigate out to
 * their own routes until ported.
 *
 * Every user-facing string is routed through crm-i18n.ts (crmStrings(lang)).
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import "../platform/management/management.css";
import { Sidebar, Header } from "../platform/management/MgmtPage";
import { crmStrings, type CrmKey } from "./crm-i18n";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessNotificationsNav, canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";
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
  type CrmCompModel,
} from "@/lib/crm-api";
import { apiCrmCustomers, type CustomerRow } from "@/lib/customers-api";
import { apiShowPlatformUser, type PlatformAdminUserDetail } from "@/lib/platform-admin-api";
import { apiBookings, type BookingRow } from "@/lib/bookings-api";
import { AddEmployeeModal } from "@/components/employees/AddEmployeeModal";

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

type ClusterKey = "sales" | "people" | "work" | "options";
export type CrmPageKey =
  | "pipeline" | "leads" | "deals" | "activities" | "segments"
  | "customers" | "team"
  | "contracts" | "workhours" | "payroll" | "files"
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
    deals:      { cluster: "sales",   labelKey: "pgDeals",      subKey: "subDeals",      inPage: true,  href: "/crm/deals" },
    activities: { cluster: "sales",   labelKey: "pgActivities", subKey: "subActivities", inPage: true,  href: "/crm/activities" },
    segments:   { cluster: "sales",   labelKey: "pgSegments",   subKey: "subSegments",   inPage: true,  href: "/crm/segments" },
    customers:  { cluster: "people",  labelKey: "pgCustomers",  subKey: "subCustomers",  inPage: true,  href: "/crm/customers" },
    team:       { cluster: "people",  labelKey: "pgTeam",       subKey: "subTeam",       inPage: true,  href: "/crm/team" },
    contracts:  { cluster: "work",    labelKey: "pgContracts",  subKey: "subContracts",  inPage: false, href: contractsHref },
    workhours:  { cluster: "work",    labelKey: "pgWorkhours",  subKey: "subWorkhours",  inPage: false, href: "/bucket3/non-service-hours" },
    payroll:    { cluster: "work",    labelKey: "pgPayroll",    subKey: "subPayroll",    inPage: false, href: "/bucket3/payroll" },
    files:      { cluster: "work",    labelKey: "pgFiles",      subKey: "subFiles",      inPage: false, href: "/admin-redesign/files" },
    options:    { cluster: "options", labelKey: "pgOptions",    subKey: "subOptions",    inPage: true,  href: "/crm/options" },
  }), [contractsHref]);
  // NOTE: options.inPage stays false in PAGES only as a fallback href; the pane
  // IS rendered in-page below. The route /crm/options renders <CrmPage> too.

  const PAGES_BY_CLUSTER = useMemo(() => {
    const m: Record<ClusterKey, CrmPageKey[]> = { sales: [], people: [], work: [], options: [] };
    (Object.keys(PAGES) as CrmPageKey[]).forEach((k) => m[PAGES[k].cluster].push(k));
    return m;
  }, [PAGES]);

  const [page, setPage] = useState<CrmPageKey>(initialPage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  // In-page → swap pane + sync URL; otherwise navigate to the existing route.
  const showPage = useCallback(
    (key: CrmPageKey) => {
      const m = PAGES[key];
      if (m.inPage || key === "options") {
        setActionNode(null);
        setPage(key);
        if (typeof window !== "undefined" && m.href) {
          window.history.replaceState(window.history.state, "", m.href);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (m.href) {
        router.push(m.href);
      }
    },
    [PAGES, router]
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
      <div className={`layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <Sidebar collapsed={sidebarCollapsed} unreadCount={unreadCount} />
        <div className="main">
          <Header
            collapsed={sidebarCollapsed}
            onHamburger={() => setSidebarCollapsed((v) => !v)}
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
              {PAGES_BY_CLUSTER[activeCluster].map((k) => (
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
              <ComingSoonPane icon="ti-user-plus" title={s.pgLeads} sub={s.subLeads} />
            )}
            {page === "deals" && (
              <DealsPane token={token} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "activities" && (
              <ActivitiesPane token={token} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "segments" && (
              <ComingSoonPane icon="ti-chart-dots" title={s.pgSegments} sub={s.subSegments} />
            )}
            {page === "customers" && (
              <CustomersPane token={token} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "team" && (
              <TeamPane token={token} user={user} lang={lang} registerAction={setActionNode} showToast={showToast} />
            )}
            {page === "options" && <OptionsPane token={token} lang={lang} showToast={showToast} />}
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
// Pipeline (kanban) — real deals grouped client-side by stage
// ════════════════════════════════════════════════════════════════
const KANBAN_STAGES: CrmDealStage[] = ["new", "qualified", "proposal", "won", "lost"];
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

  return (
    <>
      <div className="alert">
        <i className="ti ti-info-circle" />
        <div>
          {s.pipeAlert}{" "}
          <strong>
            {s.pipeAlertEmphasis} <span className="font-mono">crm.view_all</span>.
          </strong>
        </div>
      </div>
      {err ? (
        <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div>
      ) : !loading && deals.length === 0 ? (
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
              <div className="kanban-col" key={st}>
                <div className="kanban-col-head">
                  <span className="kanban-col-title">
                    <span className={`kdot ${st}`} />
                    {s[STAGE_LABEL_KEY[st]]}
                  </span>
                  <span className="kanban-count">{cards.length}</span>
                </div>
                <div className="kanban-body">
                  {cards.map((d) => (
                    <div className="deal-card" key={d.id}>
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
const CHIP_STAGES: Array<CrmDealStage | "all"> = ["all", "new", "qualified", "proposal", "won", "lost"];

type PaneProps = {
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

  const activeCount = rows.filter((c) => c.status === "active").length;
  const withBookings = rows.filter((c) => c.bookings_count > 0).length;

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
          <div className="stat-value">{rows.length}</div>
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
          <button className="btn"><i className="ti ti-mail" />{s.cuHeroEmail}</button>
          <button className="btn"><i className="ti ti-message" />{s.cuHeroMessage}</button>
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

type TeamUser = NonNullable<ReturnType<typeof useAdminAuth>["user"]>;

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
                    <tr key={r.user.id} onClick={() => setEditRow(r)}>
                      <td>
                        <span className="flex items-center gap-2">
                          <span className={`avatar sm ${avatarTone(r.user.id)}`}>{initials(r.user.name)}</span>
                          <span>
                            <div className="font-semibold">{r.user.name}</div>
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
                        <div className="row-actions">
                          <button className="btn btn-sm" onClick={() => setEditRow(r)}>
                            <i className="ti ti-edit" />
                            {r.compensation ? s.teamEditPay : s.teamSetPay}
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
// Coming-soon empty state (Leads / Segments)
// ════════════════════════════════════════════════════════════════
function ComingSoonPane({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="empty-state">
      <div className="es-icon">
        <i className={`ti ${icon}`} />
      </div>
      <div className="es-title">{title}</div>
      <div className="es-sub">{sub}</div>
    </div>
  );
}
