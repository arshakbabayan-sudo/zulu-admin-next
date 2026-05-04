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
  const [draftCountry, setDraftCountry] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftFleet, setDraftFleet] = useState("");
  const [draftOrigin, setDraftOrigin] = useState("");
  const [draftDestination, setDraftDestination] = useState("");
  const [draftVehicleCategory, setDraftVehicleCategory] = useState("");
  const [draftTripDate, setDraftTripDate] = useState("");
  const [draftPassengers, setDraftPassengers] = useState("");
  const [draftUserEmail, setDraftUserEmail] = useState("");
  const [draftOrderNumber, setDraftOrderNumber] = useState("");
  const [draftInvoiceId, setDraftInvoiceId] = useState("");
  const [draftPriceMin, setDraftPriceMin] = useState("");
  const [draftPriceMax, setDraftPriceMax] = useState("");

  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [country, setCountry] = useState<string | undefined>(undefined);
  const [city, setCity] = useState<string | undefined>(undefined);
  const [fleet, setFleet] = useState<string | undefined>(undefined);
  const [origin, setOrigin] = useState<string | undefined>(undefined);
  const [destination, setDestination] = useState<string | undefined>(undefined);
  const [vehicleCategory, setVehicleCategory] = useState<string | undefined>(undefined);
  const [tripDate, setTripDate] = useState<string | undefined>(undefined);
  const [passengers, setPassengers] = useState<number | undefined>(undefined);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [orderNumber, setOrderNumber] = useState<string | undefined>(undefined);
  const [invoiceId, setInvoiceId] = useState<number | undefined>(undefined);
  const [priceMin, setPriceMin] = useState<number | undefined>(undefined);
  const [priceMax, setPriceMax] = useState<number | undefined>(undefined);

  const queryParams = useMemo(
    () => ({
      ...(companyId != null ? { company_id: companyId } : {}),
      ...(status ? { status } : {}),
      ...(country ? { country } : {}),
      ...(city ? { city } : {}),
      ...(fleet ? { fleet } : {}),
      ...(origin ? { origin } : {}),
      ...(destination ? { destination } : {}),
      ...(vehicleCategory ? { vehicle_category: vehicleCategory } : {}),
      ...(tripDate ? { trip_date: tripDate } : {}),
      ...(passengers != null ? { passengers } : {}),
      ...(userEmail ? { user_email: userEmail } : {}),
      ...(orderNumber ? { order_number: orderNumber } : {}),
      ...(invoiceId != null ? { invoice_id: invoiceId } : {}),
      ...(priceMin != null ? { price_min: priceMin } : {}),
      ...(priceMax != null ? { price_max: priceMax } : {}),
    }),
    [
      companyId,
      status,
      country,
      city,
      fleet,
      origin,
      destination,
      vehicleCategory,
      tripDate,
      passengers,
      userEmail,
      orderNumber,
      invoiceId,
      priceMin,
      priceMax,
    ]
  );

  function applyFilters() {
    const c = draftCompany.trim();
    if (c === "") setCompanyId(undefined);
    else {
      const n = parseInt(c, 10);
      setCompanyId(Number.isFinite(n) && n > 0 ? n : undefined);
    }
    setStatus(draftStatus.trim() || undefined);

    setCountry(draftCountry.trim() || undefined);
    setCity(draftCity.trim() || undefined);
    setFleet(draftFleet.trim() || undefined);
    setOrigin(draftOrigin.trim() || undefined);
    setDestination(draftDestination.trim() || undefined);
    setVehicleCategory(draftVehicleCategory.trim() || undefined);
    setTripDate(draftTripDate.trim() || undefined);
    const p = parseInt(draftPassengers.trim(), 10);
    setPassengers(Number.isFinite(p) && p > 0 ? p : undefined);
    setUserEmail(draftUserEmail.trim() || undefined);
    setOrderNumber(draftOrderNumber.trim() || undefined);
    const inv = parseInt(draftInvoiceId.trim(), 10);
    setInvoiceId(Number.isFinite(inv) && inv > 0 ? inv : undefined);
    const min = Number(draftPriceMin.trim());
    setPriceMin(Number.isFinite(min) && min >= 0 ? min : undefined);
    const max = Number(draftPriceMax.trim());
    setPriceMax(Number.isFinite(max) && max >= 0 ? max : undefined);
  }

  function clearFilters() {
    setDraftCompany("");
    setDraftStatus("");
    setDraftCountry("");
    setDraftCity("");
    setDraftFleet("");
    setDraftOrigin("");
    setDraftDestination("");
    setDraftVehicleCategory("");
    setDraftTripDate("");
    setDraftPassengers("");
    setDraftUserEmail("");
    setDraftOrderNumber("");
    setDraftInvoiceId("");
    setDraftPriceMin("");
    setDraftPriceMax("");
    setCompanyId(undefined);
    setStatus(undefined);
    setCountry(undefined);
    setCity(undefined);
    setFleet(undefined);
    setOrigin(undefined);
    setDestination(undefined);
    setVehicleCategory(undefined);
    setTripDate(undefined);
    setPassengers(undefined);
    setUserEmail(undefined);
    setOrderNumber(undefined);
    setInvoiceId(undefined);
    setPriceMin(undefined);
    setPriceMax(undefined);
  }

  return (
    <InventoryOversightList
      title="Transfers inventory"
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
          <label className="text-sm text-fg-t6">
            company_id
            <input
              value={draftCompany}
              onChange={(e) => setDraftCompany(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            status
            <input
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            country
            <input
              value={draftCountry}
              onChange={(e) => setDraftCountry(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            city
            <input
              value={draftCity}
              onChange={(e) => setDraftCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            fleet
            <input
              value={draftFleet}
              onChange={(e) => setDraftFleet(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            origin
            <input
              value={draftOrigin}
              onChange={(e) => setDraftOrigin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            destination
            <input
              value={draftDestination}
              onChange={(e) => setDraftDestination(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            vehicle_category
            <input
              value={draftVehicleCategory}
              onChange={(e) => setDraftVehicleCategory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            trip_date
            <input
              value={draftTripDate}
              onChange={(e) => setDraftTripDate(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="YYYY-MM-DD"
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            passenger
            <input
              value={draftPassengers}
              onChange={(e) => setDraftPassengers(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 w-[96px] rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            user_email
            <input
              value={draftUserEmail}
              onChange={(e) => setDraftUserEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            order_number
            <input
              value={draftOrderNumber}
              onChange={(e) => setDraftOrderNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            invoice_id
            <input
              value={draftInvoiceId}
              onChange={(e) => setDraftInvoiceId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 w-[96px] rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            price_min
            <input
              value={draftPriceMin}
              onChange={(e) => setDraftPriceMin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 w-[96px] rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            price_max
            <input
              value={draftPriceMax}
              onChange={(e) => setDraftPriceMax(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 w-[96px] rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <button type="button" onClick={applyFilters} className="rounded-zulu bg-primary-500 px-3 py-1 text-sm font-medium text-white hover:bg-purple-dark">
            Apply filters
          </button>
          <button type="button" onClick={clearFilters} className="rounded border border-default bg-white px-3 py-1 text-sm">
            Clear
          </button>
        </>
      }
    />
  );
}
