"use client";

/**
 * admin v3 — unified CRM surface. Port of docs/admin_designe/7-crm/4_crm.html:
 * a two-level (cluster → page) navigation over the 12 CRM tabs, rendered in the
 * same self-contained chrome as Management/Settings (sidebar + header reused
 * from MgmtPage).
 *
 * Incremental migration (mirrors SettingsPage): a page is either rendered IN-PAGE
 * (new unified design) or, until migrated, its pill NAVIGATES to the existing
 * working route. As each wired page is ported into a pane, flip its `inPage` to
 * true and add its route to MGMT_PREFIXES in app/(admin)/layout.tsx.
 *
 * Stage 1 (2026-06-07): Pipeline (kanban) / Leads / Segments render in-page; the
 * already-wired panes (Deals, Activities, Customers, Team, Contracts, Work hours,
 * Payroll, Files, Options) navigate to their existing routes so nothing regresses.
 *
 * CRM tab labels stay English to match the other admin section strips (Arshak).
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../platform/management/management.css";
import { Sidebar, Header } from "../platform/management/MgmtPage";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessNotificationsNav, canAccessPlatformAdminNav } from "@/lib/access";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";

type ClusterKey = "sales" | "people" | "work" | "options";
export type CrmPageKey =
  | "pipeline" | "leads" | "deals" | "activities" | "segments"
  | "customers" | "team"
  | "contracts" | "workhours" | "payroll" | "files"
  | "options";

type CrmMeta = { cluster: ClusterKey; label: string; subtitle: string; inPage: boolean; href: string };

const CLUSTERS: Array<{ key: ClusterKey; label: string; icon: string }> = [
  { key: "sales", label: "Sales", icon: "ti-businessplan" },
  { key: "people", label: "People", icon: "ti-users" },
  { key: "work", label: "Work", icon: "ti-briefcase" },
  { key: "options", label: "Options", icon: "ti-adjustments" },
];
const CLUSTER_LABEL: Record<ClusterKey, string> = { sales: "Sales", people: "People", work: "Work", options: "Options" };

export function CrmPage({ initialPage = "pipeline" }: { initialPage?: CrmPageKey }) {
  const router = useRouter();
  const { token, user, logout } = useAdminAuth();
  const { lang, setLang, languageOptions } = useLanguage();

  // Contracts is role-routed (Option A): super → all companies; operator/agent → own.
  const contractsHref = useMemo(() => {
    if (user?.is_super_admin || canAccessPlatformAdminNav(user)) return "/platform/contracts";
    if (user?.roles?.includes("agent")) return "/agent/contracts";
    return "/operator/contracts";
  }, [user]);

  const PAGES: Record<CrmPageKey, CrmMeta> = useMemo(() => ({
    pipeline:   { cluster: "sales",   label: "Pipeline",   subtitle: "Your deals by stage.",                          inPage: true,  href: "/crm/pipeline" },
    leads:      { cluster: "sales",   label: "Leads",      subtitle: "Incoming leads.",                               inPage: true,  href: "/crm/leads" },
    deals:      { cluster: "sales",   label: "Deals",      subtitle: "Sales deals.",                                  inPage: false, href: "/crm/deals" },
    activities: { cluster: "sales",   label: "Activities", subtitle: "Interaction log (calls, meetings, notes).",     inPage: false, href: "/crm/activities" },
    segments:   { cluster: "sales",   label: "Segments",   subtitle: "Customer segments.",                            inPage: true,  href: "/crm/segments" },
    customers:  { cluster: "people",  label: "Customers",  subtitle: "Customers who booked through you.",             inPage: false, href: "/crm/customers" },
    team:       { cluster: "people",  label: "Team",       subtitle: "Your employees — sales performance & pay.",     inPage: false, href: "/crm/team" },
    contracts:  { cluster: "work",    label: "Contracts",  subtitle: "Your legal agreements.",                        inPage: false, href: contractsHref },
    workhours:  { cluster: "work",    label: "Work hours", subtitle: "Employee shifts and time off.",                 inPage: false, href: "/bucket3/non-service-hours" },
    payroll:    { cluster: "work",    label: "Payroll",    subtitle: "Monthly payroll ledger.",                       inPage: false, href: "/bucket3/payroll" },
    files:      { cluster: "work",    label: "Files",      subtitle: "Store contracts, payment receipts, and documents.", inPage: false, href: "/admin-redesign/files" },
    options:    { cluster: "options", label: "Options",    subtitle: "CRM settings for your company.",                inPage: false, href: "/crm/options" },
  }), [contractsHref]);

  const PAGES_BY_CLUSTER = useMemo(() => {
    const m: Record<ClusterKey, CrmPageKey[]> = { sales: [], people: [], work: [], options: [] };
    (Object.keys(PAGES) as CrmPageKey[]).forEach((k) => m[PAGES[k].cluster].push(k));
    return m;
  }, [PAGES]);

  const [page, setPage] = useState<CrmPageKey>(initialPage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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
      if (m.inPage) {
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
                  <a onClick={() => router.push("/dashboard")}>Home</a>
                  <i className="ti ti-chevron-right" />
                  <span>{CLUSTER_LABEL[activeCluster]}</span>
                  <i className="ti ti-chevron-right" />
                  <span className="breadcrumb-current">{meta.label}</span>
                </div>
                <h1 className="page-title">
                  <span>{meta.label}</span>
                  {isSuper && (
                    <span className="super-tag">
                      <i className="ti ti-shield-lock" style={{ fontSize: 13 }} />
                      Super admin
                    </span>
                  )}
                </h1>
                {meta.subtitle ? <div className="page-subtitle">{meta.subtitle}</div> : null}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }} id="action-slot" />
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
                  {c.label}
                </button>
              ))}
            </div>

            {/* Level 2 — page pills for the active cluster */}
            <div className="pills-row">
              {PAGES_BY_CLUSTER[activeCluster].map((k) => (
                <button
                  key={k}
                  className={`sub-tab ${k === page ? "active" : ""}`}
                  onClick={() => showPage(k)}
                >
                  {PAGES[k].label}
                </button>
              ))}
            </div>

            {/* In-page panes (Stage 1) */}
            {page === "pipeline" && <PipelinePane />}
            {page === "leads" && (
              <ComingSoonPane
                icon="ti-user-plus"
                title="Leads"
                sub="Capture incoming enquiries from your site, chat and inbox in one queue, then convert them into deals. The leads pipeline is being built next."
              />
            )}
            {page === "segments" && (
              <ComingSoonPane
                icon="ti-chart-dots-3"
                title="Segments"
                sub="Group your customers into saved segments for targeted campaigns. Coming next."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pipeline (kanban) ──────────────────────────────────────────────
const KANBAN_STAGES: Array<{ key: string; label: string }> = [
  { key: "new", label: "New" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

type SampleDeal = { title: string; customer: string; ci: string; tone: string; value: string; owner: string; ot: string; stage: string };
const SAMPLE_DEALS: SampleDeal[] = [
  { title: "Tatev cable car group (12)", customer: "Անի Հովհաննիսյան", ci: "ԱՀ", tone: "avatar-blue", value: "360,000 ֏", owner: "ԱՄ", ot: "", stage: "new" },
  { title: "Yerevan city break ×2", customer: "Marriott corporate", ci: "MC", tone: "avatar-amber", value: "$1,240", owner: "ԳՍ", ot: "avatar-teal", stage: "new" },
  { title: "Lake Sevan day trip ×4", customer: "Տիգրան Քոչարյան", ci: "ՏՔ", tone: "", value: "92,000 ֏", owner: "ԱՄ", ot: "", stage: "new" },
  { title: "Sevan weekend lodge", customer: "Դավիթ Սարգսյան", ci: "ԴՍ", tone: "avatar-teal", value: "210,000 ֏", owner: "ԱՄ", ot: "", stage: "qualified" },
  { title: "Wine route — Areni", customer: "Լենա Պետրոսյան", ci: "ԼՊ", tone: "avatar-blue", value: "145,000 ֏", owner: "ՆՀ", ot: "avatar-amber", stage: "qualified" },
  { title: "Garni-Geghard day tour ×6", customer: "Լենա Պետրոսյան", ci: "ԼՊ", tone: "avatar-blue", value: "96,000 ֏", owner: "ԳՍ", ot: "avatar-teal", stage: "proposal" },
  { title: "Dilijan 3-day retreat", customer: "Caucasus DMC", ci: "CD", tone: "avatar-amber", value: "480,000 ֏", owner: "ԱՄ", ot: "", stage: "proposal" },
  { title: "Dilijan adventure 4D", customer: "Սոնա Մկրտչյան", ci: "ՍՄ", tone: "avatar-teal", value: "520,000 ֏", owner: "ԱՄ", ot: "", stage: "won" },
  { title: "Yerevan NYE package", customer: "Robert Aslanyan", ci: "RA", tone: "", value: "780,000 ֏", owner: "ԳՍ", ot: "avatar-teal", stage: "won" },
  { title: "Gyumri culture trip", customer: "Արամ Վարդանյան", ci: "ԱՎ", tone: "", value: "180,000 ֏", owner: "ՆՀ", ot: "avatar-amber", stage: "lost" },
];

function PipelinePane() {
  return (
    <>
      <div className="alert">
        <i className="ti ti-info-circle" />
        <div>
          Deals are live; the board groups them by stage.{" "}
          <strong>Employees see only their own deals unless granted <span className="font-mono">crm.view_all</span>.</strong>
        </div>
      </div>
      <div className="kanban">
        {KANBAN_STAGES.map((st) => {
          const cards = SAMPLE_DEALS.filter((d) => d.stage === st.key);
          return (
            <div className="kanban-col" key={st.key}>
              <div className="kanban-col-head">
                <span className="kanban-col-title">
                  <span className={`kdot ${st.key}`} />
                  {st.label}
                </span>
                <span className="kanban-count">{cards.length}</span>
              </div>
              <div className="kanban-body">
                {cards.map((d, i) => (
                  <div className="deal-card" key={`${st.key}-${i}`}>
                    <div className="dc-title">{d.title}</div>
                    <div className="dc-customer">
                      <span className={`avatar sm ${d.tone}`}>{d.ci}</span>
                      {d.customer}
                    </div>
                    <div className="dc-foot">
                      <span className="dc-value">{d.value}</span>
                      <span className={`avatar sm ${d.ot}`}>{d.owner}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Coming-soon empty state ────────────────────────────────────────
function ComingSoonPane({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="empty-state">
      <div className="es-icon">
        <i className={`ti ${icon}`} />
      </div>
      <div className="es-title">
        {title}{" "}
        <span className="badge badge-primary" style={{ verticalAlign: "middle" }}>
          Coming soon
        </span>
      </div>
      <div className="es-sub">{sub}</div>
    </div>
  );
}
