"use client";

/**
 * Figma layout reference: Quest CRM Copy template — Settings shell + form patterns
 *   - Settings/My Profile (shell): 9706:23441
 *   - Settings/Company Profile (form pattern): 9719:16259
 * Brand tokens: ZULU purple primary (--admin-primary).
 * Mobile: stacked single-column layout, same field order as desktop.
 *
 * Sprint 1 Step 1.3 of the ZULU CMS roadmap. Reads/writes /api/brand-settings.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { ImageUploadField } from "@/components/ImageUploadField";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiBrandSettings,
  apiPatchBrandSettings,
  BRAND_SOCIAL_PLATFORMS,
  type BrandCustomField,
  type BrandSettings,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

const CUSTOM_TYPES: BrandCustomField["type"][] = ["text", "url", "email", "phone", "image", "tel"];

function emptyCustomField(): BrandCustomField {
  return { key: "", label: "", type: "text", value: "" };
}

export default function PlatformBrandSettingsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [data, setData] = useState<BrandSettings | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiBrandSettings();
      setData(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!token || !data) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await apiPatchBrandSettings(token, data);
      setData(res.data);
      setSavedAt(Date.now());
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateSocial(platformKey: string, value: string) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            social_links: {
              ...prev.social_links,
              [platformKey]: value === "" ? null : value,
            },
          }
        : prev
    );
  }

  function updateCustomField(index: number, patch: Partial<BrandCustomField>) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            custom_fields: prev.custom_fields.map((f, i) => (i === index ? { ...f, ...patch } : f)),
          }
        : prev
    );
  }

  function addCustomField() {
    setData((prev) =>
      prev ? { ...prev, custom_fields: [...prev.custom_fields, emptyCustomField()] } : prev
    );
  }

  function removeCustomField(index: number) {
    setData((prev) =>
      prev ? { ...prev, custom_fields: prev.custom_fields.filter((_, i) => i !== index) } : prev
    );
  }

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">Brand settings</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="admin-page-title">Brand settings</h1>
        <p className="mt-4 text-sm text-fg-t7">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="admin-page-title">Brand settings</h1>
        <p className="text-xs text-fg-t7">
          Կայքի logo, contact և social link-ները խմբագրելու համար
        </p>
      </div>

      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      {savedAt && <p className="mt-2 text-sm text-emerald-700">Saved.</p>}

      {/* ─────────────────────  Imagery  ───────────────────── */}
      <section className="mt-6 rounded-lg border border-default bg-white p-4">
        <h2 className="text-base font-semibold text-fg-t11">Brand imagery</h2>
        <p className="mb-3 text-xs text-fg-t7">
          Logo / emblem / favicon (browser tab-ի icon)
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <ImageUploadField
            value={data.logo_url ?? ""}
            onChange={(v) => updateField("logo_url", v === "" ? null : v)}
            section="banners"
            label="Logo (lull wordmark)"
            altText="ZULU logo"
          />
          <ImageUploadField
            value={data.emblem_url ?? ""}
            onChange={(v) => updateField("emblem_url", v === "" ? null : v)}
            section="banners"
            label="Emblem (compact icon)"
            altText="ZULU emblem"
          />
          <ImageUploadField
            value={data.favicon_url ?? ""}
            onChange={(v) => updateField("favicon_url", v === "" ? null : v)}
            section="banners"
            label="Favicon (browser tab)"
            altText="Favicon"
          />
        </div>
      </section>

      {/* ─────────────────────  Contact  ───────────────────── */}
      <section className="mt-4 rounded-lg border border-default bg-white p-4">
        <h2 className="text-base font-semibold text-fg-t11">Contact info</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fg-t6">Phone</span>
            <input
              value={data.phone ?? ""}
              onChange={(e) => updateField("phone", e.target.value === "" ? null : e.target.value)}
              placeholder="+374 11 123 456"
              className="rounded border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fg-t6">Email</span>
            <input
              type="email"
              value={data.email ?? ""}
              onChange={(e) => updateField("email", e.target.value === "" ? null : e.target.value)}
              placeholder="info@zulu.am"
              className="rounded border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-fg-t6">Address (street + building)</span>
            <input
              value={data.address ?? ""}
              onChange={(e) => updateField("address", e.target.value === "" ? null : e.target.value)}
              placeholder="Mashtots Ave 1"
              className="rounded border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fg-t6">City</span>
            <input
              value={data.address_city ?? ""}
              onChange={(e) => updateField("address_city", e.target.value === "" ? null : e.target.value)}
              className="rounded border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fg-t6">Country</span>
            <input
              value={data.address_country ?? ""}
              onChange={(e) =>
                updateField("address_country", e.target.value === "" ? null : e.target.value)
              }
              className="rounded border border-default px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      {/* ─────────────────────  Social links  ───────────────────── */}
      <section className="mt-4 rounded-lg border border-default bg-white p-4">
        <h2 className="text-base font-semibold text-fg-t11">Social links</h2>
        <p className="mb-3 text-xs text-fg-t7">
          Դատարկ թողնելու դեպքում` footer-ում չի երևա
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {BRAND_SOCIAL_PLATFORMS.map((p) => (
            <label key={p.key} className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{p.label}</span>
              <input
                type="url"
                value={data.social_links?.[p.key] ?? ""}
                onChange={(e) => updateSocial(p.key, e.target.value)}
                placeholder="https://…"
                className="rounded border border-default px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
      </section>

      {/* ─────────────────────  Custom fields  ───────────────────── */}
      <section className="mt-4 rounded-lg border border-default bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-fg-t11">Custom fields</h2>
            <p className="text-xs text-fg-t7">
              Հատուկ դաշտեր (օրինակ` Office hours, Telegram URL, ևն)
            </p>
          </div>
          <button
            type="button"
            onClick={addCustomField}
            className="rounded border border-default bg-white px-3 py-1 text-xs hover:bg-figma-bg-1"
          >
            + Add field
          </button>
        </div>
        {data.custom_fields.length === 0 ? (
          <p className="mt-3 text-xs text-fg-t6">No custom fields yet.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {data.custom_fields.map((f, i) => (
              <div key={i} className="rounded border border-default bg-figma-bg-1 p-3">
                <div className="grid gap-2 md:grid-cols-4">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-fg-t6">Key (no spaces)</span>
                    <input
                      value={f.key}
                      onChange={(e) =>
                        updateCustomField(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })
                      }
                      placeholder="office_hours"
                      className="rounded border border-default px-2 py-1.5 text-sm font-mono"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-fg-t6">Label (display name)</span>
                    <input
                      value={f.label}
                      onChange={(e) => updateCustomField(i, { label: e.target.value })}
                      placeholder="Office hours"
                      className="rounded border border-default px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-fg-t6">Type</span>
                    <select
                      value={f.type}
                      onChange={(e) =>
                        updateCustomField(i, { type: e.target.value as BrandCustomField["type"] })
                      }
                      className="rounded border border-default px-2 py-1.5 text-sm"
                    >
                      {CUSTOM_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-fg-t6">Value</span>
                    <input
                      value={f.value ?? ""}
                      onChange={(e) => updateCustomField(i, { value: e.target.value })}
                      className="rounded border border-default px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeCustomField(i)}
                    className="text-xs text-error-600 underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-default bg-white py-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="admin-btn-primary"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
