"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { StatusPill } from "@/components/ui/StatusPill";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiPlatformPackageOrders,
  type PlatformPackageOrderRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

export default function PlatformPackageOrdersPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformPackageOrderRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [companyIdDraft, setCompanyIdDraft] = useState("");
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformPackageOrders(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        payment_status: paymentStatusFilter || undefined,
        company_id: companyId,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.package_orders.err_load"));
    }
  }, [token, allowed, page, statusFilter, paymentStatusFilter, companyId, t]);

  useEffect(() => {
    load();
  }, [load]);

  function applyCompanyFilter() {
    const raw = companyIdDraft.trim();
    if (!raw) {
      setCompanyId(undefined);
      setPage(1);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setErr(t("admin.package_orders.err_invalid_company"));
      return;
    }
    setErr(null);
    setCompanyId(n);
    setPage(1);
  }

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.package_orders.title_short")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.package_orders.title")}</h1>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-fg-t6">
          {t("admin.approvals.filter_status")}
          <input
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            placeholder={t("admin.package_orders.placeholder_status")}
            className="ml-2 rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-fg-t6">
          {t("admin.package_orders.filter_payment_status")}
          <input
            value={paymentStatusFilter}
            onChange={(e) => {
              setPage(1);
              setPaymentStatusFilter(e.target.value);
            }}
            placeholder={t("admin.package_orders.placeholder_payment_status")}
            className="ml-2 rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-fg-t6">
          {t("admin.inventory_hotels.filter_company_id")}
          <input
            value={companyIdDraft}
            onChange={(e) => setCompanyIdDraft(e.target.value)}
            placeholder={t("admin.package_orders.placeholder_optional")}
            className="ml-2 w-24 rounded border border-default px-2 py-1 text-sm tabular-nums"
          />
        </label>
        <button
          type="button"
          onClick={applyCompanyFilter}
          className="rounded border border-default bg-white px-3 py-1 text-sm hover:bg-figma-bg-1"
        >
          {t("admin.package_orders.btn_apply_company")}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.invoices.col_id")}</th>
              <th className="px-3 py-2">{t("admin.package_orders.col_order_number")}</th>
              <th className="px-3 py-2">{t("admin.invoices.col_status")}</th>
              <th className="px-3 py-2">{t("admin.package_orders.col_payment")}</th>
              <th className="px-3 py-2">{t("admin.package_orders.col_total")}</th>
              <th className="px-3 py-2">{t("admin.package_orders.col_package")}</th>
              <th className="px-3 py-2">{t("admin.invoices.col_company")}</th>
              <th className="px-3 py-2">{t("admin.package_orders.col_buyer")}</th>
              <th className="px-3 py-2">{t("admin.approvals.col_created")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.order_number}</td>
                <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                <td className="px-3 py-2"><StatusPill status={r.payment_status} /></td>
                <td className="px-3 py-2 tabular-nums">
                  {r.final_total_snapshot} {r.currency}
                </td>
                <td className="px-3 py-2 text-xs text-fg-t7">
                  {r.package
                    ? `${r.package.package_title} (#${r.package.id})`
                    : `#${r.package_id}`}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.company ? r.company.name : `- (${r.company_id})`}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.user ? `${r.user.name}` : `- (${r.user_id})`}
                </td>
                <td className="px-3 py-2 text-xs text-fg-t6">{r.created_at ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
