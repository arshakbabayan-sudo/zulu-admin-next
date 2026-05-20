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
import { canAccessOperatorToolsNav } from "@/lib/access";
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
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
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
      setErr("Name is required");
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
        <h1 className="admin-page-title">Service catalog</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service catalog"
        subtitle={
          meta
            ? `${meta.total} catalog item${meta.total === 1 ? "" : "s"}`
            : "Generic bookable services alongside standard inventory"
        }
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <section className="admin-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            {editingId != null ? `Edit catalog item #${editingId}` : "Add catalog item"}
          </h2>
          {editingId != null && (
            <Button variant="outline" size="sm" onClick={clearEdit}>
              Cancel edit
            </Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Name" htmlFor="sc-name" required className="sm:col-span-2 lg:col-span-3">
            <Input
              id="sc-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Airport meet-and-greet"
            />
          </FormField>
          <FormField label="Category" htmlFor="sc-category">
            <Input
              id="sc-category"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              placeholder="e.g. concierge, transport-extra"
            />
          </FormField>
          <FormField label="Base price" htmlFor="sc-price">
            <Input
              id="sc-price"
              type="number"
              step="0.01"
              min="0"
              value={form.base_price}
              onChange={(e) => setForm((p) => ({ ...p, base_price: e.target.value }))}
            />
          </FormField>
          <FormField label="Currency" htmlFor="sc-currency">
            <Input
              id="sc-currency"
              value={form.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
              maxLength={3}
              className="uppercase"
            />
          </FormField>
          <FormField label="Unit" htmlFor="sc-unit">
            <Select
              id="sc-unit"
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value as Unit | "" }))}
            >
              <option value="">— pick —</option>
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
              label="Active"
            />
          </div>
          <FormField label="Description" htmlFor="sc-desc" className="sm:col-span-2 lg:col-span-3">
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
            {busy ? "Saving…" : editingId != null ? "Save changes" : "Add catalog item"}
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
            placeholder="Search by name or category"
            className="h-10 w-full rounded-zulu border border-default bg-white px-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>#</TH>
            <TH>Name</TH>
            <TH>Category</TH>
            <TH>Price</TH>
            <TH>Unit</TH>
            <TH>Active</TH>
            <TH align="right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={7}>No catalog items yet.</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums text-fg-t7">{r.id}</TD>
              <TD className="font-medium text-fg-t8">{r.name}</TD>
              <TD className="text-xs text-fg-t7">{r.category ?? "—"}</TD>
              <TD className="tabular-nums">
                {r.base_price != null
                  ? `${r.currency ?? ""} ${r.base_price.toFixed(2)}`
                  : "—"}
              </TD>
              <TD className="text-xs text-fg-t7">{r.unit ?? "—"}</TD>
              <TD>
                {r.is_active ? (
                  <span className="text-xs font-medium text-success-700">Active</span>
                ) : (
                  <span className="text-xs text-fg-t6">Inactive</span>
                )}
              </TD>
              <TD align="right">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => startEdit(r)}>
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleDelete(r.id)}
                  >
                    Remove
                  </Button>
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
  );
}
