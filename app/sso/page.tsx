"use client";

/**
 * SSO handoff endpoint — `/sso?token=XXX&next=/operator/offers`
 *
 * Used when the customer-facing site (zulu.am) sends an already-authenticated
 * operator/agent/admin user over to admin.zulu.am via the "Open admin panel"
 * CTA on the profile page. Without this, the user's Sanctum token lives in
 * zulu.am's localStorage but admin.zulu.am sees no session and redirects to
 * the login form — forcing the user to re-enter the same credentials.
 *
 * Both apps share the same backend (`api.zulu.am/api/login`); a Sanctum token
 * issued for one subdomain works for the other. This page just copies the
 * token into admin's localStorage, fetches /account/me to populate the user
 * cache, then redirects to `next`.
 *
 * Security:
 * - Token in URL is brief (single redirect) and is replaced immediately by
 *   the saved-then-cleaned URL of `next`.
 * - We validate the token by fetching /account/me before trusting it.
 * - Bad/expired token → redirect to /login (no error leak).
 */

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ADMIN_TOKEN_STORAGE_KEY,
  ADMIN_USER_STORAGE_KEY,
} from "@/lib/auth-types";
import { apiMe } from "@/lib/auth-api";
import { defaultLandingPath } from "@/lib/access";

function SsoInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("token") ?? "";
    const next = params.get("next") ?? "";

    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await apiMe(token);
        const user = res.data;
        if (cancelled) return;
        try {
          window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
          window.localStorage.setItem(ADMIN_USER_STORAGE_KEY, JSON.stringify(user));
          window.localStorage.setItem("admin_user_fetched_at", String(Date.now()));
        } catch {
          /* localStorage may be unavailable (private browsing) */
        }
        // Choose target: explicit `next` if it looks safe, otherwise compute.
        const safeNext = /^\/[^/]/.test(next) && !next.startsWith("//") ? next : defaultLandingPath(user);
        router.replace(safeNext);
      } catch {
        if (!cancelled) router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-figma-bg-1">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" aria-hidden />
        <p className="font-sans text-ds-body-2 text-fg-t6">Signing you in…</p>
      </div>
    </div>
  );
}

export default function SsoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-figma-bg-1">
          <div className="size-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" aria-hidden />
        </div>
      }
    >
      <SsoInner />
    </Suspense>
  );
}
