"use client";

/**
 * Phase Զ.15 / Item 15 — first-iteration PIN gating for sensitive admin
 * actions.
 *
 * UX-level safety net: when an admin clicks a sensitive button (delete
 * user, delete role, large refund, etc.), this dialog prompts for the
 * user's 4-8 digit PIN, verifies it against /api/account/pin/verify,
 * and only then runs the original action handler.
 *
 * NOTE — server-side enforcement is a separate Phase 2 follow-up. A
 * true PIN gate would issue a short-lived signed token after verify
 * that the destructive endpoint then requires via a header. Until that
 * lands, this dialog is UX-only; an attacker who hits the API directly
 * can still skip it. We use this layer to catch fat-finger mistakes
 * and prove the PIN is set.
 */

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { apiFetchJson, ApiRequestError } from "@/lib/api-client";

type Props = {
  isOpen: boolean;
  title?: string;
  description?: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function PinPromptDialog({ isOpen, title, description, onCancel, onConfirm }: Props) {
  const { token } = useAdminAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError(null);
      setVerifying(false);
      setBusy(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async () => {
    if (!token) return;
    if (pin.length < 4) {
      setError("PIN must be 4-8 digits");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      await apiFetchJson("/account/pin/verify", { method: "POST", token, body: { pin } });
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 422) {
        if (/not set/i.test(e.message)) {
          setError(
            "PIN is not set on your account. Go to My profile → Security to set it before using gated actions."
          );
        } else {
          setError("PIN incorrect.");
        }
      } else {
        setError(e instanceof Error ? e.message : "Verification failed");
      }
      setVerifying(false);
      return;
    }
    setVerifying(false);
    setBusy(true);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      setBusy(false);
      return;
    }
    // success — caller is responsible for closing
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
    >
      <div
        className="w-full max-w-sm rounded-lg border bg-white shadow-xl"
        style={{ borderColor: "var(--admin-border)" }}
      >
        <div className="p-5">
          <h2 className="text-base font-semibold text-fg-t11">
            {title ?? "Verify your PIN"}
          </h2>
          {description ? (
            <p className="mt-1 text-xs text-fg-t6">{description}</p>
          ) : (
            <p className="mt-1 text-xs text-fg-t6">
              This action is gated. Enter your account PIN to continue.
            </p>
          )}
          <div className="mt-4">
            <label className="text-xs font-medium text-fg-t8" htmlFor="pin-input">
              PIN
            </label>
            <input
              id="pin-input"
              type="password"
              inputMode="numeric"
              autoFocus
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              disabled={verifying || busy}
              className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-center text-lg font-mono tracking-[6px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)] disabled:opacity-60"
              style={{ borderColor: "var(--admin-border)" }}
              placeholder="••••"
            />
          </div>

          {error ? (
            <p className="mt-3 text-xs text-error-600">{error}</p>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={verifying || busy}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-fg-t8 hover:bg-figma-bg-1 disabled:opacity-60"
              style={{ borderColor: "var(--admin-border)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={verifying || busy || pin.length < 4}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              style={{
                backgroundColor: "var(--admin-primary)",
                borderColor: "var(--admin-primary)",
              }}
            >
              {verifying ? "Verifying…" : busy ? "Working…" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
