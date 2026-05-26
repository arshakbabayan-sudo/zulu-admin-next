"use client";

/**
 * v2 admin-redesign — Unverified accounts (Marketplace ops group, Bucket 3).
 *
 * Source spec: docs/admin_designe/marketplace_ops/marketplace_ops_implementation_prompt.md §3.I
 * Mockup: docs/admin_designe/marketplace_ops/marketplace_ops_mocks.html (PAGE 9).
 *
 * Migrated 2026-05-26. Surfaces users where attention is still needed:
 * status='pending' OR never confirmed their email. Backend sorts oldest first.
 *
 * Bulk actions (Send reminder / Delete accounts) are wired to the UI but the
 * underlying /platform-admin/unverified-accounts/bulk-remind and /bulk-delete
 * endpoints have not been built yet — the buttons appear disabled with a
 * tooltip. See TODO inside `handleBulkRemind` / `handleBulkDelete` below.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
import { apiUnverifiedAccountsStats, type UnverifiedAccountsStats } from "@/lib/marketplace-stats-api";
import {
  STATUS_BADGE_CLASS,
  avatarInitials,
  avatarStyle,
  formatRelativeTime,
  pickAvatarTone,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
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
  Clock,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserPlus,
  X as XIcon,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type UnverifiedRow = {
  id: number;
  name: string;
  email: string;
  status: string;
  email_verified_at: string | null;
  intended_role: string | null;
  created_at: string | null;
  companies: { id: number; name: string; role: string }[];
  // Optional fields — backend may not populate these yet.
  phone?: string | null;
  phone_verified_at?: string | null;
  last_reminder_sent_at?: string | null;
};

type MissingFilter = "" | "email" | "phone" | "both";
type AgeFilter = "" | "lt24h" | "1to7d" | "gt7d";

async function fetchUnverified(
  token: string,
  page: number,
  search: string
): Promise<ApiSuccessEnvelope<UnverifiedRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", "25");
  if (search) q.set("search", search);
  return apiFetchJson(`/platform-admin/unverified-accounts?${q.toString()}`, {
    method: "GET",
    token,
  });
}

function verificationStatus(row: UnverifiedRow): { tone: StatusTone; label: string } {
  const emailOk = Boolean(row.email_verified_at);
  const phoneOk = Boolean(row.phone_verified_at);
  if (!emailOk && !phoneOk) return { tone: "danger", label: "Both missing" };
  if (!emailOk) return { tone: "warning", label: "Email missing" };
  if (!phoneOk) return { tone: "warning", label: "Phone missing" };
  return { tone: "success", label: "Verified" };
}

function ageInDays(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

export default function Bucket3UnverifiedAccountsPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<UnverifiedRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [stats, setStats] = useState<UnverifiedAccountsStats | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [missingFilter, setMissingFilter] = useState<MissingFilter>("");
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("");
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
      const res = await fetchUnverified(token, page, search.trim());
      setRows(res.data);
      setMeta(res.meta);
      // Drop selections that no longer appear.
      setSelectedIds((prev) => {
        const next = new Set<number>();
        for (const r of res.data) if (prev.has(r.id)) next.add(r.id);
        return next;
      });
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load unverified accounts");
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiUnverifiedAccountsStats(token)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      const v = verificationStatus(r);
      if (missingFilter === "email" && v.label !== "Email missing") return false;
      if (missingFilter === "phone" && v.label !== "Phone missing") return false;
      if (missingFilter === "both" && v.label !== "Both missing") return false;
      if (ageFilter) {
        const age = ageInDays(r.created_at);
        if (age == null) return false;
        if (ageFilter === "lt24h" && age >= 1) return false;
        if (ageFilter === "1to7d" && (age < 1 || age > 7)) return false;
        if (ageFilter === "gt7d" && age <= 7) return false;
      }
      return true;
    });
  }, [rows, missingFilter, ageFilter]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (missingFilter) {
      const lbl =
        missingFilter === "email"
          ? "Email only"
          : missingFilter === "phone"
            ? "Phone only"
            : "Both";
      chips.push({
        key: "missing",
        label: `Missing: ${lbl}`,
        clear: () => setMissingFilter(""),
      });
    }
    if (ageFilter) {
      const lbl =
        ageFilter === "lt24h"
          ? "Less than 24h"
          : ageFilter === "1to7d"
            ? "1-7 days"
            : "More than 7 days";
      chips.push({
        key: "age",
        label: `Age: ${lbl}`,
        clear: () => setAgeFilter(""),
      });
    }
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `“${search.trim()}”`,
        clear: () => {
          setPage(1);
          setSearch("");
          setSearchDraft("");
        },
      });
    }
    return chips;
  }, [missingFilter, ageFilter, search]);

  function clearAllFilters() {
    setPage(1);
    setMissingFilter("");
    setAgeFilter("");
    setSearch("");
    setSearchDraft("");
  }

  function toggleRow(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      if (prev.size === visibleRows.length) return new Set();
      return new Set(visibleRows.map((r) => r.id));
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkRemind() {
    // TODO: wire to /platform-admin/unverified-accounts/bulk-remind once
    // backend ships the endpoint. Stub left in place so the UI stays honest:
    // disabled state in the bulk-action bar shows the missing capability.
    alert("Bulk endpoints pending backend implementation.");
  }

  async function handleBulkDelete() {
    // TODO: wire to /platform-admin/unverified-accounts/bulk-delete once
    // backend ships the endpoint.
    alert("Bulk endpoints pending backend implementation.");
  }

  async function handleSingleRemind(id: number) {
    // TODO: wire to /platform-admin/unverified-accounts/{id}/remind once
    // backend ships the endpoint. Kept as a per-row affordance per spec 3.I.
    alert(`Reminder for #${id}: endpoint pending backend implementation.`);
  }

  async function handleSingleDelete(id: number) {
    if (!confirm(`Delete unverified account #${id}? This cannot be undone.`)) return;
    // TODO: wire to /platform-admin/users/{id}/anonymize once we decide which
    // delete semantics to use for stragglers (hard vs soft). For now, surface
    // the missing wiring honestly.
    alert(`Delete #${id}: endpoint pending product decision (soft vs hard).`);
  }

  // Bulk endpoints not yet shipped — the buttons must communicate that.
  const bulkEndpointsAvailable = false;

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.bucket3.unverified_accounts.title")}</h1>
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
          { label: t("admin.bucket3.unverified_accounts.title") },
        ]}
        title={t("admin.bucket3.unverified_accounts.title")}
        subtitle={
          meta
            ? t("admin.bucket3.unverified_accounts.subtitle_count").replace("{count}", String(meta.total))
            : t("admin.bucket3.unverified_accounts.subtitle")
        }
        actions={
          <>
            <V2Button onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh">
              {""}
            </V2Button>
            <V2Button
              icon={<Mail className="h-4 w-4" />}
              disabled={!bulkEndpointsAvailable}
              title={bulkEndpointsAvailable ? undefined : "Bulk endpoints pending backend"}
            >
              Send reminder to all
            </V2Button>
          </>
        }
      />

      <MarketplaceOpsSectionTabs
        activeHref="/bucket3/unverified-accounts"
        counts={{ unverifiedAccounts: stats?.total ?? meta?.total }}
      />

      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<UserPlus style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.total.toLocaleString() : "—"}
          label="Total unverified"
        />
        <StatCard
          icon={<Mail style={{ color: "var(--admin-warning)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.no_email.toLocaleString() : "—"}
          label="No email verified"
        />
        <StatCard
          icon={<Phone style={{ color: "var(--admin-info)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.no_phone.toLocaleString() : "—"}
          label="No phone verified"
        />
        <StatCard
          icon={<Clock style={{ color: "var(--admin-danger)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.old_7d.toLocaleString() : "—"}
          label="Older than 7 days"
        />
      </StatGrid>

      {/* Bulk action bar — shows only when checkboxes are selected. */}
      {selectedIds.size > 0 ? (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            backgroundColor: "var(--admin-primary-soft)",
            borderColor: "var(--admin-primary-light)",
            color: "var(--admin-primary)",
          }}
        >
          <span className="font-semibold">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <button
            type="button"
            disabled={!bulkEndpointsAvailable}
            onClick={() => void handleBulkRemind()}
            title={bulkEndpointsAvailable ? undefined : "Bulk endpoints pending backend"}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-3 text-[12px] font-medium transition hover:opacity-80 disabled:opacity-40"
            style={{ color: "var(--admin-text-primary)", borderColor: "var(--admin-border)" }}
          >
            <Send className="h-3.5 w-3.5" />
            Send reminder
          </button>
          <button
            type="button"
            disabled={!bulkEndpointsAvailable}
            onClick={() => void handleBulkDelete()}
            title={bulkEndpointsAvailable ? undefined : "Bulk endpoints pending backend"}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold text-white transition disabled:opacity-40"
            style={{ backgroundColor: "var(--admin-danger)" }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete accounts
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex h-8 items-center rounded-md px-3 text-[12px] font-medium transition hover:opacity-80"
            style={{ color: "var(--admin-text-secondary)", backgroundColor: "transparent" }}
          >
            Clear
          </button>
        </div>
      ) : null}

      <FilterCard>
        <FilterField label="Missing">
          <select
            value={missingFilter}
            onChange={(e) => setMissingFilter(e.target.value as MissingFilter)}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">Any</option>
            <option value="email">Email only</option>
            <option value="phone">Phone only</option>
            <option value="both">Both</option>
          </select>
        </FilterField>
        <FilterField label="Age">
          <select
            value={ageFilter}
            onChange={(e) => setAgeFilter(e.target.value as AgeFilter)}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">All</option>
            <option value="lt24h">Less than 24h</option>
            <option value="1to7d">1-7 days</option>
            <option value="gt7d">More than 7 days</option>
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
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setSearch(searchDraft.trim());
                }
              }}
              placeholder={t("admin.bucket3.unverified_accounts.search_placeholder")}
              className="h-[34px] w-full rounded-md border bg-white pl-9 pr-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            />
          </div>
        </FilterField>
        <V2Button
          variant="primary"
          size="md"
          onClick={() => {
            setPage(1);
            setSearch(searchDraft.trim());
          }}
        >
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
                <th className="w-8 px-4 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={visibleRows.length > 0 && selectedIds.size === visibleRows.length}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-2.5 text-left">User</th>
                <th className="px-4 py-2.5 text-left">Email</th>
                <th className="px-4 py-2.5 text-left">Phone</th>
                <th className="px-4 py-2.5 text-left">Verification</th>
                <th className="px-4 py-2.5 text-left">Registered</th>
                <th className="px-4 py-2.5 text-left">Last reminder</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    Loading…
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    {t("admin.bucket3.unverified_accounts.empty")}
                  </td>
                </tr>
              ) : (
                visibleRows.map((u) => {
                  const tone = pickAvatarTone(u.id);
                  const v = verificationStatus(u);
                  const isSelected = selectedIds.has(u.id);
                  const role = u.intended_role ?? (u.companies && u.companies[0]?.role) ?? "Customer";
                  return (
                    <tr
                      key={u.id}
                      className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(u.id)}
                          aria-label={`Select user ${u.id}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                            style={avatarStyle(tone)}
                            aria-hidden
                          >
                            {avatarInitials(u.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-fg-t8">{u.name}</div>
                            <div className="truncate text-[11px] capitalize" style={{ color: "var(--admin-text-tertiary)" }}>
                              {role}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px]">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-fg-t8">{u.email}</span>
                          {u.email_verified_at ? (
                            <span
                              className={STATUS_BADGE_CLASS}
                              style={statusBadgeStyle("success")}
                              title={formatDate(u.email_verified_at, lang)}
                            >
                              verified
                            </span>
                          ) : (
                            <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle("danger")}>
                              unverified
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px]">
                        {u.phone ? (
                          <div className="flex items-center gap-2">
                            <span className="text-fg-t8">{u.phone}</span>
                            {u.phone_verified_at ? (
                              <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle("success")}>
                                verified
                              </span>
                            ) : (
                              <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle("danger")}>
                                unverified
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--admin-text-tertiary)" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(v.tone)}>
                          {v.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }} title={u.created_at ?? undefined}>
                        {formatRelativeTime(u.created_at)}
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {u.last_reminder_sent_at ? formatRelativeTime(u.last_reminder_sent_at) : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton aria-label="Send reminder" onClick={() => void handleSingleRemind(u.id)}>
                            <Mail />
                          </IconButton>
                          <IconButton aria-label="Delete" onClick={() => void handleSingleDelete(u.id)}>
                            <Trash2 />
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
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} unverified accounts
            </span>
            <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={(p) => setPage(p)} />
          </div>
        ) : null}
      </V2Card>
    </div>
  );
}
