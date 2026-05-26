/**
 * Marketplace ops group v2 — stats endpoint clients.
 *
 * One helper per stat card row (Approvals / Companies / Seller applications /
 * Contracts / Contract templates / Audit logs / Unverified accounts). Each
 * backend endpoint is platform-admin gated and cached 60s server-side.
 *
 * Backend: app/Http/Controllers/Api/MarketplaceStatsController.php
 */

import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export type ApprovalsStats = {
  company_apps: number;
  seller_apps: number;
  offers_pending: number;
  reviews_pending: number;
  new_today_company: number;
  new_today_seller: number;
  new_today_offer: number;
  new_today_review: number;
  total_pending: number;
};

export type CompaniesStats = {
  total: number;
  active: number;
  sellers: number;
  archived: number;
};

export type SellerApplicationsStats = {
  pending: number;
  approved: number;
  rejected: number;
  avg_review_hours: number | null;
};

export type ContractsStats = {
  total: number;
  signed: number;
  drafts: number;
  expiring_30d: number;
};

export type ContractTemplatesStats = {
  total: number;
  published: number;
  drafts: number;
  contracts_created: number;
};

export type AuditLogsStats = {
  total: number;
  active_admins: number;
  suspicious: number;
  failed: number;
};

export type UnverifiedAccountsStats = {
  total: number;
  no_email: number;
  no_phone: number;
  old_7d: number;
};

export type AuditLogsRange = "7d" | "30d" | "90d";

export async function apiApprovalsStats(token: string): Promise<ApiSuccessEnvelope<ApprovalsStats>> {
  return apiFetchJson("/platform-admin/approvals/stats", { method: "GET", token });
}

export async function apiCompaniesStats(token: string): Promise<ApiSuccessEnvelope<CompaniesStats>> {
  return apiFetchJson("/platform-admin/companies/stats", { method: "GET", token });
}

export async function apiSellerApplicationsStats(
  token: string,
): Promise<ApiSuccessEnvelope<SellerApplicationsStats>> {
  return apiFetchJson("/platform-admin/seller-applications/stats", { method: "GET", token });
}

export async function apiContractsStats(token: string): Promise<ApiSuccessEnvelope<ContractsStats>> {
  return apiFetchJson("/platform-admin/contracts/stats", { method: "GET", token });
}

export async function apiContractTemplatesStats(
  token: string,
): Promise<ApiSuccessEnvelope<ContractTemplatesStats>> {
  return apiFetchJson("/platform-admin/contract-templates/stats", { method: "GET", token });
}

export async function apiAuditLogsStats(
  token: string,
  range: AuditLogsRange = "30d",
): Promise<ApiSuccessEnvelope<AuditLogsStats>> {
  return apiFetchJson(`/platform-admin/audit-logs/stats?range=${range}`, { method: "GET", token });
}

export async function apiUnverifiedAccountsStats(
  token: string,
): Promise<ApiSuccessEnvelope<UnverifiedAccountsStats>> {
  return apiFetchJson("/platform-admin/unverified-accounts/stats", { method: "GET", token });
}
