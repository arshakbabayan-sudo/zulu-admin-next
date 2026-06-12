import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

/**
 * CRM → My profile → My agents: per-agent sales aggregation (roadmap §4,
 * 2026-06-12). Backend computes everything over the CALLER's own orders, so
 * the agent company id is safe to pass straight from the connections list.
 * Amounts are grouped by currency — never summed across currencies.
 */

export type MoneyByCurrency = { currency: string; total: number };

export type MyAgentStatsRow = {
  agent_company_id: number;
  agent_name?: string | null;
  sales: number;
  bookings: number;
  revenue: MoneyByCurrency[];
  commission: MoneyByCurrency[];
};

export type MyAgentsStats = {
  agents: MyAgentStatsRow[];
  summary: {
    agents_with_sales: number;
    sales: number;
    bookings: number;
    revenue: MoneyByCurrency[];
  };
};

export async function apiMyAgentsStats(
  token: string,
  companyId?: number | null
): Promise<ApiSuccessEnvelope<MyAgentsStats>> {
  const q = companyId != null && companyId > 0 ? `?company_id=${companyId}` : "";
  return apiFetchJson(`/platform-admin/crm/my-agents/stats${q}`, { method: "GET", token });
}

export type MyAgentOrderRow = {
  id: string;
  order_number: string;
  date: string | null;
  customer: { id: number; name: string; email: string } | null;
  services: { type: string; count: number }[];
  total: number;
  currency: string;
  status: string;
};

export type MyAgentDetailStats = {
  sales: number;
  bookings: number;
  revenue: MoneyByCurrency[];
  commission: MoneyByCurrency[];
  destinations: { name: string; bookings: number }[];
  services: { type: string; bookings: number }[];
  orders: MyAgentOrderRow[];
};

export async function apiMyAgentStatsDetail(
  token: string,
  agentCompanyId: number,
  companyId?: number | null
): Promise<ApiSuccessEnvelope<MyAgentDetailStats>> {
  const q = companyId != null && companyId > 0 ? `?company_id=${companyId}` : "";
  return apiFetchJson(`/platform-admin/crm/my-agents/${agentCompanyId}/stats${q}`, {
    method: "GET",
    token,
  });
}
