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
import { useLanguage } from "@/contexts/LanguageContext";
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
  Checkbox,
  FormField,
  Input,
  Select,
} from "@/components/ui";
import { PageHeader as V2PageHeader, V2Card, V2Button } from "@/components/ui/v2";
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
  const { t } = useLanguage();
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
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.contract_new.err_load_options"));
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
      setErr(t("admin.contract_new.err_pick_template"));
      return;
    }
    if (!form.party_b_company_id) {
      setErr(t("admin.contract_new.err_party_b_required"));
      return;
    }
    if (!isPlatformType && !form.party_a_company_id) {
      setErr(t("admin.contract_new.err_party_a_required"));
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
      setErr(e instanceof ApiRequestError ? e.message : t("admin.contract_new.err_create"));
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.contract_new.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/contracts" },
          { label: t("admin.platform_contracts.title") || "Partnership agreements", href: "/platform/contracts" },
          { label: t("admin.contract_new.title") || "New contract" },
        ]}
        title={t("admin.contract_new.title")}
        subtitle={t("admin.contract_new.subtitle")}
        actions={
          <>
            <V2Button as="link" href="/platform/contracts">
              {t("common.cancel")}
            </V2Button>
            <V2Button variant="primary" disabled={busy} onClick={() => void handleSubmit()}>
              {busy ? t("admin.contract_new.btn_creating") : t("admin.contract_new.btn_create")}
            </V2Button>
          </>
        }
      />
      <div className="space-y-6">

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <V2Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">{t("admin.contract_new.section.template_parties")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t("admin.contract_new.field.template")} htmlFor="contract-template" required className="sm:col-span-2">
            <Select
              id="contract-template"
              value={form.template_id}
              onChange={(e) => setForm((p) => ({ ...p, template_id: e.target.value }))}
            >
              <option value="">— {t("admin.contract_new.placeholder.pick_template")} —</option>
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
              {t("admin.contract_new.template_type_label")}: <span className="font-semibold">{selectedTemplate.type}</span>.{" "}
              {isPlatformType
                ? t("admin.contract_new.party_a_zulu_note")
                : t("admin.contract_new.party_both_partners_note")}
            </div>
          )}

          {!isPlatformType && (
            <FormField label={t("admin.contract_new.field.party_a")} htmlFor="party-a" required>
              <Select
                id="party-a"
                value={form.party_a_company_id}
                onChange={(e) => setForm((p) => ({ ...p, party_a_company_id: e.target.value }))}
              >
                <option value="">— {t("admin.contract_new.placeholder.pick_company")} —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} — {c.name ?? t("admin.contract_new.unnamed_company")}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <FormField
            label={t("admin.contract_new.field.party_b")}
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

          <FormField label={t("admin.contract_new.field.language")} htmlFor="contract-language">
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
      </V2Card>

      <V2Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">{t("admin.contract_new.section.schedule")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t("admin.contract_new.field.effective_date")} htmlFor="effective-date">
            <Input
              id="effective-date"
              type="date"
              value={form.effective_date}
              onChange={(e) => setForm((p) => ({ ...p, effective_date: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.contract_new.field.expiry_date")} htmlFor="expiry-date">
            <Input
              id="expiry-date"
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm((p) => ({ ...p, expiry_date: e.target.value }))}
            />
          </FormField>
          <FormField
            label={t("admin.contract_new.field.termination_notice_days")}
            htmlFor="notice-days"
            helperText={t("admin.contract_new.field.termination_notice_days_hint")}
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
              label={t("admin.contract_new.field.auto_renew")}
              description={t("admin.contract_new.field.auto_renew_hint")}
            />
          </div>
        </div>
      </V2Card>

      <V2Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">{t("admin.contract_new.section.variables")}</h2>
        <p className="mb-3 text-xs text-fg-t6">{t("admin.contract_new.section.variables_hint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t("admin.contract_new.field.variables")} htmlFor="variables-json">
            <Input
              as="textarea"
              id="variables-json"
              rows={4}
              className="font-mono text-xs"
              value={form.variables_json}
              onChange={(e) => setForm((p) => ({ ...p, variables_json: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.contract_new.field.commission_clause")} htmlFor="commission-json">
            <Input
              as="textarea"
              id="commission-json"
              rows={4}
              className="font-mono text-xs"
              value={form.commission_clause_json}
              onChange={(e) => setForm((p) => ({ ...p, commission_clause_json: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.contract_new.field.payment_terms")} htmlFor="payment-json">
            <Input
              as="textarea"
              id="payment-json"
              rows={4}
              className="font-mono text-xs"
              value={form.payment_terms_json}
              onChange={(e) => setForm((p) => ({ ...p, payment_terms_json: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.contract_new.field.cancellation_policy")} htmlFor="cancellation-json">
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
      </V2Card>

      <div className="flex gap-2">
        <V2Button variant="primary" disabled={busy} onClick={() => void handleSubmit()}>
          {busy ? t("admin.contract_new.btn_creating") : t("admin.contract_new.btn_create")}
        </V2Button>
        <V2Button as="link" href="/platform/contracts">
          {t("common.cancel")}
        </V2Button>
      </div>
      </div>
    </div>
  );
}
