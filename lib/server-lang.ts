import { cookies } from "next/headers";
import { DEFAULT_LANG, ZULU_LANG_KEY } from "@/lib/zulu-lang";

/** Server: `<html lang>` + LanguageProvider initial value (cookie written by {@link writeStoredLanguage}). */
export function getServerLang(): string {
  try {
    const c = cookies().get(ZULU_LANG_KEY)?.value;
    if (c && /^[a-z]{2}(-[a-z]{2})?$/i.test(c.trim())) {
      return c.trim().toLowerCase();
    }
  } catch {
    // cookies() unavailable outside request
  }
  return DEFAULT_LANG;
}
