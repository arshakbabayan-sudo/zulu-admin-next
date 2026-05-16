"use client";

/**
 * Small inline language picker that appears at the top of catalog list pages
 * (Hotels, Excursions, Transfers, etc.). Lets an operator preview how their
 * content rows would render in EN / HY / RU without changing the admin's chrome
 * language. Pattern is borrowed from Shopify's product translation tabs.
 *
 * The selection drives `LanguageContext.contentLang`, which `api-client.ts`
 * forwards to non-i18n endpoints as `?lang=...`. List pages that include
 * `contentLang` in their fetch `useCallback` deps will refetch on change.
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

function FlagFor({ code }: { code: string }) {
  if (code === "en") {
    return <Image src="/flags/gb.svg" alt="" width={18} height={12} className="h-3 w-[1.1rem] shrink-0 rounded-[2px] object-cover" />;
  }
  if (code === "hy") {
    return <Image src="/flags/am.svg" alt="" width={18} height={12} className="h-3 w-[1.1rem] shrink-0 rounded-[2px] object-cover" />;
  }
  if (code === "ru") {
    return <Image src="/flags/ru.svg" alt="" width={18} height={12} className="h-3 w-[1.1rem] shrink-0 rounded-[2px] object-cover" />;
  }
  return <span className="text-xs leading-none" aria-hidden>🌐</span>;
}

export function ContentLanguagePill() {
  const { contentLang, setContentLang, languageOptions, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const labelText = t("admin.content_lang_pill.label") || "Show content as";

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-default bg-white px-2.5 text-xs font-medium text-fg-t7 transition hover:bg-figma-bg-1"
      >
        <span className="text-fg-t6">{labelText}:</span>
        <FlagFor code={contentLang} />
        <span className="uppercase">{contentLang}</span>
        <svg viewBox="0 0 24 24" className="h-3 w-3 fill-none stroke-current text-fg-t6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-[100] mt-1 min-w-[160px] overflow-hidden rounded-md border bg-white py-1 shadow-lg"
          style={{ borderColor: "var(--admin-border)" }}
        >
          {languageOptions.map((option) => (
            <button
              key={option.code}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-slate-50 ${option.code === contentLang ? "font-semibold text-slate-900" : "text-slate-700"}`}
              onClick={() => {
                setContentLang(option.code);
                setOpen(false);
              }}
            >
              <FlagFor code={option.code} />
              <span>{option.label}</span>
              {option.code === contentLang && (
                <svg viewBox="0 0 24 24" className="ml-auto h-3.5 w-3.5 fill-none stroke-current text-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
