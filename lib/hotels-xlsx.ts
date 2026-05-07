/**
 * hotels-xlsx.ts — 3-sheet Excel template + import for the Hotels CRUD page.
 *
 * Sheet layout matches backend/config/import_templates.php hierarchy:
 *   Sheet 1 "Hotels"   — one row per hotel, identified by Hotel Code
 *   Sheet 2 "Rooms"    — one row per room, links to a hotel by Hotel Code
 *   Sheet 3 "Pricings" — one row per pricing period, links to a room by Room Code
 *
 * Hotel/Room codes are operator-defined unique strings used only inside the
 * uploaded file (they never reach the API). The importer groups rooms under
 * hotels and pricings under rooms by exact-match on these codes, then builds a
 * single POST /hotels payload per hotel.
 */

import ExcelJS from "exceljs";
import {
  apiCreateHotel,
  hotelCreateBodyFromForm,
  newHotelPricingFormRow,
  newHotelRoomFormRow,
  type HotelFormPayload,
  type HotelPricingFormRow,
  type HotelRoomFormRow,
} from "@/lib/inventory-crud-api";
import { ApiRequestError } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/api-base";

// ─── Location resolver ──────────────────────────────────────────────────────
// Imports come with Country + Region/State + City as text. The backend's
// /hotels endpoint requires a structured location_id. Resolve it by hitting
// the public /locations/search endpoint and matching against the location
// tree. Cache lookups so we don't re-fetch for repeat country/city pairs.

type LocSuggestion = {
  id: number;
  name: string;
  type: string;
  country_code: string | null;
  parent_id: number | null;
  country_name: string | null;
};

const _locResolveCache = new Map<string, number | null>();

async function fetchLocations(q: string, types: string): Promise<LocSuggestion[]> {
  if (!q || q.trim().length === 0) return [];
  try {
    const url = `${getApiBaseUrl().replace(/\/$/, "")}/locations/search?q=${encodeURIComponent(q.trim())}&types=${types}&limit=20`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? (json.data as LocSuggestion[]) : [];
  } catch {
    return [];
  }
}

function normalize(s: string): string {
  return (s ?? "").trim().toLocaleLowerCase();
}

/**
 * Resolve the most specific location_id from country/region/city text.
 * Strategy: prefer exact city match within the named country, fall back
 * to region match, fall back to country match. Returns null if nothing
 * matches — caller treats that as a row-level error.
 */
async function resolveLocationId(country: string, region: string, city: string): Promise<number | null> {
  const cacheKey = `${normalize(country)}|${normalize(region)}|${normalize(city)}`;
  if (_locResolveCache.has(cacheKey)) return _locResolveCache.get(cacheKey) ?? null;

  let result: number | null = null;

  if (city.trim().length > 0) {
    const cityHits = await fetchLocations(city, "city");
    // Prefer one whose country_name matches the import country
    const exact = cityHits.find(
      (h) => normalize(h.name) === normalize(city) && normalize(h.country_name ?? "") === normalize(country)
    );
    const partial =
      exact ??
      cityHits.find((h) => normalize(h.country_name ?? "") === normalize(country)) ??
      cityHits.find((h) => normalize(h.name) === normalize(city));
    if (partial) result = partial.id;
  }

  if (result === null && region.trim().length > 0) {
    const regionHits = await fetchLocations(region, "region");
    const match =
      regionHits.find(
        (h) => normalize(h.name) === normalize(region) && normalize(h.country_name ?? "") === normalize(country)
      ) ??
      regionHits.find((h) => normalize(h.country_name ?? "") === normalize(country)) ??
      regionHits.find((h) => normalize(h.name) === normalize(region));
    if (match) result = match.id;
  }

  if (result === null && country.trim().length > 0) {
    const countryHits = await fetchLocations(country, "country");
    const match = countryHits.find((h) => normalize(h.name) === normalize(country)) ?? countryHits[0];
    if (match) result = match.id;
  }

  _locResolveCache.set(cacheKey, result);
  return result;
}

// ─── Column definitions ──────────────────────────────────────────────────────

type ColumnDef = {
  key: string;
  header: string;
  required?: boolean;
  example?: string | number | boolean;
  /** Column width in Excel chars. */
  width?: number;
};

