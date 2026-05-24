"use client";

/**
 * Users — v2 admin-redesign page (2026-05-24).
 * Mockup: docs/zulu-admin-v2.html page-view#users (lines 751-794).
 *
 * Layout:
 *   PageHeader (breadcrumb + title + actions)
 *   4 stat cards (Total / Active today / New (7d) / Pending verification)
 *   FilterCard (Search + Type select + Search button)
 *   Card → Table (checkbox + ID + Name+avatar + Email + Status + Companies + Actions)
 *
 * 2026-05-24 wiring: now backed by real /platform-admin/users (apiPlatformUsers).
 * The 4 stat cards use meta.total for Total; Active today / New / Pending derive
 * from the current page's rows only — a dedicated /platform-admin/users/stats
 * endpoint would be required for true platform-wide counts (flagged below as
 * Phase 2). `last_login_at` shipped 2026-05-24 (backend commit 138e19c) so
 * "Active today" is now real.
 *
 * Export button writes a client-side CSV from the loaded rows. A real
 * server-side `/platform-admin/users/export` would be required to export the
 * full dataset (this is a Phase 2 follow-up).
 * "Add user" links to /auth/signup — there is no admin-create-user flow yet.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Edit3 } from "lucide-react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiPlatformUsers,
  type PlatformAdminUserRow,
  type PlatformUserTypeFilter,
} from "@/lib/platform-admin-api";
import {
  PageHeader,
  StatCard,
  StatGrid,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  IconButton,
} from "@/components/ui/v2";

function tx(t: (k: string) => string, key: string, fallback: string): string {
  const r = t(key);
  return r === key ? fallback : r;
}

function getInitials(name: string): string {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// v2 admin-redesign — deterministic avatar tone picker (matches bucket3/employees).
function pickAvatarTone(id: number | string): "purple" | "teal" | "amber" | "blue" {
  const tones: Array<"purple" | "teal" | "amber" | "blue"> = ["purple", "teal", "amber", "blue"];
  const n = typeof id === "number" ? id : id.length;
  return tones[n % tones.length]!;
}

function avatarStyle(tone: "purple" | "teal" | "amber" | "blue"): React.CSSProperties {
  const map: Record<"purple" | "teal" | "amber" | "blue", React.CSSProperties> = {
    purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
    teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  };
  return map[tone];
}

const PER_PAGE = 20;

export default function AdminRedesignUsersPage() {
  const { t } = useLanguage();
  const { token, user } = useAdminAuth();
  useDocumentTitle("Users — ZULU Admin");

  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<PlatformAdminUserRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<PlatformUserTypeFilter>("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await apiPlatformUsers(token, {
        page,
        per_page: PER_PAGE,
        search: search || undefined,
        type: typeFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) {
        setForbidden(true);
      } else {
        setErr(
          e instanceof ApiRequestError
            ? e.message
            : tx(t, "admin.users.err_load", "Failed to load users.")
        );
      }
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, search, typeFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounced search — fire 350ms after typing stops.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput.trim() !== search) {
        setPage(1);
        setSearch(searchInput.trim());
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput, search]);

  // Phase 2 note: these derive from the current page only. A
  // /platform-admin/users/stats endpoint would give true platform-wide counts.
  // `last_login_at` now ships on the API row (backend commit 138e19c, 2026-05-24)
  // so Active today counts rows whose last login lies within the last 24h.
  const now = Date.now();
  const new7d = rows.filter((r) => {
    if (!r.created_at) return false;
    const created = new Date(r.created_at).getTime();
    return Number.isFinite(created) && now - created < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const activeToday = rows.filter((r) => {
    const lastLogin = r.last_login_at;
    if (!lastLogin) return false;
    const ts = new Date(lastLogin).getTime();
    return Number.isFinite(ts) && now - ts < 24 * 60 * 60 * 1000;
  }).length;
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  };
  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <PageHeader
          breadcrumb={[
            { label: "Home", href: "/dashboard" },
            { label: tx(t, "admin.nav.section.users_v2", "Users") },
          ]}
          title={tx(t, "admin.nav.section.users_v2", "Users")}
        />
        <V2Card>
          <div className="p-4">
            <ForbiddenNotice messageKey={!allowed ? "admin.forbidden.platform_users" : undefined} />
          </div>
        </V2Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: tx(t, "admin.nav.section.users_v2", "Users") },
        ]}
        title={tx(t, "admin.nav.section.users_v2", "Users")}
        subtitle={
          meta
            ? tx(
                t,
                "admin.users.meta_summary",
                `${meta.total} users • page ${meta.current_page} of ${meta.last_page}`,
              )
                .replace("{total}", String(meta.total))
                .replace("{current}", String(meta.current_page))
                .replace("{last}", String(meta.last_page))
            : tx(t, "admin.users.subtitle", "Manage platform users across all roles")
        }
        actions={
          <>
            <V2Button
              icon={<DownloadIcon />}
              onClick={() => downloadUsersCsv(rows)}
              disabled={rows.length === 0}
              title={tx(
                t,
                "admin.users.export_tooltip",
                "Download the currently-loaded rows as CSV.",
              )}
            >
              {tx(t, "admin.dashboard.export", "Export")}
            </V2Button>
            {/* No admin-create-user flow yet — point to the public signup page. */}
            <V2Button
              as="link"
              href="/auth/signup"
              variant="primary"
              icon={<PlusIcon />}
            >
              {tx(t, "admin.users.add", "Add user")}
            </V2Button>
          </>
        }
      />

      <StatGrid cols={4} className="mb-4">
        <StatCard
          value={meta ? meta.total.toLocaleString() : "—"}
          label={tx(t, "admin.users.stat.total", "Total users")}
        />
        <StatCard
          // last_login_at shipped 2026-05-24 (backend commit 138e19c). Counts
          // rows on the current page whose last login was within 24h.
          value={
            <span style={{ color: activeToday > 0 ? "var(--admin-success)" : undefined }}>
              {activeToday}
            </span>
          }
          label={tx(t, "admin.users.stat.active_today", "Active today — this page")}
        />
        <StatCard
          value={`+${new7d}`}
          label={tx(t, "admin.users.stat.new_7d", "New (7d) — this page")}
        />
        <StatCard
          value={
            <span style={{ color: pendingCount > 0 ? "var(--admin-warning)" : undefined }}>
              {pendingCount}
            </span>
          }
          label={tx(t, "admin.users.stat.pending", "Pending verification — this page")}
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
          <FilterField label={tx(t, "common.search", "Search")} minWidth={240}>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={tx(t, "admin.users.search_placeholder", "Name, email, ID...")}
              className="h-[34px] w-full rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            />
          </FilterField>
          <FilterField label={tx(t, "admin.users.type", "Type")}>
            <select
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value as PlatformUserTypeFilter);
              }}
              className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            >
              <option value="">{tx(t, "common.all", "All")}</option>
              <option value="customers">{tx(t, "admin.users.type_customer", "Customers")}</option>
              <option value="staff">{tx(t, "admin.users.type_staff", "Staff")}</option>
              <option value="unverified">{tx(t, "admin.users.type_unverified", "Unverified")}</option>
            </select>
          </FilterField>
          <V2Button type="submit" variant="primary" size="sm">
            {tx(t, "common.search", "Search")}
          </V2Button>
        </FilterCard>
      </form>

      {err ? (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      ) : null}

      <V2Card>
        <table className="w-full border-collapse text-[13px]">
          <thead style={{ backgroundColor: "var(--admin-bg-secondary)" }}>
            <tr>
              <th className="px-4 py-2.5 text-left" style={{ width: 32 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              {[
                { label: tx(t, "admin.users.col_id", "ID"), key: "id" },
                { label: tx(t, "admin.users.col_name", "Name"), key: "name" },
                { label: tx(t, "admin.users.col_email", "Email"), key: "email" },
                { label: tx(t, "admin.users.col_status", "Status"), key: "status" },
                { label: tx(t, "admin.users.col_companies", "Companies"), key: "companies" },
              ].map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  {col.label}
                </th>
              ))}
              <th
                className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.5px]"
                style={{ color: "var(--admin-text-secondary)" }}
              >
                {tx(t, "admin.users.col_actions", "Actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[12px]"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  {tx(t, "admin.users.empty", "No users found.")}
                </td>
              </tr>
            ) : null}
            {rows.map((u) => {
              const statusColor =
                u.status === "active"
                  ? "var(--admin-success)"
                  : u.status === "pending"
                    ? "var(--admin-warning)"
                    : u.status === "suspended" || u.status === "banned"
                      ? "var(--admin-danger)"
                      : "var(--admin-text-tertiary)";
              const tone = pickAvatarTone(u.id);
              const initials = getInitials(u.name);
              return (
                <tr
                  key={u.id}
                  className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                  style={{ borderColor: "var(--admin-border)" }}
                >
                  <td className="px-4 py-3 align-middle">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleRow(u.id)}
                      aria-label={`Select ${u.name}`}
                    />
                  </td>
                  <td
                    className="px-4 py-3 align-middle font-mono text-[12px]"
                    style={{ color: "var(--admin-text-secondary)" }}
                  >
                    #{u.id}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                        style={avatarStyle(tone)}
                        aria-hidden
                      >
                        {initials}
                      </span>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">{u.email}</td>
                  <td className="px-4 py-3 align-middle">
                    <span className="inline-flex items-center gap-1.5 text-[12px]">
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: statusColor }}
                      />
                      <span className="capitalize">{u.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {u.companies && u.companies.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {u.companies.slice(0, 3).map((c, idx) => (
                          <span
                            key={`${u.id}-co-${idx}`}
                            className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                            style={{
                              backgroundColor:
                                idx === 0
                                  ? "var(--admin-primary-light)"
                                  : "var(--admin-bg-tertiary)",
                              color:
                                idx === 0
                                  ? "var(--admin-primary-dark)"
                                  : "var(--admin-text-secondary)",
                            }}
                          >
                            {c.name}
                          </span>
                        ))}
                        {u.companies.length > 3 ? (
                          <span
                            className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                            style={{
                              backgroundColor: "var(--admin-bg-tertiary)",
                              color: "var(--admin-text-tertiary)",
                            }}
                          >
                            +{u.companies.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span style={{ color: "var(--admin-text-tertiary)" }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {/*
                     * Phase 2 follow-up: the "More actions" dropdown (View / Edit
                     * / Hard-delete) lives on the v1 page /platform/users with
                     * the full PIN-gated hard-delete + anonymize flow. To avoid
                     * duplicating that logic here we point the Edit IconButton
                     * to the detail page (which doubles as a profile viewer)
                     * and omit a separate kebab menu.
                     */}
                    <div className="flex justify-end gap-1">
                      <IconButton
                        as="link"
                        href={`/platform/users/${u.id}`}
                        aria-label={tx(t, "admin.users.btn_edit", "Edit")}
                      >
                        <Edit3 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </V2Card>

      {meta && meta.last_page > 1 ? (
        <div className="mt-4 flex items-center justify-between text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
          <div>
            {tx(t, "common.page", "Page")} {meta.current_page} / {meta.last_page}
          </div>
          <div className="flex gap-2">
            <V2Button
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.current_page <= 1}
            >
              {tx(t, "common.previous", "Previous")}
            </V2Button>
            <V2Button
              size="sm"
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              disabled={meta.current_page >= meta.last_page}
            >
              {tx(t, "common.next", "Next")}
            </V2Button>
          </div>
        </div>
      ) : null}

      {/* Phase 2 hint for the stat cards — they currently only count current page. */}
      <p className="mt-3 text-[11px]" style={{ color: "var(--admin-text-tertiary)" }}>
        {tx(
          t,
          "admin.users.stats_phase2_note",
          "Note: Active/New/Pending stat values count the current page only. A dedicated /platform-admin/users/stats endpoint will provide true platform-wide counts.",
        )}
      </p>
      {/* Fallback link if the user wants the full v1 page with delete actions etc. */}
      <p className="mt-2 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
        <Link href="/platform/users" className="underline">
          {tx(t, "admin.users.open_full_page", "Open full users management →")}
        </Link>
      </p>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/**
 * Client-side CSV export of the currently-loaded user rows. We do not paginate
 * the export — that would need a dedicated `/platform-admin/users/export`
 * endpoint with proper RBAC. Until that ships, exporting the visible page is
 * still useful for spot-checking and ad-hoc audits.
 */
function downloadUsersCsv(rows: PlatformAdminUserRow[]): void {
  if (rows.length === 0) return;
  const escape = (s: string): string =>
    /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  const header = ["id", "name", "email", "status", "created_at", "last_login_at", "companies"];
  const lines = rows.map((r) =>
    [
      String(r.id),
      escape(r.name),
      escape(r.email),
      r.status,
      r.created_at ?? "",
      r.last_login_at ?? "",
      escape(r.companies?.map((c) => c.name).join(" | ") ?? ""),
    ].join(",")
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
