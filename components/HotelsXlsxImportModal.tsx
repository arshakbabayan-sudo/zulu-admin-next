"use client";

import { importHotelsXlsx, type HotelXlsxImportResult } from "@/lib/hotels-xlsx";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  token: string | null;
  onClose: () => void;
  /** Called after a successful run so the parent can refresh its row list. */
  onSuccess?: () => void;
};

export function HotelsXlsxImportModal({ open, token, onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<HotelXlsxImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setRunning(false);
    setResult(null);
    setErr(null);
  }, [open]);

  if (!open) return null;

  function handleClose() {
    if (running) return;
    setFile(null);
    setRunning(false);
    setResult(null);
    setErr(null);
    onClose();
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    setResult(null);
    setErr(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      setErr("Please choose a .xlsx file.");
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function run() {
    if (!file) return;
    if (!token) {
      setErr("Not signed in.");
      return;
    }
    setRunning(true);
    setErr(null);
    setResult(null);
    try {
      const res = await importHotelsXlsx(token, file);
      setResult(res);
      if (res.success > 0 && onSuccess) onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded border border-slate-200 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Import hotels (xlsx)</h2>
          <button
            type="button"
            className="text-sm text-slate-600 underline disabled:cursor-not-allowed disabled:opacity-40"
            disabled={running}
            onClick={handleClose}
          >
            Close
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-600">
          Upload a 3-sheet xlsx file produced from the Template button. Sheet <span className="font-mono">Hotels</span> defines hotels,{" "}
          <span className="font-mono">Rooms</span> their room categories (linked by Hotel Code), and{" "}
          <span className="font-mono">Pricings</span> the rate periods (linked by Room Code). Each Hotel row is sent as one POST /hotels call with its rooms and pricings nested.
        </p>
        <label className="mb-3 flex cursor-pointer flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">File</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="text-sm disabled:cursor-not-allowed disabled:opacity-40"
            disabled={running}
            onChange={onPick}
          />
          {file && <span className="text-xs text-slate-500">{file.name} ({Math.round(file.size / 1024)} KB)</span>}
        </label>
        {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
        {result && (
          <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="font-medium text-slate-800">
              Done: <span className="text-green-700">{result.success}</span> succeeded,{" "}
              <span className="text-red-700">{result.failed}</span> failed
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-64 list-none overflow-auto text-xs text-red-800">
                {[...result.errors]
                  .sort((a, b) => (a.sheet === b.sheet ? a.rowNumber - b.rowNumber : a.sheet.localeCompare(b.sheet)))
                  .map((e, i) => (
                    <li key={i} className="border-b border-red-100 py-1.5 text-left last:border-b-0">
                      <span className="font-medium">
                        {e.sheet} row {e.rowNumber}:
                      </span>{" "}
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
            disabled={running || !file || !token}
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
