"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiRequestError } from "@/lib/api-client";
import {
  fetchAllLanguages,
  retranslateEntity,
  saveTranslations,
  type AllLanguagesPayload,
  type TranslatableEntityType,
  type TranslatableField,
  type TranslationRow,
} from "@/lib/translations-api";

type FieldDescriptor = {
  name: TranslatableField;
  label: string;
  multiline?: boolean;
};

type Props = {
  entityType: TranslatableEntityType;
  entityId: number | null;
  fields: FieldDescriptor[];
  className?: string;
};

const FLAG_BY_CODE: Record<string, string> = {
  en: "🇬🇧",
  hy: "🇦🇲",
  ru: "🇷🇺",
  ar: "🇸🇦",
  fr: "🇫🇷",
  es: "🇪🇸",
  de: "🇩🇪",
  it: "🇮🇹",
  zh: "🇨🇳",
  tr: "🇹🇷",
  fa: "🇮🇷",
};

function flagFor(code: string): string {
  return FLAG_BY_CODE[code.toLowerCase()] ?? "🌐";
}

/**
 * Equal-language content translation editor. Every supported language is a
 * top-level tab — the source language (the one the operator first entered
 * the record in) gets a 📝 badge but isn't otherwise special. Each
 * non-source tab can be filled by the AI translator on demand; rows
 * already filled by a human are flagged 🔒 and won't be overwritten by
 * the AI without an explicit re-translate request.
 */
