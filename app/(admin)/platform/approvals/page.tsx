"use client";

/**
 * v2 admin-redesign — Approval queue page (Marketplace ops group).
 *
 * Source spec: docs/admin_designe/marketplace_ops/marketplace_ops_mocks.html (PAGE 1)
 * Migration prompt: docs/admin_designe/marketplace_ops/marketplace_ops_implementation_prompt.md §3.A
 *
 * Chrome:
 *   - V2PageHeader (breadcrumb + Refresh + Export actions)
 *   - MarketplaceOpsSectionTabs (shared 9-tab nav)
 *   - 4 stat cards (company / seller / offer / review pending counts)
 *   - FilterCard (Type / Priority / Age / Search)
 *   - Active filter chips
 *   - V2Card wrapping table
 *   - Status/type/priority badges via admin-v2-helpers
 *   - Inline green/red Approve/Reject buttons (NOT V2Button primary)
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiApproveGenericApproval,
  apiPlatformApprovals,
  apiRejectGenericApproval,
  type GenericApprovalRow,
} from "@/lib/platform-admin-api";
import { apiApprovalsStats, type ApprovalsStats } from "@/lib/marketplace-stats-api";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { MarketplaceOpsSectionTabs } from "@/components/marketplace/MarketplaceOpsSectionTabs";
import {
  STATUS_BADGE_CLASS,
  avatarInitials,
  avatarStyle,
  formatRelativeTime,
  pickAvatarTone,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
import {
  Building as BuildingIcon,
  Briefcase as BriefcaseIcon,
  Eye as EyeIcon,
  EyeOff as EyeCheckIcon,
  MessageCircle as MessageCircleIcon,
  Check as CheckIcon,
  X as XIcon,
  XCircle,
  Download,
  RefreshCw,
} from "lucide-react";

function canActOnApproval(status: string): boolean {
  return status === "pending" || status === "under_review";
}

/** Bucket of entity-type tokens to display category. */
function categorise(entityType: string): "company" | "seller" | "offer" | "review" {
  const s = entityType.toLowerCase();
  if (s.includes("review")) return "review";
  if (s.includes("offer") || s.includes("package") || s.includes("excursion")) return "offer";
  if (s.includes("seller") || s.includes("service")) return "seller";
  return "company";
}

type CategoryMeta = { label: string; tone: StatusTone; icon: React.ReactNode };

const CATEGORY_META: Record<"company" | "seller" | "offer" | "review", CategoryMeta> = {
  company: { label: "Company", tone: "primary", icon: <BuildingIcon className="h-3 w-3" /> },
  seller: { label: "Seller", tone: "info", icon: <BriefcaseIcon className="h-3 w-3" /> },
  offer: { label: "Offer", tone: "warning", icon: <EyeCheckIcon className="h-3 w-3" /> },
  review: { label: "Review", tone: "danger", icon: <MessageCircleIcon className="h-3 w-3" /> },
};

function priorityTone(priority: string | null | undefined): StatusTone {
  switch ((priority ?? "").toLowerCase()) {
    case "urgent":
    case "high":
      return "danger";
    case "normal":
    case "medium":
    case "med":
      return "warning";
    case "low":
      return "gray";
    default:
      return "gray";
  }
}

function statusTone(status: string): StatusTone {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "under_review":
      return "info";
    case "pending":
    default:
      return "warning";
  }
}

