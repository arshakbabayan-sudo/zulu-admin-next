"use client";

/**
 * Phase 7.15 — Payroll ledger.
 *
 * Replaces the ComingSoonPage placeholder. Per-employee monthly records
 * with base salary + hourly + commission + bonus + deductions auto-summed
 * server-side into gross_pay and net_pay. Lifecycle: draft → finalized → paid.
 *
 * Payslip PDF generation + bank-transfer batch export are follow-ups.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessOperatorToolsNav } from "@/lib/access";
import { ApiRequestError, apiDownloadFile, apiFetchJson } from "@/lib/api-client";
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

const STATUSES = ["draft", "finalized", "paid"] as const;
type Status = (typeof STATUSES)[number];

type PayrollRow = {
  id: number;
  company_id: number;
  company_name: string | null;
  user: { id: number; name: string; email: string } | null;
  period_start: string | null;
  period_end: string | null;
  base_salary: number;
  hours_worked: number | null;
  hourly_rate: number | null;
  commission_amount: number;
  bonus_amount: number;
  deductions_amount: number;
  gross_pay: number;
  net_pay: number;
  currency: string;
  status: Status;
  paid_at: string | null;
  notes: string | null;
  created_at: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function statusTier(s: Status): "neutral" | "info" | "success" {
  switch (s) {
    case "draft":
      return "neutral";
    case "finalized":
      return "info";
    case "paid":
      return "success";
  }
}

async function fetchPayroll(
  token: string,
  page: number,
  statusFilter: Status | ""
): Promise<ApiSuccessEnvelope<PayrollRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", "50");
  if (statusFilter) q.set("status", statusFilter);
  return apiFetchJson(`/payroll?${q.toString()}`, { method: "GET", token });
}

export default function Bucket3PayrollPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessOperatorToolsNav(user);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    user_id: "",
    period_start: "",
    period_end: "",
    base_salary: "0",
    hours_worked: "",
    hourly_rate: "",
    commission_amount: "0",
    bonus_amount: "0",
    deductions_amount: "0",
    currency: "USD",
    notes: "",
  });

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await fetchPayroll(token, page, statusFilter);
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load payroll");
    }
  }, [token, allowed, page, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!token) return;
    setErr(null);
    if (!form.user_id.trim() || !form.period_start || !form.period_end) {
      setErr("User id and period dates are required");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        user_id: Number(form.user_id),
        period_start: form.period_start,
        period_end: form.period_end,
        base_salary: Number(form.base_salary) || 0,
        commission_amount: Number(form.commission_amount) || 0,
        bonus_amount: Number(form.bonus_amount) || 0,
        deductions_amount: Number(form.deductions_amount) || 0,
        currency: form.currency.trim().toUpperCase() || "USD",
        notes: form.notes.trim() || null,
      };
      if (form.hours_worked.trim()) body.hours_worked = Number(form.hours_worked);
      if (form.hourly_rate.trim()) body.hourly_rate = Number(form.hourly_rate);
      await apiFetchJson(`/payroll`, { method: "POST", token, body });
      setForm({
        user_id: "",
        period_start: "",
        period_end: "",
        base_salary: "0",
        hours_worked: "",
        hourly_rate: "",
        commission_amount: "0",
        bonus_amount: "0",
        deductions_amount: "0",
        currency: "USD",
        notes: "",
      });
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPayslip(id: number) {
    if (!token) return;
    setErr(null);
    try {
      await apiDownloadFile(`/payroll/${id}/payslip`, `payslip-${id}.pdf`, { token });
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Payslip download failed");
    }
  }

  async function exportBankBatch() {
    if (!token) return;
    setErr(null);
    const q = new URLSearchParams();
    q.set("status", statusFilter || "finalized");
    const stamp = new Date().toISOString().slice(0, 10);
    try {
      await apiDownloadFile(
        `/payroll/bank-batch?${q.toString()}`,
        `payroll-batch-${stamp}.csv`,
        { token }
      );
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Bank batch export failed");
    }
  }

  async function changeStatus(id: number, status: Status) {
    if (!token) return;
    if (!window.confirm(`Move record to "${status}"?`)) return;
    setBusy(true);
    try {
      await apiFetchJson(`/payroll/${id}/status`, {
        method: "PATCH",
        token,
        body: { status },
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Status update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Payroll</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        subtitle={
          meta
            ? `${meta.total} payroll record${meta.total === 1 ? "" : "s"}`
            : "Per-employee pay periods. Gross & net auto-computed server-side."
        }
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">Add payroll record</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="User id" htmlFor="pr-user" required>
            <Input
              id="pr-user"
              type="number"
              min={1}
              value={form.user_id}
              onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}
            />
          </FormField>
          <FormField label="Period starts" htmlFor="pr-start" required>
            <Input
              id="pr-start"
              type="date"
              value={form.period_start}
              onChange={(e) => setForm((p) => ({ ...p, period_start: e.target.value }))}
            />
          </FormField>
          <FormField label="Period ends" htmlFor="pr-end" required>
            <Input
              id="pr-end"
              type="date"
              value={form.period_end}
              onChange={(e) => setForm((p) => ({ ...p, period_end: e.target.value }))}
            />
          </FormField>
          <FormField label="Base salary" htmlFor="pr-base">
            <Input
              id="pr-base"
              type="number"
              step="0.01"
              min="0"
              value={form.base_salary}
              onChange={(e) => setForm((p) => ({ ...p, base_salary: e.target.value }))}
            />
          </FormField>
          <FormField label="Hours worked" htmlFor="pr-hours">
            <Input
              id="pr-hours"
              type="number"
              step="0.01"
              min="0"
              value={form.hours_worked}
              onChange={(e) => setForm((p) => ({ ...p, hours_worked: e.target.value }))}
            />
          </FormField>
          <FormField label="Hourly rate" htmlFor="pr-rate">
            <Input
              id="pr-rate"
              type="number"
              step="0.01"
              min="0"
              value={form.hourly_rate}
              onChange={(e) => setForm((p) => ({ ...p, hourly_rate: e.target.value }))}
            />
          </FormField>
          <FormField label="Commission" htmlFor="pr-comm">
            <Input
              id="pr-comm"
              type="number"
              step="0.01"
              min="0"
              value={form.commission_amount}
              onChange={(e) => setForm((p) => ({ ...p, commission_amount: e.target.value }))}
            />
          </FormField>
          <FormField label="Bonus" htmlFor="pr-bonus">
            <Input
              id="pr-bonus"
              type="number"
              step="0.01"
              min="0"
              value={form.bonus_amount}
              onChange={(e) => setForm((p) => ({ ...p, bonus_amount: e.target.value }))}
            />
          </FormField>
          <FormField label="Deductions" htmlFor="pr-ded">
            <Input
              id="pr-ded"
              type="number"
              step="0.01"
              min="0"
              value={form.deductions_amount}
              onChange={(e) => setForm((p) => ({ ...p, deductions_amount: e.target.value }))}
            />
          </FormField>
          <FormField label="Currency" htmlFor="pr-curr">
            <Input
              id="pr-curr"
              maxLength={3}
              className="uppercase"
              value={form.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
            />
          </FormField>
          <FormField label="Notes" htmlFor="pr-notes" className="sm:col-span-2 lg:col-span-3">
            <Input
              as="textarea"
              id="pr-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </FormField>
        </div>
        <p className="text-xs text-fg-t6">
          Gross = base + (hourly × hours) + commission + bonus. Net = gross − deductions. Both auto-computed
          server-side on insert.
        </p>
        <div>
          <Button size="sm" disabled={busy} onClick={() => void handleCreate()}>
            {busy ? "Saving…" : "Create payroll record"}
          </Button>
        </div>
      </section>

      <div className="admin-card p-4 flex items-center justify-between gap-3 flex-wrap">
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
        <Button size="sm" variant="outline" onClick={() => void exportBankBatch()}>
          Export bank batch (CSV)
        </Button>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>#</TH>
            <TH>Employee</TH>
            <TH>Period</TH>
            <TH>Gross</TH>
            <TH>Deductions</TH>
            <TH>Net</TH>
            <TH>Status</TH>
            <TH align="right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={8}>No payroll records yet.</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums text-fg-t7">{r.id}</TD>
              <TD>
                <div className="font-medium text-fg-t8">{r.user?.name ?? "—"}</div>
                <div className="text-xs text-fg-t6">{r.user?.email ?? ""}</div>
              </TD>
              <TD className="text-xs">
                {formatDate(r.period_start)} → {formatDate(r.period_end)}
              </TD>
              <TD className="tabular-nums">
                {r.currency} {r.gross_pay.toFixed(2)}
              </TD>
              <TD className="tabular-nums text-fg-t6">
                {r.currency} {r.deductions_amount.toFixed(2)}
              </TD>
              <TD className="tabular-nums font-medium text-fg-t8">
                {r.currency} {r.net_pay.toFixed(2)}
              </TD>
              <TD>
                <StatusPill status={statusTier(r.status)}>{r.status}</StatusPill>
              </TD>
              <TD align="right">
                <div className="flex justify-end gap-2 flex-wrap">
                  <Button size="sm" variant="ghost" onClick={() => void downloadPayslip(r.id)}>
                    Payslip
                  </Button>
                  {r.status === "draft" && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void changeStatus(r.id, "finalized")}>
                      Finalize
                    </Button>
                  )}
                  {r.status === "finalized" && (
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => void changeStatus(r.id, "paid")}>
                      Mark paid
                    </Button>
                  )}
                  {r.status === "paid" && (
                    <span className="text-xs text-success-700">Paid {formatDate(r.paid_at)}</span>
                  )}
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
