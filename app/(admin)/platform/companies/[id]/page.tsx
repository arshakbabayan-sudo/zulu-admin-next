"use client";

/**
 * Figma reference: Quest CRM "Admin Profile" frame (node 2921:2490).
 * Borrowed patterns:
 *   - Page title + subtitle centered at top
 *   - Horizontal tab bar under the title
 *   - Section cards with Edit button on each card
 *   - Cancel + Save sticky at the bottom of edits
 * ZULU additions:
 *   - Back link (top-left)
 *   - Per-page language switcher (EN/HY/RU) at top-right for viewing translated fields
 * Brand: ZULU purple primary (--admin-primary).
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PartnerSettingsModal } from "@/components/PartnerSettingsModal";
import CompanyCommissionTab from "@/components/CompanyCommissionTab";
import { StatusPill, autoStatusTone } from "@/components/ui/StatusPill";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiCompanyApplications,
  apiPatchCompanyGovernance,
  apiPatchCompanyProfile,
  apiPlatformCompany,
  apiPlatformUsers,
  apiToggleCompanySeller,
  type CompanyApplicationRow,
  type CompanyProfileEditable,
  type PlatformAdminUserRow,
  type PlatformCompanyRow,
} from "@/lib/platform-admin-api";
import { StatusPill as _StatusPill } from "@/components/ui/StatusPill";
import { PageHeader as V2PageHeader, V2Card, V2Button } from "@/components/ui/v2";
import { AddEmployeeModal } from "@/components/employees/AddEmployeeModal";
import { EmployeePermissionsDrawer } from "@/components/employees/EmployeePermissionsDrawer";
import { Plus } from "lucide-react";

const GOVERNANCE_STATUSES = ["pending", "active", "suspended", "rejected"] as const;
// 2026-06-04 admin v3 — 6-tab spec from docs/blueprints/html-handoff/Management_tab.md:
// Profile (incl. Partner toggle) · Staff · Applications · Seller perms · Commission · Payments.
// "Partner" + "Translations" tabs were folded/dropped; "Payments" is new.
type Tab =
  | "profile"
  | "users"
  | "applications"
  | "permissions"
  | "commission"
  | "payments";

export default function PlatformCompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const companyId = Number(params?.id);
  const { t, lang, setLang, languageOptions } = useLanguage();
  const { token, user } = useAdminAuth();
  const confirm = useConfirm();
  const allowed = canAccessPlatformAdminNav(user);

  const [company, setCompany] = useState<PlatformCompanyRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("profile");
  const [draftGovernance, setDraftGovernance] = useState<string>("");
  const [partnerOpen, setPartnerOpen] = useState(false);

  // Phase 2 — lazy-loaded data for the new tabs.
  const [linkedUsers, setLinkedUsers] = useState<PlatformAdminUserRow[] | null>(null);
  const [linkedUsersErr, setLinkedUsersErr] = useState<string | null>(null);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [permEmployee, setPermEmployee] = useState<{ id: number; name: string } | null>(null);
  const [appsHistory, setAppsHistory] = useState<CompanyApplicationRow[] | null>(null);
  const [appsHistoryErr, setAppsHistoryErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed || !Number.isFinite(companyId)) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformCompany(token, companyId);
      setCompany(res.data);
      setDraftGovernance(res.data.governance_status);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_load"));
    }
  }, [token, allowed, companyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Phase 2 — fetch the Users tab content the first time it's opened.
  useEffect(() => {
    if (tab !== "users" || !token || !company || linkedUsers !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiPlatformUsers(token, { type: "staff", per_page: 100 });
        if (cancelled) return;
        const matches = res.data.filter((u) =>
          u.companies?.some((c) => c.id === company.id),
        );
        setLinkedUsers(matches);
      } catch (e) {
        if (cancelled) return;
        setLinkedUsersErr(
          e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_users_load"),
        );
        setLinkedUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, token, company, linkedUsers, t]);

  // Phase 2 — fetch the Applications history tab content the first time it's opened.
  // 2026-06-04 (admin v3) — switched from name-matching to the real `company_id`
  // filter (backend `9cc8e36` 2026-06-03 added `company_id` to GET
  // /platform-admin/applications). Removes the brittle case-sensitive name path.
  useEffect(() => {
    if (tab !== "applications" || !token || !company || appsHistory !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiCompanyApplications(token, { company_id: company.id });
        if (cancelled) return;
        setAppsHistory(res.data);
      } catch (e) {
        if (cancelled) return;
        setAppsHistoryErr(
          e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_apps_load"),
        );
        setAppsHistory([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, token, company, appsHistory, t]);

  // 2026-06-04 admin v3 — Save identity/contact via the new PATCH /profile
  // endpoint (backend `9cc8e36` 2026-06-03). Ownership-gated server-side.
  async function saveProfile(patch: CompanyProfileEditable) {
    if (!token || !company) return;
    setBusy(true);
    try {
      const res = await apiPatchCompanyProfile(token, company.id, patch);
      setCompany(res.data);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_update"));
    } finally {
      setBusy(false);
    }
  }

  async function saveGovernance() {
    if (!token || !company) return;
    if (draftGovernance === company.governance_status) {
      alert(t("admin.platform_companies.no_change_to_save"));
      return;
    }
    const reason = window.prompt(t("admin.platform_companies.optional_reason")) ?? "";
    setBusy(true);
    try {
      await apiPatchCompanyGovernance(token, company.id, {
        governance_status: draftGovernance,
        reason: reason.trim() || undefined,
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_update"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleSeller() {
    if (!token || !company) return;
    const nextLabel = company.is_seller
      ? t("admin.platform_companies.disable_seller")
      : t("admin.platform_companies.enable_seller");
    const ok = await confirm({
      message: t("admin.platform_companies.confirm_toggle_seller")
        .replace("{action}", nextLabel)
        .replace("{name}", company.name),
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiToggleCompanySeller(token, company.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_toggle"));
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.platform_companies.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-4">
        <BackLink t={t} />
        <div className="admin-card p-6 text-sm text-fg-t6">
          {err ?? t("admin.platform_companies.loading")}
        </div>
      </div>
    );
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Management", href: "/platform/companies" },
          { label: t("admin.platform_companies.title"), href: "/platform/companies" },
          { label: company.name },
        ]}
        title={company.name}
        subtitle={company.slug ?? company.legal_name ?? `ID: ${company.id}`}
        actions={
          <LanguageSwitcher
            options={languageOptions.length ? languageOptions : DEFAULT_LANG_OPTIONS}
            value={lang}
            onChange={setLang}
          />
        }
      />

      <div className="space-y-6">

      {/* Horizontal tab bar (Admin Profile pattern) — admin v3 6-tab spec. */}
      <V2Card className="overflow-hidden">
        <nav className="flex flex-wrap border-b border-default" role="tablist">
          <TabButton
            active={tab === "profile"}
            onClick={() => setTab("profile")}
            label={t("admin.platform_companies.tab_profile")}
          />
          <TabButton
            active={tab === "users"}
            onClick={() => setTab("users")}
            label={t("admin.platform_companies.tab_users")}
          />
          <TabButton
            active={tab === "applications"}
            onClick={() => setTab("applications")}
            label={t("admin.platform_companies.tab_applications")}
          />
          <TabButton
            active={tab === "permissions"}
            onClick={() => setTab("permissions")}
            label={t("admin.platform_companies.tab_permissions")}
          />
          <TabButton
            active={tab === "commission"}
            onClick={() => setTab("commission")}
            label={t("admin.platform_companies.tab_commission")}
          />
          <TabButton
            active={tab === "payments"}
            onClick={() => setTab("payments")}
            label={t("admin.platform_companies.tab_payments") !== "admin.platform_companies.tab_payments"
              ? t("admin.platform_companies.tab_payments")
              : "Payments"}
          />
        </nav>

        <div className="p-5">
          {err && (
            <div className="mb-4 rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
              {err}
            </div>
          )}

          {tab === "profile" && (
            <ProfileTab
              company={company}
              t={t}
              draftGovernance={draftGovernance}
              onDraftGovernance={setDraftGovernance}
              onSaveGovernance={() => void saveGovernance()}
              onSaveProfile={(p) => void saveProfile(p)}
              onOpenPartnerSettings={() => setPartnerOpen(true)}
              onToggleSeller={() => void toggleSeller()}
              busy={busy}
            />
          )}

          {tab === "users" && (
            <UsersTab
              companyId={companyId}
              users={linkedUsers}
              errMsg={linkedUsersErr}
              t={t}
              onAddClick={() => setAddEmployeeOpen(true)}
              onPermissionsClick={(id, name) => setPermEmployee({ id, name })}
            />
          )}

          {tab === "applications" && (
            <ApplicationsTab
              apps={appsHistory}
              errMsg={appsHistoryErr}
              t={t}
            />
          )}

          {tab === "permissions" && (
            <div className="space-y-3">
              <PlaceholderTab
                text={t("admin.platform_companies.seller_service_types")}
                hint={`${company.active_seller_permissions_count ?? 0} ${t("admin.platform_companies.yes")}`}
              />
              {user?.is_super_admin && (
                <Link
                  href={`/platform/companies/${companyId}/module-permissions`}
                  className="inline-flex h-10 items-center rounded-zulu border border-default bg-white px-4 text-sm font-semibold text-fg-t8 transition hover:bg-figma-bg-1"
                >
                  Edit admin module access →
                </Link>
              )}
            </div>
          )}

          {tab === "commission" && token && (
            <CompanyCommissionTab token={token} companyId={company.id} />
          )}

          {tab === "payments" && <PaymentsTab company={company} t={t} />}
        </div>
      </V2Card>
      </div>

      <PartnerSettingsModal
        company={partnerOpen ? company : null}
        onClose={() => setPartnerOpen(false)}
        onSaved={(next) => setCompany((prev) => (prev ? { ...prev, ...next } : prev))}
      />
      <AddEmployeeModal
        open={addEmployeeOpen}
        onClose={() => setAddEmployeeOpen(false)}
        token={token}
        companyId={company.id}
        companyName={company.name}
        onSuccess={() => {
          // Force-refresh the Users tab content by resetting it to null,
          // which triggers the existing useEffect that re-fetches.
          setLinkedUsers(null);
          setLinkedUsersErr(null);
        }}
      />
      {token && (
        <EmployeePermissionsDrawer
          open={permEmployee !== null}
          onClose={() => setPermEmployee(null)}
          token={token}
          companyId={company.id}
          userId={permEmployee?.id ?? null}
          userName={permEmployee?.name}
        />
      )}
    </div>
  );
}

