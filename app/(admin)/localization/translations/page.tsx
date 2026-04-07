"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
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
      setErr("Enter a valid entity id.");
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
      setMsg("Loaded.");
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveTranslations() {
    if (!token) return;
    const id = parseInt(entityId, 10);
    if (!entityType || Number.isNaN(id) || id < 1) {
      setErr("Enter a valid entity id.");
      return;
    }
    const translations: Record<string, string> = {};
    for (const f of LOCALIZATION_TRANSLATABLE_FIELDS) {
      const v = drafts[f];
      if (v !== undefined && v.trim() !== "") translations[f] = v;
    }
    if (Object.keys(translations).length === 0) {
      setErr("Add at least one non-empty field before saving.");
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
      setMsg("Saved.");
      setLoadedMeta({
        entity_type: entityType,
        entity_id: id,
        language_code: languageCode,
      });
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTranslations() {
    if (!token || !isSuper) return;
    const id = parseInt(entityId, 10);
    if (!entityType || Number.isNaN(id) || id < 1) {
      setErr("Enter a valid entity id.");
      return;
    }
    if (!window.confirm("Delete translations for this entity?")) return;
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
      setMsg("Deleted.");
      setDrafts({});
      setLoadedMeta(null);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Translations</h1>
        <div className="mt-4">
          <ForbiddenNotice messageKey="admin.forbidden.managing_translations" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Content translations</h1>
      {msg && <p className="mt-2 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-xs text-slate-600">
            Entity type
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
            >
              {LOCALIZATION_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-slate-600">
            Entity id
            <input
              type="number"
              min={1}
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="mt-1 w-32 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-600">
            Language
            <select
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
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
            className="rounded bg-slate-200 px-3 py-1 text-sm disabled:opacity-50"
          >
            Load
          </button>
          <button
            type="button"
            disabled={busy || !token}
            onClick={() => saveTranslations()}
            className="rounded bg-slate-800 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
        {loadedMeta && (
          <p className="text-xs text-slate-700">
            Editing {loadedMeta.entity_type} #{loadedMeta.entity_id} | {loadedMeta.language_code}
          </p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {LOCALIZATION_TRANSLATABLE_FIELDS.map((field) => (
          <div key={field} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-xs font-mono text-slate-700">{field}</div>
            <textarea
              value={drafts[field] ?? ""}
              onChange={(e) => setDrafts((p) => ({ ...p, [field]: e.target.value }))}
              rows={3}
              className="mt-1 w-full max-w-3xl rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        ))}
      </div>

      {isSuper && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Delete translations (super admin)</h2>
          <p className="mt-1 text-xs text-amber-800">
            Optional language code - leave empty to delete all languages for this entity.
          </p>
          <input
            type="text"
            value={deleteLang}
            onChange={(e) => setDeleteLang(e.target.value)}
            placeholder="e.g. ru (optional)"
            className="mt-2 w-48 rounded border border-amber-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            disabled={busy || !token}
            onClick={() => deleteTranslations()}
            className="ml-2 rounded bg-amber-900 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
