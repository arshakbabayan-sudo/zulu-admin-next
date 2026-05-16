"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LANG,
  fetchSupportedLanguagesMeta,
  fetchUiTranslations,
  getCachedLanguageOptions,
  resolveInitialContentLanguage,
  resolveInitialLanguage,
  t as translateKey,
  writeStoredContentLanguage,
  writeStoredLanguage,
  type LangCode,
  type LanguageOption,
} from "@/lib/zulu-lang";

type LanguageContextValue = {
  /** Admin chrome language (button labels, sidebar, menus). */
  lang: LangCode;
  /** Language used when fetching catalog content (hotel names, descriptions). */
  contentLang: LangCode;
  translations: Record<string, string>;
  isReady: boolean;
  languageOptions: LanguageOption[];
  setLang: (lang: LangCode) => void;
  setContentLang: (lang: LangCode) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function normalizeInitialLang(raw: string | undefined): LangCode {
  if (raw && /^[a-z]{2}(-[a-z]{2})?$/i.test(raw.trim())) {
    return raw.trim().toLowerCase();
  }
  return DEFAULT_LANG;
}

export function LanguageProvider({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang?: string;
}) {
  const router = useRouter();
  const [lang, setLangState] = useState<LangCode>(() => normalizeInitialLang(initialLang));
  const [contentLang, setContentLangState] = useState<LangCode>(() =>
    normalizeInitialLang(initialLang)
  );
  const [translations, setTranslations] = useState<Record<string, string>>({});
  /** English UI map for fallback when selected locale is missing a key (same ref as translations when lang is en). */
  const [defaultTranslations, setDefaultTranslations] = useState<Record<string, string>>({});
  const [isReady, setIsReady] = useState(false);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>(() =>
    getCachedLanguageOptions()
  );

  const loadTranslations = useCallback(async (code: LangCode) => {
    if (code === DEFAULT_LANG) {
      const data = await fetchUiTranslations(code);
      setTranslations(data);
      setDefaultTranslations(data);
      return;
    }
    const [data, enFallback] = await Promise.all([
      fetchUiTranslations(code),
      fetchUiTranslations(DEFAULT_LANG),
    ]);
    setTranslations(data);
    setDefaultTranslations(enFallback);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { options, defaultCode } = await fetchSupportedLanguagesMeta();
      if (cancelled) return;
      setLanguageOptions(options);
      const codes = options.map((o) => o.code);
      const initial = resolveInitialLanguage(codes, defaultCode);
      const initialContent = resolveInitialContentLanguage(codes, defaultCode, initial);
      setLangState(initial);
      setContentLangState(initialContent);
      writeStoredLanguage(initial);
      writeStoredContentLanguage(initialContent);
      await loadTranslations(initial);
      if (!cancelled) {
        setIsReady(true);
        if (initial !== normalizeInitialLang(initialLang)) {
          router.refresh();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTranslations, initialLang, router]);

  const setLang = useCallback(
    (code: LangCode) => {
      const allowed = new Set(languageOptions.map((o) => o.code));
      if (!allowed.has(code)) return;
      writeStoredLanguage(code);
      setLangState(code);
      setIsReady(false);
      void (async () => {
        await loadTranslations(code);
        setIsReady(true);
        router.refresh();
      })();
    },
    [languageOptions, loadTranslations, router]
  );

  const setContentLang = useCallback(
    (code: LangCode) => {
      const allowed = new Set(languageOptions.map((o) => o.code));
      if (!allowed.has(code)) return;
      writeStoredContentLanguage(code);
      setContentLangState(code);
      // Content lang switch does not refresh router or UI strings — it only
      // signals catalog list pages (via contentLang dep) to refetch.
    },
    [languageOptions]
  );

  const t = useCallback(
    (key: string) => translateKey(key, translations, defaultTranslations),
    [translations, defaultTranslations]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      contentLang,
      translations,
      isReady,
      languageOptions,
      setLang,
      setContentLang,
      t,
    }),
    [lang, contentLang, translations, isReady, languageOptions, setLang, setContentLang, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return ctx;
}
