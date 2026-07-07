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
  apiResetPlatformUserPassword,
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

/**
 * 2026-07-07 — self-contained trilingual strings for the login-method badge and
 * the reset-password action on this page. This page uses the global `t()`
 * dictionary, but these bespoke strings are not in the DB catalog; keeping them
 * local avoids a raw-key flash and a cache dependency. Armenian = proper script.
 */
type UdLang = "hy" | "ru" | "en";
const UD_STR: Record<
  | "lmGoogle"
  | "lmFacebook"
  | "lmPassword"
  | "rpAction"
  | "rpTitle"
  | "rpIntro"
  | "rpFldNew"
  | "rpFldNewPh"
  | "rpHintAuto"
  | "rpHintManual"
  | "rpErrTooShort"
  | "rpSaveBtn"
  | "rpResultTitle"
  | "rpResultNote"
  | "rpResultCopy"
  | "rpResultCopied"
  | "rpResultDone"
  | "rpSaving"
  | "rpCancel"
  | "rpGenericErr",
  Record<UdLang, string>
> = {
  lmGoogle: { hy: "Մուտք է գործում Google-ով", ru: "Входит через Google", en: "Signs in with Google" },
  lmFacebook: { hy: "Մուտք է գործում Facebook-ով", ru: "Входит через Facebook", en: "Signs in with Facebook" },
  lmPassword: { hy: "Էլ. փոստ և գաղտնաբառ", ru: "Эл. почта и пароль", en: "Email & password" },
  rpAction: { hy: "Վերականգնել գաղտնաբառ", ru: "Сбросить пароль", en: "Reset password" },
  rpTitle: { hy: "Վերականգնել գաղտնաբառ", ru: "Сбросить пароль", en: "Reset password" },
  rpIntro: {
    hy: "Նշանակիր այս հաշվի նոր գաղտնաբառը։ Դատարկ թողնելու դեպքում ուժեղ գաղտնաբառը կստեղծվի ինքնաշխատ։ Հին գաղտնաբառը երբեք հնարավոր չէ ցույց տալ։",
    ru: "Задайте новый пароль для этого аккаунта. Оставьте поле пустым, чтобы сгенерировать надёжный пароль автоматически. Старый пароль никогда нельзя показать.",
    en: "Set a new password for this account. Leave the field empty to generate a strong one automatically. The old password can never be displayed.",
  },
  rpFldNew: { hy: "Նոր գաղտնաբառ", ru: "Новый пароль", en: "New password" },
  rpFldNewPh: { hy: "Դատարկ թող՝ ինքնաշխատ ստեղծելու համար", ru: "Оставьте пустым для автогенерации", en: "Leave empty to auto-generate" },
  rpHintAuto: {
    hy: "Դատարկ թողնելու դեպքում կստեղծվի ուժեղ պատահական գաղտնաբառ։",
    ru: "Если оставить пустым, будет сгенерирован надёжный случайный пароль.",
    en: "If left empty, a strong random password will be generated.",
  },
  rpHintManual: { hy: "Առնվազն 8 նիշ։", ru: "Не менее 8 символов.", en: "At least 8 characters." },
  rpErrTooShort: {
    hy: "Գաղտնաբառը պետք է լինի առնվազն 8 նիշ։",
    ru: "Пароль должен быть не менее 8 символов.",
    en: "The password must be at least 8 characters.",
  },
  rpSaveBtn: { hy: "Վերականգնել գաղտնաբառ", ru: "Сбросить пароль", en: "Reset password" },
  rpResultTitle: { hy: "Նոր գաղտնաբառ", ru: "Новый пароль", en: "New password" },
  rpResultNote: {
    hy: "Այս գաղտնաբառը տուր օգտատիրոջը։ Ցուցադրվում է միայն մեկ անգամ և կրկին ցույց տալ հնարավոր չէ։ Հին գաղտնաբառը երբեք հնարավոր չէ վերականգնել։",
    ru: "Передайте этот пароль пользователю. Он показывается только один раз и не может быть показан снова. Старый пароль восстановить невозможно.",
    en: "Give this password to the user. It is shown only once and cannot be displayed again. The old password can never be recovered.",
  },
  rpResultCopy: { hy: "Պատճենել", ru: "Копировать", en: "Copy" },
  rpResultCopied: { hy: "Պատճենվեց", ru: "Скопировано", en: "Copied" },
  rpResultDone: { hy: "Պատրաստ է", ru: "Готово", en: "Done" },
  rpSaving: { hy: "Պահպանվում է…", ru: "Сохранение…", en: "Saving…" },
  rpCancel: { hy: "Չեղարկել", ru: "Отмена", en: "Cancel" },
  rpGenericErr: { hy: "Սխալ տեղի ունեցավ։", ru: "Произошла ошибка.", en: "Something went wrong." },
};

