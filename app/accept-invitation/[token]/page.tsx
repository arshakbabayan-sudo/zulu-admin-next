"use client";

/**
 * Bucket D Phase D.3 — public landing page for accepting an employee
 * invitation. Invitee clicks the link in their email, lands here, sets a
 * password, and gets redirected to login.
 *
 * Two API calls:
 *   GET  /auth/invitation/{token}/verify   — on mount; populates header info
 *   POST /auth/accept-invitation/{token}   — on form submit; sets password
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetchJson, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type VerifyResponse = {
  success: boolean;
  data: {
    user: { name: string; email: string };
    company: { name: string };
    role: { name: string };
    expires_at: string;
  };
};

type AcceptResponse = {
  success: boolean;
  data: { email: string };
};

type Stage = "verifying" | "ready" | "submitting" | "accepted" | "invalid";

export default function AcceptInvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params?.token ?? "";

  const [stage, setStage] = useState<Stage>("verifying");
  const [info, setInfo] = useState<VerifyResponse["data"] | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStage("invalid");
      setReason("Missing token");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetchJson<VerifyResponse>(`/auth/invitation/${token}/verify`, {
          method: "GET",
        });
        if (cancelled) return;
        setInfo(res.data);
        setStage("ready");
      } catch (e) {
        if (cancelled) return;
        setStage("invalid");
        if (e instanceof ApiRequestError) {
          const body = e.body as { reason?: string } | undefined;
          const reasonCode = body?.reason ?? "unknown";
          setReason(
            reasonCode === "expired"
              ? "This invitation has expired. Ask the person who invited you to resend it."
              : reasonCode === "already_accepted"
                ? "This invitation has already been accepted. Try signing in instead."
                : reasonCode === "revoked"
                  ? "This invitation has been revoked."
                  : "This invitation link is not valid."
          );
        } else {
          setReason("Couldn't reach the server. Please try again later.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== passwordConfirmation) {
      setErr("Passwords do not match.");
      return;
    }
    setErr(null);
    setStage("submitting");
    try {
      await apiFetchJson<AcceptResponse>(`/auth/accept-invitation/${token}`, {
        method: "POST",
        body: {
          password,
          password_confirmation: passwordConfirmation,
        },
      });
      setStage("accepted");
      setTimeout(() => router.push("/login"), 2500);
    } catch (e) {
      setStage("ready");
      setErr(e instanceof ApiRequestError ? e.message : "Failed to set password.");
    }
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: "var(--admin-bg-secondary)" }}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {stage === "accepted" ? "Welcome aboard 🎉" : "Accept invitation"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stage === "verifying" ? (
            <p className="text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
              Verifying invitation…
            </p>
          ) : null}

          {stage === "invalid" ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-error-700">{reason}</p>
              <Link
                href="/login"
                className="inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Go to sign in
              </Link>
            </div>
          ) : null}

          {(stage === "ready" || stage === "submitting") && info ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div
                className="rounded-md border px-4 py-3 text-[13px]"
                style={{
                  backgroundColor: "var(--admin-primary-soft)",
                  borderColor: "var(--admin-primary-light)",
                  color: "var(--admin-text-primary)",
                }}
              >
                <p className="font-semibold">Hello {info.user.name},</p>
                <p className="mt-1">
                  You&apos;ve been invited to join <strong>{info.company.name}</strong> as a{" "}
                  <strong>{info.role.name.replace(/_/g, " ")}</strong>.
                </p>
                <p className="mt-2 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                  Set a password to activate your account.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-fg-t8">Email</label>
                <Input value={info.user.email} disabled readOnly />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-fg-t8">
                  New password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  autoFocus
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-fg-t8">
                  Confirm password
                </label>
                <Input
                  type="password"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  minLength={8}
                  required
                />
              </div>

              {err ? (
                <div
                  className="rounded-md border px-3 py-2 text-[12px]"
                  style={{
                    borderColor: "var(--admin-danger-light)",
                    backgroundColor: "var(--admin-danger-light)",
                    color: "var(--admin-danger-dark)",
                  }}
                >
                  {err}
                </div>
              ) : null}

              <Button type="submit" disabled={stage === "submitting"} className="w-full">
                {stage === "submitting" ? "Setting password…" : "Activate account"}
              </Button>
            </form>
          ) : null}

          {stage === "accepted" ? (
            <div className="space-y-3 text-center">
              <p className="text-sm">
                Your account is active. Redirecting you to sign in…
              </p>
              <Link
                href="/login"
                className="inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Go to sign in
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
