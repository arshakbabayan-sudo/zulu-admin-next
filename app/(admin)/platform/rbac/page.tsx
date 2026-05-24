"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav, isSuperAdminRole } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { Button, FormField, Input, PageHeader } from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  StatCard as V2StatCard,
  StatGrid,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
} from "@/components/ui/v2";
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

    void (async () => {
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

  // ─── 2026-05-24 — 8-section IA: company-scoped role filter ────────────
  // Platform-scoped roles (super_admin, platform_admin) must NEVER be
  // visible to non-super viewers. Company-scoped roles are: owner, booker,
  // finance, content, viewer (the canonical company role set).
  //
  // ⚠️ This is UI-level only. Backend assignment whitelist enforcement is
  // a separate task — see backend endpoint POST /api/platform-admin/users/
  // {id}/roles which still accepts any role id from a non-super caller and
  // must reject platform-scoped ids server-side. Tracked in
  // MIGRATION_TODO.md → "Backend follow-ups" section.
  const COMPANY_SCOPED_ROLE_NAMES = new Set([
    "owner",
    "booker",
    "finance",
    "content",
    "viewer",
  ]);
  const visibleRoles = useMemo(() => {
    if (isSuperAdminRole(user)) return roles;
    return roles.filter((r) => COMPANY_SCOPED_ROLE_NAMES.has(r.role_name.toLowerCase()));
  }, [roles, user]);

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
    <div>
      {/* v2 admin-redesign — RBAC page chrome. Matches docs/zulu-admin-v2.html
          page-view#roles (lines 799-859). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: t("admin.rbac.title") },
        ]}
        title={t("admin.rbac.title")}
        subtitle={t("admin.rbac.subtitle")}
      />

      {error && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{error}</div>}
      {loading && <p className="mb-4 text-sm text-fg-t6">{t("common.loading")}</p>}

      {stats && (
        <StatGrid cols={4} className="mb-4">
          <V2StatCard value={formatNumber(stats.total_roles, lang)} label={t("admin.rbac.stat_roles")} />
          <V2StatCard value={formatNumber(stats.total_permissions, lang)} label={t("admin.rbac.stat_permissions")} />
          <V2StatCard value={formatNumber(stats.total_memberships, lang)} label={t("admin.rbac.stat_memberships")} />
          <V2StatCard
            value={<span style={{ color: "var(--admin-warning)" }}>{formatNumber(stats.super_admins, lang)}</span>}
            label={t("admin.rbac.stat_super_admins")}
          />
        </StatGrid>
      )}

      <FilterCard>
        <FilterField label={t("admin.rbac.filter_permissions")} minWidth={280}>
          <Input
            id="rbac-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("admin.rbac.filter_placeholder")}
            className="!h-[34px]"
          />
        </FilterField>
        {filter ? (
          <V2Button size="sm" onClick={() => setFilter("")}>
            {t("common.reset")}
          </V2Button>
        ) : null}
      </FilterCard>

      <V2Card className="overflow-x-auto">
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
            {visibleRoles.length === 0 && !loading && (
              <tr>
                <td colSpan={filteredPermissions.length + 1} className="px-3 py-6 text-center text-fg-t6">
                  {t("admin.rbac.empty")}
                </td>
              </tr>
            )}
            {visibleRoles.map((r) => (
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
      </V2Card>
    </div>
  );
}
