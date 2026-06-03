"use client";

/**
 * v2 admin-redesign — Seller applications page (Marketplace ops group).
 *
 * Source spec: docs/admin_designe/marketplace_ops/marketplace_ops_mocks.html (PAGE 3)
 * Migration prompt: docs/admin_designe/marketplace_ops/marketplace_ops_implementation_prompt.md §3.C
 *
 * Reject reason uses the ZULU PromptDialog (Variant C modal) — kept from
 * the previous chrome since the user explicitly wanted optional reasons.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrompt } from "@/contexts/PromptDialogContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiApproveSellerApplication,
  apiRejectSellerApplication,
  apiSellerApplicationDetail,
  apiSellerApplications,
  type SellerApplicationDetail,
  type SellerApplicationRow,
} from "@/lib/platform-admin-api";
import { apiSellerApplicationsStats, type SellerApplicationsStats } from "@/lib/marketplace-stats-api";
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
  SuperAdminTag,
  V2Drawer,
  V2DrawerSection,
  V2DrawerInfoRow,
  V2Badge,
  V2Avatar,
} from "@/components/ui/v2";
import { MarketplaceOpsSectionTabs } from "@/components/marketplace/MarketplaceOpsSectionTabs";
import { exportRowsAsCsv } from "@/lib/export-csv";
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
  Briefcase as BriefcaseIcon,
  CheckCircle2 as CircleCheckIcon,
  XCircle as CircleXIcon,
  Clock as ClockIcon,
  Check as CheckIcon,
  X as XIcon,
  Eye,
  Download,
  RefreshCw,
} from "lucide-react";

const SERVICE_TYPE_EMOJI: Record<string, string> = {
  hotel: "🏨",
  flight: "✈️",
  transfer: "🚐",
  excursion: "🎯",
  visa: "📄",
};

function statusMeta(status: string): { tone: StatusTone; label: string; icon: React.ReactNode } {
  switch (status) {
    case "approved":
      return { tone: "success", label: "Approved", icon: <CheckIcon className="h-3 w-3" /> };
    case "rejected":
      return { tone: "danger", label: "Rejected", icon: <XIcon className="h-3 w-3" /> };
    case "under_review":
      return { tone: "info", label: "Under review", icon: <ClockIcon className="h-3 w-3" /> };
    case "pending":
    default:
      return { tone: "warning", label: "Pending", icon: <ClockIcon className="h-3 w-3" /> };
  }
}

function formatServiceType(s: string): string {
  if (!s) return "—";
  const emoji = SERVICE_TYPE_EMOJI[s.toLowerCase()] ?? "";
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  return emoji ? `${emoji} ${label}` : label;
}

export default function SellerApplicationsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const prompt = usePrompt();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<SellerApplicationRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<SellerApplicationsStats | null>(null);
  // 2026-06-04 admin v3 — detail drawer state (Step 2.3). Backend
  // `094b67d` 2026-06-03 added GET /platform-admin/seller-applications/{id}.
  const [detail, setDetail] = useState<SellerApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  async function openDetail(id: number) {
    if (!token) return;
    setDetailErr(null);
    setDetailLoading(true);
    setDetail({ id } as SellerApplicationDetail); // opens the drawer immediately with a stub
    try {
      const res = await apiSellerApplicationDetail(token, id);
      setDetail(res.data);
    } catch (e) {
      setDetailErr(e instanceof ApiRequestError ? e.message : "Failed to load application");
    } finally {
      setDetailLoading(false);
    }
  }
  function closeDetail() {
    setDetail(null);
    setDetailErr(null);
    setDetailLoading(false);
  }

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await apiSellerApplications(token, {
        page,
        per_page: 20,
        status: statusFilter === "" ? undefined : statusFilter,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.seller_applications.err_load"));
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiSellerApplicationsStats(token)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  async function approve(id: number) {
    if (!token) return;
    const notes = window.prompt(t("admin.seller_applications.prompt_optional_notes")) ?? "";
    setBusyId(id);
    try {
      await apiApproveSellerApplication(token, id, notes || undefined);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.seller_applications.err_approve"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    if (!token) return;
    const rejection_reason = await prompt({
      title: t("admin.seller_applications.prompt_rejection_reason"),
      description: t("admin.seller_applications.reject_reason_optional_hint"),
      placeholder: t("admin.seller_applications.reject_reason_placeholder"),
      variant: "danger",
      confirmLabel: t("admin.seller_applications.btn_reject"),
    });
    if (rejection_reason === null) return;
    setBusyId(id);
    try {
      await apiRejectSellerApplication(token, id, rejection_reason.trim() || "");
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.seller_applications.err_reject"));
    } finally {
      setBusyId(null);
    }
  }

  // Client-side filters that the backend doesn't yet support.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (serviceFilter && r.service_type?.toLowerCase() !== serviceFilter) return false;
      if (q) {
        const hit =
          String(r.id).includes(q) ||
          r.company_name?.toLowerCase().includes(q) ||
          String(r.company_id).includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, serviceFilter, search]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${statusMeta(statusFilter).label}`,
        clear: () => {
          setPage(1);
          setStatusFilter("");
        },
      });
    }
    if (serviceFilter) {
      chips.push({
        key: "service",
        label: `Service: ${formatServiceType(serviceFilter)}`,
        clear: () => {
          setPage(1);
          setServiceFilter("");
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
  }, [statusFilter, serviceFilter, search]);

  function clearAllFilters() {
    setPage(1);
    setStatusFilter("");
    setServiceFilter("");
    setSearch("");
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.seller_applications.title")}</h1>
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
          { label: "Management", href: "/platform/companies" },
          { label: t("admin.seller_applications.title") },
        ]}
        title={t("admin.seller_applications.title")}
        titleBadge={<SuperAdminTag />}
        subtitle="Companies applying to sell specific service types on the platform"
        actions={
          <>
            <V2Button onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh">
              {""}
            </V2Button>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              disabled={rows.length === 0}
              onClick={() =>
                exportRowsAsCsv("seller-applications", rows, [
                  ["id", (r) => r.id],
                  ["company_id", (r) => r.company_id],
                  ["company_name", (r) => r.company_name ?? ""],
                  ["service_type", (r) => r.service_type],
                  ["status", (r) => r.status],
                  ["applied_at", (r) => r.applied_at ?? ""],
                  ["reviewed_at", (r) => r.reviewed_at ?? ""],
                ])
              }
            >
              Export CSV
            </V2Button>
          </>
        }
      />

      <MarketplaceOpsSectionTabs
        activeHref="/platform/seller-applications"
        counts={{ sellerApplications: stats?.pending ?? meta?.total }}
      />

      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<BriefcaseIcon style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.pending.toLocaleString() : "—"}
          label="Pending applications"
        />
        <StatCard
          icon={<CircleCheckIcon style={{ color: "var(--admin-success)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.approved.toLocaleString() : "—"}
          label="Approved (all-time)"
        />
        <StatCard
          icon={<CircleXIcon style={{ color: "var(--admin-danger)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.rejected.toLocaleString() : "—"}
          label="Rejected (all-time)"
        />
        <StatCard
          icon={<ClockIcon style={{ color: "var(--admin-info)" }} className="h-[22px] w-[22px]" />}
          value={stats && stats.avg_review_hours != null ? `${stats.avg_review_hours.toFixed(1)}h` : "—"}
          label="Avg. review time"
        />
      </StatGrid>

      <FilterCard>
        <FilterField label={t("admin.seller_applications.filter_status")}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </FilterField>
        <FilterField label="Service type">
          <select
            value={serviceFilter}
            onChange={(e) => {
              setPage(1);
              setServiceFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">All</option>
            <option value="hotel">Hotel</option>
            <option value="flight">Flight</option>
            <option value="transfer">Transfer</option>
            <option value="excursion">Excursion</option>
            <option value="visa">Visa</option>
          </select>
        </FilterField>
        <FilterField label="Search" minWidth={240}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Company name or application ID..."
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
            <XIcon className="h-3 w-3" />
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
                <th className="px-4 py-2.5 text-left">{t("admin.seller_applications.col_id")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.seller_applications.col_company")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.seller_applications.col_service")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.seller_applications.col_status")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.seller_applications.col_applied")}</th>
                <th className="px-4 py-2.5 text-right">{t("admin.seller_applications.col_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    {loading ? "Loading…" : t("admin.seller_applications.empty") || "No applications."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const companyName = r.company_name ?? `Company #${r.company_id}`;
                  const tone = pickAvatarTone(r.company_id);
                  const sMeta = statusMeta(r.status);
                  const canAct = r.status === "pending" || r.status === "under_review";
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                      onClick={() => void openDetail(r.id)}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-fg-t7">
                        #APP-{String(r.id).padStart(3, "0")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                            style={avatarStyle(tone)}
                            aria-hidden
                          >
                            {avatarInitials(companyName)}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium text-fg-t8 truncate">{companyName}</div>
                            <div className="text-[11px] truncate" style={{ color: "var(--admin-text-tertiary)" }}>
                              #{r.company_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle("gray")}>
                          {formatServiceType(r.service_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(sMeta.tone)}>
                          {sMeta.icon}
                          {sMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }} title={r.applied_at ?? undefined}>
                        {formatRelativeTime(r.applied_at)}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {canAct ? (
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
                          <IconButton
                            as="link"
                            href={`/platform/companies/${r.company_id}`}
                            aria-label="View company"
                          >
                            <Eye />
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
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} applications
            </span>
            <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
          </div>
        ) : null}
      </V2Card>

      {/* admin v3 — Detail drawer (Step 2.3, 2026-06-04). Row click → drawer.
          Fields populated from `GET /platform-admin/seller-applications/{id}`
          (backend `094b67d` 2026-06-03). */}
      <V2Drawer
        open={detail !== null}
        onClose={closeDetail}
        title={
          detail
            ? `Application #APP-${String(detail.id).padStart(3, "0")}`
            : "Application"
        }
        width={560}
        footer={
          detail && (detail.status === "pending" || detail.status === "under_review") ? (
            <>
              <V2Button
                variant="success"
                onClick={async () => {
                  if (!detail) return;
                  await approve(detail.id);
                  closeDetail();
                }}
                icon={<CheckIcon className="h-4 w-4" />}
              >
                Approve
              </V2Button>
              <V2Button
                variant="danger"
                onClick={async () => {
                  if (!detail) return;
                  await reject(detail.id);
                  closeDetail();
                }}
                icon={<XIcon className="h-4 w-4" />}
              >
                Reject
              </V2Button>
              <V2Button
                as="link"
                href={detail.company?.id ? `/platform/companies/${detail.company.id}` : `/platform/companies/${detail.company_id}`}
                variant="ghost"
                icon={<Eye className="h-4 w-4" />}
              >
                View company
              </V2Button>
            </>
          ) : detail ? (
            <V2Button
              as="link"
              href={detail.company?.id ? `/platform/companies/${detail.company.id}` : `/platform/companies/${detail.company_id}`}
              variant="default"
              icon={<Eye className="h-4 w-4" />}
            >
              View company
            </V2Button>
          ) : null
        }
      >
        {detailErr ? (
          <div
            className="mb-3 rounded-md border px-3 py-2 text-sm"
            style={{
              backgroundColor: "var(--admin-danger-light)",
              borderColor: "var(--admin-danger-light)",
              color: "var(--admin-danger-dark)",
            }}
          >
            {detailErr}
          </div>
        ) : null}

        {detailLoading && !detail?.service_type ? (
          <p className="text-sm" style={{ color: "var(--admin-text-secondary)" }}>
            Loading…
          </p>
        ) : detail && detail.service_type ? (
          <>
            <V2DrawerSection>Company</V2DrawerSection>
            <div className="mb-3 flex items-center gap-3">
              <V2Avatar
                label={detail.company?.name ?? detail.company_name ?? `#${detail.company_id}`}
                tone={(() => {
                  const t = pickAvatarTone(detail.company_id);
                  return t === "purple" ? "default" : t;
                })()}
              />
              <div className="min-w-0">
                <div className="text-[14px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>
                  {detail.company?.name ?? detail.company_name ?? `Company #${detail.company_id}`}
                </div>
                <div className="text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                  {[detail.company?.type, detail.company?.country, detail.company?.city]
                    .filter(Boolean)
                    .join(" · ") || `#${detail.company_id}`}
                </div>
              </div>
            </div>

            <V2DrawerSection>Application</V2DrawerSection>
            <div className="space-y-0">
              <V2DrawerInfoRow
                label="Service type"
                value={
                  <V2Badge tone="gray">{formatServiceType(detail.service_type)}</V2Badge>
                }
              />
              <V2DrawerInfoRow
                label="Status"
                value={
                  <V2Badge tone={statusMeta(detail.status).tone}>
                    {statusMeta(detail.status).icon}
                    {statusMeta(detail.status).label}
                  </V2Badge>
                }
              />
              <V2DrawerInfoRow
                label="Applied"
                value={detail.applied_at ? new Date(detail.applied_at).toLocaleString() : "—"}
              />
              <V2DrawerInfoRow
                label="Reviewed"
                value={detail.reviewed_at ? new Date(detail.reviewed_at).toLocaleString() : "—"}
              />
              <V2DrawerInfoRow
                label="Reviewer"
                value={
                  detail.reviewer
                    ? `${detail.reviewer.name}${detail.reviewer.email ? ` (${detail.reviewer.email})` : ""}`
                    : "—"
                }
              />
            </div>

            {detail.notes ? (
              <>
                <V2DrawerSection>Notes</V2DrawerSection>
                <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--admin-text-primary)" }}>
                  {detail.notes}
                </p>
              </>
            ) : null}

            {detail.rejection_reason ? (
              <>
                <V2DrawerSection>Rejection reason</V2DrawerSection>
                <p
                  className="rounded-md border px-3 py-2 text-[13px] whitespace-pre-wrap"
                  style={{
                    backgroundColor: "var(--admin-danger-light)",
                    borderColor: "var(--admin-danger-light)",
                    color: "var(--admin-danger-dark)",
                  }}
                >
                  {detail.rejection_reason}
                </p>
              </>
            ) : null}
          </>
        ) : null}
      </V2Drawer>
    </div>
  );
}