export function TranslationTabs({ entityType, entityId, fields, className }: Props) {
  const { token } = useAdminAuth();
  const { languageOptions } = useLanguage();
  const [payload, setPayload] = useState<AllLanguagesPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeLang, setActiveLang] = useState<string>("");
  const [draft, setDraft] = useState<Record<string, Partial<Record<TranslatableField, string>>>>({});
  const [saving, setSaving] = useState(false);
  const [retranslating, setRetranslating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const enabledLangs = useMemo(() => {
    const list = languageOptions.length
      ? languageOptions.map((l) => ({ code: l.code, label: l.code.toUpperCase() }))
      : [
          { code: "en", label: "EN" },
          { code: "hy", label: "HY" },
          { code: "ru", label: "RU" },
        ];
    return list;
  }, [languageOptions]);

  const load = useCallback(async () => {
    if (!entityId || !token) return;
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchAllLanguages(token, entityType, entityId);
      setPayload(data);
      const initialDraft: Record<string, Partial<Record<TranslatableField, string>>> = {};
      for (const lang of enabledLangs) {
        const langRows = data.languages[lang.code] ?? {};
        const langDraft: Partial<Record<TranslatableField, string>> = {};
        for (const f of fields) {
          langDraft[f.name] = langRows[f.name]?.value ?? "";
        }
        initialDraft[lang.code] = langDraft;
      }
      setDraft(initialDraft);
      if (!activeLang) {
        const initialLang = data.source_lang ?? enabledLangs[0]?.code ?? "en";
        setActiveLang(initialLang);
      }
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to load translations");
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, token, enabledLangs, fields, activeLang]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!token || !entityId || !activeLang) return;
    setSaving(true);
    setErr(null);
    setNotice(null);
    try {
      const langDraft = draft[activeLang] ?? {};
      const trimmed: Partial<Record<TranslatableField, string>> = {};
      for (const f of fields) {
        const v = langDraft[f.name];
        trimmed[f.name] = typeof v === "string" ? v : "";
      }
      const result = await saveTranslations(token, entityType, entityId, activeLang, trimmed);
      if (result.ai_translation_dispatched) {
        setNotice("Պահպանվեց։ AI թարգմանիչը մյուս լեզուները լրացնում է հետին պլանում։");
      } else {
        setNotice("Պահպանվեց։");
      }
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to save translations");
    } finally {
      setSaving(false);
    }
  }

  async function handleRetranslate() {
    if (!token || !entityId || !activeLang) return;
    setRetranslating(true);
    setErr(null);
    setNotice(null);
    try {
      const result = await retranslateEntity(token, entityType, entityId, {
        target_locales: [activeLang],
        fields: fields.map((f) => f.name),
      });
      setNotice(
        result.queued
          ? `AI-ն կրկին թարգմանելու է ${activeLang.toUpperCase()} (աղբյուր՝ ${result.source_lang.toUpperCase()})։ ~30 վայրկյան։`
          : "Չհաջողվեց հերթագրել թարգմանությունը։"
      );
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to queue re-translation");
    } finally {
      setRetranslating(false);
    }
  }

  if (!entityId) {
    return (
      <div className={className}>
        <p className="text-xs text-fg-t6">Save the record first to enable translation tabs.</p>
      </div>
    );
  }

  const sourceLang = payload?.source_lang ?? null;
  const isActiveSource = sourceLang !== null && sourceLang === activeLang;
  const activeRowsByField: Partial<Record<TranslatableField, TranslationRow>> = {};
  if (payload && payload.languages[activeLang]) {
    for (const f of fields) {
      const row = payload.languages[activeLang][f.name];
      if (row) activeRowsByField[f.name] = row;
    }
  }
  // Heuristic per-tab status badge: if every field for this language has a
  // value AND at least one is manually edited → "Manual". If every field has
  // a value but none manually edited → "AI". Otherwise → "Empty / Partial".
  function tabBadge(langCode: string): "source" | "manual" | "ai" | "partial" | "empty" {
    if (sourceLang === langCode) return "source";
    const rows = payload?.languages[langCode] ?? {};
    let filled = 0;
    let manual = 0;
    for (const f of fields) {
      const r = rows[f.name];
      if (r && typeof r.value === "string" && r.value.trim() !== "") {
        filled++;
        if (r.is_manually_edited) manual++;
      }
    }
    if (filled === 0) return "empty";
    if (filled < fields.length) return "partial";
    if (manual > 0) return "manual";
    return "ai";
  }

  function badgeIcon(kind: "source" | "manual" | "ai" | "partial" | "empty"): string {
    switch (kind) {
      case "source":
        return "📝";
      case "manual":
        return "🔒";
      case "ai":
        return "🤖";
      case "partial":
        return "✏️";
      case "empty":
        return "";
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-default pb-2">
        <div className="flex flex-wrap items-center gap-1">
          {enabledLangs.map((l) => {
            const isActive = l.code === activeLang;
            const kind = tabBadge(l.code);
            const icon = badgeIcon(kind);
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => setActiveLang(l.code)}
                title={
                  kind === "source"
                    ? "Աղբյուր լեզուն (օպերատորը այս լեզվով ա սկսել)"
                    : kind === "manual"
                      ? "Ձեռքով խմբագրված"
                      : kind === "ai"
                        ? "AI-ով թարգմանված"
                        : kind === "partial"
                          ? "Մասամբ լրացված"
                          : "Դատարկ"
                }
                className={
                  isActive
                    ? "rounded-md border border-violet-400 bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700"
                    : "rounded-md border border-default bg-white px-3 py-1 text-xs font-medium text-fg-t7 hover:border-violet-300"
                }
              >
                <span className="mr-1">{flagFor(l.code)}</span>
                {l.label}
                {icon ? <span className="ml-1 text-[10px]">{icon}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {!isActiveSource && sourceLang !== null && (
            <button
              type="button"
              onClick={() => void handleRetranslate()}
              disabled={retranslating || loading}
              className="rounded border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-60"
              title={`AI-ն վերցնի ${sourceLang.toUpperCase()}-ից ու թարգմանի ${activeLang.toUpperCase()}-ով`}
            >
              {retranslating ? "..." : `🤖 ${activeLang.toUpperCase()}-ով AI թարգմանել`}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading || !activeLang}
            className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? "Պահպանում..." : `Պահպանել ${activeLang.toUpperCase()}`}
          </button>
        </div>
      </div>

      {isActiveSource && (
        <p className="mt-2 text-xs text-violet-700">
          📝 <b>Աղբյուր լեզուն։</b> Փոփոխությունները ավտոմատ AI-ով կտարածվեն մյուս լեզուների վրա (բացի ձեռքով կողպված տողերից)։
        </p>
      )}

      {err ? <p className="mt-2 text-xs text-error-700">{err}</p> : null}
      {notice ? <p className="mt-1 text-xs text-emerald-700">{notice}</p> : null}

      <div className={loading ? "mt-3 space-y-3 opacity-60" : "mt-3 space-y-3"}>
        {fields.map((f) => {
          const langDraft = draft[activeLang] ?? {};
          const row = activeRowsByField[f.name];
          const wasManuallyEdited = row?.is_manually_edited ?? false;
          const status = row?.translation_status ?? "manual";
          return (
            <div key={f.name}>
              <div className="flex items-center justify-between gap-2 pb-1">
                <label className="text-xs font-medium text-fg-t7">{f.label}</label>
                {!isActiveSource && row && (
                  <span className="text-[10px] text-fg-t8">
                    {wasManuallyEdited ? "🔒 ձեռքով" : status === "ai_completed" ? "🤖 AI" : "—"}
                  </span>
                )}
              </div>
              {f.multiline ? (
                <textarea
                  value={langDraft[f.name] ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [activeLang]: { ...(prev[activeLang] ?? {}), [f.name]: e.target.value },
                    }))
                  }
                  rows={3}
                  className="w-full rounded border border-default px-2 py-1.5 text-sm"
                  dir={activeLang === "ar" || activeLang === "fa" ? "rtl" : "ltr"}
                />
              ) : (
                <input
                  value={langDraft[f.name] ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [activeLang]: { ...(prev[activeLang] ?? {}), [f.name]: e.target.value },
                    }))
                  }
                  className="w-full rounded border border-default px-2 py-1.5 text-sm"
                  dir={activeLang === "ar" || activeLang === "fa" ? "rtl" : "ltr"}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
