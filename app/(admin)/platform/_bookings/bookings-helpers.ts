/**
 * Bookings — shared presentation helpers (1:1 with the mock's JS).
 *
 * money() mirrors the mock's symbol map + en-US grouping; the status maps port
 * BK_STATUS / PO_STATUS / PO_PAY (Tabler icon + management.css badge tone), with
 * labels resolved through bookings-i18n so the badge text follows the language.
 */

import type { BookingsKey } from "./bookings-i18n";

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", AMD: "֏" };

/** "$48,250" / "֏18,000" — em-dash on empty, like the mock's money(). */
export function money(v: number | null | undefined, currency?: string | null): string {
  if (v === null || v === undefined || (v as unknown) === "") return "—";
  const sym = CURRENCY_SYMBOL[currency ?? ""] ?? "";
  return `${sym}${Number(v).toLocaleString("en-US")}`;
}

/** Up to two leading letters of a name, used for avatar chips. */
export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

const TONES = ["", "avatar-teal", "avatar-amber", "avatar-blue"] as const;

/** Deterministic avatar tone from a numeric/string seed (mock hardcodes tones;
 *  real data derives one so the same entity is always the same colour). */
export function avatarTone(seed: number | string | null | undefined): string {
  if (seed == null) return "";
  const n = typeof seed === "number" ? seed : Array.from(String(seed)).reduce((a, c) => a + c.charCodeAt(0), 0);
  return TONES[Math.abs(n) % TONES.length]!;
}

/** Locale-ish full date for the relative-time `title=` / Timeline rows. */
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

export type BadgeMeta = { cls: string; icon: string; labelKey: BookingsKey };

/** All bookings — order status (mock BK_STATUS). */
export const BK_STATUS: Record<string, BadgeMeta> = {
  cart: { cls: "badge-gray", icon: "ti-clock", labelKey: "bsCart" },
  pending_payment: { cls: "badge-warning", icon: "ti-clock", labelKey: "bsPendingPayment" },
  paid: { cls: "badge-success", icon: "ti-check", labelKey: "bsPaid" },
  confirmed: { cls: "badge-success", icon: "ti-check", labelKey: "bsConfirmed" },
  completed: { cls: "badge-info", icon: "ti-checks", labelKey: "bsCompleted" },
  cancelled: { cls: "badge-danger", icon: "ti-x", labelKey: "bsCancelled" },
  refunded: { cls: "badge-gray", icon: "ti-rotate", labelKey: "bsRefunded" },
  failed: { cls: "badge-danger", icon: "ti-x", labelKey: "bsFailed" },
};

/** Package orders — order status (mock PO_STATUS). */
export const PO_STATUS: Record<string, BadgeMeta> = {
  pending: { cls: "badge-warning", icon: "ti-clock", labelKey: "osPending" },
  pending_payment: { cls: "badge-warning", icon: "ti-clock", labelKey: "osPendingPayment" },
  confirmed: { cls: "badge-success", icon: "ti-check", labelKey: "osConfirmed" },
  partially_confirmed: { cls: "badge-warning", icon: "ti-progress", labelKey: "osPartiallyConfirmed" },
  in_progress: { cls: "badge-info", icon: "ti-loader", labelKey: "osInProgress" },
  completed: { cls: "badge-info", icon: "ti-checks", labelKey: "osCompleted" },
  fulfilled: { cls: "badge-success", icon: "ti-checks", labelKey: "osFulfilled" },
  cancelled: { cls: "badge-danger", icon: "ti-x", labelKey: "osCancelled" },
  failed: { cls: "badge-danger", icon: "ti-x", labelKey: "osFailed" },
};

/** Package orders — payment status (mock PO_PAY). */
export const PO_PAY: Record<string, BadgeMeta> = {
  paid: { cls: "badge-success", icon: "ti-check", labelKey: "psPaid" },
  captured: { cls: "badge-success", icon: "ti-check", labelKey: "psCaptured" },
  pending: { cls: "badge-warning", icon: "ti-clock", labelKey: "psPending" },
  authorized: { cls: "badge-warning", icon: "ti-lock", labelKey: "psAuthorized" },
  partial: { cls: "badge-info", icon: "ti-loader", labelKey: "psPartial" },
  failed: { cls: "badge-danger", icon: "ti-x", labelKey: "psFailed" },
  refunded: { cls: "badge-gray", icon: "ti-rotate", labelKey: "psRefunded" },
  voided: { cls: "badge-gray", icon: "ti-ban", labelKey: "psVoided" },
};

export function titleCase(s: string): string {
  return (s || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