const DEFAULT_LANG_OPTIONS = [
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "hy", label: "HY", flag: "🇦🇲" },
  { code: "ru", label: "RU", flag: "🇷🇺" },
];

function BackLink({ t }: { t: (k: string) => string }) {
  return (
    <Link
      href="/platform/companies"
      className="inline-flex items-center gap-2 text-sm font-medium text-fg-t7 transition hover:text-primary"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span>{t("admin.platform_companies.back_to_list")}</span>
    </Link>
  );
}

function LanguageSwitcher({
  options,
  value,
  onChange,
}: {
  options: { code: string; label: string; flag?: string }[];
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-zulu border border-default bg-white p-1">
      {options.map((o) => {
        const active = o.code === value;
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => onChange(o.code)}
            className={
              "inline-flex h-7 items-center gap-1 rounded-zulu px-2 text-xs font-medium transition " +
              (active ? "bg-primary text-white" : "text-fg-t7 hover:bg-figma-bg-1")
            }
          >
            {o.flag && <span aria-hidden>{o.flag}</span>}
            <span className="uppercase">{o.code}</span>
          </button>
        );
      })}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  fallback,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  fallback?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "relative -mb-px border-b-2 px-5 py-3 text-sm font-medium transition " +
        (active
          ? "border-primary text-primary"
          : "border-transparent text-fg-t6 hover:text-fg-t8")
      }
    >
      {label || fallback || ""}
    </button>
  );
}

