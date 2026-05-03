"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type {
  FlightCabinSeatMapPayload,
  FlightCabinSeatMapRow,
  FlightCabinSeatModifierType,
  FlightCabinSeatRow,
  FlightCabinSeatStatus,
} from "@/lib/inventory-crud-api";

const SEAT_TYPE_OPTIONS = ["standard", "extra_legroom", "premium", "exit_row", "blocked"] as const;
const STATUS_OPTIONS: FlightCabinSeatStatus[] = ["available", "blocked"];
const MODIFIER_OPTIONS: FlightCabinSeatModifierType[] = ["none", "fixed", "percent"];

type EditorSeat = Pick<
  FlightCabinSeatRow,
  | "seat_code"
  | "row_number"
  | "column_code"
  | "zone_code"
  | "seat_type"
  | "status"
  | "price_modifier_type"
  | "price_modifier_value"
  | "currency"
  | "meta"
>;

type SeatMapEditorProps = {
  seatMap: FlightCabinSeatMapRow | null;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  defaultCurrency?: string;
  onSave: (payload: FlightCabinSeatMapPayload) => Promise<void>;
};

function sortColumns(cols: string[]): string[] {
  return [...cols].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function parseColumnsInput(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .toUpperCase()
        .split(/[,\s]+/)
        .map((item) => item.trim())
        .filter((item) => /^[A-Z]{1,3}$/.test(item))
    )
  );
}

function normalizeSeat(input: FlightCabinSeatRow, currency: string): EditorSeat {
  return {
    seat_code: String(input.seat_code ?? "").toUpperCase(),
    row_number: Number(input.row_number ?? 0),
    column_code: String(input.column_code ?? "").toUpperCase(),
    zone_code: input.zone_code ?? null,
    seat_type: input.seat_type ?? "standard",
    status: input.status ?? "available",
    price_modifier_type: input.price_modifier_type ?? "none",
    price_modifier_value: Number(input.price_modifier_value ?? 0),
    currency: input.currency ?? currency,
    meta: input.meta ?? null,
  };
}

function normalizeGeneratedSeat(
  row: number,
  column: string,
  defaultCurrency: string
): EditorSeat {
  return {
    seat_code: `${row}${column}`,
    row_number: row,
    column_code: column,
    zone_code: null,
    seat_type: "standard",
    status: "available",
    price_modifier_type: "none",
    price_modifier_value: 0,
    currency: defaultCurrency,
    meta: null,
  };
}

