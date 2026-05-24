"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrompt } from "@/contexts/PromptDialogContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiApproveSellerApplication,
  apiRejectSellerApplication,
  apiSellerApplications,
  type SellerApplicationRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";
import {

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
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  FilterCard,
  FilterField,
  V2Card,
} from "@/components/ui/v2";

export default function SellerApplicationsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const prompt = usePrompt();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<SellerApplicationRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiSellerApplications(token, {
        page,
        per_page: 20,
        status: statusFilter === "" ? undefined : statusFilter,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.seller_applications.err_load"));
    }
  }, [token, allowed, page, statusFilter, t]);

  useEffect(() => { load(); }, [load]);

  async function approve(id: number) {
    if (!token) return;
    const notes = window.prompt(t("admin.seller_applications.prompt_optional_notes")) ?? "";
    setBusyId(id);
    try {
      await apiApproveSellerApplication(token, id, notes || undefined);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.seller_applications.err_approve"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    if (!token) return;
    // Phase 8.6 — reason is now OPTIONAL via the ZULU PromptModal (the
    // legacy window.prompt + alert+abort flow forced a reason; the user
    // wanted the ability to reject without a reason for low-info cases).
    const rejection_reason = await prompt({
      title: t("admin.seller_applications.prompt_rejection_reason"),
      description: t("admin.seller_applications.reject_reason_optional_hint"),
      placeholder: t("admin.seller_applications.reject_reason_placeholder"),
      variant: "danger",
      confirmLabel: t("admin.seller_applications.btn_reject"),
    });
    if (rejection_reason === null) return; // user cancelled
    setBusyId(id);
    try {
      await apiRejectSellerApplication(token, id, rejection_reason.trim() || "");
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.seller_applications.err_reject"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.seller_applications.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Seller applications page chrome (Marketplace ops). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.seller_applications.title") },
        ]}
        title={t("admin.seller_applications.title")}
      />

      <SectionTabs
        activeHref="/platform/seller-applications"
        items={[
          { href: "/platform/approvals", label: "Approval queue" },
          { href: "/platform/companies", label: "Companies access" },
          { href: "/platform/seller-applications", label: "Seller applications", count: meta?.total },
          { href: "/platform/contracts", label: "Partnership agreements" },
          { href: "/platform/contract-templates", label: "Contract templates" },
          { href: "/platform/audit-logs", label: "Audit logs" },
          { href: "/bucket3/service-logs", label: "Service logs" },
          { href: "/bucket3/unverified-accounts", label: "Unverified accounts" },
        ]}
      />

      <FilterCard>
        <FilterField label={t("admin.seller_applications.filter_status")} minWidth={220}>
          <Select
            id="sa-status"
            fieldSize="sm"
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="!h-[34px]"
          >
            <option value="">{t("admin.seller_applications.filter_default_queue")}</option>
            <option value="pending">{t("admin.seller_applications.status_pending")}</option>
            <option value="under_review">{t("admin.seller_applications.status_under_review")}</option>
            <option value="approved">{t("admin.seller_applications.status_approved")}</option>
            <option value="rejected">{t("admin.seller_applications.status_rejected")}</option>
          </Select>
        </FilterField>
      </FilterCard>

      {err && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.seller_applications.col_id")}</TH>
            <TH>{t("admin.seller_applications.col_company")}</TH>
            <TH>{t("admin.seller_applications.col_service")}</TH>
            <TH>{t("admin.seller_applications.col_status")}</TH>
            <TH>{t("admin.seller_applications.col_applied")}</TH>
            <TH>{t("admin.seller_applications.col_actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={6}>{t("admin.seller_applications.empty") || "No applications."}</TEmpty> : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums">{r.id}</TD>
              <TD>{r.company_name ?? r.company_id}</TD>
              <TD>{r.service_type}</TD>
              <TD><StatusPill status={r.status} /></TD>
              <TD className="text-xs text-fg-t6">{r.applied_at ?? "—"}</TD>
              <TD className="space-x-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => approve(r.id)}
                  className="text-xs text-success-700 underline disabled:opacity-40 hover:text-success-800"
                >
                  {t("admin.seller_applications.btn_approve")}
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => reject(r.id)}
                  className="text-xs text-error-700 underline disabled:opacity-40 hover:text-error-800"
                >
                  {t("admin.seller_applications.btn_reject")}
                </button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      </V2Card>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
    </div>
  );
}