/**
 * Profile tab — admin v3 (2026-06-04).
 *
 * Editable identity/contact form (saves via `PATCH /platform-admin/companies/
 * {id}/profile` — backend `9cc8e36` 2026-06-03), inline Partner-visibility
 * toggle (opens existing PartnerSettingsModal — keeps logo upload flow), and
 * the existing governance + seller cards.
 *
 * Per `docs/blueprints/html-handoff/Management_tab.md` TAB 1 detail spec.
 */
function ProfileTab({
  company,
  t,
  draftGovernance,
  onDraftGovernance,
  onSaveGovernance,
  onSaveProfile,
  onOpenPartnerSettings,
  onToggleSeller,
  busy,
}: {
  company: PlatformCompanyRow;
  t: (k: string) => string;
  draftGovernance: string;
  onDraftGovernance: (v: string) => void;
  onSaveGovernance: () => void;
  onSaveProfile: (patch: CompanyProfileEditable) => void;
  onOpenPartnerSettings: () => void;
  onToggleSeller: () => void;
  busy: boolean;
}) {
  // Local draft mirrors the editable fields. Reset whenever `company` changes
  // (after a successful save the server returns the canonical row).
  const [draft, setDraft] = useState<CompanyProfileEditable>(() => ({
    name: company.name,
    legal_name: company.legal_name ?? null,
    type: company.type ?? null,
    tax_id: company.tax_id ?? null,
    country: company.country ?? null,
    city: company.city ?? null,
    address: company.address ?? null,
    phone: company.phone ?? null,
    website: company.website ?? null,
    description: company.description ?? null,
  }));
  useEffect(() => {
    setDraft({
      name: company.name,
      legal_name: company.legal_name ?? null,
      type: company.type ?? null,
      tax_id: company.tax_id ?? null,
      country: company.country ?? null,
      city: company.city ?? null,
      address: company.address ?? null,
      phone: company.phone ?? null,
      website: company.website ?? null,
      description: company.description ?? null,
    });
  }, [company]);

  // Did any draft field diverge from the saved company row?
  const dirty =
    draft.name !== company.name ||
    (draft.legal_name ?? null) !== (company.legal_name ?? null) ||
    (draft.type ?? null) !== (company.type ?? null) ||
    (draft.tax_id ?? null) !== (company.tax_id ?? null) ||
    (draft.country ?? null) !== (company.country ?? null) ||
    (draft.city ?? null) !== (company.city ?? null) ||
    (draft.address ?? null) !== (company.address ?? null) ||
    (draft.phone ?? null) !== (company.phone ?? null) ||
    (draft.website ?? null) !== (company.website ?? null) ||
    (draft.description ?? null) !== (company.description ?? null);

  const inputClass =
    "h-10 w-full rounded-zulu border border-default bg-white px-3 text-sm text-fg-t8 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-100";
  const textareaClass =
    "min-h-[84px] w-full rounded-zulu border border-default bg-white px-3 py-2 text-sm text-fg-t8 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-100";
  const labelClass = "block text-xs font-medium text-fg-t6";

  return (
    <div className="space-y-5">
      {/* Identity card — editable */}
      <section className="rounded-zulu border border-default bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-fg-t8">
            {t("admin.platform_companies.section_company_details")}
          </h3>
          <span className="text-xs text-fg-t6">
            {t("admin.crud.common.id")}: #{company.id}
            {company.created_at ? ` · ${new Date(company.created_at).toISOString().slice(0, 10)}` : ""}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className={labelClass}>{t("admin.platform_companies.name")}</span>
            <input
              type="text"
              className={`${inputClass} mt-1`}
              value={draft.name ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("admin.platform_companies.legal_name")}</span>
            <input
              type="text"
              className={`${inputClass} mt-1`}
              value={draft.legal_name ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, legal_name: e.target.value || null }))}
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("admin.platform_companies.type")}</span>
            <input
              type="text"
              className={`${inputClass} mt-1`}
              value={draft.type ?? ""}
              placeholder="operator / agency / airline / hotel_chain / other"
              onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value || null }))}
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("admin.platform_companies.tax_id")}</span>
            <input
              type="text"
              className={`${inputClass} mt-1`}
              value={draft.tax_id ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, tax_id: e.target.value || null }))}
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("admin.platform_companies.country")}</span>
            <input
              type="text"
              className={`${inputClass} mt-1`}
              value={draft.country ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, country: e.target.value || null }))}
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("admin.platform_companies.city")}</span>
            <input
              type="text"
              className={`${inputClass} mt-1`}
              value={draft.city ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value || null }))}
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className={labelClass}>{t("admin.platform_companies.address")}</span>
            <input
              type="text"
              className={`${inputClass} mt-1`}
              value={draft.address ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value || null }))}
            />
          </label>
          <label className="block">
            <span className={labelClass}>{t("admin.platform_companies.phone")}</span>
            <input
              type="tel"
              className={`${inputClass} mt-1`}
              value={draft.phone ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value || null }))}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelClass}>{t("admin.platform_companies.website")}</span>
            <input
              type="url"
              className={`${inputClass} mt-1`}
              value={draft.website ?? ""}
              placeholder="https://"
              onChange={(e) => setDraft((p) => ({ ...p, website: e.target.value || null }))}
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className={labelClass}>{t("admin.platform_companies.description")}</span>
            <textarea
              className={`${textareaClass} mt-1`}
              value={draft.description ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value || null }))}
            />
          </label>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => setDraft({
              name: company.name,
              legal_name: company.legal_name ?? null,
              type: company.type ?? null,
              tax_id: company.tax_id ?? null,
              country: company.country ?? null,
              city: company.city ?? null,
              address: company.address ?? null,
              phone: company.phone ?? null,
              website: company.website ?? null,
              description: company.description ?? null,
            })}
            className="inline-flex h-10 items-center rounded-zulu border border-default bg-white px-4 text-sm font-medium text-fg-t7 transition hover:bg-figma-bg-1 disabled:opacity-40"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => onSaveProfile(draft)}
            className="inline-flex h-10 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {t("common.save")}
          </button>
        </div>
      </section>

      {/* Public-Partners visibility — folds in the old standalone "Partner" tab. */}
      <section className="rounded-zulu border border-default bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-fg-t8">
              {t("admin.platform_companies.partner_section_title") !== "admin.platform_companies.partner_section_title"
                ? t("admin.platform_companies.partner_section_title")
                : "Public Partners visibility"}
            </h3>
            <p className="mt-1 text-xs text-fg-t6">
              {company.is_partner_visible
                ? t("admin.platform_companies.partner_on")
                : t("admin.platform_companies.partner_off")}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPartnerSettings}
            className="inline-flex h-10 items-center rounded-zulu border border-default bg-white px-4 text-sm font-medium text-fg-t7 transition hover:bg-figma-bg-1"
          >
            {t("admin.platform_companies.edit")}
          </button>
        </div>
      </section>

      {/* Governance card — editable. */}
      <section className="rounded-zulu border border-default bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-fg-t8">
          {t("admin.platform_companies.governance")}
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-fg-t6">
            <span className="mb-1 block font-medium text-fg-t7">
              {t("admin.platform_companies.governance")}
            </span>
            <select
              value={draftGovernance}
              onChange={(e) => onDraftGovernance(e.target.value)}
              className="h-10 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              {GOVERNANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <StatusPill status={company.governance_status} tone={autoStatusTone(company.governance_status)} />
          <button
            type="button"
            disabled={busy || draftGovernance === company.governance_status}
            onClick={onSaveGovernance}
            className="inline-flex h-10 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {t("admin.platform_companies.save_gov")}
          </button>
          <span className="ml-auto text-xs text-fg-t6">
            {company.profile_completed
              ? t("admin.platform_companies.profile_completed_yes") !== "admin.platform_companies.profile_completed_yes"
                ? t("admin.platform_companies.profile_completed_yes")
                : "Profile completed"
              : t("admin.platform_companies.profile_completed_no") !== "admin.platform_companies.profile_completed_no"
                ? t("admin.platform_companies.profile_completed_no")
                : "Profile not yet complete"}
          </span>
        </div>
      </section>

      {/* Seller card. */}
      <section className="rounded-zulu border border-default bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-fg-t8">
              {t("admin.platform_companies.seller")}
            </h3>
            <p className="mt-1 text-xs text-fg-t6">
              {company.is_seller
                ? `${t("admin.platform_companies.yes")} · ${company.active_seller_permissions_count ?? 0}`
                : t("admin.platform_companies.no")}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onToggleSeller}
            className="inline-flex h-10 items-center rounded-zulu border border-primary-100 bg-primary-50 px-4 text-sm font-medium text-primary transition hover:bg-primary-100 disabled:opacity-40"
          >
            {company.is_seller
              ? t("admin.platform_companies.disable_seller")
              : t("admin.platform_companies.enable_seller")}
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Payments tab — admin v3 (2026-06-04).
 *
 * Read-only Stripe Connect status for the company (charges_enabled,
 * payouts_enabled, details_submitted, account id). Exposed by CompanyResource
 * since backend `9cc8e36` 2026-06-03. Money-flow management proper lives in
 * roadmap NEW-14 (Stripe money-flow visibility).
 */
