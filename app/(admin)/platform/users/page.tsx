"use client";

/**
 * Figma layout reference: Quest CRM Copy template
 *   - Client Table (list pattern):           4393:6787
 *   - Settings/Admins (admin-list view):     10013:24500
 * Brand tokens: ZULU purple primary (--admin-primary).
 * Mobile rule: table converts to card list at <md.
 * Last synced: 2026-05-03
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { StatusPill } from "@/components/ui/StatusPill";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiDeactivatePlatformUser,
  apiPlatformUsers,
  type PlatformAdminUserRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

export default function PlatformUsersPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformAdminUserRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformUsers(token, { page, per_page: 20, search: search || undefined });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load users");
    }
  }, [token, allowed, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function deactivate(id: number) {
    if (!token || !window.confirm(`Deactivate user #${id}?`)) return;
    setBusyId(id);
    try {
      await apiDeactivatePlatformUser(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Deactivate failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Users</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice messageKey={!allowed ? "admin.forbidden.platform_users" : undefined} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="admin-page-title">Platform users</h1>
          {meta && (
            <p className="mt-1 text-sm text-fg-t6">
              {meta.total} total · page {meta.current_page} of {meta.last_page}
            </p>
          )}
        </div>
      </header>

      <form
        className="admin-card flex flex-wrap items-center gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <div className="relative min-w-[220px] flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-current text-fg-t6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            placeholder="Search name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-full rounded-zulu border border-default bg-white pl-9 pr-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Search
        </button>
      </form>

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      )}

      {/* Desktop / tablet table */}
      <div className="admin-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-default bg-figma-bg-1 text-xs font-medium uppercase tracking-wide text-fg-t6">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Companies</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-fg-t6">
                    No users found.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-default last:border-0 transition hover:bg-figma-bg-1">
                  <td className="px-4 py-3 tabular-nums text-fg-t7">{r.id}</td>
                  <td className="px-4 py-3 font-medium text-fg-t8">{r.name}</td>
                  <td className="px-4 py-3 text-fg-t7">{r.email}</td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3">
                    {r.companies && r.companies.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.companies.slice(0, 3).map((c, i) => (
                          <span key={i} className="rounded-full border border-default bg-figma-bg-1 px-2 py-0.5 text-xs text-fg-t7">
                            {c.name}
                            <span className="ml-1 text-fg-t6">({c.role})</span>
                          </span>
                        ))}
                        {r.companies.length > 3 && (
                          <span className="rounded-full border border-default bg-white px-2 py-0.5 text-xs text-fg-t6">
                            +{r.companies.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-fg-t6">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={busyId === r.id || r.status === "inactive"}
                      onClick={() => deactivate(r.id)}
                      className="inline-flex h-8 items-center rounded-zulu border border-error-200 bg-white px-3 text-xs font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 && (
          <div className="admin-card p-6 text-center text-sm text-fg-t6">No users found.</div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="admin-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-xs text-fg-t6">#{r.id}</div>
                <div className="truncate font-medium text-fg-t8">{r.name}</div>
                <div className="truncate text-xs text-fg-t6">{r.email}</div>
              </div>
              <StatusPill status={r.status} />
            </div>
            {r.companies && r.companies.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {r.companies.map((c, i) => (
                  <span key={i} className="rounded-full border border-default bg-figma-bg-1 px-2 py-0.5 text-xs text-fg-t7">
                    {c.name}
                    <span className="ml-1 text-fg-t6">({c.role})</span>
                  </span>
                ))}
              </div>
            )}
            <div className="border-t border-default pt-3">
              <button
                type="button"
                disabled={busyId === r.id || r.status === "inactive"}
                onClick={() => deactivate(r.id)}
                className="inline-flex h-9 w-full items-center justify-center rounded-zulu border border-error-200 bg-white px-3 text-sm font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
              >
                Deactivate
              </button>
            </div>
          </div>
        ))}
      </div>

      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
