"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
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

export default function SellerApplicationsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<SellerApplicationRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  /** Empty = backend default (pending + under_review). Set to explicit status or "__all__" for no filter - backend needs status for all; we use common statuses */
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

  useEffect(() => {
    load();
  }, [load]);

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
    const rejection_reason = window.prompt(t("admin.seller_applications.prompt_rejection_reason")) ?? "";
    if (!rejection_reason.trim()) {
      alert(t("admin.seller_applications.err_reason_required"));
      return;
    }
    setBusyId(id);
    try {
      await apiRejectSellerApplication(token, id, rejection_reason.trim());
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.seller_applications.err_reject"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.seller_applications.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.seller_applications.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.seller_applications.title")}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-sm text-fg-t6">
          {t("admin.seller_applications.filter_status")}
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="ml-2 rounded border border-default px-2 py-1 text-sm"
          >
            <option value="">{t("admin.seller_applications.filter_default_queue")}</option>
            <option value="pending">{t("admin.seller_applications.status_pending")}</option>
            <option value="under_review">{t("admin.seller_applications.status_under_review")}</option>
            <option value="approved">{t("admin.seller_applications.status_approved")}</option>
            <option value="rejected">{t("admin.seller_applications.status_rejected")}</option>
          </select>
        </label>
      </div>
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.seller_applications.col_id")}</th>
              <th className="px-3 py-2">{t("admin.seller_applications.col_company")}</th>
              <th className="px-3 py-2">{t("admin.seller_applications.col_service")}</th>
              <th className="px-3 py-2">{t("admin.seller_applications.col_status")}</th>
              <th className="px-3 py-2">{t("admin.seller_applications.col_applied")}</th>
              <th className="px-3 py-2">{t("admin.seller_applications.col_actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2">{r.company_name ?? r.company_id}</td>
                <td className="px-3 py-2">{r.service_type}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-xs text-fg-t6">{r.applied_at ?? "-"}</td>
                <td className="space-x-2 px-3 py-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => approve(r.id)}
                    className="text-xs text-emerald-700 underline disabled:opacity-40"
                  >
                    {t("admin.seller_applications.btn_approve")}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => reject(r.id)}
                    className="text-xs text-error-700 underline disabled:opacity-40"
                  >
                    {t("admin.seller_applications.btn_reject")}
                  </button>
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
