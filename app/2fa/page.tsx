"use client";

/**
 * /2fa — admin two-factor challenge gate.
 *
 * Reached when /login receives `{ requires_2fa, challenge_token }` from the
 * backend for a 2FA-enabled account. LoginPage stashes the challenge token in
 * `sessionStorage['zulu_admin_2fa_challenge']` and routes here with the email
 * in the query string.
 *
 * Public route (outside the `(admin)` group) — no AdminAuthContext token is
 * needed to render. The form uses the challenge token from sessionStorage to
 * call `/api/account/2fa/verify`; on success the returned token is adopted
 * via `loginWithToken` and the user is redirected to their role's landing.
 */

import { Suspense } from "react";
import { TwoFactorForm } from "@/components/auth/TwoFactorForm";

export default function TwoFactorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-figma-bg-1">
          <div
            className="size-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"
            aria-hidden
          />
        </div>
      }
    >
      <TwoFactorForm />
    </Suspense>
  );
}
