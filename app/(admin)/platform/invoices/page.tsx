"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiInvoices, apiIssueInvoice, apiCancelInvoice, downloadInvoicesCsv, type InvoiceRow } from "@/lib/invoices-api";
import { formatDate } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  FormField,
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

const STATUSES = ["", "draft", "issued", "paid", "cancelled", "overdue"];

export default function PlatformInvoicesPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  // Phase 7.6 — date range filters (ISO YYYY-MM-DD)
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiInvoices(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.invoices.err_load"));
    }
  }, [token, allowed, page, statusFilter, fromDate, toDate, t]);

  // Phase 7.6 — CSV export with same filters
  async function handleExport() {
    if (!token) return;
    setExporting(true);
    try {
      await downloadInvoicesCsv(token, {
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : t("admin.invoices.err_export"));
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => { load(); }, [load]);

  async function handleIssue(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.invoices.confirm_issue" });
    if (!ok) return;
    setBusyId(id);
    try { await apiIssueInvoice(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : t("admin.invoices.err_generic")); }
    finally { setBusyId(null); }
  }

  async function handleCancel(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.invoices.confirm_cancel", variant: "danger" });
    if (!ok) return;
    setBusyId(id);
    try { await apiCancelInvoice(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : t("admin.invoices.err_generic")); }
    finally { setBusyId(null); }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.invoices.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.invoices.title")}
        actions={
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="inline-flex h-10 items-center rounded-zulu border border-default bg-white px-4 text-sm font-semibold text-fg-t8 transition hover:bg-figma-bg-1 disabled:opacity-40"
          >
            {exporting ? t("admin.invoices.exporting") : t("admin.invoices.btn_export_csv")}
          </button>
        }
      />

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={t("admin.approvals.filter_status")} htmlFor="inv-status" className="max-w-xs">
            <Select
              id="inv-status"
              fieldSize="sm"
              value={statusFilter}
              onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s || t("common.all")}</option>)}
            </Select>
          </FormField>
          {/* Phase 7.6 — date range pickers */}
          <FormField label={t("admin.invoices.filter_from")} htmlFor="inv-from" className="max-w-xs">
            <input
              id="inv-from"
              type="date"
              value={fromDate}
              onChange={(e) => { setPage(1); setFromDate(e.target.value); }}
              className="h-9 rounded-zulu border border-default px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </FormField>
          <FormField label={t("admin.invoices.filter_to")} htmlFor="inv-to" className="max-w-xs">
            <input
              id="inv-to"
              type="date"
              value={toDate}
              onChange={(e) => { setPage(1); setToDate(e.target.value); }}
              className="h-9 rounded-zulu border border-default px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </FormField>
          {(statusFilter || fromDate || toDate) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPage(1);
                setStatusFilter("");
                setFromDate("");
                setToDate("");
              }}
            >
              {t("admin.invoices.btn_clear_filters")}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load}>{t("admin.finance_summary.btn_refresh")}</Button>
        </div>
      </div>

      {err && <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}

      <Table>
        <THead>
          <TR>
            <TH>{t("admin.invoices.col_id")}</TH>
            <TH>{t("admin.invoices.col_invoice_number")}</TH>
            <TH>{t("admin.invoices.col_status")}</TH>
            <TH>{t("admin.invoices.col_amount")}</TH>
            <TH>{t("admin.invoices.col_company")}</TH>
            <TH>{t("admin.invoices.col_issued")}</TH>
            <TH>{t("admin.invoices.col_due")}</TH>
            <TH>{t("admin.invoices.col_actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={8}>{t("admin.invoices.empty")}</TEmpty> : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums">{r.id}</TD>
              <TD className="font-mono text-xs">{r.invoice_number ?? "—"}</TD>
              <TD><StatusPill status={r.status} /></TD>
              <TD className="tabular-nums font-medium">
                {r.currency} {Number(r.total_amount).toFixed(2)}
              </TD>
              <TD>{r.company?.name ?? "—"}</TD>
              <TD className="text-xs text-fg-t6">
                {formatDate(r.issued_at, lang)}
              </TD>
              <TD className="text-xs text-fg-t6">
                {formatDate(r.due_date, lang)}
              </TD>
              <TD>
                <div className="flex flex-col gap-1">
                  {r.status === "draft" && (
                    <button type="button" disabled={busyId === r.id} onClick={() => void handleIssue(r.id)}
                      className="text-left text-xs text-info-700 underline disabled:opacity-40 hover:text-info-800">
                      {t("admin.invoices.btn_issue")}
                    </button>
                  )}
                  {(r.status === "draft" || r.status === "issued") && (
                    <button type="button" disabled={busyId === r.id} onClick={() => void handleCancel(r.id)}
                      className="text-left text-xs text-error-600 underline disabled:opacity-40 hover:text-error-800">
                      {t("common.cancel")}
                    </button>
                  )}
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
    </div>
  );
}
