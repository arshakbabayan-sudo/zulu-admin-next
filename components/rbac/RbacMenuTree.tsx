"use client";

/**
 * RBAC menu-mirror tree (Arshak's model, 2026-06-01).
 *
 * Renders the admin menu as a permission tree: each top-level SECTION is a
 * collapsible row (dropdown); inside, each sub-ITEM lists its action
 * permissions as checkboxes. Checking/unchecking edits the in-memory set;
 * Save calls PUT /rbac/roles/{id}/permissions (full sync — same contract the
 * matrix view uses, so the two stay consistent).
 *
 * `ceilingPermissionIds` (optional) caps what can be granted — for the
 * operator/agent view, a permission the manager doesn't hold is shown disabled.
 * Omitted (super-admin) = no cap.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Check, Lock } from "lucide-react";
import {
  apiRbacTree,
  apiSyncRolePermissions,
  type RbacTreeSection,
} from "@/lib/rbac-tree-api";
import { V2Card, V2CardHeader, V2CardBody, V2Button, EmptyState } from "@/components/ui/v2";

type Props = {
  token: string;
  roleId: number | null;
  roleName?: string;
  /** Permission ids the editor is allowed to grant (ceiling). Undefined = no cap. */
  ceilingPermissionIds?: Set<number>;
  /** Whether the current user may save (super-admin / manager). */
  canEdit?: boolean;
};

const ACTION_LABEL: Record<string, string> = {
  view: "View",
  create: "Create",
  update: "Edit",
  edit: "Edit",
  delete: "Delete",
  manage: "Manage",
  confirm: "Confirm",
  cancel: "Cancel",
  publish: "Publish",
  archive: "Archive",
  issue: "Issue",
  pay: "Pay",
  capture: "Capture",
  fail: "Fail",
  refund: "Refund",
  moderate: "Moderate",
  list: "List",
  governance: "Governance",
  upload: "Upload",
  manage_components: "Components",
  manage_seller_permissions: "Seller perms",
  view_dashboard: "Dashboard",
  edit_profile: "Edit profile",
  update_profile: "Edit profile",
};

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/_/g, " ");
}

