"use client";

/**
 * Stripe Connect (Express) onboarding card — P0-1 step 1.1 (2026-06-01).
 *
 * Rendered on the company settings surface. Lets a company admin connect
 * their Stripe Express account; ZULU keeps an application_fee on every
 * marketplace charge and transfers the rest to this connected account.
 *
 * State machine:
 *   loading              → fetch /stripe-connect/status
 *   not_connected        → no acct yet; show "Connect Stripe" CTA
 *   pending              → acct exists but charges|payouts|details still
 *                          incomplete; show "Continue setup" CTA + 3 sub-
 *                          status pills (details/charges/payouts)
 *   ready                → both charges + payouts enabled; show success
 *                          pill + a smaller "Update info" CTA
 *   sync_error           → Stripe rejected the retrieve call; show error
 *                          banner; CTA still active (lets user re-open
 *                          Express onboarding to fix)
 *
 * The CTA navigates the browser away to Stripe; on return Stripe sends
 * the user back to return_url (this page with ?stripe_connect=done) where
 * the parent re-mounts the card and the status fetch picks up the new
 * Stripe state. Step 1.4's webhook will eventually update the booleans
 * server-side without needing a page reload.
 */

import { useCallback, useEffect, useState } from "react";
import { V2Card, V2CardHeader, V2CardBody, V2Button } from "@/components/ui/v2";
import {
  apiStripeConnectStatus,
  apiStripeConnectOnboardingLink,
  extractStripeConnectError,
  type StripeConnectStatus,
} from "@/lib/stripe-connect-api";

type Phase = "loading" | "not_connected" | "pending" | "ready" | "error";

