"use client";

/**
 * Admin two-factor authentication card — Phase 3A (2026-05-31).
 *
 * Rendered inside Profile → Security tab. Closes the audit-finding gap
 * where admin users could see ZULU's 2FA backend but had no way to manage
 * THEIR OWN 2FA from the admin panel (had to leave admin and visit
 * zulu.am/account/security). Same backend + same channel-picker model
 * as the customer site; the visual is admin's V2 card system.
 *
 * Flow:
 *   loading → fetch /account/2fa/status
 *   disabled + method=email → channel picker shown, "Set up authenticator
 *     app" hidden (email users get codes at sign-in automatically), no
 *     enrolment needed
 *   disabled + method=totp → channel picker + "Set up authenticator app"
 *     CTA opens enrolment drawer (QR + recovery codes + 6-digit confirm)
 *   enabled (regardless of method) → status badges + channel picker still
 *     available + "Disable 2FA" CTA (hidden when required=true)
 *
 * Manager-enforced (required=true) → disable button is hidden, copy
 * directs the user to ask their account manager.
 */

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  V2Card,
  V2CardHeader,
  V2CardBody,
  V2Button,
} from "@/components/ui/v2";
import { Drawer, DrawerSection, FormField, Input } from "@/components/ui";
import {
  apiTwoFactorStatus,
  apiTwoFactorSetup,
  apiTwoFactorConfirm,
  apiTwoFactorSetMethod,
  apiTwoFactorDisable,
  extractTwoFactorError,
  type TwoFactorMethod,
  type TwoFactorSetup,
} from "@/lib/account-2fa-api";

type Phase = "loading" | "disabled" | "enrolling" | "enabled";

