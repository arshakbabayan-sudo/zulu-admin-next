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

function companyIdCell(row: Record<string, unknown>): string {
  if (row.company_id != null && row.company_id !== "") return cell(row.company_id);
  const o = row.offer;
  if (o && typeof o === "object" && o !== null && "company_id" in o) {
    return cell((o as { company_id?: unknown }).company_id);
  }
  return "—";
}

export default function CarsInventoryPage() {
  const [draftCompany, setDraftCompany] = useState("");
  const [draftClass, setDraftClass] = useState("");
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [vehicleClass, setVehicleClass] = useState<string | undefined>(undefined);

  const queryParams = useMemo(
    () => ({
      ...(companyId != null ? { company_id: companyId } : {}),
      ...(vehicleClass ? { vehicle_class: vehicleClass } : {}),
    }),
    [companyId, vehicleClass]
  );

  function applyFilters() {
    const c = draftCompany.trim();
    if (c === "") setCompanyId(undefined);
    else {
      const n = parseInt(c, 10);
      setCompanyId(Number.isFinite(n) && n > 0 ? n : undefined);
    }
    setVehicleClass(draftClass.trim() || undefined);
  }

  function clearFilters() {
    setDraftCompany("");
    setDraftClass("");
    setCompanyId(undefined);
    setVehicleClass(undefined);
  }

  return (
    <InventoryOversightList
      title="Cars inventory"
      apiHint="GET /api/operator/inventory/cars — paginated; filters: company_id, vehicle_class."
      segment="cars"
      permission="cars.view"
      queryParams={queryParams}
      columns={[
        { header: "ID", getCell: (r) => cell(r.id) },
        { header: "Company", getCell: (r) => companyIdCell(r) },
        { header: "Pickup", getCell: (r) => cell(r.pickup_location) },
        { header: "Dropoff", getCell: (r) => cell(r.dropoff_location) },
        { header: "Class", getCell: (r) => cell(r.vehicle_class) },
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
            vehicle_class
            <input
              value={draftClass}
              onChange={(e) => setDraftClass(e.target.value)}
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
