"use client";

/**
 * Platform admin → user detail/edit page.
 *
 * Surfaces the same personal-information fields the customer can self-edit
 * on /account (name, phone, birth_date, nationality, preferred_language)
 * plus admin-only knobs (status, company memberships). Mirrors the Zulu_10
 * Profile re-skin layout in the admin shell.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { StatusPill } from "@/components/ui/StatusPill";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiDeactivatePlatformUser,
  apiShowPlatformUser,
  apiUpdatePlatformUser,
  type PlatformAdminUserDetail,
  type UpdatePlatformUserInput,
} from "@/lib/platform-admin-api";
import { apiBookings, type BookingRow } from "@/lib/bookings-api";
import { PageHeader as V2PageHeader, V2Card } from "@/components/ui/v2";

const LANG_OPTIONS = [
  { value: "", label: "—" },
  { value: "en", label: "English" },
  { value: "hy", label: "Հայերեն" },
  { value: "ru", label: "Русский" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "pending", label: "Pending" },
  { value: "suspended", label: "Suspended" },
];

type FormState = {
  name: string;
  phone: string;
  birth_date: string;
  nationality: string;
  preferred_language: string;
  status: string;
};

function formFromUser(u: PlatformAdminUserDetail): FormState {
  return {
    name: u.name ?? "",
    phone: u.phone ?? "",
    birth_date: u.birth_date ?? "",
    nationality: u.nationality ?? "",
    preferred_language: u.preferred_language ?? "",
    status: u.status ?? "active",
  };
}

export default function PlatformUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, user: me } = useAdminAuth();
  const { t } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessPlatformAdminNav(me);
  const userId = Number(params?.id);

  const [user, setUser] = useState<PlatformAdminUserDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  /**
   * Phase 4G (2026-05-31) — Recent bookings card: only fetched when the
   * user is a B2C customer (zero company memberships). We refetch once
   * the user record arrives.
   */
  const [recentBookings, setRecentBookings] = useState<BookingRow[] | null>(null);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed || !userId) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await apiShowPlatformUser(token, userId);
      setUser(res.data);
      setForm(formFromUser(res.data));
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.users.err_load"));
    } finally {
      setLoading(false);
    }
  }, [token, allowed, userId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Phase 4G — fetch recent bookings once we know the user is a customer.
  useEffect(() => {
    if (!token || !user) return;
    if (user.companies && user.companies.length > 0) {
      // Staff/agent — no bookings card.
      setRecentBookings(null);
      return;
    }
    let cancelled = false;
    setBookingsError(null);
    (async () => {
      try {
        const res = await apiBookings(token, { user_id: user.id, per_page: 5 });
        if (!cancelled) setRecentBookings(res.data);
      } catch (e) {
        if (!cancelled) {
          setBookingsError(
            e instanceof ApiRequestError ? e.message : "Failed to load recent bookings"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  useEffect(() => {
    if (!saveSuccess) return;
    const tm = window.setTimeout(() => setSaveSuccess(false), 2500);
    return () => window.clearTimeout(tm);
  }, [saveSuccess]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !form || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const payload: UpdatePlatformUserInput = {
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || null,
        birth_date: form.birth_date || null,
        nationality: form.nationality.trim() || null,
        preferred_language: form.preferred_language || null,
        status: form.status,
      };
      const res = await apiUpdatePlatformUser(token, userId, payload);
      setUser(res.data);
      setForm(formFromUser(res.data));
      setSaveSuccess(true);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.users.err_update"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!token || !user) return;
    const ok = await confirm({
      message: t("admin.users.confirm_deactivate").replace("{id}", String(user.id)),
      variant: "danger",
    });
    if (!ok) return;
    try {
      await apiDeactivatePlatformUser(token, user.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.users.err_deactivate"));
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.users.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice messageKey={!allowed ? "admin.forbidden.platform_users" : undefined} />
        </div>
      </div>
    );
  }

  if (loading || !user || !form) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-40 animate-pulse rounded bg-figma-bg-1" />
        <div className="admin-card h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Management", href: "/platform/users" },
          { label: t("admin.users.title"), href: "/platform/users" },
          { label: user.name || user.email },
        ]}
        title={user.name || user.email}
        subtitle={
          <span className="flex items-center gap-2">
            <span>{user.email}</span>
            <span>·</span>
            <span>#{user.id}</span>
            <StatusPill status={user.status} />
            {user.is_super_admin ? (
              <span className="inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                Super admin
              </span>
            ) : null}
          </span>
        }
      />

      <div className="space-y-6">
      {err ? (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      ) : null}
      {saveSuccess ? (
        <div className="rounded-zulu border border-success-100 bg-success-50 px-4 py-2 text-sm text-success-700">
          {t("admin.users.save_success") === "admin.users.save_success" ? "User updated." : t("admin.users.save_success")}
        </div>
      ) : null}

      <V2Card>
      <form onSubmit={handleSubmit} className="space-y-5 p-5">
        <h2 className="text-lg font-semibold text-fg-t8">
          {t("admin.users.section.personal") === "admin.users.section.personal"
            ? "Personal information"
            : t("admin.users.section.personal")}
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("admin.users.field.name") === "admin.users.field.name" ? "Full name" : t("admin.users.field.name")}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={saving}
              className="h-10 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
            />
          </Field>
          <Field label="Email">
            <input type="email" value={user.email} disabled className="h-10 w-full rounded-zulu border border-default bg-figma-bg-1 px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60" />
          </Field>
          <Field label={t("admin.users.field.phone") === "admin.users.field.phone" ? "Phone" : t("admin.users.field.phone")}>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              disabled={saving}
              className="h-10 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
            />
          </Field>
          <Field label={t("admin.users.field.birth_date") === "admin.users.field.birth_date" ? "Birth date" : t("admin.users.field.birth_date")}>
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              disabled={saving}
              className="h-10 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
            />
          </Field>
          <Field label={t("admin.users.field.nationality") === "admin.users.field.nationality" ? "Nationality" : t("admin.users.field.nationality")}>
            <input
              type="text"
              value={form.nationality}
              onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              disabled={saving}
              className="h-10 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
            />
          </Field>
          <Field label={t("admin.users.field.language") === "admin.users.field.language" ? "Preferred language" : t("admin.users.field.language")}>
            <select
              value={form.preferred_language}
              onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}
              disabled={saving}
              className="h-10 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
            >
              {LANG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label={t("admin.users.field.status") === "admin.users.field.status" ? "Status" : t("admin.users.field.status")}>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              disabled={saving}
              className="h-10 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={saving || user.status === "inactive"}
            className="inline-flex h-10 items-center rounded-zulu border border-error-200 bg-white px-3 text-sm font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
          >
            {t("admin.users.btn_deactivate")}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/platform/users")}
              disabled={saving}
              className="inline-flex h-10 items-center rounded-zulu border border-default bg-white px-4 text-sm font-medium text-fg-t8 transition hover:bg-figma-bg-1 disabled:opacity-40"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {saving ? (t("common.saving") === "common.saving" ? "Saving…" : t("common.saving")) : t("common.save")}
            </button>
          </div>
        </div>
      </form>
      </V2Card>

      {user.companies.length > 0 ? (
        <V2Card className="p-5">
          <h2 className="text-lg font-semibold text-fg-t8">
            {t("admin.users.section.companies") === "admin.users.section.companies"
              ? "Companies"
              : t("admin.users.section.companies")}
          </h2>
          <ul className="mt-3 space-y-2">
            {user.companies.map((c, i) => (
              <li
                key={`${c.id}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-zulu border border-default p-3"
              >
                <Link href={`/platform/companies/${c.id}`} className="font-medium text-primary hover:underline">
                  {c.name}
                </Link>
                <span className="rounded-full bg-figma-bg-1 px-2 py-0.5 text-xs text-fg-t7">{c.role}</span>
              </li>
            ))}
          </ul>
        </V2Card>
      ) : null}

      {/* Phase 4G (2026-05-31) — Recent bookings card for B2C customers.
          Renders only when the user has zero company memberships (= a
          customer rather than staff). Shows up to 5 most recent bookings
          with a "View all" link to /platform/bookings?user_id=<id>. The
          unified backend endpoint took the same filter in the matching
          backend commit. */}
      {user.companies.length === 0 ? (
        <V2Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-fg-t8">Recent bookings</h2>
            <Link
              href={`/platform/bookings?user_id=${user.id}`}
              className="text-sm font-medium hover:underline"
              style={{ color: "var(--admin-primary)" }}
            >
              View all →
            </Link>
          </div>
          {bookingsError ? (
            <div className="mt-3 rounded-md border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
              {bookingsError}
            </div>
          ) : recentBookings === null ? (
            <div className="mt-3 text-sm text-fg-t7">Loading…</div>
          ) : recentBookings.length === 0 ? (
            <div className="mt-3 text-sm text-fg-t7">
              No bookings yet.
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentBookings.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-zulu border border-default p-3"
                >
                  <Link
                    href={`/platform/bookings/${b.id}`}
                    className="font-medium hover:underline"
                    style={{ color: "var(--admin-primary)" }}
                  >
                    {b.order_number || b.booking_reference || `#${b.id.slice(0, 8)}`}
                  </Link>
                  <span className="text-xs text-fg-t7">
                    {b.offer?.title || b.items?.[0]?.title || "—"}
                  </span>
                  <span className="rounded-full bg-figma-bg-1 px-2 py-0.5 text-xs text-fg-t7">
                    {b.status}
                  </span>
                  <span className="tabular-nums text-xs text-fg-t7">
                    {b.total !== undefined && b.total !== null
                      ? `${b.total} ${b.currency || ""}`
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </V2Card>
      ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-fg-t7">{label}</span>
      {children}
    </label>
  );
}
