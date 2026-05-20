/**
 * Locale-aware date and number formatters. Default browser locale (en-US)
 * leaks an English appearance on Armenian/Russian admin sessions, so every
 * UI call should pass the active language code from `useLanguage()`.
 *
 * Usage:
 *   const { lang } = useLanguage();
 *   formatDate(row.created_at, lang);
 *   formatDateTime(row.updated_at, lang);
 *   formatNumber(row.amount, lang);
 *
 * All helpers handle null/undefined/invalid input by returning the em-dash
 * placeholder "—" — matches the existing inline `fmt()` helpers across the
 * admin codebase that this module replaces.
 */

type DateInput = string | number | Date | null | undefined;

const EMPTY = "—";

function toDate(input: DateInput): Date | null {
  if (input == null || input === "") return null;
  const d = typeof input === "object" ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** YYYY-MM-DD / DD.MM.YYYY style date, locale-aware. */
export function formatDate(input: DateInput, lang: string = "en"): string {
  const d = toDate(input);
  return d ? d.toLocaleDateString(lang) : EMPTY;
}

/** Date + time, locale-aware. */
export function formatDateTime(input: DateInput, lang: string = "en"): string {
  const d = toDate(input);
  return d ? d.toLocaleString(lang) : EMPTY;
}

/** Locale-aware number formatting (thousands separators, etc.). */
export function formatNumber(n: number | null | undefined, lang: string = "en"): string {
  if (n == null || Number.isNaN(n)) return EMPTY;
  return new Intl.NumberFormat(lang).format(n);
}
