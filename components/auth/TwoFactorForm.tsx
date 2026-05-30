"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiVerify2fa, apiResend2faCode } from "@/lib/auth-api";
import { ApiRequestError } from "@/lib/api-client";
import { defaultLandingPath } from "@/lib/access";
import { AUTH_PAGE_STYLES } from "@/components/auth/authPageStyles";
import { AuthVisualPane } from "@/components/auth/AuthVisualPane";

const CHALLENGE_KEY = "zulu_admin_2fa_challenge";

/**
 * Two-factor challenge gate for admin login.
 *
 * Flow:
 *   1. /login `apiLogin` returns `{ requires_2fa, challenge_token }` for a 2FA
 *      user. LoginPage stashes the challenge token in `sessionStorage` and
 *      routes here.
 *   2. User enters the 6-digit TOTP (or recovery) code.
 *   3. We POST it to `/api/account/2fa/verify` with the challenge token as the
 *      bearer. Backend mints a real session token with `*` ability and returns
 *      it. We adopt it via `loginWithToken` (stores + hydrates /me) and route
 *      to the role-specific landing page.
 *
 * The challenge token is single-use and short-lived (10 min). If the page is
 * loaded without one in sessionStorage, we send the user back to /login.
 *
 * Mirrors the customer-side `zulu-frontend-next/components/auth/TwoFactorForm.tsx`
 * pattern; uses admin design tokens (Card primitive + figma-bg / fg-tN scale).
 */
export function TwoFactorForm() {
  const { t } = useLanguage();
  // Inline-fallback shim — admin `t()` returns the key literal when a
  // translation is missing. Once these keys land in ui_translations the
  // shim picks them up automatically; for now the English string ships.
  const tt = (key: string, fallback: string) => {
    const got = t(key);
    return got === key ? fallback : got;
  };
  const { loginWithToken } = useAdminAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") ?? "";

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    const cleaned = value.replace(/\D/g, "").slice(0, 1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = cleaned;
      return next;
    });
    if (cleaned && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i += 1) next[i] = pasted[i]!;
    setDigits(next);
    const focusIndex = Math.min(pasted.length, 5);
    inputsRef.current[focusIndex]?.focus();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) {
      setError(tt("admin.tfa.enter_all_digits", "Enter all 6 digits."));
      return;
    }
    const challengeToken =
      typeof window !== "undefined" ? sessionStorage.getItem(CHALLENGE_KEY) : null;
    if (!challengeToken) {
      setError(tt("admin.tfa.session_expired", "Session expired — please sign in again."));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const verifyRes = await apiVerify2fa(challengeToken, code);
      const newToken = verifyRes.data?.token;
      if (!newToken) {
        throw new ApiRequestError(tt("admin.tfa.failed", "Verification failed."), 500);
      }
      // Challenge consumed — drop it so a refresh can't replay it.
      sessionStorage.removeItem(CHALLENGE_KEY);
      const loggedInUser = await loginWithToken(newToken);
      router.replace(defaultLandingPath(loggedInUser));
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : tt("admin.tfa.failed", "Verification failed.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    const challengeToken =
      typeof window !== "undefined" ? sessionStorage.getItem(CHALLENGE_KEY) : null;
    if (!challengeToken) {
      setResendNote(tt("admin.tfa.session_expired", "Session expired — please sign in again."));
      return;
    }
    setResending(true);
    setResendNote(null);
    try {
      await apiResend2faCode(challengeToken);
      setResendNote(tt("admin.tfa.resent", "If your account uses email codes, a new one is on the way."));
    } catch {
      setResendNote(tt("admin.tfa.resend_failed", "Couldn't resend — try again in a moment."));
    } finally {
      setResending(false);
    }
  }

  const maskedEmail = emailParam || "name@example.com";

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
              {tt("admin.tfa.title", "Two-factor verification")}
            </h2>
            <p className={AUTH_PAGE_STYLES.headingSubtitle}>
              {tt("admin.tfa.subtitle_prefix", "Enter the 6-digit code from your authenticator app for ")}
              <strong className="text-fg-t7">{maskedEmail}</strong>
              {tt("admin.tfa.subtitle_suffix", ".")}
            </p>
          </div>

          {error && (
            <div role="alert" className={AUTH_PAGE_STYLES.alertBox}>
              <span className={AUTH_PAGE_STYLES.alertText}>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className={AUTH_PAGE_STYLES.formStack}>
            <div className="flex justify-center gap-2 sm:gap-3">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputsRef.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="h-14 w-12 rounded-2xl border border-default bg-white text-center text-xl font-semibold text-fg-t11 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-colors"
                  aria-label={`${tt("admin.tfa.digit_aria", "Digit")} ${index + 1}`}
                />
              ))}
            </div>

            <p className="text-center text-sm text-fg-t6">
              {tt("admin.tfa.didnt_get", "Didn't get a code?")}{" "}
              <button
                type="button"
                onClick={onResend}
                disabled={resending}
                className={AUTH_PAGE_STYLES.linkPrimary + " underline disabled:opacity-60"}
              >
                {resending
                  ? tt("admin.tfa.resending", "Sending…")
                  : tt("admin.tfa.resend", "Resend")}
              </button>
            </p>
            {resendNote && (
              <p className="text-center text-xs text-fg-t6">{resendNote}</p>
            )}

            <button
              type="submit"
              disabled={submitting || digits.join("").length !== 6}
              className={`${AUTH_PAGE_STYLES.primaryButton} mt-2`}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {tt("admin.tfa.verifying", "Verifying…")}
                </span>
              ) : (
                tt("admin.tfa.verify", "Verify and sign in")
              )}
            </button>
          </form>

          <p className="mt-4 text-center">
            <Link href="/login" className={AUTH_PAGE_STYLES.linkPrimary + " text-sm underline"}>
              {tt("admin.tfa.back_login", "Back to sign in")}
            </Link>
          </p>
        </div>
      </div>
      <AuthVisualPane />
    </div>
  );
}