/** Returns age in days for the "danger if > 7 days" colouring. */
function ageDays(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export default function GenericApprovalsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<GenericApprovalRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<"" | "company" | "seller" | "offer" | "review">("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState<"" | "today" | "3d" | "7d+">("");
  const [statusFilter] = useState<string>(""); // backend still accepts, kept for parity
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ApprovalsStats | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await apiPlatformApprovals(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.approvals.err_load"));
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiApprovalsStats(token)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  async function approve(id: number) {
    if (!token) return;
    const decision_notes = window.prompt(t("admin.approvals.prompt_notes_approve")) ?? "";
    setBusyId(id);
    try {
      await apiApproveGenericApproval(token, id, decision_notes.trim() || undefined);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.approvals.err_approve"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    if (!token) return;
    const decision_notes = window.prompt(t("admin.approvals.prompt_notes_reject")) ?? "";
    setBusyId(id);
    try {
      await apiRejectGenericApproval(token, id, decision_notes.trim() || undefined);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.approvals.err_reject"));
    } finally {
      setBusyId(null);
    }
  }

  // Client-side derived filtering on top of backend status filter — the
  // backend doesn't yet support type/priority/age/search, so we keep the
  // chrome reactive even before that work lands.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const cat = categorise(r.entity_type);
      if (typeFilter && cat !== typeFilter) return false;
      if (priorityFilter && (r.priority ?? "").toLowerCase() !== priorityFilter) return false;
      if (ageFilter) {
        const d = ageDays(r.created_at);
        if (d == null) return false;
        if (ageFilter === "today" && d > 0) return false;
        if (ageFilter === "3d" && d > 3) return false;
        if (ageFilter === "7d+" && d <= 7) return false;
      }
      if (q) {
        const hit =
          String(r.id).includes(q) ||
          r.entity_type?.toLowerCase().includes(q) ||
          String(r.entity_id).includes(q) ||
          r.requested_by?.name?.toLowerCase().includes(q) ||
          r.requested_by?.email?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, typeFilter, priorityFilter, ageFilter, search]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (typeFilter) {
      chips.push({
        key: "type",
        label: `Type: ${CATEGORY_META[typeFilter].label}`,
        clear: () => {
          setPage(1);
          setTypeFilter("");
        },
      });
    }
    if (priorityFilter) {
      chips.push({
        key: "priority",
        label: `Priority: ${priorityFilter}`,
        clear: () => {
          setPage(1);
          setPriorityFilter("");
        },
      });
    }
    if (ageFilter) {
      const map: Record<string, string> = { today: "Today", "3d": "Last 3 days", "7d+": "More than 7 days" };
      chips.push({
        key: "age",
        label: `Age: ${map[ageFilter]}`,
        clear: () => {
          setPage(1);
          setAgeFilter("");
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
        },
      });
    }
    return chips;
  }, [typeFilter, priorityFilter, ageFilter, search]);

  function clearAllFilters() {
    setPage(1);
    setTypeFilter("");
    setPriorityFilter("");
    setAgeFilter("");
    setSearch("");
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.approvals.title_short")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.approvals.title") },
        ]}
        title={t("admin.approvals.title")}
        subtitle="Pending items across the platform awaiting your review"
        actions={
          <>
            <V2Button onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh">
              {""}
            </V2Button>
            <V2Button icon={<Download className="h-4 w-4" />}>Export</V2Button>
          </>
        }
      />

      <MarketplaceOpsSectionTabs
        activeHref="/platform/approvals"
        counts={{ approvals: stats?.total_pending }}
      />

      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<BuildingIcon style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.company_apps.toLocaleString() : "—"}
          label="Company applications"
          footer={stats && stats.new_today_company > 0 ? `${stats.new_today_company} new today` : undefined}
        />
        <StatCard
          icon={<BriefcaseIcon style={{ color: "var(--admin-info)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.seller_apps.toLocaleString() : "—"}
          label="Seller applications"
          footer={stats && stats.new_today_seller > 0 ? `+${stats.new_today_seller} today` : undefined}
        />
        <StatCard
          icon={<EyeCheckIcon style={{ color: "var(--admin-warning)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.offers_pending.toLocaleString() : "—"}
          label="Offers pending review"
          footer={stats && stats.new_today_offer > 0 ? `${stats.new_today_offer} today` : undefined}
        />
        <StatCard
          icon={<MessageCircleIcon style={{ color: "var(--admin-success)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.reviews_pending.toLocaleString() : "—"}
          label="Reviews to moderate"
          footer={stats && stats.new_today_review > 0 ? `+${stats.new_today_review} today` : undefined}
        />
      </StatGrid>

      <FilterCard>
        <FilterField label="Type">
          <select
            value={typeFilter}
            onChange={(e) => {
              setPage(1);
              setTypeFilter(e.target.value as typeof typeFilter);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">All types</option>
            <option value="company">Company application</option>
            <option value="seller">Seller application</option>
            <option value="offer">Offer review</option>
            <option value="review">Review moderation</option>
          </select>
        </FilterField>
        <FilterField label="Priority">
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPage(1);
              setPriorityFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">All</option>
            <option value="urgent">Urgent</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </FilterField>
        <FilterField label="Age">
          <select
            value={ageFilter}
            onChange={(e) => {
              setPage(1);
              setAgeFilter(e.target.value as typeof ageFilter);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">Any</option>
            <option value="today">Today</option>
            <option value="3d">Last 3 days</option>
            <option value="7d+">More than 7 days</option>
          </select>
        </FilterField>
        <FilterField label="Search" minWidth={240}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, applicant, or ID..."
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <V2Button variant="primary" size="md" onClick={() => void load()}>
          Apply
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

      <V2Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead
              className="text-[11px] font-semibold uppercase tracking-[0.5px]"
              style={{ backgroundColor: "var(--admin-bg-secondary)", color: "var(--admin-text-secondary)" }}
            >
              <tr>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-left">Item</th>
                <th className="px-4 py-2.5 text-left">Applicant / Source</th>
                <th className="px-4 py-2.5 text-left">Priority</th>
                <th className="px-4 py-2.5 text-left">Age</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    {loading ? "Loading…" : t("admin.approvals.empty") || "No approvals."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const cat = categorise(r.entity_type);
                  const catMeta = CATEGORY_META[cat];
                  const applicantName = r.requested_by?.name ?? null;
                  const tone = pickAvatarTone(r.requested_by?.id ?? r.id);
                  const days = ageDays(r.created_at);
                  const ageColor = days != null && days > 7 ? "var(--admin-danger)" : "var(--admin-text-secondary)";
                  return (
                    <tr
                      key={r.id}
                      className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                    >
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(catMeta.tone)}>
                          {catMeta.icon}
                          {catMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-fg-t8">{r.entity_type}</span>
                          <span className="text-[11px] font-mono" style={{ color: "var(--admin-text-tertiary)" }}>
                            #{r.entity_id}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {applicantName ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                              style={avatarStyle(tone)}
                              aria-hidden
                            >
                              {avatarInitials(applicantName)}
                            </span>
                            <div className="min-w-0">
                              <div className="font-medium text-fg-t8 truncate">{applicantName}</div>
                              {r.requested_by?.email ? (
                                <div className="text-[11px] truncate" style={{ color: "var(--admin-text-tertiary)" }}>
                                  {r.requested_by.email}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.priority ? (
                          <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(priorityTone(r.priority))}>
                            {r.priority}
                          </span>
                        ) : (
                          <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusTone(r.status))}>
                            {r.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: ageColor }} title={r.created_at ?? undefined}>
                        {formatRelativeTime(r.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {canActOnApproval(r.status) && cat !== "review" ? (
                            <>
                              <button
                                type="button"
                                disabled={busyId === r.id}
                                onClick={() => approve(r.id)}
                                className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium transition disabled:opacity-40 hover:bg-[color:var(--admin-success-light)]"
                                style={{
                                  color: "var(--admin-success)",
                                  borderColor: "var(--admin-success-light)",
                                  backgroundColor: "transparent",
                                }}
                              >
                                <CheckIcon className="h-3 w-3" />
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={busyId === r.id}
                                onClick={() => reject(r.id)}
                                className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium transition disabled:opacity-40 hover:bg-[color:var(--admin-danger-light)]"
                                style={{
                                  color: "var(--admin-danger)",
                                  borderColor: "var(--admin-danger-light)",
                                  backgroundColor: "transparent",
                                }}
                              >
                                <XIcon className="h-3 w-3" />
                                Reject
                              </button>
                            </>
                          ) : null}
                          <IconButton aria-label="View">
                            <EyeIcon />
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
        {meta && meta.last_page > 1 ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 text-[12px]"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}
          >
            <span>
              Showing {(meta.current_page - 1) * meta.per_page + 1}–
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} pending items
            </span>
            <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
          </div>
        ) : null}
      </V2Card>
    </div>
  );
}
