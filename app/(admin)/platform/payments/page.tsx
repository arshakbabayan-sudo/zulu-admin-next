"use client";

/**
 * Phase-2 migration to shared @/components/ui primitives.
 * Quest CRM ref: Invoices/Payments tab pattern (4803:12969).
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiPlatformPayments, type PlatformPaymentRow } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";
import {
  FormField,
  Input,
  PageHeader,
  Pagination,
  StatusPill,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";

export default function PlatformPaymentsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformPaymentRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
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
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.payments.err_load"));
    }
  }, [token, allowed, page, statusFilter, t]);

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
      <PageHeader title={t("admin.payments.title")} />

      <div className="admin-card p-4">
        <FormField label={t("admin.approvals.filter_status")} htmlFor="status-filter">
          <Input
            id="status-filter"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            placeholder={t("admin.payments.placeholder_status")}
          />
        </FormField>
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
                {r.invoice
                  ? `#${r.invoice.id} ${r.invoice.unique_booking_reference ?? ""}`
                  : r.invoice_id ?? "—"}
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
