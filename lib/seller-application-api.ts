/**
 * Operator-facing seller-application API client — P0-3 "Seller Status".
 *
 * A company (operator/agent) applies to sell a service type; each application
 * carries a status. The backend is already complete:
 *
 *   GET  /companies/{id}/seller-applications
 *        → the company's own applications (one row max per service type).
 *
 *   POST /companies/{id}/seller-applications  { service_type }
 *        → submit (or re-open a rejected) application for one service type.
 *          On admin approval the backend auto-creates a CompanySellerPermission
 *          (the activated service) and flips company.is_seller.
 *
 * Mirrors the shape/style of stripe-connect-api.ts.
 */

import { apiFetchJson, ApiRequestError } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

/** Service types a company can sell — matches CompanySellerPermission::SERVICE_TYPES. */
export const SELLER_SERVICE_TYPES = [
  "hotel",
  "flight",
  "car",
  "transfer",
  "excursion",
  "package",
  "visa",
] as const;

export type SellerServiceType = (typeof SELLER_SERVICE_TYPES)[number];

export type SellerApplicationStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected";

export type SellerApplication = {
  id: number;
  service_type: string;
  status: SellerApplicationStatus;
  rejection_reason: string | null;
  applied_at: string | null;
  reviewed_at: string | null;
};

function normalize(row: Partial<SellerApplication> & Record<string, unknown>): SellerApplication {
  return {
    id: Number(row.id ?? 0),
    service_type: String(row.service_type ?? ""),
    status: (row.status as SellerApplicationStatus) ?? "pending",
    rejection_reason: (row.rejection_reason as string | null) ?? null,
    applied_at: (row.applied_at as string | null) ?? null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
  };
}

/** GET the company's own seller applications. */
export async function apiListOwnSellerApplications(
  token: string,
  companyId: number
): Promise<SellerApplication[]> {
  const res = await apiFetchJson<ApiSuccessEnvelope<unknown>>(
    `/companies/${companyId}/seller-applications`,
    { method: "GET", token }
  );
  const data = Array.isArray(res.data) ? res.data : [];
  return data.map((row) => normalize(row as Record<string, unknown>));
}

/** POST a new seller application for one service type. */
export async function apiSubmitSellerApplication(
  token: string,
  companyId: number,
  serviceType: SellerServiceType
): Promise<SellerApplication> {
  const res = await apiFetchJson<ApiSuccessEnvelope<{ application?: unknown }>>(
    `/companies/${companyId}/seller-applications`,
    { method: "POST", token, body: { service_type: serviceType } }
  );
  const app = (res.data?.application ?? {}) as Record<string, unknown>;
  return normalize(app);
}

/** Translate an ApiRequestError into one user-facing message (mirrors stripe-connect-api). */
export function extractSellerApplicationError(e: unknown, fallback: string): string {
  if (e instanceof ApiRequestError) {
    const body = e.body as
      | { errors?: Record<string, string[]>; message?: string; detail?: string }
      | undefined;
    const errs = body?.errors;
    if (errs) {
      const first = Object.values(errs).find(
        (arr): arr is string[] => Array.isArray(arr) && arr.length > 0
      );
      if (first?.[0]) return first[0];
    }
    return body?.detail || body?.message || (e instanceof Error ? e.message : fallback);
  }
  return fallback;
}
