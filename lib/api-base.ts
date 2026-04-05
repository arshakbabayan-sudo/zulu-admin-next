/** Direct Laravel API base (SSR / server fetch; Node cannot use relative URLs). */
const DEFAULT_SERVER_API = "http://127.0.0.1:8008/api";
/**
 * Browser default: Next.js rewrites `/api/proxy/*` → Laravel `/api/*` (see `next.config.mjs`).
 * Same-origin avoids CORS / Private Network Access issues when the app is opened as `localhost`
 * but the API was configured as `127.0.0.1`.
 */
const DEFAULT_BROWSER_API = "/api/proxy";

/** Laravel JSON API base including `/api` (or `/api/proxy` when using the dev rewrite). */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === "undefined") {
    if (fromEnv && fromEnv.startsWith("/")) {
      return process.env.API_URL ?? DEFAULT_SERVER_API;
    }
    return process.env.API_URL ?? fromEnv ?? DEFAULT_SERVER_API;
  }
  return fromEnv ?? DEFAULT_BROWSER_API;
}

/** Origin for `/storage/...` URLs returned by the API (Laravel public origin, not the Next proxy). */
export function getApiPublicOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_LARAVEL_ORIGIN?.replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }
  const base = getApiBaseUrl().replace(/\/$/, "");
  if (base.startsWith("/")) {
    return DEFAULT_SERVER_API.replace(/\/api$/i, "");
  }
  return base.replace(/\/api(\/proxy)?$/i, "") || base;
}
