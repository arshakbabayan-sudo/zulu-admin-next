export function visaNumberFromApi(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** API `required_documents` array → textarea value (one line per item). */
export function requiredDocumentsLinesFromApi(value: string[] | null | undefined): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((s) => String(s).trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

/** Textarea (one line per item) → trimmed non-empty strings for API. */
export function requiredDocumentsArrayFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function visaMoneyCell(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return "—";
  const cur = (currency ?? "").trim();
  return cur ? `${cur} ${Number(amount).toFixed(2)}` : String(Number(amount).toFixed(2));
}
