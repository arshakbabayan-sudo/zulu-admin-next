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
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiAdminContractTemplate,
  apiAdminCreateContractTemplate,
  CONTRACT_LANGUAGES,
  CONTRACT_TYPES,
  contractTypeLabel,
  type ContractLanguage,
  type ContractType,
} from "@/lib/contracts-api";
import { FormField, Input, Select } from "@/components/ui";
import { PageHeader as V2PageHeader, V2Card, V2Button } from "@/components/ui/v2";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type FormState = {
  name: string;
  type: ContractType;
  language: ContractLanguage;
  body: string;
  variables_json: string;
};

const EMPTY: FormState = {
  name: "",
  type: "platform",
  language: "en",
  body: "",
  variables_json: "{}",
};

export default function AdminContractTemplateNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloneId = searchParams?.get("clone") ?? null;
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cloning, setCloning] = useState<boolean>(cloneId !== null);

  // Phase Բ.2 (2026-05-28) — when ?clone=<id> is present in the URL, fetch
  // the source template and prefill the form so the user can edit/rename
  // and save as a new template. Backend isn't involved beyond the standard
  // GET /contract-templates/{id} + POST /contract-templates flow.
  useEffect(() => {
    if (!cloneId || !token || !allowed) return;
    let cancelled = false;
    (async () => {
      setCloning(true);
      try {
        const res = await apiAdminContractTemplate(token, cloneId);
        if (cancelled) return;
        const src = res.data;
        setForm({
          name: `${src.name} (copy)`,
          type: src.type,
          language: src.language,
          body: src.body ?? "",
          variables_json: JSON.stringify(src.variables ?? {}, null, 2),
        });
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof ApiRequestError ? e.message : t("admin.contract_new.err_clone_load"));
        }
      } finally {
        if (!cancelled) setCloning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cloneId, token, allowed, t]);

  async function handleSubmit() {
    if (!token) return;
    if (!form.name.trim()) return setErr(t("admin.template_form.err_name_required"));
    if (!form.body.trim()) return setErr(t("admin.template_form.err_body_required"));

    let defaults: Record<string, unknown> = {};
    if (form.variables_json.trim() && form.variables_json.trim() !== "{}") {
      try {
        const parsed = JSON.parse(form.variables_json);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return setErr(t("admin.template_form.err_defaults_must_be_object"));
        }
        defaults = parsed as Record<string, unknown>;
      } catch {
        return setErr(t("admin.template_form.err_defaults_invalid_json"));
      }
    }

    setBusy(true);
    setErr(null);
    try {
      const res = await apiAdminCreateContractTemplate(token, {
        name: form.name.trim(),
        type: form.type,
        language: form.language,
        body: form.body,
        variables: defaults,
      });
      router.push(`/platform/contract-templates/${res.data.id}`);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.contract_new.err_create"));
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.template_form.new_title")}</h1>
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
          { label: "Management", href: "/platform/contract-templates" },
          { label: t("admin.contract_templates.title") || "Contract templates", href: "/platform/contract-templates" },
          { label: t("admin.template_form.new_title") || "New template" },
        ]}
        title={t("admin.template_form.new_title")}
        subtitle={t("admin.template_form.new_subtitle")}
        actions={
          <>
            <V2Button as="link" href="/platform/contract-templates">
              {t("common.cancel")}
            </V2Button>
            <V2Button variant="primary" disabled={busy} onClick={() => void handleSubmit()}>
              {busy ? t("admin.contract_new.btn_creating") : t("admin.template_form.btn_create")}
            </V2Button>
          </>
        }
      />
      <div className="space-y-6">

      {cloning && (
        <div className="rounded-md border border-info-100 bg-info-50 px-4 py-2 text-sm text-info-700">
          {t("admin.contract_new.cloning") !== "admin.contract_new.cloning"
            ? t("admin.contract_new.cloning")
            : "Loading source template…"}
        </div>
      )}

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <V2Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">{t("admin.template_form.section.identity")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t("admin.contract_templates.col_name")} htmlFor="tpl-name" required className="sm:col-span-2">
            <Input
              id="tpl-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder={t("admin.template_form.name_placeholder")}
            />
          </FormField>
          <FormField label={t("admin.contracts.col_type")} htmlFor="tpl-type" required>
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
          <FormField label={t("admin.contract_new.field.language")} htmlFor="tpl-language" required>
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
          {/* Version is server-managed (bumped on body change). The old free-text
              field has been removed to match the backend integer column. */}
        </div>
      </V2Card>

      <V2Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">{t("admin.template_form.section.body")}</h2>
        <FormField
          label={t("admin.template_form.body_label")}
          htmlFor="tpl-body"
          required
          helperText={t("admin.template_form.body_hint")}
        >
          <Input
            as="textarea"
            id="tpl-body"
            rows={14}
            className="font-mono text-xs"
            value={form.body}
            onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
            placeholder={t("admin.template_form.body_placeholder")}
          />
        </FormField>
      </V2Card>

      <V2Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">{t("admin.template_form.section.defaults")}</h2>
        <FormField
          label={t("admin.template_form.defaults_label")}
          htmlFor="tpl-defaults"
          helperText={t("admin.template_form.defaults_hint")}
        >
          <Input
            as="textarea"
            id="tpl-defaults"
            rows={6}
            className="font-mono text-xs"
            value={form.variables_json}
            onChange={(e) => setForm((p) => ({ ...p, variables_json: e.target.value }))}
          />
        </FormField>
      </V2Card>

      <div className="flex gap-2">
        <V2Button variant="primary" disabled={busy} onClick={() => void handleSubmit()}>
          {busy ? t("admin.contract_new.btn_creating") : t("admin.template_form.btn_create")}
        </V2Button>
        <V2Button as="link" href="/platform/contract-templates">
          {t("common.cancel")}
        </V2Button>
      </div>
      </div>
    </div>
  );
}
