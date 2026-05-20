"use client";

/**
 * Phase 7.11 — Subscription plans + company assignments.
 *
 * Replaces the ComingSoonPage placeholder. Super-admin manages the plan
 * catalog and assigns plans to companies manually (payment-integration
 * auto-renew is parked per memory feedback_no_payment_integration_yet.md).
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessSuperAdminOnlyPlatformNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
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

function summariseFeatures(f: Plan["features"]): string {
  if (!f) return "—";
  if (Array.isArray(f)) return f.length === 0 ? "—" : f.join(", ");
  const parts = Object.entries(f)
    .filter(([, v]) => v !== false)
    .map(([k, v]) => (typeof v === "boolean" ? k : `${k}=${v}`));
  return parts.length === 0 ? "—" : parts.join(", ");
}

type CompanySubscription = {
  id: number;
  company: { id: number; name: string } | null;
  plan: { id: number; code: string; name: string; monthly_price: number; currency: string } | null;
  status: "active" | "cancelled" | "past_due" | "trial";
  billing_period: "monthly" | "annual";
  period_starts_at: string | null;
  period_ends_at: string | null;
  notes: string | null;
};

function statusTier(s: CompanySubscription["status"]): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (s) {
    case "active":
      return "success";
    case "trial":
      return "info";
    case "past_due":
      return "warning";
    case "cancelled":
      return "neutral";
  }
}

export default function Bucket3SubscriptionsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessSuperAdminOnlyPlatformNav(user);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<CompanySubscription[]>([]);
  const [subMeta, setSubMeta] = useState<ApiListMeta | null>(null);
  const [subPage, setSubPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Plan compose form
  const [planForm, setPlanForm] = useState({
    code: "",
    name: "",
    description: "",
    monthly_price: "0",
    annual_price: "",
    currency: "USD",
    is_active: true,
    display_order: "0",
  });
  const [featureCatalog, setFeatureCatalog] = useState<FeatureDef[]>([]);
  const [planFeatures, setPlanFeatures] = useState<FeatureMap>({});

  // Assign form
  const [assign, setAssign] = useState({
    company_id: "",
    plan_id: "",
    status: "active" as CompanySubscription["status"],
    billing_period: "monthly" as CompanySubscription["billing_period"],
    period_starts_at: "",
    period_ends_at: "",
    notes: "",
  });

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
      if (Object.keys(planFeatures).length === 0 && catalogRes.data.length > 0) {
        const defaults: FeatureMap = {};
        for (const def of catalogRes.data) defaults[def.key] = def.default;
        setPlanFeatures(defaults);
      }
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
    }
  }, [token, allowed, subPage, planFeatures]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPlan() {
    if (!token) return;
    if (!planForm.code.trim() || !planForm.name.trim()) {
      setErr(t("admin.bucket3.subscriptions.error.code_name_required"));
      return;
    }
    setBusy(true);
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
      setPlanForm({
        code: "",
        name: "",
        description: "",
        monthly_price: "0",
        annual_price: "",
        currency: "USD",
        is_active: true,
        display_order: "0",
      });
      // Reset features to catalog defaults
      const defaults: FeatureMap = {};
      for (const def of featureCatalog) defaults[def.key] = def.default;
      setPlanFeatures(defaults);
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Plan creation failed");
    } finally {
      setBusy(false);
    }
  }

  async function assignPlan() {
    if (!token) return;
    if (!assign.company_id.trim() || !assign.plan_id.trim()) {
      setErr(t("admin.bucket3.subscriptions.error.company_plan_required"));
      return;
    }
    setBusy(true);
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
      setAssign({
        company_id: "",
        plan_id: "",
        status: "active",
        billing_period: "monthly",
        period_starts_at: "",
        period_ends_at: "",
        notes: "",
      });
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Assignment failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.bucket3.subscriptions.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.bucket3.subscriptions.title")}
        subtitle={t("admin.bucket3.subscriptions.subtitle")}
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">{t("admin.bucket3.subscriptions.plan_catalog")}</h2>
        <Table>
          <THead>
            <TR>
              <TH>{t("admin.bucket3.subscriptions.col.code")}</TH>
              <TH>{t("admin.bucket3.subscriptions.col.name")}</TH>
              <TH>{t("admin.bucket3.subscriptions.col.monthly")}</TH>
              <TH>{t("admin.bucket3.subscriptions.col.annual")}</TH>
              <TH>{t("admin.bucket3.subscriptions.col.features")}</TH>
              <TH>{t("admin.bucket3.subscriptions.col.order")}</TH>
              <TH>{t("admin.bucket3.subscriptions.col.active")}</TH>
            </TR>
          </THead>
          <TBody>
            {plans.length === 0 ? (
              <TEmpty colSpan={7}>{t("admin.bucket3.subscriptions.empty_plans")}</TEmpty>
            ) : null}
            {plans.map((p) => (
              <TR key={p.id}>
                <TD className="font-mono text-xs">{p.code}</TD>
                <TD className="font-medium">{p.name}</TD>
                <TD className="tabular-nums">
                  {p.currency} {p.monthly_price.toFixed(2)}
                </TD>
                <TD className="tabular-nums">
                  {p.annual_price != null ? `${p.currency} ${p.annual_price.toFixed(2)}` : "—"}
                </TD>
                <TD className="text-xs text-fg-t6 max-w-[280px] truncate" title={summariseFeatures(p.features)}>
                  {summariseFeatures(p.features)}
                </TD>
                <TD className="tabular-nums">{p.display_order}</TD>
                <TD>
                  {p.is_active ? (
                    <span className="text-xs font-medium text-success-700">{t("admin.bucket3.subscriptions.status.active")}</span>
                  ) : (
                    <span className="text-xs text-fg-t6">{t("admin.bucket3.subscriptions.status.inactive")}</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">{t("admin.bucket3.subscriptions.add_plan")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={t("admin.bucket3.subscriptions.field.code")} htmlFor="plan-code" required helperText={t("admin.bucket3.subscriptions.field.code_helper")}>
            <Input
              id="plan-code"
              value={planForm.code}
              onChange={(e) => setPlanForm((p) => ({ ...p, code: e.target.value.toLowerCase() }))}
            />
          </FormField>
          <FormField label={t("admin.bucket3.subscriptions.field.name")} htmlFor="plan-name" required>
            <Input
              id="plan-name"
              value={planForm.name}
              onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.bucket3.subscriptions.field.currency")} htmlFor="plan-currency">
            <Input
              id="plan-currency"
              value={planForm.currency}
              onChange={(e) => setPlanForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
              maxLength={3}
              className="uppercase"
            />
          </FormField>
          <FormField label={t("admin.bucket3.subscriptions.field.monthly_price")} htmlFor="plan-monthly">
            <Input
              id="plan-monthly"
              type="number"
              step="0.01"
              min="0"
              value={planForm.monthly_price}
              onChange={(e) => setPlanForm((p) => ({ ...p, monthly_price: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.bucket3.subscriptions.field.annual_price")} htmlFor="plan-annual">
            <Input
              id="plan-annual"
              type="number"
              step="0.01"
              min="0"
              value={planForm.annual_price}
              onChange={(e) => setPlanForm((p) => ({ ...p, annual_price: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.bucket3.subscriptions.field.display_order")} htmlFor="plan-order">
            <Input
              id="plan-order"
              type="number"
              value={planForm.display_order}
              onChange={(e) => setPlanForm((p) => ({ ...p, display_order: e.target.value }))}
            />
          </FormField>
          {featureCatalog.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-3 space-y-2">
              <div className="text-sm font-medium text-fg-t7">{t("admin.bucket3.subscriptions.field.features")}</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {featureCatalog.map((def) => (
                  <div
                    key={def.key}
                    className="flex items-center justify-between gap-2 rounded-zulu border border-default bg-figma-bg-1/30 px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-fg-t8">{def.label}</span>
                      <span className="font-mono text-[10px] text-fg-t6">{def.key}</span>
                    </div>
                    {def.type === "bool" ? (
                      <Checkbox
                        checked={Boolean(planFeatures[def.key])}
                        onChange={(e) =>
                          setPlanFeatures((p) => ({ ...p, [def.key]: e.target.checked }))
                        }
                      />
                    ) : (
                      <Input
                        type="number"
                        className="!w-24"
                        value={String(planFeatures[def.key] ?? def.default)}
                        onChange={(e) =>
                          setPlanFeatures((p) => ({
                            ...p,
                            [def.key]: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-fg-t6">
                {t("admin.bucket3.subscriptions.features_helper")}
              </p>
            </div>
          )}
          <div className="flex items-end pb-2">
            <Checkbox
              checked={planForm.is_active}
              onChange={(e) => setPlanForm((p) => ({ ...p, is_active: e.target.checked }))}
              label={t("admin.bucket3.subscriptions.field.active")}
            />
          </div>
          <FormField label={t("admin.bucket3.subscriptions.field.description")} htmlFor="plan-desc" className="sm:col-span-2 lg:col-span-3">
            <Input
              as="textarea"
              id="plan-desc"
              rows={2}
              value={planForm.description}
              onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))}
            />
          </FormField>
        </div>
        <div>
          <Button size="sm" disabled={busy} onClick={() => void createPlan()}>
            {busy ? t("common.saving") : t("admin.bucket3.subscriptions.add_plan")}
          </Button>
        </div>
      </section>

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">{t("admin.bucket3.subscriptions.assign_plan")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={t("admin.bucket3.subscriptions.field.company_id")} htmlFor="assign-company" required>
            <Input
              id="assign-company"
              type="number"
              min={1}
              value={assign.company_id}
              onChange={(e) => setAssign((p) => ({ ...p, company_id: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.bucket3.subscriptions.field.plan")} htmlFor="assign-plan" required>
            <Select
              id="assign-plan"
              value={assign.plan_id}
              onChange={(e) => setAssign((p) => ({ ...p, plan_id: e.target.value }))}
            >
              <option value="">{t("admin.bucket3.subscriptions.pick")}</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} ({p.currency} {p.monthly_price.toFixed(2)}/mo)
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("admin.bucket3.subscriptions.field.status")} htmlFor="assign-status">
            <Select
              id="assign-status"
              value={assign.status}
              onChange={(e) =>
                setAssign((p) => ({ ...p, status: e.target.value as CompanySubscription["status"] }))
              }
            >
              <option value="active">active</option>
              <option value="trial">trial</option>
              <option value="past_due">past_due</option>
              <option value="cancelled">cancelled</option>
            </Select>
          </FormField>
          <FormField label={t("admin.bucket3.subscriptions.field.billing_period")} htmlFor="assign-period">
            <Select
              id="assign-period"
              value={assign.billing_period}
              onChange={(e) =>
                setAssign((p) => ({
                  ...p,
                  billing_period: e.target.value as CompanySubscription["billing_period"],
                }))
              }
            >
              <option value="monthly">monthly</option>
              <option value="annual">annual</option>
            </Select>
          </FormField>
          <FormField label={t("admin.bucket3.subscriptions.field.period_starts")} htmlFor="assign-starts">
            <Input
              id="assign-starts"
              type="date"
              value={assign.period_starts_at}
              onChange={(e) => setAssign((p) => ({ ...p, period_starts_at: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.bucket3.subscriptions.field.period_ends")} htmlFor="assign-ends">
            <Input
              id="assign-ends"
              type="date"
              value={assign.period_ends_at}
              onChange={(e) => setAssign((p) => ({ ...p, period_ends_at: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.bucket3.subscriptions.field.notes")} htmlFor="assign-notes" className="sm:col-span-2 lg:col-span-3">
            <Input
              as="textarea"
              id="assign-notes"
              rows={2}
              value={assign.notes}
              onChange={(e) => setAssign((p) => ({ ...p, notes: e.target.value }))}
            />
          </FormField>
        </div>
        <div>
          <Button size="sm" disabled={busy} onClick={() => void assignPlan()}>
            {busy ? t("common.saving") : t("admin.bucket3.subscriptions.assign")}
          </Button>
        </div>
      </section>

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">{t("admin.bucket3.subscriptions.active_subscriptions")}</h2>
        <Table>
          <THead>
            <TR>
              <TH>{t("admin.bucket3.subscriptions.sub_col.company")}</TH>
              <TH>{t("admin.bucket3.subscriptions.sub_col.plan")}</TH>
              <TH>{t("admin.bucket3.subscriptions.sub_col.status")}</TH>
              <TH>{t("admin.bucket3.subscriptions.sub_col.billing")}</TH>
              <TH>{t("admin.bucket3.subscriptions.sub_col.period")}</TH>
              <TH>{t("admin.bucket3.subscriptions.sub_col.notes")}</TH>
            </TR>
          </THead>
          <TBody>
            {subs.length === 0 ? (
              <TEmpty colSpan={6}>{t("admin.bucket3.subscriptions.empty_subscriptions")}</TEmpty>
            ) : null}
            {subs.map((s) => (
              <TR key={s.id}>
                <TD>{s.company?.name ?? "—"}</TD>
                <TD className="text-xs">
                  {s.plan ? `${s.plan.code} — ${s.plan.name}` : "—"}
                </TD>
                <TD>
                  <StatusPill status={statusTier(s.status)}>{s.status}</StatusPill>
                </TD>
                <TD className="text-xs">{s.billing_period}</TD>
                <TD className="text-xs text-fg-t6">
                  {s.period_starts_at ? new Date(s.period_starts_at).toLocaleDateString() : "—"}
                  {" → "}
                  {s.period_ends_at ? new Date(s.period_ends_at).toLocaleDateString() : "—"}
                </TD>
                <TD className="text-xs text-fg-t6">{s.notes ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {subMeta && subMeta.last_page > 1 && (
          <Pagination
            page={subMeta.current_page}
            lastPage={subMeta.last_page}
            onPage={(p) => setSubPage(p)}
          />
        )}
      </section>
    </div>
  );
}
