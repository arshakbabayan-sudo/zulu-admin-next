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
import { useLanguage } from "@/contexts/LanguageContext";
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
import { Button, FormField, Input, Select } from "@/components/ui";
import { PageHeader as V2PageHeader, SectionTabs, V2Card, V2Button } from "@/components/ui/v2";

const SETTINGS_TABS = [
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
];

const CUSTOM_TYPES: BrandCustomField["type"][] = ["text", "url", "email", "phone", "image", "tel"];

function emptyCustomField(): BrandCustomField {
  return { key: "", label: "", type: "text", value: "" };
}

export default function PlatformBrandSettingsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
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
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.commission.err_load"));
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
      setErr(e instanceof ApiRequestError ? e.message : t("admin.commission.err_save"));
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
        <h1 className="admin-page-title">{t("admin.brand.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.brand.title")}</h1>
        <p className="text-sm text-fg-t7">{t("admin.commission.loading")}</p>
      </div>
    );
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.brand.title") },
        ]}
        title={t("admin.brand.title")}
        subtitle={t("admin.brand.subtitle")}
        actions={
          <V2Button variant="primary" disabled={saving} onClick={() => void handleSave()}>
            {saving ? t("admin.crud.common.saving") : t("admin.template_detail.btn_save")}
          </V2Button>
        }
      />
      <SectionTabs activeHref="/platform/settings/brand" items={SETTINGS_TABS} />
      <div className="max-w-3xl space-y-6 mt-6">

      {err && <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}
      {savedAt && <div className="rounded-zulu border border-success-100 bg-success-50 px-4 py-2 text-sm text-success-700">{t("admin.brand.saved")}</div>}

      <V2Card className="p-4">
        <h2 className="text-base font-semibold text-fg-t11">{t("admin.brand.section.imagery")}</h2>
        <p className="mt-1 mb-3 text-xs text-fg-t7">{t("admin.brand.section.imagery_hint")}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <ImageUploadField
            value={data.logo_url ?? ""}
            onChange={(v) => updateField("logo_url", v === "" ? null : v)}
            section="banners"
            label={t("admin.brand.field.logo")}
            altText="ZULU logo"
          />
          <ImageUploadField
            value={data.emblem_url ?? ""}
            onChange={(v) => updateField("emblem_url", v === "" ? null : v)}
            section="banners"
            label={t("admin.brand.field.emblem")}
            altText="ZULU emblem"
          />
          <ImageUploadField
            value={data.favicon_url ?? ""}
            onChange={(v) => updateField("favicon_url", v === "" ? null : v)}
            section="banners"
            label={t("admin.brand.field.favicon")}
            altText="Favicon"
          />
        </div>
      </V2Card>

      <V2Card className="p-4">
        <h2 className="text-base font-semibold text-fg-t11">{t("admin.brand.section.contact")}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <FormField label={t("admin.brand.field.phone")} htmlFor="br-phone">
            <Input
              id="br-phone"
              value={data.phone ?? ""}
              onChange={(e) => updateField("phone", e.target.value === "" ? null : e.target.value)}
              placeholder="+374 11 123 456"
            />
          </FormField>
          <FormField label={t("admin.brand.field.email")} htmlFor="br-email">
            <Input
              id="br-email"
              type="email"
              value={data.email ?? ""}
              onChange={(e) => updateField("email", e.target.value === "" ? null : e.target.value)}
              placeholder="info@zulu.am"
            />
          </FormField>
          <FormField label={t("admin.brand.field.address")} htmlFor="br-addr" className="md:col-span-2">
            <Input
              id="br-addr"
              value={data.address ?? ""}
              onChange={(e) => updateField("address", e.target.value === "" ? null : e.target.value)}
              placeholder={t("admin.brand.field.address_placeholder")}
            />
          </FormField>
          <FormField label={t("admin.brand.field.city")} htmlFor="br-city">
            <Input
              id="br-city"
              value={data.address_city ?? ""}
              onChange={(e) => updateField("address_city", e.target.value === "" ? null : e.target.value)}
            />
          </FormField>
          <FormField label={t("admin.brand.field.country")} htmlFor="br-country">
            <Input
              id="br-country"
              value={data.address_country ?? ""}
              onChange={(e) => updateField("address_country", e.target.value === "" ? null : e.target.value)}
            />
          </FormField>
        </div>
      </V2Card>

      <V2Card className="p-4">
        <h2 className="text-base font-semibold text-fg-t11">{t("admin.brand.section.social")}</h2>
        <p className="mt-1 mb-3 text-xs text-fg-t7">{t("admin.brand.section.social_hint")}</p>
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
      </V2Card>

      <V2Card className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-fg-t11">{t("admin.brand.section.custom_fields")}</h2>
            <p className="text-xs text-fg-t7">{t("admin.brand.section.custom_fields_hint")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={addCustomField}>{t("admin.brand.add_field")}</Button>
        </div>
        {data.custom_fields.length === 0 ? (
          <p className="mt-3 text-xs text-fg-t6">{t("admin.brand.empty_custom_fields")}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {data.custom_fields.map((f, i) => (
              <div key={i} className="rounded-zulu border border-default bg-figma-bg-1 p-3">
                <div className="grid gap-2 md:grid-cols-4">
                  <FormField label={t("admin.brand.field.cf_key")} htmlFor={`cf-key-${i}`}>
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
                  <FormField label={t("admin.brand.field.cf_label")} htmlFor={`cf-lab-${i}`}>
                    <Input
                      id={`cf-lab-${i}`}
                      value={f.label}
                      onChange={(e) => updateCustomField(i, { label: e.target.value })}
                      placeholder={t("admin.brand.field.cf_label_placeholder")}
                    />
                  </FormField>
                  <FormField label={t("admin.contracts.col_type")} htmlFor={`cf-type-${i}`}>
                    <Select
                      id={`cf-type-${i}`}
                      fieldSize="sm"
                      value={f.type}
                      onChange={(e) => updateCustomField(i, { type: e.target.value as BrandCustomField["type"] })}
                    >
                      {CUSTOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </FormField>
                  <FormField label={t("admin.brand.field.cf_value")} htmlFor={`cf-val-${i}`}>
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
                    {t("admin.commission.btn_remove")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </V2Card>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-default bg-white py-3 -mx-4 px-4">
        <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
          {saving ? t("admin.crud.common.saving") : t("admin.template_detail.btn_save")}
        </Button>
      </div>
      </div>
    </div>
  );
}
