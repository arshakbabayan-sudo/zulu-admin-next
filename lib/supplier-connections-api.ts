import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

/**
 * Roadmap §4 — External API supplier connections (operator ↔ external
 * inventory base). Backend: /supplier-connections* in routes/api.php.
 */

export type SupplierConnectionRow = {
  id: number;
  company_id: number;
  company_name: string | null;
  name: string;
  base_url: string;
  login: string;
  status: "untested" | "ok" | "failed";
  last_tested_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  items_imported: number;
  created_at: string | null;
};

export type SupplierImportSummary = {
  ok: boolean;
  created: number;
  updated: number;
  skipped: { external_id: string; type: string; reason: string }[];
  total_seen: number;
  error: string | null;
};

export async function apiSupplierConnections(
  token: string
): Promise<ApiSuccessEnvelope<SupplierConnectionRow[]>> {
  return apiFetchJson(`/supplier-connections`, { method: "GET", token });
}

export async function apiCreateSupplierConnection(
  token: string,
  body: { name?: string; base_url: string; login: string; password: string }
): Promise<ApiSuccessEnvelope<SupplierConnectionRow>> {
  return apiFetchJson(`/supplier-connections`, { method: "POST", token, body });
}

export async function apiTestSupplierConnection(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ ok: boolean; error: string | null; connection: SupplierConnectionRow }>> {
  return apiFetchJson(`/supplier-connections/${id}/test`, { method: "POST", token });
}

export async function apiImportSupplierConnection(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ summary: SupplierImportSummary; connection: SupplierConnectionRow }>> {
  return apiFetchJson(`/supplier-connections/${id}/import`, { method: "POST", token });
}

export async function apiDeleteSupplierConnection(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ deleted_id: number }>> {
  return apiFetchJson(`/supplier-connections/${id}`, { method: "DELETE", token });
}
