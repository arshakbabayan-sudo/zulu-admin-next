"use client";

/**
 * Bucket D Phase D.2 — modal for adding an employee to a specific company.
 *
 * Wraps POST /companies/{id}/users with mode=invite by default. The backend
 * pre-creates the user with status=pending and a random password, then emails
 * a magic-link invitation. Manager doesn't need to share a password manually.
 *
 * Caller passes companyId; modal handles the form, validation, API call, and
 * success/error feedback. onSuccess callback fires after a successful invite
 * so the parent can refresh its employee list.
 */

import { useState } from "react";
import { X as XIcon } from "lucide-react";
import { V2Button } from "@/components/ui/v2";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiAddEmployee,
  type AddEmployeePayload,
  type CompanyEmployeeRole,
} from "@/lib/employees-api";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (user: { id: number; name: string; email: string }) => void;
  token: string | null;
  companyId: number;
  companyName?: string;
  /**
   * Restricts the role dropdown to grantable roles only. Caller computes this
   * from their own role using the same ceiling logic the backend enforces
   * (callerCanGrantRole). If omitted, shows all 4 company roles.
   */
  grantableRoles?: CompanyEmployeeRole[];
};

const ALL_ROLES: { value: CompanyEmployeeRole; label: string }[] = [
  { value: "company_viewer", label: "Company viewer (read-only)" },
  { value: "company_operator", label: "Company operator (edit access)" },
  // §7 — "Manager" (ղեկավար): full operational access, outranked only by the owner.
  { value: "company_manager", label: "Manager (runs the company day-to-day)" },
  { value: "company_admin", label: "Company admin" },
];

export function AddEmployeeModal({
  open,
  onClose,
  onSuccess,
  token,
  companyId,
  companyName,
  grantableRoles,
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleName, setRoleName] = useState<CompanyEmployeeRole>("company_viewer");
  // "invite" = email a magic-link; "direct" = manager sets a login password now
  // and hands it to the employee (Arshak 2026-06-02 self-service flow).
  const [mode, setMode] = useState<"invite" | "direct">("invite");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const roleOptions = grantableRoles
    ? ALL_ROLES.filter((r) => grantableRoles.includes(r.value))
    : ALL_ROLES;

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setRoleName("company_viewer");
    setMode("invite");
    setPassword("");
    setPasswordConfirm("");
    setErr(null);
    setFieldErrors({});
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    setFieldErrors({});

    // Direct mode: validate the password client-side before hitting the API.
    if (mode === "direct") {
      if (password.length < 8) {
        setErr("Password must be at least 8 characters.");
        return;
      }
      if (password !== passwordConfirm) {
        setErr("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: AddEmployeePayload = {
        name: name.trim(),
        email: email.trim(),
        role_name: roleName,
        phone: phone.trim() || null,
        mode,
        ...(mode === "direct" ? { password } : {}),
      };
      const res = await apiAddEmployee(token, companyId, payload);
      onSuccess?.({
        id: res.data.user.id,
        name: res.data.user.name,
        email: res.data.user.email,
      });
      reset();
      onClose();
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setErr(e.message);
        if (e.body?.errors && typeof e.body.errors === "object") {
          setFieldErrors(e.body.errors as Record<string, string[]>);
        }
      } else {
        setErr("Failed to send invitation. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3.5"
          style={{ borderColor: "var(--admin-border)" }}
        >
          <div>
            <h2 className="text-[15px] font-semibold text-fg-t8">Add employee</h2>
            {companyName ? (
              <p className="text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                to {companyName}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-t6 transition hover:bg-figma-bg-1 disabled:opacity-40"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <Field label="Full name" error={fieldErrors.name?.[0]}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={255}
              autoFocus
              className="h-[36px] w-full rounded-md border bg-white px-3 text-[13px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
              placeholder="Karen Nazaryan"
            />
          </Field>

          <Field label="Email" error={fieldErrors.email?.[0]}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
              className="h-[36px] w-full rounded-md border bg-white px-3 text-[13px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
              placeholder="karen@example.com"
            />
          </Field>

          <Field label="Phone (optional)" error={fieldErrors.phone?.[0]}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={32}
              className="h-[36px] w-full rounded-md border bg-white px-3 text-[13px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
              placeholder="+374 ..."
            />
          </Field>

          <Field label="Role" error={fieldErrors.role_name?.[0]}>
            <select
              value={roleName}
              onChange={(e) => setRoleName(e.target.value as CompanyEmployeeRole)}
              required
              className="h-[36px] w-full rounded-md border bg-white px-3 text-[13px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>

          {/* How the employee gets access: email magic-link, or a password
              the manager sets now and hands over (Arshak 2026-06-02). */}
          <Field label="Access method">
            <div className="grid grid-cols-2 gap-1 rounded-md border p-1" style={{ borderColor: "var(--admin-border)" }}>
              {([
                { v: "invite", label: "Email invite" },
                { v: "direct", label: "Set password" },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setMode(opt.v)}
                  className="h-[30px] rounded text-[12px] font-medium transition"
                  style={{
                    backgroundColor: mode === opt.v ? "var(--admin-primary)" : "transparent",
                    color: mode === opt.v ? "#fff" : "var(--admin-text-secondary)",
                  }}
                  aria-pressed={mode === opt.v}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {mode === "direct" ? (
            <>
              <Field label="Password" error={fieldErrors.password?.[0]}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-[36px] w-full rounded-md border bg-white px-3 text-[13px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                  style={{ borderColor: "var(--admin-border)" }}
                  placeholder="At least 8 characters"
                />
              </Field>
              <Field label="Confirm password">
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-[36px] w-full rounded-md border bg-white px-3 text-[13px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                  style={{ borderColor: "var(--admin-border)" }}
                  placeholder="Repeat the password"
                />
              </Field>
            </>
          ) : null}

          <p
            className="rounded-md border px-3 py-2 text-[12px]"
            style={{
              backgroundColor: "var(--admin-primary-soft)",
              borderColor: "var(--admin-primary-light)",
              color: "var(--admin-text-secondary)",
            }}
          >
            {mode === "invite"
              ? "The employee will receive an email with a link to set their password. The invitation is valid for 7 days."
              : "The employee is created immediately with this password and can sign in at admin.zulu.am right away. Share the login + password with them securely."}
          </p>

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

          <div className="flex items-center justify-end gap-2 pt-2">
            <V2Button type="button" onClick={handleClose} disabled={submitting}>
              Cancel
            </V2Button>
            <V2Button type="submit" variant="primary" disabled={submitting || !token}>
              {submitting
                ? mode === "invite" ? "Sending…" : "Creating…"
                : mode === "invite" ? "Send invite" : "Create employee"}
            </V2Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-fg-t8">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] text-error-700">{error}</span>
      ) : null}
    </label>
  );
}
