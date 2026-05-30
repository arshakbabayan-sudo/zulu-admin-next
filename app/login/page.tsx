"use client";

import Link from "next/link";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { ApiRequestError } from "@/lib/api-client";
import { defaultLandingPath } from "@/lib/access";
import { AUTH_PAGE_STYLES } from "@/components/auth/authPageStyles";
import { AuthVisualPane } from "@/components/auth/AuthVisualPane";

/**
 * Operations console sign-in.
 *
 * Layout (Figma Zulu_2 — lCwRIXoOYmjiTPSlAckEhW, "Log in" 1:4759): two-pane
 * gradient — left form area, right ZULU-purple emblem watermark. Same chrome
 * as the customer site so a user opening admin.zulu.am after signing in on
 * zulu.am doesn't see a visually different login form. Arshak directive
 * 2026-05-31 ("admin.zulu.am մտնելուց էլ այս էջերը լինեն").
 *
 * Submit handles two outcomes:
 *  - `{kind: "authenticated"}` — route to role-specific landing.
 *  - `{kind: "two_factor"}`    — stash challenge in sessionStorage and push
 *                                to /2fa to collect the 6-digit code.
 */
export default function LoginPage() {
  const { t } = useLanguage();
  const { login, token, user, bootstrapped, loading, error } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (bootstrapped && token && user) {
      router.replace(defaultLandingPath(user));
    }
  }, [bootstrapped, token, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    try {
      const outcome = await login(email, password, rememberMe);
      if (outcome.kind === "two_factor") {
        sessionStorage.setItem("zulu_admin_2fa_challenge", outcome.challengeToken);
        const qs = new URLSearchParams({ email: email.trim() });
        router.push(`/2fa?${qs.toString()}`);
        return;
      }
      router.replace(defaultLandingPath(outcome.user));
    } catch (err) {
      setLocalError(err instanceof ApiRequestError ? err.message : t("admin.login.failed"));
    }
  }

  const errorMessage = localError || error;

  return (
    <div className={AUTH_PAGE_STYLES.pageShell}>
      <div className={AUTH_PAGE_STYLES.formPane}>
        <div className={AUTH_PAGE_STYLES.contentWidth}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="mb-6 flex justify-center">
            <img src="/branding/logo-zulu.svg" alt="ZULU" className="h-12 w-auto" />
          </div>
          <div className={AUTH_PAGE_STYLES.headingBlock}>
            <h2 className={AUTH_PAGE_STYLES.headingTitle}>{t("admin.login.title")}</h2>
            <p className={AUTH_PAGE_STYLES.headingSubtitle}>{t("admin.login.tagline")}</p>
          </div>

          {errorMessage && (
            <div role="alert" className={AUTH_PAGE_STYLES.alertBox}>
              <span className={AUTH_PAGE_STYLES.alertText}>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className={AUTH_PAGE_STYLES.formStack}>
            <div className={AUTH_PAGE_STYLES.fieldStack}>
              <label htmlFor="admin-login-email" className={AUTH_PAGE_STYLES.fieldLabel}>
                {t("admin.login.email")}
              </label>
              <input
                id="admin-login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={AUTH_PAGE_STYLES.inputBase}
              />
            </div>

            <div className={AUTH_PAGE_STYLES.fieldStack}>
              <label htmlFor="admin-login-password" className={AUTH_PAGE_STYLES.fieldLabel}>
                {t("admin.login.password")}
              </label>
              <div className="relative">
                <input
                  id="admin-login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={AUTH_PAGE_STYLES.inputWithIcon}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className={AUTH_PAGE_STYLES.iconToggle}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label
                htmlFor="admin-login-remember"
                className="flex cursor-pointer items-center gap-2 text-sm text-fg-t7 select-none"
              >
                <input
                  id="admin-login-remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-default text-primary-500 focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
                />
                {t("admin.login.remember_me")}
              </label>
              <Link href="/forgot-password" className={AUTH_PAGE_STYLES.linkPrimary + " text-sm"}>
                {t("admin.login.forgot_password_link")}
              </Link>
            </div>

            <button type="submit" disabled={loading} className={`${AUTH_PAGE_STYLES.primaryButton} mt-2`}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t("admin.login.signing_in")}
                </span>
              ) : (
                t("admin.login.sign_in")
              )}
            </button>
          </form>
        </div>
      </div>
      <AuthVisualPane />
    </div>
  );
}
