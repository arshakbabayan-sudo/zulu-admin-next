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
 *   formatCurrency(row.amount, row.currency, lang);
 *
 * All helpers handle null/undefined/invalid input by returning the em-dash
 * placeholder "—" — matches the existing inline `fmt()` helpers across the
 * admin codebase that this module replaces.
 */

type DateInput = string | number | Date | null | undefined;
type NumberInput = number | string | null | undefined;

const EMPTY = "—";

function toDate(input: DateInput): Date | null {
  if (input == null || input === "") return null;
  const d = typeof input === "object" ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNumber(input: NumberInput): number | null {
  if (input == null || input === "") return null;
  const n = typeof input === "number" ? input : Number(input);
  return Number.isFinite(n) ? n : null;
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
export function formatNumber(
  n: NumberInput,
  lang: string = "en",
  options?: Intl.NumberFormatOptions
): string {
  const num = toNumber(n);
  return num == null ? EMPTY : new Intl.NumberFormat(lang, options).format(num);
}

/**
 * Money amount with locale-correct grouping + a fixed two-decimal tail.
 * Pass `currency` to append the ISO code (matches formatCurrency), or omit
 * it for the bare "1,234.56" form admin dashboard cards expect.
 */
export function formatMoney(
  value: NumberInput,
  lang: string = "en",
  currency?: string | null
): string {
  const num = toNumber(value);
  if (num == null) return EMPTY;
  const body = new Intl.NumberFormat(lang, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  if (!currency) return body;

  return `${body} ${currency.toUpperCase()}`;
}

