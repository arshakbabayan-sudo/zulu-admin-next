"use client";

import { useLanguage } from "@/contexts/LanguageContext";
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
  const { t } = useLanguage();
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
      title={t("admin.inventory_excursions.title")}
      segment="excursions"
      permission="excursions.view"
      queryParams={queryParams}
      columns={[
        { header: t("admin.inventory_cars.col_id"), getCell: (r) => cell(r.id) },
        { header: t("admin.inventory_cars.col_company"), getCell: (r) => companyIdCell(r) },
        { header: t("admin.inventory_hotels.col_country"), getCell: (r) => cell(r.country) },
        { header: t("admin.inventory_hotels.col_city"), getCell: (r) => cell(r.city) },
        { header: t("admin.inventory_excursions.col_category"), getCell: (r) => cell(r.category) },
        { header: t("admin.inventory_excursions.col_location"), getCell: (r) => cell(r.location) },
        { header: t("admin.inventory_excursions.col_duration"), getCell: (r) => cell(r.duration) },
        { header: t("admin.inventory_excursions.col_group_size"), getCell: (r) => cell(r.group_size) },
        { header: t("admin.inventory_excursions.col_price"), getCell: (r) => offerPriceCell(r) },
        { header: t("admin.inventory_cars.col_status"), getCell: (r) => cell(r.status) },
        { header: t("admin.inventory_cars.col_offer"), getCell: (r) => offerTitle(r) },
      ]}
      filterBar={
        <>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory_hotels.filter_advanced_phase")}
            <select
              value={advancedPhase}
              onChange={(e) => setAdvancedPhase(Number(e.target.value) as 1 | 2 | 3 | 4)}
              className="ml-2 rounded border border-default bg-white px-2 py-1 text-sm"
            >
              <option value={1}>{t("admin.inventory_excursions.phase_1")}</option>
              <option value={2}>{t("admin.inventory_excursions.phase_2")}</option>
              <option value={3}>{t("admin.inventory_excursions.phase_3")}</option>
              <option value={4}>{t("admin.inventory_excursions.phase_4")}</option>
            </select>
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory_hotels.filter_company_id")}
            <input
              value={draftCompany}
              onChange={(e) => setDraftCompany(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory_excursions.col_location")}
            <input
              value={draftLocation}
              onChange={(e) => setDraftLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          {advancedPhase >= 1 ? (
            <>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_hotels.filter_country")}
                <input
                  value={draftCountry}
                  onChange={(e) => setDraftCountry(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                  placeholder={t("admin.inventory_cars.placeholder_substring")}
                />
              </label>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_hotels.filter_city")}
                <input
                  value={draftCity}
                  onChange={(e) => setDraftCity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                  placeholder={t("admin.inventory_cars.placeholder_substring")}
                />
              </label>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_excursions.col_category")}
                <input
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                  placeholder={t("admin.inventory_cars.placeholder_substring")}
                />
              </label>
            </>
          ) : null}
          {advancedPhase >= 2 ? (
            <>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_excursions.filter_date_overlap")}
                <input
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                  placeholder={t("admin.inventory_excursions.placeholder_date")}
                />
              </label>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_excursions.filter_date_from")}
                <input
                  type="date"
                  value={draftDateFrom}
                  onChange={(e) => setDraftDateFrom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_excursions.filter_date_to")}
                <input
                  type="date"
                  value={draftDateTo}
                  onChange={(e) => setDraftDateTo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_cars.filter_status")}
                <input
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                  placeholder={t("admin.inventory_cars.placeholder_substring")}
                />
              </label>
            </>
          ) : null}
          {advancedPhase >= 3 ? (
            <>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_excursions.filter_order_number")}
                <input
                  value={draftOrderNumber}
                  onChange={(e) => setDraftOrderNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                  placeholder={t("admin.inventory_excursions.placeholder_invoice_ref")}
                />
              </label>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_hotels.filter_invoice_id")}
                <input
                  value={draftInvoiceId}
                  onChange={(e) => setDraftInvoiceId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 w-28 rounded border border-default px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_hotels.filter_user_email")}
                <input
                  value={draftUserEmail}
                  onChange={(e) => setDraftUserEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                />
              </label>
            </>
          ) : null}
          {advancedPhase >= 4 ? (
            <>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_excursions.filter_min_price")}
                <input
                  value={draftPriceMin}
                  onChange={(e) => setDraftPriceMin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 w-24 rounded border border-default px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_excursions.filter_max_price")}
                <input
                  value={draftPriceMax}
                  onChange={(e) => setDraftPriceMax(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 w-24 rounded border border-default px-2 py-1 text-sm"
                />
              </label>
            </>
          ) : null}
          <button type="button" onClick={applyFilters} className="rounded-zulu bg-primary-500 px-3 py-1 text-sm font-medium text-white hover:bg-purple-dark">
            {t("admin.inventory_hotels.btn_apply")}
          </button>
          <button type="button" onClick={clearFilters} className="rounded border border-default bg-white px-3 py-1 text-sm">
            {t("admin.inventory_hotels.btn_clear")}
          </button>
        </>
      }
    />
  );
}
