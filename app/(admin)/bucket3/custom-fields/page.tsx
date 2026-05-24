"use client";

/**
 * Phase 7.4 — Custom field definitions.
 *
 * Replaces the ComingSoonPage placeholder. Operator-scoped CRUD for
 * custom field schema that future offer forms / search filters will pick
 * up. Renderer wiring per-vertical is follow-up.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessOperatorToolsNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiSuccessEnvelope } from "@/lib/api-envelope";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
} from "@/components/ui/v2";
import { useCallback, useEffect, useState } from "react";

type FieldType = "text" | "number" | "boolean" | "select" | "multi_select" | "date";
type Scope = "all" | "hotel" | "flight" | "car" | "transfer" | "excursion" | "visa" | "package";

type FieldDef = {
  id: number;
  company_id: number;
  company_name: string | null;
  scope: Scope;
  key: string;
  label: string;
  field_type: FieldType;
  options: string[] | null;
  help_text: string | null;
  is_required: boolean;
  show_in_filter: boolean;
  display_order: number;
  is_active: boolean;
};

type IndexResponse = {
  available_field_types: FieldType[];
  available_scopes: Scope[];
  fields: FieldDef[];
};

type FormState = {
  scope: Scope;
  key: string;
  label: string;
  field_type: FieldType;
  options_csv: string;
  help_text: string;
  is_required: boolean;
  show_in_filter: boolean;
  display_order: string;
  is_active: boolean;
};

const EMPTY: FormState = {
  scope: "all",
  key: "",
  label: "",
  field_type: "text",
  options_csv: "",
  help_text: "",
  is_required: false,
  show_in_filter: false,
  display_order: "0",
  is_active: true,
};

async function fetchFields(token: string): Promise<ApiSuccessEnvelope<IndexResponse>> {
  return apiFetchJson(`/custom-fields`, { method: "GET", token });
}

export default function Bucket3CustomFieldsPage() {
  const { token, user } = useAdminAuth();
  const confirm = useConfirm();
  const { t } = useLanguage();
  const allowed = canAccessOperatorToolsNav(user);
  const [data, setData] = useState<IndexResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await fetchFields(token);
      setData(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load custom fields");
    }
  }, [token, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(f: FieldDef) {
    setEditingId(f.id);
    setForm({
      scope: f.scope,
      key: f.key,
      label: f.label,
      field_type: f.field_type,
      options_csv: f.options?.join(", ") ?? "",
      help_text: f.help_text ?? "",
      is_required: f.is_required,
      show_in_filter: f.show_in_filter,
      display_order: String(f.display_order),
      is_active: f.is_active,
    });
  }

  function clearEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSave() {
    if (!token) return;
    setErr(null);
    if (!form.key.trim() || !form.label.trim()) {
      setErr(t("admin.bucket3.custom_fields.error.key_label_required"));
      return;
    }
    if (!/^[a-z0-9_]+$/.test(form.key.trim())) {
      setErr(t("admin.bucket3.custom_fields.error.key_format"));
      return;
    }
    const isOptioned = form.field_type === "select" || form.field_type === "multi_select";
    const options = isOptioned
      ? form.options_csv
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== "")
      : null;

    const body: Record<string, unknown> = {
      scope: form.scope,
      key: form.key.trim(),
      label: form.label.trim(),
      field_type: form.field_type,
      help_text: form.help_text.trim() || null,
      is_required: form.is_required,
      show_in_filter: form.show_in_filter,
      display_order: Number(form.display_order) || 0,
      is_active: form.is_active,
    };
    if (options !== null) body.options = options;

    setBusy(true);
    try {
      if (editingId != null) {
        await apiFetchJson(`/custom-fields/${editingId}`, { method: "PATCH", token, body });
      } else {
        await apiFetchJson(`/custom-fields`, { method: "POST", token, body });
      }
      clearEdit();
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.bucket3.custom_fields.confirm_delete", variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetchJson(`/custom-fields/${id}`, { method: "DELETE", token });
      if (editingId === id) clearEdit();
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.bucket3.custom_fields.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  const showOptions = form.field_type === "select" || form.field_type === "multi_select";

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.bucket3.custom_fields.title") },
        ]}
        title={t("admin.bucket3.custom_fields.title")}
        subtitle={
          data
            ? t("admin.bucket3.custom_fields.subtitle_count").replace("{count}", String(data.fields.length))
            : t("admin.bucket3.custom_fields.subtitle")
        }
      />

      <SectionTabs
        activeHref="/bucket3/custom-fields"
        items={[
          { href: "/settings/pricing-rules", label: "Pricing rules" },
          { href: "/settings/money-flow", label: "Money flow" },
          { href: "/localization/languages", label: "Languages" },
          { href: "/localization/templates", label: "Email templates" },
          { href: "/platform/banners", label: "Banners" },
          { href: "/pages", label: "CMS pages" },
          { href: "/platform/notifications", label: "System notifications" },
          { href: "/platform/newsletter", label: "Newsletter" },
          { href: "/platform/loyalty", label: "Loyalty" },
          { href: "/bucket3/block-dates", label: "Block dates" },
          { href: "/bucket3/custom-fields", label: "Custom fields" },
          { href: "/platform/security", label: "Security" },
          { href: "/platform/webhooks", label: "Webhooks" },
          { href: "/platform/locations", label: "Locations" },
          { href: "/platform/settings/brand", label: "Brand" },
          { href: "/connections", label: "Connections" },
          { href: "/support/tickets", label: "Support" },
          { href: "/platform/reviews", label: "Reviews" },
        ]}
      />

      <div className="space-y-6">
      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <section className="admin-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            {editingId != null ? t("admin.bucket3.custom_fields.edit_field").replace("{id}", String(editingId)) : t("admin.bucket3.custom_fields.add_field")}
          </h2>
          {editingId != null && (
            <Button variant="outline" size="sm" onClick={clearEdit}>
              {t("admin.bucket3.custom_fields.cancel_edit")}
            </Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={t("admin.bucket3.custom_fields.field.scope")} htmlFor="cf-scope" required>
            <Select
              id="cf-scope"
              value={form.scope}
              onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value as Scope }))}
            >
              {(data?.available_scopes ?? ["all"]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label={t("admin.bucket3.custom_fields.field.key")}
            htmlFor="cf-key"
            required
            helperText={t("admin.bucket3.custom_fields.field.key_helper")}
          >
            <Input
              id="cf-key"
              value={form.key}
              onChange={(e) => setForm((p) => ({ ...p, key: e.target.value.toLowerCase() }))}
              disabled={editingId != null}
              placeholder={t("admin.bucket3.custom_fields.field.key_placeholder")}
            />
          </FormField>
          <FormField label={t("admin.bucket3.custom_fields.field.label")} htmlFor="cf-label" required>
            <Input
              id="cf-label"
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              placeholder={t("admin.bucket3.custom_fields.field.label_placeholder")}
            />
          </FormField>
          <FormField label={t("admin.bucket3.custom_fields.field.type")} htmlFor="cf-type" required>
            <Select
              id="cf-type"
              value={form.field_type}
              onChange={(e) => setForm((p) => ({ ...p, field_type: e.target.value as FieldType }))}
            >
              {(data?.available_field_types ?? ["text"]).map((ft) => (
                <option key={ft} value={ft}>
                  {ft}
                </option>
              ))}
            </Select>
          </FormField>
          {showOptions && (
            <FormField
              label={t("admin.bucket3.custom_fields.field.options")}
              htmlFor="cf-options"
              required
              helperText={t("admin.bucket3.custom_fields.field.options_helper")}
              className="sm:col-span-2"
            >
              <Input
                id="cf-options"
                value={form.options_csv}
                onChange={(e) => setForm((p) => ({ ...p, options_csv: e.target.value }))}
              />
            </FormField>
          )}
          <FormField label={t("admin.bucket3.custom_fields.field.help_text")} htmlFor="cf-help" className="sm:col-span-2 lg:col-span-3">
            <Input
              id="cf-help"
              value={form.help_text}
              onChange={(e) => setForm((p) => ({ ...p, help_text: e.target.value }))}
              placeholder={t("admin.bucket3.custom_fields.field.help_text_placeholder")}
            />
          </FormField>
          <FormField label={t("admin.bucket3.custom_fields.field.display_order")} htmlFor="cf-order">
            <Input
              id="cf-order"
              type="number"
              value={form.display_order}
              onChange={(e) => setForm((p) => ({ ...p, display_order: e.target.value }))}
            />
          </FormField>
          <div className="flex items-end gap-3 pb-2">
            <Checkbox
              checked={form.is_required}
              onChange={(e) => setForm((p) => ({ ...p, is_required: e.target.checked }))}
              label={t("admin.bucket3.custom_fields.field.required")}
            />
            <Checkbox
              checked={form.show_in_filter}
              onChange={(e) => setForm((p) => ({ ...p, show_in_filter: e.target.checked }))}
              label={t("admin.bucket3.custom_fields.field.show_in_filter")}
            />
            <Checkbox
              checked={form.is_active}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              label={t("admin.bucket3.custom_fields.field.active")}
            />
          </div>
        </div>
        <div>
          <Button size="sm" disabled={busy} onClick={() => void handleSave()}>
            {busy ? t("common.saving") : editingId != null ? t("admin.bucket3.custom_fields.save_changes") : t("admin.bucket3.custom_fields.add_field")}
          </Button>
        </div>
      </section>

      <Table>
        <THead>
          <TR>
            <TH>{t("admin.bucket3.custom_fields.col.scope")}</TH>
            <TH>{t("admin.bucket3.custom_fields.col.key")}</TH>
            <TH>{t("admin.bucket3.custom_fields.col.label")}</TH>
            <TH>{t("admin.bucket3.custom_fields.col.type")}</TH>
            <TH>{t("admin.bucket3.custom_fields.col.flags")}</TH>
            <TH>{t("admin.bucket3.custom_fields.col.order")}</TH>
            <TH>{t("admin.bucket3.custom_fields.col.active")}</TH>
            <TH align="right">{t("admin.bucket3.custom_fields.col.actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {!data || data.fields.length === 0 ? (
            <TEmpty colSpan={8}>{t("admin.bucket3.custom_fields.empty")}</TEmpty>
          ) : null}
          {data?.fields.map((f) => (
            <TR key={f.id}>
              <TD className="text-xs">{f.scope}</TD>
              <TD className="font-mono text-xs text-fg-t8">{f.key}</TD>
              <TD className="font-medium">{f.label}</TD>
              <TD className="text-xs">{f.field_type}</TD>
              <TD className="text-xs text-fg-t6">
                {[f.is_required ? "required" : null, f.show_in_filter ? "filter" : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </TD>
              <TD className="tabular-nums">{f.display_order}</TD>
              <TD>
                {f.is_active ? (
                  <span className="text-xs font-medium text-success-700">{t("admin.bucket3.custom_fields.status.active")}</span>
                ) : (
                  <span className="text-xs text-fg-t6">{t("admin.bucket3.custom_fields.status.inactive")}</span>
                )}
              </TD>
              <TD align="right">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => startEdit(f)}>
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleDelete(f.id)}
                  >
                    {t("common.remove")}
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      </div>
    </div>
  );
}
