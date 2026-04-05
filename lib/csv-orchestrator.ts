/**
 * csv-orchestrator.ts
 *
 * All functions that make API calls for CSV import / export.
 * Parsing and validation are delegated to csv-parser.ts.
 * No business logic lives here — only sequencing of API calls and error collection.
 */

import { toCanonicalFlightCabinClass } from "@/lib/flight-cabin-class";
import {
  apiCreateCar,
  apiCreateExcursion,
  apiCreateFlight,
  apiCreateTransfer,
  apiExcursions,
  apiFlight,
  apiFlights,
  apiGetHotel,
  apiHotels,
  apiOffer,
  apiCars as apiCarsList,
  apiTransfers,
  apiUpdateCar,
  apiUpdateExcursion,
  apiUpdateFlight,
  apiUpdateTransfer,
  type CarCreatePayload,
  type CarUpdatePayload,
  type ExcursionCreatePayload,
  type ExcursionUpdatePayload,
} from "@/lib/inventory-crud-api";
import {
  fetchAllListPages,
  formatImportApiError,
  stringifyCsv,
  type ImportRowError,
  type ImportRunResult,
} from "@/lib/csv-primitives";
import {
  carCsvRowToPayload,
  carDetailToCsvRow,
  CAR_CSV_FIELDS,
  carTemplateCsv,
  coreWritePayloadFromWizard,
  EXCURSION_CSV_FIELDS,
  excursionDetailToCsvRow,
  excursionRowToWizard,
  excursionTemplateCsv,
  expandedPayloadFromWizard,
  FLIGHT_CSV_FIELDS,
  flightDetailToCsvRow,
  flightRowToPayload,
  flightTemplateCsv,
  hotelFormToFlatCsv,
  HOTEL_CSV_FIELDS,
  hotelTemplateCsv,
  TRANSFER_CSV_FIELDS,
  transferDetailToCsvRow,
  transferRowToFormValues,
  transferTemplateCsv,
  validateExcursionCsvWizard,
  validateFlightCsvPayload,
} from "@/lib/csv-parser";
import { type TransferFormValues } from "@/lib/transfers/transfer-field-adapter";

// Re-export template generators so callers can still import them from one place if needed.
export {
  carTemplateCsv,
  excursionTemplateCsv,
  flightTemplateCsv,
  hotelTemplateCsv,
  transferTemplateCsv,
};

// ─── Flights ──────────────────────────────────────────────────────────────────

export async function exportFlightsCsv(token: string): Promise<string> {
  const list = await fetchAllListPages((p) => apiFlights(token, { page: p, per_page: 50 }));
  const rows: Record<string, unknown>[] = [];
  for (const item of list) {
    const detail = await apiFlight(token, item.id);
    rows.push(flightDetailToCsvRow(detail.data));
  }
  return stringifyCsv(["id", ...FLIGHT_CSV_FIELDS.map(String)], rows);
}

export async function runFlightCsvImport(
  token: string,
  dataRows: Record<string, string>[],
  rowLineNumbers: number[]
): Promise<ImportRunResult> {
  const errors: ImportRowError[] = [];
  let success = 0;

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    const r = rowLineNumbers[idx] ?? idx + 2;
    const idRaw = (row.id ?? "").trim();
    const payload = flightRowToPayload(row);
    const verr = validateFlightCsvPayload(payload);

    if (verr) {
      errors.push({ rowNumber: r, message: verr });
      continue;
    }

    try {
      const body = {
        ...payload,
        cabin_class: toCanonicalFlightCabinClass(payload.cabin_class as string) ?? "economy",
      };
      if (idRaw) {
        const id = Number(idRaw);
        if (!Number.isFinite(id)) {
          errors.push({ rowNumber: r, message: "Invalid id." });
        } else {
          await apiUpdateFlight(token, id, body);
          success++;
        }
      } else {
        await apiCreateFlight(token, body);
        success++;
      }
    } catch (e) {
      errors.push({ rowNumber: r, message: formatImportApiError(e) });
    }
  }

  return { success, failed: errors.length, errors };
}

