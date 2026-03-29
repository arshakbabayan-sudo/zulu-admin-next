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

export default function HotelsInventoryPage() {
  const [draftCompany, setDraftCompany] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [city, setCity] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);

  const queryParams = useMemo(
    () => ({
      ...(companyId != null ? { company_id: companyId } : {}),
      ...(city ? { city } : {}),
      ...(status ? { status } : {}),
    }),
    [companyId, city, status]
  );

  function applyFilters() {
    const c = draftCompany.trim();
    if (c === "") setCompanyId(undefined);
    else {
      const n = parseInt(c, 10);
      setCompanyId(Number.isFinite(n) && n > 0 ? n : undefined);
    }
    setCity(draftCity.trim() || undefined);
    setStatus(draftStatus.trim() || undefined);
  }

  function clearFilters() {
    setDraftCompany("");
    setDraftCity("");
    setDraftStatus("");
    setCompanyId(undefined);
    setCity(undefined);
    setStatus(undefined);
  }

  return (
    <InventoryOversightList
      title="Hotels inventory"
      apiHint="GET /api/operator/inventory/hotels — paginated; filters: company_id, city, status, availability_status, is_package_eligible."
      segment="hotels"
      permission="hotels.view"
      queryParams={queryParams}
      columns={[
        { header: "ID", getCell: (r) => cell(r.id) },
        { header: "Company ID", getCell: (r) => cell(r.company_id) },
        { header: "Hotel", getCell: (r) => cell(r.hotel_name) },
        { header: "City", getCell: (r) => cell(r.city) },
        { header: "Country", getCell: (r) => cell(r.country) },
        { header: "Status", getCell: (r) => cell(r.status) },
        { header: "From", getCell: (r) => `${cell(r.starting_price)} ${cell(r.currency)}`.trim() },
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
            />
          </label>
          <label className="text-sm text-zinc-600">
            city
            <input
              value={draftCity}
              onChange={(e) => setDraftCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-zinc-600">
            status
            <input
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </label>
          <button type="button" onClick={applyFilters} className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm">
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
