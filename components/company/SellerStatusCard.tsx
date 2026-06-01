"use client";

/**
 * Seller Status card — P0-3 (2026-06-02). Operator-facing.
 *
 * Lists every sellable service type with the company's application status:
 *   approved              → green pill (service is live)
 *   pending|under_review  → amber pill ("In process")
 *   rejected              → red pill + reason; the row still offers "Apply
 *                           again" because the backend re-opens a rejected row
 *   (no application)       → "Apply" button (POST seller-applications)
 *
 * Backend auto-activates the service on admin approval (CompanySellerPermission
 * + company.is_seller), so once a row turns green the operator can list/sell it.
 */

import { useCallback, useEffect, useState } from "react";
import { V2Card, V2CardHeader, V2CardBody, V2Button } from "@/components/ui/v2";
import {
  apiListOwnSellerApplications,
  apiSubmitSellerApplication,
  extractSellerApplicationError,
  SELLER_SERVICE_TYPES,
  type SellerApplication,
  type SellerServiceType,
} from "@/lib/seller-application-api";

export function SellerStatusCard({
  token,
  companyId,
  tx: trans,
}: {
  token: string | null;
  companyId: number;
  tx: (k: string, fb: string) => string;
}) {
  const [apps, setApps] = useState<SellerApplication[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const list = await apiListOwnSellerApplications(token, companyId);
      setApps(list);
      setError(null);
    } catch (e) {
      setError(
        extractSellerApplicationError(
          e,
          trans("admin.seller_status.error_load", "Couldn't load your seller status.")
        )
      );
    } finally {
      setLoading(false);
    }
  }, [token, companyId, trans]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleApply(serviceType: SellerServiceType) {
    if (!token) return;
    setSubmitting(serviceType);
    setError(null);
    try {
      await apiSubmitSellerApplication(token, companyId, serviceType);
      await refresh();
    } catch (e) {
      setError(
        extractSellerApplicationError(
          e,
          trans("admin.seller_status.error_apply", "Couldn't submit your application.")
        )
      );
    } finally {
      setSubmitting(null);
    }
  }

  const byType = new Map<string, SellerApplication>(
    (apps ?? []).map((a) => [a.service_type, a])
  );

  return (
    <V2Card>
      <V2CardHeader
        title={trans("admin.seller_status.title", "Seller status")}
        subtitle={trans(
          "admin.seller_status.subtitle",
          "See which service types are approved, in process, or rejected — and apply to sell new ones."
        )}
      />
      <V2CardBody>
        {loading ? (
          <span className="text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
            {trans("common.loading", "Loading…")}
          </span>
        ) : (
          <>
            {error ? (
              <div
                className="mb-3 rounded-md border px-3 py-2 text-[12px]"
                style={{
                  borderColor: "var(--admin-danger-dark, #b42318)",
                  backgroundColor: "var(--admin-danger-light, #fee4e2)",
                  color: "var(--admin-danger-dark, #b42318)",
                }}
              >
                {error}
              </div>
            ) : null}

            <ul className="flex flex-col divide-y" style={{ borderColor: "var(--admin-border)" }}>
              {SELLER_SERVICE_TYPES.map((type) => {
                const app = byType.get(type);
                const label = trans(`admin.seller_status.service.${type}`, type);
                return (
                  <li key={type} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className="text-[13px] font-medium"
                        style={{ color: "var(--admin-text-primary)" }}
                      >
                        {label}
                      </span>
                      {app?.status === "rejected" && app.rejection_reason ? (
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--admin-danger-dark, #b42318)" }}
                        >
                          {app.rejection_reason}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      {app ? <StatusPill status={app.status} trans={trans} /> : null}
                      {!app || app.status === "rejected" ? (
                        <V2Button
                          variant="primary"
                          disabled={submitting === type || !token}
                          onClick={() => void handleApply(type)}
                        >
                          {submitting === type
                            ? trans("admin.seller_status.applying", "Submitting…")
                            : app
                              ? trans("admin.seller_status.apply_again", "Apply again")
                              : trans("admin.seller_status.apply", "Apply")}
                        </V2Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </V2CardBody>
    </V2Card>
  );
}

function StatusPill({
  status,
  trans,
}: {
  status: SellerApplication["status"];
  trans: (k: string, fb: string) => string;
}) {
  const tone: "success" | "warning" | "danger" =
    status === "approved" ? "success" : status === "rejected" ? "danger" : "warning";

  const label =
    status === "approved"
      ? trans("admin.seller_status.status.approved", "Approved")
      : status === "rejected"
        ? trans("admin.seller_status.status.rejected", "Rejected")
        : status === "under_review"
          ? trans("admin.seller_status.status.under_review", "Under review")
          : trans("admin.seller_status.status.pending", "In process");

  const styles =
    tone === "success"
      ? { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" }
      : tone === "danger"
        ? {
            backgroundColor: "var(--admin-danger-light, #fee4e2)",
            color: "var(--admin-danger-dark, #b42318)",
          }
        : { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" };

  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
      style={styles}
    >
      {label}
    </span>
  );
}