// ─── Hotels (export only — import requires backend orchestration) ─────────────

export async function exportHotelsCsv(token: string): Promise<string> {
  const list = await fetchAllListPages((p) => apiHotels(token, { page: p, per_page: 50 }));
  const rows: Record<string, unknown>[] = [];
  for (const item of list) {
    const detail = await apiGetHotel(token, item.id);
    const flat = hotelFormToFlatCsv(hotelFormFromDetail(detail.data));
    flat.offer_id = detail.data.offer_id ?? "";
    rows.push({ id: item.id, ...flat });
  }
  return stringifyCsv([...HOTEL_CSV_FIELDS], rows);
}

// ─── Transfers ────────────────────────────────────────────────────────────────

export async function exportTransfersCsv(token: string): Promise<string> {
  const list = await fetchAllListPages((p) => apiTransfers(token, { page: p, per_page: 50 }));
  return stringifyCsv(["id", ...TRANSFER_CSV_FIELDS.map(String)], list.map(transferDetailToCsvRow));
}

export async function runTransferCsvImport(
  token: string,
  dataRows: Record<string, string>[],
  rowLineNumbers: number[]
): Promise<ImportRunResult> {
  const errors: ImportRowError[] = [];
  let success = 0;

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    const r = rowLineNumbers[idx] ?? idx + 2;
    const idRaw = (row.id ?? "").trim();
    const offerRaw = (row.offer_id ?? "").trim();
    const offerNum = Number(offerRaw);

    if (!offerRaw || !Number.isFinite(offerNum) || offerNum <= 0) {
      errors.push({ rowNumber: r, message: "offer_id is required and must reference an existing offer." });
      continue;
    }

    let currency = (row.currency ?? "").trim() || "USD";
    try {
      const off = await apiOffer(token, offerNum);
      currency = (off.data.currency ?? currency).toString();
    } catch {
      // keep CSV / default
    }

    const form = transferRowToFormValues(row, currency);
    form.offer_id = offerNum;

    try {
      if (idRaw) {
        const id = Number(idRaw);
        if (!Number.isFinite(id)) {
          errors.push({ rowNumber: r, message: "Invalid id." });
        } else {
          await apiUpdateTransfer(token, id, { ...form, offer_id: null } as TransferFormValues);
          success++;
        }
      } else {
        await apiCreateTransfer(token, form);
        success++;
      }
    } catch (e) {
      errors.push({ rowNumber: r, message: formatImportApiError(e) });
    }
  }

  return { success, failed: errors.length, errors };
}

// ─── Cars ─────────────────────────────────────────────────────────────────────

export async function exportCarsCsv(token: string): Promise<string> {
  const list = await fetchAllListPages((p) => apiCarsList(token, { page: p, per_page: 50 }));
  return stringifyCsv(["id", ...CAR_CSV_FIELDS.map(String)], list.map(carDetailToCsvRow));
}

export async function runCarCsvImport(
  token: string,
  dataRows: Record<string, string>[],
  rowLineNumbers: number[]
): Promise<ImportRunResult> {
  const errors: ImportRowError[] = [];
  let success = 0;

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    const r = rowLineNumbers[idx] ?? idx + 2;
    const idRaw = (row.id ?? "").trim();
    const offerRaw = (row.offer_id ?? "").trim();
    const offerNum = Number(offerRaw);

    if (!offerRaw || !Number.isFinite(offerNum) || offerNum <= 0) {
      errors.push({ rowNumber: r, message: "offer_id is required (existing offer)." });
      continue;
    }

    let companyId: number | null = null;
    try {
      const off = await apiOffer(token, offerNum);
      const cid = off.data.company_id;
      companyId = cid != null && cid !== "" ? Number(cid) : null;
    } catch {
      errors.push({ rowNumber: r, message: "Could not load offer; check offer_id." });
      continue;
    }

    if (companyId == null || !Number.isFinite(companyId)) {
      errors.push({ rowNumber: r, message: "offer has no company_id." });
      continue;
    }

    const get = (k: string) => (row[k] ?? "").trim();
    const payloadExpanded = carCsvRowToPayload(row);
    const pickup = get("pickup_location");
    const dropoff = get("dropoff_location");
    const vclass = get("vehicle_class");

    if (!pickup || !dropoff || !vclass) {
      errors.push({ rowNumber: r, message: "pickup_location, dropoff_location, vehicle_class are required." });
      continue;
    }

    try {
      if (idRaw) {
        const id = Number(idRaw);
        if (!Number.isFinite(id)) {
          errors.push({ rowNumber: r, message: "Invalid id." });
        } else {
          const body: CarUpdatePayload = { pickup_location: pickup, dropoff_location: dropoff, vehicle_class: vclass, ...payloadExpanded };
          await apiUpdateCar(token, id, body);
          success++;
        }
      } else {
        const body: CarCreatePayload = { offer_id: offerNum, company_id: companyId, pickup_location: pickup, dropoff_location: dropoff, vehicle_class: vclass, ...payloadExpanded };
        await apiCreateCar(token, body);
        success++;
      }
    } catch (e) {
      errors.push({ rowNumber: r, message: formatImportApiError(e) });
    }
  }

  return { success, failed: errors.length, errors };
}

