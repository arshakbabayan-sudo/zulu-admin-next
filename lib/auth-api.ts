import type { AdminUser } from "./auth-types";
import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

/**
 * Backend `/api/login` returns one of two payload shapes depending on whether
 * the account has confirmed two-factor auth:
 *
 *   - 2FA OFF → `{ token, expires_at?, user }` (immediate session)
 *   - 2FA ON  → `{ requires_2fa: true, challenge_token }` (caller must POST
 *     `/account/2fa/verify` with the 6-digit code to receive the real session)
 *
 * Frontend mirrors this in `contexts/AuthContext.tsx`. Admin's previous
 * single-shape type silently dropped the 2FA branch — 2FA-enabled users
 * appeared to fail login because the code stored `undefined` as the token.
 */
export type LoginResponseData =
  | { token: string; expires_at?: string; user: AdminUser }
  | { requires_2fa: true; challenge_token: string };

export type LoginSuccess = ApiSuccessEnvelope<LoginResponseData>;

export async function apiLogin(
  email: string,
  password: string,
  rememberMe: boolean = false
): Promise<LoginSuccess> {
  return apiFetchJson<LoginSuccess>("/login", {
    method: "POST",
    body: { email, password, remember_me: rememberMe },
  });
}

/**
 * Exchange a 2FA challenge token + 6-digit code for a real session token.
 * `challengeToken` is the short-lived token returned by `/api/login` when the
 * user has 2FA on; backend rejects anything else (token must carry the
 * `2fa:challenge` ability, not `*`).
 */
export async function apiVerify2fa(
  challengeToken: string,
  code: string
): Promise<ApiSuccessEnvelope<{ token: string }>> {
  return apiFetchJson<ApiSuccessEnvelope<{ token: string }>>("/account/2fa/verify", {
    method: "POST",
    token: challengeToken,
    body: { code },
  });
}

export async function apiResend2faCode(
  challengeToken: string
): Promise<ApiSuccessEnvelope<unknown>> {
  return apiFetchJson<ApiSuccessEnvelope<unknown>>("/account/2fa/resend", {
    method: "POST",
    token: challengeToken,
    body: {},
  });
}

export async function apiLogout(token: string): Promise<ApiSuccessEnvelope<null>> {
  return apiFetchJson<ApiSuccessEnvelope<null>>("/logout", {
    method: "POST",
    token,
    body: {},
  });
}

export async function apiMe(token: string): Promise<ApiSuccessEnvelope<AdminUser>> {
  return apiFetchJson<ApiSuccessEnvelope<AdminUser>>("/account/me", {
    method: "GET",
    token,
  });
}
