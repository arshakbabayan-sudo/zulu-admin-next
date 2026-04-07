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

let cachedLanguageOptions: LanguageOption[] | null = null;

export const DEFAULT_LANG: LangCode = "en";

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
  try {
    const url = `${getApiBaseUrl()}/localization/languages`;
    const res = await fetch(url, { cache: "no-store" });
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
    cachedLanguageOptions = opts;
    return {
      options: opts,
      defaultCode: getDefaultLanguageCodeFromRows(json.data),
    };
  } catch {
    return { options: [...FALLBACK_LANGUAGE_OPTIONS], defaultCode: DEFAULT_LANG };
  }
}

export function getCachedLanguageOptions(): LanguageOption[] {
  return cachedLanguageOptions ?? [...FALLBACK_LANGUAGE_OPTIONS];
}

export function getDefaultLanguageCodeFromRows(rows: SupportedLanguageRow[]): string {
  const def = rows.find((r) => r.is_default);
  return def?.code ?? rows[0]?.code ?? DEFAULT_LANG;
}

export function getLanguageMeta(
  code: string,
  options: LanguageOption[] = getCachedLanguageOptions()
): LanguageOption {
  const found = options.find((o) => o.code === code);
  return found ?? options[0] ?? FALLBACK_LANGUAGE_OPTIONS[0];
}

export function resolveInitialLanguage(allowedCodes: string[], defaultCode: string): LangCode {
  const allowed = new Set(allowedCodes);
  if (typeof window === "undefined") {
    return allowed.has(defaultCode) ? defaultCode : (allowedCodes[0] ?? DEFAULT_LANG);
  }
  try {
    const raw = window.localStorage.getItem(ZULU_LANG_KEY);
    if (raw && allowed.has(raw)) return raw;
  } catch {
    // ignore
  }
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${ZULU_LANG_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
    );
    const fromCookie = match?.[1] ? decodeURIComponent(match[1].trim()) : "";
    if (fromCookie && allowed.has(fromCookie)) return fromCookie;
  } catch {
    // ignore
  }
  return allowed.has(defaultCode) ? defaultCode : (allowedCodes[0] ?? DEFAULT_LANG);
}

export function writeStoredLanguage(lang: string): void {
  if (typeof window === "undefined") return;
  const allowed = new Set(getCachedLanguageOptions().map((o) => o.code));
  if (!allowed.has(lang)) return;
  try {
    window.localStorage.setItem(ZULU_LANG_KEY, lang);
  } catch {
    // ignore
  }
  try {
    document.cookie = `${ZULU_LANG_KEY}=${encodeURIComponent(lang)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // ignore
  }
}

export async function fetchUiTranslations(lang: string): Promise<Record<string, string>> {
  try {
    const url = `${getApiBaseUrl()}/localization/ui-translations?lang=${encodeURIComponent(lang)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return {};
    const json = (await res.json()) as {
      success: boolean;
      data: { translations: Record<string, string> };
    };
    return json.success ? (json.data.translations ?? {}) : {};
  } catch {
    return {};
  }
}

export function t(
  key: string,
  translations: Record<string, string>,
  fallbackTranslations?: Record<string, string>
): string {
  return translations[key] ?? fallbackTranslations?.[key] ?? key;
}
