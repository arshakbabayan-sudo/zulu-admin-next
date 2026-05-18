"use client";

/**
 * Phase 7.13 — Non-service hours (time-off requests).
 *
 * Replaces the ComingSoonPage placeholder. Employees create pending
 * time-off requests; managers approve / reject / cancel. The same record
 * doubles as the non-service-hours log for payroll roll-ups (Phase 7.15).
 *
 * Clock-in/out punch tracking is a separate follow-up — this surface
 * captures planned absences only.
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

const TYPES = ["vacation", "sick", "personal", "unpaid", "other"] as const;
const STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
type Type = (typeof TYPES)[number];
type Status = (typeof STATUSES)[number];

type TimeOffRow = {
  id: number;
  company_id: number;
  company_name: string | null;
  user: { id: number; name: string; email: string } | null;
  type: Type;
  starts_on: string | null;
  ends_on: string | null;
  hours_total: number | null;
  notes: string | null;
  status: Status;
  decided_by: { id: number; name: string } | null;
  decided_at: string | null;
  decision_notes: string | null;
  created_at: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function statusTier(s: Status): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (s) {
    case "pending":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "cancelled":
      return "neutral";
  }
}

async function fetchTimeOff(
  token: string,
  page: number,
  statusFilter: Status | ""
): Promise<ApiSuccessEnvelope<TimeOffRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", "50");
  if (statusFilter) q.set("status", statusFilter);
  return apiFetchJson(`/time-off?${q.toString()}`, { method: "GET", token });
}

export default function Bucket3NonServiceHoursPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessOperatorToolsNav(user);
  const [rows, setRows] = useState<TimeOffRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    type: "vacation" as Type,
    starts_on: "",
    ends_on: "",
    hours_total: "",
    notes: "",
  });

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await fetchTimeOff(token, page, statusFilter);
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load time-off records");
    }
  }, [token, allowed, page, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!token) return;
    setErr(null);
    if (!form.starts_on || !form.ends_on) {
      setErr("Start and end dates required");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        type: form.type,
        starts_on: form.starts_on,
        ends_on: form.ends_on,
        notes: form.notes.trim() || null,
      };
      if (form.user_id.trim()) body.user_id = Number(form.user_id);
      if (form.hours_total.trim()) body.hours_total = Number(form.hours_total);
      await apiFetchJson(`/time-off`, { method: "POST", token, body });
      setForm({ user_id: "", type: "vacation", starts_on: "", ends_on: "", hours_total: "", notes: "" });
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: number, status: "approved" | "rejected" | "cancelled") {
    if (!token) return;
    const verb = status === "approved" ? "Approve" : status === "rejected" ? "Reject" : "Cancel";
    if (!window.confirm(`${verb} this request?`)) return;
    setBusy(true);
    try {
      await apiFetchJson(`/time-off/${id}/decide`, {
        method: "PATCH",
        token,
        body: { status },
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Decision failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Non-service hours</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Non-service hours"
        subtitle={
          meta
            ? `${meta.total} time-off record${meta.total === 1 ? "" : "s"}`
            : "Employee time-off requests + non-availability log"
        }
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">Request time off</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="User id (optional)" htmlFor="to-user" helperText="Leave blank to request for yourself">
            <Input
              id="to-user"
              type="number"
              min={1}
              value={form.user_id}
              onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}
            />
          </FormField>
          <FormField label="Type" htmlFor="to-type" required>
            <Select
              id="to-type"
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as Type }))}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Hours total (optional)" htmlFor="to-hours">
            <Input
              id="to-hours"
              type="number"
              step="0.01"
              min="0"
              value={form.hours_total}
              onChange={(e) => setForm((p) => ({ ...p, hours_total: e.target.value }))}
            />
          </FormField>
          <FormField label="Starts" htmlFor="to-starts" required>
            <Input
              id="to-starts"
              type="date"
              value={form.starts_on}
              onChange={(e) => setForm((p) => ({ ...p, starts_on: e.target.value }))}
            />
          </FormField>
          <FormField label="Ends" htmlFor="to-ends" required>
            <Input
              id="to-ends"
              type="date"
              value={form.ends_on}
              onChange={(e) => setForm((p) => ({ ...p, ends_on: e.target.value }))}
            />
          </FormField>
          <FormField label="Notes" htmlFor="to-notes" className="sm:col-span-2 lg:col-span-3">
            <Input
              as="textarea"
              id="to-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </FormField>
        </div>
        <div>
          <Button size="sm" disabled={busy} onClick={() => void handleCreate()}>
            {busy ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </section>

      <div className="admin-card p-4">
        <label className="flex items-center gap-2 text-sm text-fg-t6">
          <span className="font-medium text-fg-t7">Status</span>
          <Select
            fieldSize="sm"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as Status | "");
            }}
            className="!w-auto min-w-[140px]"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>#</TH>
            <TH>Employee</TH>
            <TH>Type</TH>
            <TH>From</TH>
            <TH>To</TH>
            <TH>Hours</TH>
            <TH>Status</TH>
            <TH align="right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={8}>No time-off records yet.</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums text-fg-t7">{r.id}</TD>
              <TD>
                <div className="font-medium text-fg-t8">{r.user?.name ?? "—"}</div>
                <div className="text-xs text-fg-t6">{r.user?.email ?? ""}</div>
              </TD>
              <TD className="text-xs">{r.type}</TD>
              <TD className="text-xs">{formatDate(r.starts_on)}</TD>
              <TD className="text-xs">{formatDate(r.ends_on)}</TD>
              <TD className="tabular-nums text-xs">{r.hours_total ?? "—"}</TD>
              <TD>
                <StatusPill status={statusTier(r.status)}>{r.status}</StatusPill>
              </TD>
              <TD align="right">
                {r.status === "pending" ? (
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busy}
                      onClick={() => void decide(r.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => void decide(r.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-fg-t6">—</span>
                )}
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
