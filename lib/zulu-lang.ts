import { getApiBaseUrl } from "./api-base";

export const ZULU_LANG_KEY = "zulu_lang";

/** API shape from GET /api/localization/languages */
export type SupportedLanguageRow = {
  id: number;
  code: string;
  name: string;
  name_en: string;
  is_default: boolean;
  sort_order: number;
};

export type LanguageOption = {
  code: string;
  label: string;
  flag?: string;
};

const FALLBACK_LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Russian", flag: "🇷🇺" },
  { code: "hy", label: "Armenian", flag: "🇦🇲" },
];

export type LangCode = string;

export const DEFAULT_LANG: LangCode = "en";

let cachedLanguageOptions: LanguageOption[] | null = null;
let cachedLanguageDefaultCode: string = DEFAULT_LANG;
let languageMetaFetchedAt = 0;
let languageMetaPromise: Promise<{ options: LanguageOption[]; defaultCode: string }> | null = null;
const languageTranslationsCache = new Map<string, { data: Record<string, string>; fetchedAt: number }>();
const languageTranslationsPromises = new Map<string, Promise<Record<string, string>>>();

const LANGUAGE_META_TTL_MS = 5 * 60 * 1000;
const UI_TRANSLATIONS_TTL_MS = 60 * 1000;

function buildOptionsFromApi(rows: SupportedLanguageRow[]): LanguageOption[] {
  return rows.map((row) => ({
    code: row.code,
    label: row.name_en?.trim() ? row.name_en : row.name,
    flag: undefined,
  }));
}

export async function fetchSupportedLanguagesMeta(): Promise<{
  options: LanguageOption[];
  defaultCode: string;
}> {
  const now = Date.now();
  if (
    cachedLanguageOptions &&
    now - languageMetaFetchedAt < LANGUAGE_META_TTL_MS
  ) {
    return { options: cachedLanguageOptions, defaultCode: cachedLanguageDefaultCode };
  }

  if (languageMetaPromise) {
    return languageMetaPromise;
  }

  languageMetaPromise = (async () => {
    try {
      const url = `${getApiBaseUrl()}/localization/languages`;
      const res = await fetch(url);
      if (!res.ok) {
        return { options: [...FALLBACK_LANGUAGE_OPTIONS], defaultCode: DEFAULT_LANG };
      }
      const json = (await res.json()) as {
        success: boolean;
        data: SupportedLanguageRow[];
      };
      if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
        return { options: [...FALLBACK_LANGUAGE_OPTIONS], defaultCode: DEFAULT_LANG };
      }
      const opts = buildOptionsFromApi(json.data);
      const defaultCode = getDefaultLanguageCodeFromRows(json.data);
      cachedLanguageOptions = opts;
      cachedLanguageDefaultCode = defaultCode;
      languageMetaFetchedAt = Date.now();
      return {
        options: opts,
        defaultCode,
      };
    } catch {
      return { options: [...FALLBACK_LANGUAGE_OPTIONS], defaultCode: DEFAULT_LANG };
    } finally {
      languageMetaPromise = null;
    }
  })();

  return languageMetaPromise;
}

export function getCachedLanguageOptions(): LanguageOption[] {
  return cachedLanguageOptions ?? [...FALLBACK_LANGUAGE_OPTIONS];
}

export function getDefaultLanguageCodeFromRows(rows: SupportedLanguageRow[]): string {
  const def = rows.find((r) => r.is_default);
  return def?.code ?? rows[0]?.code ?? DEFAULT_LANG;
}

function canonicalizeLanguageCode(raw: string | null | undefined, allowedCodes: string[]): string | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;

  const lowerToCanonical = new Map<string, string>();
  for (const code of allowedCodes) {
    lowerToCanonical.set(code.toLowerCase(), code);
  }

  const exact = lowerToCanonical.get(normalized);
  if (exact) return exact;

  const primary = normalized.replace(/_/g, "-").split("-")[0] ?? "";
  if (!primary) return null;
  return lowerToCanonical.get(primary) ?? null;
}

export function getLanguageMeta(
  code: string,
  options: LanguageOption[] = getCachedLanguageOptions()
): LanguageOption {
  const found = options.find((o) => o.code === code);
  return found ?? options[0] ?? FALLBACK_LANGUAGE_OPTIONS[0];
}

export function resolveInitialLanguage(allowedCodes: string[], defaultCode: string): LangCode {
  const fallback =
    canonicalizeLanguageCode(defaultCode, allowedCodes) ??
    canonicalizeLanguageCode(allowedCodes[0] ?? DEFAULT_LANG, allowedCodes) ??
    DEFAULT_LANG;

  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(ZULU_LANG_KEY);
    const stored = canonicalizeLanguageCode(raw, allowedCodes);
    if (stored) return stored;
  } catch {
    // ignore
  }
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${ZULU_LANG_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
    );
    const fromCookie = match?.[1] ? decodeURIComponent(match[1].trim()) : "";
    const cookieValue = canonicalizeLanguageCode(fromCookie, allowedCodes);
    if (cookieValue) return cookieValue;
  } catch {
    // ignore
  }
  return fallback;
}

export function writeStoredLanguage(lang: string): void {
  if (typeof window === "undefined") return;
  const allowedCodes = getCachedLanguageOptions().map((o) => o.code);
  const canonical = canonicalizeLanguageCode(lang, allowedCodes);
  if (!canonical) return;
  try {
    window.localStorage.setItem(ZULU_LANG_KEY, canonical);
  } catch {
    // ignore
  }
  try {
    document.cookie = `${ZULU_LANG_KEY}=${encodeURIComponent(canonical)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // ignore
  }
}

export async function fetchUiTranslations(lang: string): Promise<Record<string, string>> {
  const cacheHit = languageTranslationsCache.get(lang);
  if (cacheHit && Date.now() - cacheHit.fetchedAt < UI_TRANSLATIONS_TTL_MS) {
    return cacheHit.data;
  }

  const inFlight = languageTranslationsPromises.get(lang);
  if (inFlight) return inFlight;

  const request = (async () => {
    try {
      const url = `${getApiBaseUrl()}/localization/ui-translations?lang=${encodeURIComponent(lang)}`;
      const res = await fetch(url);
      if (!res.ok) return {};
      const json = (await res.json()) as {
        success: boolean;
        data: { translations: Record<string, string> };
      };
      const data = json.success ? (json.data.translations ?? {}) : {};
      languageTranslationsCache.set(lang, { data, fetchedAt: Date.now() });
      return data;
    } catch {
      return {};
    } finally {
      languageTranslationsPromises.delete(lang);
    }
  })();

  languageTranslationsPromises.set(lang, request);
  return request;
}

export function t(
  key: string,
  translations: Record<string, string>,
  fallbackTranslations?: Record<string, string>
): string {
  return translations[key] ?? fallbackTranslations?.[key] ?? key;
}