const HOTELS_COLUMNS: ColumnDef[] = [
  { key: "hotel_code", header: "Hotel Code", required: true, example: "H001", width: 12 },
  { key: "offer_id", header: "Offer ID", required: true, example: 1, width: 10 },
  { key: "hotel_name", header: "Hotel Name", required: true, example: "Grand Erebuni", width: 24 },
  { key: "property_type", header: "Property Type", required: true, example: "hotel", width: 14 },
  { key: "hotel_type", header: "Hotel Type", required: true, example: "resort", width: 14 },
  { key: "country", header: "Country", required: true, example: "Armenia", width: 14 },
  { key: "region_or_state", header: "Region or State", example: "Yerevan", width: 16 },
  { key: "city", header: "City", required: true, example: "Yerevan", width: 14 },
  { key: "district_or_area", header: "District or Area", example: "Kentron", width: 16 },
  { key: "full_address", header: "Full Address", example: "Tigran Mets 14", width: 28 },
  { key: "latitude", header: "Latitude", example: 40.1776, width: 12 },
  { key: "longitude", header: "Longitude", example: 44.5126, width: 12 },
  { key: "meal_type", header: "Meal Type", required: true, example: "bed_and_breakfast", width: 18 },
  { key: "star_rating", header: "Star Rating", example: 4, width: 12 },
  { key: "availability_status", header: "Availability Status", required: true, example: "available", width: 18 },
  { key: "status", header: "Status", required: true, example: "draft", width: 12 },
  { key: "bookable", header: "Bookable", example: true, width: 12 },
  { key: "is_package_eligible", header: "Is Package Eligible", example: false, width: 18 },
  { key: "visibility_rule", header: "Visibility Rule", example: "show_all", width: 16 },
  { key: "appears_in_packages", header: "Appears In Packages", example: true, width: 18 },
  { key: "free_wifi", header: "Free WiFi", example: true, width: 12 },
  { key: "parking", header: "Parking", example: true, width: 10 },
  { key: "airport_shuttle", header: "Airport Shuttle", example: false, width: 16 },
  { key: "indoor_pool", header: "Indoor Pool", example: false, width: 12 },
  { key: "outdoor_pool", header: "Outdoor Pool", example: true, width: 14 },
  { key: "room_service", header: "Room Service", example: true, width: 14 },
  { key: "front_desk_24h", header: "Front Desk 24h", example: true, width: 14 },
  { key: "child_friendly", header: "Child Friendly", example: true, width: 14 },
  { key: "accessibility_support", header: "Accessibility Support", example: false, width: 20 },
  { key: "pets_allowed", header: "Pets Allowed", example: false, width: 14 },
  { key: "free_cancellation", header: "Free Cancellation", example: true, width: 16 },
  { key: "prepayment_required", header: "Prepayment Required", example: false, width: 18 },
  { key: "cancellation_policy_type", header: "Cancellation Policy Type", example: "flexible", width: 22 },
  { key: "cancellation_deadline_at", header: "Cancellation Deadline At", example: "", width: 22 },
  { key: "no_show_policy", header: "No-show Policy", example: "", width: 22 },
  { key: "review_score", header: "Review Score", example: 8.5, width: 12 },
  { key: "review_count", header: "Review Count", example: 124, width: 12 },
  { key: "review_label", header: "Review Label", example: "Very good", width: 16 },
  { key: "room_inventory_mode", header: "Room Inventory Mode", example: "per_room", width: 20 },
];

