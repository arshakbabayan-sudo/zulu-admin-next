"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  HOTEL_AVAILABILITY_STATUSES,
  HOTEL_LIFECYCLE_STATUSES,
  hotelAvailabilityLabel,
  hotelLifecycleStatusLabel,
} from "@/lib/hotel-ui";
import { InventoryOversightList } from "../_components/InventoryOversightList";
import { Button } from "@/components/ui";
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

function triBoolToApplied(v: string): boolean | undefined {
  if (v === "") return undefined;
  if (v === "1") return true;
  if (v === "0") return false;
  return undefined;
}

export default function HotelsInventoryPage() {
  const { t } = useLanguage();
  const [draftCompany, setDraftCompany] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftCountry, setDraftCountry] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftAvailability, setDraftAvailability] = useState("");
  const [draftPackageEligible, setDraftPackageEligible] = useState("");
  const [draftFreeCancellation, setDraftFreeCancellation] = useState("");
  const [draftPriceMin, setDraftPriceMin] = useState("");
  const [draftPriceMax, setDraftPriceMax] = useState("");
  const [advancedPhase, setAdvancedPhase] = useState<1 | 2 | 3>(1);
  const [draftRoomType, setDraftRoomType] = useState("");
  const [draftInvoiceId, setDraftInvoiceId] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftUserEmail, setDraftUserEmail] = useState("");

  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [city, setCity] = useState<string | undefined>(undefined);
  const [country, setCountry] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [availabilityStatus, setAvailabilityStatus] = useState<string | undefined>(undefined);
  const [isPackageEligible, setIsPackageEligible] = useState<boolean | undefined>(undefined);
  const [freeCancellation, setFreeCancellation] = useState<boolean | undefined>(undefined);
  const [startingPriceMin, setStartingPriceMin] = useState<number | undefined>(undefined);
  const [startingPriceMax, setStartingPriceMax] = useState<number | undefined>(undefined);
  const [roomType, setRoomType] = useState<string | undefined>(undefined);
  const [invoiceId, setInvoiceId] = useState<number | undefined>(undefined);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  const queryParams = useMemo(
    () => ({
      ...(companyId != null ? { company_id: companyId } : {}),
      ...(city ? { city } : {}),
      ...(country ? { country } : {}),
      ...(status ? { status } : {}),
      ...(availabilityStatus ? { availability_status: availabilityStatus } : {}),
      ...(isPackageEligible !== undefined ? { is_package_eligible: isPackageEligible } : {}),
      ...(freeCancellation !== undefined ? { free_cancellation: freeCancellation } : {}),
      ...(startingPriceMin !== undefined ? { starting_price_min: startingPriceMin } : {}),
      ...(startingPriceMax !== undefined ? { starting_price_max: startingPriceMax } : {}),
      ...(roomType ? { room_type: roomType } : {}),
      ...(invoiceId !== undefined ? { invoice_id: invoiceId } : {}),
      ...(date ? { date } : {}),
      ...(userEmail ? { user_email: userEmail } : {}),
    }),
    [
      companyId,
      city,
      country,
      status,
      availabilityStatus,
      isPackageEligible,
      freeCancellation,
      startingPriceMin,
      startingPriceMax,
      roomType,
      invoiceId,
      date,
      userEmail,
    ]
  );

  function applyFilters() {
    setCompanyId(parseOptionalCompanyId(draftCompany));
    const c = draftCity.trim();
    setCity(c || undefined);
    const co = draftCountry.trim();
    setCountry(co || undefined);
    const st = draftStatus.trim();
    setStatus(st || undefined);
    const av = draftAvailability.trim();
    setAvailabilityStatus(av || undefined);
    setIsPackageEligible(triBoolToApplied(draftPackageEligible));
    setFreeCancellation(triBoolToApplied(draftFreeCancellation));
    setStartingPriceMin(parseOptionalPrice(draftPriceMin));
    setStartingPriceMax(parseOptionalPrice(draftPriceMax));
    setRoomType(draftRoomType.trim() || undefined);
    setInvoiceId(parseOptionalCompanyId(draftInvoiceId));
    setDate(draftDate.trim() || undefined);
    setUserEmail(draftUserEmail.trim() || undefined);
  }

  function clearFilters() {
    setDraftCompany("");
    setDraftCity("");
    setDraftCountry("");
    setDraftStatus("");
    setDraftAvailability("");
    setDraftPackageEligible("");
    setDraftFreeCancellation("");
    setDraftPriceMin("");
    setDraftPriceMax("");
    setDraftRoomType("");
    setDraftInvoiceId("");
    setDraftDate("");
    setDraftUserEmail("");
    setCompanyId(undefined);
    setCity(undefined);
    setCountry(undefined);
    setStatus(undefined);
    setAvailabilityStatus(undefined);
    setIsPackageEligible(undefined);
    setFreeCancellation(undefined);
    setStartingPriceMin(undefined);
    setStartingPriceMax(undefined);
    setRoomType(undefined);
    setInvoiceId(undefined);
    setDate(undefined);
    setUserEmail(undefined);
    setAdvancedPhase(1);
  }

  return (
    <InventoryOversightList
      title={t("admin.inventory_hotels.title")}
      segment="hotels"
      permission="hotels.view"
      queryParams={queryParams}
      columns={[
        { header: t("admin.inventory_hotels.col_id"), getCell: (r) => cell(r.id) },
        { header: t("admin.inventory_hotels.col_company_id"), getCell: (r) => cell(r.company_id) },
        { header: t("admin.inventory_hotels.col_hotel"), getCell: (r) => cell(r.hotel_name) },
        { header: t("admin.inventory_hotels.col_city"), getCell: (r) => cell(r.city) },
        { header: t("admin.inventory_hotels.col_country"), getCell: (r) => cell(r.country) },
        {
          header: t("admin.inventory_hotels.col_lifecycle"),
          getCell: (r) => {
            const s = r.status;
            return typeof s === "string" && s !== "" ? hotelLifecycleStatusLabel(s) : cell(s);
          },
        },
        { header: t("admin.inventory_hotels.col_from"), getCell: (r) => `${cell(r.starting_price)} ${cell(r.currency)}`.trim() },
        { header: t("admin.inventory_hotels.col_offer"), getCell: (r) => offerTitle(r) },
      ]}
      filterBar={
        <>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory_hotels.filter_advanced_phase")}
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
            {t("admin.inventory_hotels.filter_company_id")}
            <input
              value={draftCompany}
              onChange={(e) => setDraftCompany(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory_hotels.filter_country")}
            <input
              value={draftCountry}
              onChange={(e) => setDraftCountry(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory_hotels.filter_city")}
            <input
              value={draftCity}
              onChange={(e) => setDraftCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory_hotels.filter_lifecycle")}
            <select
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value)}
              className="ml-2 rounded border border-default bg-white px-2 py-1 text-sm"
            >
              <option value="">{t("admin.inventory_hotels.opt_any")}</option>
              {HOTEL_LIFECYCLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {hotelLifecycleStatusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory_hotels.filter_availability")}
            <select
              value={draftAvailability}
              onChange={(e) => setDraftAvailability(e.target.value)}
              className="ml-2 rounded border border-default bg-white px-2 py-1 text-sm"
            >
              <option value="">{t("admin.inventory_hotels.opt_any")}</option>
              {HOTEL_AVAILABILITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {hotelAvailabilityLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory_hotels.filter_package_eligible")}
            <select
              value={draftPackageEligible}
              onChange={(e) => setDraftPackageEligible(e.target.value)}
              className="ml-2 rounded border border-default bg-white px-2 py-1 text-sm"
            >
              <option value="">{t("admin.inventory_hotels.opt_any")}</option>
              <option value="1">{t("admin.inventory_hotels.opt_yes")}</option>
              <option value="0">{t("admin.inventory_hotels.opt_no")}</option>
            </select>
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory_hotels.filter_free_cancellation")}
            <select
              value={draftFreeCancellation}
              onChange={(e) => setDraftFreeCancellation(e.target.value)}
              className="ml-2 rounded border border-default bg-white px-2 py-1 text-sm"
            >
              <option value="">{t("admin.inventory_hotels.opt_any")}</option>
              <option value="1">{t("admin.inventory_hotels.opt_yes")}</option>
              <option value="0">{t("admin.inventory_hotels.opt_no")}</option>
            </select>
          </label>
          {advancedPhase >= 1 ? (
            <label className="text-sm text-fg-t6">
              {t("admin.inventory_hotels.filter_room_type")}
              <input
                value={draftRoomType}
                onChange={(e) => setDraftRoomType(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="ml-2 rounded border border-default px-2 py-1 text-sm"
                placeholder={t("admin.inventory_hotels.placeholder_room_type")}
              />
            </label>
          ) : null}
          {advancedPhase >= 2 ? (
            <>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_hotels.filter_invoice_id")}
                <input
                  value={draftInvoiceId}
                  onChange={(e) => setDraftInvoiceId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 w-28 rounded border border-default px-2 py-1 text-sm"
                  placeholder="123"
                />
              </label>
              <label className="text-sm text-fg-t6">
                {t("admin.inventory_hotels.filter_date")}
                <input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="ml-2 rounded border border-default px-2 py-1 text-sm"
                />
              </label>
            </>
          ) : null}
          {advancedPhase >= 3 ? (
            <label className="text-sm text-fg-t6">
              {t("admin.inventory_hotels.filter_user_email")}
              <input
                value={draftUserEmail}
                onChange={(e) => setDraftUserEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="ml-2 rounded border border-default px-2 py-1 text-sm"
                placeholder="email@domain.com"
              />
            </label>
          ) : null}
          <label className="text-sm text-fg-t6">
            {t("admin.inventory_hotels.filter_min_price")}
            <input
              value={draftPriceMin}
              onChange={(e) => setDraftPriceMin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 w-24 rounded border border-default px-2 py-1 text-sm"
              placeholder={t("admin.inventory_hotels.placeholder_from")}
            />
          </label>
          <label className="text-sm text-fg-t6">
            {t("admin.inventory_hotels.filter_max_price")}
            <input
              value={draftPriceMax}
              onChange={(e) => setDraftPriceMax(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="ml-2 w-24 rounded border border-default px-2 py-1 text-sm"
              placeholder={t("admin.inventory_hotels.placeholder_to")}
            />
          </label>
          <Button size="sm" onClick={applyFilters}>
            {t("admin.inventory_hotels.btn_apply")}
          </Button>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            {t("admin.inventory_hotels.btn_clear")}
          </Button>
        </>
      }
    />
  );
}
