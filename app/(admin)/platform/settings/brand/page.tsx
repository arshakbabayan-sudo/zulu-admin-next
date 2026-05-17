"use client";

/**
 * Figma layout reference: Quest CRM Copy template
 *   - Settings/My Profile (shell): 9706:23441
 *   - Settings/Company Profile (form pattern): 9719:16259
 * Phase-2 migration to shared @/components/ui primitives.
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
import { Button, FormField, Input, PageHeader, Select } from "@/components/ui";

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

  useEffect(() => { void load(); }, [load]);

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
        ? { ...prev, social_links: { ...prev.social_links, [platformKey]: value === "" ? null : value } }
        : prev
    );
  }

  function updateCustomField(index: number, patch: Partial<BrandCustomField>) {
    setData((prev) =>
      prev ? { ...prev, custom_fields: prev.custom_fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) } : prev
    );
  }

  function addCustomField() {
    setData((prev) => (prev ? { ...prev, custom_fields: [...prev.custom_fields, emptyCustomField()] } : prev));
  }

  function removeCustomField(index: number) {
    setData((prev) => (prev ? { ...prev, custom_fields: prev.custom_fields.filter((_, i) => i !== index) } : prev));
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Brand settings</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Brand settings</h1>
        <p className="text-sm text-fg-t7">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Brand settings"
        subtitle="Կայքի logo, contact և social link-ները խմբագրելու համար"
      />

      {err && <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}
      {savedAt && <div className="rounded-zulu border border-success-100 bg-success-50 px-4 py-2 text-sm text-success-700">Saved.</div>}

      <section className="admin-card p-4">
        <h2 className="text-base font-semibold text-fg-t11">Brand imagery</h2>
        <p className="mt-1 mb-3 text-xs text-fg-t7">Logo / emblem / favicon (browser tab-ի icon)</p>
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

      <section className="admin-card p-4">
        <h2 className="text-base font-semibold text-fg-t11">Contact info</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <FormField label="Phone" htmlFor="br-phone">
            <Input
              id="br-phone"
              value={data.phone ?? ""}
              onChange={(e) => updateField("phone", e.target.value === "" ? null : e.target.value)}
              placeholder="+374 11 123 456"
            />
          </FormField>
          <FormField label="Email" htmlFor="br-email">
            <Input
              id="br-email"
              type="email"
              value={data.email ?? ""}
              onChange={(e) => updateField("email", e.target.value === "" ? null : e.target.value)}
              placeholder="info@zulu.am"
            />
          </FormField>
          <FormField label="Address (street + building)" htmlFor="br-addr" className="md:col-span-2">
            <Input
              id="br-addr"
              value={data.address ?? ""}
              onChange={(e) => updateField("address", e.target.value === "" ? null : e.target.value)}
              placeholder="Mashtots Ave 1"
            />
          </FormField>
          <FormField label="City" htmlFor="br-city">
            <Input
              id="br-city"
              value={data.address_city ?? ""}
              onChange={(e) => updateField("address_city", e.target.value === "" ? null : e.target.value)}
            />
          </FormField>
          <FormField label="Country" htmlFor="br-country">
            <Input
              id="br-country"
              value={data.address_country ?? ""}
              onChange={(e) => updateField("address_country", e.target.value === "" ? null : e.target.value)}
            />
          </FormField>
        </div>
      </section>

      <section className="admin-card p-4">
        <h2 className="text-base font-semibold text-fg-t11">Social links</h2>
        <p className="mt-1 mb-3 text-xs text-fg-t7">Դատարկ թողնելու դեպքում` footer-ում չի երևա</p>
        <div className="grid gap-3 md:grid-cols-2">
          {BRAND_SOCIAL_PLATFORMS.map((p) => (
            <FormField key={p.key} label={p.label} htmlFor={`br-soc-${p.key}`}>
              <Input
                id={`br-soc-${p.key}`}
                type="url"
                value={data.social_links?.[p.key] ?? ""}
                onChange={(e) => updateSocial(p.key, e.target.value)}
                placeholder="https://…"
              />
            </FormField>
          ))}
        </div>
      </section>

      <section className="admin-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-fg-t11">Custom fields</h2>
            <p className="text-xs text-fg-t7">Հատուկ դաշտեր (օրինակ` Office hours, Telegram URL, ևն)</p>
          </div>
          <Button variant="outline" size="sm" onClick={addCustomField}>+ Add field</Button>
        </div>
        {data.custom_fields.length === 0 ? (
          <p className="mt-3 text-xs text-fg-t6">No custom fields yet.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {data.custom_fields.map((f, i) => (
              <div key={i} className="rounded-zulu border border-default bg-figma-bg-1 p-3">
                <div className="grid gap-2 md:grid-cols-4">
                  <FormField label="Key (no spaces)" htmlFor={`cf-key-${i}`}>
                    <Input
                      id={`cf-key-${i}`}
                      value={f.key}
                      onChange={(e) =>
                        updateCustomField(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })
                      }
                      placeholder="office_hours"
                      className="font-mono"
                    />
                  </FormField>
                  <FormField label="Label (display name)" htmlFor={`cf-lab-${i}`}>
                    <Input
                      id={`cf-lab-${i}`}
                      value={f.label}
                      onChange={(e) => updateCustomField(i, { label: e.target.value })}
                      placeholder="Office hours"
                    />
                  </FormField>
                  <FormField label="Type" htmlFor={`cf-type-${i}`}>
                    <Select
                      id={`cf-type-${i}`}
                      fieldSize="sm"
                      value={f.type}
                      onChange={(e) => updateCustomField(i, { type: e.target.value as BrandCustomField["type"] })}
                    >
                      {CUSTOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </FormField>
                  <FormField label="Value" htmlFor={`cf-val-${i}`}>
                    <Input
                      id={`cf-val-${i}`}
                      value={f.value ?? ""}
                      onChange={(e) => updateCustomField(i, { value: e.target.value })}
                    />
                  </FormField>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeCustomField(i)}
                    className="text-xs text-error-600 underline hover:text-error-800"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-default bg-white py-3 -mx-4 px-4">
        <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