const ROOMS_COLUMNS: ColumnDef[] = [
  { key: "hotel_code", header: "Hotel Code", required: true, example: "H001", width: 12 },
  { key: "room_code", header: "Room Code", required: true, example: "H001-STD", width: 14 },
  { key: "room_type", header: "Room Type", required: true, example: "standard", width: 14 },
  { key: "room_name", header: "Room Name", required: true, example: "Standard Double", width: 22 },
  { key: "max_adults", header: "Max Adults", required: true, example: 2, width: 12 },
  { key: "max_children", header: "Max Children", example: 1, width: 14 },
  { key: "max_total_guests", header: "Max Total Guests", required: true, example: 3, width: 16 },
  { key: "bed_type", header: "Bed Type", example: "double", width: 12 },
  { key: "bed_count", header: "Bed Count", example: 1, width: 10 },
  { key: "room_size", header: "Room Size (m²)", example: "22", width: 14 },
  { key: "room_view", header: "Room View", example: "garden", width: 14 },
  { key: "view_type", header: "View Type", example: "garden", width: 14 },
  { key: "room_inventory_count", header: "Inventory Count", example: 5, width: 14 },
  { key: "status", header: "Status", example: "active", width: 10 },
  { key: "private_bathroom", header: "Private Bathroom", example: true, width: 16 },
  { key: "bath", header: "Bathtub", example: false, width: 10 },
  { key: "shower", header: "Shower", example: true, width: 10 },
  { key: "air_conditioning", header: "Air Conditioning", example: true, width: 16 },
  { key: "wifi", header: "Wi-Fi", example: true, width: 8 },
  { key: "tv", header: "TV", example: true, width: 6 },
  { key: "mini_fridge", header: "Mini Fridge", example: true, width: 12 },
  { key: "tea_coffee_maker", header: "Tea/Coffee Maker", example: false, width: 16 },
  { key: "kettle", header: "Kettle", example: true, width: 10 },
  { key: "washing_machine", header: "Washing Machine", example: false, width: 16 },
  { key: "soundproofing", header: "Soundproofing", example: false, width: 14 },
  { key: "terrace_or_balcony", header: "Terrace / Balcony", example: false, width: 16 },
  { key: "patio", header: "Patio", example: false, width: 8 },
  { key: "smoking_allowed", header: "Smoking Allowed", example: false, width: 16 },
  { key: "room_images", header: "Room Images (semicolon-separated URLs)", example: "https://example.com/r1.jpg;https://example.com/r2.jpg", width: 36 },
];

const PRICINGS_COLUMNS: ColumnDef[] = [
  { key: "room_code", header: "Room Code", required: true, example: "H001-STD", width: 14 },
  { key: "price", header: "Price", required: true, example: 100, width: 10 },
  { key: "currency", header: "Currency", required: true, example: "USD", width: 10 },
  { key: "pricing_mode", header: "Pricing Mode", example: "per_night", width: 14 },
  { key: "valid_from", header: "Valid From (YYYY-MM-DD)", example: "", width: 22 },
  { key: "valid_to", header: "Valid To (YYYY-MM-DD)", example: "", width: 22 },
  { key: "min_nights", header: "Min Nights", example: "", width: 12 },
  { key: "status", header: "Status", example: "active", width: 10 },
];

// ─── Template generation ─────────────────────────────────────────────────────

function applyHeaderRow(sheet: ExcelJS.Worksheet, columns: ColumnDef[]): void {
  sheet.columns = columns.map((c) => ({
    header: c.required ? `${c.header} *` : c.header,
    key: c.key,
    width: c.width ?? 14,
  }));
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE9E5FF" },
  };
  header.alignment = { vertical: "middle", horizontal: "left" };
  header.height = 22;
  // Highlight required cells in pink-ish.
  columns.forEach((c, idx) => {
    if (!c.required) return;
    const cell = header.getCell(idx + 1);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFD9E0" },
    };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
}

function applyExampleRow(sheet: ExcelJS.Worksheet, columns: ColumnDef[]): void {
  const row: Record<string, unknown> = {};
  for (const c of columns) {
    if (c.example !== undefined) row[c.key] = c.example;
  }
  const inserted = sheet.addRow(row);
  inserted.font = { italic: true, color: { argb: "FF777777" } };
}

