"use client";

/**
 * Management → Subscriptions pane (super-admin only).
 *
 * Self-contained 1:1 port of bucket3/subscriptions/page.tsx onto the
 * management.css design system (mockup `7_Management/management.html`
 * `#mp-subscriptions`). Manages the subscription PLAN catalog and the
 * per-company plan ASSIGNMENTS:
 *   - GET    /subscription-plans
 *   - GET    /subscription-plans/feature-catalog   (fail-soft → [])
 *   - POST   /subscription-plans                   (create: code + name)
 *   - GET    /company-subscriptions?page&per_page   (super-only)
 *   - PATCH  /company-subscriptions/{company_id}    (assign: create-or-update)
 *
 * Billing is manual (admin marks a subscription paid externally and extends
 * the period) — by design per the operations model.
 */

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessSuperAdminOnlyPlatformNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
import { formatDate } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";

type FeatureValue = boolean | number;
type FeatureMap = Record<string, FeatureValue>;
type FeatureDef = { key: string; label: string; type: "bool" | "limit"; default: FeatureValue };

type Plan = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number | null;
  currency: string;
  features: FeatureMap | string[] | null;
  is_active: boolean;
  display_order: number;
};

type SubStatus = "active" | "cancelled" | "past_due" | "trial";
type BillingPeriod = "monthly" | "annual";

type CompanySubscription = {
  id: number;
  company: { id: number; name: string } | null;
  plan: { id: number; code: string; name: string; monthly_price: number; currency: string } | null;
  status: SubStatus;
  billing_period: BillingPeriod;
  period_starts_at: string | null;
  period_ends_at: string | null;
  notes: string | null;
};

type PlanForm = {
  code: string;
  name: string;
  description: string;
  monthly_price: string;
  annual_price: string;
  currency: string;
  is_active: boolean;
  display_order: string;
};

type AssignForm = {
  company_id: string;
  plan_id: string;
  status: SubStatus;
  billing_period: BillingPeriod;
  period_starts_at: string;
  period_ends_at: string;
  notes: string;
};

const EMPTY_PLAN_FORM: PlanForm = {
  code: "",
  name: "",
  description: "",
  monthly_price: "0",
  annual_price: "",
  currency: "USD",
  is_active: true,
  display_order: "0",
};

const EMPTY_ASSIGN_FORM: AssignForm = {
  company_id: "",
  plan_id: "",
  status: "active",
  billing_period: "monthly",
  period_starts_at: "",
  period_ends_at: "",
  notes: "",
};

function summariseFeatures(f: Plan["features"]): string {
  if (!f) return "—";
  if (Array.isArray(f)) return f.length === 0 ? "—" : f.join(", ");
  const parts = Object.entries(f)
    .filter(([, v]) => v !== false)
    .map(([k, v]) => (typeof v === "boolean" ? k : `${k}=${v}`));
  return parts.length === 0 ? "—" : parts.join(", ");
}

function statusBadgeClass(s: SubStatus): string {
  switch (s) {
    case "active":
      return "badge badge-success";
    case "trial":
      return "badge badge-info";
    case "past_due":
      return "badge badge-danger";
    case "cancelled":
    default:
      return "badge badge-gray";
  }
}

