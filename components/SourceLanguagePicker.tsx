"use client";

import { useLanguage } from "@/contexts/LanguageContext";

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

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** When true, the picker is read-only with a "source already set" hint. */
  locked?: boolean;
  className?: string;
};

/**
 * "Which language are you adding this in?" picker. The selected value drives
 * the entity's source_lang, which in turn drives the AI translator — the
 * value the operator enters in the form below will be the canonical source
 * and the other supported languages will be auto-translated from it.
 */
export function SourceLanguagePicker({ value, onChange, locked, className }: Props) {
  const { languageOptions } = useLanguage();

  const langs = languageOptions.length
    ? languageOptions
    : [
        { code: "en", label: "English" },
        { code: "hy", label: "Հայերեն" },
        { code: "ru", label: "Русский" },
      ];

  return (
    <div className={"rounded border border-violet-200 bg-violet-50 p-3 " + (className ?? "")}>
      <div className="mb-2 text-xs font-medium text-violet-900">
        📝 Որ լեզվով ես ավելացնում այս հյուրանոցը։
        <span className="text-violet-700 font-normal">
          {" "}
          AI-ն ավտոմատ կթարգմանի մյուս լեզուներով։
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {langs.map((lang) => {
          const isActive = lang.code === value;
          return (
            <button
              key={lang.code}
              type="button"
              disabled={locked}
              onClick={() => !locked && onChange(lang.code)}
              className={
                (isActive
                  ? "rounded-md border-2 border-violet-500 bg-white px-3 py-1.5 text-xs font-semibold text-violet-900"
                  : "rounded-md border border-default bg-white px-3 py-1.5 text-xs text-fg-t7 hover:border-violet-300") +
                (locked ? " opacity-70 cursor-not-allowed" : "")
              }
            >
              <span className="mr-1">{FLAG_BY_CODE[lang.code] ?? "🌐"}</span>
              {(lang as { label?: string }).label ?? lang.code.toUpperCase()}
            </button>
          );
        })}
      </div>
      {locked && (
        <p className="mt-2 text-[10px] text-violet-700">
          Աղբյուր լեզուն արդեն ընտրված է. Փոփոխությունը կհանգեցնի AI-ի կողմից մյուս լեզուների կրկնակի թարգմանության։
        </p>
      )}
    </div>
  );
}
