/**
 * Finance group v2 — Phase 2e Quick Actions.
 *
 * Single drawer that hosts 3 quick-action forms:
 *  - mode="issue-invoice"  → POST /invoices                  (apiStoreInvoice)
 *  - mode="record-payment" → POST /payments                  (apiCreatePayment)
 *  - mode="issue-voucher"  → POST /platform-admin/vouchers   (apiIssueManualVoucher)
 *
 * Wired into the Finance summary "Quick actions" card. Each form is the
 * minimal viable shape — the backend handles the heavy lifting (invoice line
 * computation, payment intent creation, voucher number generation).
 *
 * Issue voucher = Item 4.1 from the placeholder inventory. Used by admins
 * for compensation, gifts, and one-off vouchers outside the booking flow.
 */

"use client";

import { useState } from "react";
import { X as XIcon } from "lucide-react";
import { V2Button, IconButton } from "@/components/ui/v2";
import { apiStoreInvoice } from "@/lib/invoices-api";
import { apiCreatePayment } from "@/lib/payments-create-api";
import { apiIssueManualVoucher, type ManualVoucherPayload } from "@/lib/vouchers-api";
import { ApiRequestError } from "@/lib/api-client";

export type QuickActionMode = "issue-invoice" | "record-payment" | "issue-voucher";

type Props = {
  mode: QuickActionMode | null;
  token: string | null;
  onClose: () => void;
  onSuccess: (mode: QuickActionMode, payload: { id: string | number; message: string }) => void;
};

const TITLES: Record<QuickActionMode, string> = {
  "issue-invoice": "Issue invoice",
  "record-payment": "Record payment",
  "issue-voucher": "Issue voucher",
};

const SUBTITLES: Record<QuickActionMode, string> = {
  "issue-invoice": "Create a new invoice from an existing order.",
  "record-payment":
    "Create a payment intent on the gateway. The customer completes payment via the secure link or you mark it paid manually on /platform/payments.",
  "issue-voucher": "Manually issue a voucher for compensation, gifts, or one-off cases outside the booking flow.",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 text-[11px] font-medium uppercase tracking-[0.3px]" style={{ color: "var(--admin-text-secondary)" }}>
      {children}
    </span>
  );
}

function input({ borderColor }: { borderColor?: string } = {}) {
  return {
    className:
      "h-[36px] rounded-md border bg-white px-3 text-[13px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]",
    style: { borderColor: borderColor ?? "var(--admin-border)" },
  };
}

