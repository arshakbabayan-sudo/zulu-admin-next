/**
 * Finance group v2 — stats endpoint clients.
 *
 * One helper per stat card row (Payments / Invoices / Commissions / Vouchers)
 * plus the extended Finance summary v2. Each backend endpoint:
 *  - Platform-admin gated
 *  - Cached 60s server-side
 *  - Accepts ?range=7d|30d|90d|year (default 30d) where it makes sense
 *
 * Backend: app/Http/Controllers/Api/FinanceStatsController.php
 */

import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export type FinanceRange = "7d" | "30d" | "90d" | "year";

export type PaymentsStats = {
  total_count: number;
  paid_amount: number;
  paid_count: number;
  pending_amount: number;
  pending_count: number;
  failed_amount: number;
  failed_count: number;
};

export type InvoicesStats = {
  total_count: number;
  paid_count: number;
  paid_pct: number;
  issued_pending_count: number;
  overdue_amount: number;
  overdue_count: number;
};

export type CommissionsStats = {
  active_policies_count: number;
  recorded_amount: number;
  pending_amount: number;
  pending_count: number;
  avg_rate_pct: number;
};

export type VouchersStats = {
  total_count: number;
  active_issued_count: number;
  verifications_7d: number;
  voided_count: number;
};

export type FinanceSummaryV2 = {
  total_payments_paid: number;
  total_commission_accrued: number;
  total_commission_pending: number;
  payments_count_paid: number;
  commission_records_count: number;
  currency_breakdown: Record<string, number>;
  commission_split: { platform: number; agent: number };
  pending_meta: { count: number; avg_age_days: number; oldest_days: number };
};

function withRange(base: string, range?: FinanceRange): string {
  return range ? `${base}?range=${range}` : base;
}

export async function apiPaymentsStats(
  token: string,
  range: FinanceRange = "30d"
): Promise<ApiSuccessEnvelope<PaymentsStats>> {
  return apiFetchJson(withRange("/platform-admin/payments/stats", range), { method: "GET", token });
}

export async function apiInvoicesStats(
  token: string,
  range: FinanceRange = "30d"
): Promise<ApiSuccessEnvelope<InvoicesStats>> {
  return apiFetchJson(withRange("/platform-admin/invoices/stats", range), { method: "GET", token });
}

export async function apiCommissionsStats(
  token: string
): Promise<ApiSuccessEnvelope<CommissionsStats>> {
  return apiFetchJson("/platform-admin/commissions/stats", { method: "GET", token });
}

export async function apiVouchersStats(
  token: string,
  range: FinanceRange = "30d"
): Promise<ApiSuccessEnvelope<VouchersStats>> {
  return apiFetchJson(withRange("/platform-admin/vouchers/stats", range), { method: "GET", token });
}

export async function apiFinanceSummaryV2(
  token: string,
  range: FinanceRange = "30d"
): Promise<ApiSuccessEnvelope<FinanceSummaryV2>> {
  return apiFetchJson(withRange("/platform-admin/finance-summary/v2", range), { method: "GET", token });
}

export type RevenueByServiceRow = { service: string; amount: number; pct: number };

export async function apiRevenueByService(
  token: string,
  range: FinanceRange = "30d"
): Promise<ApiSuccessEnvelope<RevenueByServiceRow[]>> {
  return apiFetchJson(withRange("/platform-admin/finance/revenue-by-service", range), { method: "GET", token });
}

export type PaymentMethodsBreakdown = {
  total: number;
  breakdown: Array<{ method: string; amount: number; pct: number }>;
};

export async function apiPaymentMethods(
  token: string,
  range: FinanceRange = "30d"
): Promise<ApiSuccessEnvelope<PaymentMethodsBreakdown>> {
  return apiFetchJson(withRange("/platform-admin/finance/payment-methods", range), { method: "GET", token });
}

export type RecentTransactionType =
  | "payment_in"
  | "commission"
  | "refund"
  | "voucher_issued"
  | "payout";

export type RecentTransactionRow = {
  id: string;
  type: RecentTransactionType;
  amount: number;
  currency: string;
  company: { id: number; name: string } | null;
  when: string;
  status: string;
};

export async function apiRecentTransactions(
  token: string,
  limit: number = 10
): Promise<ApiSuccessEnvelope<RecentTransactionRow[]>> {
  return apiFetchJson(`/platform-admin/finance/recent-transactions?limit=${limit}`, { method: "GET", token });
}

/**
 * Roadmap 10.06 §5 — re-initiate the gateway charge on a FAILED payment.
 * Backend: PaymentController::retry (POST /payments/{id}/retry). Returns the
 * refreshed payment row + the new client_secret; 422 for non-failed payments
 * and non-gateway methods (cash/bank_transfer).
 */
export async function apiRetryPayment(
  token: string,
  paymentId: number
): Promise<{ success: boolean; data: unknown; client_secret?: string | null }> {
  return apiFetchJson(`/payments/${paymentId}/retry`, { method: "POST", token, body: {} });
}

/**
 * Triggers a PDF download for a paid payment receipt.
 * Backend: PaymentController::receiptPdf → PaymentReceiptPdfService.
 */
export async function downloadPaymentReceiptPdf(token: string, paymentId: number): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL || "/api";
  const res = await fetch(`${base}/payments/${paymentId}/receipt-pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Receipt PDF failed (${res.status}): ${body || res.statusText}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt-${paymentId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Triggers a PDF download of the Finance summary snapshot (hero numbers,
 * currency breakdown, revenue by service) for the given range.
 * Backend: FinanceStatsController::summaryPdf → FinanceSummaryPdfService.
 */
export async function downloadFinanceSummaryPdf(
  token: string,
  range: FinanceRange = "30d"
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL || "/api";
  const res = await fetch(`${base}/platform-admin/finance-summary/pdf?range=${range}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Finance summary PDF failed (${res.status}): ${body || res.statusText}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finance-summary-${range}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Triggers a CSV download for the Transactions page (entitlements + settlements
 * combined). Returns nothing — opens the browser download dialog.
 */
export async function downloadFinanceCsv(
  token: string,
  companyId: number,
  kind: "entitlements" | "settlements" | "all" = "all"
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL || "/api";
  const url = `${base}/finance/export-csv?company_id=${companyId}&kind=${kind}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CSV export failed (${res.status}): ${body || res.statusText}`);
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = `finance-${kind}-${companyId}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}
