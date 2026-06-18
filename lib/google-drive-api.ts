import { apiFetchJson } from "./api-client";
import { getApiBaseUrl } from "./api-base";
import type { ApiSuccessEnvelope } from "./api-envelope";

/**
 * Google Drive multi-tenant connection — backend routes live at the `/api`
 * ROOT (under `auth:sanctum`), NOT under `/platform-admin`. A company connects
 * its own Drive once via Google OAuth; uploads then land in that company's
 * Drive.
 *
 * The status payload shape is intentionally loose — the backend may key the
 * connected flag / email under a few names. The page reads it defensively via
 * `isDriveConnected()` / `driveConnectedEmail()` below.
 */
export type GoogleDriveStatus = {
  connected?: boolean;
  is_connected?: boolean;
  status?: string | null;
  connected_email?: string | null;
  email?: string | null;
  google_email?: string | null;
  connected_at?: string | null;
  folder_id?: string | null;
} & Record<string, unknown>;

export async function apiGoogleDriveStatus(
  token: string,
  companyId: number
): Promise<ApiSuccessEnvelope<GoogleDriveStatus>> {
  return apiFetchJson(`/companies/${companyId}/google-drive/status`, {
    method: "GET",
    token,
  });
}

export async function apiGoogleDriveDisconnect(
  token: string,
  companyId: number
): Promise<ApiSuccessEnvelope<unknown>> {
  return apiFetchJson(`/companies/${companyId}/google-drive`, {
    method: "DELETE",
    token,
  });
}

/**
 * Build the OAuth-start URL the browser navigates to (full-page redirect).
 *
 * Auth: `/auth/google-drive/redirect` is a 302 endpoint reached by a full-page
 * `window.location.href` navigation, which carries the shared `.zulu.am`
 * session cookie (same-site, SameSite=Lax) — the same cookie that authenticates
 * the rest of the admin. We do NOT put the Sanctum token in the URL (secrets
 * must never travel in query strings / referrers / logs). Only `company_id`.
 */
export function googleDriveRedirectUrl(companyId: number): string {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const q = new URLSearchParams({ company_id: String(companyId) });
  return `${base}/auth/google-drive/redirect?${q.toString()}`;
}

/** Defensive readers — the status payload key may vary by backend version. */
export function isDriveConnected(s: GoogleDriveStatus | null | undefined): boolean {
  if (!s) return false;
  if (s.connected === true || s.is_connected === true) return true;
  if (typeof s.status === "string" && s.status.toLowerCase() === "connected") return true;
  return false;
}

export function driveConnectedEmail(s: GoogleDriveStatus | null | undefined): string | null {
  if (!s) return null;
  return s.connected_email ?? s.email ?? s.google_email ?? null;
}
