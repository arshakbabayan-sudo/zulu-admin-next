import { getApiBaseUrl } from "./api-base";
import { isApiError, type ApiErrorEnvelope } from "./api-envelope";

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

  const res = await fetch(url, { ...rest, headers, body });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiRequestError(text || res.statusText, res.status);
  }

  if (!res.ok) {
    const msg = isApiError(json) ? json.message : `HTTP ${res.status}`;
    throw new ApiRequestError(msg, res.status, isApiError(json) ? json : undefined);
  }

  return json as T;
}
