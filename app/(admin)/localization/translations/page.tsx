"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessLocalizationTranslationsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiLocalizationLanguages,
  apiLocalizationTranslationsDelete,
  apiLocalizationTranslationsGet,
  apiLocalizationTranslationsSet,
  LOCALIZATION_ENTITY_TYPES,
  LOCALIZATION_TRANSLATABLE_FIELDS,
  type LocalizationLanguageRow,
} from "@/lib/localization-api";
import { useCallback, useRef, useState } from "react";
import { Button, FormField, Input, PageHeader, Select } from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
} from "@/components/ui/v2";

export default function LocalizationTranslationsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessLocalizationTranslationsNav(user);
  const isSuper = user?.is_super_admin === true;

  const [langs, setLangs] = useState<LocalizationLanguageRow[]>([]);
  const langsLoaded = useRef(false);
  const [entityType, setEntityType] = useState<string>("package");
  const [entityId, setEntityId] = useState<string>("");
  const [languageCode, setLanguageCode] = useState<string>("en");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadedMeta, setLoadedMeta] = useState<{
    entity_type: string;
    entity_id: number;
    language_code: string;
  } | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteLang, setDeleteLang] = useState<string>("");

  const ensureLangsLoaded = useCallback(async () => {
    if (langsLoaded.current) return;
    try {
      const res = await apiLocalizationLanguages(token);
      setLangs(res.data);
      langsLoaded.current = true;
    } catch {
      // non-critical
    }
  }, [token]);

  async function loadTranslations() {
    if (!token) return;
    const id = parseInt(entityId, 10);
    if (!entityType || Number.isNaN(id) || id < 1) {
      setErr(t("admin.content_translations.err_invalid_id"));
      return;
    }
    setErr(null);
    setMsg(null);
    setBusy(true);
    await ensureLangsLoaded();
    try {
      const res = await apiLocalizationTranslationsGet(token, {
        entity_type: entityType,
        entity_id: id,
        lang: languageCode,
        fields: LOCALIZATION_TRANSLATABLE_FIELDS,
      });
      setLoadedMeta({
        entity_type: res.data.entity_type,
        entity_id: res.data.entity_id,
        language_code: res.data.language_code,
      });
      const next: Record<string, string> = {};
      for (const f of LOCALIZATION_TRANSLATABLE_FIELDS) {
        const v = res.data.translations[f];
        next[f] = v == null ? "" : String(v);
      }
      setDrafts(next);
      setMsg(t("admin.content_translations.msg_loaded"));
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.content_translations.err_load"));
    } finally {
      setBusy(false);
    }
  }

  async function saveTranslations() {
    if (!token) return;
    const id = parseInt(entityId, 10);
    if (!entityType || Number.isNaN(id) || id < 1) {
      setErr(t("admin.content_translations.err_invalid_id"));
      return;
    }
    const translations: Record<string, string> = {};
    for (const f of LOCALIZATION_TRANSLATABLE_FIELDS) {
      const v = drafts[f];
      if (v !== undefined && v.trim() !== "") translations[f] = v;
    }
    if (Object.keys(translations).length === 0) {
      setErr(t("admin.content_translations.err_empty_fields"));
      return;
    }
    setErr(null);
    setMsg(null);
    setBusy(true);
    await ensureLangsLoaded();
    try {
      await apiLocalizationTranslationsSet(token, {
        entity_type: entityType,
        entity_id: id,
        language_code: languageCode,
        translations,
      });
      setMsg(t("admin.content_translations.msg_saved"));
      setLoadedMeta({ entity_type: entityType, entity_id: id, language_code: languageCode });
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.content_translations.err_save"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteTranslations() {
    if (!token || !isSuper) return;
    const id = parseInt(entityId, 10);
    if (!entityType || Number.isNaN(id) || id < 1) {
      setErr(t("admin.content_translations.err_invalid_id"));
      return;
    }
    const ok = await confirm({ messageKey: "admin.content_translations.confirm_delete", variant: "danger" });
    if (!ok) return;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const lang = deleteLang.trim() === "" ? null : deleteLang.trim();
      await apiLocalizationTranslationsDelete(token, { entity_type: entityType, entity_id: id, language_code: lang });
      setMsg(t("admin.content_translations.msg_deleted"));
      setDrafts({});
      setLoadedMeta(null);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.content_translations.err_delete"));
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.content_translations.title_short")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice messageKey="admin.forbidden.managing_translations" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.content_translations.title") },
        ]}
        title={t("admin.content_translations.title")}
      />

      <SectionTabs
        activeHref="/localization/translations"
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

      <div className="space-y-6">
      {msg && <div className="rounded-zulu border border-success-100 bg-success-50 px-4 py-2 text-sm text-success-700">{msg}</div>}
      {err && <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}

      <div className="admin-card p-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          <FormField label={t("admin.content_translations.entity_type")} htmlFor="cf-type" className="min-w-[160px]">
            <Select id="cf-type" fieldSize="sm" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              {LOCALIZATION_ENTITY_TYPES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          </FormField>
          <FormField label={t("admin.content_translations.entity_id")} htmlFor="cf-id" className="max-w-[140px]">
            <Input id="cf-id" type="number" min={1} value={entityId} onChange={(e) => setEntityId(e.target.value)} />
          </FormField>
          <FormField label={t("admin.content_translations.language")} htmlFor="cf-lang" className="min-w-[180px]">
            <Select id="cf-lang" fieldSize="sm" value={languageCode} onChange={(e) => setLanguageCode(e.target.value)}>
              {langs.length === 0 ? (
                <option value={languageCode}>{languageCode}</option>
              ) : (
                langs.map((l) => <option key={l.id} value={l.code}>{l.code} - {l.name}</option>)
              )}
            </Select>
          </FormField>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy || !token} onClick={() => loadTranslations()}>
            {t("admin.content_translations.btn_load")}
          </Button>
          <Button size="sm" disabled={busy || !token} onClick={() => saveTranslations()}>
            {t("common.save")}
          </Button>
        </div>
        {loadedMeta && (
          <p className="text-xs text-fg-t7">
            {t("admin.content_translations.editing_prefix")} {loadedMeta.entity_type} #{loadedMeta.entity_id} | {loadedMeta.language_code}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {LOCALIZATION_TRANSLATABLE_FIELDS.map((field) => (
          <div key={field} className="admin-card p-3">
            <div className="text-xs font-mono text-fg-t7">{field}</div>
            <Input
              as="textarea"
              value={drafts[field] ?? ""}
              onChange={(e) => setDrafts((p) => ({ ...p, [field]: e.target.value }))}
              rows={3}
              className="mt-1 max-w-3xl"
            />
          </div>
        ))}
      </div>

      {isSuper && (
        <div className="rounded-xl border border-warning-200 bg-warning-50 p-4">
          <h2 className="text-sm font-semibold text-warning-900">{t("admin.content_translations.delete_section_title")}</h2>
          <p className="mt-1 text-xs text-warning-800">{t("admin.content_translations.delete_section_hint")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              value={deleteLang}
              onChange={(e) => setDeleteLang(e.target.value)}
              placeholder={t("admin.content_translations.delete_lang_placeholder")}
              className="w-48"
            />
            <Button variant="danger" size="sm" disabled={busy || !token} onClick={() => deleteTranslations()}>
              {t("common.delete")}
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
