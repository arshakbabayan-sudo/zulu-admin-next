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
const DEFAULT_CURRENCY = "USD";

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
export function formatNumber(n: NumberInput, lang: string = "en"): string {
  const num = toNumber(n);
  return num == null ? EMPTY : new Intl.NumberFormat(lang).format(num);
}

/**
 * Currency-aware price string: "1,996 USD" with locale-correct thousands
 * separators and a trailing ISO currency code. Suppliers can leave the
 * currency unset on legacy data; in that case we default to USD.
 */
export function formatCurrency(
  value: NumberInput,
  currency: string | null | undefined = DEFAULT_CURRENCY,
  lang: string = "en"
): string {
  const num = toNumber(value);
  if (num == null) return EMPTY;
  const code = (currency ?? DEFAULT_CURRENCY).toUpperCase();
  return `${new Intl.NumberFormat(lang).format(num)} ${code}`;
}

/**
 * Range formatter for booking-period / report-window cells. Returns the
 * em-dash placeholder if either side is missing.
 */
export function formatDateRange(
  start: DateInput,
  end: DateInput,
  lang: string = "en"
): string {
  const a = toDate(start);
  const b = toDate(end);
  if (!a || !b) return EMPTY;
  return `${a.toLocaleDateString(lang)} – ${b.toLocaleDateString(lang)}`;
}