function PaymentsTab({
  company,
  t,
}: {
  company: PlatformCompanyRow;
  t: (k: string) => string;
}) {
  const hasAccount = !!company.stripe_connect_id;
  const ready = !!(company.stripe_charges_enabled && company.stripe_payouts_enabled);
  const onboarding = hasAccount && !ready;
  return (
    <div className="space-y-4">
      <section
        className={`rounded-zulu border p-5 ${
          ready
            ? "border-success-100 bg-success-50"
            : onboarding
              ? "border-warning-100 bg-warning-50"
              : "border-default bg-figma-bg-1"
        }`}
      >
        <h3 className="text-sm font-semibold text-fg-t8">
          {ready
            ? t("admin.platform_companies.payments_ready_title") !== "admin.platform_companies.payments_ready_title"
              ? t("admin.platform_companies.payments_ready_title")
              : "Stripe — ready"
            : onboarding
              ? t("admin.platform_companies.payments_onboarding_title") !== "admin.platform_companies.payments_onboarding_title"
                ? t("admin.platform_companies.payments_onboarding_title")
                : "Stripe — onboarding pending"
              : t("admin.platform_companies.payments_none_title") !== "admin.platform_companies.payments_none_title"
                ? t("admin.platform_companies.payments_none_title")
                : "Stripe — not connected"}
        </h3>
        <p className="mt-1 text-xs text-fg-t7">
          {ready
            ? "Charges + payouts enabled. The marketplace split applies on every paid checkout."
            : onboarding
              ? "Account created, but Stripe still needs the operator to finish onboarding before money can move."
              : "This company hasn't started Stripe Connect onboarding yet."}
        </p>
      </section>

      <section className="rounded-zulu border border-default bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-fg-t8">Stripe Connect</h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field
            label="Account ID"
            value={company.stripe_connect_id ?? "—"}
          />
          <Field
            label="Charges enabled"
            value={company.stripe_charges_enabled == null ? "—" : company.stripe_charges_enabled ? "Yes" : "No"}
          />
          <Field
            label="Payouts enabled"
            value={company.stripe_payouts_enabled == null ? "—" : company.stripe_payouts_enabled ? "Yes" : "No"}
          />
          <Field
            label="Details submitted"
            value={company.stripe_details_submitted == null ? "—" : company.stripe_details_submitted ? "Yes" : "No"}
          />
        </dl>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-fg-t6">{label}</div>
      <div className="mt-1 text-sm text-fg-t8">{children ?? value ?? "—"}</div>
    </div>
  );
}

