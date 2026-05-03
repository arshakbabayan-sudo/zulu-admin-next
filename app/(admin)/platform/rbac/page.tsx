"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";

/**
 * Platform-admin RBAC oversight (Sprint 66, PART 28).
 *
 * Wires to backend:
 *   GET /api/platform-admin/rbac/stats
 *   GET /api/platform-admin/rbac/matrix
 */

type Permission = { id: number; name: string };
type RoleRow = {
  role_id: number;
  role_name: string;
  permissions: { permission_id: number; permission_name: string; granted: boolean }[];
};
type Stats = {
  total_roles: number;
  total_permissions: number;
  total_memberships: number;
  super_admins: number;
};

export default function PlatformRbacPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);

  const [stats, setStats] = useState<Stats | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const baseURL = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am",
    []
  );

  useEffect(() => {
    if (!allowed || !token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const [s, m] = await Promise.all([
          fetch(`${baseURL}/api/platform-admin/rbac/stats`, { headers }),
          fetch(`${baseURL}/api/platform-admin/rbac/matrix`, { headers }),
        ]);
        if (s.status === 403 || m.status === 403) {
          if (!cancelled) setForbidden(true);
          return;
        }
        const sJ = await s.json();
        const mJ = await m.json();
        if (cancelled) return;
        if (sJ?.success) setStats(sJ.data);
        if (mJ?.success) {
          setPermissions(mJ.data.permissions);
          setRoles(mJ.data.roles);
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
  }, [token, allowed, baseURL]);

  const filteredPermissions = useMemo(() => {
    if (!filter.trim()) return permissions;
    const q = filter.trim().toLowerCase();
    return permissions.filter((p) => p.name.toLowerCase().includes(q));
  }, [permissions, filter]);

  const filteredPermIds = useMemo(
    () => new Set(filteredPermissions.map((p) => p.id)),
    [filteredPermissions]
  );

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">Roles & permissions</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">Roles & permissions</h1>
      <p className="admin-page-subtitle">
        Read-only inventory of the seeded RBAC scheme. Use this for security audits
        before any fine-grained refactor.
      </p>

      {error && <p className="mt-2 text-sm text-error-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-fg-t6">Loading…</p>}

      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Roles" value={stats.total_roles.toLocaleString()} />
          <StatCard label="Permissions" value={stats.total_permissions.toLocaleString()} />
          <StatCard label="Memberships" value={stats.total_memberships.toLocaleString()} />
          <StatCard
            label="Super admins"
            value={stats.super_admins.toLocaleString()}
            tone="warn"
          />
        </div>
      )}

      <div className="mt-6 flex items-end gap-2 rounded border border-default bg-white p-4">
        <label className="flex-1 text-xs text-fg-t6">
          Filter permissions
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="e.g. inventory, payment, voucher"
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        {filter && (
          <button
            type="button"
            onClick={() => setFilter("")}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-figma-bg-1"
          >
            Reset
          </button>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left">Role</th>
              {filteredPermissions.map((p) => (
                <th
                  key={p.id}
                  className="px-2 py-2 text-center"
                  title={p.name}
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 && !loading && (
              <tr>
                <td colSpan={filteredPermissions.length + 1} className="px-3 py-6 text-center text-fg-t6">
                  No roles configured.
                </td>
              </tr>
            )}
            {roles.map((r) => (
              <tr key={r.role_id} className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 font-medium">{r.role_name}</td>
                {r.permissions
                  .filter((p) => filteredPermIds.has(p.permission_id))
                  .map((p) => (
                    <td key={p.permission_id} className="px-2 py-2 text-center">
                      {p.granted ? (
                        <span className="text-success-600 font-bold" title={p.permission_name}>
                          ✓
                        </span>
                      ) : (
                        <span className="text-fg-t7" title={p.permission_name}>
                          ·
                        </span>
                      )}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
