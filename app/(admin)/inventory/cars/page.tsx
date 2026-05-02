"use client";

import { InventoryOversightList } from "../_components/InventoryOversightList";
import { useMemo, useState } from "react";

const CAR_OPERATIONAL_STATUSES = ["draft", "published", "archived", "suspended"] as const;
const CAR_AVAILABILITY_STATUSES = ["available", "limited", "booked", "maintenance", "inactive"] as const;

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

function parseOptionalPrice(s: string): number | undefined {
  const t = s.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function parseOptionalCompanyId(s: string): number | undefined {
  const t = s.trim();
  if (t === "") return undefined;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function CarsInventoryPage() {
  const [draftCompany, setDraftCompany] = useState("");
  const [draftCountry, setDraftCountry] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftFleet, setDraftFleet] = useState("");
  const [draftOrigin, setDraftOrigin] = useState("");
  const [draftDestination, setDraftDestination] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftAvailability, setDraftAvailability] = useState("");
  const [draftPriceMin, setDraftPriceMin] = useState("");
  const [draftPriceMax, setDraftPriceMax] = useState("");
  const [advancedPhase, setAdvancedPhase] = useState<1 | 2 | 3>(1);
  const [draftInvoiceId, setDraftInvoiceId] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftRentalDate, setDraftRentalDate] = useState("");
  const [draftRentalFrom, setDraftRentalFrom] = useState("");
  const [draftRentalTo, setDraftRentalTo] = useState("");
  const [draftUserEmail, setDraftUserEmail] = useState("");

  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [country, setCountry] = useState<string | undefined>(undefined);
  const [city, setCity] = useState<string | undefined>(undefined);
  const [fleet, setFleet] = useState<string | undefined>(undefined);
  const [origin, setOrigin] = useState<string | undefined>(undefined);
  const [destination, setDestination] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [availabilityStatus, setAvailabilityStatus] = useState<string | undefined>(undefined);
  const [startingPriceMin, setStartingPriceMin] = useState<number | undefined>(undefined);
  const [startingPriceMax, setStartingPriceMax] = useState<number | undefined>(undefined);
  const [invoiceId, setInvoiceId] = useState<number | undefined>(undefined);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [rentalDate, setRentalDate] = useState<string | undefined>(undefined);
  const [rentalDateFrom, setRentalDateFrom] = useState<string | undefined>(undefined);
  const [rentalDateTo, setRentalDateTo] = useState<string | undefined>(undefined);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  const queryParams = useMemo(
    () => ({
      ...(companyId != null ? { company_id: companyId } : {}),
      ...(country ? { country } : {}),
      ...(city ? { city } : {}),
      ...(fleet ? { fleet } : {}),
      ...(origin ? { origin } : {}),
      ...(destination ? { destination } : {}),
      ...(status ? { status } : {}),
      ...(availabilityStatus ? { availability_status: availabilityStatus } : {}),
      ...(startingPriceMin !== undefined ? { base_price_min: startingPriceMin } : {}),
      ...(startingPriceMax !== undefined ? { base_price_max: startingPriceMax } : {}),
      ...(invoiceId !== undefined ? { invoice_id: invoiceId } : {}),
      ...(date ? { date } : {}),
      ...(rentalDate ? { rental_date: rentalDate } : {}),
      ...(rentalDateFrom ? { rental_date_from: rentalDateFrom } : {}),
      ...(rentalDateTo ? { rental_date_to: rentalDateTo } : {}),
      ...(userEmail ? { user_email: userEmail } : {}),
    }),
    [
      companyId,
      country,
      city,
      fleet,
      origin,
      destination,
      status,
      availabilityStatus,
      startingPriceMin,
      startingPriceMax,
      invoiceId,
      date,
      rentalDate,
      rentalDateFrom,
      rentalDateTo,
      userEmail,
    ]
  );

  function applyFilters() {
    setCompanyId(parseOptionalCompanyId(draftCompany));
    setCountry(draftCountry.trim() || undefined);
    setCity(draftCity.trim() || undefined);
    setFleet(draftFleet.trim() || undefined);
    setOrigin(draftOrigin.trim() || undefined);
    setDestination(draftDestination.trim() || undefined);
    setStatus(draftStatus.trim() || undefined);
    setAvailabilityStatus(draftAvailability.trim() || undefined);
    setStartingPriceMin(parseOptionalPrice(draftPriceMin));
    setStartingPriceMax(parseOptionalPrice(draftPriceMax));
    setInvoiceId(parseOptionalCompanyId(draftInvoiceId));
    setDate(draftDate.trim() || undefined);
    setRentalDate(draftRentalDate.trim() || undefined);
    setRentalDateFrom(draftRentalFrom.trim() || undefined);
    setRentalDateTo(draftRentalTo.trim() || undefined);
    setUserEmail(draftUserEmail.trim() || undefined);
  }

  function clearFilters() {
    setDraftCompany("");
    setDraftCountry("");
    setDraftCity("");
    setDraftFleet("");
    setDraftOrigin("");
    setDraftDestination("");
    setDraftStatus("");
    setDraftAvailability("");
    setDraftPriceMin("");
    setDraftPriceMax("");
    setDraftInvoiceId("");
    setDraftDate("");
    setDraftRentalDate("");
    setDraftRentalFrom("");
    setDraftRentalTo("");
    setDraftUserEmail("");
    setCompanyId(undefined);
    setCountry(undefined);
    setCity(undefined);
    setFleet(undefined);
    setOrigin(undefined);
    setDestination(undefined);
    setStatus(undefined);
    setAvailabilityStatus(undefined);
    setStartingPriceMin(undefined);
    setStartingPriceMax(undefined);
    setInvoiceId(undefined);
    setDate(undefined);
    setRentalDate(undefined);
    setRentalDateFrom(undefined);
    setRentalDateTo(undefined);
    setUserEmail(undefined);
    setAdvancedPhase(1);
  }

  return (
    <InventoryOversightList
      title="Cars inventory"
      segment="cars"
      permission="cars.view"
      queryParams={queryParams}
      columns={[
        { header: "ID", getCell: (r) => cell(r.id) },
        { header: "Company", getCell: (r) => companyIdCell(r) },
        { header: "Pickup", getCell: (r) => cell(r.pickup_location) },
        { header: "Dropoff", getCell: (r) => cell(r.dropoff_location) },
        { header: "Fleet", getCell: (r) => cell(r.fleet) },
        { header: "Class", getCell: (r) => cell(r.vehicle_class) },
        { header: "Base price", getCell: (r) => cell(r.base_price) },
        { header: "Status", getCell: (r) => cell(r.status) },
        { header: "Offer", getCell: (r) => offerTitle(r) },
      ]}
      filterBar={
        <>
          <label className="text-sm text-fg-t6">
            Advanced phase
            <select
              value={advancedPhase}
              onChange={(e) => setAdvancedPhase(Number(e.target.value) as 1 | 2 | 3)}
              className="ml-2 rounded border border-default bg-white px-2 py-1 text-sm"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
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
            country
            <input
              value={draftCountry}
              onChange={(e) => setDraftCountry(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
              placeholder="substring"
            />
          </label>
          <label className="text-sm text-fg-t6">
            city
            <input
              value={draftCity}
              onChange={(e) => setDraftCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
              placeholder="substring"
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
            origin (pickup)
            <input
              value={draftOrigin}
              onChange={(e) => setDraftOrigin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            destination (dropoff)
            <input
              value={draftDestination}
              onChange={(e) => setDraftDestination(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            status
            <select
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value)}
              className="ml-2 rounded border border-default bg-white px-2 py-1 text-sm"
            >
              <option value="">Any</option>
              {CAR_OPERATIONAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-fg-t6">
            availability
            <select
              value={draftAvailability}
              onChange={(e) => setDraftAvailability(e.target.value)}
              className="ml-2 rounded border border-default bg-white px-2 py-1 text-sm"
            >
              <option value="">Any</option>
              {CAR_AVAILABILITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-fg-t6">
            Min price
            <input
              value={draftPriceMin}
              onChange={(e) => setDraftPriceMin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 w-24 rounded border border-default px-2 py-1 text-sm"
              placeholder="from"
            />
          </label>
          <label className="text-sm text-fg-t6">
            Max price
            <input
              value={draftPriceMax}
              onChange={(e) => setDraftPriceMax(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 w-24 rounded border border-default px-2 py-1 text-sm"
              placeholder="to"
            />
          </label>
          {advancedPhase >= 2 ? (
            <>
              <label className="text-sm text-fg-t6">
                Invoice id
                <input
                  value={draftInvoiceId}
                  onChange={(e) => setDraftInvoiceId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 w-28 rounded border border-default px-2 py-1 text-sm"
                  placeholder="id"
                />
              </label>
              <label className="text-sm text-fg-t6">
                Booking date (invoice)
                <input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-fg-t6">
                Rental day (availability)
                <input
                  type="date"
                  value={draftRentalDate}
                  onChange={(e) => setDraftRentalDate(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-fg-t6">
                Rental from
                <input
                  type="date"
                  value={draftRentalFrom}
                  onChange={(e) => setDraftRentalFrom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-fg-t6">
                Rental to
                <input
                  type="date"
                  value={draftRentalTo}
                  onChange={(e) => setDraftRentalTo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                />
              </label>
            </>
          ) : null}
          {advancedPhase >= 3 ? (
            <label className="text-sm text-fg-t6">
              User email
              <input
                value={draftUserEmail}
                onChange={(e) => setDraftUserEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="ml-2 rounded border border-default px-2 py-1 text-sm"
                placeholder="email@domain.com"
              />
            </label>
          ) : null}
          <button type="button" onClick={applyFilters} className="rounded border border-default bg-white px-3 py-1 text-sm">
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
