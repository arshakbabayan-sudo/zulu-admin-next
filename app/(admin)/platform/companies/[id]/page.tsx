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
import { use, useCallback, useEffect, useState } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PartnerSettingsModal } from "@/components/PartnerSettingsModal";
import { TranslationsModal } from "@/components/TranslationsModal";
import { StatusPill, autoStatusTone } from "@/components/ui/StatusPill";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiPatchCompanyGovernance,
  apiPlatformCompany,
  apiToggleCompanySeller,
  type PlatformCompanyRow,
} from "@/lib/platform-admin-api";

const GOVERNANCE_STATUSES = ["pending", "active", "suspended", "rejected"] as const;
type Tab = "profile" | "permissions" | "partner" | "translations";

export default function PlatformCompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const companyId = Number(id);
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
  const [translateOpen, setTranslateOpen] = useState(false);

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
    <div className="space-y-6">
      {/* Top bar — Back link / spacer / language switcher */}
      <header className="flex items-center justify-between gap-3">
        <BackLink t={t} />
        <LanguageSwitcher
          options={languageOptions.length ? languageOptions : DEFAULT_LANG_OPTIONS}
          value={lang}
          onChange={setLang}
        />
      </header>

      {/* Title + subtitle (Admin Profile pattern) */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-fg-t8">{company.name}</h1>
        <p className="mt-1 text-sm text-fg-t6">
          {company.slug ?? company.legal_name ?? `ID: ${company.id}`}
        </p>
      </div>

      {/* Horizontal tab bar (Admin Profile pattern) */}
      <div className="admin-card overflow-hidden">
        <nav className="flex border-b border-default" role="tablist">
          <TabButton
            active={tab === "profile"}
            onClick={() => setTab("profile")}
            label={t("admin.platform_companies.tab_profile")}
          />
          <TabButton
            active={tab === "permissions"}
            onClick={() => setTab("permissions")}
            label={t("admin.platform_companies.tab_permissions")}
          />
          <TabButton
            active={tab === "partner"}
            onClick={() => setTab("partner")}
            label={t("admin.platform_companies.tab_partner")}
          />
          <TabButton
            active={tab === "translations"}
            onClick={() => setTab("translations")}
            label={t("admin.platform_companies.tab_translations")}
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
              onToggleSeller={() => void toggleSeller()}
              busy={busy}
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

          {tab === "partner" && (
            <div className="space-y-3">
              <p className="text-sm text-fg-t7">
                {company.is_partner_visible
                  ? t("admin.platform_companies.partner_on")
                  : t("admin.platform_companies.partner_off")}
              </p>
              <button
                type="button"
                onClick={() => setPartnerOpen(true)}
                className="inline-flex h-10 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {t("admin.platform_companies.edit")}
              </button>
            </div>
          )}

          {tab === "translations" && (
            <div className="space-y-3">
              <p className="text-sm text-fg-t7">{t("admin.platform_companies.translations")}</p>
              <button
                type="button"
                onClick={() => setTranslateOpen(true)}
                className="inline-flex h-10 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {t("admin.platform_companies.edit")}
              </button>
            </div>
          )}
        </div>
      </div>

      <PartnerSettingsModal
        company={partnerOpen ? company : null}
        onClose={() => setPartnerOpen(false)}
        onSaved={(next) => setCompany((prev) => (prev ? { ...prev, ...next } : prev))}
      />
      <TranslationsModal
        open={translateOpen}
        onClose={() => setTranslateOpen(false)}
        entityType="company"
        entityId={company.id}
        entityLabel={company.name}
        fields={[
          { name: "title", label: t("admin.platform_companies.name") },
          { name: "description", label: t("admin.platform_companies.description"), multiline: true },
        ]}
      />
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

function ProfileTab({
  company,
  t,
  draftGovernance,
  onDraftGovernance,
  onSaveGovernance,
  onToggleSeller,
  busy,
}: {
  company: PlatformCompanyRow;
  t: (k: string) => string;
  draftGovernance: string;
  onDraftGovernance: (v: string) => void;
  onSaveGovernance: () => void;
  onToggleSeller: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Company details card */}
      <section className="rounded-zulu border border-default bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-fg-t8">
          {t("admin.platform_companies.section_company_details")}
        </h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("admin.crud.common.id")} value={String(company.id)} />
          <Field label={t("admin.platform_companies.name")} value={company.name} />
          <Field label={t("admin.platform_companies.type")} value={company.type ?? "—"} />
          <Field label={t("admin.platform_companies.status")}>
            {company.status ? <StatusPill status={company.status} /> : "—"}
          </Field>
          <Field label={t("admin.platform_companies.legal_name")} value={company.legal_name ?? "—"} />
          <Field label={t("admin.platform_companies.slug")} value={company.slug ?? "—"} />
          <Field label={t("admin.platform_companies.tax_id")} value={company.tax_id ?? "—"} />
          <Field label={t("admin.platform_companies.country")} value={company.country ?? "—"} />
          <Field label={t("admin.platform_companies.city")} value={company.city ?? "—"} />
        </div>
      </section>

      {/* Contact card */}
      <section className="rounded-zulu border border-default bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-fg-t8">
          {t("admin.platform_companies.section_contact")}
        </h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("admin.platform_companies.phone")} value={company.phone ?? "—"} />
          <Field label={t("admin.platform_companies.website")} value={company.website ?? "—"} />
          <Field label={t("admin.platform_companies.address")} value={company.address ?? "—"} />
        </div>
      </section>

      {/* Governance card — editable */}
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
        </div>
      </section>

      {/* Seller card */}
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
