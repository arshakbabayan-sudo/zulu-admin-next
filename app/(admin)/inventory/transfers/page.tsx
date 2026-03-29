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

export default function TransfersInventoryPage() {
  const [draftCompany, setDraftCompany] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);

  const queryParams = useMemo(
    () => ({
      ...(companyId != null ? { company_id: companyId } : {}),
      ...(status ? { status } : {}),
    }),
    [companyId, status]
  );

  function applyFilters() {
    const c = draftCompany.trim();
    if (c === "") setCompanyId(undefined);
    else {
      const n = parseInt(c, 10);
      setCompanyId(Number.isFinite(n) && n > 0 ? n : undefined);
    }
    setStatus(draftStatus.trim() || undefined);
  }

  function clearFilters() {
    setDraftCompany("");
    setDraftStatus("");
    setCompanyId(undefined);
    setStatus(undefined);
  }

  return (
    <InventoryOversightList
      title="Transfers inventory"
      apiHint="GET /api/operator/inventory/transfers — paginated; filters: company_id, status, transfer_type, vehicle_category, etc."
      segment="transfers"
      permission="transfers.view"
      queryParams={queryParams}
      columns={[
        { header: "ID", getCell: (r) => cell(r.id) },
        { header: "Company ID", getCell: (r) => cell(r.company_id) },
        { header: "Title", getCell: (r) => cell(r.transfer_title) },
        { header: "Pickup", getCell: (r) => cell(r.pickup_city) },
        { header: "Dropoff", getCell: (r) => cell(r.dropoff_city) },
        { header: "Type", getCell: (r) => cell(r.transfer_type) },
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
