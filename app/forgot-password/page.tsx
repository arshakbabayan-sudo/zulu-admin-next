"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Admin forgot-password page. Posts to POST /api/forgot-password.
 * Backend ResetPassword::createUrlUsing routes admin/operator users to admin.zulu.am/reset-password
 * (see AppServiceProvider boot()).
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-figma-bg-1 px-4 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <img src="/branding/logo-zulu.svg" alt="ZULU" className="h-16 w-auto" />
        <p className="mt-3 max-w-xs text-ds-body-2 text-fg-t6">
          Operations console — internal access only
        </p>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-fg-t11">
            {done ? t("admin.forgot.sent_title") : t("admin.forgot.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4">
              <p className="text-ds-body-3 text-fg-t7">
                {t("admin.forgot.sent_body_prefix")}
                <strong className="px-1">{email}</strong>
                {t("admin.forgot.sent_body_suffix")}
              </p>
              <p className="text-ds-body-3 text-fg-t6">{t("admin.forgot.sent_spam_hint")}</p>
              <p className="pt-2">
                <Link href="/login" className="text-ds-body-3 font-medium text-primary-500 hover:text-primary-700">
                  {t("admin.forgot.back_login")}
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <p className="text-ds-body-3 text-fg-t7">{t("admin.forgot.intro")}</p>
              <div className="space-y-1.5">
                <label htmlFor="forgot-email" className="block text-ds-input-label font-ds-input-label text-fg-t7">
                  {t("admin.login.email")}
                </label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && (
                <p className="rounded-zulu border border-error-200 bg-error-50 px-3 py-2 text-ds-body-3 text-error-700">
                  {error}
                </p>
              )}
              <Button type="submit" loading={submitting} className="mt-2">
                {submitting ? t("admin.forgot.sending") : t("admin.forgot.send_link")}
              </Button>
              <p className="text-center">
                <Link href="/login" className="text-ds-body-3 font-medium text-primary-500 hover:text-primary-700">
                  {t("admin.forgot.back_login")}
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
