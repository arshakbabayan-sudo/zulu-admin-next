import { apiFetchJson } from "./api-client";
import type { ApiListMeta } from "./api-envelope";

export type OperatorInventorySegment =
  | "flights"
  | "hotels"
  | "transfers"
  | "cars"
  | "excursions";

type OperatorInventoryListResponse = {
  success: true;
  data: unknown[];
  meta: ApiListMeta;
};

function buildQuery(
  page: number,
  perPage: number,
  extra: Record<string, string | number | boolean | undefined>
): string {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", String(perPage));
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined || v === "") continue;
    q.set(k, String(v));
  }
  return q.toString();
}

/**
 * GET /api/operator/inventory/{segment} — paginated; same RBAC as Blade admin/inventory (per-resource *.view).
 *
 * Contract: each element of `data` is a **module list row** for that segment. If the API embeds `offer`, it is
 * summary-only (`ModuleRowOfferSummary` in `./inventory-crud-api.ts`) — shallow display context, not module detail.
 * Do not call offer endpoints to hydrate module edit/detail; use the segment’s resource GET by id.
 */
export async function apiOperatorInventoryList(
  token: string,
  segment: OperatorInventorySegment,
  page: number,
  extraQuery: Record<string, string | number | boolean | undefined> = {},
  perPage = 20
): Promise<{ data: unknown[]; meta: ApiListMeta }> {
  const qs = buildQuery(page, perPage, extraQuery);
  const json = await apiFetchJson<OperatorInventoryListResponse>(
    `/operator/inventory/${segment}?${qs}`,
    { token, method: "GET" }
  );
  return { data: json.data, meta: json.meta };
}
