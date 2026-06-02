"use client";

/**
 * Platform-admin RBAC management — v2 redesign (2026-05-24).
 *
 * Two-card layout matching docs/zulu-admin-v2.html lines 799-859:
 *
 *   Card 1 — Role overview
 *     • Badge name · description · members · permissions count
 *     • Edit / Delete IconButtons (gated by scope + super-admin)
 *     • "Add role" V2Button in card header → opens drawer
 *     • Clicking a row selects the role for Card 2.
 *
 *   Card 2 — Permission matrix
 *     • Module-grouped checkbox grid for the currently selected role
 *     • Columns: View / Create / Edit / Delete / Export (aliases UPDATE
 *       and MANAGE respectively)
 *     • Live toggles call PUT /rbac/roles/{id}/permissions (full sync)
 *     • Filter input + Reset button in header
 *
 * Backend endpoints:
 *   GET    /platform-admin/rbac/stats
 *   GET    /platform-admin/rbac/roles
 *   GET    /platform-admin/rbac/permissions
 *   POST   /platform-admin/rbac/roles
 *   PATCH  /platform-admin/rbac/roles/{id}
 *   DELETE /platform-admin/rbac/roles/{id}    (422 if memberships > 0)
 *   PUT    /platform-admin/rbac/roles/{id}/permissions  (sync, not append)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Edit3, Trash2, Plus, Download, X, ShieldCheck } from "lucide-react";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav, isSuperAdminRole } from "@/lib/access";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PinPromptDialog } from "@/components/PinPromptDialog";
import { RbacMenuTree } from "@/components/rbac/RbacMenuTree";
import { formatNumber } from "@/lib/format";
import {
  ConfirmDialog,
  Drawer,
  DrawerSection,
  FormField,
  Input,
  Select,
  Badge,
  type BadgeTone,
} from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  StatCard as V2StatCard,
  StatGrid,
  V2Card,
  V2CardHeader,
  V2Button,
  IconButton,
  EmptyState,
} from "@/components/ui/v2";
import { SettingsShell } from "@/components/settings/SettingsShell";

// ─── Types ──────────────────────────────────────────────────────────────

type Permission = { id: number; name: string };

type RoleScope = "platform" | "company";

type RbacRole = {
  id: number;
  name: string;
  description: string | null;
  scope: RoleScope;
  memberships_count: number;
  permissions: Permission[];
};

type RbacStats = {
  total_roles: number;
  total_permissions: number;
  total_memberships: number;
  super_admins: number;
};

type DrawerMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; role: RbacRole };

type DrawerForm = {
  name: string;
  description: string;
  scope: RoleScope;
};

type ToastState = { tone: "ok" | "err"; text: string } | null;

// ─── Module / matrix helpers ───────────────────────────────────────────

// Phase Գ.5 (2026-05-28) — expanded matrix columns from 5 → 10 per GAP-001
// from the Phase 0 multi-tenant audit. The original 5-column layout left
// ~30 of the 84 seeded permissions unmappable (CONFIRM / CANCEL / PUBLISH /
// ISSUE / REFUND verbs etc.), so the matrix rendered "—" with no way for
// super-admin to toggle them. The five new columns cover the most user-
// facing workflow verbs (booking confirm/cancel, invoice issue, offer
// publish, payment refund). Lower-traffic verbs (CAPTURE / FAIL / MODERATE
// / ARCHIVE / GOVERNANCE / MANAGE_COMPONENTS / MANAGE_SELLER_PERMISSIONS)
// alias into the closest existing column.
const MATRIX_COLUMNS = [
  "VIEW",
  "CREATE",
  "EDIT",
  "DELETE",
  "EXPORT",
  "CONFIRM",
  "CANCEL",
  "PUBLISH",
  "ISSUE",
  "REFUND",
] as const;
type MatrixCol = (typeof MATRIX_COLUMNS)[number];

// Aliases: backend uses many verbs (UPDATE / MANAGE / MODERATE / CAPTURE /
// etc.) that semantically belong under one of the 10 matrix columns. The
// closest-fit mapping below keeps all 84 seeded permissions toggleable.
const ACTION_ALIASES: Record<string, MatrixCol> = {
  // VIEW — read-only access
  VIEW: "VIEW",
  LIST: "VIEW",
  READ: "VIEW",
  // CREATE — write-create
  CREATE: "CREATE",
  STORE: "CREATE",
  ADD: "CREATE",
  // EDIT — write-modify (state changes that aren't a dedicated column)
  EDIT: "EDIT",
  UPDATE: "EDIT",
  PATCH: "EDIT",
  MODERATE: "EDIT",
  EDIT_PROFILE: "EDIT",
  UPDATE_PROFILE: "EDIT",
  CAPTURE: "EDIT",
  PAY: "EDIT",
  // DELETE — remove or terminal-state actions
  DELETE: "DELETE",
  DESTROY: "DELETE",
  REMOVE: "DELETE",
  ARCHIVE: "DELETE",
  FAIL: "DELETE",
  // EXPORT — admin / elevated / data-out
  EXPORT: "EXPORT",
  MANAGE: "EXPORT",
  DOWNLOAD: "EXPORT",
  GOVERNANCE: "EXPORT",
  MANAGE_COMPONENTS: "EXPORT",
  MANAGE_SELLER_PERMISSIONS: "EXPORT",
  // Dedicated columns for high-traffic workflow verbs
  CONFIRM: "CONFIRM",
  CANCEL: "CANCEL",
  PUBLISH: "PUBLISH",
  ISSUE: "ISSUE",
  REFUND: "REFUND",
};

type MatrixCell = {
  /** Permission id if such a permission exists for this row+action. */
  perm_id: number | null;
};
type MatrixRow = {
  /** Display label inside the module (e.g. "Bookings" for BOOKINGS, or
   *  "Settlements" for FINANCE.SETTLEMENTS). */
  label: string;
  /** All permission ids contributing to this row (used so the filter can
   *  match by full permission name). */
  all_perm_ids: number[];
  /** All raw permission names contributing to this row (used by filter). */
  all_perm_names: string[];
  cells: Record<MatrixCol, MatrixCell>;
};
type MatrixGroup = {
  module: string;
  rows: MatrixRow[];
};

