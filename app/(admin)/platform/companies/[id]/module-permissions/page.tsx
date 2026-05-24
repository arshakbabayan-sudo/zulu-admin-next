"use client";

/**
 * Phase 6A — Super admin → per-company module visibility editor.
 *
 * Renders a checkbox grid grouped by module namespace (inventory.*, ops.*).
 * Sidebar enforcement (operator sees / doesn't see the gated module) is
 * Phase 6A part 2 — the table just stores the configuration for now.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessSuperAdminOnlyPlatformNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiCompanyModulePermissions,
  apiPatchCompanyModulePermissions,
  groupModuleKeys,
  moduleKeyLabel,
  type CompanyModulePermissionsResponse,
  type ModulePermissionPatch,
} from "@/lib/company-module-permissions-api";
import { Button, Checkbox } from "@/components/ui";
import { PageHeader as V2PageHeader, V2Card, V2Button } from "@/components/ui/v2";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function groupLabel(key: string): string {
  switch (key) {
    case "inventory":
      return "Inventory CRUD";
    case "ops":
      return "Operations";
    default:
      return key.charAt(0).toUpperCase() + key.slice(1);
  }
}

export default function CompanyModulePermissionsPage() {
  const params = useParams();
  const companyId = Number(params.id);
  const { token, user } = useAdminAuth();
  const { lang } = useLanguage();
  const allowed = canAccessSuperAdminOnlyPlatformNav(user);
  const [data, setData] = useState<CompanyModulePermissionsResponse | null>(null);
  // Local edit state — map of module_key → is_allowed.
  // Modules with no explicit row default to `true` (default-allow).
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed || !Number.isFinite(companyId)) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiCompanyModulePermissions(token, companyId);
      setData(res.data);
      // Hydrate draft from server: known module keys default to true, explicit rows override.
      const next: Record<string, boolean> = {};
      for (const k of res.data.available_module_keys) {
        next[k] = true;
      }
      for (const row of res.data.permissions) {
        next[row.module_key] = row.is_allowed;
      }
      setDraft(next);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load module permissions");
    }
  }, [token, allowed, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const groupedKeys = useMemo(() => {
    if (!data) return {} as Record<string, string[]>;
    return groupModuleKeys(data.available_module_keys);
  }, [data]);

  const dirty = useMemo(() => {
    if (!data) return false;
    const serverMap: Record<string, boolean> = {};
    for (const k of data.available_module_keys) serverMap[k] = true;
    for (const row of data.permissions) serverMap[row.module_key] = row.is_allowed;
    return Object.entries(draft).some(([k, v]) => serverMap[k] !== v);
  }, [data, draft]);

  async function save() {
    if (!token || !data || !dirty) return;
    setBusy(true);
    setErr(null);
    try {
      // Send the explicit denials and an explicit allow for anything that was
      // previously denied. Modules that are default-allow with no row stay omitted.
      const serverDeny = new Set(
        data.permissions.filter((p) => !p.is_allowed).map((p) => p.module_key)
      );
      const payload: ModulePermissionPatch[] = [];
      for (const [k, v] of Object.entries(draft)) {
        if (v === false) {
          payload.push({ module_key: k, is_allowed: false });
        } else if (serverDeny.has(k)) {
          payload.push({ module_key: k, is_allowed: true });
        }
      }
      if (payload.length === 0) {
        // Edge case: no explicit rows to persist.
        await load();
        setSavedAt(new Date().toLocaleTimeString(lang));
        return;
      }
      await apiPatchCompanyModulePermissions(token, companyId, payload);
      setSavedAt(new Date().toLocaleTimeString(lang));
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Module access</h1>
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
          { label: "Marketplace ops", href: "/platform/companies" },
          { label: "Companies", href: "/platform/companies" },
          { label: `#${companyId}`, href: `/platform/companies/${companyId}` },
          { label: "Module permissions" },
        ]}
        title={`Module access — company #${companyId}`}
        subtitle="Toggle which admin-panel sections this company's operator and agent users can see. Default state is allowed — only explicit denials hide a module."
        actions={
          <V2Button as="link" href={`/platform/companies/${companyId}`}>
            ← Back to company
          </V2Button>
        }
      />
      <div className="space-y-6">

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      {savedAt && !dirty && (
        <div className="rounded-zulu border border-success-200 bg-success-50 px-4 py-2 text-sm text-success-700">
          Saved at {savedAt}
        </div>
      )}

      {!data ? (
        <div className="admin-card p-4 text-sm text-fg-t6">Loading…</div>
      ) : (
        <>
          {Object.entries(groupedKeys).map(([group, keys]) => (
            <V2Card key={group} className="p-4">
              <h2 className="mb-3 text-base font-semibold">{groupLabel(group)}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {keys.map((k) => (
                  <Checkbox
                    key={k}
                    checked={Boolean(draft[k])}
                    onChange={(e) => setDraft((p) => ({ ...p, [k]: e.target.checked }))}
                    label={moduleKeyLabel(k)}
                    description={k}
                  />
                ))}
              </div>
            </V2Card>
          ))}

          <div className="flex gap-2">
            <Button size="sm" disabled={busy || !dirty} onClick={() => void save()}>
              {busy ? "Saving…" : dirty ? "Save changes" : "No changes"}
            </Button>
            <Link
              href={`/platform/companies/${companyId}`}
              className="inline-flex h-10 items-center rounded-md border-2 border-primary-500 px-4 text-ds-button-s font-ds-button-s font-semibold text-primary-500 transition hover:bg-primary-50"
            >
              Cancel
            </Link>
          </div>

          {data.permissions.length > 0 && (
            <V2Card className="p-4">
              <h2 className="mb-3 text-base font-semibold">Existing override rows</h2>
              <p className="mb-3 text-xs text-fg-t6">
                Rows persisted server-side. Modules without a row use the default-allow state.
              </p>
              <ul className="space-y-1 text-sm">
                {data.permissions.map((p) => (
                  <li key={p.module_key} className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-fg-t8">{p.module_key}</span>
                    <span
                      className={
                        p.is_allowed
                          ? "text-xs font-medium text-success-700"
                          : "text-xs font-medium text-error-700"
                      }
                    >
                      {p.is_allowed ? "allowed" : "denied"}
                    </span>
                  </li>
                ))}
              </ul>
            </V2Card>
          )}
        </>
      )}
      </div>
    </div>
  );
}
