import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

// ─── Offers ──────────────────────────────────────────────────────────────────
export type OfferRow = {
  id: number;
  title: string;
  type: string;
  price?: number | null;
  currency?: string | null;
  status: string;
  company_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  company?: { id: number; name: string } | null;
};

export async function apiOffers(
  token: string,
  params: { page?: number; per_page?: number; status?: string }
): Promise<ApiSuccessEnvelope<OfferRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetchJson(`/offers${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiOffer(token: string, id: number): Promise<ApiSuccessEnvelope<OfferRow>> {
  return apiFetchJson(`/offers/${id}`, { method: "GET", token });
}

export async function apiPublishOffer(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<OfferRow>> {
  return apiFetchJson(`/offers/${id}/publish`, { method: "POST", token, body: {} });
}

export async function apiArchiveOffer(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<OfferRow>> {
  return apiFetchJson(`/offers/${id}/archive`, { method: "POST", token, body: {} });
}

// ─── Flights ─────────────────────────────────────────────────────────────────
export type FlightRow = {
  id: number;
  flight_number?: string | null;
  airline?: string | null;
  origin?: string | null;
  destination?: string | null;
  departure_at?: string | null;
  arrival_at?: string | null;
  status?: string | null;
  company_id?: number | null;
  created_at?: string | null;
};

export type FlightPayload = {
  flight_number?: string;
  airline?: string;
  origin?: string;
  destination?: string;
  departure_at?: string;
  arrival_at?: string;
  [key: string]: unknown;
};

export async function apiFlights(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<FlightRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/flights${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiFlight(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<FlightRow>> {
  return apiFetchJson(`/flights/${id}`, { method: "GET", token });
}

export async function apiCreateFlight(
  token: string,
  body: FlightPayload
): Promise<ApiSuccessEnvelope<FlightRow>> {
  return apiFetchJson(`/flights`, { method: "POST", token, body });
}

export async function apiUpdateFlight(
  token: string,
  id: number,
  body: FlightPayload
): Promise<ApiSuccessEnvelope<FlightRow>> {
  return apiFetchJson(`/flights/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteFlight(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/flights/${id}`, { method: "DELETE", token });
}

// ─── Hotels ──────────────────────────────────────────────────────────────────
export type HotelRow = {
  id: number;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  stars?: number | null;
  status?: string | null;
  company_id?: number | null;
  created_at?: string | null;
};

export type HotelPayload = {
  name?: string;
  city?: string;
  country?: string;
  stars?: number;
  [key: string]: unknown;
};

export async function apiHotels(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<HotelRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/hotels${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiCreateHotel(
  token: string,
  body: HotelPayload
): Promise<ApiSuccessEnvelope<HotelRow>> {
  return apiFetchJson(`/hotels`, { method: "POST", token, body });
}

export async function apiUpdateHotel(
  token: string,
  id: number,
  body: HotelPayload
): Promise<ApiSuccessEnvelope<HotelRow>> {
  return apiFetchJson(`/hotels/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteHotel(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/hotels/${id}`, { method: "DELETE", token });
}

// ─── Transfers ───────────────────────────────────────────────────────────────
export type TransferRow = {
  id: number;
  vehicle_type?: string | null;
  from_location?: string | null;
  to_location?: string | null;
  price?: number | null;
  currency?: string | null;
  company_id?: number | null;
  created_at?: string | null;
};

export type TransferPayload = {
  vehicle_type?: string;
  from_location?: string;
  to_location?: string;
  price?: number;
  currency?: string;
  [key: string]: unknown;
};

export async function apiTransfers(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<TransferRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/transfers${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiCreateTransfer(
  token: string,
  body: TransferPayload
): Promise<ApiSuccessEnvelope<TransferRow>> {
  return apiFetchJson(`/transfers`, { method: "POST", token, body });
}

export async function apiUpdateTransfer(
  token: string,
  id: number,
  body: TransferPayload
): Promise<ApiSuccessEnvelope<TransferRow>> {
  return apiFetchJson(`/transfers/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteTransfer(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/transfers/${id}`, { method: "DELETE", token });
}

// ─── Cars ────────────────────────────────────────────────────────────────────
export type CarRow = {
  id: number;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  price_per_day?: number | null;
  currency?: string | null;
  company_id?: number | null;
  created_at?: string | null;
};

export type CarPayload = {
  brand?: string;
  model?: string;
  year?: number;
  price_per_day?: number;
  currency?: string;
  [key: string]: unknown;
};

export async function apiCars(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<CarRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/cars${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiCreateCar(
  token: string,
  body: CarPayload
): Promise<ApiSuccessEnvelope<CarRow>> {
  return apiFetchJson(`/cars`, { method: "POST", token, body });
}

export async function apiUpdateCar(
  token: string,
  id: number,
  body: CarPayload
): Promise<ApiSuccessEnvelope<CarRow>> {
  return apiFetchJson(`/cars/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteCar(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/cars/${id}`, { method: "DELETE", token });
}

// ─── Excursions ───────────────────────────────────────────────────────────────
export type ExcursionRow = {
  id: number;
  title?: string | null;
  city?: string | null;
  country?: string | null;
  price?: number | null;
  currency?: string | null;
  duration_hours?: number | null;
  company_id?: number | null;
  created_at?: string | null;
};

export type ExcursionPayload = {
  title?: string;
  city?: string;
  country?: string;
  price?: number;
  currency?: string;
  duration_hours?: number;
  [key: string]: unknown;
};

export async function apiExcursions(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<ExcursionRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/excursions${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiCreateExcursion(
  token: string,
  body: ExcursionPayload
): Promise<ApiSuccessEnvelope<ExcursionRow>> {
  return apiFetchJson(`/excursions`, { method: "POST", token, body });
}

export async function apiUpdateExcursion(
  token: string,
  id: number,
  body: ExcursionPayload
): Promise<ApiSuccessEnvelope<ExcursionRow>> {
  return apiFetchJson(`/excursions/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteExcursion(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/excursions/${id}`, { method: "DELETE", token });
}

// ─── Visas ────────────────────────────────────────────────────────────────────
export type VisaRow = {
  id: number;
  country?: string | null;
  visa_type?: string | null;
  price?: number | null;
  currency?: string | null;
  processing_days?: number | null;
  company_id?: number | null;
  created_at?: string | null;
};

export type VisaPayload = {
  country?: string;
  visa_type?: string;
  price?: number;
  currency?: string;
  processing_days?: number;
  [key: string]: unknown;
};

export async function apiVisas(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<VisaRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/visas${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiCreateVisa(
  token: string,
  body: VisaPayload
): Promise<ApiSuccessEnvelope<VisaRow>> {
  return apiFetchJson(`/visas`, { method: "POST", token, body });
}

export async function apiUpdateVisa(
  token: string,
  id: number,
  body: VisaPayload
): Promise<ApiSuccessEnvelope<VisaRow>> {
  return apiFetchJson(`/visas/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteVisa(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/visas/${id}`, { method: "DELETE", token });
}

// ─── Packages ─────────────────────────────────────────────────────────────────
export type PackageRow = {
  id: number;
  package_title?: string | null;
  package_type?: string | null;
  destination_city?: string | null;
  destination_country?: string | null;
  duration_days?: number | null;
  currency?: string | null;
  status: string;
  is_public?: boolean;
  is_bookable?: boolean;
  company_id?: number | null;
  created_at?: string | null;
  company?: { id: number; name: string } | null;
};

export type PackagePayload = {
  package_title?: string;
  package_type?: string;
  destination_city?: string;
  destination_country?: string;
  duration_days?: number;
  currency?: string;
  [key: string]: unknown;
};

export async function apiPackages(
  token: string,
  params: { page?: number; per_page?: number; status?: string }
): Promise<ApiSuccessEnvelope<PackageRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetchJson(`/packages${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiCreatePackage(
  token: string,
  body: PackagePayload
): Promise<ApiSuccessEnvelope<PackageRow>> {
  return apiFetchJson(`/packages`, { method: "POST", token, body });
}

export async function apiUpdatePackage(
  token: string,
  id: number,
  body: PackagePayload
): Promise<ApiSuccessEnvelope<PackageRow>> {
  return apiFetchJson(`/packages/${id}`, { method: "PATCH", token, body });
}

export async function apiDeletePackage(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/packages/${id}`, { method: "DELETE", token });
}

export async function apiActivatePackage(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<PackageRow>> {
  return apiFetchJson(`/packages/${id}/activate`, { method: "POST", token, body: {} });
}

export async function apiDeactivatePackage(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<PackageRow>> {
  return apiFetchJson(`/packages/${id}/deactivate`, { method: "POST", token, body: {} });
}

export async function apiPackageComponents(
  token: string,
  packageId: number
): Promise<ApiSuccessEnvelope<{ id: number; component_type: string; component_id: number; sort_order?: number }[]>> {
  return apiFetchJson(`/packages/${packageId}`, { method: "GET", token });
}

export async function apiAddPackageComponent(
  token: string,
  packageId: number,
  body: { component_type: string; component_id: number }
): Promise<ApiSuccessEnvelope<PackageRow>> {
  return apiFetchJson(`/packages/${packageId}/components`, { method: "POST", token, body });
}

export async function apiRemovePackageComponent(
  token: string,
  packageId: number,
  componentId: number
): Promise<ApiSuccessEnvelope<PackageRow>> {
  return apiFetchJson(`/packages/${packageId}/components/${componentId}`, { method: "DELETE", token });
}
