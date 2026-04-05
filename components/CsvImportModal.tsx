"use client";

import { parseCsv, type ImportRunResult } from "@/lib/csv-import-export";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  onRun: (rows: Record<string, string>[], rowLineNumbers: number[]) => Promise<ImportRunResult>;
};

export function CsvImportModal(props: Props) {
  const { open, title, onClose, onRun } = props;
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [rowLineNumbers, setRowLineNumbers] = useState<number[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportRunResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setFileName(null);
    setParseErr(null);
    setHeaders([]);
    setPreview([]);
    setAllRows([]);
    setRowLineNumbers([]);
    setResult(null);
    setRunning(false);
  }, [open]);

  function reset() {
    setFileName(null);
    setParseErr(null);
    setHeaders([]);
    setPreview([]);
    setAllRows([]);
    setRowLineNumbers([]);
    setResult(null);
  }

  function handleClose() {
    if (running) return;
    reset();
    onClose();
  }

  if (!open) return null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    reset();
    if (!file) return;
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseErr("Please choose a .csv file.");
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.error) {
        setParseErr(parsed.error);
        return;
      }
      if (parsed.headers.length === 0) {
        setParseErr("CSV has no header row.");
        return;
      }
      setHeaders(parsed.headers);
      setAllRows(parsed.rows);
      setRowLineNumbers(parsed.rowLineNumbers);
      setPreview(parsed.rows.slice(0, 10));
    } catch {
      setParseErr("Could not read the file.");
    }
  }

  async function run() {
    if (allRows.length === 0 || rowLineNumbers.length !== allRows.length) return;
    setRunning(true);
    setResult(null);
    setParseErr(null);
    try {
      const res = await onRun(allRows, rowLineNumbers);
      setResult(res);
    } catch (err) {
      setParseErr(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded border border-slate-200 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            className="text-sm text-slate-600 underline disabled:cursor-not-allowed disabled:opacity-40"
            disabled={running}
            onClick={handleClose}
          >
            Close
          </button>
        </div>
        <p className="mb-2 text-xs text-slate-600">
          CSV only. Each row must include a valid <span className="font-mono">offer_id</span>. Rows with an{" "}
          <span className="font-mono">id</span> column update existing records; rows without <span className="font-mono">id</span>{" "}
          create new ones.
        </p>
        <label className="mb-3 flex cursor-pointer flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">File</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="text-sm disabled:cursor-not-allowed disabled:opacity-40"
            disabled={running}
            onChange={onFile}
          />
          {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
        </label>
        {parseErr && <p className="mb-2 text-sm text-red-600">{parseErr}</p>}
        {headers.length > 0 && (
          <div className="mb-3 overflow-x-auto rounded border border-slate-200">
            <p className="border-b border-slate-100 bg-slate-50 px-2 py-1 text-xs text-slate-600">
              Preview (first {preview.length} of {allRows.length} rows)
            </p>
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100">
                <tr>
                  {headers.map((h, hi) => (
                    <th key={`h-${hi}`} className="px-2 py-1 font-medium text-slate-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {headers.map((h, hi) => (
                      <td key={`c-${i}-${hi}`} className="max-w-[200px] truncate px-2 py-1 text-slate-800" title={row[h] ?? ""}>
                        {row[h] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && (
          <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="font-medium text-slate-800">
              Done: <span className="text-green-700">{result.success}</span> succeeded,{" "}
              <span className="text-red-700">{result.failed}</span> failed
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-48 list-none overflow-auto text-xs text-red-800">
                {[...result.errors].sort((a, b) => a.rowNumber - b.rowNumber).map((e, i) => (
                  <li key={i} className="border-b border-red-100 py-1.5 text-left last:border-b-0">
                    <span className="font-medium">Row {e.rowNumber}:</span>{" "}
                    <span className="break-words whitespace-pre-wrap">{e.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={running || allRows.length === 0 || rowLineNumbers.length !== allRows.length}
            className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
            onClick={() => void run()}
          >
            {running ? "Importing…" : "Run import"}
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            disabled={running}
            onClick={handleClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