export function FinanceQuickActionDrawer({ mode, token, onClose, onSuccess }: Props) {
  // Issue invoice state
  const [orderId, setOrderId] = useState("");
  // Record payment state
  const [invoiceId, setInvoiceId] = useState("");
  // Issue voucher state
  const [voucher, setVoucher] = useState<ManualVoucherPayload>({
    service_type: "hotel",
    holder_name: "",
    language: "en",
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!mode) return null;

  async function handleSubmit() {
    if (!token || !mode) return;
    setErr(null);
    setSaving(true);
    try {
      if (mode === "issue-invoice") {
        if (!orderId.trim()) {
          setErr("Order ID is required.");
          setSaving(false);
          return;
        }
        const res = await apiStoreInvoice(token, orderId.trim());
        onSuccess(mode, { id: res.data.id, message: `Invoice #${res.data.id} created.` });
      } else if (mode === "record-payment") {
        const id = Number(invoiceId);
        if (!id || id <= 0) {
          setErr("Invoice ID is required and must be a positive number.");
          setSaving(false);
          return;
        }
        const res = await apiCreatePayment(token, id);
        onSuccess(mode, {
          id: res.data.id,
          message: `Payment intent created (#${res.data.id}). Customer can complete payment via the gateway.`,
        });
      } else if (mode === "issue-voucher") {
        if (!voucher.holder_name.trim()) {
          setErr("Holder name is required.");
          setSaving(false);
          return;
        }
        const res = await apiIssueManualVoucher(token, {
          ...voucher,
          holder_name: voucher.holder_name.trim(),
          notes: voucher.notes?.trim() || null,
        });
        const num = (res.data as { voucher_number?: string }).voucher_number ?? "(unknown)";
        onSuccess(mode, { id: (res.data as { id: number }).id, message: `Voucher ${num} issued.` });
      }
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : e instanceof Error ? e.message : "Action failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 transition-opacity" onClick={onClose} aria-hidden />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col bg-white shadow-2xl"
        style={{ borderLeft: "1px solid var(--admin-border)" }}
        role="dialog"
        aria-label={TITLES[mode]}
      >
        <header className="border-b px-5 py-4" style={{ borderColor: "var(--admin-border)" }}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>
              {TITLES[mode]}
            </h2>
            <IconButton aria-label="Close" onClick={onClose}>
              <XIcon />
            </IconButton>
          </div>
          <p className="text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
            {SUBTITLES[mode]}
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {err ? (
            <div
              className="mb-4 rounded-md border px-3 py-2 text-[12px]"
              style={{
                borderColor: "var(--admin-danger-light)",
                backgroundColor: "var(--admin-danger-light)",
                color: "var(--admin-danger-dark)",
              }}
            >
              {err}
            </div>
          ) : null}

          {mode === "issue-invoice" && (
            <div className="space-y-4">
              <label className="flex flex-col">
                <FieldLabel>Order ID (UUID)</FieldLabel>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="e.g. 8c4f1d2b-..."
                  {...input()}
                />
              </label>
              <p className="text-[11px]" style={{ color: "var(--admin-text-tertiary)" }}>
                Backend computes invoice lines from the order&apos;s items.
              </p>
            </div>
          )}

          {mode === "record-payment" && (
            <div className="space-y-4">
              <label className="flex flex-col">
                <FieldLabel>Invoice ID</FieldLabel>
                <input
                  type="number"
                  min="1"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  placeholder="e.g. 128"
                  {...input()}
                />
              </label>
              <p className="text-[11px]" style={{ color: "var(--admin-text-tertiary)" }}>
                Creates a payment intent on the gateway. Customer receives a payment link.
                For cash / wire transfer reconciliation, mark the invoice as paid directly on the Invoices page after funds clear.
              </p>
            </div>
          )}

          {mode === "issue-voucher" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col">
                  <FieldLabel>Service type</FieldLabel>
                  <select
                    value={voucher.service_type}
                    onChange={(e) =>
                      setVoucher({ ...voucher, service_type: e.target.value as ManualVoucherPayload["service_type"] })
                    }
                    {...input()}
                  >
                    <option value="hotel">Hotel</option>
                    <option value="flight">Flight</option>
                    <option value="transfer">Transfer</option>
                    <option value="car">Car</option>
                    <option value="excursion">Excursion</option>
                    <option value="visa">Visa</option>
                    <option value="insurance">Insurance</option>
                    <option value="package">Package</option>
                  </select>
                </label>
                <label className="flex flex-col">
                  <FieldLabel>Language</FieldLabel>
                  <select
                    value={voucher.language ?? "en"}
                    onChange={(e) =>
                      setVoucher({ ...voucher, language: e.target.value as ManualVoucherPayload["language"] })
                    }
                    {...input()}
                  >
                    <option value="en">English</option>
                    <option value="hy">Armenian</option>
                    <option value="ru">Russian</option>
                  </select>
                </label>
              </div>

              <label className="flex flex-col">
                <FieldLabel>Holder name *</FieldLabel>
                <input
                  type="text"
                  value={voucher.holder_name}
                  onChange={(e) => setVoucher({ ...voucher, holder_name: e.target.value })}
                  placeholder="Full name"
                  {...input()}
                />
              </label>

              <label className="flex flex-col">
                <FieldLabel>Holder passport / ID</FieldLabel>
                <input
                  type="text"
                  value={voucher.holder_passport ?? ""}
                  onChange={(e) => setVoucher({ ...voucher, holder_passport: e.target.value || null })}
                  placeholder="Optional"
                  {...input()}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col">
                  <FieldLabel>Valid from</FieldLabel>
                  <input
                    type="date"
                    value={voucher.valid_from ?? ""}
                    onChange={(e) => setVoucher({ ...voucher, valid_from: e.target.value || null })}
                    {...input()}
                  />
                </label>
                <label className="flex flex-col">
                  <FieldLabel>Valid to</FieldLabel>
                  <input
                    type="date"
                    value={voucher.valid_to ?? ""}
                    onChange={(e) => setVoucher({ ...voucher, valid_to: e.target.value || null })}
                    {...input()}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col">
                  <FieldLabel>Amount</FieldLabel>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={voucher.amount ?? ""}
                    onChange={(e) =>
                      setVoucher({ ...voucher, amount: e.target.value ? Number(e.target.value) : null })
                    }
                    placeholder="0.00"
                    {...input()}
                  />
                </label>
                <label className="flex flex-col">
                  <FieldLabel>Currency</FieldLabel>
                  <select
                    value={voucher.currency ?? ""}
                    onChange={(e) => setVoucher({ ...voucher, currency: e.target.value || null })}
                    {...input()}
                  >
                    <option value="">—</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="AMD">AMD</option>
                    <option value="RUB">RUB</option>
                  </select>
                </label>
              </div>

              <label className="flex flex-col">
                <FieldLabel>Issuer company ID (optional)</FieldLabel>
                <input
                  type="number"
                  min="1"
                  value={voucher.issuer_company_id ?? ""}
                  onChange={(e) =>
                    setVoucher({ ...voucher, issuer_company_id: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="Leave blank for platform-issued"
                  {...input()}
                />
              </label>

              <label className="flex flex-col">
                <FieldLabel>Notes / reason</FieldLabel>
                <textarea
                  value={voucher.notes ?? ""}
                  onChange={(e) => setVoucher({ ...voucher, notes: e.target.value || null })}
                  className="min-h-[70px] rounded-md border bg-white px-3 py-2 text-[13px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                  style={{ borderColor: "var(--admin-border)" }}
                  placeholder="e.g. Compensation for delayed transfer on order #1234"
                />
              </label>
            </div>
          )}
        </div>

        <footer
          className="flex items-center gap-2 border-t px-5 py-3.5"
          style={{ borderColor: "var(--admin-border)", backgroundColor: "var(--admin-bg-secondary)" }}
        >
          <V2Button onClick={onClose}>Cancel</V2Button>
          <div className="flex-1" />
          <V2Button variant="primary" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Submitting..." : mode === "issue-invoice" ? "Create invoice" : mode === "record-payment" ? "Create payment" : "Issue voucher"}
          </V2Button>
        </footer>
      </aside>
    </>
  );
}
