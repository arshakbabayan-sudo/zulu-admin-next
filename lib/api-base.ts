const DEFAULT_API = "http://127.0.0.1:8008/api";

/** Laravel JSON API base including `/api`. */
export function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API;
}

/** Origin for `/storage/...` URLs returned by the API (strip trailing `/api`). */
export function getApiPublicOrigin(): string {
  const base = getApiBaseUrl().replace(/\/$/, "");
  return base.replace(/\/api$/i, "") || base;
}
