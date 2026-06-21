/**
 * Finance — shared presentation helpers (1:1 with the mock).
 *
 * Amounts are per-currency and NEVER summed across currencies; render
 * right-aligned `.font-mono`/`.num`. Dates are DD.MM.YYYY. The status→badge
 * tone map follows INTEGRATION.md §5: paid/settled/completed/active → success ·
 * pending/issued/processing/awaiting/scheduled → warning/info · draft/inactive →
 * gray · failed/void/overdue → danger.
 */

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", AMD: "֏", RUB: "₽" };

/** "$48,250" / "֏18,000" — em-dash on empty. Negative renders with a leading "− ". */
export function money(v: number | null | undefined, currency?: string | null): string {
  if (v === null || v === undefined || (v as unknown) === "") return "—";
  const sym = CURRENCY_SYMBOL[(currency ?? "").toUpperCase()] ?? "";
  const n = Number(v);
  const abs = Math.abs(n).toLocaleString("en-US");
  return `${n < 0 ? "− " : ""}${sym}${abs}`;
}

/** DD.MM.YYYY (mock date format); em-dash on empty. */
export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** DD.MM.YYYY HH:MM (verification logs, drawers). */
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}`;
}

export function initials(name?: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

const TONES = ["", "avatar-teal", "avatar-amber", "avatar-blue"] as const;
export function avatarTone(seed: number | string | null | undefined): string {
  if (seed == null) return "";
  const n = typeof seed === "number" ? seed : Array.from(String(seed)).reduce((a, c) => a + c.charCodeAt(0), 0);
  return TONES[Math.abs(n) % TONES.length]!;
}

const SUCCESS = new Set(["paid", "settled", "completed", "active", "captured", "fulfilled", "used", "valid", "issued_paid", "succeeded"]);
const WARNING = new Set(["pending", "issued", "processing", "awaiting", "scheduled", "pending_payment", "authorized", "in_review", "ready_to_settle", "partially_confirmed", "payable", "reissued"]);
const INFO = new Set(["in_progress", "partial", "processed"]);
const GRAY = new Set(["draft", "inactive", "cancelled", "void", "refunded", "voided", "expired_gray"]);
const DANGER = new Set(["failed", "overdue", "expired", "error"]);

/** management.css badge class for a status string. */
export function statusBadgeCls(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (SUCCESS.has(s)) return "badge-success";
  if (DANGER.has(s)) return "badge-danger";
  if (INFO.has(s)) return "badge-info";
  if (WARNING.has(s)) return "badge-warning";
  if (GRAY.has(s)) return "badge-gray";
  return "badge-gray";
}

export function titleCase(s: string | null | undefined): string {
  return (s ?? "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Normalise a per-currency breakdown object (`{ USD: 90, AMD: 18000 }`) into a
 * stable, render-ready `[code, amount]` list. Filters out empty / non-finite
 * values, upper-cases the code, and sorts AMD-first then alphabetically so the
 * chip order is deterministic. Returns `[]` when the map is absent or empty —
 * the caller then falls back to the legacy single-number rendering. We NEVER
 * sum across currencies; each entry is rendered on its own with `money()`.
 */
export function currencyEntries(
  map: Record<string, number> | null | undefined,
): Array<[string, number]> {
  if (!map) return [];
  const out: Array<[string, number]> = [];
  for (const [code, raw] of Object.entries(map)) {
    const n = Number(raw);
    if (!code || !Number.isFinite(n)) continue;
    out.push([code.toUpperCase(), n]);
  }
  out.sort(([a], [b]) => (a === "AMD" ? -1 : b === "AMD" ? 1 : a.localeCompare(b)));
  return out;
}
