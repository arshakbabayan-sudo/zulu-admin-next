import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

/** Country row from `GET /locations/countries` (model + counts). */
export type LocationCountryRow = {
  id: number;
  name: string;
  code: string;
  flag_emoji?: string | null;
  is_active?: boolean;
  sort_order?: number;
  regions_count?: number;
  cities_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type LocationRegionRow = {
  id: number;
  country_id: number;
  name: string;
  code?: string | null;
  is_active?: boolean;
  sort_order?: number;
  cities_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type LocationCityRow = {
  id: number;
  region_id: number;
  country_id?: number | null;
  name: string;
  is_active?: boolean;
  sort_order?: number;
  latitude?: number | string | null;
  longitude?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TreeLocationNode = {
  id: number;
  name: string;
  type: "country" | "region" | "city" | string;
  parent_id?: number | null;
  path?: string | null;
  depth?: number | null;
  country_code?: string | null;
  flag_emoji?: string | null;
};

export type TreeLocationNodeDetail = TreeLocationNode & {
  full_path_name?: string;
  ancestors?: TreeLocationNode[];
};

export async function apiLocationCountries(
  token: string
): Promise<ApiSuccessEnvelope<LocationCountryRow[]>> {
  return apiFetchJson("/locations/countries", { method: "GET", token });
}

export async function apiLocationCountryCreate(
  token: string,
  body: {
    name: string;
    code: string;
    flag_emoji?: string | null;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<ApiSuccessEnvelope<LocationCountryRow> & { message?: string }> {
  return apiFetchJson("/locations/countries", { method: "POST", token, body });
}

export async function apiLocationCountryUpdate(
  token: string,
  body: {
    id: number;
    name: string;
    code: string;
    flag_emoji?: string | null;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<ApiSuccessEnvelope<LocationCountryRow> & { message?: string }> {
  return apiFetchJson("/locations/countries", {
    method: "POST",
    token,
    body: { action: "update", ...body },
  });
}

export async function apiLocationCountryDelete(
  token: string,
  id: number
): Promise<{ success: true; message?: string }> {
  return apiFetchJson("/locations/countries", {
    method: "POST",
    token,
    body: { action: "delete", id },
  });
}

export async function apiLocationRegions(
  token: string,
  countryId: number
): Promise<ApiSuccessEnvelope<LocationRegionRow[]>> {
  return apiFetchJson(`/locations/countries/${countryId}/regions`, { method: "GET", token });
}

export async function apiLocationRegionCreate(
  token: string,
  body: {
    country_id: number;
    name: string;
    code?: string | null;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<ApiSuccessEnvelope<LocationRegionRow> & { message?: string }> {
  return apiFetchJson("/locations/regions", { method: "POST", token, body });
}

export async function apiLocationRegionUpdate(
  token: string,
  body: {
    id: number;
    name: string;
    code?: string | null;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<ApiSuccessEnvelope<LocationRegionRow> & { message?: string }> {
  return apiFetchJson("/locations/regions", {
    method: "POST",
    token,
    body: { action: "update", ...body },
  });
}

export async function apiLocationRegionDelete(
  token: string,
  id: number
): Promise<{ success: true; message?: string }> {
  return apiFetchJson("/locations/regions", {
    method: "POST",
    token,
    body: { action: "delete", id },
  });
}

export async function apiLocationCities(
  token: string,
  regionId: number
): Promise<ApiSuccessEnvelope<LocationCityRow[]>> {
  return apiFetchJson(`/locations/regions/${regionId}/cities`, { method: "GET", token });
}

export async function apiLocationCityCreate(
  token: string,
  body: {
    region_id: number;
    country_id?: number | null;
    name: string;
    is_active?: boolean;
    sort_order?: number;
    latitude?: number | null;
    longitude?: number | null;
  }
): Promise<ApiSuccessEnvelope<LocationCityRow> & { message?: string }> {
  return apiFetchJson("/locations/cities", { method: "POST", token, body });
}

export async function apiLocationCityUpdate(
  token: string,
  body: {
    id: number;
    name: string;
    is_active?: boolean;
    sort_order?: number;
    latitude?: number | null;
    longitude?: number | null;
  }
): Promise<ApiSuccessEnvelope<LocationCityRow> & { message?: string }> {
  return apiFetchJson("/locations/cities", {
    method: "POST",
    token,
    body: { action: "update", ...body },
  });
}

export async function apiLocationCityDelete(
  token: string,
  id: number
): Promise<{ success: true; message?: string }> {
  return apiFetchJson("/locations/cities", {
    method: "POST",
    token,
    body: { action: "delete", id },
  });
}

export async function apiTreeLocationChildren(
  token: string,
  parentId?: number | null
): Promise<ApiSuccessEnvelope<TreeLocationNode[]>> {
  const search = new URLSearchParams();
  if (parentId != null) search.set("parent_id", String(parentId));
  const qs = search.toString();
  return apiFetchJson(`/locations/tree/children${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiTreeLocationNode(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<TreeLocationNodeDetail>> {
  return apiFetchJson(`/locations/tree/node/${id}`, { method: "GET", token });
}
