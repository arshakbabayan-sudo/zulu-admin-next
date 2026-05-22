"use client";

/**
 * Phase-2 migration to shared @/components/ui primitives.
 * Quest CRM ref: Invoices/Payments tab pattern (4803:12969).
 */

import Link from "next/link";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiPlatformPayments, downloadPaymentsCsv, type PlatformPaymentRow } from "@/lib/platform-admin-api";
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

const PAYMENT_STATUSES = ["", "pending", "processing", "paid", "failed", "refunded", "cancelled"];

export default function PlatformPaymentsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformPaymentRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  // Phase 7.7 — date range filters + CSV export
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformPayments(token, {
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
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.payments.err_load"));
    }
  }, [token, allowed, page, statusFilter, fromDate, toDate, t]);

  async function handleExport() {
    if (!token) return;
    setExporting(true);
    try {
      await downloadPaymentsCsv(token, {
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : t("admin.payments.err_export"));
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.payments.title_short")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.payments.title")}
        actions={
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="inline-flex h-10 items-center rounded-zulu border border-default bg-white px-4 text-sm font-semibold text-fg-t8 transition hover:bg-figma-bg-1 disabled:opacity-40"
          >
            {exporting ? t("admin.payments.exporting") : t("admin.payments.btn_export_csv")}
          </button>
        }
      />

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={t("admin.approvals.filter_status")} htmlFor="status-filter" className="max-w-xs">
            <Select
              id="status-filter"
              fieldSize="sm"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s || t("common.all")}</option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("admin.invoices.filter_from")} htmlFor="pay-from" className="max-w-xs">
            <input
              id="pay-from"
              type="date"
              value={fromDate}
              onChange={(e) => { setPage(1); setFromDate(e.target.value); }}
              className="h-9 rounded-zulu border border-default px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </FormField>
          <FormField label={t("admin.invoices.filter_to")} htmlFor="pay-to" className="max-w-xs">
            <input
              id="pay-to"
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
        </div>
      </div>

      {err ? (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      ) : null}

      <Table>
        <THead>
          <TR>
            <TH>{t("admin.invoices.col_id")}</TH>
            <TH>{t("admin.invoices.col_amount")}</TH>
            <TH>{t("admin.payments.col_currency")}</TH>
            <TH>{t("admin.invoices.col_status")}</TH>
            <TH>{t("admin.payments.col_method")}</TH>
            <TH>{t("admin.payments.col_paid_at")}</TH>
            <TH>{t("admin.payments.col_invoice")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={7}>{t("admin.payments.empty") || "No payments found."}</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums">{r.id}</TD>
              <TD className="tabular-nums">{r.amount}</TD>
              <TD>{r.currency}</TD>
              <TD>
                <StatusPill status={r.status} />
              </TD>
              <TD>{r.payment_method ?? "—"}</TD>
              <TD className="text-xs text-fg-t6">{r.paid_at ?? "—"}</TD>
              <TD className="text-xs">
                {r.invoice ? (
                  <Link
                    href={`/platform/invoices?focus=${r.invoice.id}`}
                    className="text-primary underline hover:opacity-80"
                  >
                    #{r.invoice.id}
                    {r.invoice.unique_booking_reference ? ` ${r.invoice.unique_booking_reference}` : ""}
                  </Link>
                ) : r.invoice_id ? (
                  <Link
                    href={`/platform/invoices?focus=${r.invoice_id}`}
                    className="text-primary underline hover:opacity-80"
                  >
                    #{r.invoice_id}
                  </Link>
                ) : (
                  "—"
                )}
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
