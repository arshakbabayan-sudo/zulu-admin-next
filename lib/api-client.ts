import { getApiBaseUrl } from "./api-base";
import { isApiError, type ApiErrorEnvelope } from "./api-envelope";
import { ZULU_CONTENT_LANG_KEY, ZULU_LANG_KEY } from "./zulu-lang";

function readStoredLang(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const ls = window.localStorage.getItem(key);
    if (ls && /^[a-z]{2}(-[a-z]{2})?$/i.test(ls.trim())) {
      return ls.trim().toLowerCase();
    }
  } catch {
    // ignore
  }
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
    );
    const fromCookie = match?.[1] ? decodeURIComponent(match[1].trim()) : "";
    if (fromCookie && /^[a-z]{2}(-[a-z]{2})?$/i.test(fromCookie)) {
      return fromCookie.toLowerCase();
    }
  } catch {
    // ignore
  }
  return null;
}

function readLangForRequest(): string {
  return readStoredLang(ZULU_LANG_KEY) ?? "en";
}

function readContentLangForRequest(): string {
  return readStoredLang(ZULU_CONTENT_LANG_KEY) ?? readLangForRequest();
}

/**
 * Endpoints that translate the admin chrome (button labels, sidebar text, etc.)
 * — these always use the UI language. Everything else (catalog fetches like
 * /hotels, /excursions, /transfers, etc.) uses the content preview language.
 *
 * This separation lets admins keep their UI in their preferred language while
 * previewing how customer-facing content looks in a different language.
 */
function isUiStringsEndpoint(url: string): boolean {
  return (
    url.includes("/localization/ui-translations") ||
    url.includes("/localization/languages")
  );
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

  const lang = isUiStringsEndpoint(url) ? readLangForRequest() : readContentLangForRequest();
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

/**
 * Fetch a binary response (PDF, CSV, XLSX) and trigger a browser download.
 * Used for payslip PDFs and bank-batch CSV exports — endpoints that return
 * a file rather than JSON. Reuses the same auth headers and base URL.
 */
export async function apiDownloadFile(
  path: string,
  filename: string,
  opts: { token?: string | null; method?: string } = {}
): Promise<void> {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers();
  if (opts.token) headers.set("Authorization", `Bearer ${opts.token}`);

  const res = await fetch(url, { method: opts.method ?? "GET", headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiRequestError(text || `HTTP ${res.status}`, res.status);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}
