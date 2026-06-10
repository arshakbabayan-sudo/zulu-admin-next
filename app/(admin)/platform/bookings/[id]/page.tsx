"use client";

/**
 * Booking detail page — Phase 3B (2026-05-31).
 *
 * Built fresh as part of the new menu architecture; previously the
 * bookings list page rendered "View" links pointing here, but the page
 * itself didn't exist and every click landed on Next.js's 404.
 *
 * Layout (Archetype C — Detail page, per
 * docs/admin_designe/new-menu-architecture-2026-05-31.md §4):
 *   - PageHeader: breadcrumb back to Bookings, order number title,
 *     status pill, top-right Confirm + Cancel actions (gated by status)
 *   - 2-column grid of V2 cards:
 *       Customer · Service · Financials · Dates · Items list
 *
 * Data: GET /platform-admin/bookings/{id} (added in the matching backend
 * commit; same UUID/regex constraint as the list endpoint).
 *
 * Actions reuse the existing apiConfirmBooking / apiCancelBooking helpers
 * already wired up on the list page.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import {
  apiBooking,
  apiCancelBooking,
  apiConfirmBooking,
  type BookingRow,
} from "@/lib/bookings-api";
import { formatMoney, formatDateTime } from "@/lib/format";
import {
  PageHeader,
  V2Card,
  V2CardHeader,
  V2CardBody,
  V2Button,
} from "@/components/ui/v2";
import {
  ArrowLeft,
  Check,
  Mail,
  User as UserIcon,
  Building2,
  Calendar,
  Receipt,
  Hash,
  X as XIcon,
} from "lucide-react";

// Local i18n shim — falls back to plain English when the translation row
// hasn't been seeded yet. Mirrors the pattern used on the Profile page.
function tx(t: (k: string) => string, key: string, fallback: string): string {
  const v = t(key);
  return v && v !== key ? v : fallback;
}

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "info" | "neutral"> = {
  confirmed: "success",
  paid: "success",
  pending_payment: "warn",
  cart: "neutral",
  cancelled: "danger",
  refunded: "danger",
  failed: "danger",
};

function StatusPill({ status, tx: trans }: { status: string; tx: (k: string, fb: string) => string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  const palette = {
    success: { bg: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    warn: { bg: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    danger: { bg: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" },
    info: { bg: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
    neutral: { bg: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
      style={{ backgroundColor: palette.bg, color: palette.color }}
    >
      {trans(`admin.bookings.status.${status}`, status.replace(/_/g, " "))}
    </span>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
        style={{
          backgroundColor: "var(--admin-bg-tertiary)",
          color: "var(--admin-text-secondary)",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div
          className="text-[11px] font-medium uppercase tracking-[0.3px]"
          style={{ color: "var(--admin-text-secondary)" }}
        >
          {label}
        </div>
        <div className="text-[13px]" style={{ color: "var(--admin-text-primary)" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAdminAuth();
  const { t, lang } = useLanguage();

  const trans = useCallback(
    (key: string, fallback: string) => tx(t, key, fallback),
    [t]
  );

  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [row, setRow] = useState<BookingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "confirm" | "cancel">(null);
  const [toast, setToast] = useState<string | null>(null);

  useDocumentTitle(
    row?.order_number
      ? trans("admin.bookings.detail.title", `Booking ${row.order_number}`)
      : trans("admin.bookings.detail.title_short", "Booking detail")
  );

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiBooking(token, id);
      setRow(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setError(e.message);
      } else {
        setError(trans("admin.bookings.detail.load_err", "Could not load this booking."));
      }
    } finally {
      setLoading(false);
    }
  }, [token, id, trans]);

  useEffect(() => {
    void load();
  }, [load]);

  const flashToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  const onConfirm = async () => {
    if (!token || !id || busy) return;
    setBusy("confirm");
    setError(null);
    try {
      const res = await apiConfirmBooking(token, id);
      setRow(res.data);
      flashToast(trans("admin.bookings.detail.confirmed_toast", "Booking confirmed."));
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? e.message
          : trans("admin.bookings.detail.confirm_err", "Could not confirm the booking.")
      );
    } finally {
      setBusy(null);
    }
  };

  const onCancel = async () => {
    if (!token || !id || busy) return;
    setBusy("cancel");
    setError(null);
    try {
      const res = await apiCancelBooking(token, id);
      setRow(res.data);
      flashToast(trans("admin.bookings.detail.cancelled_toast", "Booking cancelled."));
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? e.message
          : trans("admin.bookings.detail.cancel_err", "Could not cancel the booking.")
      );
    } finally {
      setBusy(null);
    }
  };

  if (!canAccessPlatformAdminNav(user)) {
    return <ForbiddenNotice />;
  }

  const status = row?.status ?? "";
  const canConfirm = ["cart", "pending_payment", "paid", "confirmed"].includes(status);
  const canCancel = !["cancelled", "refunded"].includes(status);
  const total = row?.total ?? row?.total_amount ?? null;
  const currency = row?.currency ?? "USD";
  const reference: string = row?.order_number ?? row?.booking_reference ?? id ?? "";

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: trans("admin.nav.dashboard", "Home"), href: "/dashboard" },
          { label: trans("admin.nav.section.bookings", "Bookings"), href: "/platform/bookings" },
          { label: reference },
        ]}
        title={
          row?.order_number
            ? `${trans("admin.bookings.detail.title_prefix", "Booking")} ${row.order_number}`
            : trans("admin.bookings.detail.title_short", "Booking detail")
        }
        subtitle={
          row?.created_at
            ? `${trans("admin.bookings.detail.created_label", "Created")} ${formatDateTime(row.created_at, lang)}`
            : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <V2Button
              as="link"
              href="/platform/bookings"
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              {trans("admin.bookings.detail.back", "Back to list")}
            </V2Button>
            {row && canConfirm ? (
              <V2Button
                variant="success"
                onClick={() => void onConfirm()}
                disabled={!!busy}
                icon={<Check className="h-4 w-4" />}
              >
                {busy === "confirm"
                  ? trans("common.saving", "Saving…")
                  : trans("admin.bookings.detail.confirm", "Confirm")}
              </V2Button>
            ) : null}
            {row && canCancel ? (
              <V2Button
                variant="danger"
                onClick={() => void onCancel()}
                disabled={!!busy}
                icon={<XIcon className="h-4 w-4" />}
              >
                {busy === "cancel"
                  ? trans("common.saving", "Saving…")
                  : trans("admin.bookings.detail.cancel", "Cancel")}
              </V2Button>
            ) : null}
          </div>
        }
      />

      {/* Status + toast strip */}
      <div className="flex flex-wrap items-center gap-3">
        {row ? <StatusPill status={row.status} tx={trans} /> : null}
        {toast ? (
          <span className="text-[12px]" style={{ color: "var(--admin-success-dark)" }}>
            {toast}
          </span>
        ) : null}
      </div>

      {/* Errors */}
      {error ? (
        <div className="rounded-md border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
          {error}
        </div>
      ) : null}

      {loading && !row ? (
        <div
          className="rounded-lg border p-6 text-center text-[13px]"
          style={{
            borderColor: "var(--admin-border)",
            backgroundColor: "var(--admin-bg-primary)",
            color: "var(--admin-text-secondary)",
          }}
        >
          {trans("common.loading", "Loading…")}
        </div>
      ) : !row ? (
        <div
          className="rounded-lg border p-6 text-center text-[13px]"
          style={{
            borderColor: "var(--admin-border)",
            backgroundColor: "var(--admin-bg-primary)",
            color: "var(--admin-text-secondary)",
          }}
        >
          {trans("admin.bookings.detail.not_found", "Booking not found.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Customer card */}
          <V2Card>
            <V2CardHeader title={trans("admin.bookings.detail.customer", "Customer")} />
            <V2CardBody>
              {row.user ? (
                <>
                  <InfoRow
                    icon={<UserIcon className="h-4 w-4" />}
                    label={trans("admin.bookings.detail.customer_name", "Name")}
                    value={row.user.name || "—"}
                  />
                  <InfoRow
                    icon={<Mail className="h-4 w-4" />}
                    label={trans("admin.bookings.detail.customer_email", "Email")}
                    value={
                      row.user.email ? (
                        <a
                          href={`mailto:${row.user.email}`}
                          className="hover:underline"
                          style={{ color: "var(--admin-primary)" }}
                        >
                          {row.user.email}
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <InfoRow
                    icon={<Hash className="h-4 w-4" />}
                    label={trans("admin.bookings.detail.customer_id", "Customer ID")}
                    value={String(row.user.id)}
                  />
                </>
              ) : (
                <div className="text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                  {trans("admin.bookings.detail.no_customer", "No customer record attached.")}
                </div>
              )}
            </V2CardBody>
          </V2Card>

          {/* Financials card */}
          <V2Card>
            <V2CardHeader title={trans("admin.bookings.detail.financials", "Financials")} />
            <V2CardBody>
              <InfoRow
                icon={<Receipt className="h-4 w-4" />}
                label={trans("admin.bookings.detail.total", "Total")}
                value={
                  total !== null && total !== undefined
                    ? formatMoney(total, lang, currency)
                    : "—"
                }
              />
              <InfoRow
                icon={<Hash className="h-4 w-4" />}
                label={trans("admin.bookings.detail.currency", "Currency")}
                value={currency}
              />
              <InfoRow
                icon={<Hash className="h-4 w-4" />}
                label={trans("admin.bookings.detail.reference", "Reference")}
                value={
                  <code
                    className="rounded px-1.5 py-0.5 text-[12px]"
                    style={{
                      backgroundColor: "var(--admin-bg-tertiary)",
                      color: "var(--admin-text-primary)",
                    }}
                  >
                    {reference}
                  </code>
                }
              />
            </V2CardBody>
          </V2Card>

          {/* Operator / Agent card */}
          <V2Card>
            <V2CardHeader title={trans("admin.bookings.detail.parties", "Parties")} />
            <V2CardBody>
              <InfoRow
                icon={<Building2 className="h-4 w-4" />}
                label={trans("admin.bookings.detail.operator", "Operator")}
                value={
                  row.company ? (
                    <a
                      href={`/platform/companies/${row.company.id}`}
                      className="hover:underline"
                      style={{ color: "var(--admin-primary)" }}
                    >
                      {row.company.name}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                icon={<Building2 className="h-4 w-4" />}
                label={trans("admin.bookings.detail.agent_company", "Agent company")}
                value={
                  row.agent_company ? (
                    <a
                      href={`/platform/companies/${row.agent_company.id}`}
                      className="hover:underline"
                      style={{ color: "var(--admin-primary)" }}
                    >
                      {row.agent_company.name}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
            </V2CardBody>
          </V2Card>

          {/* Dates card */}
          <V2Card>
            <V2CardHeader title={trans("admin.bookings.detail.timeline", "Timeline")} />
            <V2CardBody>
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label={trans("admin.bookings.detail.created", "Created")}
                value={row.created_at ? formatDateTime(row.created_at, lang) : "—"}
              />
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label={trans("admin.bookings.detail.updated", "Last updated")}
                value={row.updated_at ? formatDateTime(row.updated_at, lang) : "—"}
              />
            </V2CardBody>
          </V2Card>

          {/* Items card — spans 2 columns */}
          <div className="lg:col-span-2">
            <V2Card>
              <V2CardHeader
                title={trans("admin.bookings.detail.items", "Items")}
                subtitle={
                  row.items?.length
                    ? `${row.items.length} ${trans("admin.bookings.detail.items_count", "item(s)")}`
                    : undefined
                }
              />
              <V2CardBody>
                {row.items && row.items.length > 0 ? (
                  <div className="space-y-2">
                    {row.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-start gap-3 rounded-md border px-3 py-2"
                        style={{
                          borderColor: "var(--admin-border)",
                          backgroundColor: "var(--admin-bg-primary)",
                        }}
                      >
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
                          style={{
                            backgroundColor: "var(--admin-primary-soft)",
                            color: "var(--admin-primary)",
                          }}
                        >
                          <Hash className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className="text-[13px] font-semibold"
                            style={{ color: "var(--admin-text-primary)" }}
                          >
                            {it.title ?? `Item #${it.id}`}
                          </div>
                          <div
                            className="text-[11px]"
                            style={{ color: "var(--admin-text-secondary)" }}
                          >
                            {it.module_type ?? "—"}
                            {it.offer_id ? ` · offer #${it.offer_id}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : row.offer ? (
                  // Fallback for legacy single-offer envelopes — keep the page
                  // useful when `items` isn't populated yet.
                  <div
                    className="rounded-md border px-3 py-3"
                    style={{
                      borderColor: "var(--admin-border)",
                      backgroundColor: "var(--admin-bg-primary)",
                    }}
                  >
                    <div
                      className="text-[13px] font-semibold"
                      style={{ color: "var(--admin-text-primary)" }}
                    >
                      {row.offer.title}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
                      {row.offer.type} · offer #{row.offer.id}
                    </div>
                  </div>
                ) : (
                  <div className="text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                    {trans("admin.bookings.detail.no_items", "No items recorded on this booking.")}
                  </div>
                )}
              </V2CardBody>
            </V2Card>
          </div>
        </div>
      )}

      {/* Hidden router reference to silence "router unused" lint while we
          keep the import handy for future "navigate after cancel" flows. */}
      <span className="hidden">{router ? "" : ""}</span>
    </div>
  );
}
