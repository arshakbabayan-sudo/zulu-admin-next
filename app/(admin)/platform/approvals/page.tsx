"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiApproveGenericApproval,
  apiPlatformApprovals,
  apiRejectGenericApproval,
  type GenericApprovalRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

function canActOnApproval(status: string): boolean {
  return status === "pending" || status === "under_review";
}

export default function GenericApprovalsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<GenericApprovalRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [entityTypeDraft, setEntityTypeDraft] = useState("");
  const [entityType, setEntityType] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformApprovals(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        entity_type: entityType || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.approvals.err_load"));
    }
  }, [token, allowed, page, statusFilter, entityType, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: number) {
    if (!token) return;
    const decision_notes = window.prompt(t("admin.approvals.prompt_notes_approve")) ?? "";
    setBusyId(id);
    try {
      await apiApproveGenericApproval(token, id, decision_notes.trim() || undefined);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.approvals.err_approve"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    if (!token) return;
    const decision_notes = window.prompt(t("admin.approvals.prompt_notes_reject")) ?? "";
    setBusyId(id);
    try {
      await apiRejectGenericApproval(token, id, decision_notes.trim() || undefined);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.approvals.err_reject"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.approvals.title_short")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.approvals.title")}</h1>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-fg-t6">
          {t("admin.approvals.filter_status")}
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="ml-2 rounded border border-default px-2 py-1 text-sm"
          >
            <option value="">{t("admin.approvals.status_any")}</option>
            <option value="pending">{t("admin.approvals.status_pending")}</option>
            <option value="under_review">{t("admin.approvals.status_under_review")}</option>
            <option value="approved">{t("admin.approvals.status_approved")}</option>
            <option value="rejected">{t("admin.approvals.status_rejected")}</option>
          </select>
        </label>
        <label className="text-sm text-fg-t6">
          {t("admin.approvals.filter_entity_type")}
          <input
            value={entityTypeDraft}
            onChange={(e) => setEntityTypeDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setEntityType(entityTypeDraft.trim());
              }
            }}
            className="ml-2 rounded border border-default px-2 py-1 text-sm"
            placeholder={t("admin.approvals.placeholder_entity_type")}
          />
        </label>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setPage(1);
            setEntityType(entityTypeDraft.trim());
          }}
        >
          {t("admin.approvals.btn_apply_filter")}
        </Button>
      </div>
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.approvals.col_id")}</th>
              <th className="px-3 py-2">{t("admin.approvals.col_entity")}</th>
              <th className="px-3 py-2">{t("admin.approvals.col_status")}</th>
              <th className="px-3 py-2">{t("admin.approvals.col_priority")}</th>
              <th className="px-3 py-2">{t("admin.approvals.col_requested_by")}</th>
              <th className="px-3 py-2">{t("admin.approvals.col_created")}</th>
              <th className="px-3 py-2">{t("admin.approvals.col_actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2">
                  <span className="font-mono text-xs">{r.entity_type}</span> #{r.entity_id}
                </td>
                <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                <td className="px-3 py-2">{r.priority ?? "-"}</td>
                <td className="px-3 py-2 text-xs">
                  {r.requested_by ? (
                    <>
                      {r.requested_by.name}
                      <br />
                      <span className="text-fg-t7">{r.requested_by.email}</span>
                    </>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-fg-t6">{r.created_at ?? "-"}</td>
                <td className="space-x-2 px-3 py-2">
                  {canActOnApproval(r.status) ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => approve(r.id)}
                        className="text-xs text-emerald-700 underline disabled:opacity-40"
                      >
                        {t("admin.approvals.btn_approve")}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => reject(r.id)}
                        className="text-xs text-error-700 underline disabled:opacity-40"
                      >
                        {t("admin.approvals.btn_reject")}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-fg-t6">-</span>
                  )}
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
