import type { AdminUser } from "./auth-types";
import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export type LoginSuccess = ApiSuccessEnvelope<{ token: string; expires_at?: string; user: AdminUser }>;

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
