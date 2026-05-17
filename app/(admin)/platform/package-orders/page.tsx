"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiPlatformPackageOrders, type PlatformPackageOrderRow } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
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
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.package_orders.title_short")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.package_orders.title")} />

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={t("admin.approvals.filter_status")} htmlFor="po-status" className="flex-1 min-w-[180px]">
            <Input
              id="po-status"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
              placeholder={t("admin.package_orders.placeholder_status")}
            />
          </FormField>
          <FormField label={t("admin.package_orders.filter_payment_status")} htmlFor="po-pay" className="flex-1 min-w-[180px]">
            <Input
              id="po-pay"
              value={paymentStatusFilter}
              onChange={(e) => {
                setPage(1);
                setPaymentStatusFilter(e.target.value);
              }}
              placeholder={t("admin.package_orders.placeholder_payment_status")}
            />
          </FormField>
          <FormField label={t("admin.inventory_hotels.filter_company_id")} htmlFor="po-co" className="min-w-[140px]">
            <Input
              id="po-co"
              value={companyIdDraft}
              onChange={(e) => setCompanyIdDraft(e.target.value)}
              placeholder={t("admin.package_orders.placeholder_optional")}
              className="tabular-nums"
            />
          </FormField>
          <Button variant="outline" size="sm" onClick={applyCompanyFilter}>
            {t("admin.package_orders.btn_apply_company")}
          </Button>
        </div>
      </div>

      {err ? (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      ) : null}

      <Table>
        <THead>
          <TR>
            <TH>{t("admin.invoices.col_id")}</TH>
            <TH>{t("admin.package_orders.col_order_number")}</TH>
            <TH>{t("admin.invoices.col_status")}</TH>
            <TH>{t("admin.package_orders.col_payment")}</TH>
            <TH>{t("admin.package_orders.col_total")}</TH>
            <TH>{t("admin.package_orders.col_package")}</TH>
            <TH>{t("admin.invoices.col_company")}</TH>
            <TH>{t("admin.package_orders.col_buyer")}</TH>
            <TH>{t("admin.approvals.col_created")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={9}>{t("admin.package_orders.empty") || "No package orders."}</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums">{r.id}</TD>
              <TD className="font-mono text-xs">{r.order_number}</TD>
              <TD>
                <StatusPill status={r.status} />
              </TD>
              <TD>
                <StatusPill status={r.payment_status} />
              </TD>
              <TD className="tabular-nums">
                {r.final_total_snapshot} {r.currency}
              </TD>
              <TD className="text-xs">
                {r.package ? `${r.package.package_title} (#${r.package.id})` : `#${r.package_id}`}
              </TD>
              <TD className="text-xs">{r.company ? r.company.name : `— (${r.company_id})`}</TD>
              <TD className="text-xs">{r.user ? r.user.name : `— (${r.user_id})`}</TD>
              <TD className="text-xs text-fg-t6">{r.created_at ?? "—"}</TD>
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
