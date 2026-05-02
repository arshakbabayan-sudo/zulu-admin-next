"use client";

import { InventoryOversightList } from "../_components/InventoryOversightList";
import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  backendFlightStatusLabel,
  flightUiStatusLabel,
  toBackendFlightStatus,
  type FlightUiStatusFilter,
} from "@/lib/flight-status";

type FlightFilterDraft = {
  company: string;
  departureCity: string;
  arrivalCity: string;
  departureAirportCode: string;
  arrivalAirportCode: string;
  departureDateFrom: string;
  departureDateTo: string;
  status: FlightUiStatusFilter;
  cabinClass: string;
  minPrice: string;
  maxPrice: string;
};

type FlightFilterApplied = {
  companyId?: number;
  departureCity?: string;
  arrivalCity?: string;
  departureAirportCode?: string;
  arrivalAirportCode?: string;
  departureDateFrom?: string;
  departureDateTo?: string;
  status: FlightUiStatusFilter;
  cabinClass?: string;
  minPrice?: number;
  maxPrice?: number;
};

const DEFAULT_DRAFT: FlightFilterDraft = {
  company: "",
  departureCity: "",
  arrivalCity: "",
  departureAirportCode: "",
  arrivalAirportCode: "",
  departureDateFrom: "",
  departureDateTo: "",
  status: "all",
  cabinClass: "",
  minPrice: "",
  maxPrice: "",
};

const DEFAULT_APPLIED: FlightFilterApplied = {
  companyId: undefined,
  departureCity: undefined,
  arrivalCity: undefined,
  departureAirportCode: undefined,
  arrivalAirportCode: undefined,
  departureDateFrom: undefined,
  departureDateTo: undefined,
  status: "all",
  cabinClass: undefined,
  minPrice: undefined,
  maxPrice: undefined,
};

function cleanText(v: string): string | undefined {
  const t = v.trim();
  return t === "" ? undefined : t;
}

function cleanCode(v: string): string | undefined {
  const t = v.trim().toUpperCase();
  return t === "" ? undefined : t;
}