/**
 * Group permissions by module (first dot-segment), then by sub-path for the
 * row label. Each row has up to 5 action columns (View/Create/Edit/Delete/
 * Export). Cells with no matching permission render "—".
 */
function buildMatrix(permissions: Permission[]): MatrixGroup[] {
  type RowDraft = {
    label: string;
    perm_ids: number[];
    perm_names: string[];
    cells: Record<MatrixCol, MatrixCell>;
  };
  const groups = new Map<string, Map<string, RowDraft>>();

  const newRow = (label: string): RowDraft => ({
    label,
    perm_ids: [],
    perm_names: [],
    cells: MATRIX_COLUMNS.reduce(
      (acc, col) => {
        acc[col] = { perm_id: null };
        return acc;
      },
      {} as Record<MatrixCol, MatrixCell>,
    ),
  });

  for (const p of permissions) {
    const segments = p.name.split(".").map((s) => s.trim()).filter(Boolean);
    if (segments.length === 0) continue;
    const moduleKey = (segments[0] ?? "OTHER").toUpperCase();
    const action = (segments[segments.length - 1] ?? "").toUpperCase();
    const middle = segments.slice(1, -1);
    // Row label: the middle segments joined, or the module itself if it's a
    // single-segment permission like "DASHBOARD.VIEW".
    const rowKey =
      middle.length > 0
        ? middle.join(".")
        : segments.length >= 2
          ? moduleKey // e.g. BOOKINGS.VIEW → row label "Bookings"
          : moduleKey;

    if (!groups.has(moduleKey)) groups.set(moduleKey, new Map());
    const moduleRows = groups.get(moduleKey)!;
    if (!moduleRows.has(rowKey)) {
      moduleRows.set(rowKey, newRow(prettifyLabel(rowKey)));
    }
    const row = moduleRows.get(rowKey)!;
    row.perm_ids.push(p.id);
    row.perm_names.push(p.name);

    const col = ACTION_ALIASES[action];
    if (col && row.cells[col].perm_id == null) {
      row.cells[col] = { perm_id: p.id };
    }
  }

  const out: MatrixGroup[] = [];
  for (const [moduleKey, rowMap] of groups) {
    const rows: MatrixRow[] = [];
    for (const draft of rowMap.values()) {
      rows.push({
        label: draft.label,
        all_perm_ids: draft.perm_ids,
        all_perm_names: draft.perm_names,
        cells: draft.cells,
      });
    }
    rows.sort((a, b) => a.label.localeCompare(b.label));
    out.push({ module: prettifyLabel(moduleKey), rows });
  }
  out.sort((a, b) => a.module.localeCompare(b.module));
  return out;
}

