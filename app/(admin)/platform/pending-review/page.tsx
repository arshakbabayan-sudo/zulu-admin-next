"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiApproveOffer,
  apiPendingReviewOffers,
  apiRejectOffer,
  type PendingReviewOfferRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

const TYPE_FILTERS = ["", "hotel", "car", "transfer", "excursion", "flight", "package", "visa"] as const;

export default function PendingReviewPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<PendingReviewOfferRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [rejectModalOffer, setRejectModalOffer] = useState<PendingReviewOfferRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPendingReviewOffers(token, {
        page,
        per_page: 20,
        type: typeFilter || undefined,
        q: search || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.pending_review.err_load"));
    }
  }, [token, allowed, page, typeFilter, search, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(row: PendingReviewOfferRow) {
    if (!token) return;
    setBusyId(row.id);
    try {
      await apiApproveOffer(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.pending_review.err_approve"));
    } finally {
      setBusyId(null);
    }
  }

  function openRejectModal(row: PendingReviewOfferRow) {
    setRejectModalOffer(row);
    setRejectReason("");
  }

  function closeRejectModal() {
    setRejectModalOffer(null);
    setRejectReason("");
  }

  async function submitReject() {
    if (!token || !rejectModalOffer) return;
    if (rejectReason.trim().length < 3) {
      alert(t("admin.pending_review.err_reject_min"));
      return;
    }
    setBusyId(rejectModalOffer.id);
    try {
      await apiRejectOffer(token, rejectModalOffer.id, rejectReason.trim());
      closeRejectModal();
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.pending_review.err_reject"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) return <ForbiddenNotice />;
  if (forbidden) return <ForbiddenNotice />;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fg-t8">{t("admin.pending_review.title")}</h1>
          <p className="mt-1 text-sm text-fg-t6">{t("admin.pending_review.subtitle")}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-zulu border border-default bg-white p-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-fg-t6">{t("admin.pending_review.filter_type")}</span>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded border border-default px-2 py-1.5 text-sm"
          >
            {TYPE_FILTERS.map((tf) => (
              <option key={tf} value={tf}>
                {tf ? t(`admin.module_type.${tf}`) : t("admin.pending_review.filter_all_types")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 min-w-[240px] flex-col gap-1 text-xs">
          <span className="font-medium text-fg-t6">{t("admin.pending_review.filter_search_title")}</span>
          <input
            type="text"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearch(searchDraft.trim());
                setPage(1);
              }
            }}
            placeholder={t("admin.pending_review.placeholder_title")}
            className="rounded border border-default px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setSearch(searchDraft.trim());
            setPage(1);
          }}
          className="rounded-zulu bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          {t("admin.pending_review.btn_search")}
        </button>
      </div>

      {err && (
        <div className="mb-3 rounded-zulu border border-error-100 bg-error-50 px-3 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <div className="overflow-x-auto rounded-zulu border border-default bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase tracking-wide text-fg-t6">
            <tr>
              <th className="px-3 py-2 text-left">{t("admin.pending_review.col_id")}</th>
              <th className="px-3 py-2 text-left">{t("admin.pending_review.col_type")}</th>
              <th className="px-3 py-2 text-left">{t("admin.pending_review.col_title")}</th>
              <th className="px-3 py-2 text-left">{t("admin.pending_review.col_operator")}</th>
              <th className="px-3 py-2 text-left">{t("admin.pending_review.col_country")}</th>
              <th className="px-3 py-2 text-left">{t("admin.pending_review.col_submitted")}</th>
              <th className="px-3 py-2 text-right">{t("admin.pending_review.col_actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-fg-t6">
                  {t("admin.pending_review.empty")}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default last:border-b-0">
                <td className="px-3 py-2 tabular-nums text-fg-t7">#{r.id}</td>
                <td className="px-3 py-2 text-fg-t7 capitalize">{r.type}</td>
                <td className="px-3 py-2 font-medium text-fg-t8">{r.title}</td>
                <td className="px-3 py-2 text-fg-t7">{r.company?.name ?? "—"}</td>
                <td className="px-3 py-2 text-fg-t7">{r.company?.country ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-fg-t6">
                  {r.submitted_for_review_at
                    ? new Date(r.submitted_for_review_at).toLocaleString()
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void handleApprove(r)}
                      className="rounded-zulu bg-success-500 px-3 py-1 text-xs font-medium text-white hover:bg-success-600 disabled:opacity-40"
                    >
                      {t("admin.pending_review.btn_approve")}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => openRejectModal(r)}
                      className="rounded-zulu border border-error-200 bg-white px-3 py-1 text-xs font-medium text-error-600 hover:bg-error-50 disabled:opacity-40"
                    >
                      {t("admin.pending_review.btn_reject")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.last_page > 1 && (
        <div className="mt-4">
          <PaginationBar meta={meta} onPage={setPage} />
        </div>
      )}

      {/* Reject modal */}
      {rejectModalOffer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeRejectModal();
          }}
        >
          <div className="w-full max-w-lg rounded-zulu-modal bg-white shadow-zulu-modal">
            <div className="border-b border-default p-5">
              <h2 className="text-base font-semibold text-fg-t8">{t("admin.pending_review.modal_title")}</h2>
              <p className="mt-1 text-xs text-fg-t6">
                #{rejectModalOffer.id} — {rejectModalOffer.title}
              </p>
            </div>
            <div className="p-5">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-fg-t7">
                  {t("admin.pending_review.modal_reason")} <span className="text-error-500">*</span>
                </span>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  placeholder={t("admin.pending_review.modal_reason_placeholder")}
                  className="rounded border border-default px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-default bg-figma-bg-1 p-4">
              <button
                type="button"
                onClick={closeRejectModal}
                className="rounded-zulu border border-default bg-white px-4 py-2 text-sm font-medium text-fg-t7"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={busyId === rejectModalOffer.id || rejectReason.trim().length < 3}
                onClick={() => void submitReject()}
                className="rounded-zulu bg-error-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {t("admin.pending_review.modal_submit_reject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
