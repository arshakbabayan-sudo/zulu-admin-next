/**
 * Finance group v2 — Phase 2e Quick Actions.
 *
 * Thin client for POST /api/payments, used by the "Record payment" quick
 * action drawer on Finance summary. Backend creates the Payment row +
 * issues a gateway payment intent; the drawer just shows confirmation.
 */

import { apiFetchJson } from "./api-client";
import type { ApiSuccessEnvelope } from "./api-envelope";

export type CreatePaymentResponse = {
  data: {
    id: number;
    invoice_id: number;
    amount: number;
    currency: string;
    status: string;
    payment_method?: string | null;
  };
  client_secret?: string;
  payment_intent_id?: string;
};

export async function apiCreatePayment(
  token: string,
  invoiceId: number
): Promise<ApiSuccessEnvelope<CreatePaymentResponse["data"]> & {
  client_secret?: string;
  payment_intent_id?: string;
}> {
  return apiFetchJson("/payments", {
    method: "POST",
    token,
    body: { invoice_id: invoiceId },
  });
}
