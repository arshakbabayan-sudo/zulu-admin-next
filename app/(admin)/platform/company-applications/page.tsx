"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { StatusPill } from "@/components/ui/StatusPill";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiCompanyApplications, type CompanyApplicationRow } from "@/lib/platform-admin-api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  FilterCard,
  FilterField,
  V2Card,
} from "@/components/ui/v2";

export default function CompanyApplicationsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<CompanyApplicationRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiCompanyApplications(token, {
        page,
        status: statusFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.company_applications.err_load"));
    }
  }, [token, allowed, page, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.company_applications.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Marketplace ops Company applications page chrome. */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.company_applications.title") },
        ]}
        title={t("admin.company_applications.title")}
      />

      <SectionTabs
        activeHref="/platform/companies"
        items={[
          { href: "/platform/approvals", label: "Approval queue" },
          { href: "/platform/companies", label: "Companies access", count: meta?.total },
          { href: "/platform/seller-applications", label: "Seller applications" },
          { href: "/platform/contracts", label: "Partnership agreements" },
          { href: "/platform/contract-templates", label: "Contract templates" },
          { href: "/platform/users", label: "Users" },
          { href: "/platform/audit-logs", label: "Audit logs" },
          { href: "/bucket3/service-logs", label: "Service logs" },
          { href: "/bucket3/unverified-accounts", label: "Unverified accounts" },
        ]}
      />

      <FilterCard>
        <FilterField label={t("admin.approvals.filter_status")}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-2 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">{t("common.all")}</option>
            <option value="pending">{t("admin.approvals.status_pending")}</option>
            <option value="under_review">{t("admin.approvals.status_under_review")}</option>
            <option value="approved">{t("admin.approvals.status_approved")}</option>
            <option value="rejected">{t("admin.approvals.status_rejected")}</option>
          </select>
        </FilterField>
      </FilterCard>
      {err && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}
      <V2Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th scope="col" className="px-3 py-2">{t("admin.company_applications.col_id")}</th>
              <th scope="col" className="px-3 py-2">{t("admin.company_applications.col_company")}</th>
              <th scope="col" className="px-3 py-2">Role</th>
              <th scope="col" className="px-3 py-2">{t("admin.company_applications.col_email")}</th>
              <th scope="col" className="px-3 py-2">{t("admin.company_applications.col_status")}</th>
              <th scope="col" className="px-3 py-2">{t("admin.company_applications.col_submitted")}</th>
              <th scope="col" className="px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              // Prefer the intended_role set at /register (Phase-8 onwards);
              // fall back to the application's own company_type when the
              // pre-registration user link isn't present.
              const role = r.user?.intended_role ?? r.company_type ?? null;
              const roleLabel = role === "agent" ? "Tour agent" : role === "operator" ? "Tour operator" : "—";
              const roleClass =
                role === "agent"
                  ? "bg-primary-50 text-primary-700 border-primary-200"
                  : role === "operator"
                  ? "bg-success-50 text-success-700 border-success-200"
                  : "bg-figma-bg-1 text-fg-t6 border-default";
              return (
                <tr key={r.id} className="border-b border-default">
                  <td className="px-3 py-2 tabular-nums">{r.id}</td>
                  <td className="px-3 py-2">{r.company_name}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleClass}`}>
                      {roleLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.business_email}</td>
                  <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                  <td className="px-3 py-2 text-xs text-fg-t6">{r.submitted_at ?? "-"}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/platform/company-applications/${r.id}`}
                      className="text-xs text-info-700 underline"
                    >
                      {t("admin.company_applications.btn_open")}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </V2Card>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
