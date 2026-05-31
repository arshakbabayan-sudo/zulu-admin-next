"use client";

/**
 * Phase 7.7 — Agent ↔ Operator requests inbox.
 *
 * Replaces the ComingSoonPage placeholder. Two-tab inbox view: inbox (requests
 * targeted at the current user's company) and outbox (requests the user
 * sent). Each row has status pill + click-to-resolve action via a modal.
 *
 * Status flow: open → in_progress → resolved / rejected.
 *
 * Item 14 follow-up: the detail modal now renders a threaded chat — original
 * subject/body at the top + every /messages reply as its own bubble, newest
 * at the bottom + composer at the bottom of the modal.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessOperatorToolsNav, canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { formatDateTime } from "@/lib/format";
import {
  apiAppendRequestMessage,
  apiCreateRequest,
  apiListRequestMessages,
  apiRequestsInbox,
  apiUpdateRequestStatus,
  REQUEST_STATUSES,
  requestStatusLabel,
  requestStatusTier,
  type InboxBox,
  type RequestInboxRow,
  type RequestMessage,
  type RequestStatus,
} from "@/lib/requests-inbox-api";
import { exportRowsAsCsv } from "@/lib/export-csv";
import {
  Button,
  FormField,
  Input,

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
  V2Button,
} from "@/components/ui/v2";
import { Download, Plus } from "lucide-react";
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
  const [thread, setThread] = useState<RequestMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replySending, setReplySending] = useState(false);
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

  // Load the message thread whenever a row is selected. Resets when the modal
  // closes so we don't display the previous request's replies on reopen.
  useEffect(() => {
    if (!token || !selected) {
      setThread([]);
      setThreadError(null);
      setReplyDraft("");
      return;
    }
    let cancelled = false;
    setThreadLoading(true);
    setThreadError(null);
    void (async () => {
      try {
        const res = await apiListRequestMessages(token, selected.id);
        if (!cancelled) setThread(res.data);
      } catch (e) {
        if (!cancelled) {
          setThreadError(
            e instanceof ApiRequestError ? e.message : "Failed to load thread"
          );
        }
      } finally {
        if (!cancelled) setThreadLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selected]);

  async function sendReply() {
    if (!token || !selected) return;
    const body = replyDraft.trim();
    if (!body) return;
    setReplySending(true);
    try {
      const res = await apiAppendRequestMessage(token, selected.id, body);
      setThread((prev) => [...prev, res.data]);
      setReplyDraft("");
      // If posting reopened a closed request, refresh the list so the status
      // pill in the table reflects the new "open" state.
      if (selected.status === "resolved" || selected.status === "rejected") {
        await load();
        setSelected((prev) =>
          prev ? { ...prev, status: "open", resolved_at: null, resolved_by: null } : prev
        );
      }
    } catch (e) {
      setThreadError(
        e instanceof ApiRequestError ? e.message : "Failed to send reply"
      );
    } finally {
      setReplySending(false);
    }
  }

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
          <>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              disabled={rows.length === 0}
              onClick={() =>
                exportRowsAsCsv("requests-inbox", rows, [
                  ["id", (r) => r.id],
                  ["subject", (r) => r.subject],
                  ["status", (r) => r.status],
                  ["requester_company", (r) => r.requester_company?.name ?? ""],
                  ["target_company", (r) => r.target_company?.name ?? ""],
                  ["resolved_by", (r) => r.resolved_by?.name ?? ""],
                  ["resolved_at", (r) => r.resolved_at ?? ""],
                  ["created_at", (r) => r.created_at ?? ""],
                  ["updated_at", (r) => r.updated_at ?? ""],
                ])
              }
            >
              Export
            </V2Button>
            <V2Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setComposeOpen(true)}
            >
              {t("admin.bucket3.requests.new_request")}
            </V2Button>
          </>
        }
      />

      {/* Phase 4F (2026-05-31) — Inbox group strip.
          Replaces the prior Marketplace-ops strip this page rendered (which
          surfaced Approval queue / Companies access / etc. — wrong context
          for a Requests page). Inbox now sits as one top-level sidebar
          group and these three pages are siblings in it. */}
      <SectionTabs
        activeHref="/bucket3/requests"
        items={[
          { href: "/admin-redesign/notifications", label: "My notifications" },
          { href: "/bucket3/requests", label: "Requests" },
          { href: "/bucket3/cases", label: "Cases" },
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
          {rows.map((r) => {
            const fromName = r.requester_company?.name ?? r.requester?.name ?? "—";
            const toName = r.target_company?.name ?? "—";
            return (
            <TR key={r.id} onClick={() => setSelected(r)}>
              <TD className="tabular-nums text-fg-t7 font-mono text-xs">REQ-{String(r.id).padStart(4, "0")}</TD>
              <TD>
                <div className="font-medium text-fg-t8 max-w-[280px] truncate">{r.subject}</div>
              </TD>
              <TD>
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={avatarStyle(pickAvatarTone(`from-${r.id}`))}
                    aria-hidden
                  >
                    {getInitials(fromName)}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-fg-t8 truncate">{fromName}</div>
                  </div>
                </div>
              </TD>
              <TD>
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={avatarStyle(pickAvatarTone(`to-${r.id}`))}
                    aria-hidden
                  >
                    {getInitials(toName)}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-fg-t8 truncate">{toName}</div>
                  </div>
                </div>
              </TD>
              <TD>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={tierBadgeStyle(requestStatusTier(r.status))}
                >
                  {requestStatusLabel(r.status)}
                </span>
              </TD>
              <TD className="text-xs text-fg-t6" title={formatDateTime(r.created_at, lang)}>
                {formatRelativeTime(r.created_at)}
              </TD>
            </TR>
            );
          })}
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
            setReplyDraft("");
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
            {/* Threaded conversation: original message + replies, newest at bottom. */}
            <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
              <MessageBubble
                authorName={selected.requester?.name ?? selected.requester_company?.name ?? "—"}
                authorEmail={selected.requester?.email}
                body={selected.body}
                createdAt={selected.created_at}
                lang={lang}
                isOriginal
              />
              {threadLoading ? (
                <div className="py-3 text-center text-xs text-fg-t6">{t("common.loading")}</div>
              ) : null}
              {!threadLoading &&
                thread.map((m) => (
                  <MessageBubble
                    key={m.id}
                    authorName={m.sender?.name ?? "—"}
                    authorEmail={m.sender?.email}
                    body={m.body}
                    createdAt={m.created_at}
                    lang={lang}
                  />
                ))}
              {!threadLoading && thread.length === 0 && !threadError ? (
                <div className="py-2 text-center text-[11px] text-fg-t6">
                  {t("admin.bucket3.requests.no_replies_yet")}
                </div>
              ) : null}
              {threadError ? (
                <div className="rounded-zulu border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
                  {threadError}
                </div>
              ) : null}
            </div>
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

            {/* Reply composer */}
            <div className="space-y-2 border-t border-default pt-3">
              <FormField label={t("admin.bucket3.requests.reply_label")} htmlFor="reply-body">
                <Input
                  as="textarea"
                  id="reply-body"
                  rows={3}
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder={t("admin.bucket3.requests.reply_placeholder")}
                />
              </FormField>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={replySending || !replyDraft.trim()}
                  onClick={() => void sendReply()}
                >
                  {replySending
                    ? t("admin.bucket3.requests.sending")
                    : t("admin.bucket3.requests.send_reply")}
                </Button>
              </div>
            </div>

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

// v2 admin-redesign helpers.
function getInitials(name: string): string {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function pickAvatarTone(id: number | string): "purple" | "teal" | "amber" | "blue" {
  const tones: Array<"purple" | "teal" | "amber" | "blue"> = ["purple", "teal", "amber", "blue"];
  const n = typeof id === "number" ? id : id.length;
  return tones[n % tones.length]!;
}

function avatarStyle(tone: "purple" | "teal" | "amber" | "blue"): React.CSSProperties {
  const map: Record<"purple" | "teal" | "amber" | "blue", React.CSSProperties> = {
    purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
    teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  };
  return map[tone];
}

function tierBadgeStyle(tier: "neutral" | "info" | "success" | "warning" | "danger"): React.CSSProperties {
  switch (tier) {
    case "success":
      return { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" };
    case "warning":
      return { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" };
    case "danger":
      return { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" };
    case "info":
      return { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" };
    case "neutral":
    default:
      return { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" };
  }
}

function MessageBubble({
  authorName,
  authorEmail,
  body,
  createdAt,
  lang,
  isOriginal = false,
}: {
  authorName: string;
  authorEmail?: string;
  body: string;
  createdAt: string | null | undefined;
  lang: string;
  isOriginal?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
        style={avatarStyle(pickAvatarTone(authorEmail ?? authorName))}
      >
        {getInitials(authorName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[13px] font-semibold text-fg-t8">{authorName}</span>
          {isOriginal ? (
            <span className="text-[10px] uppercase tracking-wide text-fg-t6">opener</span>
          ) : null}
          <span
            className="text-[11px] text-fg-t6"
            title={createdAt ? new Date(createdAt).toLocaleString(lang) : undefined}
          >
            {formatRelativeTime(createdAt ?? null)}
          </span>
        </div>
        <p
          className={`mt-1 whitespace-pre-wrap rounded-zulu border border-default px-3 py-2 text-sm text-fg-t8 ${
            isOriginal ? "bg-figma-bg-1/50" : "bg-white"
          }`}
        >
          {body}
        </p>
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}
