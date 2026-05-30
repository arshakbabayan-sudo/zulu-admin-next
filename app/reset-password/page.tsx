"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { AUTH_PAGE_STYLES } from "@/components/auth/authPageStyles";
import { AuthVisualPane } from "@/components/auth/AuthVisualPane";

/**
 * Admin reset-password page. Receives token + email from query (per
 * AppServiceProvider `ResetPassword::createUrlUsing`) and posts to
 * POST /api/reset-password.
 *
 * Layout matches the rest of admin's auth chrome (Figma Zulu_2 1:4874).
 */
function ResetPasswordInner() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useSearchParams();

  const tokenFromUrl = params.get("token") ?? "";
  const emailFromUrl = params.get("email") ?? "";

  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEmail(emailFromUrl);
  }, [emailFromUrl]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("admin.reset.error_short"));
      return;
    }
    if (password !== confirm) {
      setError(t("admin.reset.error_mismatch"));
      return;
    }
    setSubmitting(true);
    try {
      await apiFetchJson("/reset-password", {
        method: "POST",
        body: {
          token: tokenFromUrl,
          email: email.trim(),
          password,
          password_confirmation: confirm,
        },
      });
      setDone(true);
      setTimeout(() => router.replace("/login"), 2500);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("admin.reset.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={AUTH_PAGE_STYLES.pageShell}>
      <div className={AUTH_PAGE_STYLES.formPane}>
        <div className={AUTH_PAGE_STYLES.contentWidth}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="mb-6 flex justify-center">
            <img src="/branding/logo-zulu.svg" alt="ZULU" className="h-12 w-auto" />
          </div>
          <div className={AUTH_PAGE_STYLES.headingBlock}>
            <h2 className={AUTH_PAGE_STYLES.headingTitleSecondary}>
              {done ? t("admin.reset.done_title") : t("admin.reset.title")}
            </h2>
            <p className={AUTH_PAGE_STYLES.headingSubtitle}>{t("admin.login.tagline")}</p>
          </div>

          {done ? (
            <div className="space-y-4">
              <p className="text-sm text-fg-t7">{t("admin.reset.done_body")}</p>
              <p className="text-center">
                <Link href="/login" className={AUTH_PAGE_STYLES.linkPrimary + " text-sm underline"}>
                  {t("admin.reset.go_login")}
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className={AUTH_PAGE_STYLES.formStack}>
              <div className={AUTH_PAGE_STYLES.fieldStack}>
                <label htmlFor="reset-email" className={AUTH_PAGE_STYLES.fieldLabel}>
                  {t("admin.login.email")}
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={AUTH_PAGE_STYLES.inputBase}
                />
              </div>
              <div className={AUTH_PAGE_STYLES.fieldStack}>
                <label htmlFor="reset-password" className={AUTH_PAGE_STYLES.fieldLabel}>
                  {t("admin.reset.new_password")}
                </label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={AUTH_PAGE_STYLES.inputBase}
                />
              </div>
              <div className={AUTH_PAGE_STYLES.fieldStack}>
                <label htmlFor="reset-confirm" className={AUTH_PAGE_STYLES.fieldLabel}>
                  {t("admin.reset.confirm_password")}
                </label>
                <input
                  id="reset-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={AUTH_PAGE_STYLES.inputBase}
                />
              </div>
              {error && (
                <div role="alert" className={AUTH_PAGE_STYLES.alertBox}>
                  <span className={AUTH_PAGE_STYLES.alertText}>{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className={`${AUTH_PAGE_STYLES.primaryButton} mt-2`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {t("admin.reset.submitting")}
                  </span>
                ) : (
                  t("admin.reset.submit")
                )}
              </button>
              <p className="text-center">
                <Link href="/login" className={AUTH_PAGE_STYLES.linkPrimary + " text-sm underline"}>
                  {t("admin.reset.back_login")}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
      <AuthVisualPane />
    </div>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
