"use client";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

/**
 * Figma layout reference: Quest CRM Copy template
 *   - Login (desktop):  4299:7448
 *   - Sign in (mobile): 10171:23225
 * Brand tokens: ZULU purple primary (--admin-primary).
 * Logo + tagline above card, centered card form.
 * Last synced: 2026-05-03 (replaces earlier ADR-008 §3 "pragmatic" note —
 * we now have an admin design reference via the Quest CRM template).
 */
export default function LoginPage() {
  const { t } = useLanguage();
  const { login, token, user, bootstrapped, loading, error } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (bootstrapped && token && user) {
      router.replace("/dashboard");
    }
  }, [bootstrapped, token, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setLocalError(err instanceof ApiRequestError ? err.message : t("admin.login.failed"));
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-figma-bg-1 px-4 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <img src="/branding/brand-icon.svg" alt="ZULU" className="h-10 w-10" />
        <p className="mt-3 max-w-xs text-ds-body-2 text-fg-t6">
          {t("admin.login.api_hint")}
        </p>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-fg-t11">{t("admin.login.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-login-email" className="block text-ds-input-label font-ds-input-label text-fg-t7">
                {t("admin.login.email")}
              </label>
              <Input
                id="admin-login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="admin-login-password" className="block text-ds-input-label font-ds-input-label text-fg-t7">
                {t("admin.login.password")}
              </label>
              <Input
                id="admin-login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {(localError || error) && (
              <p className="rounded-zulu border border-error-200 bg-error-50 px-3 py-2 text-ds-body-3 text-error-700">
                {localError || error}
              </p>
            )}
            <Button type="submit" loading={loading} className="mt-2">
              {loading ? t("admin.login.signing_in") : t("admin.login.sign_in")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
