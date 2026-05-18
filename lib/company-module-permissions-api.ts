/**
 * Phase 6A — Company module permission API client.
 * Backend: AdminCompanyController @ /platform-admin/companies/{id}/module-permissions.
 *
 * Module gating works as default-allow: when no row exists the module is
 * visible. Only `is_allowed=false` rows hide a module from the operator's
 * sidebar (enforcement lives in AdminShell — Phase 6A part 2).
 */
import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export type CompanyModulePermissionRow = {
  module_key: string;
  is_allowed: boolean;
  granted_at: string | null;
  notes: string | null;
};

export type CompanyModulePermissionsResponse = {
  company_id: number;
  available_module_keys: string[];
  permissions: CompanyModulePermissionRow[];
};

export type ModulePermissionPatch = {
  module_key: string;
  is_allowed: boolean;
  notes?: string | null;
};

const PA = "/platform-admin";

export async function apiCompanyModulePermissions(
  token: string,
  companyId: number
): Promise<ApiSuccessEnvelope<CompanyModulePermissionsResponse>> {
  return apiFetchJson(`${PA}/companies/${companyId}/module-permissions`, {
    method: "GET",
    token,
  });
}

export async function apiPatchCompanyModulePermissions(
  token: string,
  companyId: number,
  permissions: ModulePermissionPatch[]
): Promise<ApiSuccessEnvelope<CompanyModulePermissionsResponse>> {
  return apiFetchJson(`${PA}/companies/${companyId}/module-permissions`, {
    method: "PATCH",
    token,
    body: { permissions } as Record<string, unknown>,
  });
}

/** Human-readable label for a well-known module key. Falls back to the raw key. */
export function moduleKeyLabel(key: string): string {
  const labels: Record<string, string> = {
    "inventory.hotels": "Hotels",
    "inventory.flights": "Flights",
    "inventory.cars": "Cars",
    "inventory.transfers": "Transfers",
    "inventory.excursions": "Excursions",
    "inventory.visas": "Visas",
    "inventory.packages": "Packages",
    "inventory.offers": "Offers",
    "ops.bookings": "Bookings",
    "ops.finance": "Finance",
    "ops.loyalty": "Loyalty",
    "ops.newsletter": "Newsletter",
    "ops.reviews": "Reviews",
    "ops.vouchers": "Vouchers",
    "ops.connections": "Connections",
    "ops.contracts": "Contracts",
    "ops.statistics": "Statistics",
  };
  return labels[key] ?? key;
}

/** Group module keys by their namespace prefix for a sectioned UI. */
export function groupModuleKeys(keys: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const k of keys) {
    const idx = k.indexOf(".");
    const group = idx > 0 ? k.slice(0, idx) : "other";
    out[group] = out[group] ?? [];
    out[group].push(k);
  }
  return out;
}
