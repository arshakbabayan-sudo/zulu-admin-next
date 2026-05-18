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

type Plan = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number | null;
  currency: string;
  features: string[] | null;
  is_active: boolean;
  display_order: number;
};

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
    features_csv: "",
    is_active: true,
    display_order: "0",
  });

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
      const [plansRes, subsRes] = await Promise.all([
        apiFetchJson<ApiSuccessEnvelope<Plan[]>>(`/subscription-plans`, { method: "GET", token }),
        apiFetchJson<ApiSuccessEnvelope<CompanySubscription[]> & { meta: ApiListMeta }>(
          `/company-subscriptions?page=${subPage}&per_page=50`,
          { method: "GET", token }
        ),
      ]);
      setPlans(plansRes.data);
      setSubs(subsRes.data);
      setSubMeta(subsRes.meta);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
    }
  }, [token, allowed, subPage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPlan() {
    if (!token) return;
    if (!planForm.code.trim() || !planForm.name.trim()) {
      setErr("Code and name required");
      return;
    }
    setBusy(true);
    try {
      const features = planForm.features_csv
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "");
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
      if (features.length > 0) body.features = features;
      await apiFetchJson(`/subscription-plans`, { method: "POST", token, body });
      setPlanForm({
        code: "",
        name: "",
        description: "",
        monthly_price: "0",
        annual_price: "",
        currency: "USD",
        features_csv: "",
        is_active: true,
        display_order: "0",
      });
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
      setErr("Company id and plan id required");
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
        <h1 className="admin-page-title">Subscriptions</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        subtitle="Plan catalog + per-company assignment. Payment-integration auto-renew is parked; period dates are admin-managed."
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">Plan catalog</h2>
        <Table>
          <THead>
            <TR>
              <TH>Code</TH>
              <TH>Name</TH>
              <TH>Monthly</TH>
              <TH>Annual</TH>
              <TH>Features</TH>
              <TH>Order</TH>
              <TH>Active</TH>
            </TR>
          </THead>
          <TBody>
            {plans.length === 0 ? (
              <TEmpty colSpan={7}>No plans yet — add the first below.</TEmpty>
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
                <TD className="text-xs text-fg-t6">{p.features?.join(", ") ?? "—"}</TD>
                <TD className="tabular-nums">{p.display_order}</TD>
                <TD>
                  {p.is_active ? (
                    <span className="text-xs font-medium text-success-700">Active</span>
                  ) : (
                    <span className="text-xs text-fg-t6">Inactive</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">Add plan</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Code" htmlFor="plan-code" required helperText="lowercase, e.g. free / pro / enterprise">
            <Input
              id="plan-code"
              value={planForm.code}
              onChange={(e) => setPlanForm((p) => ({ ...p, code: e.target.value.toLowerCase() }))}
            />
          </FormField>
          <FormField label="Name" htmlFor="plan-name" required>
            <Input
              id="plan-name"
              value={planForm.name}
              onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))}
            />
          </FormField>
          <FormField label="Currency" htmlFor="plan-currency">
            <Input
              id="plan-currency"
              value={planForm.currency}
              onChange={(e) => setPlanForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
              maxLength={3}
              className="uppercase"
            />
          </FormField>
          <FormField label="Monthly price" htmlFor="plan-monthly">
            <Input
              id="plan-monthly"
              type="number"
              step="0.01"
              min="0"
              value={planForm.monthly_price}
              onChange={(e) => setPlanForm((p) => ({ ...p, monthly_price: e.target.value }))}
            />
          </FormField>
          <FormField label="Annual price" htmlFor="plan-annual">
            <Input
              id="plan-annual"
              type="number"
              step="0.01"
              min="0"
              value={planForm.annual_price}
              onChange={(e) => setPlanForm((p) => ({ ...p, annual_price: e.target.value }))}
            />
          </FormField>
          <FormField label="Display order" htmlFor="plan-order">
            <Input
              id="plan-order"
              type="number"
              value={planForm.display_order}
              onChange={(e) => setPlanForm((p) => ({ ...p, display_order: e.target.value }))}
            />
          </FormField>
          <FormField
            label="Features"
            htmlFor="plan-features"
            helperText="Comma-separated feature keys, e.g. priority_placement, advanced_analytics"
            className="sm:col-span-2 lg:col-span-2"
          >
            <Input
              id="plan-features"
              value={planForm.features_csv}
              onChange={(e) => setPlanForm((p) => ({ ...p, features_csv: e.target.value }))}
            />
          </FormField>
          <div className="flex items-end pb-2">
            <Checkbox
              checked={planForm.is_active}
              onChange={(e) => setPlanForm((p) => ({ ...p, is_active: e.target.checked }))}
              label="Active"
            />
          </div>
          <FormField label="Description" htmlFor="plan-desc" className="sm:col-span-2 lg:col-span-3">
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
            {busy ? "Saving…" : "Add plan"}
          </Button>
        </div>
      </section>

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">Assign plan to company</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Company id" htmlFor="assign-company" required>
            <Input
              id="assign-company"
              type="number"
              min={1}
              value={assign.company_id}
              onChange={(e) => setAssign((p) => ({ ...p, company_id: e.target.value }))}
            />
          </FormField>
          <FormField label="Plan" htmlFor="assign-plan" required>
            <Select
              id="assign-plan"
              value={assign.plan_id}
              onChange={(e) => setAssign((p) => ({ ...p, plan_id: e.target.value }))}
            >
              <option value="">— pick —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} ({p.currency} {p.monthly_price.toFixed(2)}/mo)
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Status" htmlFor="assign-status">
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
          <FormField label="Billing period" htmlFor="assign-period">
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
          <FormField label="Period starts" htmlFor="assign-starts">
            <Input
              id="assign-starts"
              type="date"
              value={assign.period_starts_at}
              onChange={(e) => setAssign((p) => ({ ...p, period_starts_at: e.target.value }))}
            />
          </FormField>
          <FormField label="Period ends" htmlFor="assign-ends">
            <Input
              id="assign-ends"
              type="date"
              value={assign.period_ends_at}
              onChange={(e) => setAssign((p) => ({ ...p, period_ends_at: e.target.value }))}
            />
          </FormField>
          <FormField label="Notes" htmlFor="assign-notes" className="sm:col-span-2 lg:col-span-3">
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
            {busy ? "Saving…" : "Assign plan"}
          </Button>
        </div>
      </section>

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">Active company subscriptions</h2>
        <Table>
          <THead>
            <TR>
              <TH>Company</TH>
              <TH>Plan</TH>
              <TH>Status</TH>
              <TH>Billing</TH>
              <TH>Period</TH>
              <TH>Notes</TH>
            </TR>
          </THead>
          <TBody>
            {subs.length === 0 ? (
              <TEmpty colSpan={6}>No company subscriptions yet.</TEmpty>
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