function initials(name: string): string {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function avatarToneClass(id: number): string {
  const tones = ["", "avatar-teal", "avatar-amber", "avatar-blue"];
  return `avatar ${tones[id % tones.length] ?? ""}`.trim();
}

/** Escape one CSV cell (client-side export from rendered rows). */
function csvCell(value: string | number): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function SubscriptionsPane() {
  const { token, user } = useAdminAuth();
  const { lang } = useLanguage();
  const allowed = canAccessSuperAdminOnlyPlatformNav(user);

  const pick = useCallback(
    (map: { hy: string; ru: string; en: string }) =>
      lang === "hy" ? map.hy : lang === "ru" ? map.ru : map.en,
    [lang]
  );

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<CompanySubscription[]>([]);
  const [subMeta, setSubMeta] = useState<ApiListMeta | null>(null);
  const [subPage, setSubPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [planForm, setPlanForm] = useState<PlanForm>(EMPTY_PLAN_FORM);
  const [featureCatalog, setFeatureCatalog] = useState<FeatureDef[]>([]);
  const [planFeatures, setPlanFeatures] = useState<FeatureMap>({});
  const [assign, setAssign] = useState<AssignForm>(EMPTY_ASSIGN_FORM);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    try {
      const [plansRes, subsRes, catalogRes] = await Promise.all([
        apiFetchJson<ApiSuccessEnvelope<Plan[]>>(`/subscription-plans`, { method: "GET", token }),
        apiFetchJson<ApiSuccessEnvelope<CompanySubscription[]> & { meta: ApiListMeta }>(
          `/company-subscriptions?page=${subPage}&per_page=50`,
          { method: "GET", token }
        ),
        apiFetchJson<ApiSuccessEnvelope<FeatureDef[]>>(`/subscription-plans/feature-catalog`, {
          method: "GET",
          token,
        }).catch(() => ({ data: [] as FeatureDef[] })),
      ]);
      setPlans(plansRes.data);
      setSubs(subsRes.data);
      setSubMeta(subsRes.meta);
      setFeatureCatalog(catalogRes.data);
      setPlanFeatures((prev) => {
        if (Object.keys(prev).length > 0 || catalogRes.data.length === 0) return prev;
        const defaults: FeatureMap = {};
        for (const def of catalogRes.data) defaults[def.key] = def.default;
        return defaults;
      });
    } catch (e) {
      setErr(
        e instanceof ApiRequestError
          ? e.message
          : pick({ hy: "Բեռնումը ձախողվեց", ru: "Не удалось загрузить", en: "Failed to load" })
      );
    }
  }, [token, allowed, subPage, pick]);

  useEffect(() => {
    void load();
  }, [load]);

  const createPlan = useCallback(async () => {
    if (!token) return;
    if (!planForm.code.trim() || !planForm.name.trim()) {
      setErr(
        pick({
          hy: "Կոդը և անունը պարտադիր են",
          ru: "Код и название обязательны",
          en: "Code and name are required",
        })
      );
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        code: planForm.code.trim().toLowerCase(),
        name: planForm.name.trim(),
        description: planForm.description.trim() || null,
        monthly_price: Number(planForm.monthly_price) || 0,
        currency: planForm.currency.trim().toUpperCase() || "USD",
        is_active: planForm.is_active,
        display_order: Number(planForm.display_order) || 0,
      };
      if (planForm.annual_price.trim()) body.annual_price = Number(planForm.annual_price);
      if (Object.keys(planFeatures).length > 0) body.features = planFeatures;
      await apiFetchJson(`/subscription-plans`, { method: "POST", token, body });
      setPlanForm(EMPTY_PLAN_FORM);
      const defaults: FeatureMap = {};
      for (const def of featureCatalog) defaults[def.key] = def.default;
      setPlanFeatures(defaults);
      await load();
    } catch (e) {
      setErr(
        e instanceof ApiRequestError
          ? e.message
          : pick({ hy: "Պլանը չստեղծվեց", ru: "Не удалось создать план", en: "Plan creation failed" })
      );
    } finally {
      setBusy(false);
    }
  }, [token, planForm, planFeatures, featureCatalog, load, pick]);

  const assignPlan = useCallback(async () => {
    if (!token) return;
    if (!assign.company_id.trim() || !assign.plan_id.trim()) {
      setErr(
        pick({
          hy: "Ընկերության համարը և պլանը պարտադիր են",
          ru: "ID компании и план обязательны",
          en: "Company ID and plan are required",
        })
      );
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        plan_id: Number(assign.plan_id),
        status: assign.status,
        billing_period: assign.billing_period,
        notes: assign.notes.trim() || null,
      };
      if (assign.period_starts_at) body.period_starts_at = assign.period_starts_at;
      if (assign.period_ends_at) body.period_ends_at = assign.period_ends_at;
      await apiFetchJson(`/company-subscriptions/${Number(assign.company_id)}`, {
        method: "PATCH",
        token,
        body,
      });
      setAssign(EMPTY_ASSIGN_FORM);
      await load();
    } catch (e) {
      setErr(
        e instanceof ApiRequestError
          ? e.message
          : pick({ hy: "Նշանակումը ձախողվեց", ru: "Не удалось назначить", en: "Assignment failed" })
      );
    } finally {
      setBusy(false);
    }
  }, [token, assign, load, pick]);

  const exportCsv = useCallback(() => {
    const header = [
      "id",
      "company_id",
      "company_name",
      "plan_code",
      "plan_name",
      "monthly_price",
      "currency",
      "status",
      "billing_period",
      "period_starts_at",
      "period_ends_at",
    ];
    const rows = subs.map((r) =>
      [
        r.id,
        r.company?.id ?? "",
        r.company?.name ?? "",
        r.plan?.code ?? "",
        r.plan?.name ?? "",
        r.plan?.monthly_price ?? "",
        r.plan?.currency ?? "",
        r.status,
        r.billing_period,
        r.period_starts_at ?? "",
        r.period_ends_at ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\r\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "company-subscriptions.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [subs]);

  if (!allowed) {
    return (
      <div className="empty-state">
        <i className="ti ti-lock" aria-hidden style={{ fontSize: 34, color: "var(--text-tertiary)" }} />
        <div className="es-title">
          {pick({ hy: "Հասանելի է միայն գլխավոր ադմինին", ru: "Только для главного администратора", en: "Super admin only" })}
        </div>
        <div className="es-sub">
          {pick({
            hy: "Բաժանորդագրությունների կառավարումը հասանելի է միայն գլխավոր ադմինին",
            ru: "Управление подписками доступно только главному администратору",
            en: "Subscription management is available to the super admin only",
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {err && (
        <div
          className="alert"
          style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}
          role="alert"
        >
          <i className="ti ti-alert-triangle" aria-hidden />
          <span>{err}</span>
        </div>
      )}

      {/* ── Two inline form cards: Create plan · Assign plan ── */}
      <div className="detail-card-grid">
        {/* Create plan */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                {pick({ hy: "Ստեղծել պլան", ru: "Создать план", en: "Create plan" })}
              </div>
              <div className="card-subtitle">
                {pick({
                  hy: "Ավելացնել պլան ցուցակում",
                  ru: "Добавить план в каталог",
                  en: "Add a plan to the catalog.",
                })}
              </div>
            </div>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="fld">
                <span className="fld-label">
                  {pick({ hy: "Կոդ", ru: "Код", en: "Code" })}
                  <span className="fld-hint" style={{ display: "inline", marginLeft: 4 }}>
                    {pick({ hy: "եզակի · փոքրատառ", ru: "уникальный · строчные", en: "unique · lowercased" })}
                  </span>
                </span>
                <input
                  value={planForm.code}
                  onChange={(e) => setPlanForm((p) => ({ ...p, code: e.target.value.toLowerCase() }))}
                  placeholder="pro"
                />
              </div>
              <div className="fld">
                <span className="fld-label">{pick({ hy: "Անուն", ru: "Название", en: "Name" })}</span>
                <input
                  value={planForm.name}
                  onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Professional"
                />
              </div>
              <div className="fld">
                <span className="fld-label">{pick({ hy: "Արժույթ", ru: "Валюта", en: "Currency" })}</span>
                <input
                  value={planForm.currency}
                  maxLength={3}
                  style={{ textTransform: "uppercase" }}
                  onChange={(e) => setPlanForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
                  placeholder="USD"
                />
              </div>
              <div className="fld">
                <span className="fld-label">
                  {pick({ hy: "Ցուցադրման հերթականություն", ru: "Порядок отображения", en: "Display order" })}
                </span>
                <input
                  type="number"
                  value={planForm.display_order}
                  onChange={(e) => setPlanForm((p) => ({ ...p, display_order: e.target.value }))}
                />
              </div>
              <div className="fld">
                <span className="fld-label">
                  {pick({ hy: "Ամսական գին", ru: "Цена в месяц", en: "Monthly price" })}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={planForm.monthly_price}
                  onChange={(e) => setPlanForm((p) => ({ ...p, monthly_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="fld">
                <span className="fld-label">
                  {pick({ hy: "Տարեկան գին", ru: "Цена в год", en: "Annual price" })}
                  <span className="fld-hint" style={{ display: "inline", marginLeft: 4 }}>
                    {pick({ hy: "ընտրովի", ru: "необязательно", en: "optional" })}
                  </span>
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={planForm.annual_price}
                  onChange={(e) => setPlanForm((p) => ({ ...p, annual_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="fld span-2">
                <span className="fld-label">
                  {pick({ hy: "Նկարագիր", ru: "Описание", en: "Description" })}
                  <span className="fld-hint" style={{ display: "inline", marginLeft: 4 }}>
                    {pick({ hy: "ընտրովի", ru: "необязательно", en: "optional" })}
                  </span>
                </span>
                <textarea
                  rows={2}
                  value={planForm.description}
                  onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder={pick({ hy: "Նկարագրություն…", ru: "Описание…", en: "Marketing copy…" })}
                />
              </div>
            </div>

            {featureCatalog.length > 0 && (
              <>
                <div className="section-label" style={{ marginTop: 14 }}>
                  {pick({ hy: "Հնարավորություններ", ru: "Возможности", en: "Features" })}
                </div>
                <div className="form-grid">
                  {featureCatalog.map((def) => (
                    <div className="fld" key={def.key}>
                      <span className="fld-label">
                        {def.label}
                        <span className="fld-hint font-mono" style={{ display: "inline", marginLeft: 4 }}>
                          {def.key}
                        </span>
                      </span>
                      {def.type === "bool" ? (
                        <div className="switch-row">
                          <span className="switch">
                            <input
                              type="checkbox"
                              checked={Boolean(planFeatures[def.key])}
                              onChange={(e) =>
                                setPlanFeatures((p) => ({ ...p, [def.key]: e.target.checked }))
                              }
                            />
                            <span className="switch-slider" />
                          </span>
                          <span className="text-secondary">
                            {Boolean(planFeatures[def.key])
                              ? pick({ hy: "Միացված", ru: "Включено", en: "On" })
                              : pick({ hy: "Անջատված", ru: "Выключено", en: "Off" })}
                          </span>
                        </div>
                      ) : (
                        <input
                          type="number"
                          value={String(planFeatures[def.key] ?? def.default)}
                          onChange={(e) =>
                            setPlanFeatures((p) => ({ ...p, [def.key]: Number(e.target.value) || 0 }))
                          }
                          placeholder="—"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="switch-row" style={{ marginTop: 14 }}>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={planForm.is_active}
                  onChange={(e) => setPlanForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                <span className="switch-slider" />
              </span>
              <span>
                {pick({ hy: "Ակտիվ", ru: "Активен", en: "Active" })}
                <span className="text-secondary text-sm" style={{ marginLeft: 6 }}>
                  {pick({
                    hy: "(միացված լինելիս տեսանելի է բոլորին)",
                    ru: "(виден всем, когда включён)",
                    en: "(visible to all when on)",
                  })}
                </span>
              </span>
            </div>
          </div>
          <div className="card-foot">
            <button className="btn btn-primary" disabled={busy} onClick={() => void createPlan()}>
              <i className="ti ti-check" aria-hidden />
              {busy
                ? pick({ hy: "Պահպանվում է…", ru: "Сохранение…", en: "Saving…" })
                : pick({ hy: "Ստեղծել պլան", ru: "Создать план", en: "Create plan" })}
            </button>
          </div>
        </div>

        {/* Assign plan */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                {pick({ hy: "Նշանակել պլան ընկերությանը", ru: "Назначить план компании", en: "Assign plan to company" })}
              </div>
              <div className="card-subtitle">
                {pick({
                  hy: "Մեկ ակտիվ բաժանորդագրություն յուրաքանչյուր ընկերության համար",
                  ru: "Одна активная подписка на компанию",
                  en: "Create-or-update one active subscription per company.",
                })}
              </div>
            </div>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="fld">
                <span className="fld-label">
                  {pick({ hy: "Ընկերության համար", ru: "ID компании", en: "Company ID" })}
                  <span className="fld-hint" style={{ display: "inline", marginLeft: 4 }}>
                    {pick({ hy: "մուտքագրել ձեռքով", ru: "ввести вручную", en: "enter manually" })}
                  </span>
                </span>
                <input
                  type="number"
                  min={1}
                  value={assign.company_id}
                  onChange={(e) => setAssign((p) => ({ ...p, company_id: e.target.value }))}
                  placeholder="1042"
                />
              </div>
              <div className="fld">
                <span className="fld-label">{pick({ hy: "Պլան", ru: "План", en: "Plan" })}</span>
                <select
                  value={assign.plan_id}
                  onChange={(e) => setAssign((p) => ({ ...p, plan_id: e.target.value }))}
                >
                  <option value="">{pick({ hy: "Ընտրել…", ru: "Выбрать…", en: "Pick…" })}</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name} ({p.currency} {p.monthly_price.toFixed(2)}/mo)
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <span className="fld-label">{pick({ hy: "Վիճակ", ru: "Статус", en: "Status" })}</span>
                <select
                  value={assign.status}
                  onChange={(e) => setAssign((p) => ({ ...p, status: e.target.value as SubStatus }))}
                >
                  <option value="active">{pick({ hy: "ակտիվ", ru: "активный", en: "active" })}</option>
                  <option value="trial">{pick({ hy: "փորձնական", ru: "пробный", en: "trial" })}</option>
                  <option value="past_due">{pick({ hy: "ուժամտած", ru: "просрочен", en: "past_due" })}</option>
                  <option value="cancelled">{pick({ hy: "չեղարկված", ru: "отменён", en: "cancelled" })}</option>
                </select>
              </div>
              <div className="fld">
                <span className="fld-label">{pick({ hy: "Վճարման ժամանակահատված", ru: "Период оплаты", en: "Billing period" })}</span>
                <select
                  value={assign.billing_period}
                  onChange={(e) =>
                    setAssign((p) => ({ ...p, billing_period: e.target.value as BillingPeriod }))
                  }
                >
                  <option value="monthly">{pick({ hy: "ամսական", ru: "ежемесячно", en: "monthly" })}</option>
                  <option value="annual">{pick({ hy: "տարեկան", ru: "ежегодно", en: "annual" })}</option>
                </select>
              </div>
              <div className="fld">
                <span className="fld-label">{pick({ hy: "Ժամանակահատվածի սկիզբ", ru: "Начало периода", en: "Period starts" })}</span>
                <input
                  type="date"
                  value={assign.period_starts_at}
                  onChange={(e) => setAssign((p) => ({ ...p, period_starts_at: e.target.value }))}
                />
              </div>
              <div className="fld">
                <span className="fld-label">{pick({ hy: "Ժամանակահատվածի ավարտ", ru: "Конец периода", en: "Period ends" })}</span>
                <input
                  type="date"
                  value={assign.period_ends_at}
                  onChange={(e) => setAssign((p) => ({ ...p, period_ends_at: e.target.value }))}
                />
              </div>
              <div className="fld span-2">
                <span className="fld-label">
                  {pick({ hy: "Նշումներ", ru: "Заметки", en: "Notes" })}
                  <span className="fld-hint" style={{ display: "inline", marginLeft: 4 }}>
                    {pick({ hy: "ընտրովի", ru: "необязательно", en: "optional" })}
                  </span>
                </span>
                <textarea
                  rows={2}
                  value={assign.notes}
                  onChange={(e) => setAssign((p) => ({ ...p, notes: e.target.value }))}
                  placeholder={pick({
                    hy: "Ադմինի նշումներ այս նշանակման համար…",
                    ru: "Заметки администратора для этого назначения…",
                    en: "Admin notes for this assignment…",
                  })}
                />
              </div>
            </div>
          </div>
          <div className="card-foot">
            <button className="btn btn-primary" disabled={busy} onClick={() => void assignPlan()}>
              <i className="ti ti-check" aria-hidden />
              {busy
                ? pick({ hy: "Պահպանվում է…", ru: "Сохранение…", en: "Saving…" })
                : pick({ hy: "Նշանակել պլան", ru: "Назначить план", en: "Assign plan" })}
            </button>
          </div>
        </div>
      </div>

      {/* ── Plan catalog table ── */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title">{pick({ hy: "Պլանների ցուցակ", ru: "Каталог планов", en: "Plan catalog" })}</div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{pick({ hy: "Կոդ", ru: "Код", en: "Code" })}</th>
                <th>{pick({ hy: "Անուն", ru: "Название", en: "Name" })}</th>
                <th style={{ textAlign: "right" }}>{pick({ hy: "Ամսական", ru: "Месяц", en: "Monthly" })}</th>
                <th style={{ textAlign: "right" }}>{pick({ hy: "Տարեկան", ru: "Год", en: "Annual" })}</th>
                <th>{pick({ hy: "Հնարավորություններ", ru: "Возможности", en: "Features" })}</th>
                <th>{pick({ hy: "Ակտիվ", ru: "Активен", en: "Active" })}</th>
                <th style={{ textAlign: "right" }}>{pick({ hy: "Հերթականություն", ru: "Порядок", en: "Order" })}</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr style={{ cursor: "default" }}>
                  <td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: "28px 16px" }}>
                    {pick({ hy: "Պլաններ չկան", ru: "Планов нет", en: "No plans yet" })}
                  </td>
                </tr>
              ) : (
                plans.map((p) => (
                  <tr key={p.id} style={{ cursor: "default" }}>
                    <td className="font-mono">{p.code}</td>
                    <td className="font-semibold">{p.name}</td>
                    <td className="num-cell font-mono">
                      {p.currency} {p.monthly_price.toFixed(2)}
                    </td>
                    <td className="num-cell font-mono">
                      {p.annual_price != null ? `${p.currency} ${p.annual_price.toFixed(2)}` : (
                        <span className="cell-muted">—</span>
                      )}
                    </td>
                    <td
                      className="cell-muted text-sm"
                      style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={summariseFeatures(p.features)}
                    >
                      {summariseFeatures(p.features)}
                    </td>
                    <td>
                      <span className={p.is_active ? "badge badge-success" : "badge badge-gray"}>
                        {p.is_active
                          ? pick({ hy: "Այո", ru: "Да", en: "Yes" })
                          : pick({ hy: "Ոչ", ru: "Нет", en: "No" })}
                      </span>
                    </td>
                    <td className="num-cell font-mono">{p.display_order}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Active subscriptions table ── */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title">
            {pick({ hy: "Ակտիվ բաժանորդագրություններ", ru: "Активные подписки", en: "Active subscriptions" })}
          </div>
          <button className="btn btn-sm" disabled={subs.length === 0} onClick={exportCsv}>
            <i className="ti ti-download" aria-hidden />
            {pick({ hy: "Արտահանել CSV", ru: "Экспорт CSV", en: "Export CSV" })}
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{pick({ hy: "Ընկերություն", ru: "Компания", en: "Company" })}</th>
                <th>{pick({ hy: "Պլան", ru: "План", en: "Plan" })}</th>
                <th>{pick({ hy: "Վիճակ", ru: "Статус", en: "Status" })}</th>
                <th>{pick({ hy: "Վճարում", ru: "Оплата", en: "Billing" })}</th>
                <th>{pick({ hy: "Ժամանակահատված", ru: "Период", en: "Period" })}</th>
                <th>{pick({ hy: "Նշումներ", ru: "Заметки", en: "Notes" })}</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 ? (
                <tr style={{ cursor: "default" }}>
                  <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: "28px 16px" }}>
                    {pick({ hy: "Բաժանորդագրություններ չկան", ru: "Подписок нет", en: "No subscriptions yet" })}
                  </td>
                </tr>
              ) : (
                subs.map((s) => {
                  const companyName = s.company?.name ?? "—";
                  return (
                    <tr key={s.id} style={{ cursor: "default" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className={avatarToneClass(s.id)} aria-hidden>
                            {initials(companyName)}
                          </span>
                          <div>
                            <div className="font-semibold">{companyName}</div>
                            <div className="cell-muted text-sm font-mono">
                              SUB-{String(s.id).padStart(3, "0")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{s.plan ? `${s.plan.code} — ${s.plan.name}` : <span className="cell-muted">—</span>}</td>
                      <td>
                        <span className={statusBadgeClass(s.status)}>{s.status}</span>
                      </td>
                      <td>
                        <span className="badge badge-info">{s.billing_period}</span>
                      </td>
                      <td className="cell-muted">
                        {formatDate(s.period_starts_at, lang)} → {formatDate(s.period_ends_at, lang)}
                      </td>
                      <td className="cell-muted">{s.notes ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {subMeta && (
          <div className="pagination">
            <span className="pagination-info">
              {pick({ hy: "Ցուցադրված է", ru: "Показано", en: "Showing" })} {subs.length} / {subMeta.total}
            </span>
            <div className="pagination-controls">
              <button
                className="btn btn-sm"
                disabled={subMeta.current_page <= 1}
                onClick={() => setSubPage((p) => Math.max(1, p - 1))}
              >
                {pick({ hy: "Նախորդ", ru: "Назад", en: "Prev" })}
              </button>
              <button className="btn btn-sm btn-primary" disabled>
                {subMeta.current_page}
              </button>
              <button
                className="btn btn-sm"
                disabled={subMeta.current_page >= subMeta.last_page}
                onClick={() => setSubPage((p) => p + 1)}
              >
                {pick({ hy: "Հաջորդ", ru: "Вперёд", en: "Next" })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
