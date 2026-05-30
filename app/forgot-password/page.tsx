"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { AUTH_PAGE_STYLES } from "@/components/auth/authPageStyles";
import { AuthVisualPane } from "@/components/auth/AuthVisualPane";

/**
 * Admin forgot-password page. Posts to POST /api/forgot-password.
 * Backend `ResetPassword::createUrlUsing` routes admin/operator users to
 * admin.zulu.am/reset-password (see AppServiceProvider boot()).
 *
 * Layout matches the rest of admin's auth chrome — two-pane gradient with
 * the ZULU emblem on the right (Figma Zulu_2 1:4857).
 */
export default function AdminForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetchJson("/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("admin.forgot.failed"));
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
              {done ? t("admin.forgot.sent_title") : t("admin.forgot.title")}
            </h2>
            <p className={AUTH_PAGE_STYLES.headingSubtitle}>{t("admin.login.tagline")}</p>
          </div>

          {done ? (
            <div className="space-y-4">
              <p className="text-sm text-fg-t7">
                {t("admin.forgot.sent_body_prefix")}
                <strong className="px-1">{email}</strong>
                {t("admin.forgot.sent_body_suffix")}
              </p>
              <p className="text-sm text-fg-t6">{t("admin.forgot.sent_spam_hint")}</p>
              <p className="pt-2 text-center">
                <Link href="/login" className={AUTH_PAGE_STYLES.linkPrimary + " text-sm underline"}>
                  {t("admin.forgot.back_login")}
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className={AUTH_PAGE_STYLES.formStack}>
              <p className="text-sm text-fg-t7">{t("admin.forgot.intro")}</p>
              <div className={AUTH_PAGE_STYLES.fieldStack}>
                <label htmlFor="forgot-email" className={AUTH_PAGE_STYLES.fieldLabel}>
                  {t("admin.login.email")}
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                    {t("admin.forgot.sending")}
                  </span>
                ) : (
                  t("admin.forgot.send_link")
                )}
              </button>
              <p className="text-center">
                <Link href="/login" className={AUTH_PAGE_STYLES.linkPrimary + " text-sm underline"}>
                  {t("admin.forgot.back_login")}
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