// ─── Excursions ───────────────────────────────────────────────────────────────

export async function exportExcursionsCsv(token: string): Promise<string> {
  const list = await fetchAllListPages((p) => apiExcursions(token, { page: p, per_page: 50 }));
  return stringifyCsv(["id", ...EXCURSION_CSV_FIELDS.map(String)], list.map(excursionDetailToCsvRow));
}

export async function runExcursionCsvImport(
  token: string,
  dataRows: Record<string, string>[],
  rowLineNumbers: number[]
): Promise<ImportRunResult> {
  const errors: ImportRowError[] = [];
  let success = 0;

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    const r = rowLineNumbers[idx] ?? idx + 2;
    const idRaw = (row.id ?? "").trim();
    const offerRaw = (row.offer_id ?? "").trim();
    const offerNum = Number(offerRaw);

    if (!offerRaw || !Number.isFinite(offerNum) || offerNum <= 0) {
      errors.push({ rowNumber: r, message: "offer_id is required (existing offer)." });
      continue;
    }

    let companyId: number | null = null;
    try {
      const off = await apiOffer(token, offerNum);
      const cid = off.data.company_id;
      companyId = cid != null && cid !== "" ? Number(cid) : null;
    } catch {
      errors.push({ rowNumber: r, message: "Could not load offer; check offer_id." });
      continue;
    }

    if (companyId == null || !Number.isFinite(companyId)) {
      errors.push({ rowNumber: r, message: "offer has no company_id." });
      continue;
    }

    let wizard;
    try {
      wizard = excursionRowToWizard(row, offerNum, companyId);
    } catch (e) {
      errors.push({ rowNumber: r, message: e instanceof Error ? e.message : "Invalid row." });
      continue;
    }

    const validationError = validateExcursionCsvWizard(wizard, !idRaw);
    if (validationError) {
      errors.push({ rowNumber: r, message: validationError });
      continue;
    }

    const expanded = expandedPayloadFromWizard(wizard);
    delete expanded.price_by_dates;

    try {
      if (idRaw) {
        const id = Number(idRaw);
        if (!Number.isFinite(id)) {
          errors.push({ rowNumber: r, message: "Invalid id." });
        } else {
          const body: ExcursionUpdatePayload = { ...coreWritePayloadFromWizard(wizard), ...expanded };
          await apiUpdateExcursion(token, id, body);
          success++;
        }
      } else {
        const body: ExcursionCreatePayload = {
          offer_id: offerNum,
          company_id: companyId,
          ...coreWritePayloadFromWizard(wizard),
          ...expanded,
        };
        await apiCreateExcursion(token, body);
        success++;
      }
    } catch (e) {
      errors.push({ rowNumber: r, message: formatImportApiError(e) });
    }
  }

  return { success, failed: errors.length, errors };
}

// ─── Re-export hotelFormFromDetail for orchestrator consumers ─────────────────
import { hotelFormFromDetail } from "@/lib/inventory-crud-api";
export { hotelFormFromDetail };
