"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
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

export default function LocalizationTranslationsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
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

  // Lazy — load languages only once, on first Load/Save click.
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
      setLoadedMeta({
        entity_type: entityType,
        entity_id: id,
        language_code: languageCode,
      });
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
    if (!window.confirm(t("admin.content_translations.confirm_delete"))) return;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const lang = deleteLang.trim() === "" ? null : deleteLang.trim();
      await apiLocalizationTranslationsDelete(token, {
        entity_type: entityType,
        entity_id: id,
        language_code: lang,
      });
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
      <div>
        <h1 className="admin-page-title">{t("admin.content_translations.title_short")}</h1>
        <div className="mt-4">
          <ForbiddenNotice messageKey="admin.forbidden.managing_translations" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.content_translations.title")}</h1>
      {msg && <p className="mt-2 text-sm text-success-700">{msg}</p>}
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}

      <div className="admin-card mt-4 space-y-3 p-4">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-xs text-fg-t6">
            {t("admin.content_translations.entity_type")}
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="mt-1 rounded border border-default px-2 py-1 text-sm"
            >
              {LOCALIZATION_ENTITY_TYPES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-fg-t6">
            {t("admin.content_translations.entity_id")}
            <input
              type="number"
              min={1}
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="mt-1 w-32 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs text-fg-t6">
            {t("admin.content_translations.language")}
            <select
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              className="mt-1 rounded border border-default px-2 py-1 text-sm"
            >
              {langs.length === 0 ? (
                <option value={languageCode}>{languageCode}</option>
              ) : (
                langs.map((l) => (
                  <option key={l.id} value={l.code}>
                    {l.code} - {l.name}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !token}
            onClick={() => loadTranslations()}
            className="admin-btn-secondary"
          >
            {t("admin.content_translations.btn_load")}
          </button>
          <button
            type="button"
            disabled={busy || !token}
            onClick={() => saveTranslations()}
            className="admin-btn-primary"
          >
            {t("common.save")}
          </button>
        </div>
        {loadedMeta && (
          <p className="text-xs text-fg-t7">
            {t("admin.content_translations.editing_prefix")} {loadedMeta.entity_type} #{loadedMeta.entity_id} | {loadedMeta.language_code}
          </p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {LOCALIZATION_TRANSLATABLE_FIELDS.map((field) => (
          <div key={field} className="admin-card p-3">
            <div className="text-xs font-mono text-fg-t7">{field}</div>
            <textarea
              value={drafts[field] ?? ""}
              onChange={(e) => setDrafts((p) => ({ ...p, [field]: e.target.value }))}
              rows={3}
              className="mt-1 w-full max-w-3xl rounded-zulu border border-default bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
        ))}
      </div>

      {isSuper && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">{t("admin.content_translations.delete_section_title")}</h2>
          <p className="mt-1 text-xs text-warning-800">
            {t("admin.content_translations.delete_section_hint")}
          </p>
          <input
            type="text"
            value={deleteLang}
            onChange={(e) => setDeleteLang(e.target.value)}
            placeholder={t("admin.content_translations.delete_lang_placeholder")}
            className="mt-2 w-48 rounded border border-amber-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            disabled={busy || !token}
            onClick={() => deleteTranslations()}
            className="ml-2 rounded bg-amber-900 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {t("common.delete")}
          </button>
        </div>
      )}
    </div>
  );
}