function prettifyLabel(raw: string): string {
  // "FINANCE" → "Finance"; "USER_MANAGEMENT" → "User management"
  return raw
    .toLowerCase()
    .replace(/[_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

// ─── Role-name badge palette ───────────────────────────────────────────

function roleBadgeTone(name: string): BadgeTone {
  const n = name.toLowerCase();
  if (n === "super_admin" || n === "super admin") return "danger";
  if (n === "platform_admin" || n === "platform admin") return "primary";
  if (n === "operator_admin" || n === "operator admin" || n === "operator") return "info";
  if (n === "company_admin" || n === "company admin" || n === "admin" || n === "owner") return "primary";
  if (n === "agent" || n === "booker") return "success";
  if (n === "customer" || n === "viewer") return "gray";
  return "gray";
}

function prettifyRoleName(name: string): string {
  return name
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

// ─── API helpers ───────────────────────────────────────────────────────

type ApiEnvelope<T> = { success: boolean; data?: T; message?: string };

function apiUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}${path}`;
}

// ─── Page ──────────────────────────────────────────────────────────────

export default function PlatformRbacPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const isSuper = isSuperAdminRole(user);

  const [stats, setStats] = useState<RbacStats | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [pendingPermIds, setPendingPermIds] = useState<Set<number>>(new Set());
  // 2026-06-01 — permission editor view: classic matrix vs Arshak's menu tree.
  const [permView, setPermView] = useState<"matrix" | "tree">("tree");

  const [drawer, setDrawer] = useState<DrawerMode>({ kind: "closed" });
  const [drawerForm, setDrawerForm] = useState<DrawerForm>({
    name: "",
    description: "",
    scope: "company",
  });
  const [drawerSubmitting, setDrawerSubmitting] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<RbacRole | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Phase Զ.15 / Item 15 — PIN gate state. When the user confirms via the
  // ConfirmDialog we don't call DELETE immediately; instead we surface the
  // PIN prompt whose onConfirm fires the real delete.
  const [pinGate, setPinGate] = useState<{
    title: string;
    description: React.ReactNode;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const baseURL = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am",
    []
  );

  // Toast auto-dismiss after 3s
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const reload = useCallback(async () => {
    if (!allowed || !token) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      const [sRes, rRes, pRes] = await Promise.all([
        fetch(apiUrl(baseURL, "/platform-admin/rbac/stats"), { headers }),
        fetch(apiUrl(baseURL, "/platform-admin/rbac/roles"), { headers }),
        fetch(apiUrl(baseURL, "/platform-admin/rbac/permissions"), { headers }),
      ]);
      if (sRes.status === 403 || rRes.status === 403 || pRes.status === 403) {
        setForbidden(true);
        return;
      }
      const sJ = (await sRes.json()) as ApiEnvelope<RbacStats>;
      const rJ = (await rRes.json()) as ApiEnvelope<RbacRole[]>;
      const pJ = (await pRes.json()) as ApiEnvelope<Permission[]>;
      if (sJ.success && sJ.data) setStats(sJ.data);
      if (pJ.success && pJ.data) setPermissions(pJ.data);
      if (rJ.success && rJ.data) {
        setRoles(rJ.data);
        // Preserve selection across reloads if possible, else select first.
        setSelectedRoleId((curr) => {
          if (curr != null && rJ.data!.some((r) => r.id === curr)) return curr;
          return rJ.data && rJ.data.length > 0 ? rJ.data[0]!.id : null;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.rbac.err_load"));
    } finally {
      setLoading(false);
    }
  }, [allowed, token, baseURL, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Filter to company-scoped roles for non-super viewers. Platform-scoped
  // roles (super_admin, platform_admin) are sensitive and not even visible
  // to non-super admins.
  const visibleRoles = useMemo(() => {
    if (isSuper) return roles;
    return roles.filter((r) => r.scope === "company");
  }, [roles, isSuper]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  const matrix = useMemo(() => buildMatrix(permissions), [permissions]);

  const grantedSet = useMemo(() => {
    if (!selectedRole) return new Set<number>();
    return new Set(selectedRole.permissions.map((p) => p.id));
  }, [selectedRole]);

  const filteredMatrix = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return matrix;
    return matrix
      .map((g) => {
        const rows = g.rows.filter((row) => {
          if (row.label.toLowerCase().includes(q)) return true;
          if (g.module.toLowerCase().includes(q)) return true;
          return row.all_perm_names.some((n) => n.toLowerCase().includes(q));
        });
        return { ...g, rows };
      })
      .filter((g) => g.rows.length > 0);
  }, [matrix, filter]);

  // ─── Permission toggle ────────────────────────────────────────────

  const togglePermission = useCallback(
    async (role: RbacRole, permId: number, nextGranted: boolean) => {
      if (!token) return;
      const nextIds = new Set(role.permissions.map((p) => p.id));
      if (nextGranted) nextIds.add(permId);
      else nextIds.delete(permId);

      setPendingPermIds((s) => {
        const next = new Set(s);
        next.add(permId);
        return next;
      });
      try {
        const res = await fetch(
          apiUrl(baseURL, `/platform-admin/rbac/roles/${role.id}/permissions`),
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ permission_ids: Array.from(nextIds) }),
          }
        );
        const json = (await res.json()) as ApiEnvelope<RbacRole>;
        if (!res.ok || !json.success || !json.data) {
          throw new Error(
            json.message ||
              t("admin.rbac.err_save") /* Failed to save permissions */
          );
        }
        const updated = json.data;
        setRoles((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
        setToast({
          tone: "ok",
          text: nextGranted
            ? t("admin.rbac.toast_granted") /* Permission granted */
            : t("admin.rbac.toast_revoked") /* Permission revoked */,
        });
      } catch (e) {
        setToast({
          tone: "err",
          text:
            e instanceof Error
              ? e.message
              : t("admin.rbac.err_save") /* Failed to save permissions */,
        });
      } finally {
        setPendingPermIds((s) => {
          const next = new Set(s);
          next.delete(permId);
          return next;
        });
      }
    },
    [token, baseURL, t]
  );

  // ─── Drawer (create + edit) ─────────────────────────────────────

  const openCreate = () => {
    setDrawerForm({ name: "", description: "", scope: "company" });
    setDrawerError(null);
    setDrawer({ kind: "create" });
  };

  const openEdit = (role: RbacRole) => {
    setDrawerForm({
      name: role.name,
      description: role.description ?? "",
      scope: role.scope,
    });
    setDrawerError(null);
    setDrawer({ kind: "edit", role });
  };

  const closeDrawer = () => {
    if (drawerSubmitting) return;
    setDrawer({ kind: "closed" });
    setDrawerError(null);
  };

  const submitDrawer = async () => {
    if (!token || drawer.kind === "closed") return;
    setDrawerSubmitting(true);
    setDrawerError(null);
    try {
      const isCreate = drawer.kind === "create";
      const url = isCreate
        ? apiUrl(baseURL, "/platform-admin/rbac/roles")
        : apiUrl(baseURL, `/platform-admin/rbac/roles/${drawer.role.id}`);
      const body = isCreate
        ? {
            name: drawerForm.name.trim(),
            description: drawerForm.description.trim() || undefined,
            scope: drawerForm.scope,
          }
        : {
            description: drawerForm.description.trim(),
            scope: drawerForm.scope,
          };
      const res = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiEnvelope<RbacRole>;
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || "Save failed");
      }
      const saved = json.data;
      setRoles((rs) => {
        const exists = rs.some((r) => r.id === saved.id);
        if (exists) return rs.map((r) => (r.id === saved.id ? saved : r));
        return [...rs, saved];
      });
      if (isCreate) setSelectedRoleId(saved.id);
      setDrawer({ kind: "closed" });
      setToast({
        tone: "ok",
        text: isCreate
          ? t("admin.rbac.toast_created") /* Role created */
          : t("admin.rbac.toast_updated") /* Role updated */,
      });
      // Stats may shift (total_roles); refetch in background.
      void reload();
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setDrawerSubmitting(false);
    }
  };

  // ─── Delete ─────────────────────────────────────────────────────

  // Phase Զ.15 / Item 15 — instead of calling DELETE directly when the user
  // confirms the ConfirmDialog, open the PIN gate; its onConfirm fires the
  // actual DELETE only after the PIN is verified.
  const confirmDelete = async () => {
    if (!token || !deleteTarget) return;
    const target = deleteTarget;
    // Close the confirm dialog first so the PIN modal isn't stacked over it.
    setDeleteTarget(null);
    setPinGate({
      title: t("admin.rbac.delete_title") /* Delete role */,
      description: (
        <>
          {t("admin.rbac.pin_gate_delete") ||
            "Enter your account PIN to delete role"}{" "}
          <strong>{prettifyRoleName(target.name)}</strong>.
        </>
      ),
      onConfirm: async () => {
        setDeleting(true);
        try {
          const res = await fetch(
            apiUrl(baseURL, `/platform-admin/rbac/roles/${target.id}`),
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            }
          );
          const json = (await res.json().catch(() => ({}))) as ApiEnvelope<unknown>;
          if (!res.ok || !json.success) {
            throw new Error(
              json.message ||
                t("admin.rbac.err_delete") /* Failed to delete role */
            );
          }
          setRoles((rs) => rs.filter((r) => r.id !== target.id));
          if (selectedRoleId === target.id) {
            setSelectedRoleId(null);
          }
          setPinGate(null);
          setToast({ tone: "ok", text: t("admin.rbac.toast_deleted") /* Role deleted */ });
          void reload();
        } catch (e) {
          setToast({
            tone: "err",
            text:
              e instanceof Error
                ? e.message
                : t("admin.rbac.err_delete") /* Failed to delete role */,
          });
          setPinGate(null);
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  // ─── 403 / unauthorized ─────────────────────────────────────────

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

  const canEditRole = (role: RbacRole): boolean => {
    if (role.scope === "platform" && !isSuper) return false;
    return true;
  };
  const canDeleteRole = (role: RbacRole): boolean => {
    if (role.name.toLowerCase() === "super_admin") return false;
    if (role.scope === "platform" && !isSuper) return false;
    return true;
  };

  return (
    <div>
      {/* Settings left-rail layout (design 11_settings.html). The rail sits
          left of the page header + cards; modals/toast stay outside it. */}
      <SettingsShell active="/platform/rbac">
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: t("admin.rbac.title") },
        ]}
        title={t("admin.rbac.title")}
        subtitle={t("admin.rbac.subtitle")}
        actions={
          <>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              onClick={() => exportMatrixCsv(roles, permissions)}
            >
              {t("admin.rbac.export_matrix") /* Export matrix */}
            </V2Button>
            <V2Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={openCreate}
            >
              {t("admin.rbac.new_role") /* New role */}
            </V2Button>
          </>
        }
      />

      {error && (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {error}
        </div>
      )}
      {loading && (
        <p className="mb-4 text-sm text-fg-t6">{t("common.loading")}</p>
      )}

      {stats && (
        <StatGrid cols={4} className="mb-4">
          <V2StatCard
            value={
              <span className="tabular-nums">
                {formatNumber(stats.total_roles, lang)}
              </span>
            }
            label={t("admin.rbac.stat_roles")}
          />
          <V2StatCard
            value={
              <span className="tabular-nums">
                {formatNumber(stats.total_permissions, lang)}
              </span>
            }
            label={t("admin.rbac.stat_permissions")}
          />
          <V2StatCard
            value={
              <span className="tabular-nums">
                {formatNumber(stats.total_memberships, lang)}
              </span>
            }
            label={t("admin.rbac.stat_memberships")}
          />
          <V2StatCard
            value={
              <span
                className="tabular-nums"
                style={{ color: "var(--admin-warning)" }}
              >
                {formatNumber(stats.super_admins, lang)}
              </span>
            }
            label={t("admin.rbac.stat_super_admins")}
          />
        </StatGrid>
      )}

      {/* ─── Card 1 — Role overview ────────────────────────────── */}

      <V2Card className="mb-4">
        <V2CardHeader
          title={t("admin.rbac.card_role_overview") /* Role overview */}
          action={
            <V2Button
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={openCreate}
            >
              {t("admin.rbac.add_role") /* Add role */}
            </V2Button>
          }
        />
        {visibleRoles.length === 0 && !loading ? (
          <EmptyState
            icon={<ShieldCheck className="h-7 w-7" />}
            title={t("admin.rbac.empty")}
            subtitle={
              t("admin.rbac.empty_subtitle") /* Roles you create will appear here */
            }
            action={
              <V2Button
                variant="primary"
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={openCreate}
              >
                {t("admin.rbac.add_role") /* Add role */}
              </V2Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead
                className="text-[11px] uppercase tracking-[0.3px]"
                style={{
                  color: "var(--admin-text-secondary)",
                  backgroundColor: "var(--admin-bg-secondary)",
                }}
              >
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t("admin.rbac.col_role")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t("admin.rbac.col_description") /* Description */}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t("admin.rbac.col_members") /* Members */}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t("admin.rbac.col_permissions") /* Permissions */}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-semibold"
                  >
                    {t("admin.rbac.col_actions") /* Actions */}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRoles.map((r) => {
                  const isSelected = selectedRoleId === r.id;
                  const isSuperRow =
                    r.name.toLowerCase() === "super_admin" ||
                    r.name.toLowerCase() === "super admin";
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRoleId(r.id)}
                      className="cursor-pointer border-t transition"
                      style={{
                        borderColor: "var(--admin-border)",
                        backgroundColor: isSelected
                          ? "var(--admin-primary-light)"
                          : "transparent",
                      }}
                    >
                      <td className="px-4 py-3">
                        <Badge tone={roleBadgeTone(r.name)}>
                          {prettifyRoleName(r.name)}
                        </Badge>
                      </td>
                      <td
                        className="px-4 py-3 text-[13px]"
                        style={{ color: "var(--admin-text-secondary)" }}
                      >
                        {r.description || (
                          <span style={{ color: "var(--admin-text-tertiary)" }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {isSuperRow ? (
                          <span style={{ color: "var(--admin-warning)" }}>
                            {formatNumber(r.memberships_count, lang)}
                          </span>
                        ) : (
                          formatNumber(r.memberships_count, lang)
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[13px]">
                        {formatNumber(r.permissions.length, lang)}
                        <span
                          className="mx-1"
                          style={{ color: "var(--admin-text-tertiary)" }}
                        >
                          /
                        </span>
                        {formatNumber(permissions.length, lang)}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="flex justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canEditRole(r) ? (
                            <IconButton
                              aria-label="Edit role"
                              onClick={() => openEdit(r)}
                            >
                              <Edit3 />
                            </IconButton>
                          ) : null}
                          {canDeleteRole(r) ? (
                            <IconButton
                              aria-label="Delete role"
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 />
                            </IconButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </V2Card>

      {/* ─── Permission editor view toggle (2026-06-01) ──────────── */}
      <div className="mb-3 inline-flex overflow-hidden rounded-[8px] border" style={{ borderColor: "var(--admin-border)" }}>
        {(["tree", "matrix"] as const).map((mode) => {
          const active = permView === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setPermView(mode)}
              className="px-3.5 py-1.5 text-[12px] font-medium transition"
              style={{
                backgroundColor: active ? "var(--admin-primary)" : "transparent",
                color: active ? "#fff" : "var(--admin-text-secondary)",
              }}
            >
              {mode === "tree" ? "Menu tree" : "Matrix"}
            </button>
          );
        })}
      </div>

      {/* ─── Card 2a — Menu-mirror permission tree (Arshak's model) ── */}
      {permView === "tree" && token ? (
        <RbacMenuTree
          token={token}
          roleId={selectedRoleId}
          roleName={selectedRole ? prettifyRoleName(selectedRole.name) : undefined}
          canEdit={isSuper}
        />
      ) : null}

      {/* ─── Card 2b — Permission matrix (classic) ──────────────── */}

      {permView === "matrix" ? (
      <V2Card>
        <V2CardHeader
          title={t("admin.rbac.card_permission_matrix") /* Permission matrix */}
          subtitle={
            selectedRole ? (
              <span>
                {t("admin.rbac.matrix_for") /* Module-level access for currently selected role: */}{" "}
                <strong style={{ color: "var(--admin-text-primary)" }}>
                  {prettifyRoleName(selectedRole.name)}
                </strong>
              </span>
            ) : (
              t("admin.rbac.matrix_pick_role") /* Pick a role above to view its permissions */
            )
          }
          action={
            <div className="flex items-center gap-2">
              <Input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("admin.rbac.filter_placeholder")}
                className="!h-[30px] !w-[200px]"
                aria-label={t("admin.rbac.filter_permissions")}
              />
              {filter ? (
                <V2Button size="sm" onClick={() => setFilter("")}>
                  <X className="h-3.5 w-3.5" />
                  {t("common.reset")}
                </V2Button>
              ) : null}
            </div>
          }
        />

        {!selectedRole ? (
          <EmptyState
            icon={<ShieldCheck className="h-7 w-7" />}
            title={t("admin.rbac.matrix_no_role") /* No role selected */}
            subtitle={
              t("admin.rbac.matrix_pick_role") /* Pick a role above to view its permissions */
            }
          />
        ) : filteredMatrix.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-7 w-7" />}
            title={
              t("admin.rbac.matrix_no_match") /* No permissions match your filter */
            }
            action={
              filter ? (
                <V2Button size="sm" onClick={() => setFilter("")}>
                  {t("common.reset")}
                </V2Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead
                className="text-[11px] uppercase tracking-[0.3px]"
                style={{
                  color: "var(--admin-text-secondary)",
                  backgroundColor: "var(--admin-bg-secondary)",
                }}
              >
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-semibold"
                    style={{ width: "45%" }}
                  >
                    {t("admin.rbac.col_module_page") /* Module / page */}
                  </th>
                  {MATRIX_COLUMNS.map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className="px-3 py-2.5 text-center font-semibold"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMatrix.map((group) => (
                  <RbacMatrixGroup
                    key={group.module}
                    group={group}
                    role={selectedRole}
                    grantedSet={grantedSet}
                    pendingPermIds={pendingPermIds}
                    canEdit={canEditRole(selectedRole)}
                    onToggle={togglePermission}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </V2Card>
      ) : null}
      </SettingsShell>

      {/* ─── Drawer (create / edit) ─────────────────────────────── */}

      <Drawer
        open={drawer.kind !== "closed"}
        onClose={closeDrawer}
        title={
          drawer.kind === "create"
            ? t("admin.rbac.drawer_create_title") /* New role */
            : drawer.kind === "edit"
              ? t("admin.rbac.drawer_edit_title") /* Edit role */
              : ""
        }
        subtitle={
          drawer.kind === "edit"
            ? prettifyRoleName(drawer.role.name)
            : t("admin.rbac.drawer_create_subtitle") /* Add a new role to the platform */
        }
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <V2Button onClick={closeDrawer} disabled={drawerSubmitting}>
              {t("common.cancel")}
            </V2Button>
            <V2Button
              variant="primary"
              onClick={() => void submitDrawer()}
              disabled={
                drawerSubmitting ||
                (drawer.kind === "create" && drawerForm.name.trim() === "")
              }
            >
              {drawerSubmitting
                ? t("common.saving") /* Saving… */
                : t("common.save")}
            </V2Button>
          </div>
        }
      >
        <DrawerSection>
          {drawerError && (
            <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
              {drawerError}
            </div>
          )}
          <FormField
            label={t("admin.rbac.form_name") /* Name */}
            htmlFor="rbac-name"
            required={drawer.kind === "create"}
            helperText={
              drawer.kind === "edit"
                ? t("admin.rbac.form_name_locked") /* Role name cannot be changed after creation. */
                : t("admin.rbac.form_name_help") /* Lowercase identifier, e.g. "operator_admin". */
            }
          >
            <Input
              id="rbac-name"
              value={drawerForm.name}
              onChange={(e) =>
                setDrawerForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="operator_admin"
              disabled={drawer.kind === "edit" || drawerSubmitting}
              autoFocus={drawer.kind === "create"}
            />
          </FormField>
        </DrawerSection>
        <DrawerSection>
          <FormField
            label={t("admin.rbac.form_description") /* Description */}
            htmlFor="rbac-description"
          >
            <Input
              id="rbac-description"
              value={drawerForm.description}
              onChange={(e) =>
                setDrawerForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder={
                t("admin.rbac.form_description_placeholder") /* Short summary of what this role can do */
              }
              disabled={drawerSubmitting}
            />
          </FormField>
        </DrawerSection>
        <DrawerSection>
          <FormField
            label={t("admin.rbac.form_scope") /* Scope */}
            htmlFor="rbac-scope"
            helperText={
              t("admin.rbac.form_scope_help") /* Platform-scoped roles can only be created by super admins. */
            }
          >
            <Select
              id="rbac-scope"
              value={drawerForm.scope}
              onChange={(e) =>
                setDrawerForm((f) => ({
                  ...f,
                  scope: e.target.value as RoleScope,
                }))
              }
              disabled={drawerSubmitting || !isSuper}
            >
              <option value="company">
                {t("admin.rbac.scope_company") /* Company-scoped */}
              </option>
              <option value="platform">
                {t("admin.rbac.scope_platform") /* Platform-scoped */}
              </option>
            </Select>
          </FormField>
        </DrawerSection>
        <DrawerSection>
          <p className="text-xs text-fg-t6">
            {t("admin.rbac.drawer_perms_hint") /* Tip: after saving, use the Permission matrix card to toggle individual permissions. */}
          </p>
          {drawer.kind === "edit" ? (
            <p className="mt-2 text-xs text-fg-t6">
              <Link
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedRoleId(drawer.role.id);
                  closeDrawer();
                }}
                className="text-primary-700 hover:underline"
              >
                {t("admin.rbac.drawer_jump_matrix") /* Jump to permission matrix → */}
              </Link>
            </p>
          ) : null}
        </DrawerSection>
      </Drawer>

      {/* ─── Delete confirmation ─────────────────────────────────── */}

      <ConfirmDialog
        isOpen={deleteTarget != null}
        onCancel={() => (deleting ? undefined : setDeleteTarget(null))}
        onConfirm={confirmDelete}
        title={t("admin.rbac.delete_title") /* Delete role */}
        message={
          deleteTarget ? (
            <>
              {t("admin.rbac.delete_body_1") /* Are you sure you want to delete the role */}{" "}
              <strong>{prettifyRoleName(deleteTarget.name)}</strong>?
              {deleteTarget.memberships_count > 0 ? (
                <span className="mt-2 block text-xs text-error-700">
                  {t("admin.rbac.delete_blocked_members") /* This role still has members and cannot be deleted until they are reassigned. */}{" "}
                  ({formatNumber(deleteTarget.memberships_count, lang)})
                </span>
              ) : null}
            </>
          ) : null
        }
        variant="danger"
        busy={deleting}
        confirmLabelKey="common.delete"
      />

      {/* Phase Զ.15 / Item 15 — PIN gate for role deletion. */}
      <PinPromptDialog
        isOpen={pinGate !== null}
        title={pinGate?.title}
        description={pinGate?.description}
        onCancel={() => setPinGate(null)}
        onConfirm={async () => {
          if (pinGate) await pinGate.onConfirm();
        }}
      />

      {/* ─── Inline toast ────────────────────────────────────────── */}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-md border px-4 py-2 text-sm shadow-zulu-card"
          style={{
            backgroundColor:
              toast.tone === "ok"
                ? "var(--admin-success-light)"
                : "var(--admin-danger-light, #fee2e2)",
            color:
              toast.tone === "ok"
                ? "var(--admin-success-dark)"
                : "var(--admin-danger-dark, #991b1b)",
            borderColor:
              toast.tone === "ok"
                ? "var(--admin-success)"
                : "var(--admin-danger)",
          }}
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}

// ─── Sub-component: matrix group with module sub-header ─────────────

function RbacMatrixGroup({
  group,
  role,
  grantedSet,
  pendingPermIds,
  canEdit,
  onToggle,
}: {
  group: MatrixGroup;
  role: RbacRole;
  grantedSet: Set<number>;
  pendingPermIds: Set<number>;
  canEdit: boolean;
  onToggle: (role: RbacRole, permId: number, nextGranted: boolean) => Promise<void>;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={MATRIX_COLUMNS.length + 1}
          className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.5px]"
          style={{
            backgroundColor: "var(--admin-bg-secondary)",
            color: "var(--admin-text-secondary)",
          }}
        >
          {group.module}
        </td>
      </tr>
      {group.rows.map((row, idx) => (
        <tr
          key={`${group.module}-${row.label}-${idx}`}
          className="border-t"
          style={{ borderColor: "var(--admin-border)" }}
        >
          <td className="px-4 py-2.5 text-[13px]">{row.label}</td>
          {MATRIX_COLUMNS.map((col) => {
            const cell = row.cells[col];
            if (cell.perm_id == null) {
              return (
                <td
                  key={col}
                  className="px-3 py-2.5 text-center"
                  style={{ color: "var(--admin-text-tertiary)" }}
                >
                  —
                </td>
              );
            }
            const granted = grantedSet.has(cell.perm_id);
            const pending = pendingPermIds.has(cell.perm_id);
            return (
              <td key={col} className="px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={granted}
                  disabled={pending || !canEdit}
                  onChange={(e) =>
                    void onToggle(role, cell.perm_id!, e.target.checked)
                  }
                  aria-label={`${group.module} · ${row.label} · ${col}`}
                  className="h-4 w-4 cursor-pointer accent-[color:var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

// Client-side CSV export of the full role × permission matrix.
function exportMatrixCsv(roles: RbacRole[], permissions: Permission[]): void {
  if (roles.length === 0 || permissions.length === 0) return;
  const escape = (s: string) =>
    /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  const header = ["permission", ...roles.map((r) => r.name)].map(escape).join(",");
  const rolePermSets = roles.map((r) => new Set(r.permissions.map((p) => p.id)));
  const lines = permissions.map((p) => {
    const cols = rolePermSets.map((set) => (set.has(p.id) ? "1" : "0"));
    return [escape(p.name), ...cols].join(",");
  });
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rbac-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
