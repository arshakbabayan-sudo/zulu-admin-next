import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";

// ─── CSV serialisation ────────────────────────────────────────────────────────

export function escapeCsvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function stringifyCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h])).join(","));
  }
  return lines.join("\r\n");
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

export type CsvParseResult = {
  headers: string[];
  rows: Record<string, string>[];
  /** 1-based line number in the source file for each entry in `rows` (header row is line 1). */
  rowLineNumbers: number[];
  error: string | null;
};

function rowIsAllBlank(obj: Record<string, string>): boolean {
  return Object.values(obj).every((v) => String(v ?? "").trim() === "");
}

/** Minimal RFC-style CSV parser (quoted fields, CRLF/LF). Strips UTF-8 BOM; skips blank data rows. */
export function parseCsv(text: string): CsvParseResult {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);

  const rowsRaw: string[][] = [];
  let field = "";
  let row: string[] = [];
  let i = 0;
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { rowsRaw.push(row); row = []; };

  while (i < t.length) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { pushField(); i++; continue; }
    if (c === "\n") { pushField(); pushRow(); i++; continue; }
    if (c === "\r") {
      if (t[i + 1] === "\n") i++;
      pushField(); pushRow(); i++; continue;
    }
    field += c; i++;
  }
  pushField();
  if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) pushRow();

  if (rowsRaw.length === 0) {
    return { headers: [], rows: [], rowLineNumbers: [], error: "File is empty." };
  }

  const headers = rowsRaw[0].map((h) => h.trim());
  const seen = new Set<string>();
  for (const h of headers) {
    if (h === "") {
      return { headers: [], rows: [], rowLineNumbers: [], error: "CSV has an empty header cell — remove extra commas or fix the header row." };
    }
    if (seen.has(h)) {
      return { headers: [], rows: [], rowLineNumbers: [], error: `Duplicate column header: "${h}". Each column must have a unique name.` };
    }
    seen.add(h);
  }

  const data: Record<string, string>[] = [];
  const rowLineNumbers: number[] = [];
  for (let r = 1; r < rowsRaw.length; r++) {
    const lineNumber = r + 1;
    const rr = rowsRaw[r];
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = rr[c] ?? "";
    }
    if (rowIsAllBlank(obj)) continue;
    data.push(obj);
    rowLineNumbers.push(lineNumber);
  }

  if (data.length === 0) {
    return { headers, rows: [], rowLineNumbers: [], error: "No data rows found (header only, or all data rows are blank)." };
  }
  return { headers, rows: data, rowLineNumbers, error: null };
}

// ─── File download ────────────────────────────────────────────────────────────

/** Stable dated filename for CSV exports (one file per resource per calendar day in UTC). */
export function csvExportFilename(resource: string): string {
  const safe = resource.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "export";
  return `${safe}-export-${new Date().toISOString().slice(0, 10)}.csv`;
}

function triggerBrowserDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Operator CSV template + export downloads: UTF-8 BOM (Excel) and CRLF from {@link stringifyCsv}.
 */
export function downloadCsvFile(filename: string, csvBody: string) {
  triggerBrowserDownload(filename, new Blob(["\uFEFF" + csvBody], { type: "text/csv;charset=utf-8" }));
}

// ─── Pagination helper ────────────────────────────────────────────────────────

export async function fetchAllListPages<T>(
  fetchPage: (page: number) => Promise<{ data: T[]; meta: ApiListMeta }>
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const res = await fetchPage(page);
    out.push(...(res.data ?? []));
    lastPage = res.meta?.last_page ?? 1;
    page++;
  } while (page <= lastPage);
  return out;
}

// ─── Import result types + error formatter ────────────────────────────────────

export type ImportRowError = { rowNumber: number; message: string };

export type ImportRunResult = {
  success: number;
  failed: number;
  errors: ImportRowError[];
};

export function formatImportApiError(e: unknown): string {
  if (e instanceof ApiRequestError) {
    const parts = [e.message];
    const errs = e.body?.errors;
    if (errs && typeof errs === "object") {
      for (const [k, msgs] of Object.entries(errs)) {
        if (Array.isArray(msgs) && msgs.length) {
          parts.push(`${k}: ${msgs.join("; ")}`);
        }
      }
    }
    return parts.join(" — ");
  }
  return e instanceof Error ? e.message : "Request failed.";
}
