"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Admin reset-password page. Receives token + email from query (per AppServiceProvider
 * `ResetPassword::createUrlUsing`) and posts to POST /api/reset-password.
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
            {done ? t("admin.reset.done_title") : t("admin.reset.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4">
              <p className="text-ds-body-3 text-fg-t7">{t("admin.reset.done_body")}</p>
              <p>
                <Link href="/login" className="text-ds-body-3 font-medium text-primary-500 hover:text-primary-700">
                  {t("admin.reset.go_login")}
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <label htmlFor="reset-email" className="block text-ds-input-label font-ds-input-label text-fg-t7">
                  {t("admin.login.email")}
                </label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reset-password" className="block text-ds-input-label font-ds-input-label text-fg-t7">
                  {t("admin.reset.new_password")}
                </label>
                <Input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reset-confirm" className="block text-ds-input-label font-ds-input-label text-fg-t7">
                  {t("admin.reset.confirm_password")}
                </label>
                <Input
                  id="reset-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error && (
                <p className="rounded-zulu border border-error-200 bg-error-50 px-3 py-2 text-ds-body-3 text-error-700">
                  {error}
                </p>
              )}
              <Button type="submit" loading={submitting} className="mt-2">
                {submitting ? t("admin.reset.submitting") : t("admin.reset.submit")}
              </Button>
              <p className="text-center">
                <Link href="/login" className="text-ds-body-3 font-medium text-primary-500 hover:text-primary-700">
                  {t("admin.reset.back_login")}
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
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
