"use client";

/**
 * Phase 5b — Admin contract create wizard.
 *
 * Backend: POST /platform-admin/contracts. Generates a new contract from a
 * published template. Variables map onto the template's `default_variables`
 * shape; we surface them as JSON for now (template-specific UI is a Phase 5c
 * polish item).
 *
 * For platform-type contracts ZULU is party A (omit party_a_company_id).
 * For partner-type contracts both parties are company IDs.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiAdminContractTemplates,
  apiAdminCreateContract,
  CONTRACT_LANGUAGES,
  type ContractLanguage,
  type ContractTemplateRow,
} from "@/lib/contracts-api";
import { apiCompaniesList, type CompanyListRow } from "@/lib/inventory-crud-api";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type FormState = {
  template_id: string;
  party_a_company_id: string;
  party_b_company_id: string;
  language: ContractLanguage;
  effective_date: string;
  expiry_date: string;
  auto_renew: boolean;
  termination_notice_days: string;
  variables_json: string;
  commission_clause_json: string;
  payment_terms_json: string;
  cancellation_policy_json: string;
};

const EMPTY: FormState = {
  template_id: "",
  party_a_company_id: "",
  party_b_company_id: "",
  language: "en",
  effective_date: "",
  expiry_date: "",
  auto_renew: false,
  termination_notice_days: "30",
  variables_json: "{}",
  commission_clause_json: "{}",
  payment_terms_json: "{}",
  cancellation_policy_json: "{}",
};

function tryParseJson(label: string, raw: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "{}") return { ok: true, value: {} };
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ok: true, value: parsed as Record<string, unknown> };
    }
    return { ok: false, error: `${label}: must be a JSON object` };
  } catch {
    return { ok: false, error: `${label}: invalid JSON` };
  }
}

export default function AdminContractCreatePage() {
  const router = useRouter();
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [templates, setTemplates] = useState<ContractTemplateRow[]>([]);
  const [companies, setCompanies] = useState<CompanyListRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const loadOptions = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const [tplRes, coRes] = await Promise.all([
        apiAdminContractTemplates(token, { per_page: 100 }),
        apiCompaniesList(token),
      ]);
      setTemplates(tplRes.data);
      setCompanies(coRes.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load options");
    }
  }, [token, allowed]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const selectedTemplate = templates.find((t) => t.id === form.template_id);
  const isPlatformType = selectedTemplate?.type === "platform";

  async function handleSubmit() {
    if (!token) return;
    if (!form.template_id) {
      setErr("Pick a template");
      return;
    }
    if (!form.party_b_company_id) {
      setErr("Party B (partner) is required");
      return;
    }
    if (!isPlatformType && !form.party_a_company_id) {
      setErr("Party A is required for partner-type contracts");
      return;
    }

    const variables = tryParseJson("Variables", form.variables_json);
    if (!variables.ok) return setErr(variables.error);
    const commission = tryParseJson("Commission clause", form.commission_clause_json);
    if (!commission.ok) return setErr(commission.error);
    const payment = tryParseJson("Payment terms", form.payment_terms_json);
    if (!payment.ok) return setErr(payment.error);
    const cancellation = tryParseJson("Cancellation policy", form.cancellation_policy_json);
    if (!cancellation.ok) return setErr(cancellation.error);

    setBusy(true);
    setErr(null);
    try {
      const res = await apiAdminCreateContract(token, {
        template_id: form.template_id,
        party_a_company_id: isPlatformType ? null : Number(form.party_a_company_id),
        party_b_company_id: Number(form.party_b_company_id),
        language: form.language,
        effective_date: form.effective_date || null,
        expiry_date: form.expiry_date || null,
        auto_renew: form.auto_renew,
        termination_notice_days: form.termination_notice_days
          ? Number(form.termination_notice_days)
          : undefined,
        variables: variables.value,
        commission_clause: commission.value,
        payment_terms: payment.value,
        cancellation_policy: cancellation.value,
      });
      router.push(`/platform/contracts/${res.data.id}`);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">New contract</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New contract"
        subtitle="Generate a contract from a template and assign both parties"
        actions={
          <Link
            href="/platform/contracts"
            className="inline-flex h-10 items-center rounded-md border-2 border-primary-500 px-4 text-ds-button-s font-ds-button-s font-semibold text-primary-500 transition hover:bg-primary-50"
          >
            ← Back
          </Link>
        }
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <section className="admin-card p-4">
        <h2 className="mb-3 text-base font-semibold">Template & parties</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Template" htmlFor="contract-template" required className="sm:col-span-2">
            <Select
              id="contract-template"
              value={form.template_id}
              onChange={(e) => setForm((p) => ({ ...p, template_id: e.target.value }))}
            >
              <option value="">— Pick a template —</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} ({tpl.type}, {tpl.language.toUpperCase()}
                  {tpl.version ? `, v${tpl.version}` : ""})
                </option>
              ))}
            </Select>
          </FormField>

          {selectedTemplate && (
            <div className="sm:col-span-2 rounded-zulu border border-default bg-figma-bg-1/50 px-3 py-2 text-xs text-fg-t7">
              Template type: <span className="font-semibold">{selectedTemplate.type}</span>.{" "}
              {isPlatformType
                ? "Party A will be ZULU (skip selection)."
                : "Both parties are partner companies."}
            </div>
          )}

          {!isPlatformType && (
            <FormField label="Party A" htmlFor="party-a" required>
              <Select
                id="party-a"
                value={form.party_a_company_id}
                onChange={(e) => setForm((p) => ({ ...p, party_a_company_id: e.target.value }))}
              >
                <option value="">— Pick a company —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} — {c.name ?? "(unnamed)"}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <FormField
            label="Party B (partner)"
            htmlFor="party-b"
            required
            className={isPlatformType ? "sm:col-span-2" : undefined}
          >
            <Select
              id="party-b"
              value={form.party_b_company_id}
              onChange={(e) => setForm((p) => ({ ...p, party_b_company_id: e.target.value }))}
            >
              <option value="">— Pick a company —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} — {c.name ?? "(unnamed)"}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Language" htmlFor="contract-language">
            <Select
              id="contract-language"
              value={form.language}
              onChange={(e) => setForm((p) => ({ ...p, language: e.target.value as ContractLanguage }))}
            >
              {CONTRACT_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </section>

      <section className="admin-card p-4">
        <h2 className="mb-3 text-base font-semibold">Schedule</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Effective date" htmlFor="effective-date">
            <Input
              id="effective-date"
              type="date"
              value={form.effective_date}
              onChange={(e) => setForm((p) => ({ ...p, effective_date: e.target.value }))}
            />
          </FormField>
          <FormField label="Expiry date" htmlFor="expiry-date">
            <Input
              id="expiry-date"
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm((p) => ({ ...p, expiry_date: e.target.value }))}
            />
          </FormField>
          <FormField
            label="Termination notice (days)"
            htmlFor="notice-days"
            helperText="How many days of notice are required to terminate"
          >
            <Input
              id="notice-days"
              type="number"
              min={0}
              max={365}
              value={form.termination_notice_days}
              onChange={(e) => setForm((p) => ({ ...p, termination_notice_days: e.target.value }))}
            />
          </FormField>
          <div className="flex items-end">
            <Checkbox
              checked={form.auto_renew}
              onChange={(e) => setForm((p) => ({ ...p, auto_renew: e.target.checked }))}
              label="Auto-renew"
              description="Automatically renew on expiry date"
            />
          </div>
        </div>
      </section>

      <section className="admin-card p-4">
        <h2 className="mb-3 text-base font-semibold">Variables & clauses (JSON)</h2>
        <p className="mb-3 text-xs text-fg-t6">
          Provide values as JSON objects. Variables fill template placeholders; commission / payment /
          cancellation override template defaults for this contract.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Variables" htmlFor="variables-json">
            <Input
              as="textarea"
              id="variables-json"
              rows={4}
              className="font-mono text-xs"
              value={form.variables_json}
              onChange={(e) => setForm((p) => ({ ...p, variables_json: e.target.value }))}
            />
          </FormField>
          <FormField label="Commission clause" htmlFor="commission-json">
            <Input
              as="textarea"
              id="commission-json"
              rows={4}
              className="font-mono text-xs"
              value={form.commission_clause_json}
              onChange={(e) => setForm((p) => ({ ...p, commission_clause_json: e.target.value }))}
            />
          </FormField>
          <FormField label="Payment terms" htmlFor="payment-json">
            <Input
              as="textarea"
              id="payment-json"
              rows={4}
              className="font-mono text-xs"
              value={form.payment_terms_json}
              onChange={(e) => setForm((p) => ({ ...p, payment_terms_json: e.target.value }))}
            />
          </FormField>
          <FormField label="Cancellation policy" htmlFor="cancellation-json">
            <Input
              as="textarea"
              id="cancellation-json"
              rows={4}
              className="font-mono text-xs"
              value={form.cancellation_policy_json}
              onChange={(e) => setForm((p) => ({ ...p, cancellation_policy_json: e.target.value }))}
            />
          </FormField>
        </div>
      </section>

      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void handleSubmit()}>
          {busy ? "Creating…" : "Create contract"}
        </Button>
        <Link
          href="/platform/contracts"
          className="inline-flex h-10 items-center rounded-md border-2 border-primary-500 px-4 text-ds-button-s font-ds-button-s font-semibold text-primary-500 transition hover:bg-primary-50"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
