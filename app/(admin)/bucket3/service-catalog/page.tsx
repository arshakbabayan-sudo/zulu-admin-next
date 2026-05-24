"use client";

/**
 * Phase 7.12 — Service catalog.
 *
 * Replaces the ComingSoonPage placeholder. Operator-scoped CRUD for
 * generic bookable services that don't fit the standard inventory verticals
 * (airport meet-and-greet, custom itinerary planning, luggage storage,
 * late check-in fees, etc.).
 *
 * Composite-offer bundling + homepage search integration are follow-ups.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessOperatorToolsNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
import {
  Button,
  Checkbox,
  FormField,
  Input,

  Pagination,
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
  V2Button,
  IconButton,
} from "@/components/ui/v2";
import { Download, Plus, Edit3, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const UNITS = ["per_person", "per_group", "flat", "per_hour", "per_day"] as const;
type Unit = (typeof UNITS)[number];

type ServiceRow = {
  id: number;
  company_id: number;
  company_name: string | null;
  name: string;
  category: string | null;
  description: string | null;
  base_price: number | null;
  currency: string | null;
  unit: Unit | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type FormState = {
  name: string;
  category: string;
  description: string;
  base_price: string;
  currency: string;
  unit: Unit | "";
  is_active: boolean;
};

const EMPTY: FormState = {
  name: "",
  category: "",
  description: "",
  base_price: "",
  currency: "USD",
  unit: "",
  is_active: true,
};

async function fetchCatalog(
  token: string,
  page: number,
  search: string
): Promise<ApiSuccessEnvelope<ServiceRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", "50");
  if (search) q.set("search", search);
  return apiFetchJson(`/service-catalog?${q.toString()}`, { method: "GET", token });
}

async function createCatalogItem(token: string, body: Record<string, unknown>) {
  return apiFetchJson<ApiSuccessEnvelope<ServiceRow>>(`/service-catalog`, {
    method: "POST",
    token,
    body,
  });
}

async function updateCatalogItem(token: string, id: number, body: Record<string, unknown>) {
  return apiFetchJson<ApiSuccessEnvelope<ServiceRow>>(`/service-catalog/${id}`, {
    method: "PATCH",
    token,
    body,
  });
}

async function deleteCatalogItem(token: string, id: number) {
  return apiFetchJson<ApiSuccessEnvelope<{ deleted_id: number }>>(`/service-catalog/${id}`, {
    method: "DELETE",
    token,
  });
}

export default function Bucket3ServiceCatalogPage() {
  const { token, user } = useAdminAuth();
  const confirm = useConfirm();
  const { t } = useLanguage();
  const allowed = canAccessOperatorToolsNav(user);
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
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
      const res = await fetchCatalog(token, page, search.trim());
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load service catalog");
    }
  }, [token, allowed, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(row: ServiceRow) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      category: row.category ?? "",
      description: row.description ?? "",
      base_price: row.base_price != null ? String(row.base_price) : "",
      currency: row.currency ?? "USD",
      unit: (row.unit as Unit | null) ?? "",
      is_active: row.is_active,
    });
  }

  function clearEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSave() {
    if (!token) return;
    setErr(null);
    if (!form.name.trim()) {
      setErr(t("admin.bucket3.service_catalog.error.name_required"));
      return;
    }
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      base_price: form.base_price.trim() ? Number(form.base_price) : null,
      currency: form.currency.trim() || null,
      unit: form.unit || null,
      is_active: form.is_active,
    };
    setBusy(true);
    try {
      if (editingId != null) {
        await updateCatalogItem(token, editingId, body);
      } else {
        await createCatalogItem(token, body);
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
    const ok = await confirm({ messageKey: "admin.bucket3.service_catalog.confirm_delete", variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteCatalogItem(token, id);
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
        <h1 className="admin-page-title">{t("admin.bucket3.service_catalog.title")}</h1>
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
          { label: "My company", href: "/bucket3/employees" },
          { label: t("admin.bucket3.service_catalog.title") },
        ]}
        title={t("admin.bucket3.service_catalog.title")}
        subtitle={
          meta
            ? t("admin.bucket3.service_catalog.subtitle_count").replace("{count}", String(meta.total))
            : t("admin.bucket3.service_catalog.subtitle")
        }
        actions={
          <>
            <V2Button icon={<Download className="h-4 w-4" />}>Export</V2Button>
            <V2Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              Add service
            </V2Button>
          </>
        }
      />

      <SectionTabs
        activeHref="/bucket3/service-catalog"
        items={[
          { href: "/bucket3/employees", label: "Employees" },
          { href: "/bucket3/payroll", label: "Payroll" },
          { href: "/bucket3/non-service-hours", label: "Non-service hours" },
          { href: "/bucket3/cases", label: "Cases" },
          { href: "/bucket3/bulk-notifications", label: "Bulk notifications" },
          { href: "/bucket3/pin-settings", label: "PIN settings" },
          { href: "/bucket3/customers", label: "Customers" },
          { href: "/bucket3/subscriptions", label: "Subscriptions" },
          { href: "/bucket3/per-x-invoicing", label: "Per-X invoicing" },
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
            {editingId != null ? t("admin.bucket3.service_catalog.edit_item").replace("{id}", String(editingId)) : t("admin.bucket3.service_catalog.add_item")}
          </h2>
          {editingId != null && (
            <Button variant="outline" size="sm" onClick={clearEdit}>
              {t("admin.bucket3.service_catalog.cancel_edit")}
            </Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={t("admin.bucket3.service_catalog.field.name")} htmlFor="sc-name" required className="sm:col-span-2 lg:col-span-3">
            <Input
              id="sc-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder={t("admin.bucket3.service_catalog.field.name_placeholder")}
            />
          </FormField>
          <FormField label={t("admin.bucket3.service_catalog.field.category")} htmlFor="sc-category">
            <Input
              id="sc-category"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              placeholder={t("admin.bucket3.service_catalog.field.category_placeholder")}
            />
          </FormField>
          <FormField label={t("admin.bucket3.service_catalog.field.base_price")} htmlFor="sc-price">
            <Input
              id="sc-price"
              type="number"
              step="0.01"
              min="0"
              value={form.base_price}
              onChange={(e) => setForm((p) => ({ ...p, base_price: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.bucket3.service_catalog.field.currency")} htmlFor="sc-currency">
            <Input
              id="sc-currency"
              value={form.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
              maxLength={3}
              className="uppercase"
            />
          </FormField>
          <FormField label={t("admin.bucket3.service_catalog.field.unit")} htmlFor="sc-unit">
            <Select
              id="sc-unit"
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value as Unit | "" }))}
            >
              <option value="">{t("admin.bucket3.service_catalog.pick")}</option>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex items-end pb-2">
            <Checkbox
              checked={form.is_active}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              label={t("admin.bucket3.service_catalog.field.active")}
            />
          </div>
          <FormField label={t("admin.bucket3.service_catalog.field.description")} htmlFor="sc-desc" className="sm:col-span-2 lg:col-span-3">
            <Input
              as="textarea"
              id="sc-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </FormField>
        </div>
        <div>
          <Button size="sm" disabled={busy} onClick={() => void handleSave()}>
            {busy ? t("common.saving") : editingId != null ? t("admin.bucket3.service_catalog.save_changes") : t("admin.bucket3.service_catalog.add_item")}
          </Button>
        </div>
      </section>

      <div className="admin-card p-4">
        <div className="relative max-w-md">
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setSearch(searchDraft.trim());
              }
            }}
            placeholder={t("admin.bucket3.service_catalog.search_placeholder")}
            className="h-10 w-full rounded-zulu border border-default bg-white px-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>#</TH>
            <TH>{t("admin.bucket3.service_catalog.col.name")}</TH>
            <TH>{t("admin.bucket3.service_catalog.col.category")}</TH>
            <TH>{t("admin.bucket3.service_catalog.col.price")}</TH>
            <TH>{t("admin.bucket3.service_catalog.col.unit")}</TH>
            <TH>{t("admin.bucket3.service_catalog.col.active")}</TH>
            <TH align="right">{t("admin.bucket3.service_catalog.col.actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={7}>{t("admin.bucket3.service_catalog.empty")}</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums text-fg-t7 font-mono text-xs">SVC-{String(r.id).padStart(3, "0")}</TD>
              <TD>
                <div className="font-medium text-fg-t8">{r.name}</div>
              </TD>
              <TD>
                {r.category ? (
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                  >
                    {r.category}
                  </span>
                ) : (
                  <span className="text-xs text-fg-t6">—</span>
                )}
              </TD>
              <TD className="tabular-nums">
                {r.base_price != null
                  ? `${r.currency ?? ""} ${r.base_price.toFixed(2)}`
                  : "—"}
              </TD>
              <TD>
                {r.unit ? (
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                  >
                    {r.unit}
                  </span>
                ) : (
                  <span className="text-xs text-fg-t6">—</span>
                )}
              </TD>
              <TD>
                <span className="inline-flex items-center gap-1.5 text-[12px]">
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: r.is_active ? "var(--admin-success)" : "var(--admin-text-tertiary)" }}
                  />
                  <span className="capitalize">{r.is_active ? t("admin.bucket3.service_catalog.status.active") : t("admin.bucket3.service_catalog.status.inactive")}</span>
                </span>
              </TD>
              <TD align="right">
                <div className="flex justify-end gap-1">
                  <IconButton onClick={() => startEdit(r)} aria-label="Edit" disabled={busy}>
                    <Edit3 className="h-4 w-4" />
                  </IconButton>
                  <IconButton onClick={() => void handleDelete(r.id)} aria-label="Delete" disabled={busy}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {meta && meta.last_page > 1 && (
        <Pagination
          page={meta.current_page}
          lastPage={meta.last_page}
          onPage={(p) => setPage(p)}
        />
      )}
      </div>
    </div>
  );
}