export function RbacMenuTree({ token, roleId, roleName, ceilingPermissionIds, canEdit = true }: Props) {
  const [sections, setSections] = useState<RbacTreeSection[]>([]);
  const [granted, setGranted] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || roleId == null) {
      setSections([]);
      setGranted(new Set());
      return;
    }
    setLoading(true);
    setErr(null);
    setSavedOk(false);
    try {
      const res = await apiRbacTree(token, roleId);
      setSections(res.data.sections);
      const g = new Set<number>();
      for (const s of res.data.sections) {
        for (const it of s.items) {
          for (const p of it.permissions) if (p.granted) g.add(p.id);
        }
      }
      setGranted(g);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load permission tree");
    } finally {
      setLoading(false);
    }
  }, [token, roleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const allowed = useCallback(
    (permId: number) => ceilingPermissionIds === undefined || ceilingPermissionIds.has(permId),
    [ceilingPermissionIds],
  );

  const toggle = (permId: number) => {
    if (!canEdit || !allowed(permId)) return;
    setSavedOk(false);
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const toggleSectionOpen = (key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** Toggle every (allowed) permission in an item on/off as a group. */
  const toggleItem = (permIds: number[], turnOn: boolean) => {
    if (!canEdit) return;
    setSavedOk(false);
    setGranted((prev) => {
      const next = new Set(prev);
      for (const id of permIds) {
        if (!allowed(id)) continue;
        if (turnOn) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const save = async () => {
    if (!token || roleId == null || !canEdit) return;
    setSaving(true);
    setErr(null);
    try {
      await apiSyncRolePermissions(token, roleId, Array.from(granted));
      setSavedOk(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const grantedCount = granted.size;
  const totalCount = useMemo(
    () => sections.reduce((n, s) => n + s.items.reduce((m, it) => m + it.permissions.length, 0), 0),
    [sections],
  );

  if (roleId == null) {
    return (
      <EmptyState
        icon={<Lock className="h-10 w-10" />}
        title="Select a role"
        subtitle="Pick a role above to edit its permissions as a menu tree."
      />
    );
  }

  return (
    <V2Card>
      <V2CardHeader
        title={`Permissions — ${roleName ?? `role #${roleId}`}`}
        subtitle={`${grantedCount} of ${totalCount} permissions granted`}
        action={
          canEdit ? (
            <span className="flex items-center gap-3">
              {savedOk ? (
                <span className="inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--admin-success)" }}>
                  <Check className="h-4 w-4" /> Saved
                </span>
              ) : null}
              <V2Button variant="primary" onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save permissions"}
              </V2Button>
            </span>
          ) : null
        }
      />
      <V2CardBody>
        {err ? (
          <div className="mb-3 rounded-md border p-3 text-[13px]" style={{ borderColor: "var(--admin-border)", color: "var(--admin-danger)" }}>
            {err}
          </div>
        ) : null}

        {/* Only blank to "Loading…" on the FIRST load (empty tree). On a role
            switch the tree structure is identical — only `granted` differs — so
            keep the existing sections rendered (they update in place when the new
            data arrives). Blanking on every switch collapsed/re-opened every
            section = the "flicker" Arshak saw when clicking Agent/Operator/etc. */}
        {loading && sections.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>Loading…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sections.map((section) => {
              const isOpen = open.has(section.key);
              const sectionPermIds = section.items.flatMap((it) => it.permissions.map((p) => p.id));
              const sectionGranted = sectionPermIds.filter((id) => granted.has(id)).length;
              return (
                <div key={section.key} className="rounded-[8px] border" style={{ borderColor: "var(--admin-border)" }}>
                  <button
                    type="button"
                    onClick={() => toggleSectionOpen(section.key)}
                    className="flex w-full items-center gap-2 px-3.5 py-3 text-left"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="text-[13px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>
                      {section.label}
                    </span>
                    <span
                      className="ml-auto rounded-full px-[7px] py-px text-[11px] font-semibold"
                      style={{
                        backgroundColor: sectionGranted > 0 ? "var(--admin-primary-soft)" : "var(--admin-bg-tertiary)",
                        color: sectionGranted > 0 ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                      }}
                    >
                      {sectionGranted}/{sectionPermIds.length}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                      {section.items.map((item) => {
                        const itemIds = item.permissions.map((p) => p.id);
                        const allOn = itemIds.every((id) => granted.has(id));
                        return (
                          <div key={item.key} className="border-b px-3.5 py-2.5 last:border-b-0" style={{ borderColor: "var(--admin-border)" }}>
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="text-[12px] font-medium" style={{ color: "var(--admin-text-primary)" }}>
                                {item.label}
                              </span>
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => toggleItem(itemIds, !allOn)}
                                  className="ml-auto text-[11px] font-medium"
                                  style={{ color: "var(--admin-primary)" }}
                                >
                                  {allOn ? "Clear all" : "Select all"}
                                </button>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {item.permissions.map((p) => {
                                const checked = granted.has(p.id);
                                const capped = !allowed(p.id);
                                return (
                                  <label
                                    key={p.id}
                                    title={capped ? "Beyond your permission ceiling" : p.name}
                                    className="inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-1 text-[12px]"
                                    style={{
                                      cursor: capped || !canEdit ? "not-allowed" : "pointer",
                                      opacity: capped ? 0.45 : 1,
                                      borderColor: checked ? "var(--admin-primary)" : "var(--admin-border)",
                                      backgroundColor: checked ? "var(--admin-primary-soft)" : "transparent",
                                      color: checked ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={capped || !canEdit}
                                      onChange={() => toggle(p.id)}
                                      className="h-3.5 w-3.5"
                                    />
                                    {actionLabel(p.action)}
                                    {capped ? <Lock className="h-3 w-3" /> : null}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </V2CardBody>
    </V2Card>
  );
}
