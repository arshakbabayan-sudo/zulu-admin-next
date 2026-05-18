"use client";

/**
 * Phase 5b — Contract template detail + edit (admin).
 * Backend: GET /platform-admin/contract-templates/{id}, PATCH same.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiAdminContractTemplate,
  apiAdminUpdateContractTemplate,
  CONTRACT_LANGUAGES,
  CONTRACT_TYPES,
  contractTypeLabel,
  type ContractLanguage,
  type ContractType,
  type ContractTemplateDetail,
} from "@/lib/contracts-api";
import { Button, FormField, Input, PageHeader, Select } from "@/components/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function AdminContractTemplateDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [tpl, setTpl] = useState<ContractTemplateDetail | null>(null);
  const [form, setForm] = useState<{
    name: string;
    type: ContractType;
    language: ContractLanguage;
    version: string;
    body_template: string;
    default_variables_json: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed || !id) return;
    setErr(null);
    try {
      const res = await apiAdminContractTemplate(token, id);
      setTpl(res.data);
      setForm({
        name: res.data.name,
        type: res.data.type,
        language: res.data.language,
        version: res.data.version ?? "",
        body_template: res.data.body_template ?? "",
        default_variables_json: JSON.stringify(res.data.default_variables ?? {}, null, 2),
      });
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to load template");
    }
  }, [token, allowed, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!token || !form) return;
    if (!form.name.trim()) return setErr("Name is required");

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
      await apiAdminUpdateContractTemplate(token, id, {
        name: form.name.trim(),
        type: form.type,
        language: form.language,
        version: form.version.trim() || undefined,
        body_template: form.body_template,
        default_variables: defaults,
      });
      setSavedAt(new Date().toLocaleTimeString());
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Template detail</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (err && !tpl) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Template detail</h1>
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
        <Link href="/platform/contract-templates" className="text-sm text-primary hover:underline">
          ← Back
        </Link>
      </div>
    );
  }

  if (!tpl || !form) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Template detail</h1>
        <div className="admin-card p-4 text-sm text-fg-t6">Loading…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tpl.name}
        subtitle={`${contractTypeLabel(tpl.type)} · ${tpl.language.toUpperCase()}${tpl.version ? ` · v${tpl.version}` : ""}`}
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

      {savedAt && (
        <div className="rounded-zulu border border-success-200 bg-success-50 px-4 py-2 text-sm text-success-700">
          Saved at {savedAt}
        </div>
      )}

      <section className="admin-card p-4">
        <h2 className="mb-3 text-base font-semibold">Identity</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Name" htmlFor="tpl-name" required className="sm:col-span-2">
            <Input
              id="tpl-name"
              value={form.name}
              onChange={(e) => setForm((p) => p && { ...p, name: e.target.value })}
            />
          </FormField>
          <FormField label="Type" htmlFor="tpl-type" required>
            <Select
              id="tpl-type"
              value={form.type}
              onChange={(e) => setForm((p) => p && { ...p, type: e.target.value as ContractType })}
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
              onChange={(e) =>
                setForm((p) => p && { ...p, language: e.target.value as ContractLanguage })
              }
            >
              {CONTRACT_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Version" htmlFor="tpl-version">
            <Input
              id="tpl-version"
              value={form.version}
              onChange={(e) => setForm((p) => p && { ...p, version: e.target.value })}
            />
          </FormField>
        </div>
      </section>

      <section className="admin-card p-4">
        <h2 className="mb-3 text-base font-semibold">Body template</h2>
        <FormField label="Body text" htmlFor="tpl-body">
          <Input
            as="textarea"
            id="tpl-body"
            rows={14}
            className="font-mono text-xs"
            value={form.body_template}
            onChange={(e) => setForm((p) => p && { ...p, body_template: e.target.value })}
          />
        </FormField>
      </section>

      <section className="admin-card p-4">
        <h2 className="mb-3 text-base font-semibold">Default variables</h2>
        <FormField label="JSON map" htmlFor="tpl-defaults">
          <Input
            as="textarea"
            id="tpl-defaults"
            rows={6}
            className="font-mono text-xs"
            value={form.default_variables_json}
            onChange={(e) =>
              setForm((p) => p && { ...p, default_variables_json: e.target.value })
            }
          />
        </FormField>
      </section>

      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void handleSave()}>
          {busy ? "Saving…" : "Save changes"}
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
