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
import { Edit3, Trash2, Plus, ShieldCheck } from "lucide-react";

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
  const [toast, setToast] = useState<ToastState>(null);

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
          <V2Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={openCreate}
          >
            {t("admin.rbac.new_role") /* New role */}
          </V2Button>
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

      {/* ─── Card 2 — Menu-mirror permission tree (Arshak's model) ── */}
      {token ? (
        <RbacMenuTree
          token={token}
          roleId={selectedRoleId}
          roleName={selectedRole ? prettifyRoleName(selectedRole.name) : undefined}
          canEdit={isSuper}
        />
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