export function SeatMapEditor({
  seatMap,
  loading = false,
  saving = false,
  error,
  defaultCurrency = "USD",
  onSave,
}: SeatMapEditorProps) {
  const [seats, setSeats] = useState<EditorSeat[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [rowsInput, setRowsInput] = useState<string>("12");
  const [columnsInput, setColumnsInput] = useState<string>("A B C D E F");
  const [versionInput, setVersionInput] = useState<string>("1");
  const [editorErr, setEditorErr] = useState<string | null>(null);

  useEffect(() => {
    if (!seatMap) {
      setSeats([]);
      setSelectedCode(null);
      setVersionInput("1");
      setEditorErr(null);
      return;
    }
    const normalized = (seatMap.seats ?? [])
      .map((seat) => normalizeSeat(seat, defaultCurrency))
      .sort((a, b) => a.row_number - b.row_number || a.column_code.localeCompare(b.column_code));

    const seatRows = Array.from(new Set(normalized.map((seat) => seat.row_number))).sort((a, b) => a - b);
    const seatCols = sortColumns(Array.from(new Set(normalized.map((seat) => seat.column_code))));

    setSeats(normalized);
    setSelectedCode(normalized[0]?.seat_code ?? null);
    if (seatRows.length > 0) setRowsInput(String(seatRows[seatRows.length - 1]));
    if (seatCols.length > 0) setColumnsInput(seatCols.join(" "));
    setVersionInput(String(Math.max(1, Number(seatMap.version ?? 1) + 1)));
    setEditorErr(null);
  }, [defaultCurrency, seatMap]);

  const seatMapByCode = useMemo(() => {
    const map = new Map<string, EditorSeat>();
    for (const seat of seats) map.set(seat.seat_code, seat);
    return map;
  }, [seats]);

  const gridRows = useMemo(
    () => Array.from(new Set(seats.map((seat) => seat.row_number))).sort((a, b) => a - b),
    [seats]
  );
  const gridColumns = useMemo(
    () => sortColumns(Array.from(new Set(seats.map((seat) => seat.column_code)))),
    [seats]
  );

  const selectedSeat = selectedCode ? seatMapByCode.get(selectedCode) ?? null : null;

  function generateGrid() {
    const rowCount = Math.max(1, Math.min(300, Number(rowsInput) || 0));
    const columns = parseColumnsInput(columnsInput);
    if (!rowCount || columns.length === 0) {
      setEditorErr("Enter a valid row count and at least one column code.");
      return;
    }
    const generated: EditorSeat[] = [];
    for (let row = 1; row <= rowCount; row += 1) {
      for (const col of columns) {
        generated.push(normalizeGeneratedSeat(row, col, defaultCurrency));
      }
    }
    setSeats(generated);
    setSelectedCode(generated[0]?.seat_code ?? null);
    setEditorErr(null);
  }

  function updateSeat(seatCode: string, patch: Partial<EditorSeat>) {
    setSeats((prev) => prev.map((seat) => (seat.seat_code === seatCode ? { ...seat, ...patch } : seat)));
  }

  function toggleSeatStatus(seatCode: string) {
    const seat = seatMapByCode.get(seatCode);
    if (!seat) return;
    const nextStatus: FlightCabinSeatStatus = seat.status === "blocked" ? "available" : "blocked";
    updateSeat(seatCode, { status: nextStatus });
  }

  async function handleSave() {
    if (seats.length === 0) {
      setEditorErr("Generate or load a seat map before saving.");
      return;
    }
    const version = Math.max(1, Number(versionInput) || 1);
    const payload: FlightCabinSeatMapPayload = {
      version,
      is_active: true,
      layout_schema: {
        grid: {
          rows: gridRows,
          columns: gridColumns,
          row_count: gridRows.length,
          column_count: gridColumns.length,
        },
        generated_by: "zulu-admin-next",
      },
      legend_schema: {
        statuses: STATUS_OPTIONS,
        modifier_types: MODIFIER_OPTIONS,
      },
      seats: seats.map((seat) => ({
        seat_code: seat.seat_code,
        row_number: seat.row_number,
        column_code: seat.column_code,
        zone_code: seat.zone_code ?? null,
        seat_type: seat.seat_type,
        status: seat.status,
        price_modifier_type: seat.price_modifier_type,
        price_modifier_value:
          seat.price_modifier_type === "none" ? 0 : Number.isFinite(seat.price_modifier_value) ? seat.price_modifier_value : 0,
        currency: seat.currency ?? defaultCurrency,
        meta: seat.meta ?? null,
      })),
    };

    setEditorErr(null);
    await onSave(payload);
    setVersionInput(String(version + 1));
  }

  const renderErr = editorErr ?? error ?? null;

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Seat map editor</h3>
          <p className="text-xs text-slate-500">Click a seat to edit modifiers, click again to toggle Available/Blocked.</p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading}
          className="rounded bg-slate-800 px-3 py-1.5 text-xs text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save seat map"}
        </button>
      </div>

      <div className="mb-4 grid gap-2 rounded border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-slate-600">Rows</span>
          <input
            type="number"
            min={1}
            max={300}
            value={rowsInput}
            onChange={(e) => setRowsInput(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs md:col-span-2">
          <span className="font-medium text-slate-600">Columns (space or comma separated)</span>
          <input
            type="text"
            value={columnsInput}
            onChange={(e) => setColumnsInput(e.target.value)}
            placeholder="A B C D E F"
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={generateGrid}
            disabled={saving || loading}
            className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs hover:bg-slate-100 disabled:opacity-50"
          >
            Generate grid
          </button>
        </div>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-slate-600">Version</span>
          <input
            type="number"
            min={1}
            value={versionInput}
            onChange={(e) => setVersionInput(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {renderErr && <p className="mb-3 text-sm text-red-600">{renderErr}</p>}

      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-auto rounded border border-slate-200 p-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading seat map...</p>
          ) : seats.length === 0 ? (
            <p className="text-sm text-slate-500">No seats yet. Generate a grid to start.</p>
          ) : (
            <div className="inline-grid gap-2" style={{ gridTemplateColumns: `auto repeat(${gridColumns.length}, minmax(36px, 1fr))` }}>
              <div />
              {gridColumns.map((col) => (
                <div key={`head-${col}`} className="text-center text-xs font-semibold text-slate-500">
                  {col}
                </div>
              ))}
              {gridRows.map((row) => (
                <Fragment key={`row-${row}`}>
                  <div key={`row-${row}`} className="flex items-center justify-center text-xs font-semibold text-slate-500">
                    {row}
                  </div>
                  {gridColumns.map((col) => {
                    const code = `${row}${col}`;
                    const seat = seatMapByCode.get(code);
                    if (!seat) {
                      return <div key={`${code}-empty`} className="h-9 w-9 rounded border border-dashed border-slate-200" />;
                    }
                    const isSelected = selectedCode === code;
                    const statusClass =
                      seat.status === "blocked"
                        ? "border-slate-500 bg-slate-300 text-slate-800"
                        : "border-emerald-500 bg-emerald-100 text-emerald-800";
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          if (selectedCode === code) toggleSeatStatus(code);
                          else setSelectedCode(code);
                        }}
                        className={`h-9 w-9 rounded border text-[11px] font-semibold ${statusClass} ${isSelected ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
                        title={`${code} (${seat.status})`}
                      >
                        {col}
                      </button>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="rounded border border-slate-200 p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Seat details</h4>
          {!selectedSeat ? (
            <p className="text-sm text-slate-500">Select a seat in the grid.</p>
          ) : (
            <div className="space-y-2">
              <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-semibold text-slate-700">
                {selectedSeat.seat_code}
              </div>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-slate-600">Status</span>
                <select
                  value={selectedSeat.status}
                  onChange={(e) =>
                    updateSeat(selectedSeat.seat_code, {
                      status: e.target.value as FlightCabinSeatStatus,
                    })
                  }
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-slate-600">Seat type</span>
                <select
                  value={selectedSeat.seat_type}
                  onChange={(e) => updateSeat(selectedSeat.seat_code, { seat_type: e.target.value })}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {SEAT_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-slate-600">Price modifier type</span>
                <select
                  value={selectedSeat.price_modifier_type}
                  onChange={(e) =>
                    updateSeat(selectedSeat.seat_code, {
                      price_modifier_type: e.target.value as FlightCabinSeatModifierType,
                      price_modifier_value: e.target.value === "none" ? 0 : selectedSeat.price_modifier_value,
                    })
                  }
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {MODIFIER_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-slate-600">Price modifier value</span>
                <input
                  type="number"
                  step="0.01"
                  value={selectedSeat.price_modifier_value}
                  disabled={selectedSeat.price_modifier_type === "none"}
                  onChange={(e) =>
                    updateSeat(selectedSeat.seat_code, {
                      price_modifier_value: Number(e.target.value || 0),
                    })
                  }
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
