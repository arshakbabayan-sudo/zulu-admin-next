"use client";

/**
 * Phase 5b — Contract template create form (admin).
 * Backend: POST /platform-admin/contract-templates.
 *
 * Templates carry the body text with `{{placeholders}}` that contracts fill in
 * via the `variables` map at create time. We accept body as plain text and
 * default_variables as JSON.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiAdminCreateContractTemplate,
  CONTRACT_LANGUAGES,
  CONTRACT_TYPES,
  contractTypeLabel,
  type ContractLanguage,
  type ContractType,
} from "@/lib/contracts-api";
import { Button, FormField, Input, PageHeader, Select } from "@/components/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type FormState = {
  name: string;
  type: ContractType;
  language: ContractLanguage;
  version: string;
  body_template: string;
  default_variables_json: string;
};

const EMPTY: FormState = {
  name: "",
  type: "platform",
  language: "en",
  version: "1.0",
  body_template: "",
  default_variables_json: "{}",
};

export default function AdminContractTemplateNewPage() {
  const router = useRouter();
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    if (!token) return;
    if (!form.name.trim()) return setErr("Name is required");
    if (!form.body_template.trim()) return setErr("Body template is required");

    let defaults: Record<string, unknown> = {};
    if (form.default_variables_json.trim() && form.default_variables_json.trim() !== "{}") {
      try {
        const parsed = JSON.parse(form.default_variables_json);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return setErr("Default variables must be a JSON object");
        }
        defaults = parsed as Record<string, unknown>;
      } catch {
        return setErr("Default variables: invalid JSON");
      }
    }

    setBusy(true);
    setErr(null);
    try {
      const res = await apiAdminCreateContractTemplate(token, {
        name: form.name.trim(),
        type: form.type,
        language: form.language,
        version: form.version.trim() || undefined,
        body_template: form.body_template,
        default_variables: defaults,
      });
      router.push(`/platform/contract-templates/${res.data.id}`);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">New contract template</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New contract template"
        subtitle="Body text supports {{placeholders}} that contracts fill in at create time"
        actions={
          <Link
            href="/platform/contract-templates"
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
        <h2 className="mb-3 text-base font-semibold">Identity</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Name" htmlFor="tpl-name" required className="sm:col-span-2">
            <Input
              id="tpl-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Tour Operator Platform Agreement"
            />
          </FormField>
          <FormField label="Type" htmlFor="tpl-type" required>
            <Select
              id="tpl-type"
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ContractType }))}
            >
              {CONTRACT_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {contractTypeLabel(tp)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Language" htmlFor="tpl-language" required>
            <Select
              id="tpl-language"
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
          <FormField label="Version" htmlFor="tpl-version" helperText="e.g. 1.0, 2.0-draft">
            <Input
              id="tpl-version"
              value={form.version}
              onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))}
            />
          </FormField>
        </div>
      </section>

      <section className="admin-card p-4">
        <h2 className="mb-3 text-base font-semibold">Body template</h2>
        <FormField
          label="Body text"
          htmlFor="tpl-body"
          required
          helperText="Use {{variable_name}} placeholders that get replaced when a contract is generated"
        >
          <Input
            as="textarea"
            id="tpl-body"
            rows={14}
            className="font-mono text-xs"
            value={form.body_template}
            onChange={(e) => setForm((p) => ({ ...p, body_template: e.target.value }))}
            placeholder={"AGREEMENT BETWEEN {{party_a_name}} AND {{party_b_name}}\n\nThis agreement..."}
          />
        </FormField>
      </section>

      <section className="admin-card p-4">
        <h2 className="mb-3 text-base font-semibold">Default variables</h2>
        <FormField
          label="JSON map"
          htmlFor="tpl-defaults"
          helperText="Default values for placeholders — used when the contract create form omits them"
        >
          <Input
            as="textarea"
            id="tpl-defaults"
            rows={6}
            className="font-mono text-xs"
            value={form.default_variables_json}
            onChange={(e) => setForm((p) => ({ ...p, default_variables_json: e.target.value }))}
          />
        </FormField>
      </section>

      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void handleSubmit()}>
          {busy ? "Creating…" : "Create template"}
        </Button>
        <Link
          href="/platform/contract-templates"
          className="inline-flex h-10 items-center rounded-md border-2 border-primary-500 px-4 text-ds-button-s font-ds-button-s font-semibold text-primary-500 transition hover:bg-primary-50"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
