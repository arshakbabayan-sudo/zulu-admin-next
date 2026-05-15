"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { StatusPill } from "@/components/ui/StatusPill";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiPlatformPayments, type PlatformPaymentRow } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

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

  if (!allowed) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.payments.title_short")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.payments.title_short")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.payments.title")}</h1>
      <div className="mt-4">
        <label className="text-sm text-fg-t6">
          {t("admin.approvals.filter_status")}
          <input
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            placeholder={t("admin.payments.placeholder_status")}
            className="ml-2 rounded border border-default px-2 py-1 text-sm"
          />
        </label>
      </div>
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.invoices.col_id")}</th>
              <th className="px-3 py-2">{t("admin.invoices.col_amount")}</th>
              <th className="px-3 py-2">{t("admin.payments.col_currency")}</th>
              <th className="px-3 py-2">{t("admin.invoices.col_status")}</th>
              <th className="px-3 py-2">{t("admin.payments.col_method")}</th>
              <th className="px-3 py-2">{t("admin.payments.col_paid_at")}</th>
              <th className="px-3 py-2">{t("admin.payments.col_invoice")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2 tabular-nums">{r.amount}</td>
                <td className="px-3 py-2">{r.currency}</td>
                <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                <td className="px-3 py-2">{r.payment_method ?? "-"}</td>
                <td className="px-3 py-2 text-xs text-fg-t6">{r.paid_at ?? "-"}</td>
                <td className="px-3 py-2 text-xs">
                  {r.invoice
                    ? `#${r.invoice.id} ${r.invoice.unique_booking_reference ?? ""}`
                    : r.invoice_id ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
