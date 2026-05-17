"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
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
import {
  Button,
  FormField,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";

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

  useEffect(() => { load(); }, [load]);

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

  if (!allowed || forbidden) return <ForbiddenNotice />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.pending_review.title")} subtitle={t("admin.pending_review.subtitle")} />

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={t("admin.pending_review.filter_type")} htmlFor="pr-type" className="min-w-[160px]">
            <Select
              id="pr-type"
              fieldSize="sm"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            >
              {TYPE_FILTERS.map((tf) => (
                <option key={tf} value={tf}>
                  {tf ? t(`admin.module_type.${tf}`) : t("admin.pending_review.filter_all_types")}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("admin.pending_review.filter_search_title")} htmlFor="pr-q" className="flex-1 min-w-[240px]">
            <Input
              id="pr-q"
              type="text"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { setSearch(searchDraft.trim()); setPage(1); }
              }}
              placeholder={t("admin.pending_review.placeholder_title")}
            />
          </FormField>
          <Button size="sm" onClick={() => { setSearch(searchDraft.trim()); setPage(1); }}>
            {t("admin.pending_review.btn_search")}
          </Button>
        </div>
      </div>

      {err && <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}

      <Table>
        <THead>
          <TR>
            <TH>{t("admin.pending_review.col_id")}</TH>
            <TH>{t("admin.pending_review.col_type")}</TH>
            <TH>{t("admin.pending_review.col_title")}</TH>
            <TH>{t("admin.pending_review.col_operator")}</TH>
            <TH>{t("admin.pending_review.col_country")}</TH>
            <TH>{t("admin.pending_review.col_submitted")}</TH>
            <TH align="right">{t("admin.pending_review.col_actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={7}>{t("admin.pending_review.empty")}</TEmpty> : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums">#{r.id}</TD>
              <TD className="capitalize">{r.type}</TD>
              <TD className="font-medium text-fg-t8">{r.title}</TD>
              <TD>{r.company?.name ?? "—"}</TD>
              <TD>{r.company?.country ?? "—"}</TD>
              <TD className="text-xs text-fg-t6">
                {r.submitted_for_review_at ? new Date(r.submitted_for_review_at).toLocaleString() : "—"}
              </TD>
              <TD align="right">
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
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}

      <Modal
        isOpen={rejectModalOffer !== null}
        onClose={closeRejectModal}
        title={t("admin.pending_review.modal_title")}
        description={rejectModalOffer ? `#${rejectModalOffer.id} — ${rejectModalOffer.title}` : undefined}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={closeRejectModal}>{t("common.cancel")}</Button>
            <Button
              variant="danger"
              size="sm"
              disabled={(rejectModalOffer && busyId === rejectModalOffer.id) || rejectReason.trim().length < 3}
              onClick={() => void submitReject()}
            >
              {t("admin.pending_review.modal_submit_reject")}
            </Button>
          </>
        }
      >
        <FormField
          label={
            <>
              {t("admin.pending_review.modal_reason")} <span className="text-error-500">*</span>
            </>
          }
          htmlFor="reject-reason"
        >
          <Input
            id="reject-reason"
            as="textarea"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            placeholder={t("admin.pending_review.modal_reason_placeholder")}
          />
        </FormField>
      </Modal>
    </div>
  );
}
