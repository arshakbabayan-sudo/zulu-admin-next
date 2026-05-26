/**
 * Shared client-side CSV export utility.
 *
 * Until each list page has a dedicated server-side /export-csv endpoint
 * that streams the full dataset, we generate CSVs from the currently-loaded
 * rows on the client. This pattern was originally inlined per-page (bookings,
 * package-orders) — extracted here so wiring a new page's «Export CSV»
 * button is one function call.
 *
 * Usage:
 *   exportRowsAsCsv("bookings", rows, [
 *     ["id", (r) => r.id],
 *     ["status", (r) => r.status],
 *     ["company", (r) => r.company?.name ?? ""],
 *   ]);
 */

export type CsvColumn<T> = readonly [string, (row: T) => unknown];

function escape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build a CSV string + trigger browser download.
 *
 * @param filenameStem  becomes `<stem>-YYYY-MM-DD-HH-mm-ss.csv`
 * @param rows          source rows; empty array is a no-op
 * @param columns       [header, value-extractor] tuples in column order
 */
export function exportRowsAsCsv<T>(
  filenameStem: string,
  rows: T[],
  columns: ReadonlyArray<CsvColumn<T>>,
): void {
  if (rows.length === 0) return;
  const headers = columns.map(([h]) => h);
  const lines = [headers.map(escape).join(",")];
  for (const r of rows) {
    lines.push(columns.map(([, get]) => escape(get(r))).join(","));
  }
  // UTF-8 BOM (`﻿`) prefix so Excel opens Armenian/Russian column values
  // in the right encoding without prompting the user.
  const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  link.href = url;
  link.download = `${filenameStem}-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