export function AdminTwoFactorCard({
  token,
  tx: trans,
}: {
  token: string | null;
  tx: (k: string, fb: string) => string;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [method, setMethod] = useState<TwoFactorMethod>("email");
  const [required, setRequired] = useState(false);
  const [code, setCode] = useState("");
  const [methodSaving, setMethodSaving] = useState(false);
  const [enrollSaving, setEnrollSaving] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Bootstrap status on mount.
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setPhase("disabled");
      return;
    }
    (async () => {
      const status = await apiTwoFactorStatus(token);
      if (cancelled) return;
      setPhase(status.enabled ? "enabled" : "disabled");
      setMethod(status.method);
      setRequired(status.required);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function flashToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  }

  async function chooseMethod(next: TwoFactorMethod) {
    if (!token || next === method) return;
    const prev = method;
    setMethod(next); // optimistic
    setMethodSaving(true);
    setError(null);
    try {
      await apiTwoFactorSetMethod(token, next);
    } catch (e) {
      setMethod(prev);
      setError(
        extractTwoFactorError(
          e,
          trans("admin.profile.security.tfa.method_failed", "Could not change sign-in method.")
        )
      );
    } finally {
      setMethodSaving(false);
    }
  }

  async function beginEnroll() {
    if (!token) return;
    setError(null);
    setEnrollSaving(true);
    try {
      const res = await apiTwoFactorSetup(token);
      setSetup(res.data);
      setEnrollOpen(true);
      setPhase("enrolling");
    } catch (e) {
      setError(
        extractTwoFactorError(
          e,
          trans("admin.profile.security.tfa.setup_failed", "Could not start 2FA setup.")
        )
      );
    } finally {
      setEnrollSaving(false);
    }
  }

  async function confirmEnroll() {
    if (!token || !code.trim()) return;
    setError(null);
    setEnrollSaving(true);
    try {
      await apiTwoFactorConfirm(token, code.trim());
      setPhase("enabled");
      setEnrollOpen(false);
      setSetup(null);
      setCode("");
      flashToast(
        trans("admin.profile.security.tfa.enabled_toast", "Two-factor authentication is on.")
      );
    } catch (e) {
      setError(
        extractTwoFactorError(
          e,
          trans("admin.profile.security.tfa.confirm_failed", "Invalid or expired code.")
        )
      );
    } finally {
      setEnrollSaving(false);
    }
  }

  async function submitDisable() {
    if (!token || !password) return;
    setError(null);
    setEnrollSaving(true);
    try {
      await apiTwoFactorDisable(token, password);
      setPhase("disabled");
      setDisableOpen(false);
      setPassword("");
      flashToast(
        trans("admin.profile.security.tfa.disabled_toast", "Two-factor authentication is off.")
      );
    } catch (e) {
      setError(
        extractTwoFactorError(
          e,
          trans("admin.profile.security.tfa.disable_failed", "Could not disable 2FA.")
        )
      );
    } finally {
      setEnrollSaving(false);
    }
  }

  function copySecret() {
    if (!setup?.secret) return;
    navigator.clipboard.writeText(setup.secret).then(
      () => {
        setCopiedSecret(true);
        window.setTimeout(() => setCopiedSecret(false), 2000);
      },
      () => {
        // clipboard write failed — silent
      }
    );
  }

  const methodLabel =
    method === "totp"
      ? trans("admin.profile.security.tfa.method_totp", "Authenticator app")
      : trans("admin.profile.security.tfa.method_email", "Email codes");

  return (
    <V2Card>
      <V2CardHeader
        title={trans("admin.profile.security.tfa.title", "Two-factor authentication")}
        subtitle={trans(
          "admin.profile.security.tfa.subtitle",
          "Extra check at sign-in. Pick the channel; required by your company when your manager has flagged the account."
        )}
      />
      <V2CardBody>
        {/* Status row */}
        <div className="flex flex-wrap items-center gap-2">
          {phase === "loading" ? (
            <span style={{ color: "var(--admin-text-secondary)" }} className="text-[12px]">
              {trans("common.loading", "Loading…")}
            </span>
          ) : phase === "enabled" ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
              style={{
                backgroundColor: "var(--admin-success-light)",
                color: "var(--admin-success-dark)",
              }}
            >
              {trans("admin.profile.security.tfa.status_enabled", "Enabled")}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
              style={{
                backgroundColor: "var(--admin-warning-light)",
                color: "var(--admin-warning-dark)",
              }}
            >
              {trans("admin.profile.security.tfa.status_disabled", "Disabled")}
            </span>
          )}
          {phase !== "loading" ? (
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: "var(--admin-bg-tertiary)",
                color: "var(--admin-text-secondary)",
              }}
            >
              {methodLabel}
            </span>
          ) : null}
          {required ? (
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
              style={{
                backgroundColor: "var(--admin-info-light)",
                color: "var(--admin-info-dark)",
              }}
            >
              {trans("admin.profile.security.tfa.required_pill", "Required by your company")}
            </span>
          ) : null}
        </div>

        {/* Channel picker (always shown once status loaded) */}
        {phase !== "loading" ? (
          <div className="mt-4">
            <div
              className="text-[12px] font-medium mb-2"
              style={{ color: "var(--admin-text-secondary)" }}
            >
              {trans("admin.profile.security.tfa.channel_label", "Sign-in code channel")}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="text-left rounded-md border px-3 py-2 transition disabled:cursor-not-allowed"
                onClick={() => void chooseMethod("totp")}
                disabled={methodSaving || method === "totp"}
                style={{
                  borderColor:
                    method === "totp" ? "var(--admin-primary)" : "var(--admin-border)",
                  backgroundColor:
                    method === "totp" ? "var(--admin-primary-soft)" : "var(--admin-bg-primary)",
                }}
              >
                <div
                  className="text-[13px] font-semibold"
                  style={{
                    color: method === "totp" ? "var(--admin-primary)" : "var(--admin-text-primary)",
                  }}
                >
                  {trans("admin.profile.security.tfa.method_totp", "Authenticator app")}
                </div>
                <div className="text-[11px] mt-1" style={{ color: "var(--admin-text-secondary)" }}>
                  {trans(
                    "admin.profile.security.tfa.totp_desc",
                    "Generate codes in Google Authenticator, Authy, or 1Password."
                  )}
                </div>
              </button>
              <button
                type="button"
                className="text-left rounded-md border px-3 py-2 transition disabled:cursor-not-allowed"
                onClick={() => void chooseMethod("email")}
                disabled={methodSaving || method === "email"}
                style={{
                  borderColor:
                    method === "email" ? "var(--admin-primary)" : "var(--admin-border)",
                  backgroundColor:
                    method === "email" ? "var(--admin-primary-soft)" : "var(--admin-bg-primary)",
                }}
              >
                <div
                  className="text-[13px] font-semibold"
                  style={{
                    color:
                      method === "email" ? "var(--admin-primary)" : "var(--admin-text-primary)",
                  }}
                >
                  {trans("admin.profile.security.tfa.method_email", "Email codes")}
                </div>
                <div className="text-[11px] mt-1" style={{ color: "var(--admin-text-secondary)" }}>
                  {trans(
                    "admin.profile.security.tfa.email_desc",
                    "We email a fresh 6-digit code each sign-in."
                  )}
                </div>
              </button>
            </div>
          </div>
        ) : null}

        {/* Action row */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {phase === "disabled" && method === "totp" ? (
            <V2Button
              variant="primary"
              onClick={() => void beginEnroll()}
              disabled={enrollSaving}
            >
              {trans(
                "admin.profile.security.tfa.setup_button",
                "Set up authenticator app"
              )}
            </V2Button>
          ) : null}
          {phase === "disabled" && method === "email" ? (
            <span
              className="text-[12px]"
              style={{ color: "var(--admin-text-secondary)" }}
            >
              {trans(
                "admin.profile.security.tfa.email_ready",
                "Email codes are ready — we'll send a fresh code the next time 2FA is required at sign-in."
              )}
            </span>
          ) : null}
          {phase === "enabled" && !required ? (
            <V2Button onClick={() => setDisableOpen(true)}>
              {trans("admin.profile.security.tfa.disable_button", "Disable 2FA")}
            </V2Button>
          ) : null}
          {phase === "enabled" && required ? (
            <span
              className="text-[12px]"
              style={{ color: "var(--admin-text-secondary)" }}
            >
              {trans(
                "admin.profile.security.tfa.required_locked",
                "Your company requires 2FA. Ask your account manager to turn it off if you need to remove it."
              )}
            </span>
          ) : null}
          {toast ? (
            <span className="text-[12px]" style={{ color: "var(--admin-success-dark)" }}>
              {toast}
            </span>
          ) : null}
        </div>

        {/* Inline error (mirrors the password card) */}
        {error ? (
          <div className="mt-3 rounded-md border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
            {error}
          </div>
        ) : null}
      </V2CardBody>

      {/* Enrolment drawer — TOTP only */}
      <Drawer
        open={enrollOpen}
        onClose={() => (enrollSaving ? undefined : (setEnrollOpen(false), setSetup(null), setCode(""), setError(null)))}
        title={trans(
          "admin.profile.security.tfa.setup_title",
          "Set up authenticator app"
        )}
        subtitle={trans(
          "admin.profile.security.tfa.setup_subtitle",
          "Scan the QR with your authenticator app, save the recovery codes, then confirm with a current code."
        )}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <V2Button
              onClick={() => {
                setEnrollOpen(false);
                setSetup(null);
                setCode("");
                setError(null);
              }}
              disabled={enrollSaving}
            >
              {trans("common.cancel", "Cancel")}
            </V2Button>
            <V2Button
              variant="primary"
              onClick={() => void confirmEnroll()}
              disabled={enrollSaving || code.trim().length !== 6}
            >
              {enrollSaving
                ? trans("common.saving", "Saving…")
                : trans("admin.profile.security.tfa.confirm_button", "Confirm")}
            </V2Button>
          </div>
        }
      >
        {setup ? (
          <>
            <DrawerSection>
              <div className="flex justify-center">
                <div className="rounded-md bg-white p-3 border" style={{ borderColor: "var(--admin-border)" }}>
                  <QRCodeSVG value={setup.qr_url} size={200} />
                </div>
              </div>
              <div className="mt-3 text-center">
                <div
                  className="text-[12px] mb-1"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  {trans("admin.profile.security.tfa.manual_label", "Manual entry secret")}
                </div>
                <div className="inline-flex items-center gap-2">
                  <code
                    className="rounded px-2 py-1 text-[12px] font-mono"
                    style={{
                      backgroundColor: "var(--admin-bg-tertiary)",
                      color: "var(--admin-text-primary)",
                    }}
                  >
                    {setup.secret}
                  </code>
                  <V2Button onClick={copySecret} variant={copiedSecret ? "primary" : undefined}>
                    {copiedSecret
                      ? trans("common.copied", "Copied")
                      : trans("common.copy", "Copy")}
                  </V2Button>
                </div>
              </div>
            </DrawerSection>
            <DrawerSection>
              <div
                className="text-[12px] font-semibold mb-2"
                style={{ color: "var(--admin-text-primary)" }}
              >
                {trans(
                  "admin.profile.security.tfa.recovery_label",
                  "Recovery codes (save these — shown once)"
                )}
              </div>
              <div
                className="grid grid-cols-2 gap-2 rounded-md p-3 border"
                style={{
                  backgroundColor: "var(--admin-bg-tertiary)",
                  borderColor: "var(--admin-border)",
                }}
              >
                {setup.recovery_codes.map((c) => (
                  <code
                    key={c}
                    className="text-[12px] font-mono"
                    style={{ color: "var(--admin-text-primary)" }}
                  >
                    {c}
                  </code>
                ))}
              </div>
            </DrawerSection>
            <DrawerSection>
              <FormField
                label={trans("admin.profile.security.tfa.code_label", "6-digit code from your app")}
                htmlFor="tfa-confirm"
              >
                <Input
                  id="tfa-confirm"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                  }
                  disabled={enrollSaving}
                />
              </FormField>
              {error ? (
                <div className="mt-2 rounded-md border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
                  {error}
                </div>
              ) : null}
            </DrawerSection>
          </>
        ) : (
          <DrawerSection>
            <span style={{ color: "var(--admin-text-secondary)" }}>
              {trans("common.loading", "Loading…")}
            </span>
          </DrawerSection>
        )}
      </Drawer>

      {/* Disable drawer */}
      <Drawer
        open={disableOpen}
        onClose={() => (enrollSaving ? undefined : (setDisableOpen(false), setPassword(""), setError(null)))}
        title={trans("admin.profile.security.tfa.disable_title", "Disable 2FA")}
        subtitle={trans(
          "admin.profile.security.tfa.disable_subtitle",
          "Confirm with your current password. Once off, sign-in will no longer ask for a code."
        )}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <V2Button
              onClick={() => {
                setDisableOpen(false);
                setPassword("");
                setError(null);
              }}
              disabled={enrollSaving}
            >
              {trans("common.cancel", "Cancel")}
            </V2Button>
            <V2Button
              variant="primary"
              onClick={() => void submitDisable()}
              disabled={enrollSaving || !password}
            >
              {enrollSaving
                ? trans("common.saving", "Saving…")
                : trans("admin.profile.security.tfa.disable_confirm", "Disable 2FA")}
            </V2Button>
          </div>
        }
      >
        <DrawerSection>
          <FormField
            label={trans("admin.profile.security.tfa.password_label", "Your current password")}
            htmlFor="tfa-disable-pw"
          >
            <Input
              id="tfa-disable-pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={enrollSaving}
            />
          </FormField>
          {error ? (
            <div className="mt-2 rounded-md border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
              {error}
            </div>
          ) : null}
        </DrawerSection>
      </Drawer>
    </V2Card>
  );
}
