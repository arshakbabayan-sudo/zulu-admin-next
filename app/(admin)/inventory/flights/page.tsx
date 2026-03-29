"use client";

import { InventoryOversightList } from "../_components/InventoryOversightList";
import { useMemo, useState } from "react";

function cell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return "—";
  return String(v);
}

function offerTitle(row: Record<string, unknown>): string {
  const o = row.offer;
  if (o && typeof o === "object" && o !== null && "title" in o) {
    const t = (o as { title?: unknown }).title;
    return t != null && String(t) !== "" ? String(t) : "—";
  }
  return "—";
}

function companyLabel(row: Record<string, unknown>): string {
  const c = row.company;
  if (c && typeof c === "object" && c !== null && "name" in c) {
    const n = (c as { name?: unknown }).name;
    if (n != null && String(n) !== "") return String(n);
  }
  return cell(row.company_id);
}

export default function FlightsInventoryPage() {
  const [draftCompany, setDraftCompany] = useState("");
  const [draftDepCity, setDraftDepCity] = useState("");
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [departureCity, setDepartureCity] = useState<string | undefined>(undefined);

  const queryParams = useMemo(
    () => ({
      ...(companyId != null ? { company_id: companyId } : {}),
      ...(departureCity ? { departure_city: departureCity } : {}),
    }),
    [companyId, departureCity]
  );

  function applyFilters() {
    const c = draftCompany.trim();
    if (c === "") setCompanyId(undefined);
    else {
      const n = parseInt(c, 10);
      setCompanyId(Number.isFinite(n) && n > 0 ? n : undefined);
    }
    const d = draftDepCity.trim();
    setDepartureCity(d || undefined);
  }

  function clearFilters() {
    setDraftCompany("");
    setDraftDepCity("");
    setCompanyId(undefined);
    setDepartureCity(undefined);
  }

  return (
    <InventoryOversightList
      title="Flights inventory"
      apiHint="GET /api/operator/inventory/flights — paginated; filters: company_id, departure_city (among others on the backend whitelist)."
      segment="flights"
      permission="flights.view"
      queryParams={queryParams}
      columns={[
        { header: "ID", getCell: (r) => cell(r.id) },
        { header: "Company", getCell: (r) => companyLabel(r) },
        { header: "Route", getCell: (r) => `${cell(r.departure_city)} (${cell(r.departure_airport_code)}) → ${cell(r.arrival_city)} (${cell(r.arrival_airport_code)})` },
        { header: "Departure", getCell: (r) => cell(r.departure_at) },
        { header: "Status", getCell: (r) => cell(r.status) },
        { header: "Offer", getCell: (r) => offerTitle(r) },
      ]}
      filterBar={
        <>
          <label className="text-sm text-zinc-600">
            company_id
            <input
              value={draftCompany}
              onChange={(e) => setDraftCompany(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-zinc-300 px-2 py-1 text-sm"
              placeholder="Filter by company"
            />
          </label>
          <label className="text-sm text-zinc-600">
            departure_city
            <input
              value={draftDepCity}
              onChange={(e) => setDraftDepCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-zinc-300 px-2 py-1 text-sm"
              placeholder="Filter"
            />
          </label>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm"
          >
            Apply filters
          </button>
          <button type="button" onClick={clearFilters} className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm">
            Clear
          </button>
        </>
      }
    />
  );
}