function PlaceholderTab({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="rounded-zulu border border-dashed border-default bg-figma-bg-1 p-6 text-sm text-fg-t6">
      <p className="font-medium text-fg-t7">{text}</p>
      {hint && <p className="mt-1 text-xs">{hint}</p>}
    </div>
  );
}

/**
 * Users tab — staff users linked to this company. Read-only here; the
 * full edit/delete flow lives at `/platform/users` (link out from each
 * row). Showing only staff (operator_admin + agent + staff roles), not
 * customers — customers don't belong to companies in this model.
 */
function UsersTab({
  companyId: _companyId,
  users,
  errMsg,
  t,
  onAddClick,
  onPermissionsClick,
}: {
  companyId: number;
  users: PlatformAdminUserRow[] | null;
  errMsg: string | null;
  t: (k: string) => string;
  onAddClick: () => void;
  onPermissionsClick: (userId: number, userName: string) => void;
}) {
  const header = (
    <div className="mb-3 flex items-center justify-end">
      <V2Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={onAddClick}>
        Add employee
      </V2Button>
    </div>
  );

  if (errMsg) {
    return (
      <div>
        {header}
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {errMsg}
        </div>
      </div>
    );
  }
  if (users === null) {
    return (
      <div>
        {header}
        <PlaceholderTab text={t("admin.platform_companies.loading")} />
      </div>
    );
  }
  if (users.length === 0) {
    return (
      <div>
        {header}
        <PlaceholderTab text={t("admin.platform_companies.users_empty")} />
      </div>
    );
  }
  return (
    <div>
      {header}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs font-medium uppercase tracking-wide text-fg-t6">
            <tr>
              <th scope="col" className="px-4 py-2">{t("admin.crud.common.id")}</th>
              <th scope="col" className="px-4 py-2">{t("admin.users.col_name")}</th>
              <th scope="col" className="px-4 py-2">{t("admin.users.col_email")}</th>
              <th scope="col" className="px-4 py-2">{t("admin.users.col_role")}</th>
              <th scope="col" className="px-4 py-2">{t("admin.users.col_status")}</th>
              <th scope="col" className="px-4 py-2 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const role = u.companies.find((c) => c.id === _companyId)?.role ?? "—";
              return (
                <tr key={u.id} className="border-b border-default last:border-0">
                  <td className="px-4 py-2 tabular-nums text-fg-t7">{u.id}</td>
                  <td className="px-4 py-2 font-medium text-fg-t8">{u.name}</td>
                  <td className="px-4 py-2 text-fg-t7">{u.email}</td>
                  <td className="px-4 py-2 text-fg-t7 capitalize">{role.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2">
                    <_StatusPill status={u.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => onPermissionsClick(u.id, u.name)}
                        className="text-xs text-primary underline-offset-2 hover:underline"
                      >
                        Permissions
                      </button>
                      <Link
                        href={`/platform/users/${u.id}`}
                        className="text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {t("admin.users.btn_edit")}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Applications tab — original submission + any re-submissions. Matched
 * by company_name since there's no FK from companies to applications
 * (intentional — application is pre-company-creation).
 */
function ApplicationsTab({
  apps,
  errMsg,
  t,
}: {
  apps: CompanyApplicationRow[] | null;
  errMsg: string | null;
  t: (k: string) => string;
}) {
  if (errMsg) {
    return (
      <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
        {errMsg}
      </div>
    );
  }
  if (apps === null) {
    return <PlaceholderTab text={t("admin.platform_companies.loading")} />;
  }
  if (apps.length === 0) {
    return <PlaceholderTab text={t("admin.platform_companies.apps_empty")} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-default bg-figma-bg-1 text-xs font-medium uppercase tracking-wide text-fg-t6">
          <tr>
            <th scope="col" className="px-4 py-2">{t("admin.crud.common.id")}</th>
            <th scope="col" className="px-4 py-2">{t("admin.company_applications.col_email")}</th>
            <th scope="col" className="px-4 py-2">{t("admin.company_applications.col_status")}</th>
            <th scope="col" className="px-4 py-2">{t("admin.company_applications.col_submitted")}</th>
            <th scope="col" className="px-4 py-2 text-right"> </th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id} className="border-b border-default last:border-0">
              <td className="px-4 py-2 tabular-nums text-fg-t7">A-{a.id}</td>
              <td className="px-4 py-2 text-fg-t7">{a.business_email}</td>
              <td className="px-4 py-2">
                <_StatusPill status={a.status} />
              </td>
              <td className="px-4 py-2 text-xs text-fg-t6">{a.submitted_at ?? "—"}</td>
              <td className="px-4 py-2 text-right">
                <Link
                  href={`/platform/company-applications/${a.id}`}
                  className="text-xs text-primary underline-offset-2 hover:underline"
                >
                  {t("admin.company_applications.btn_open")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