/** Build the empty 3-sheet workbook (with one example row in each sheet). */
export async function buildHotelsTemplateBlob(): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ZULU Admin";
  wb.created = new Date();

  const intro = wb.addWorksheet("How to fill");
  intro.columns = [{ header: "", key: "text", width: 100 }];
  intro.addRows([
    { text: "ZULU Hotels import template" },
    { text: "" },
    { text: "Fill the three sheets in order. Required columns are marked with *." },
    { text: "" },
    { text: "Sheet 1 'Hotels' — one row per hotel. The 'Hotel Code' column is your own free-form code (e.g. H001, ZULU-EREBUNI)." },
    { text: "Sheet 2 'Rooms' — one row per room. 'Hotel Code' must exactly match a row from Sheet 1. 'Room Code' is your own code, unique across all rooms (e.g. H001-STD)." },
    { text: "Sheet 3 'Pricings' — one row per pricing period. 'Room Code' must exactly match a row from Sheet 2." },
    { text: "" },
    { text: "Boolean columns accept: true / false / 1 / 0 / yes / no." },
    { text: "Date columns use YYYY-MM-DD format (e.g. 2026-06-15). Leave blank for no date." },
    { text: "Room Images takes multiple URLs separated by semicolons." },
    { text: "" },
    { text: "After filling the file, save it and click Import on the Hotels page." },
  ]);
  intro.getRow(1).font = { bold: true, size: 14 };

  const hotels = wb.addWorksheet("Hotels");
  applyHeaderRow(hotels, HOTELS_COLUMNS);
  applyExampleRow(hotels, HOTELS_COLUMNS);

  const rooms = wb.addWorksheet("Rooms");
  applyHeaderRow(rooms, ROOMS_COLUMNS);
  applyExampleRow(rooms, ROOMS_COLUMNS);
  // Add a second example row to show multiple rooms for the same hotel.
  rooms.addRow({
    hotel_code: "H001", room_code: "H001-DLX",
    room_type: "deluxe", room_name: "Deluxe King",
    max_adults: 2, max_children: 0, max_total_guests: 2,
    bed_type: "king", bed_count: 1, room_size: "30",
    room_view: "city", view_type: "city",
    room_inventory_count: 3, status: "active",
    private_bathroom: true, bath: true, shower: true,
    air_conditioning: true, wifi: true, tv: true,
    mini_fridge: true, tea_coffee_maker: true, kettle: true,
    washing_machine: false, soundproofing: true,
    terrace_or_balcony: true, patio: false, smoking_allowed: false,
    room_images: "",
  }).font = { italic: true, color: { argb: "FF777777" } };

  const pricings = wb.addWorksheet("Pricings");
  applyHeaderRow(pricings, PRICINGS_COLUMNS);
  applyExampleRow(pricings, PRICINGS_COLUMNS);
  pricings.addRow({
    room_code: "H001-STD", price: 80, currency: "USD",
    pricing_mode: "per_night", valid_from: "2026-11-01", valid_to: "2027-03-31",
    min_nights: 2, status: "active",
  }).font = { italic: true, color: { argb: "FF777777" } };
  pricings.addRow({
    room_code: "H001-DLX", price: 150, currency: "USD",
    pricing_mode: "per_night", valid_from: "", valid_to: "",
    min_nights: "", status: "active",
  }).font = { italic: true, color: { argb: "FF777777" } };

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Trigger a browser download of a Blob as a named file. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

// ─── Import parsing ──────────────────────────────────────────────────────────

type RawRow = Record<string, string>;

type HotelImportError = {
  sheet: string;
  rowNumber: number; // 1-based, including header
  message: string;
};

export type HotelXlsxImportResult = {
  success: number;
  failed: number;
  errors: HotelImportError[];
};

function normalizeHeader(s: string): string {
  return s.replace(/\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function buildHeaderMap(columns: ColumnDef[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of columns) {
    map[normalizeHeader(c.header)] = c.key;
    map[normalizeHeader(c.key)] = c.key;
  }
  return map;
}

const HOTELS_HEADER_MAP = buildHeaderMap(HOTELS_COLUMNS);
const ROOMS_HEADER_MAP = buildHeaderMap(ROOMS_COLUMNS);
const PRICINGS_HEADER_MAP = buildHeaderMap(PRICINGS_COLUMNS);

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "object") {
    const obj = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (typeof obj.text === "string") return obj.text.trim();
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((p) => p.text ?? "").join("").trim();
    }
    if (obj.result != null) return cellToString(obj.result as ExcelJS.CellValue);
  }
  return String(value).trim();
}

function readSheetRows(
  sheet: ExcelJS.Worksheet | undefined,
  headerMap: Record<string, string>
): { rows: RawRow[]; rowNumbers: number[] } {
  const rows: RawRow[] = [];
  const rowNumbers: number[] = [];
  if (!sheet) return { rows, rowNumbers };
  const headerRow = sheet.getRow(1);
  const headers: (string | null)[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    const text = cellToString(cell.value);
    const key = headerMap[normalizeHeader(text)] ?? null;
    headers[col - 1] = key;
  });
  if (headers.every((h) => h == null)) return { rows, rowNumbers };

  const lastRow = sheet.actualRowCount || sheet.rowCount;
  for (let r = 2; r <= lastRow; r++) {
    const rawRow = sheet.getRow(r);
    let hasAny = false;
    const rec: RawRow = {};
    for (let c = 1; c <= headers.length; c++) {
      const key = headers[c - 1];
      if (!key) continue;
      const cellValue = cellToString(rawRow.getCell(c).value);
      if (cellValue.length > 0) hasAny = true;
      rec[key] = cellValue;
    }
    if (!hasAny) continue;
    rows.push(rec);
    rowNumbers.push(r);
  }
  return { rows, rowNumbers };
}

