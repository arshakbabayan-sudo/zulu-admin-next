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
  const allowed = canAccessPlatformAdminNav(me);
  const userId = Number(params?.id);

  const [user, setUser] = useState<PlatformAdminUserDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
    load();
  }, [load]);

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
    if (!window.confirm(t("admin.users.confirm_deactivate").replace("{id}", String(user.id)))) return;
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav className="mb-2 text-sm text-fg-t6">
            <Link href="/platform/users" className="hover:text-primary">
              {t("admin.users.title")}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-fg-t8">#{user.id}</span>
          </nav>
          <h1 className="admin-page-title">{user.name || user.email}</h1>
          <p className="mt-1 text-sm text-fg-t6">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={user.status} />
          {user.is_super_admin ? (
            <span className="inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
              Super admin
            </span>
          ) : null}
        </div>
      </header>

      {err ? (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      ) : null}
      {saveSuccess ? (
        <div className="rounded-zulu border border-success-100 bg-success-50 px-4 py-2 text-sm text-success-700">
          {t("admin.users.save_success") === "admin.users.save_success" ? "User updated." : t("admin.users.save_success")}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="admin-card space-y-5 p-5">
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
              className="h-9 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
            />
          </Field>
          <Field label="Email">
            <input type="email" value={user.email} disabled className="h-9 w-full rounded-zulu border border-default bg-figma-bg-1 px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60" />
          </Field>
          <Field label={t("admin.users.field.phone") === "admin.users.field.phone" ? "Phone" : t("admin.users.field.phone")}>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              disabled={saving}
              className="h-9 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
            />
          </Field>
          <Field label={t("admin.users.field.birth_date") === "admin.users.field.birth_date" ? "Birth date" : t("admin.users.field.birth_date")}>
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              disabled={saving}
              className="h-9 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
            />
          </Field>
          <Field label={t("admin.users.field.nationality") === "admin.users.field.nationality" ? "Nationality" : t("admin.users.field.nationality")}>
            <input
              type="text"
              value={form.nationality}
              onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              disabled={saving}
              className="h-9 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
            />
          </Field>
          <Field label={t("admin.users.field.language") === "admin.users.field.language" ? "Preferred language" : t("admin.users.field.language")}>
            <select
              value={form.preferred_language}
              onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}
              disabled={saving}
              className="h-9 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
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
              className="h-9 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
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
            className="inline-flex h-9 items-center rounded-zulu border border-error-200 bg-white px-3 text-sm font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
          >
            {t("admin.users.btn_deactivate")}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/platform/users")}
              disabled={saving}
              className="inline-flex h-9 items-center rounded-zulu border border-default bg-white px-4 text-sm font-medium text-fg-t8 transition hover:bg-figma-bg-1 disabled:opacity-40"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {saving ? (t("common.saving") === "common.saving" ? "Saving…" : t("common.saving")) : t("common.save")}
            </button>
          </div>
        </div>
      </form>

      {user.companies.length > 0 ? (
        <section className="admin-card p-5">
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
        </section>
      ) : null}
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
