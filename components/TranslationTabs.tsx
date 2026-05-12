"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import {
  fetchTranslations,
  saveTranslations,
  type TranslatableEntityType,
  type TranslatableField,
} from "@/lib/translations-api";

const DEFAULT_LANGS: Array<{ code: string; label: string }> = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
  { code: "hy", label: "HY" },
];

type FieldDescriptor = {
  name: TranslatableField;
  label: string;
  multiline?: boolean;
};

type Props = {
  entityType: TranslatableEntityType;
  entityId: number | null;
  fields: FieldDescriptor[];
  /** Override default EN/RU/HY tab set if needed. */
  languages?: Array<{ code: string; label: string }>;
  /** Default language code (skipped from tabs, since the main form already edits it). */
  defaultLanguage?: string;
  className?: string;
};

export function TranslationTabs({
  entityType,
  entityId,
  fields,
  languages = DEFAULT_LANGS,
  defaultLanguage = "en",
  className,
}: Props) {
  const { token } = useAdminAuth();
  const nonDefault = languages.filter((l) => l.code !== defaultLanguage);
  const [activeLang, setActiveLang] = useState<string>(nonDefault[0]?.code ?? "ru");
  const [values, setValues] = useState<Partial<Record<TranslatableField, string>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(
    async (lang: string) => {
      if (!entityId) return;
      setErr(null);
      setLoading(true);
      try {
        const payload = await fetchTranslations(entityType, entityId, lang);
        const next: Partial<Record<TranslatableField, string>> = {};
        for (const f of fields) {
          const v = payload.translations[f.name];
          next[f.name] = typeof v === "string" ? v : "";
        }
        setValues(next);
      } catch (e) {
        setErr(e instanceof ApiRequestError ? e.message : "Failed to load translations");
      } finally {
        setLoading(false);
      }
    },
    [entityType, entityId, fields]
  );

  useEffect(() => {
    void load(activeLang);
  }, [load, activeLang]);

  async function handleSave() {
    if (!token || !entityId) return;
    setSaving(true);
    setErr(null);
    try {
      const trimmed: Partial<Record<TranslatableField, string>> = {};
      for (const f of fields) {
        const v = values[f.name];
        trimmed[f.name] = typeof v === "string" ? v : "";
      }
      await saveTranslations(token, entityType, entityId, activeLang, trimmed);
      setSavedAt(Date.now());
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to save translations");
    } finally {
      setSaving(false);
    }
  }

  if (!entityId) {
    return (
      <div className={className}>
        <p className="text-xs text-fg-t6">Save the record first to enable translation tabs.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 border-b border-default pb-2">
        <div className="flex items-center gap-1">
          {nonDefault.map((l) => {
            const isActive = l.code === activeLang;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => setActiveLang(l.code)}
                className={
                  isActive
                    ? "rounded-md border border-violet-300 bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700"
                    : "rounded-md border border-default bg-white px-3 py-1 text-xs font-medium text-fg-t7 hover:border-violet-300"
                }
              >
                {l.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading}
          className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : `Save ${activeLang.toUpperCase()}`}
        </button>
      </div>

      {err ? <p className="mt-2 text-xs text-error-700">{err}</p> : null}
      {savedAt ? <p className="mt-1 text-xs text-emerald-700">Saved.</p> : null}

      <div className={loading ? "mt-3 space-y-3 opacity-60" : "mt-3 space-y-3"}>
        {fields.map((f) => (
          <label key={f.name} className="block text-xs text-fg-t7">
            {f.label}
            {f.multiline ? (
              <textarea
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
              />
            ) : (
              <input
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
