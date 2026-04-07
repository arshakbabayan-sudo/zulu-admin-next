"use client";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">{t("admin.login.title")}</h1>
        <p className="mt-1 text-xs text-zinc-500">
          {t("admin.login.api_hint")}
        </p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
          <label className="text-xs font-medium text-zinc-700">
            {t("admin.login.email")}
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-zinc-700">
            {t("admin.login.password")}
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          {(localError || error) && (
            <p className="text-xs text-red-600">{localError || error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? t("admin.login.signing_in") : t("admin.login.sign_in")}
          </button>
        </form>
      </div>
    </div>
  );
}
