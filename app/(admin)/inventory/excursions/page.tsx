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

function offerPriceCell(row: Record<string, unknown>): string {
  const o = row.offer;
  if (o && typeof o === "object" && o !== null && "price" in o) {
    const p = (o as { price?: unknown }).price;
    if (p != null && p !== "") return cell(p);
  }
  if (row.price != null && row.price !== "") return cell(row.price);
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

export default function ExcursionsInventoryPage() {
  const [draftCompany, setDraftCompany] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftCountry, setDraftCountry] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftOrderNumber, setDraftOrderNumber] = useState("");
  const [draftInvoiceId, setDraftInvoiceId] = useState("");
  const [draftUserEmail, setDraftUserEmail] = useState("");
  const [draftPriceMin, setDraftPriceMin] = useState("");
  const [draftPriceMax, setDraftPriceMax] = useState("");

  const [advancedPhase, setAdvancedPhase] = useState<1 | 2 | 3 | 4>(1);

  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [location, setLocation] = useState<string | undefined>(undefined);
  const [country, setCountry] = useState<string | undefined>(undefined);
  const [city, setCity] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [orderNumber, setOrderNumber] = useState<string | undefined>(undefined);
  const [invoiceId, setInvoiceId] = useState<number | undefined>(undefined);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [priceMin, setPriceMin] = useState<number | undefined>(undefined);
  const [priceMax, setPriceMax] = useState<number | undefined>(undefined);

  const queryParams = useMemo(
    () => ({
      ...(companyId != null ? { company_id: companyId } : {}),
      ...(location ? { location } : {}),
      ...(country ? { country } : {}),
      ...(city ? { city } : {}),
      ...(category ? { category } : {}),
      ...(date ? { date } : {}),
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
      ...(status ? { status } : {}),
      ...(orderNumber ? { order_number: orderNumber } : {}),
      ...(invoiceId !== undefined ? { invoice_id: invoiceId } : {}),
      ...(userEmail ? { user_email: userEmail } : {}),
      ...(priceMin !== undefined ? { price_min: priceMin } : {}),
      ...(priceMax !== undefined ? { price_max: priceMax } : {}),
    }),
    [
      companyId,
      location,
      country,
      city,
      category,
      date,
      dateFrom,
      dateTo,
      status,
      orderNumber,
      invoiceId,
      userEmail,
      priceMin,
      priceMax,
    ]
  );

  function applyFilters() {
    setCompanyId(parseOptionalCompanyId(draftCompany));
    setLocation(draftLocation.trim() || undefined);
    setCountry(draftCountry.trim() || undefined);
    setCity(draftCity.trim() || undefined);
    setCategory(draftCategory.trim() || undefined);
    setDate(draftDate.trim() || undefined);
    setDateFrom(draftDateFrom.trim() || undefined);
    setDateTo(draftDateTo.trim() || undefined);
    setStatus(draftStatus.trim() || undefined);
    setOrderNumber(draftOrderNumber.trim() || undefined);
    setInvoiceId(parseOptionalCompanyId(draftInvoiceId));
    setUserEmail(draftUserEmail.trim() || undefined);
    setPriceMin(parseOptionalPrice(draftPriceMin));
    setPriceMax(parseOptionalPrice(draftPriceMax));
  }

  function clearFilters() {
    setDraftCompany("");
    setDraftLocation("");
    setDraftCountry("");
    setDraftCity("");
    setDraftCategory("");
    setDraftDate("");
    setDraftDateFrom("");
    setDraftDateTo("");
    setDraftStatus("");
    setDraftOrderNumber("");
    setDraftInvoiceId("");
    setDraftUserEmail("");
    setDraftPriceMin("");
    setDraftPriceMax("");
    setAdvancedPhase(1);
    setCompanyId(undefined);
    setLocation(undefined);
    setCountry(undefined);
    setCity(undefined);
    setCategory(undefined);
    setDate(undefined);
    setDateFrom(undefined);
    setDateTo(undefined);
    setStatus(undefined);
    setOrderNumber(undefined);
    setInvoiceId(undefined);
    setUserEmail(undefined);
    setPriceMin(undefined);
    setPriceMax(undefined);
  }

  return (
    <InventoryOversightList
      title="Excursions inventory"
      segment="excursions"
      permission="excursions.view"
      queryParams={queryParams}
      columns={[
        { header: "ID", getCell: (r) => cell(r.id) },
        { header: "Company", getCell: (r) => companyIdCell(r) },
        { header: "Country", getCell: (r) => cell(r.country) },
        { header: "City", getCell: (r) => cell(r.city) },
        { header: "Category", getCell: (r) => cell(r.category) },
        { header: "Location", getCell: (r) => cell(r.location) },
        { header: "Duration", getCell: (r) => cell(r.duration) },
        { header: "Group size", getCell: (r) => cell(r.group_size) },
        { header: "Price", getCell: (r) => offerPriceCell(r) },
        { header: "Status", getCell: (r) => cell(r.status) },
        { header: "Offer", getCell: (r) => offerTitle(r) },
      ]}
      filterBar={
        <>
          <label className="text-sm text-slate-600">
            Advanced phase
            <select
              value={advancedPhase}
              onChange={(e) => setAdvancedPhase(Number(e.target.value) as 1 | 2 | 3 | 4)}
              className="ml-2 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value={1}>1 — location & geography</option>
              <option value={2}>2 — schedule & status</option>
              <option value={3}>3 — orders & invoices</option>
              <option value={4}>4 — price</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            company_id
            <input
              value={draftCompany}
              onChange={(e) => setDraftCompany(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-slate-600">
            location
            <input
              value={draftLocation}
              onChange={(e) => setDraftLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          {advancedPhase >= 1 ? (
            <>
              <label className="text-sm text-slate-600">
                country
                <input
                  value={draftCountry}
                  onChange={(e) => setDraftCountry(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder="substring"
                />
              </label>
              <label className="text-sm text-slate-600">
                city
                <input
                  value={draftCity}
                  onChange={(e) => setDraftCity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder="substring"
                />
              </label>
              <label className="text-sm text-slate-600">
                category
                <input
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder="substring"
                />
              </label>
            </>
          ) : null}
          {advancedPhase >= 2 ? (
            <>
              <label className="text-sm text-slate-600">
                date (overlap)
                <input
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder="YYYY-MM-DD or ISO"
                />
              </label>
              <label className="text-sm text-slate-600">
                date_from
                <input
                  type="date"
                  value={draftDateFrom}
                  onChange={(e) => setDraftDateFrom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-slate-600">
                date_to
                <input
                  type="date"
                  value={draftDateTo}
                  onChange={(e) => setDraftDateTo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-slate-600">
                status
                <input
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder="substring"
                />
              </label>
            </>
          ) : null}
          {advancedPhase >= 3 ? (
            <>
              <label className="text-sm text-slate-600">
                order_number
                <input
                  value={draftOrderNumber}
                  onChange={(e) => setDraftOrderNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder="invoice ref"
                />
              </label>
              <label className="text-sm text-slate-600">
                invoice_id
                <input
                  value={draftInvoiceId}
                  onChange={(e) => setDraftInvoiceId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-slate-600">
                user_email
                <input
                  value={draftUserEmail}
                  onChange={(e) => setDraftUserEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
            </>
          ) : null}
          {advancedPhase >= 4 ? (
            <>
              <label className="text-sm text-slate-600">
                Min price (offer)
                <input
                  value={draftPriceMin}
                  onChange={(e) => setDraftPriceMin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-slate-600">
                Max price (offer)
                <input
                  value={draftPriceMax}
                  onChange={(e) => setDraftPriceMax(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
            </>
          ) : null}
          <button type="button" onClick={applyFilters} className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">
            Apply filters
          </button>
          <button type="button" onClick={clearFilters} className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">
            Clear
          </button>
        </>
      }
    />
  );
}