function udLang(lang: string): UdLang {
  return lang === "hy" ? "hy" : lang === "ru" ? "ru" : "en";
}

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
  const { t, lang } = useLanguage();
  const L = udLang(lang);
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

  // Reset-password modal (2026-07-07 — super-admin only). `rpResult` holds the
  // freshly-SET plaintext once the backend returns it (shown once).
  const [rpOpen, setRpOpen] = useState(false);
  const [rpPw, setRpPw] = useState("");
  const [rpSaving, setRpSaving] = useState(false);
  const [rpResult, setRpResult] = useState<string | null>(null);
  const [rpError, setRpError] = useState<string | null>(null);
  const [rpCopied, setRpCopied] = useState(false);

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

  function openResetPassword() {
    setRpPw("");
    setRpResult(null);
    setRpError(null);
    setRpCopied(false);
    setRpOpen(true);
  }

  async function submitResetPassword() {
    if (!token || !user || rpSaving) return;
    const trimmed = rpPw.trim();
    // Non-empty passwords must be ≥8 chars (matches backend 422); empty is fine
    // (backend auto-generates).
    if (trimmed.length > 0 && trimmed.length < 8) {
      setRpError(UD_STR.rpErrTooShort[L]);
      return;
    }
    setRpSaving(true);
    setRpError(null);
    try {
      const res = await apiResetPlatformUserPassword(token, user.id, trimmed);
      setRpResult(res.data.new_password);
    } catch (e) {
      setRpError(e instanceof ApiRequestError ? e.message : UD_STR.rpGenericErr[L]);
    } finally {
      setRpSaving(false);
    }
  }

  async function copyResetPassword() {
    if (!rpResult) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(rpResult);
        setRpCopied(true);
        window.setTimeout(() => setRpCopied(false), 2000);
      }
    } catch {
      // Clipboard blocked — value is still visible for manual copy.
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
          <span className="flex flex-wrap items-center gap-2">
            <span>{user.email}</span>
            <LoginMethodBadge method={user.login_method} lang={L} />
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={saving || user.status === "inactive"}
              className="inline-flex h-10 items-center rounded-zulu border border-error-200 bg-white px-3 text-sm font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
            >
              {t("admin.users.btn_deactivate")}
            </button>
            {me?.is_super_admin ? (
              <button
                type="button"
                onClick={openResetPassword}
                disabled={saving}
                className="inline-flex h-10 items-center gap-1.5 rounded-zulu border border-default bg-white px-3 text-sm font-medium text-fg-t8 transition hover:bg-figma-bg-1 disabled:opacity-40"
              >
                {UD_STR.rpAction[L]}
              </button>
            ) : null}
          </div>
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

      {/* Reset-password modal (2026-07-07 — super-admin only). Overwrites the
          user's password (or auto-generates one), revokes their sessions, and
          shows the fresh plaintext ONCE. */}
      {rpOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRpOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-zulu bg-white p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-fg-t8">{UD_STR.rpTitle[L]}</h3>
              <button
                type="button"
                onClick={() => setRpOpen(false)}
                className="text-fg-t6 hover:text-fg-t8"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {rpResult === null ? (
              <>
                <p className="mb-3 text-sm text-fg-t7">{UD_STR.rpIntro[L]}</p>
                <p className="mb-3 text-sm text-fg-t8">
                  <strong>{user.name || user.email}</strong>
                  {user.email ? ` · ${user.email}` : ""}
                </p>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-fg-t7">{UD_STR.rpFldNew[L]}</span>
                  <input
                    type="text"
                    value={rpPw}
                    placeholder={UD_STR.rpFldNewPh[L]}
                    disabled={rpSaving}
                    onChange={(e) => {
                      setRpPw(e.target.value);
                      if (rpError) setRpError(null);
                    }}
                    className="h-10 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
                  />
                  <span className="text-xs text-fg-t6">
                    {rpPw.trim().length > 0 ? UD_STR.rpHintManual[L] : UD_STR.rpHintAuto[L]}
                  </span>
                </label>
                {rpError ? (
                  <p className="mt-3 text-sm text-error-700">{rpError}</p>
                ) : null}
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRpOpen(false)}
                    disabled={rpSaving}
                    className="inline-flex h-10 items-center rounded-zulu border border-default bg-white px-4 text-sm font-medium text-fg-t8 transition hover:bg-figma-bg-1 disabled:opacity-40"
                  >
                    {UD_STR.rpCancel[L]}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitResetPassword()}
                    disabled={rpSaving}
                    className="inline-flex h-10 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                  >
                    {rpSaving ? UD_STR.rpSaving[L] : UD_STR.rpSaveBtn[L]}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-fg-t7">{UD_STR.rpResultTitle[L]}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={rpResult}
                      readOnly
                      onFocus={(e) => e.currentTarget.select()}
                      className="h-10 w-full rounded-zulu border border-default bg-figma-bg-1 px-3 font-mono text-sm text-fg-t8"
                    />
                    <button
                      type="button"
                      onClick={() => void copyResetPassword()}
                      className="inline-flex h-10 shrink-0 items-center rounded-zulu border border-default bg-white px-3 text-sm font-medium text-fg-t8 transition hover:bg-figma-bg-1"
                    >
                      {rpCopied ? UD_STR.rpResultCopied[L] : UD_STR.rpResultCopy[L]}
                    </button>
                  </div>
                </label>
                <p className="mt-3 rounded-zulu border border-warning-100 bg-warning-50 px-3 py-2 text-sm text-warning-700">
                  {UD_STR.rpResultNote[L]}
                </p>
                <div className="mt-5 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setRpOpen(false)}
                    className="inline-flex h-10 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    {UD_STR.rpResultDone[L]}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Login-method badge — tells the owner HOW the account authenticates. Renders
 * nothing when `login_method` is absent (backend not yet deployed).
 */
function LoginMethodBadge({
  method,
  lang,
}: {
  method: PlatformAdminUserDetail["login_method"];
  lang: UdLang;
}) {
  if (method === "google") {
    return (
      <span className="inline-flex rounded-full bg-figma-bg-1 px-2 py-0.5 text-xs font-medium text-fg-t7">
        {UD_STR.lmGoogle[lang]}
      </span>
    );
  }
  if (method === "facebook") {
    return (
      <span className="inline-flex rounded-full bg-figma-bg-1 px-2 py-0.5 text-xs font-medium text-fg-t7">
        {UD_STR.lmFacebook[lang]}
      </span>
    );
  }
  if (method === "password") {
    return (
      <span className="inline-flex rounded-full bg-figma-bg-1 px-2 py-0.5 text-xs font-medium text-fg-t7">
        {UD_STR.lmPassword[lang]}
      </span>
    );
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-fg-t7">{label}</span>
      {children}
    </label>
  );
}
