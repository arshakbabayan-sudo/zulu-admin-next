"use client";

/**
 * CRM → Staff — directory of platform staff (operator / agent / admin
 * employees), folded in from the deleted Directory sidebar group on
 * 2026-06-04 per Arshak's menu cleanup.
 *
 * The page is the existing platform-users list scoped to `type=staff`
 * with the chip strip removed (Staff is the only view here). Tenant
 * scoping is enforced server-side: super-admin sees every company's
 * employees; operator/agent sees their own. The row Eye click opens
 * the unified detail page at /platform/users/{id} (shared with the
 * Management → B2C customers / Unverified tabs).
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrompt } from "@/contexts/PromptDialogContext";
import { useRouter } from "next/navigation";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessCrmSection } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiAnonymizePlatformUser,
  apiDeactivatePlatformUser,
  apiPlatformUsers,
  apiPlatformUsersStats,
  type PlatformAdminUserRow,
  type PlatformUsersStats,
} from "@/lib/platform-admin-api";
import {
  STATUS_BADGE_CLASS,
  avatarInitials,
  avatarStyle,
  formatRelativeTime,
  pickAvatarTone,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleCheck,
  Clock,
  Download,
  Eye,
  RefreshCw,
  Search,
  UserMinus,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
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
import { CrmSectionTabs } from "@/components/crm/CrmSectionTabs";
import { RowActionsMenu } from "@/components/admin/RowActionsMenu";
import { exportRowsAsCsv } from "@/lib/export-csv";

const STATUS_FILTERS = ["", "active", "inactive", "pending"] as const;

function statusToneFor(status: string | null | undefined): StatusTone {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return "success";
    case "pending":
      return "warning";
    case "suspended":
    case "banned":
      return "danger";
    case "inactive":
      return "gray";
    default:
      return "gray";
  }
}

function statusLabelFor(status: string | null | undefined): string {
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function roleToneFor(role: string | null | undefined): StatusTone {
  const r = (role ?? "").toLowerCase();
  if (r === "super_admin" || r === "super-admin" || r === "superadmin") return "primary";
  if (r === "admin" || r === "company_admin") return "info";
  if (r === "agent") return "warning";
  return "gray";
}

function roleLabelFor(role: string | null | undefined): string {
  if (!role) return "Staff";
  const r = role.toLowerCase();
  if (r === "super_admin" || r === "super-admin" || r === "superadmin") return "Super admin";
  if (r === "company_admin") return "Company admin";
  if (r === "admin") return "Admin";
  if (r === "agent") return "Agent";
  if (r === "operator") return "Operator";
  if (r === "staff") return "Staff";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function CrmStaffPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  useDocumentTitle("CRM — Staff");
  const confirm = useConfirm();
  const prompt = usePrompt();
  const router = useRouter();
  const allowed = canAccessCrmSection(user);
  const isSuperAdmin = user?.is_super_admin === true;
  const [rows, setRows] = useState<PlatformAdminUserRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [stats, setStats] = useState<PlatformUsersStats | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await apiPlatformUsers(token, {
        page,
        per_page: 20,
        search: search || undefined,
        type: "staff",
        status: statusFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.users.err_load"));
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, search, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiPlatformUsersStats(token)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  const companyOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) {
      for (const c of r.companies ?? []) {
        if (!map.has(c.id)) map.set(c.id, c.name);
      }
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!companyFilter) return rows;
    const id = Number(companyFilter);
    if (!Number.isFinite(id)) return rows;
    return rows.filter((r) => r.companies?.some((c) => c.id === id));
  }, [rows, companyFilter]);

  async function deactivate(id: number) {
    if (!token) return;
    const ok = await confirm({
      message: t("admin.users.confirm_deactivate").replace("{id}", String(id)),
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await apiDeactivatePlatformUser(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.users.err_deactivate"));
    } finally {
      setBusyId(null);
    }
  }

  async function anonymize(row: PlatformAdminUserRow) {
    if (!token) return;
    const typed = await prompt({
      title: t("admin.users.anonymize_title").replace("{name}", row.name),
      description: t("admin.users.anonymize_description"),
      placeholder: row.name,
      required: true,
      variant: "danger",
      confirmLabel: t("admin.users.btn_anonymize_confirm"),
    });
    if (typed === null) return;
    if (typed.trim() !== row.name.trim()) {
      alert(t("admin.users.confirm_name_mismatch"));
      return;
    }
    const reason = await prompt({
      title: t("admin.users.anonymize_reason_title"),
      description: t("admin.users.anonymize_reason_description"),
      placeholder: t("admin.users.reason_placeholder"),
      variant: "default",
    });
    if (reason === null) return;
    setBusyId(row.id);
    try {
      await apiAnonymizePlatformUser(token, row.id, reason || null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.users.err_anonymize"));
    } finally {
      setBusyId(null);
    }
  }

  function clearAllFilters() {
    setPage(1);
    setStatusFilter("");
    setCompanyFilter("");
    setSearch("");
    setSearchInput("");
  }

  const k = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Staff</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice messageKey={!allowed ? "admin.forbidden.platform_users" : undefined} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "CRM", href: "/crm/pipeline" },
          { label: "Staff" },
        ]}
        title="Staff"
        subtitle={
          meta
            ? `Showing page ${meta.current_page} of ${meta.last_page} · ${meta.total} staff total`
            : "Operators, agents, and admins across the platform."
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
                exportRowsAsCsv("staff", rows, [
                  ["id", (r) => r.id],
                  ["name", (r) => r.name],
                  ["email", (r) => r.email],
                  ["status", (r) => r.status],
                  ["companies", (r) => (r.companies ?? []).map((c) => `${c.name} (${c.role})`).join("; ")],
                  ["last_login_at", (r) => r.last_login_at ?? ""],
                ])
              }
            >
              Export
            </V2Button>
          </>
        }
      />

      <CrmSectionTabs activeHref="/crm/staff" counts={{ staff: stats?.total }} />

      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<Users style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.total.toLocaleString() : "—"}
          label="Total people"
        />
        <StatCard
          icon={<CircleCheck style={{ color: "var(--admin-success)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.active_today.toLocaleString() : "—"}
          label="Active today"
        />
        <StatCard
          icon={<UserPlus style={{ color: "var(--admin-info)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.new_7d.toLocaleString() : "—"}
          label="New (last 7d)"
        />
        <StatCard
          icon={<Clock style={{ color: "var(--admin-warning)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.pending_verification.toLocaleString() : "—"}
          label="Pending verification"
        />
      </StatGrid>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <FilterCard>
          <FilterField label="Status">
            <select
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
              className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s ? statusLabelFor(s) : t("common.all")}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Company">
            <select
              value={companyFilter}
              onChange={(e) => {
                setPage(1);
                setCompanyFilter(e.target.value);
              }}
              className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            >
              <option value="">{t("common.all")}</option>
              {companyOptions.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Search" minWidth={240}>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--admin-text-tertiary)" }}
              />
              <input
                placeholder={t("admin.users.search_placeholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-[34px] w-full rounded-md border bg-white pl-9 pr-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                style={{ borderColor: "var(--admin-border)" }}
              />
            </div>
          </FilterField>
          <V2Button type="submit" variant="primary" size="md">
            {t("common.search")}
          </V2Button>
          {statusFilter || companyFilter || search ? (
            <V2Button type="button" size="md" onClick={clearAllFilters}>
              Clear
            </V2Button>
          ) : null}
        </FilterCard>
      </form>

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
                <th className="px-4 py-2.5 text-left">User</th>
                <th className="px-4 py-2.5 text-left">Email</th>
                <th className="px-4 py-2.5 text-left">Role</th>
                <th className="px-4 py-2.5 text-left">Companies</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Last seen</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: "var(--admin-text-secondary)" }}
                  >
                    {loading ? "Loading…" : t("admin.users.empty")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const tone = pickAvatarTone(r.id);
                  const primaryRole = r.companies && r.companies.length > 0 ? r.companies[0]!.role : null;
                  const statusTone = statusToneFor(r.status);
                  const rTone = roleToneFor(primaryRole);
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                      onClick={() => router.push(`/platform/users/${r.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                            style={avatarStyle(tone)}
                            aria-hidden
                          >
                            {avatarInitials(r.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-fg-t8">{r.name}</div>
                            <div className="truncate text-[11px] font-mono text-fg-t6">#{r.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-fg-t8">{r.email}</td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(rTone)}>
                          {roleLabelFor(primaryRole)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.companies && r.companies.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            <span
                              className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                              style={{
                                backgroundColor: "var(--admin-bg-tertiary)",
                                color: "var(--admin-text-secondary)",
                              }}
                              title={r.companies[0]!.name}
                            >
                              {r.companies[0]!.name}
                            </span>
                            {r.companies.length > 1 ? (
                              <span
                                className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                                style={{
                                  backgroundColor: "var(--admin-bg-tertiary)",
                                  color: "var(--admin-text-tertiary)",
                                }}
                                title={r.companies
                                  .slice(1)
                                  .map((c) => c.name)
                                  .join(", ")}
                              >
                                +{r.companies.length - 1}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusTone)}>
                          {statusLabelFor(r.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {formatRelativeTime(r.last_login_at ?? null)}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton as="link" href={`/platform/users/${r.id}`} aria-label={k("admin.users.btn_edit", "View")}>
                            <Eye />
                          </IconButton>
                          {isSuperAdmin ? (
                            <RowActionsMenu
                              disabled={busyId === r.id}
                              items={[
                                {
                                  key: "deactivate",
                                  label: t("admin.users.btn_deactivate"),
                                  icon: <UserX />,
                                  onSelect: () => { void deactivate(r.id); },
                                  disabled: r.status === "inactive",
                                },
                                {
                                  key: "anonymize",
                                  label: t("admin.users.btn_anonymize"),
                                  icon: <UserMinus />,
                                  onSelect: () => { void anonymize(r); },
                                  destructive: true,
                                },
                              ]}
                            />
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
        {meta && meta.last_page > 1 ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 text-[12px]"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}
          >
            <span>
              Showing {(meta.current_page - 1) * meta.per_page + 1}–
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} staff
            </span>
            <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
          </div>
        ) : null}
      </V2Card>
    </div>
  );
}
