/**
 * Admin Stripe Connect (Express) API client — P0-1 step 1.1 (2026-06-01).
 *
 * Companies (operators + agents) connect their own Stripe Express account
 * so the platform can route their share of each booking via a transfer
 * (step 1.2 splits the application_fee). The two endpoints below cover
 * the onboarding lifecycle:
 *
 *   GET  /companies/{id}/stripe-connect/status
 *        → returns connection state. Side effect: server calls Stripe
 *          accounts.retrieve to refresh the booleans, so the card "wakes
 *          up" when the user finishes Express onboarding in another tab.
 *
 *   POST /companies/{id}/stripe-connect/onboarding-link
 *        → creates the Stripe Account if missing, then a fresh
 *          AccountLink (single-use, short-lived). UI redirects the
 *          browser to data.url; Stripe sends the user back to return_url
 *          on completion (or refresh_url if the link expires mid-flow).
 *
 * Both host URLs MUST be in the backend's allowed_frontend_hosts (set in
 * services.oauth.allowed_frontend_hosts) — backend rejects others as 422.
 */

import { apiFetchJson, ApiRequestError } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export type StripeConnectStatus = {
  /** True iff the company has a Stripe Account id stored. */
  connected: boolean;
  /** Stripe Account id (acct_…) or null before first onboarding. */
  stripe_account_id: string | null;
  /** Stripe says this account can accept charges. */
  charges_enabled: boolean;
  /** Stripe says payouts to the connected bank are unlocked. */
  payouts_enabled: boolean;
  /** User finished the Express onboarding form; may still be in review. */
  details_submitted: boolean;
  /** Both charges + payouts enabled — ready to receive transfers. */
  ready: boolean;
  /** Non-null when status sync hit a Stripe error (e.g. revoked account). */
  sync_error: string | null;
};

export type StripeConnectOnboardingLink = {
  /** Single-use Stripe-hosted Express onboarding URL. Redirect here. */
  url: string;
  /** Unix epoch (seconds) when the link expires. Typically ~10 min. */
  expires_at: number | null;
  /** Stripe Account id (acct_…) — populated even on first call. */
  stripe_account_id: string | null;
};

/** GET status for a given company. Free of side effects on the UI side. */
export async function apiStripeConnectStatus(
  token: string,
  companyId: number
): Promise<StripeConnectStatus> {
  const res = await apiFetchJson<ApiSuccessEnvelope<StripeConnectStatus>>(
    `/companies/${companyId}/stripe-connect/status`,
    { method: "GET", token }
  );
  const d = res.data ?? ({} as Partial<StripeConnectStatus>);
  return {
    connected: Boolean(d.connected),
    stripe_account_id: d.stripe_account_id ?? null,
    charges_enabled: Boolean(d.charges_enabled),
    payouts_enabled: Boolean(d.payouts_enabled),
    details_submitted: Boolean(d.details_submitted),
    ready: Boolean(d.ready),
    sync_error: d.sync_error ?? null,
  };
}

/**
 * POST onboarding-link. Server creates the Stripe Account on first call,
 * then returns a fresh AccountLink each time. Caller should redirect
 * window.location to the returned `url`.
 */
export async function apiStripeConnectOnboardingLink(
  token: string,
  companyId: number,
  returnUrl: string,
  refreshUrl: string
): Promise<StripeConnectOnboardingLink> {
  const res = await apiFetchJson<ApiSuccessEnvelope<StripeConnectOnboardingLink>>(
    `/companies/${companyId}/stripe-connect/onboarding-link`,
    {
      method: "POST",
      token,
      body: { return_url: returnUrl, refresh_url: refreshUrl },
    }
  );
  const d = res.data ?? ({} as Partial<StripeConnectOnboardingLink>);
  return {
    url: d.url ?? "",
    expires_at: d.expires_at ?? null,
    stripe_account_id: d.stripe_account_id ?? null,
  };
}

/**
 * Translate an ApiRequestError into a single user-facing message. Mirrors
 * extractTwoFactorError() in account-2fa-api.ts so the calling component
 * doesn't need to know about Laravel's validation envelope shape.
 */
export function extractStripeConnectError(e: unknown, fallback: string): string {
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
    return body?.detail || body?.message || e.message || fallback;
  }
  return fallback;
}
