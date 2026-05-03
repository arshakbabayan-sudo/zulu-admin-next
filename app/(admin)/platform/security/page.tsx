"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";

/**
 * Platform-admin security oversight (Sprint 62, PART 29).
 *
 * Wires to backend:
 *   GET  /api/platform-admin/security/two-factor
 *   GET  /api/platform-admin/security/stats
 *   POST /api/platform-admin/security/users/{userId}/force-disable-2fa
 *   POST /api/platform-admin/security/users/{userId}/force-logout
 */

type TwoFactorRow = {
  id: number;
  user_id: number;
  enabled_at: string | null;
  confirmed_at: string | null;
  last_verified_at: string | null;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
    is_super_admin: boolean;
  };
};

type Meta = {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
};

type Stats = {
  total_users: number;
  two_factor_confirmed: number;
  two_factor_pending: number;
  two_factor_coverage_pct: number;
};

export default function PlatformSecurityPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<TwoFactorRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [appliedFilters, setAppliedFilters] = useState(0);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [forceLogoutUserId, setForceLogoutUserId] = useState("");

  const baseURL = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am",
    []
  );

  useEffect(() => {
    if (!allowed || !token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setForbidden(false);

    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("per_page", "50");
        if (q.trim()) params.set("q", q.trim());

        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const [listRes, statsRes] = await Promise.all([
          fetch(`${baseURL}/api/platform-admin/security/two-factor?${params.toString()}`, {
            headers,
          }),
          fetch(`${baseURL}/api/platform-admin/security/stats`, { headers }),
        ]);

        if (listRes.status === 403 || statsRes.status === 403) {
          if (!cancelled) setForbidden(true);
          return;
        }

        const listJson = await listRes.json();
        const statsJson = await statsRes.json();
        if (cancelled) return;

        if (listJson?.success) {
          setRows(listJson.data ?? []);
          setMeta(listJson.meta ?? null);
        } else {
          setError(listJson?.message ?? "Failed to load");
        }
        if (statsJson?.success) {
          setStats(statsJson.data);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) {
          setForbidden(true);
        } else {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, allowed, baseURL, page, appliedFilters]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  const forceDisable = async (row: TwoFactorRow) => {
    if (
      !confirm(
        `Force-disable 2FA for ${row.user?.name ?? "user #" + row.user_id}? They will be able to log in with password only until they re-enroll.`
      )
    )
      return;

    setActionLoading(`disable-${row.user_id}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `${baseURL}/api/platform-admin/security/users/${row.user_id}/force-disable-2fa`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }
      );
      const json = await res.json();
      if (json?.success) {
        setSuccess(`2FA disabled for user #${row.user_id}`);
        setAppliedFilters((n) => n + 1);
      } else {
        setError(json?.message ?? "Force-disable failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Force-disable failed");
    } finally {
      setActionLoading(null);
    }
  };

  const forceLogoutById = async (userId: number, userName?: string) => {
    if (
      !confirm(
        `Force-logout ${userName ?? "user #" + userId}? All sanctum tokens will be revoked and they'll need to re-authenticate.`
      )
    )
      return;

    setActionLoading(`logout-${userId}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `${baseURL}/api/platform-admin/security/users/${userId}/force-logout`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }
      );
      const json = await res.json();
      if (json?.success) {
        setSuccess(
          `Force-logout: ${json.data.tokens_revoked} token(s) revoked for user #${userId}`
        );
      } else {
        setError(json?.message ?? "Force-logout failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Force-logout failed");
    } finally {
      setActionLoading(null);
    }
  };

  const submitForceLogout = async () => {
    const id = parseInt(forceLogoutUserId.trim(), 10);
    if (isNaN(id) || id <= 0) {
      setError("Enter a valid user ID");
      return;
    }
    await forceLogoutById(id);
    setForceLogoutUserId("");
  };

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">Security</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">Security</h1>
      <p className="admin-page-subtitle">
        Two-factor authentication coverage and incident-response actions.
      </p>

      {error && <p className="mt-2 text-sm text-error-600">{error}</p>}
      {success && <p className="mt-2 text-sm text-success-700">{success}</p>}

      {/* Stats */}
      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total users" value={stats.total_users.toLocaleString()} />
          <StatCard
            label="2FA enabled"
            value={stats.two_factor_confirmed.toLocaleString()}
            tone="good"
          />
          <StatCard
            label="2FA pending"
            value={stats.two_factor_pending.toLocaleString()}
            tone={stats.two_factor_pending > 0 ? "warn" : "neutral"}
          />
          <StatCard
            label="Coverage"
            value={`${stats.two_factor_coverage_pct}%`}
            tone={stats.two_factor_coverage_pct >= 50 ? "good" : "warn"}
          />
        </div>
      )}

      {/* Force-logout by ID */}
      <div className="mt-6 rounded border border-error-300 bg-error-50 p-4">
        <h2 className="text-sm font-semibold text-error-700">Incident response</h2>
        <p className="mt-1 text-xs text-error-600">
          Force-logout works on any user (not just those with 2FA). Use after a credential leak.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={forceLogoutUserId}
            onChange={(e) => setForceLogoutUserId(e.target.value)}
            placeholder="User ID"
            className="rounded border border-default px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={submitForceLogout}
            disabled={!forceLogoutUserId.trim() || actionLoading !== null}
            className="rounded bg-error-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-error-700 disabled:opacity-50"
          >
            Force-logout
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mt-6 flex flex-wrap items-end gap-2 rounded border border-default bg-white p-4">
        <label className="flex-1 text-xs text-fg-t6">
          Search 2FA users (name or email)
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={applyFilters}
          className="rounded bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
        >
          Apply
        </button>
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setPage(1);
              setAppliedFilters((n) => n + 1);
            }}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-figma-bg-1"
          >
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Confirmed at</th>
              <th className="px-3 py-2">Last verified</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-fg-t6">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-fg-t6">
                  No 2FA-enabled users found.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 text-xs">
                  {r.user?.name ?? `#${r.user_id}`}
                  {r.user?.email && <div className="text-fg-t6">{r.user.email}</div>}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.user?.is_super_admin ? (
                    <span className="rounded bg-warning-50 px-2 py-0.5 text-warning-700">
                      super admin
                    </span>
                  ) : (
                    <span className="text-fg-t7">{r.user?.role ?? "—"}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-fg-t7">
                  {r.confirmed_at ? new Date(r.confirmed_at).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-fg-t7">
                  {r.last_verified_at ? new Date(r.last_verified_at).toLocaleString() : "Never"}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      type="button"
                      onClick={() => forceLogoutById(r.user_id, r.user?.name)}
                      disabled={actionLoading !== null}
                      className="text-xs text-warning-700 hover:underline disabled:opacity-40"
                    >
                      {actionLoading === `logout-${r.user_id}` ? "…" : "Force-logout"}
                    </button>
                    <button
                      type="button"
                      onClick={() => forceDisable(r)}
                      disabled={actionLoading !== null}
                      className="text-xs text-error-700 hover:underline disabled:opacity-40"
                    >
                      {actionLoading === `disable-${r.user_id}` ? "…" : "Disable 2FA"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-fg-t6">
            Page {meta.current_page} of {meta.last_page} ({meta.total.toLocaleString()} entries)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border border-default bg-white px-3 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              disabled={page >= meta.last_page}
              className="rounded border border-default bg-white px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-success-600"
      : tone === "warn"
        ? "text-warning-600"
        : "text-fg-t11";
  return (
    <div className="admin-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-fg-t6">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
