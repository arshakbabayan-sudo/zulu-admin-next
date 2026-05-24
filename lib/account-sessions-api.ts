/**
 * Account sessions + change-password API client.
 *
 * Backend:
 *   GET    /api/account/sessions        — list user's Sanctum personal access tokens
 *   DELETE /api/account/sessions/{id}   — revoke a token (cannot revoke current)
 *   POST   /api/account/change-password — rotate password, revoke other sessions
 */
import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export type AccountSession = {
  id: number;
  name: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  is_current: boolean;
};

export async function apiListAccountSessions(
  token: string
): Promise<ApiSuccessEnvelope<AccountSession[]>> {
  return apiFetchJson(`/account/sessions`, { method: "GET", token });
}

export async function apiRevokeAccountSession(
  token: string,
  sessionId: number
): Promise<ApiSuccessEnvelope<{ revoked_id: number }>> {
  return apiFetchJson(`/account/sessions/${sessionId}`, {
    method: "DELETE",
    token,
  });
}

export async function apiChangePassword(
  token: string,
  body: {
    current_password: string;
    new_password: string;
    new_password_confirmation: string;
  }
): Promise<ApiSuccessEnvelope<{ revoked_other_sessions: number }>> {
  return apiFetchJson(`/account/change-password`, {
    method: "POST",
    token,
    body,
  });
}
