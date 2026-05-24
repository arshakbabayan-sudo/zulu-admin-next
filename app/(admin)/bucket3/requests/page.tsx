"use client";

/**
 * Phase 7.7 — Agent ↔ Operator requests inbox.
 *
 * Replaces the ComingSoonPage placeholder. Two-tab inbox view: inbox (requests
 * targeted at the current user's company) and outbox (requests the user
 * sent). Each row has status pill + click-to-resolve action via a modal.
 *
 * Status flow: open → in_progress → resolved / rejected.
 * Reply threading is deferred to a follow-up (current schema only captures
 * subject + body + resolution_notes).
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessOperatorToolsNav, canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { formatDateTime } from "@/lib/format";
import {
  apiCreateRequest,
  apiRequestsInbox,
  apiUpdateRequestStatus,
  REQUEST_STATUSES,
  requestStatusLabel,
  requestStatusTier,
  type InboxBox,
  type RequestInboxRow,
  type RequestStatus,
} from "@/lib/requests-inbox-api";
import {
  Button,
  FormField,
  Input,
  PageHeader,
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
} from "@/components/ui/v2";
import { useCallback, useEffect, useState } from "react";

export default function Bucket3RequestsPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const allowed = canAccessOperatorToolsNav(user) || canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<RequestInboxRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [box, setBox] = useState<InboxBox>("all");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "">("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<RequestInboxRow | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ target_company_id: "", subject: "", body: "" });

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiRequestsInbox(token, {
        page,
        per_page: 25,
        box,
        status: statusFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load requests");
    }
  }, [token, allowed, page, box, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(newStatus: RequestStatus) {
    if (!token || !selected) return;
    setBusy(true);
    try {
      await apiUpdateRequestStatus(token, selected.id, {
        status: newStatus,
        resolution_notes: resolutionDraft.trim() || null,
      });
      setSelected(null);
      setResolutionDraft("");
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendRequest() {
    if (!token) return;
    const id = Number(compose.target_company_id.trim());
    if (!Number.isFinite(id) || id <= 0) return alert("Pick a target company id");
    if (!compose.subject.trim() || !compose.body.trim()) return alert("Subject and body are required");
    setBusy(true);
    try {
      await apiCreateRequest(token, {
        target_company_id: id,
        subject: compose.subject.trim(),
        body: compose.body.trim(),
      });
      setComposeOpen(false);
      setCompose({ target_company_id: "", subject: "", body: "" });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.bucket3.requests.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.bucket3.requests.title") },
        ]}
        title={t("admin.bucket3.requests.title")}
        subtitle={
          meta
            ? t("admin.bucket3.requests.subtitle_count")
                .replace("{count}", String(meta.total))
                .replace("{page}", String(meta.current_page))
                .replace("{last}", String(meta.last_page))
            : t("admin.bucket3.requests.subtitle")
        }
        actions={
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            {t("admin.bucket3.requests.new_request")}
          </Button>
        }
      />

      <SectionTabs
        activeHref="/bucket3/requests"
        items={[
          { href: "/platform/approvals", label: "Approval queue" },
          { href: "/platform/companies", label: "Companies access" },
          { href: "/platform/seller-applications", label: "Seller applications" },
          { href: "/platform/contracts", label: "Partnership agreements" },
          { href: "/platform/contract-templates", label: "Contract templates" },
          { href: "/platform/audit-logs", label: "Audit logs" },
          { href: "/bucket3/service-logs", label: "Service logs" },
          { href: "/bucket3/unverified-accounts", label: "Unverified accounts" },
        ]}
      />

      <div className="space-y-6">

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">{t("admin.bucket3.requests.view")}</span>
            <Select
              fieldSize="sm"
              value={box}
              onChange={(e) => {
                setPage(1);
                setBox(e.target.value as InboxBox);
              }}
              className="!w-auto min-w-[140px]"
            >
              <option value="all">{t("common.all")}</option>
              <option value="inbox">{t("admin.bucket3.requests.view.inbox")}</option>
              <option value="outbox">{t("admin.bucket3.requests.view.outbox")}</option>
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">{t("admin.bucket3.requests.filter.status")}</span>
            <Select
              fieldSize="sm"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value as RequestStatus | "");
              }}
              className="!w-auto min-w-[160px]"
            >
              <option value="">{t("common.all")}</option>
              {REQUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {requestStatusLabel(s)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <Table>
        <THead>
          <TR>
            <TH>#</TH>
            <TH>{t("admin.bucket3.requests.col.subject")}</TH>
            <TH>{t("admin.bucket3.requests.col.from")}</TH>
            <TH>{t("admin.bucket3.requests.col.to")}</TH>
            <TH>{t("admin.bucket3.requests.col.status")}</TH>
            <TH>{t("admin.bucket3.requests.col.created")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={6}>{t("admin.bucket3.requests.empty")}</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id} onClick={() => setSelected(r)}>
              <TD className="tabular-nums text-fg-t7">{r.id}</TD>
              <TD className="font-medium text-fg-t8 max-w-[280px] truncate">{r.subject}</TD>
              <TD className="text-xs text-fg-t7">
                {r.requester_company?.name ?? r.requester?.name ?? "—"}
              </TD>
              <TD className="text-xs text-fg-t7">{r.target_company?.name ?? "—"}</TD>
              <TD>
                <StatusPill status={requestStatusTier(r.status)}>
                  {requestStatusLabel(r.status)}
                </StatusPill>
              </TD>
              <TD className="text-xs text-fg-t6">{formatDateTime(r.created_at, lang)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {meta && meta.last_page > 1 && (
        <Pagination
          page={meta.current_page}
          lastPage={meta.last_page}
          onPage={(p) => setPage(p)}
        />
      )}

      {/* Detail / action modal */}
      {selected && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => {
            setSelected(null);
            setResolutionDraft("");
          }}
        >
          <div
            className="my-12 w-full max-w-2xl rounded-zulu bg-white p-6 shadow-zulu-card space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{selected.subject}</h2>
                <div className="mt-1 flex items-center gap-2 text-xs text-fg-t6">
                  <span>
                    {t("admin.bucket3.requests.from").replace("{name}", selected.requester_company?.name ?? selected.requester?.name ?? "—")}
                  </span>
                  <span>→</span>
                  <span>{selected.target_company?.name ?? "—"}</span>
                </div>
              </div>
              <StatusPill status={requestStatusTier(selected.status)}>
                {requestStatusLabel(selected.status)}
              </StatusPill>
            </div>
            <p className="whitespace-pre-wrap rounded-zulu border border-default bg-figma-bg-1/50 p-3 text-sm text-fg-t8">
              {selected.body}
            </p>
            {selected.resolution_notes && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-t6">
                  {t("admin.bucket3.requests.resolution_notes")}
                </div>
                <p className="whitespace-pre-wrap rounded-zulu border border-default bg-white p-3 text-sm text-fg-t8">
                  {selected.resolution_notes}
                </p>
              </div>
            )}
            <FormField label={t("admin.bucket3.requests.field.resolution_notes")} htmlFor="resolution-notes">
              <Input
                as="textarea"
                id="resolution-notes"
                rows={3}
                value={resolutionDraft}
                onChange={(e) => setResolutionDraft(e.target.value)}
                placeholder={selected.resolution_notes ?? t("admin.bucket3.requests.field.resolution_placeholder")}
              />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || selected.status === "in_progress"}
                onClick={() => void updateStatus("in_progress")}
              >
                {t("admin.bucket3.requests.mark_in_progress")}
              </Button>
              <Button
                size="sm"
                disabled={busy || selected.status === "resolved"}
                onClick={() => void updateStatus("resolved")}
              >
                {t("admin.bucket3.requests.resolve")}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busy || selected.status === "rejected"}
                onClick={() => void updateStatus("rejected")}
              >
                {t("admin.bucket3.requests.reject")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelected(null);
                  setResolutionDraft("");
                }}
              >
                {t("admin.bucket3.requests.close")}
              </Button>
            </div>
            <div className="border-t border-default pt-2 text-xs text-fg-t6">
              {t("admin.bucket3.requests.created_at").replace("{date}", formatDateTime(selected.created_at, lang))}
              {selected.resolved_at ? t("admin.bucket3.requests.resolved_at").replace("{date}", formatDateTime(selected.resolved_at, lang)) : ""}
              {selected.resolved_by ? t("admin.bucket3.requests.resolved_by").replace("{name}", selected.resolved_by.name) : ""}
            </div>
          </div>
        </div>
      )}

      {/* Compose modal */}
      {composeOpen && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setComposeOpen(false)}
        >
          <div
            className="my-12 w-full max-w-2xl rounded-zulu bg-white p-6 shadow-zulu-card space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">{t("admin.bucket3.requests.new_request")}</h2>
            <FormField label={t("admin.bucket3.requests.field.target_company")} htmlFor="compose-target" required>
              <Input
                id="compose-target"
                type="number"
                min={1}
                value={compose.target_company_id}
                onChange={(e) => setCompose((p) => ({ ...p, target_company_id: e.target.value }))}
                placeholder={t("admin.bucket3.requests.field.target_company_placeholder")}
              />
            </FormField>
            <FormField label={t("admin.bucket3.requests.field.subject")} htmlFor="compose-subject" required>
              <Input
                id="compose-subject"
                value={compose.subject}
                onChange={(e) => setCompose((p) => ({ ...p, subject: e.target.value }))}
              />
            </FormField>
            <FormField label={t("admin.bucket3.requests.field.body")} htmlFor="compose-body" required>
              <Input
                as="textarea"
                id="compose-body"
                rows={6}
                value={compose.body}
                onChange={(e) => setCompose((p) => ({ ...p, body: e.target.value }))}
              />
            </FormField>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void sendRequest()}>
                {busy ? t("admin.bucket3.requests.sending") : t("admin.bucket3.requests.send")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setComposeOpen(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
