"use client";

/**
 * Phase 7.14 — Per-user PIN for sensitive admin actions.
 *
 * Replaces the ComingSoonPage placeholder. User sets / changes / clears
 * their own PIN here. Sensitive admin actions elsewhere can call the
 * verify endpoint before proceeding (wired into individual actions as
 * they adopt PIN gating).
 *
 * Backend:
 *   GET    /account/pin          → { is_set, set_at }
 *   POST   /account/pin          → { password, current_pin?, new_pin } → updates
 *   POST   /account/pin/verify   → { pin } → 200 on match
 *   DELETE /account/pin          → { password } → clears PIN
 */

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiSuccessEnvelope } from "@/lib/api-envelope";
import { Button, FormField, Input, PageHeader } from "@/components/ui";
import { useCallback, useEffect, useState } from "react";

type PinStatus = { is_set: boolean; set_at: string | null };

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function Bucket3PinSettingsPage() {
  const { token } = useAdminAuth();
  const confirm = useConfirm();
  const { t } = useLanguage();
  const [status, setStatus] = useState<PinStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Set / change form
  const [password, setPassword] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  // Verify-test form
  const [testPin, setTestPin] = useState("");
  const [verifyResult, setVerifyResult] = useState<"ok" | "fail" | null>(null);

  // Clear form
  const [clearPassword, setClearPassword] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const res = await apiFetchJson<ApiSuccessEnvelope<PinStatus>>(`/account/pin`, {
        method: "GET",
        token,
      });
      setStatus(res.data);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to load PIN status");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSetOrChange() {
    if (!token || !status) return;
    setErr(null);
    setSavedAt(null);
    if (!/^\d{4,8}$/.test(newPin)) {
      setErr(t("admin.bucket3.pin_settings.error.pin_format"));
      return;
    }
    if (newPin !== confirmPin) {
      setErr(t("admin.bucket3.pin_settings.error.mismatch"));
      return;
    }
    if (!password) {
      setErr(t("admin.bucket3.pin_settings.error.password_required"));
      return;
    }
    if (status.is_set && !currentPin) {
      setErr(t("admin.bucket3.pin_settings.error.current_pin_required"));
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { password, new_pin: newPin };
      if (status.is_set) body.current_pin = currentPin;
      await apiFetchJson<ApiSuccessEnvelope<PinStatus>>(`/account/pin`, {
        method: "POST",
        token,
        body,
      });
      setSavedAt(new Date().toLocaleTimeString());
      setPassword("");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to save PIN");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!token) return;
    setVerifyResult(null);
    setErr(null);
    if (!/^\d{4,8}$/.test(testPin)) {
      setErr(t("admin.bucket3.pin_settings.error.pin_format"));
      return;
    }
    setBusy(true);
    try {
      await apiFetchJson<ApiSuccessEnvelope<{ verified: true }>>(`/account/pin/verify`, {
        method: "POST",
        token,
        body: { pin: testPin },
      });
      setVerifyResult("ok");
      setTestPin("");
    } catch {
      setVerifyResult("fail");
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (!token) return;
    setErr(null);
    if (!clearPassword) {
      setErr(t("admin.bucket3.pin_settings.error.clear_password_required"));
      return;
    }
    const ok = await confirm({ messageKey: "admin.bucket3.pin_settings.confirm_clear", variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetchJson<ApiSuccessEnvelope<PinStatus>>(`/account/pin`, {
        method: "DELETE",
        token,
        body: { password: clearPassword },
      });
      setClearPassword("");
      setSavedAt(new Date().toLocaleTimeString());
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to clear PIN");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.bucket3.pin_settings.title")}
        subtitle={t("admin.bucket3.pin_settings.subtitle")}
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}
      {savedAt && (
        <div className="rounded-zulu border border-success-200 bg-success-50 px-4 py-2 text-sm text-success-700">
          {t("admin.bucket3.pin_settings.saved_at").replace("{time}", savedAt)}
        </div>
      )}

      <section className="admin-card p-4 space-y-2">
        <h2 className="text-base font-semibold">{t("admin.bucket3.pin_settings.status")}</h2>
        {status === null ? (
          <p className="text-sm text-fg-t6">{t("common.loading")}</p>
        ) : status.is_set ? (
          <p className="text-sm text-fg-t8">
            {t("admin.bucket3.pin_settings.pin_is_set")}
            <span className="ml-2 text-xs text-fg-t6">{t("admin.bucket3.pin_settings.last_set").replace("{date}", formatDate(status.set_at))}</span>
          </p>
        ) : (
          <p className="text-sm text-warning-700">{t("admin.bucket3.pin_settings.no_pin_set")}</p>
        )}
      </section>

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">
          {status?.is_set ? t("admin.bucket3.pin_settings.change_pin") : t("admin.bucket3.pin_settings.set_pin")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label={t("admin.bucket3.pin_settings.field.account_password")}
            htmlFor="pin-password"
            required
            helperText={t("admin.bucket3.pin_settings.field.account_password_helper")}
          >
            <Input
              id="pin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          {status?.is_set && (
            <FormField label={t("admin.bucket3.pin_settings.field.current_pin")} htmlFor="current-pin" required>
              <Input
                id="current-pin"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
              />
            </FormField>
          )}
          <FormField label={t("admin.bucket3.pin_settings.field.new_pin")} htmlFor="new-pin" required>
            <Input
              id="new-pin"
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
            />
          </FormField>
          <FormField label={t("admin.bucket3.pin_settings.field.confirm_pin")} htmlFor="confirm-pin" required>
            <Input
              id="confirm-pin"
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            />
          </FormField>
        </div>
        <div>
          <Button size="sm" disabled={busy} onClick={() => void handleSetOrChange()}>
            {busy ? t("common.saving") : status?.is_set ? t("admin.bucket3.pin_settings.change_pin") : t("admin.bucket3.pin_settings.set_pin")}
          </Button>
        </div>
      </section>

      {status?.is_set && (
        <>
          <section className="admin-card p-4 space-y-3">
            <h2 className="text-base font-semibold">{t("admin.bucket3.pin_settings.test_pin")}</h2>
            <p className="text-xs text-fg-t6">
              {t("admin.bucket3.pin_settings.test_pin_helper")}
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <FormField label={t("admin.bucket3.pin_settings.field.pin")} htmlFor="test-pin" className="max-w-[220px]">
                <Input
                  id="test-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={testPin}
                  onChange={(e) => setTestPin(e.target.value.replace(/\D/g, ""))}
                />
              </FormField>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleVerify()}>
                {t("admin.bucket3.pin_settings.verify")}
              </Button>
              {verifyResult === "ok" && (
                <span className="text-sm font-medium text-success-700">{t("admin.bucket3.pin_settings.pin_matches")}</span>
              )}
              {verifyResult === "fail" && (
                <span className="text-sm font-medium text-error-700">{t("admin.bucket3.pin_settings.pin_incorrect")}</span>
              )}
            </div>
          </section>

          <section className="admin-card p-4 space-y-3 border-error-100">
            <h2 className="text-base font-semibold text-error-700">{t("admin.bucket3.pin_settings.clear_pin")}</h2>
            <p className="text-xs text-fg-t6">
              {t("admin.bucket3.pin_settings.clear_pin_helper")}
            </p>
            <FormField label={t("admin.bucket3.pin_settings.field.account_password")} htmlFor="clear-password" required>
              <Input
                id="clear-password"
                type="password"
                autoComplete="current-password"
                value={clearPassword}
                onChange={(e) => setClearPassword(e.target.value)}
              />
            </FormField>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => void handleClear()}>
              {t("admin.bucket3.pin_settings.clear_pin")}
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