function cleanPositiveInt(v: string): number | undefined {
  const t = v.trim();
  if (t === "") return undefined;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function cleanPrice(v: string): number | undefined {
  const t = v.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

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
  const { t } = useLanguage();
  const [draft, setDraft] = useState<FlightFilterDraft>(DEFAULT_DRAFT);
  const [applied, setApplied] = useState<FlightFilterApplied>(DEFAULT_APPLIED);

  const queryParams = useMemo(
    () => ({
      ...(applied.companyId != null ? { company_id: applied.companyId } : {}),
      ...(applied.departureCity ? { departure_city: applied.departureCity } : {}),
      ...(applied.arrivalCity ? { arrival_city: applied.arrivalCity } : {}),
      ...(applied.departureAirportCode ? { departure_airport_code: applied.departureAirportCode } : {}),
      ...(applied.arrivalAirportCode ? { arrival_airport_code: applied.arrivalAirportCode } : {}),
      ...(applied.departureDateFrom ? { departure_at_from: applied.departureDateFrom } : {}),
      ...(applied.departureDateTo ? { departure_at_to: applied.departureDateTo } : {}),
      ...(toBackendFlightStatus(applied.status) ? { status: toBackendFlightStatus(applied.status) } : {}),
      ...(applied.cabinClass ? { cabin_class: applied.cabinClass } : {}),
      ...(applied.minPrice != null ? { min_price: applied.minPrice } : {}),
      ...(applied.maxPrice != null ? { max_price: applied.maxPrice } : {}),
    }),
    [applied]
  );

  function applyFilters() {
    const minPrice = cleanPrice(draft.minPrice);
    const maxPrice = cleanPrice(draft.maxPrice);
    setApplied({
      companyId: cleanPositiveInt(draft.company),
      departureCity: cleanText(draft.departureCity),
      arrivalCity: cleanText(draft.arrivalCity),
      departureAirportCode: cleanCode(draft.departureAirportCode),
      arrivalAirportCode: cleanCode(draft.arrivalAirportCode),
      departureDateFrom: cleanText(draft.departureDateFrom),
      departureDateTo: cleanText(draft.departureDateTo),
      status: draft.status,
      cabinClass: cleanText(draft.cabinClass),
      minPrice,
      maxPrice,
    });
  }

  function clearFilters() {
    setDraft(DEFAULT_DRAFT);
    setApplied(DEFAULT_APPLIED);
  }

  return (
    <InventoryOversightList
      title={t("admin.inventory.flights.title")}
      segment="flights"
      permission="flights.view"
      queryParams={queryParams}
      columns={[
        { header: t("admin.inventory.flights.col.id"), getCell: (r) => cell(r.id) },
        { header: t("admin.inventory.flights.col.company"), getCell: (r) => companyLabel(r) },
        { header: t("admin.inventory.flights.col.route"), getCell: (r) => `${cell(r.departure_city)} (${cell(r.departure_airport_code)}) → ${cell(r.arrival_city)} (${cell(r.arrival_airport_code)})` },
        { header: t("admin.inventory.flights.col.departure"), getCell: (r) => cell(r.departure_at) },
        { header: t("admin.inventory.flights.col.status"), getCell: (r) => backendFlightStatusLabel(typeof r.status === "string" ? r.status : null) },
        { header: t("admin.inventory.flights.col.offer"), getCell: (r) => offerTitle(r) },
      ]}
      filterBar={
        <>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory.flights.filter.label.company_id")}
            <input
              value={draft.company}
              onChange={(e) => setDraft((prev) => ({ ...prev, company: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
              placeholder={t("admin.inventory.flights.filter.placeholder.company")}
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory.flights.filter.label.departure_city")}
            <input
              value={draft.departureCity}
              onChange={(e) => setDraft((prev) => ({ ...prev, departureCity: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
              placeholder={t("admin.inventory.flights.filter.placeholder.text")}
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory.flights.filter.label.arrival_city")}
            <input
              value={draft.arrivalCity}
              onChange={(e) => setDraft((prev) => ({ ...prev, arrivalCity: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
              placeholder={t("admin.inventory.flights.filter.placeholder.text")}
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory.flights.filter.label.departure_airport_code")}
            <input
              value={draft.departureAirportCode}
              onChange={(e) => setDraft((prev) => ({ ...prev, departureAirportCode: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
              placeholder={t("admin.inventory.flights.filter.placeholder.departure_airport_code")}
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory.flights.filter.label.arrival_airport_code")}
            <input
              value={draft.arrivalAirportCode}
              onChange={(e) => setDraft((prev) => ({ ...prev, arrivalAirportCode: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
              placeholder={t("admin.inventory.flights.filter.placeholder.arrival_airport_code")}
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory.flights.filter.label.departure_date_from")}
            <input
              type="date"
              value={draft.departureDateFrom}
              onChange={(e) => setDraft((prev) => ({ ...prev, departureDateFrom: e.target.value }))}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory.flights.filter.label.departure_date_to")}
            <input
              type="date"
              value={draft.departureDateTo}
              onChange={(e) => setDraft((prev) => ({ ...prev, departureDateTo: e.target.value }))}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory.flights.filter.label.status")}
            <select
              value={draft.status}
              onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as FlightUiStatusFilter }))}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            >
              {(["all", "upcoming", "active", "completed", "canceled"] as FlightUiStatusFilter[]).map((s) => (
                <option key={s} value={s}>
                  {flightUiStatusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory.flights.filter.label.cabin_class")}
            <input
              value={draft.cabinClass}
              onChange={(e) => setDraft((prev) => ({ ...prev, cabinClass: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
              placeholder={t("admin.inventory.flights.filter.placeholder.cabin_class")}
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory.flights.filter.label.min_price")}
            <input
              type="number"
              min={0}
              value={draft.minPrice}
              onChange={(e) => setDraft((prev) => ({ ...prev, minPrice: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
              placeholder={t("admin.inventory.flights.filter.placeholder.min_price")}
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory.flights.filter.label.max_price")}
            <input
              type="number"
              min={0}
              value={draft.maxPrice}
              onChange={(e) => setDraft((prev) => ({ ...prev, maxPrice: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
              placeholder={t("admin.inventory.flights.filter.placeholder.max_price")}
            />
          </label>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded border border-default bg-white px-3 py-1 text-sm"
          >
            {t("admin.inventory.flights.filter.action.apply")}
          </button>
          <button type="button" onClick={clearFilters} className="rounded border border-default bg-white px-3 py-1 text-sm">
            {t("admin.inventory.flights.filter.action.clear")}
          </button>
        </>
      }
    />
  );
}
