"use client";

/**
 * Phase 7.2 — Block dates.
 *
 * Replaces the ComingSoonPage placeholder. Operator-side blocked date
 * management: list existing blocks with filters, add new ranges with a
 * reason note, remove. Booking-time enforcement (refusing dates where a
 * blocked row exists) is wired per-flow when individual item types
 * adopt it.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessOperatorToolsNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
import {
  Button,
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

const ITEM_TYPES = ["hotel", "flight", "car", "transfer", "excursion", "visa", "package", "offer"] as const;
type ItemType = (typeof ITEM_TYPES)[number];

type BlockedRow = {
  id: number;
  company_id: number;
  company_name: string | null;
  item_type: string;
  item_id: number | null;
  blocked_from: string;
  blocked_to: string;
  reason: string | null;
  created_by: { id: number; name: string } | null;
  created_at: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

async function fetchBlocked(
  token: string,
  page: number,
  itemType: ItemType | "",
  itemIdRaw: string
): Promise<ApiSuccessEnvelope<BlockedRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", "50");
  if (itemType) q.set("item_type", itemType);
  if (itemIdRaw.trim()) q.set("item_id", itemIdRaw.trim());
  return apiFetchJson(`/blocked-dates?${q.toString()}`, { method: "GET", token });
}

async function createBlocked(
  token: string,
  body: { item_type: ItemType; item_id?: number | null; blocked_from: string; blocked_to: string; reason?: string | null }
): Promise<ApiSuccessEnvelope<BlockedRow>> {
  return apiFetchJson(`/blocked-dates`, {
    method: "POST",
    token,
    body: body as unknown as Record<string, unknown>,
  });
}

async function deleteBlocked(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ deleted_id: number }>> {
  return apiFetchJson(`/blocked-dates/${id}`, { method: "DELETE", token });
}

export default function Bucket3BlockDatesPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessOperatorToolsNav(user);
  const [rows, setRows] = useState<BlockedRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<ItemType | "">("");
  const [filterItemId, setFilterItemId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  // Compose form
  const [form, setForm] = useState({
    item_type: "hotel" as ItemType,
    item_id: "",
    blocked_from: "",
    blocked_to: "",
    reason: "",
  });

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await fetchBlocked(token, page, filterType, filterItemId);
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load blocked dates");
    }
  }, [token, allowed, page, filterType, filterItemId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!token) return;
    setErr(null);
    if (!form.blocked_from || !form.blocked_to) {
      setErr("From and to dates are required");
      return;
    }
    if (form.blocked_from > form.blocked_to) {
      setErr("From date must be before to date");
      return;
    }
    setBusy(true);
    try {
      await createBlocked(token, {
        item_type: form.item_type,
        item_id: form.item_id.trim() ? Number(form.item_id.trim()) : null,
        blocked_from: form.blocked_from,
        blocked_to: form.blocked_to,
        reason: form.reason.trim() || null,
      });
      setForm({ item_type: "hotel", item_id: "", blocked_from: "", blocked_to: "", reason: "" });
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to create blocked date");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    if (!window.confirm("Remove this blocked date range?")) return;
    setBusy(true);
    try {
      await deleteBlocked(token, id);
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
        <h1 className="admin-page-title">Block dates</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Block dates"
        subtitle={
          meta
            ? `${meta.total} blocked ranges · oldest first`
            : "Block dates per inventory item to prevent overbooking when capacity isn't available"
        }
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">Add block</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Item type" htmlFor="block-item-type" required>
            <Select
              id="block-item-type"
              value={form.item_type}
              onChange={(e) => setForm((p) => ({ ...p, item_type: e.target.value as ItemType }))}
            >
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Item id (optional)" htmlFor="block-item-id" helperText="Leave blank to block all of this type">
            <Input
              id="block-item-id"
              type="number"
              min={1}
              value={form.item_id}
              onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}
            />
          </FormField>
          <FormField label="From" htmlFor="block-from" required>
            <Input
              id="block-from"
              type="date"
              value={form.blocked_from}
              onChange={(e) => setForm((p) => ({ ...p, blocked_from: e.target.value }))}
            />
          </FormField>
          <FormField label="To" htmlFor="block-to" required>
            <Input
              id="block-to"
              type="date"
              value={form.blocked_to}
              onChange={(e) => setForm((p) => ({ ...p, blocked_to: e.target.value }))}
            />
          </FormField>
          <FormField label="Reason" htmlFor="block-reason" className="sm:col-span-2 lg:col-span-4">
            <Input
              id="block-reason"
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              placeholder="e.g. Sold out, maintenance, owner reservation"
            />
          </FormField>
        </div>
        <div>
          <Button size="sm" disabled={busy} onClick={() => void handleCreate()}>
            {busy ? "Saving…" : "Add block"}
          </Button>
        </div>
      </section>

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">Item type</span>
            <Select
              fieldSize="sm"
              value={filterType}
              onChange={(e) => {
                setPage(1);
                setFilterType(e.target.value as ItemType | "");
              }}
              className="!w-auto min-w-[140px]"
            >
              <option value="">All</option>
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">Item id</span>
            <Input
              type="number"
              min={1}
              value={filterItemId}
              onChange={(e) => {
                setPage(1);
                setFilterItemId(e.target.value);
              }}
              className="h-9 max-w-[140px]"
              placeholder="filter"
            />
          </label>
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>#</TH>
            <TH>Type</TH>
            <TH>Item</TH>
            <TH>From</TH>
            <TH>To</TH>
            <TH>Reason</TH>
            <TH>Company</TH>
            <TH align="right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={8}>No blocked dates yet.</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums text-fg-t7">{r.id}</TD>
              <TD className="text-xs">{r.item_type}</TD>
              <TD className="tabular-nums">{r.item_id ?? <span className="text-fg-t6">all</span>}</TD>
              <TD className="text-xs">{formatDate(r.blocked_from)}</TD>
              <TD className="text-xs">{formatDate(r.blocked_to)}</TD>
              <TD className="text-xs text-fg-t6">{r.reason ?? "—"}</TD>
              <TD className="text-xs text-fg-t6">{r.company_name ?? `#${r.company_id}`}</TD>
              <TD align="right">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleDelete(r.id)}
                >
                  Remove
                </Button>
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