function toBool(v: string, fallback = false): boolean {
  const t = v.trim().toLowerCase();
  if (t === "") return fallback;
  return t === "1" || t === "true" || t === "yes" || t === "on" || t === "y";
}

function toNumOr<T extends number | "" | null>(v: string, fallback: T): number | T {
  const t = v.trim();
  if (t === "") return fallback;
  const n = Number(t);
  return Number.isFinite(n) ? n : fallback;
}

function buildRoomFromRow(
  raw: RawRow,
  pricings: HotelPricingFormRow[]
): HotelRoomFormRow {
  const r = newHotelRoomFormRow();
  r.room_type = raw.room_type ?? "";
  r.room_name = raw.room_name ?? "";
  r.max_adults = toNumOr(raw.max_adults ?? "", "");
  r.max_children = toNumOr(raw.max_children ?? "", 0);
  r.max_total_guests = toNumOr(raw.max_total_guests ?? "", "");
  r.bed_type = raw.bed_type ?? "";
  r.bed_count = toNumOr(raw.bed_count ?? "", 1);
  r.room_size = raw.room_size ?? "";
  r.room_view = raw.room_view ?? "";
  r.view_type = raw.view_type ?? "";
  r.room_inventory_count = toNumOr(raw.room_inventory_count ?? "", "");
  r.status = (raw.status ?? "").trim() || "active";
  r.private_bathroom = toBool(raw.private_bathroom ?? "", false);
  r.bath = toBool(raw.bath ?? "", false);
  r.shower = toBool(raw.shower ?? "", false);
  r.air_conditioning = toBool(raw.air_conditioning ?? "", false);
  r.wifi = toBool(raw.wifi ?? "", false);
  r.tv = toBool(raw.tv ?? "", false);
  r.mini_fridge = toBool(raw.mini_fridge ?? "", false);
  r.tea_coffee_maker = toBool(raw.tea_coffee_maker ?? "", false);
  r.kettle = toBool(raw.kettle ?? "", false);
  r.washing_machine = toBool(raw.washing_machine ?? "", false);
  r.soundproofing = toBool(raw.soundproofing ?? "", false);
  r.terrace_or_balcony = toBool(raw.terrace_or_balcony ?? "", false);
  r.patio = toBool(raw.patio ?? "", false);
  r.smoking_allowed = toBool(raw.smoking_allowed ?? "", false);
  r.room_images = (raw.room_images ?? "")
    .split(/[;\n\r]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join("\n");
  r.pricings = pricings.length > 0 ? pricings : [newHotelPricingFormRow()];
  return r;
}

function buildPricingFromRow(raw: RawRow): HotelPricingFormRow {
  const p = newHotelPricingFormRow();
  p.price = (raw.price ?? "").trim();
  p.currency = ((raw.currency ?? "").trim() || "USD").toUpperCase().slice(0, 3);
  p.pricing_mode = (raw.pricing_mode ?? "").trim() || "per_night";
  p.valid_from = (raw.valid_from ?? "").trim();
  p.valid_to = (raw.valid_to ?? "").trim();
  p.min_nights = toNumOr(raw.min_nights ?? "", "");
  p.status = (raw.status ?? "").trim() || "active";
  return p;
}

function buildHotelFormFromRow(raw: RawRow, rooms: HotelRoomFormRow[]): HotelFormPayload {
  return {
    offer_id: toNumOr(raw.offer_id ?? "", ""),
    location_id: "",
    hotel_name: raw.hotel_name ?? "",
    property_type: (raw.property_type ?? "").trim() || "hotel",
    hotel_type: (raw.hotel_type ?? "").trim() || "resort",
    country: raw.country ?? "",
    region_or_state: raw.region_or_state ?? "",
    city: raw.city ?? "",
    district_or_area: raw.district_or_area ?? "",
    full_address: raw.full_address ?? "",
    latitude: raw.latitude ?? "",
    longitude: raw.longitude ?? "",
    meal_type: (raw.meal_type ?? "").trim() || "bed_and_breakfast",
    star_rating: toNumOr(raw.star_rating ?? "", ""),
    availability_status: (raw.availability_status ?? "").trim() || "available",
    status: (raw.status ?? "").trim() || "draft",
    bookable: toBool(raw.bookable ?? "", true),
    is_package_eligible: toBool(raw.is_package_eligible ?? "", false),
    visibility_rule: (raw.visibility_rule ?? "").trim() || "show_all",
    appears_in_packages: toBool(raw.appears_in_packages ?? "", true),
    free_wifi: toBool(raw.free_wifi ?? "", false),
    parking: toBool(raw.parking ?? "", false),
    airport_shuttle: toBool(raw.airport_shuttle ?? "", false),
    indoor_pool: toBool(raw.indoor_pool ?? "", false),
    outdoor_pool: toBool(raw.outdoor_pool ?? "", false),
    room_service: toBool(raw.room_service ?? "", false),
    front_desk_24h: toBool(raw.front_desk_24h ?? "", false),
    child_friendly: toBool(raw.child_friendly ?? "", false),
    accessibility_support: toBool(raw.accessibility_support ?? "", false),
    pets_allowed: toBool(raw.pets_allowed ?? "", false),
    free_cancellation: toBool(raw.free_cancellation ?? "", false),
    prepayment_required: toBool(raw.prepayment_required ?? "", false),
    cancellation_policy_type: raw.cancellation_policy_type ?? "",
    cancellation_deadline_at: raw.cancellation_deadline_at ?? "",
    no_show_policy: raw.no_show_policy ?? "",
    review_score: toNumOr(raw.review_score ?? "", ""),
    review_count: toNumOr(raw.review_count ?? "", ""),
    review_label: raw.review_label ?? "",
    room_inventory_mode: raw.room_inventory_mode ?? "",
    rooms: rooms.length > 0 ? rooms : [newHotelRoomFormRow()],
  };
}

/**
 * Read a user-uploaded xlsx file and POST one hotel per Hotels-sheet row.
 * Errors are accumulated and returned alongside the success count.
 */
export async function importHotelsXlsx(
  token: string,
  file: File
): Promise<HotelXlsxImportResult> {
  const errors: HotelImportError[] = [];

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const hotelsSheet = wb.getWorksheet("Hotels");
  const roomsSheet = wb.getWorksheet("Rooms");
  const pricingsSheet = wb.getWorksheet("Pricings");

  if (!hotelsSheet) {
    return { success: 0, failed: 0, errors: [{ sheet: "(workbook)", rowNumber: 0, message: "Sheet 'Hotels' is missing." }] };
  }

  const { rows: hotelRows, rowNumbers: hotelRowNumbers } = readSheetRows(hotelsSheet, HOTELS_HEADER_MAP);
  const { rows: roomRows, rowNumbers: roomRowNumbers } = readSheetRows(roomsSheet, ROOMS_HEADER_MAP);
  const { rows: pricingRows, rowNumbers: pricingRowNumbers } = readSheetRows(pricingsSheet, PRICINGS_HEADER_MAP);

  // Group pricings by Room Code.
  const pricingsByRoom = new Map<string, HotelPricingFormRow[]>();
  pricingRows.forEach((row, i) => {
    const code = (row.room_code ?? "").trim();
    if (!code) {
      errors.push({ sheet: "Pricings", rowNumber: pricingRowNumbers[i], message: "Room Code is required." });
      return;
    }
    const priceRaw = (row.price ?? "").trim();
    if (!priceRaw) {
      errors.push({ sheet: "Pricings", rowNumber: pricingRowNumbers[i], message: "Price is required." });
      return;
    }
    const priceNum = Number(priceRaw);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      errors.push({ sheet: "Pricings", rowNumber: pricingRowNumbers[i], message: "Price must be a positive number." });
      return;
    }
    if (!(row.currency ?? "").trim()) {
      errors.push({ sheet: "Pricings", rowNumber: pricingRowNumbers[i], message: "Currency is required (3 letters)." });
      return;
    }
    const list = pricingsByRoom.get(code) ?? [];
    list.push(buildPricingFromRow(row));
    pricingsByRoom.set(code, list);
  });

  // Group rooms by Hotel Code; attach their pricings.
  const roomsByHotel = new Map<string, HotelRoomFormRow[]>();
  const seenRoomCodes = new Set<string>();
  roomRows.forEach((row, i) => {
    const hotelCode = (row.hotel_code ?? "").trim();
    const roomCode = (row.room_code ?? "").trim();
    if (!hotelCode) {
      errors.push({ sheet: "Rooms", rowNumber: roomRowNumbers[i], message: "Hotel Code is required." });
      return;
    }
    if (!roomCode) {
      errors.push({ sheet: "Rooms", rowNumber: roomRowNumbers[i], message: "Room Code is required." });
      return;
    }
    if (seenRoomCodes.has(roomCode)) {
      errors.push({ sheet: "Rooms", rowNumber: roomRowNumbers[i], message: `Duplicate Room Code "${roomCode}".` });
      return;
    }
    seenRoomCodes.add(roomCode);
    if (!(row.room_type ?? "").trim() || !(row.room_name ?? "").trim()) {
      errors.push({ sheet: "Rooms", rowNumber: roomRowNumbers[i], message: "Room Type and Room Name are required." });
      return;
    }
    if (!(row.max_adults ?? "").trim() || !(row.max_total_guests ?? "").trim()) {
      errors.push({ sheet: "Rooms", rowNumber: roomRowNumbers[i], message: "Max Adults and Max Total Guests are required." });
      return;
    }
    const pricings = pricingsByRoom.get(roomCode) ?? [];
    if (pricings.length === 0) {
      errors.push({ sheet: "Rooms", rowNumber: roomRowNumbers[i], message: `No pricings found for Room Code "${roomCode}". Add at least one row in the Pricings sheet.` });
      return;
    }
    const room = buildRoomFromRow(row, pricings);
    const list = roomsByHotel.get(hotelCode) ?? [];
    list.push(room);
    roomsByHotel.set(hotelCode, list);
  });

  // Process hotels. One POST per hotel row.
  let success = 0;
  const seenHotelCodes = new Set<string>();
  for (let i = 0; i < hotelRows.length; i++) {
    const row = hotelRows[i];
    const rNum = hotelRowNumbers[i];
    const code = (row.hotel_code ?? "").trim();
    if (!code) {
      errors.push({ sheet: "Hotels", rowNumber: rNum, message: "Hotel Code is required." });
      continue;
    }
    if (seenHotelCodes.has(code)) {
      errors.push({ sheet: "Hotels", rowNumber: rNum, message: `Duplicate Hotel Code "${code}".` });
      continue;
    }
    seenHotelCodes.add(code);

    const offerRaw = (row.offer_id ?? "").trim();
    const offerNum = Number(offerRaw);
    if (!offerRaw || !Number.isFinite(offerNum) || offerNum <= 0) {
      errors.push({ sheet: "Hotels", rowNumber: rNum, message: "Offer ID is required and must be a positive integer that exists on the offers table." });
      continue;
    }
    if (!(row.hotel_name ?? "").trim() || !(row.country ?? "").trim() || !(row.city ?? "").trim()) {
      errors.push({ sheet: "Hotels", rowNumber: rNum, message: "Hotel Name, Country, and City are required." });
      continue;
    }

    const rooms = roomsByHotel.get(code) ?? [];
    if (rooms.length === 0) {
      errors.push({ sheet: "Hotels", rowNumber: rNum, message: `No rooms found for Hotel Code "${code}". Add at least one row in the Rooms sheet.` });
      continue;
    }

    const form = buildHotelFormFromRow(row, rooms);

    // Resolve location_id from Country / Region / City text — backend
    // requires a structured FK and the import sheet only has names.
    const resolvedLocId = await resolveLocationId(
      form.country ?? "",
      form.region_or_state ?? "",
      form.city ?? ""
    );
    if (resolvedLocId === null) {
      errors.push({
        sheet: "Hotels",
        rowNumber: rNum,
        message: `Could not match Country="${form.country}", City="${form.city}" to a known location. Check the spelling against the location tree.`,
      });
      continue;
    }
    form.location_id = resolvedLocId;

    try {
      await apiCreateHotel(token, hotelCreateBodyFromForm(form));
      success++;
    } catch (e) {
      const msg = e instanceof ApiRequestError
        ? formatApiError(e)
        : e instanceof Error
          ? e.message
          : "Unknown error.";
      errors.push({ sheet: "Hotels", rowNumber: rNum, message: msg });
    }
  }

  return { success, failed: errors.length, errors };
}

function formatApiError(e: ApiRequestError): string {
  const body = e.body as { errors?: Record<string, string[]>; message?: string } | undefined;
  if (body?.errors) {
    const first = Object.entries(body.errors)[0];
    if (first) return `${first[0]}: ${first[1].join(", ")}`;
  }
  if (body?.message) return body.message;
  return e.message;
}