export function StripeConnectCard({
  token,
  companyId,
  tx: trans,
}: {
  token: string | null;
  companyId: number;
  tx: (k: string, fb: string) => string;
}) {
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setPhase("not_connected");
      return;
    }
    try {
      const next = await apiStripeConnectStatus(token, companyId);
      setStatus(next);
      if (!next.connected) {
        setPhase("not_connected");
      } else if (next.ready) {
        setPhase("ready");
      } else if (next.sync_error) {
        setPhase("error");
      } else {
        setPhase("pending");
      }
    } catch (e) {
      setError(
        extractStripeConnectError(
          e,
          trans(
            "admin.stripe_connect.error.load",
            "Couldn't load Stripe Connect status. Try refresh."
          )
        )
      );
      setPhase("error");
    }
  }, [token, companyId, trans]);

  // Bootstrap status on mount + when the return-from-Stripe query lands.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("stripe_connect") === "done") {
      // Strip the marker so a manual reload doesn't re-trigger; refresh
      // once to pick up the just-finished Express onboarding state.
      url.searchParams.delete("stripe_connect");
      window.history.replaceState({}, "", url.toString());
      void refresh();
    }
  }, [refresh]);

  async function handleConnect() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const here = new URL(window.location.href);
      // Strip any stale ?stripe_connect= so the round-trip is clean.
      here.searchParams.delete("stripe_connect");
      const returnUrl = (() => {
        const u = new URL(here.toString());
        u.searchParams.set("stripe_connect", "done");
        return u.toString();
      })();
      const refreshUrl = (() => {
        const u = new URL(here.toString());
        u.searchParams.set("stripe_connect", "refresh");
        return u.toString();
      })();
      const link = await apiStripeConnectOnboardingLink(
        token,
        companyId,
        returnUrl,
        refreshUrl
      );
      if (link.url) {
        window.location.href = link.url;
        return;
      }
      setError(
        trans(
          "admin.stripe_connect.error.no_url",
          "Stripe didn't return an onboarding URL."
        )
      );
    } catch (e) {
      setError(
        extractStripeConnectError(
          e,
          trans(
            "admin.stripe_connect.error.link",
            "Couldn't start Stripe onboarding."
          )
        )
      );
    } finally {
      setBusy(false);
    }
  }

  const ctaLabel =
    phase === "ready"
      ? trans("admin.stripe_connect.cta.update", "Update Stripe info")
      : phase === "pending"
        ? trans("admin.stripe_connect.cta.continue", "Continue setup")
        : trans("admin.stripe_connect.cta.connect", "Connect Stripe");

  const ctaVariant: "primary" | "default" = phase === "ready" ? "default" : "primary";

  return (
    <V2Card>
      <V2CardHeader
        title={trans("admin.stripe_connect.title", "Stripe Connect")}
        subtitle={trans(
          "admin.stripe_connect.subtitle",
          "Connect your Stripe Express account so the platform can transfer your share of each booking."
        )}
      />
      <V2CardBody>
        <div className="flex flex-wrap items-center gap-2">
          {phase === "loading" ? (
            <span
              className="text-[12px]"
              style={{ color: "var(--admin-text-secondary)" }}
            >
              {trans("common.loading", "Loading…")}
            </span>
          ) : phase === "ready" ? (
            <StatusPill
              tone="success"
              label={trans("admin.stripe_connect.status.ready", "Ready")}
            />
          ) : phase === "pending" ? (
            <StatusPill
              tone="warning"
              label={trans(
                "admin.stripe_connect.status.pending",
                "Setup in progress"
              )}
            />
          ) : phase === "error" ? (
            <StatusPill
              tone="warning"
              label={trans(
                "admin.stripe_connect.status.error",
                "Sync error"
              )}
            />
          ) : (
            <StatusPill
              tone="neutral"
              label={trans(
                "admin.stripe_connect.status.not_connected",
                "Not connected"
              )}
            />
          )}
          {status?.stripe_account_id ? (
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-mono"
              style={{
                backgroundColor: "var(--admin-bg-tertiary)",
                color: "var(--admin-text-secondary)",
              }}
              title={status.stripe_account_id}
            >
              {status.stripe_account_id.slice(0, 12)}…
            </span>
          ) : null}
        </div>

        {status?.connected ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <SubFlag
              ok={status.details_submitted}
              label={trans(
                "admin.stripe_connect.flag.details",
                "Details submitted"
              )}
            />
            <SubFlag
              ok={status.charges_enabled}
              label={trans(
                "admin.stripe_connect.flag.charges",
                "Charges enabled"
              )}
            />
            <SubFlag
              ok={status.payouts_enabled}
              label={trans(
                "admin.stripe_connect.flag.payouts",
                "Payouts enabled"
              )}
            />
          </div>
        ) : null}

        {status?.sync_error ? (
          <div
            className="mt-3 rounded-md border px-3 py-2 text-[12px]"
            style={{
              borderColor: "var(--admin-warning-dark)",
              backgroundColor: "var(--admin-warning-light)",
              color: "var(--admin-warning-dark)",
            }}
          >
            {status.sync_error}
          </div>
        ) : null}

        {error ? (
          <div
            className="mt-3 rounded-md border px-3 py-2 text-[12px]"
            style={{
              borderColor: "var(--admin-danger-dark, #b42318)",
              backgroundColor: "var(--admin-danger-light, #fee4e2)",
              color: "var(--admin-danger-dark, #b42318)",
            }}
          >
            {error}
          </div>
        ) : null}

        <div className="mt-4">
          <V2Button
            variant={ctaVariant}
            disabled={busy || phase === "loading" || !token}
            onClick={() => void handleConnect()}
          >
            {busy
              ? trans("admin.stripe_connect.cta.busy", "Opening Stripe…")
              : ctaLabel}
          </V2Button>
        </div>
      </V2CardBody>
    </V2Card>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: "success" | "warning" | "neutral";
  label: string;
}) {
  const styles =
    tone === "success"
      ? {
          backgroundColor: "var(--admin-success-light)",
          color: "var(--admin-success-dark)",
        }
      : tone === "warning"
        ? {
            backgroundColor: "var(--admin-warning-light)",
            color: "var(--admin-warning-dark)",
          }
        : {
            backgroundColor: "var(--admin-bg-tertiary)",
            color: "var(--admin-text-secondary)",
          };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
      style={styles}
    >
      {label}
    </span>
  );
}

function SubFlag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium"
      style={
        ok
          ? {
              backgroundColor: "var(--admin-success-light)",
              color: "var(--admin-success-dark)",
            }
          : {
              backgroundColor: "var(--admin-bg-tertiary)",
              color: "var(--admin-text-secondary)",
            }
      }
    >
      <span aria-hidden>{ok ? "✓" : "•"}</span>
      {label}
    </span>
  );
}
