"use client";

/**
 * Phase Գ.6 / Bucket D.4 — per-employee permission drawer.
 *
 * Opens from the company Users tab. Shows the permissions a manager may
 * assign to one employee (the backend bounds the list by the caller's own
 * privilege ceiling), grouped by module, as checkboxes. The role provides a
 * baseline; ticking/unticking writes allow/deny overrides server-side. Only
 * the changed rows are sent on Save.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { Drawer, DrawerSection } from "@/components/ui/Drawer";
import { V2Button } from "@/components/ui/v2/Button";
import {
  apiGetEmployeePermissions,
  apiSetEmployeeTwoFactorPolicy,
  apiSyncEmployeePermissions,
  type EmployeePermissionRow,
} from "@/lib/employees-api";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  companyId: number;
  userId: number | null;
  userName?: string;
  onSaved?: () => void;
};

export function EmployeePermissionsDrawer({
  open,
  onClose,
  token,
  companyId,
  userId,
  userName,
  onSaved,
}: Props) {
  const [rows, setRows] = useState<EmployeePermissionRow[] | null>(null);
  const [draft, setDraft] = useState<Record<number, boolean>>({});
  const [roleName, setRoleName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 2FA hierarchy (Phase B) — manager-controlled enforcement flag, saved
  // inline (no Save button) the moment the toggle flips.
  const [twoFactorRequired, setTwoFactorRequired] = useState<boolean | null>(null);
  const [twoFactorMethod, setTwoFactorMethod] = useState<"totp" | "email" | null>(null);
  const [twoFactorSaving, setTwoFactorSaving] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || userId == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRows(null);
    setTwoFactorRequired(null);
    setTwoFactorMethod(null);
    setTwoFactorError(null);
    apiGetEmployeePermissions(token, companyId, userId)
      .then((res) => {
        if (cancelled) return;
        const perms = res.data.permissions;
        setRows(perms);
        setRoleName(res.data.user.role_name);
        setTwoFactorRequired(res.data.user.two_factor_required);
        setTwoFactorMethod(res.data.user.two_factor_method);
        setDraft(Object.fromEntries(perms.map((p) => [p.permission_id, p.granted])));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load permissions");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId, companyId, token]);

  const toggleTwoFactor = useCallback(
    async (next: boolean) => {
      if (userId == null) return;
      const prev = twoFactorRequired;
      // Optimistic — the toggle moves immediately, rolls back on failure.
      setTwoFactorRequired(next);
      setTwoFactorSaving(true);
      setTwoFactorError(null);
      try {
        await apiSetEmployeeTwoFactorPolicy(token, companyId, userId, next);
      } catch (e: unknown) {
        setTwoFactorRequired(prev);
        setTwoFactorError(e instanceof Error ? e.message : "Could not update 2FA policy.");
      } finally {
        setTwoFactorSaving(false);
      }
    },
    [userId, twoFactorRequired, token, companyId]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, EmployeePermissionRow[]>();
    for (const r of rows ?? []) {
      const arr = map.get(r.module) ?? [];
      arr.push(r);
      map.set(r.module, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const dirtyCount = useMemo(() => {
    if (!rows) return 0;
    return rows.reduce((n, r) => n + (draft[r.permission_id] !== r.granted ? 1 : 0), 0);
  }, [rows, draft]);

  const toggle = useCallback((id: number, val: boolean) => {
    setDraft((d) => ({ ...d, [id]: val }));
  }, []);

  const save = useCallback(async () => {
    if (userId == null || !rows) return;
    const payload = rows
      .filter((r) => draft[r.permission_id] !== r.granted)
      .map((r) => ({ permission_id: r.permission_id, granted: draft[r.permission_id] === true }));
    if (payload.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiSyncEmployeePermissions(token, companyId, userId, payload);
      onSaved?.();
      onClose();
      void res;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  }, [userId, rows, draft, token, companyId, onClose, onSaved]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      title="Employee permissions"
      subtitle={
        userName
          ? `${userName}${roleName ? ` · ${roleName.replace(/_/g, " ")}` : ""}`
          : undefined
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-fg-t6">
            {dirtyCount > 0 ? `${dirtyCount} unsaved change(s)` : "No changes"}
          </span>
          <div className="flex gap-2">
            <V2Button variant="default" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </V2Button>
            <V2Button
              variant="primary"
              size="sm"
              onClick={() => void save()}
              disabled={saving || dirtyCount === 0}
            >
              {saving ? "Saving…" : "Save"}
            </V2Button>
          </div>
        </div>
      }
    >
      {loading && <div className="text-sm text-fg-t6">Loading…</div>}
      {error && (
        <div className="mb-3 rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {error}
        </div>
      )}
      {!loading && twoFactorRequired !== null && (
        <DrawerSection title="Two-factor authentication">
          <label className="flex cursor-pointer items-start justify-between gap-3 rounded-zulu border border-default bg-white px-4 py-3 text-sm">
            <span className="flex-1">
              <span className="block font-medium text-fg-t11">Require 2FA at every login</span>
              <span className="mt-0.5 block text-xs text-fg-t6">
                When on, this employee must enter a 6-digit code (from their authenticator app or
                email) after their password on every sign-in. They pick the channel themselves in
                their account security page.
                {twoFactorMethod && (
                  <>
                    {" "}Current channel:{" "}
                    <span className="font-medium text-fg-t8">
                      {twoFactorMethod === "totp" ? "Authenticator app" : "Email"}
                    </span>
                    .
                  </>
                )}
              </span>
            </span>
            <input
              type="checkbox"
              checked={twoFactorRequired === true}
              disabled={twoFactorSaving}
              onChange={(e) => void toggleTwoFactor(e.target.checked)}
              className="mt-1 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full border border-default bg-figma-bg-1 transition-colors checked:bg-[color:var(--admin-primary)] disabled:opacity-60"
              aria-label="Require 2FA at every login"
              style={{
                backgroundImage:
                  twoFactorRequired === true
                    ? "radial-gradient(circle at 75% 50%, #fff 0 5px, transparent 5px)"
                    : "radial-gradient(circle at 25% 50%, #fff 0 5px, transparent 5px)",
              }}
            />
          </label>
          {twoFactorError && (
            <p className="mt-2 text-xs text-error-700">{twoFactorError}</p>
          )}
        </DrawerSection>
      )}
      {!loading && rows && rows.length === 0 && (
        <div className="text-sm text-fg-t6">No assignable permissions for this employee.</div>
      )}
      {!loading &&
        grouped.map(([moduleName, perms]) => (
          <DrawerSection key={moduleName} title={moduleName.replace(/[._]/g, " ")}>
            <div className="grid grid-cols-1 gap-1">
              {perms.map((p) => {
                const checked = draft[p.permission_id] ?? p.granted;
                const changed = checked !== p.granted;
                return (
                  <label
                    key={p.permission_id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-zulu px-3 py-2 text-sm hover:bg-figma-bg-1"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`capitalize ${changed ? "font-semibold" : "text-fg-t8"}`}
                        style={changed ? { color: "var(--admin-primary)" } : undefined}
                      >
                        {(p.action || p.name).replace(/_/g, " ")}
                      </span>
                      {p.override && (
                        <span className="rounded-full border border-default px-2 py-0.5 text-[10px] uppercase tracking-wide text-fg-t6">
                          {p.override}
                        </span>
                      )}
                      {!p.override && p.from_role && (
                        <span className="text-[10px] uppercase tracking-wide text-fg-t6">from role</span>
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggle(p.permission_id, e.target.checked)}
                      className="h-4 w-4 cursor-pointer accent-[color:var(--admin-primary)]"
                      aria-label={`${moduleName} · ${p.action || p.name}`}
                    />
                  </label>
                );
              })}
            </div>
          </DrawerSection>
        ))}
    </Drawer>
  );
}
