import { apiFetchJson } from "./api-client";
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
 * Ask the backend for the Google OAuth start URL, then the caller navigates the
 * browser to it (`window.location.href = authUrl`).
 *
 * Why fetch instead of navigating straight to `/auth/google-drive/redirect`?
 * That route sits behind `auth:sanctum`, and a full-page browser navigation
 * cannot carry the Bearer header — it would 401. The admin authenticates with a
 * Bearer token (NOT a Laravel session), so the cookie can't stand in for it
 * either. So we fetch the auth URL WITH the Authorization header (`?json=1` →
 * `{ auth_url }`), then redirect. The Sanctum token never travels in the URL /
 * query string / referrer / logs.
 */
export async function apiGoogleDriveAuthUrl(
  token: string,
  companyId: number
): Promise<string> {
  const q = new URLSearchParams({ company_id: String(companyId), json: "1" });
  const res = await apiFetchJson<ApiSuccessEnvelope<{ auth_url: string }>>(
    `/auth/google-drive/redirect?${q.toString()}`,
    { method: "GET", token }
  );
  return res.data.auth_url;
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
