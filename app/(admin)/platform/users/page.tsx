"use client";

/**
 * v2 admin-redesign — Users list (Marketplace ops group).
 *
 * Source spec: docs/admin_designe/marketplace_ops/marketplace_ops_implementation_prompt.md §3.D
 * Mockup: docs/admin_designe/marketplace_ops/marketplace_ops_mocks.html (PAGE 4 USERS).
 *
 * Migrated 2026-05-26 to consume the shared MarketplaceOpsSectionTabs and
 * admin-v2-helpers utilities. PinPromptDialog hard-delete flow and the
 * anonymise/deactivate/hard-delete API contract is preserved verbatim from
 * the previous v1 page.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PinPromptDialog } from "@/components/PinPromptDialog";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrompt } from "@/contexts/PromptDialogContext";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessMyCompanySection } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiAnonymizePlatformUser,
  apiBulkDeleteUsers,
  apiBulkRemindUsers,
  apiDeactivatePlatformUser,
  apiHardDeletePlatformUser,
  apiPlatformUsers,
  apiPlatformUsersStats,
  type PlatformAdminUserRow,
  type PlatformUserTypeFilter,
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
  Trash2,
  UserMinus,
  UserPlus,
  UserX,
  Users,
  XCircle,
  X as XIcon,
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
  SectionTabs,
} from "@/components/ui/v2";
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

function typeToneFor(role: string | null | undefined): StatusTone {
  const r = (role ?? "").toLowerCase();
  if (r === "super_admin" || r === "super-admin" || r === "superadmin") return "primary";
  if (r === "admin") return "info";
  return "gray";
}

function typeLabelFor(role: string | null | undefined): string {
  if (!role) return "Customer";
  const r = role.toLowerCase();
  if (r === "super_admin" || r === "super-admin" || r === "superadmin") return "Super admin";
  if (r === "admin") return "Admin";
  if (r === "staff") return "Staff";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function PlatformUsersPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  useDocumentTitle(t("admin.users.title"));
  const confirm = useConfirm();
  const prompt = usePrompt();
  // Phase 6 frontend gate: the users list is tenant-scoped (operator sees only
  // their own company's staff via /platform-admin/users). Open to company
  // members; the super-only chips (B2C customers / unverified) still 403 for
  // operators and simply show empty, but the Staff view (their employees) works.
  const allowed = canAccessMyCompanySection(user);
  const isSuperAdmin = user?.is_super_admin === true;
  const [rows, setRows] = useState<PlatformAdminUserRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [stats, setStats] = useState<PlatformUsersStats | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  // Phase 6.4 — type filter merges customers / staff / unverified
  // Phase 4B (2026-05-31) — initial value pulled from URL ?type=… so the
  // /bucket3/customers and /bucket3/employees redirects (also Phase 4B)
  // land on the right chip with no extra click. The chip click handler
  // pushes the new value back into the URL via router.replace below.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialType = ((): PlatformUserTypeFilter => {
    const raw = searchParams?.get("type");
    if (raw === "customers" || raw === "staff" || raw === "unverified") return raw;
    return "";
  })();
  const [typeFilter, setTypeFilterState] = useState<PlatformUserTypeFilter>(initialType);
  const setTypeFilter = useCallback(
    (next: PlatformUserTypeFilter) => {
      setTypeFilterState(next);
      // Sync URL — non-empty value as ?type=, empty value clears the param.
      const sp = new URLSearchParams(Array.from(searchParams?.entries() ?? []));
      if (next) {
        sp.set("type", next);
      } else {
        sp.delete("type");
      }
      const qs = sp.toString();
      const href = `${pathname}${qs ? `?${qs}` : ""}`;
      router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams]
  );
  const [companyFilter, setCompanyFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Phase Բ.3 — bulk-select for the unverified-accounts cleanup workflow.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const showBulk = typeFilter === "unverified";
  // Phase Զ.15 / Item 15 — PIN gate state.
  const [pinGate, setPinGate] = useState<{
    title: string;
    description: React.ReactNode;
    onConfirm: () => Promise<void>;
  } | null>(null);

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
        type: typeFilter || undefined,
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
  }, [token, allowed, page, search, typeFilter, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Phase Բ.3 — reset selection when the filter/page context changes so we
  // never act on ids no longer visible.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [typeFilter, statusFilter, search, page]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiPlatformUsersStats(token)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  // Phase Բ.3 — bulk handlers (unverified cleanup).
  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkRemind() {
    if (!token || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setBulkBusy(true);
    try {
      const res = await apiBulkRemindUsers(token, ids);
      setSelectedIds(new Set());
      alert(res.message ?? `Reminded ${res.data.reminded}, skipped ${res.data.skipped}.`);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.users.err_load"));
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDelete() {
    if (!token || selectedIds.size === 0) return;
    const ok = await confirm({
      title: "Delete selected accounts?",
      message: `${selectedIds.size} account(s) will be anonymized (reversible-safe — PII removed, rows preserved).`,
      variant: "danger",
    });
    if (!ok) return;
    const ids = Array.from(selectedIds);
    setBulkBusy(true);
    try {
      const res = await apiBulkDeleteUsers(token, ids);
      setSelectedIds(new Set());
      alert(res.message ?? `Anonymized ${res.data.processed}, skipped ${res.data.skipped}.`);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.users.err_load"));
    } finally {
      setBulkBusy(false);
    }
  }

  // Build dropdown list of companies from the current page rows.
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

  // Client-side company filter — backend doesn't support it yet.
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

  async function hardDelete(row: PlatformAdminUserRow) {
    if (!token || !isSuperAdmin) return;
    const typed = await prompt({
      title: t("admin.users.hard_delete_title").replace("{name}", row.name),
      description: t("admin.users.hard_delete_description"),
      placeholder: row.name,
      required: true,
      variant: "danger",
      confirmLabel: t("admin.users.btn_hard_delete_confirm"),
    });
    if (typed === null) return;
    if (typed.trim() !== row.name.trim()) {
      alert(t("admin.users.confirm_name_mismatch"));
      return;
    }
    const reason = await prompt({
      title: t("admin.users.hard_delete_reason_title"),
      description: t("admin.users.hard_delete_reason_description"),
      placeholder: t("admin.users.reason_placeholder"),
      required: true,
      minLength: 3,
      variant: "danger",
    });
    if (reason === null) return;
    setPinGate({
      title: "Verify PIN to hard-delete",
      description: (
        <>
          You are about to permanently delete <strong>{row.name}</strong>. Enter your account PIN
          to confirm.
        </>
      ),
      onConfirm: async () => {
        setBusyId(row.id);
        try {
          await apiHardDeletePlatformUser(token, row.id, reason);
          await load();
          setPinGate(null);
        } catch (e) {
          alert(e instanceof ApiRequestError ? e.message : t("admin.users.err_hard_delete"));
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${statusLabelFor(statusFilter)}`,
        clear: () => {
          setPage(1);
          setStatusFilter("");
        },
      });
    }
    if (typeFilter) {
      const typeLabels: Record<PlatformUserTypeFilter, string> = {
        "": "",
        customers: "Customers",
        staff: "Staff",
        unverified: "Unverified",
      };
      chips.push({
        key: "type",
        label: `Type: ${typeLabels[typeFilter] ?? typeFilter}`,
        clear: () => {
          setPage(1);
          setTypeFilter("");
        },
      });
    }
    if (companyFilter) {
      const name = companyOptions.find((c) => String(c.id) === companyFilter)?.name ?? companyFilter;
      chips.push({
        key: "company",
        label: `Company: ${name}`,
        clear: () => {
          setPage(1);
          setCompanyFilter("");
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
          setSearchInput("");
        },
      });
    }
    return chips;
  }, [statusFilter, typeFilter, companyFilter, search, companyOptions]);

  function clearAllFilters() {
    setPage(1);
    setStatusFilter("");
    setTypeFilter("");
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
        <h1 className="admin-page-title">{t("admin.users.title")}</h1>
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
          // Phase 4D (2026-05-31) — breadcrumb parent retargeted from
          // "Management" to "Directory" since /platform/users is owned by
          // the Directory sidebar group now (People view).
          { label: "Directory", href: "/platform/users" },
          { label: t("admin.users.title_long") },
        ]}
        title={t("admin.users.title_long")}
        subtitle={
          meta
            ? t("admin.users.meta_summary")
                .replace("{total}", String(meta.total))
                .replace("{current}", String(meta.current_page))
                .replace("{last}", String(meta.last_page))
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
                exportRowsAsCsv("users", rows, [
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
            {/* Phase 2C step 6 (2026-05-31) — "Add user" placeholder dropped.
                The button had no onClick handler (deceptive UI per the new
                menu architecture's anti-pattern list). Staff are invited via
                /platform/companies/{id} → Users → Add employee; B2C
                customers self-register on zulu.am. There is no admin-side
                ad-hoc create flow, so the button just confused. */}
          </>
        }
      />

      {/* Phase 4D (2026-05-31) — Directory group strip ([People | Companies]).
          Replaces the prior Management section tabs on this page; /platform/users
          is owned by Directory now (People view). Management still hosts a
          Users tab for governance entry points — Phase 2C cleanup will remove
          that duplicate. */}
      <SectionTabs
        activeHref="/platform/users"
        items={[
          { href: "/platform/users", label: "People", count: stats?.total ?? meta?.total },
          { href: "/platform/companies", label: "Companies" },
        ]}
      />

      {/* Phase 4A (2026-05-31) — Directory "People" filter chips.
          Lifts the Type filter (Customers / Staff / Unverified) out of the
          FilterCard so the user sees the four canonical views at a glance.
          The Type select inside the filter card stays for completeness, but
          most clicks happen here. Chip selection feeds the same typeFilter
          state, so backend wiring is unchanged.
          Matches the Directory spec in docs/admin_designe/new-menu-
          architecture-2026-05-31.md §5 (Directory → People). */}
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="tablist"
        aria-label={t("admin.users.type_chip_label") || "Directory people filter"}
      >
        {(
          [
            { value: "", label: t("admin.users.type_all") || "All" },
            { value: "customers", label: t("admin.users.type_customers") || "B2C customers" },
            { value: "staff", label: t("admin.users.type_staff") || "Staff" },
            { value: "unverified", label: t("admin.users.type_unverified") || "Unverified" },
          ] as Array<{ value: PlatformUserTypeFilter; label: string }>
        ).map((chip) => {
          const active = typeFilter === chip.value;
          return (
            <button
              key={chip.value || "all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setPage(1);
                setTypeFilter(chip.value);
              }}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-[12px] font-medium transition"
              style={{
                borderColor: active ? "var(--admin-primary)" : "var(--admin-border)",
                backgroundColor: active ? "var(--admin-primary-soft)" : "var(--admin-bg-primary)",
                color: active ? "var(--admin-primary)" : "var(--admin-text-secondary)",
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<Users style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.total.toLocaleString() : "—"}
          label="Total users"
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
          <FilterField label="Type">
            <select
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value as PlatformUserTypeFilter);
              }}
              className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            >
              <option value="">{t("admin.users.type_all")}</option>
              <option value="customers">{t("admin.users.type_customers")}</option>
              <option value="staff">{t("admin.users.type_staff")}</option>
              <option value="unverified">{t("admin.users.type_unverified")}</option>
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
          {activeChips.length > 0 ? (
            <V2Button type="button" size="md" onClick={clearAllFilters}>
              Clear
            </V2Button>
          ) : null}
        </FilterCard>
      </form>

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
          {showBulk && selectedIds.size > 0 ? (
            <div
              className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-[13px]"
              style={{ borderColor: "var(--admin-border)", backgroundColor: "var(--admin-primary-soft)" }}
            >
              <span className="font-medium text-fg-t8">{selectedIds.size} selected</span>
              <V2Button size="sm" disabled={bulkBusy} onClick={() => void bulkRemind()}>
                Send reminder
              </V2Button>
              <V2Button
                size="sm"
                disabled={bulkBusy}
                onClick={() => void bulkDelete()}
                style={{ color: "var(--admin-danger)", borderColor: "var(--admin-danger-light)" }}
              >
                Delete
              </V2Button>
              <button
                type="button"
                className="text-[12px] underline"
                style={{ color: "var(--admin-text-secondary)" }}
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </button>
            </div>
          ) : null}
          <table className="w-full border-collapse text-[13px]">
            <thead
              className="text-[11px] font-semibold uppercase tracking-[0.5px]"
              style={{ backgroundColor: "var(--admin-bg-secondary)", color: "var(--admin-text-secondary)" }}
            >
              <tr>
                {showBulk ? (
                  <th className="px-4 py-2.5 text-left" style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id))}
                      onChange={(e) =>
                        setSelectedIds(
                          e.target.checked ? new Set(filteredRows.map((r) => r.id)) : new Set()
                        )
                      }
                    />
                  </th>
                ) : null}
                <th className="px-4 py-2.5 text-left">User</th>
                <th className="px-4 py-2.5 text-left">Email</th>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-left">Companies</th>
                {/* Phase 4C+ (2026-05-31) — Bookings column for B2C customers
                    chip. Hidden for other chips since staff/agent rows don't
                    own customer-side orders. */}
                {typeFilter === "customers" ? (
                  <th className="px-4 py-2.5 text-right">Bookings</th>
                ) : null}
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Last seen</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={showBulk ? 8 : 7}
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
                  const typeTone = typeToneFor(primaryRole);
                  return (
                    <tr
                      key={r.id}
                      className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                    >
                      {showBulk ? (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${r.name}`}
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleSelected(r.id)}
                          />
                        </td>
                      ) : null}
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
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(typeTone)}>
                          {typeLabelFor(primaryRole)}
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
                      {/* Phase 4C+ (2026-05-31) — Bookings column for the
                          B2C customers chip. Cell only rendered when the
                          chip is active to keep the row narrow on other views. */}
                      {typeFilter === "customers" ? (
                        <td className="px-4 py-3 text-right text-[12px]" style={{ color: "var(--admin-text-primary)" }}>
                          {r.bookings_count ?? 0}
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusTone)}>
                          {statusLabelFor(r.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {formatRelativeTime(r.last_login_at ?? null)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton as="link" href={`/platform/users/${r.id}`} aria-label={k("admin.users.btn_edit", "View")}>
                            <Eye />
                          </IconButton>
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
                              ...(isSuperAdmin
                                ? [
                                    {
                                      key: "hard-delete",
                                      label: t("admin.users.btn_hard_delete"),
                                      icon: <Trash2 />,
                                      onSelect: () => { void hardDelete(r); },
                                      destructive: true,
                                    },
                                  ]
                                : []),
                            ]}
                          />
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
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} users
            </span>
            <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
          </div>
        ) : null}
      </V2Card>

      {/* Phase Զ.15 / Item 15 — PIN gate for destructive actions. */}
      <PinPromptDialog
        isOpen={pinGate !== null}
        title={pinGate?.title}
        description={pinGate?.description}
        onCancel={() => setPinGate(null)}
        onConfirm={async () => {
          if (pinGate) await pinGate.onConfirm();
        }}
      />
    </div>
  );
}
