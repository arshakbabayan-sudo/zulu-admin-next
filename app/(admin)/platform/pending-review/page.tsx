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
  apiBulkApproveOffers,
  apiPendingReviewOffers,
  apiRejectOffer,
  type PendingReviewOfferRow,
} from "@/lib/platform-admin-api";
import { formatDateTime } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  FormField,
  Input,
  Modal,

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
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
} from "@/components/ui/v2";

const TYPE_FILTERS = ["", "hotel", "car", "transfer", "excursion", "flight", "package", "visa"] as const;

export default function PendingReviewPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
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
  // Phase 7.5 — bulk approve selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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

  // Phase 7.5 — bulk approve selected pending offers
  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const allOnPage = rows.map((r) => r.id);
      const allSelected = allOnPage.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all on this page
        for (const id of allOnPage) next.delete(id);
      } else {
        for (const id of allOnPage) next.add(id);
      }
      return next;
    });
  }

  async function handleBulkApprove() {
    if (!token || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (!confirm(t("admin.pending_review.confirm_bulk_approve").replace("{count}", String(ids.length)))) {
      return;
    }
    setBulkBusy(true);
    try {
      const res = await apiBulkApproveOffers(token, ids);
      const r = res.data;
      alert(
        t("admin.pending_review.bulk_approve_result")
          .replace("{approved}", String(r.approved_count))
          .replace("{total}", String(r.total)),
      );
      setSelectedIds(new Set());
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.pending_review.err_approve"));
    } finally {
      setBulkBusy(false);
    }
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
    <div>
      {/* v2 admin-redesign — Marketplace ops Pending review page chrome. */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.pending_review.title") },
        ]}
        title={t("admin.pending_review.title")}
        subtitle={t("admin.pending_review.subtitle")}
        actions={
          selectedIds.size > 0 ? (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void handleBulkApprove()}
              className="inline-flex h-10 items-center rounded-zulu bg-success-600 px-4 text-sm font-semibold text-white transition hover:bg-success-700 disabled:opacity-40"
            >
              {bulkBusy
                ? t("admin.pending_review.bulk_approving")
                : t("admin.pending_review.btn_bulk_approve").replace("{count}", String(selectedIds.size))}
            </button>
          ) : undefined
        }
      />

      <SectionTabs
        activeHref="/platform/approvals"
        items={[
          { href: "/platform/approvals", label: "Approval queue", count: meta?.total },
          { href: "/platform/companies", label: "Companies access" },
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
        <FilterField label={t("admin.pending_review.filter_type")}>
          <Select
            id="pr-type"
            fieldSize="sm"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="!h-[34px]"
          >
            {TYPE_FILTERS.map((tf) => (
              <option key={tf} value={tf}>
                {tf ? t(`admin.module_type.${tf}`) : t("admin.pending_review.filter_all_types")}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label={t("admin.pending_review.filter_search_title")}>
          <Input
            id="pr-q"
            type="text"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { setSearch(searchDraft.trim()); setPage(1); }
            }}
            placeholder={t("admin.pending_review.placeholder_title")}
            className="!h-[34px]"
          />
        </FilterField>
        <V2Button size="sm" variant="primary" onClick={() => { setSearch(searchDraft.trim()); setPage(1); }}>
          {t("admin.pending_review.btn_search")}
        </V2Button>
      </FilterCard>

      {err && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>
              <input
                type="checkbox"
                aria-label={t("admin.pending_review.select_all_on_page")}
                checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                onChange={toggleSelectAllOnPage}
                className="h-4 w-4 cursor-pointer"
              />
            </TH>
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
          {rows.length === 0 ? <TEmpty colSpan={8}>{t("admin.pending_review.empty")}</TEmpty> : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD>
                <input
                  type="checkbox"
                  aria-label={`Select offer #${r.id}`}
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggleSelected(r.id)}
                  className="h-4 w-4 cursor-pointer"
                />
              </TD>
              <TD className="tabular-nums">#{r.id}</TD>
              <TD className="capitalize">{r.type}</TD>
              <TD className="font-medium text-fg-t8">{r.title}</TD>
              <TD>{r.company?.name ?? "—"}</TD>
              <TD>{r.company?.country ?? "—"}</TD>
              <TD className="text-xs text-fg-t6">
                {formatDateTime(r.submitted_for_review_at, lang)}
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
      </V2Card>

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
