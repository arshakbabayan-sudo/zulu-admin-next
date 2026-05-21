"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { Button, FormField, Input, PageHeader } from "@/components/ui";
import { formatNumber } from "@/lib/format";

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
  const { t, lang } = useLanguage();
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
          fetch(`${baseURL}/platform-admin/rbac/stats`, { headers }),
          fetch(`${baseURL}/platform-admin/rbac/matrix`, { headers }),
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
          setError(e instanceof Error ? e.message : t("admin.rbac.err_load"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, allowed, baseURL, t]);

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
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.rbac.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.rbac.title")} subtitle={t("admin.rbac.subtitle")} />

      {error && <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{error}</div>}
      {loading && <p className="text-sm text-fg-t6">{t("common.loading")}</p>}

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t("admin.rbac.stat_roles")} value={formatNumber(stats.total_roles, lang)} />
          <StatCard label={t("admin.rbac.stat_permissions")} value={formatNumber(stats.total_permissions, lang)} />
          <StatCard label={t("admin.rbac.stat_memberships")} value={formatNumber(stats.total_memberships, lang)} />
          <StatCard
            label={t("admin.rbac.stat_super_admins")}
            value={formatNumber(stats.super_admins, lang)}
            tone="warn"
          />
        </div>
      )}

      <div className="admin-card p-4">
        <div className="flex items-end gap-2">
          <FormField label={t("admin.rbac.filter_permissions")} htmlFor="rbac-filter" className="flex-1">
            <Input
              id="rbac-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("admin.rbac.filter_placeholder")}
            />
          </FormField>
          {filter && <Button variant="outline" size="sm" onClick={() => setFilter("")}>{t("common.reset")}</Button>}
        </div>
      </div>

      <div className="overflow-x-auto rounded-zulu border border-default bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7 sticky top-0">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">{t("admin.rbac.col_role")}</th>
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
                  {t("admin.rbac.empty")}
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
                          вњ“
                        </span>
                      ) : (
                        <span className="text-fg-t7" title={p.permission_name}>
                          В·
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
