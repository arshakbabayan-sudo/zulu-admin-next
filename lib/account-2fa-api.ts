/**
 * Admin two-factor authentication (2FA) API client.
 *
 * Phase 3A (2026-05-31) — added so admin users can manage their own 2FA
 * from the Profile → Security tab. Previously this only existed on the
 * customer site (zulu.am/account/security) and admin users had to leave
 * admin and visit zulu.am to enable / disable / pick channel — an audit
 * finding (handoff doc 2026-05-31 finding A).
 *
 * Backend endpoints (Laravel API at api.zulu.am):
 *   GET   /api/account/2fa/status   — { enabled, method, required }
 *   POST  /api/account/2fa/setup    — begin TOTP enrolment, returns
 *                                     { secret, qr_url, recovery_codes }
 *   POST  /api/account/2fa/confirm  — submit 6-digit code to finish setup
 *   PUT   /api/account/2fa/method   — pick channel ('totp' | 'email')
 *   POST  /api/account/2fa/disable  — password-confirmed disable
 *
 * Mirrors the customer-side helpers in
 * zulu-frontend-next/lib/account-api.ts (the four / five functions that
 * start with `fetchTwoFactor`, `setupTwoFactor`, `confirmTwoFactor`,
 * `setTwoFactorMethod`, `disableTwoFactor`). Admin uses apiFetchJson
 * (its standard envelope-aware client) instead of raw fetch.
 */

import { apiFetchJson, ApiRequestError } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export type TwoFactorMethod = "totp" | "email";

export type TwoFactorStatus = {
  enabled: boolean;
  method: TwoFactorMethod;
  required: boolean;
};

export type TwoFactorSetup = {
  /** Base32 TOTP secret — shown to the user once for manual entry. */
  secret: string;
  /** otpauth:// URI for QR rendering (e.g. via qrcode.react). */
  qr_url: string;
  /** 8 single-use recovery codes — shown to the user once. */
  recovery_codes: string[];
};

/** GET current 2FA state for the signed-in admin user. */
export async function apiTwoFactorStatus(token: string): Promise<TwoFactorStatus> {
  try {
    const res = await apiFetchJson<ApiSuccessEnvelope<TwoFactorStatus>>(
      `/account/2fa/status`,
      { method: "GET", token }
    );
    return {
      enabled: Boolean(res.data?.enabled),
      method: (res.data?.method ?? "email") as TwoFactorMethod,
      required: Boolean(res.data?.required),
    };
  } catch {
    // 2FA backend not yet seeded for this user — assume disabled / email.
    return { enabled: false, method: "email", required: false };
  }
}

/**
 * Begin TOTP enrolment. Returns the secret + QR URI + 8 recovery codes.
 * The codes are only shown once — the UI must store them in the user's
 * clipboard or download immediately.
 */
export async function apiTwoFactorSetup(
  token: string
): Promise<ApiSuccessEnvelope<TwoFactorSetup>> {
  return apiFetchJson(`/account/2fa/setup`, { method: "POST", token });
}

/**
 * Finish TOTP enrolment by submitting a current authenticator code.
 * On success, `enabled` flips to true and the user's next sign-in will
 * require a code.
 */
export async function apiTwoFactorConfirm(
  token: string,
  code: string
): Promise<ApiSuccessEnvelope<{ enabled: true }>> {
  return apiFetchJson(`/account/2fa/confirm`, {
    method: "POST",
    token,
    body: { code },
  });
}

/**
 * Pick the 2FA channel: 'totp' (Google Authenticator app) or 'email'
 * (a fresh 6-digit code sent at sign-in). Switching channels does NOT
 * erase the TOTP secret — the user can flip back later.
 */
export async function apiTwoFactorSetMethod(
  token: string,
  method: TwoFactorMethod
): Promise<ApiSuccessEnvelope<{ two_factor_method: TwoFactorMethod }>> {
  return apiFetchJson(`/account/2fa/method`, {
    method: "PUT",
    token,
    body: { method },
  });
}

/**
 * Disable 2FA. Backend requires the account password to confirm intent
 * (prevents drive-by disabling from a stolen short-lived session).
 *
 * Hidden in the UI when `two_factor_required=true` for the user (their
 * manager has enforced 2FA — they cannot self-disable).
 */
export async function apiTwoFactorDisable(
  token: string,
  password: string
): Promise<ApiSuccessEnvelope<{ enabled: false }>> {
  return apiFetchJson(`/account/2fa/disable`, {
    method: "POST",
    token,
    body: { password },
  });
}

/**
 * Convenience: extract a user-facing error message from an
 * ApiRequestError (handles Laravel validation envelope + plain message).
 */
export function extractTwoFactorError(e: unknown, fallback: string): string {
  if (e instanceof ApiRequestError) {
    // Laravel validation envelope: { errors: { code: ["…"] } } lives on .body
    const errs = (e.body as { errors?: Record<string, string[]> } | undefined)?.errors;
    if (errs) {
      const first = Object.values(errs).find(
        (arr): arr is string[] => Array.isArray(arr) && arr.length > 0
      );
      if (first?.[0]) return first[0];
    }
    return e.message || fallback;
  }
  return fallback;
}
