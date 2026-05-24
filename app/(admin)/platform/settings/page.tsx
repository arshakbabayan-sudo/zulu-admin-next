"use client";

/**
 * Figma layout reference: Quest CRM Copy template
 *   - Settings/My Profile (settings shell):  9706:23441
 *   - Settings/Company Profile (form pattern): 9719:16259
 * Brand tokens: ZULU purple primary (--admin-primary).
 * Phase-2 migration to shared @/components/ui primitives.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiPatchPlatformSetting, apiPlatformSettings, type PlatformSettingRow } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input} from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
} from "@/components/ui/v2";

function categoryOf(key: string): string {
  const head = key.split(/[._-]/)[0]?.toLowerCase() ?? "general";
  return head;
}

function humanize(s: string): string {
  return s.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isShortValue(value: string, type: string): boolean {
  if (type === "boolean" || type === "bool" || type === "number" || type === "integer") return true;
  if (value.length <= 80 && !value.includes("\n")) return true;
  return false;
}

export default function PlatformSettingsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformSettingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("");

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformSettings(token);
      setRows(res.data);
      const d: Record<string, string> = {};
      for (const r of res.data) d[r.key] = r.value;
      setDrafts(d);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load settings");
    }
  }, [token, allowed]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlatformSettingRow[]>();
    for (const r of rows) {
      const cat = categoryOf(r.key);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const categories = useMemo(() => grouped.map(([c]) => c), [grouped]);

  useEffect(() => {
    if (!activeCategory && categories.length > 0) setActiveCategory(categories[0]!);
  }, [activeCategory, categories]);

  async function save(key: string) {
    if (!token) return;
    const value = drafts[key];
    if (value === undefined) return;
    setBusyKey(key);
    setMsg(null);
    try {
      await apiPatchPlatformSetting(token, key, value);
      setMsg(`Saved ${key}.`);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Update failed");
    } finally {
      setBusyKey(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Settings</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  const visibleRows = activeCategory ? grouped.find(([c]) => c === activeCategory)?.[1] ?? [] : rows;

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: "General" },
        ]}
        title="Platform settings"
        subtitle="Configure global platform behavior. Changes apply immediately."
      />

      <SectionTabs
        activeHref="/platform/settings"
        items={[
          { href: "/settings/pricing-rules", label: "Pricing rules" },
          { href: "/settings/money-flow", label: "Money flow" },
          { href: "/localization/languages", label: "Languages" },
          { href: "/localization/templates", label: "Email templates" },
          { href: "/platform/banners", label: "Banners" },
          { href: "/pages", label: "CMS pages" },
          { href: "/platform/notifications", label: "System notifications" },
          { href: "/platform/newsletter", label: "Newsletter" },
          { href: "/platform/loyalty", label: "Loyalty" },
          { href: "/bucket3/block-dates", label: "Block dates" },
          { href: "/bucket3/custom-fields", label: "Custom fields" },
          { href: "/platform/security", label: "Security" },
          { href: "/platform/webhooks", label: "Webhooks" },
          { href: "/platform/locations", label: "Locations" },
          { href: "/platform/settings/brand", label: "Brand" },
          { href: "/connections", label: "Connections" },
          { href: "/support/tickets", label: "Support" },
          { href: "/platform/reviews", label: "Reviews" },
        ]}
      />

      {msg && <div className="mb-4 rounded-md border border-success-100 bg-success-50 px-4 py-2 text-sm text-success-700">{msg}</div>}
      {err && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}

      {rows.length === 0 ? (
        <div className="admin-card p-6 text-center text-sm text-fg-t6">
          {err ? "Failed to load settings." : "Loading settings…"}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav className="admin-card overflow-x-auto p-2 lg:overflow-y-auto lg:p-3">
            <ul className="flex gap-1 lg:flex-col">
              {categories.map((cat) => {
                const active = cat === activeCategory;
                const count = grouped.find(([c]) => c === cat)?.[1].length ?? 0;
                return (
                  <li key={cat}>
                    <button
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={[
                        "flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-zulu px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary-50 text-primary-500 font-medium"
                          : "text-fg-t7 hover:bg-figma-bg-1",
                      ].join(" ")}
                    >
                      <span>{humanize(cat)}</span>
                      <span
                        className={[
                          "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs",
                          active ? "bg-white text-fg-t6" : "bg-figma-bg-1 text-fg-t6",
                        ].join(" ")}
                      >
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="space-y-4">
            <div className="admin-card p-5">
              <h2 className="text-base font-semibold text-fg-t8">{humanize(activeCategory || "All")}</h2>
              <p className="mt-1 text-xs text-fg-t6">
                {visibleRows.length} setting{visibleRows.length === 1 ? "" : "s"}
              </p>
            </div>

            <ul className="space-y-3">
              {visibleRows.map((r) => {
                const draft = drafts[r.key] ?? r.value;
                const dirty = draft !== r.value;
                const useShort = isShortValue(draft, r.type);
                return (
                  <li key={r.id} className="admin-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs text-fg-t8">{r.key}</div>
                        {r.description && <p className="mt-1 text-sm text-fg-t7">{r.description}</p>}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-fg-t6">
                          <span className="rounded-full border border-default bg-figma-bg-1 px-2 py-0.5">type: {r.type}</span>
                          <span className="rounded-full border border-default bg-figma-bg-1 px-2 py-0.5">id: {r.id}</span>
                          {dirty && (
                            <span className="rounded-full border border-warning-100 bg-warning-50 px-2 py-0.5 text-warning-700">unsaved</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      {useShort ? (
                        <Input
                          type="text"
                          value={draft}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [r.key]: e.target.value }))}
                          className="!h-10 font-mono"
                        />
                      ) : (
                        <Input
                          as="textarea"
                          value={draft}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [r.key]: e.target.value }))}
                          rows={Math.min(8, Math.max(3, draft.split("\n").length))}
                          className="font-mono"
                        />
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      {dirty && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDrafts((prev) => ({ ...prev, [r.key]: r.value }))}
                        >
                          Reset
                        </Button>
                      )}
                      <Button size="sm" disabled={busyKey === r.key || !dirty} onClick={() => save(r.key)}>
                        {busyKey === r.key ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
