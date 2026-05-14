import { getApiBaseUrl } from "./api-base";
import { isApiError, type ApiErrorEnvelope } from "./api-envelope";
import { ZULU_LANG_KEY } from "./zulu-lang";

function readLangForRequest(): string {
  const def = "en";
  if (typeof window !== "undefined") {
    try {
      const ls = window.localStorage.getItem(ZULU_LANG_KEY);
      if (ls && /^[a-z]{2}(-[a-z]{2})?$/i.test(ls.trim())) {
        return ls.trim().toLowerCase();
      }
    } catch {
      // ignore
    }
    try {
      const match = document.cookie.match(
        new RegExp(`(?:^|;\\s*)${ZULU_LANG_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
      );
      const fromCookie = match?.[1] ? decodeURIComponent(match[1].trim()) : "";
      if (fromCookie && /^[a-z]{2}(-[a-z]{2})?$/i.test(fromCookie)) {
        return fromCookie.toLowerCase();
      }
    } catch {
      // ignore
    }
    return def;
  }
  // Server-side: avoid importing `next/headers` here (this module is bundled for the client).
  return def;
}

function appendLangQuery(url: string, lang: string): string {
  if (url.includes("lang=")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}lang=${encodeURIComponent(lang)}`;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: ApiErrorEnvelope
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type FetchJsonOpts = Omit<RequestInit, "body"> & {
  token?: string | null;
  body?: object | FormData | null;
};

export async function apiFetchJson<T>(
  path: string,
  opts: FetchJsonOpts = {}
): Promise<T> {
  const { body: rawBody, token: tokenOpt, ...rest } = opts;
  const base = getApiBaseUrl().replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(opts.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (tokenOpt) headers.set("Authorization", `Bearer ${tokenOpt}`);
  if (rawBody !== undefined && rawBody !== null && !(rawBody instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const body =
    rawBody === undefined || rawBody === null
      ? undefined
      : rawBody instanceof FormData
        ? rawBody
        : JSON.stringify(rawBody);

  const lang = readLangForRequest();
  const urlWithLang = appendLangQuery(url, lang);
  const res = await fetch(urlWithLang, { ...rest, headers, body });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiRequestError(text || res.statusText, res.status);
  }

  if (!res.ok) {
    // Surface field-level validation reasons rather than the generic
    // "Validation failed" Laravel uses for 422. This unblocks admin operators
    // who need to know *which* rule failed (e.g. "A user with this business
    // email already exists.") — caught 2026-05-15 when approving Letour
    // application returned a generic 'Validation failed' modal.
    let msg: string = `HTTP ${res.status}`;
    if (isApiError(json)) {
      msg = json.message ?? msg;
      const errors = (json as { errors?: Record<string, string[] | string> }).errors;
      if (errors && typeof errors === "object") {
        const firstFieldMsg = Object.values(errors)
          .map((v) => (Array.isArray(v) ? v[0] : v))
          .find((v) => typeof v === "string" && v.length > 0);
        if (firstFieldMsg && (msg === "Validation failed" || !msg)) {
          msg = String(firstFieldMsg);
        } else if (firstFieldMsg && msg !== firstFieldMsg) {
          msg = `${msg}: ${firstFieldMsg}`;
        }
      }
    }
    throw new ApiRequestError(msg, res.status, isApiError(json) ? json : undefined);
  }

  return json as T;
}
