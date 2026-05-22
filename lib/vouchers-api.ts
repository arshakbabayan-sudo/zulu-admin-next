/**
 * Phase 8.5 — typed API client for platform-admin voucher endpoints.
 * Replaces the raw fetch() calls in /platform/vouchers/page.tsx with the
 * project-standard apiFetchJson client (auth header injection, error
 * wrapping via ApiRequestError, JSON parsing).
 */

import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";

export type VoucherRow = {
  id: number;
  voucher_number: string;
  order_id: number | null;
  service_type: string;
  status: string;
  holder_name: string;
  language: string;
  valid_from: string | null;
  valid_to: string | null;
  used_at: string | null;
  verification_count: number;
  pdf_url: string | null;
  qr_image_url: string | null;
  reissued_from_id: number | null;
  created_at: string;
  order?: { id: number; order_number: string; user_id: number };
  issuer_company?: { id: number; name: string };
};

export type VerificationLogRow = {
  id: number;
  voucher_id: number;
  verified_at: string;
  verifier_ip: string | null;
  result: string;
};

export type VoucherDetailResponse = {
  voucher: VoucherRow;
  verification_logs: VerificationLogRow[];
};

export async function apiListVouchers(
  token: string,
  params: { page?: number; per_page?: number; status?: string; service_type?: string; q?: string }
): Promise<ApiSuccessEnvelope<VoucherRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  if (params.service_type) q.set("service_type", params.service_type);
  if (params.q) q.set("q", params.q);
  const qs = q.toString();
  return apiFetchJson(`/platform-admin/vouchers${qs ? `?${qs}` : ""}`, {
    method: "GET",
    token,
  });
}

export async function apiVoucherDetail(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<VoucherDetailResponse>> {
  return apiFetchJson(`/platform-admin/vouchers/${id}`, { method: "GET", token });
}

export async function apiVoidVoucher(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<VoucherRow>> {
  return apiFetchJson(`/platform-admin/vouchers/${id}/void`, {
    method: "POST",
    token,
    body: {},
  });
}

export async function apiReissueVoucher(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<VoucherRow>> {
  return apiFetchJson(`/platform-admin/vouchers/${id}/reissue`, {
    method: "POST",
    token,
    body: {},
  });
}
