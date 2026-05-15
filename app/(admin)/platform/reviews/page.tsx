"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiModerateReview, apiPlatformReviews, type PlatformReviewRow } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

const MOD_STATUSES = ["published", "hidden", "rejected"] as const;

export default function PlatformReviewsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformReviewRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformReviews(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.reviews.err_load"));
    }
  }, [token, allowed, page, statusFilter, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function moderate(id: number, status: (typeof MOD_STATUSES)[number]) {
    if (!token) return;
    const notes = window.prompt(t("admin.reviews.prompt_notes")) ?? "";
    setBusyId(id);
    try {
      await apiModerateReview(token, id, {
        status,
        notes: notes.trim() || null,
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.reviews.err_moderation"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.reviews.title_short")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.reviews.title")}</h1>
      <div className="mt-4">
        <label className="text-sm text-fg-t6">
          {t("admin.reviews.filter_status")}
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="ml-2 rounded border border-default px-2 py-1 text-sm"
          >
            <option value="">{t("common.all")}</option>
            <option value="pending">{t("admin.approvals.status_pending")}</option>
            <option value="published">{t("admin.reviews.status_published")}</option>
            <option value="hidden">{t("admin.reviews.status_hidden")}</option>
            <option value="rejected">{t("admin.approvals.status_rejected")}</option>
          </select>
        </label>
      </div>
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.invoices.col_id")}</th>
              <th className="px-3 py-2">{t("admin.reviews.col_rating")}</th>
              <th className="px-3 py-2">{t("admin.reviews.col_text")}</th>
              <th className="px-3 py-2">{t("admin.invoices.col_status")}</th>
              <th className="px-3 py-2">{t("admin.reviews.col_target")}</th>
              <th className="px-3 py-2">{t("admin.reviews.col_user")}</th>
              <th className="px-3 py-2">{t("admin.reviews.col_moderate")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default align-top">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2">{r.rating}</td>
                <td className="max-w-xs px-3 py-2 text-xs text-fg-t7">
                  {(r.review_text ?? "").slice(0, 200)}
                  {(r.review_text?.length ?? 0) > 200 ? "..." : ""}
                </td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-xs">
                  {r.target_entity_type} #{r.target_entity_id}
                </td>
                <td className="px-3 py-2 text-xs">{r.user?.name ?? "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    {MOD_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => moderate(r.id, s)}
                        className="text-left text-xs text-fg-t7 underline disabled:opacity-40"
                      >
                        {t("admin.reviews.btn_set").replace("{status}", s)}
                      </button>
                    ))}
                  </div>
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
