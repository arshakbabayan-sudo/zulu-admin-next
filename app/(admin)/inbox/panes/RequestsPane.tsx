"use client";

/**
 * Inbox → Requests pane (admin v3). Agent ↔ operator requests.
 *
 * Self-contained 1:1 port of `#pane-requests` from
 * docs/admin_designe/8_Inbox/inbox.html (lines 951–1002 + the
 * `#requestDetailModal` detail/threaded modal), re-homed onto the unified
 * Inbox page. Pure management.css presentation — no admin Tailwind, no
 * `--admin-*` tokens, no `@/components/ui*`.
 *
 * Functionality ported verbatim from app/(admin)/bucket3/requests/page.tsx:
 *   - box sub-tabs (all / inbox / outbox) + status filter + "New request" CTA
 *   - card-wrapped table of requests (subject · parties · status · created)
 *   - row click → detail modal with the threaded conversation
 *     (opener message + every /messages reply as a bubble, newest at bottom)
 *   - status-action buttons (In Progress / Resolve / Reject, confirm-guarded)
 *   - composer reply textarea (re-opens a closed request on send)
 *
 * Endpoints (via @/lib/requests-inbox-api):
 *   GET    /agent-operator-requests          (box, status, page, per_page)
 *   POST   /agent-operator-requests          ({target_company_id, subject, body})
 *   PATCH  /agent-operator-requests/{id}/status  ({status, resolution_notes?})
 *   GET    /agent-operator-requests/{id}/messages (asc)
 *   POST   /agent-operator-requests/{id}/messages ({body}, ≤10000)
 */

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
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
  type InboxBox,
  type RequestInboxRow,
  type RequestMessage,
  type RequestStatus,
} from "@/lib/requests-inbox-api";

const PER_PAGE = 25;

type L = { hy: string; ru: string; en: string };

/** Trilingual label picker keyed on the active admin language. */
function pick(lang: string, map: L): string {
  if (lang === "ru") return map.ru;
  if (lang === "en") return map.en;
  return map.hy;
}

const BOXES: InboxBox[] = ["all", "inbox", "outbox"];

const T = {
  forbiddenTitle: { hy: "Հասանելի չէ", ru: "Нет доступа", en: "No access" },
  forbidden: {
    hy: "Այս բաժինը հասանելի է միայն օպերատորներին և հարթակի ադմինիստրատորներին։",
    ru: "Этот раздел доступен только операторам и администраторам платформы.",
    en: "This section is available to operators and platform administrators only.",
  },
  newRequest: { hy: "Նոր հարցում", ru: "Новый запрос", en: "New request" },
  view: { hy: "Ցուցադրում", ru: "Показ", en: "View" },
  boxAll: { hy: "Բոլորը", ru: "Все", en: "All" },
  boxInbox: { hy: "Մուտքային", ru: "Входящие", en: "Inbox" },
  boxOutbox: { hy: "Ելքային", ru: "Исходящие", en: "Outbox" },
  filterStatus: { hy: "Կարգավիճակ", ru: "Статус", en: "Status" },
  allStatuses: { hy: "Բոլոր կարգավիճակները", ru: "Все статусы", en: "All statuses" },
  colSubject: { hy: "Թեմա", ru: "Тема", en: "Subject" },
  colParties: { hy: "Կողմեր", ru: "Стороны", en: "Parties" },
  colStatus: { hy: "Կարգավիճակ", ru: "Статус", en: "Status" },
  colCreated: { hy: "Ստեղծված", ru: "Создан", en: "Created" },
  empty: {
    hy: "Հարցումներ չկան։",
    ru: "Запросов нет.",
    en: "No requests.",
  },
  loading: { hy: "Բեռնվում է…", ru: "Загрузка…", en: "Loading…" },
  showing: { hy: "Ցուցադրվում է", ru: "Показано", en: "Showing" },
  of: { hy: "ընդ․", ru: "из", en: "of" },
  prev: { hy: "Նախորդ", ru: "Назад", en: "Prev" },
  next: { hy: "Հաջորդ", ru: "Вперёд", en: "Next" },
  // status labels
  stOpen: { hy: "Բաց", ru: "Открыт", en: "Open" },
  stInProgress: { hy: "Ընթացքի մեջ", ru: "В работе", en: "In progress" },
  stResolved: { hy: "Լուծված", ru: "Решён", en: "Resolved" },
  stRejected: { hy: "Մերժված", ru: "Отклонён", en: "Rejected" },
  // detail modal
  from: { hy: "Ումից", ru: "От", en: "From" },
  to: { hy: "Ում", ru: "Кому", en: "To" },
  openerLabel: { hy: "Սկզբնական հաղորդագրություն", ru: "Исходное сообщение", en: "Opening message" },
  resolutionNotes: { hy: "Լուծման նշումներ", ru: "Заметки по решению", en: "Resolution notes" },
  noReplies: {
    hy: "Դեռ պատասխաններ չկան։",
    ru: "Ответов пока нет.",
    en: "No replies yet.",
  },
  threadError: {
    hy: "Չհաջողվեց բեռնել նամակագրությունը։",
    ru: "Не удалось загрузить переписку.",
    en: "Failed to load the thread.",
  },
  replyPlaceholder: {
    hy: "Գրիր պատասխան…",
    ru: "Напишите ответ…",
    en: "Write a reply…",
  },
  send: { hy: "Ուղարկել", ru: "Отправить", en: "Send" },
  sending: { hy: "Ուղարկվում է…", ru: "Отправка…", en: "Sending…" },
  markInProgress: { hy: "Վերցնել ընթացքի մեջ", ru: "Взять в работу", en: "Mark in progress" },
  resolve: { hy: "Լուծել", ru: "Решить", en: "Resolve" },
  reject: { hy: "Մերժել", ru: "Отклонить", en: "Reject" },
  close: { hy: "Փակել", ru: "Закрыть", en: "Close" },
  createdAt: { hy: "Ստեղծված", ru: "Создан", en: "Created" },
  resolvedAt: { hy: "Լուծված", ru: "Решён", en: "Resolved" },
  resolvedBy: { hy: "Լուծել է", ru: "Решил", en: "Resolved by" },
  resolutionPlaceholder: {
    hy: "Ընտրովի նշում, որ կուղարկվի մյուս կողմին…",
    ru: "Необязательная заметка для другой стороны…",
    en: "Optional note sent to the other side…",
  },
  resolutionField: {
    hy: "Լուծման նշում (ընտրովի)",
    ru: "Заметка по решению (необязательно)",
    en: "Resolution note (optional)",
  },
  // compose modal
  fieldTargetCompany: { hy: "Թիրախ ընկերության ID", ru: "ID компании-получателя", en: "Target company ID" },
  targetCompanyPh: { hy: "Օր․ 12", ru: "Напр. 12", en: "e.g. 12" },
  fieldSubject: { hy: "Թեմա", ru: "Тема", en: "Subject" },
  subjectPh: { hy: "Հարցման թեման…", ru: "Тема запроса…", en: "Request subject…" },
  fieldBody: { hy: "Հաղորդագրություն", ru: "Сообщение", en: "Message" },
  bodyPh: { hy: "Նկարագրիր հարցումը…", ru: "Опишите запрос…", en: "Describe the request…" },
  cancel: { hy: "Չեղարկել", ru: "Отмена", en: "Cancel" },
  // confirms
  confirmInProgressTitle: { hy: "Վերցնե՞լ ընթացքի մեջ", ru: "Взять в работу?", en: "Mark in progress?" },
  confirmInProgressMsg: {
    hy: "Հարցումը կնշվի որպես ընթացքի մեջ։",
    ru: "Запрос будет отмечен как «в работе».",
    en: "The request will be marked as in progress.",
  },
  confirmResolveTitle: { hy: "Լուծե՞լ հարցումը", ru: "Решить запрос?", en: "Resolve request?" },
  confirmResolveMsg: {
    hy: "Հարցումը կնշվի որպես լուծված։",
    ru: "Запрос будет отмечен как решённый.",
    en: "The request will be marked as resolved.",
  },
  confirmRejectTitle: { hy: "Մերժե՞լ հարցումը", ru: "Отклонить запрос?", en: "Reject request?" },
  confirmRejectMsg: {
    hy: "Հարցումը կնշվի որպես մերժված։",
    ru: "Запрос будет отмечен как отклонённый.",
    en: "The request will be marked as rejected.",
  },
  // validation / errors
  errTargetRequired: {
    hy: "Նշիր թիրախ ընկերության վավեր ID։",
    ru: "Укажите корректный ID компании-получателя.",
    en: "Enter a valid target company ID.",
  },
  errSubjectBodyRequired: {
    hy: "Թեման և հաղորդագրությունը պարտադիր են։",
    ru: "Тема и сообщение обязательны.",
    en: "Subject and message are required.",
  },
  errLoad: {
    hy: "Չհաջողվեց բեռնել հարցումները։",
    ru: "Не удалось загрузить запросы.",
    en: "Failed to load requests.",
  },
  errStatus: {
    hy: "Չհաջողվեց փոխել կարգավիճակը։",
    ru: "Не удалось изменить статус.",
    en: "Failed to update the status.",
  },
  errCreate: {
    hy: "Չհաջողվեց ուղարկել հարցումը։",
    ru: "Не удалось отправить запрос.",
    en: "Failed to send the request.",
  },
  errReply: {
    hy: "Չհաջողվեց ուղարկել պատասխանը։",
    ru: "Не удалось отправить ответ.",
    en: "Failed to send the reply.",
  },
} satisfies Record<string, L>;

function statusLabel(lang: string, s: RequestStatus): string {
  switch (s) {
    case "open":
      return pick(lang, T.stOpen);
    case "in_progress":
      return pick(lang, T.stInProgress);
    case "resolved":
      return pick(lang, T.stResolved);
    case "rejected":
      return pick(lang, T.stRejected);
  }
}

/**
 * Status badge tone (per the mockup):
 *   open → info, in_progress → warning, resolved → success, rejected → danger.
 */
function statusBadgeCls(s: RequestStatus): string {
  switch (s) {
    case "open":
      return "badge-info";
    case "in_progress":
      return "badge-warning";
    case "resolved":
      return "badge-success";
    case "rejected":
      return "badge-danger";
  }
}

function boxLabel(lang: string, box: InboxBox): string {
  switch (box) {
    case "all":
      return pick(lang, T.boxAll);
    case "inbox":
      return pick(lang, T.boxInbox);
    case "outbox":
      return pick(lang, T.boxOutbox);
  }
}

/** Deterministic avatar tone per id — mirrors the mockup's rotating tints. */
function avatarTone(seed: number): string {
  const tones = ["", "avatar-teal", "avatar-amber", "avatar-blue"];
  return tones[Math.abs(seed) % tones.length] ?? "";
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function RequestsPane() {
  const { token, user } = useAdminAuth();
  const { lang } = useLanguage();
  const confirm = useConfirm();

  const allowed = canAccessOperatorToolsNav(user) || canAccessPlatformAdminNav(user);

  // list state
  const [rows, setRows] = useState<RequestInboxRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [box, setBox] = useState<InboxBox>("all");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "">("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // detail modal + thread
  const [selected, setSelected] = useState<RequestInboxRow | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [thread, setThread] = useState<RequestMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replySending, setReplySending] = useState(false);

  // compose modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ target_company_id: "", subject: "", body: "" });

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiRequestsInbox(token, {
        page,
        per_page: PER_PAGE,
        box,
        status: statusFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : pick(lang, T.errLoad));
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, box, statusFilter, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  // Load the message thread whenever a row is selected. Reset on close so we
  // never show the previous request's replies on reopen.
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
          setThreadError(e instanceof ApiRequestError ? e.message : pick(lang, T.threadError));
        }
      } finally {
        if (!cancelled) setThreadLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selected, lang]);

  const closeDetail = useCallback(() => {
    setSelected(null);
    setResolutionDraft("");
    setReplyDraft("");
    setThreadError(null);
  }, []);

  async function sendReply() {
    if (!token || !selected) return;
    const body = replyDraft.trim();
    if (!body) return;
    setReplySending(true);
    setThreadError(null);
    try {
      const res = await apiAppendRequestMessage(token, selected.id, body);
      setThread((prev) => [...prev, res.data]);
      setReplyDraft("");
      // Posting to a closed request reopens it — refresh the list pill + the
      // open detail row so the action buttons reflect the new "open" state.
      if (selected.status === "resolved" || selected.status === "rejected") {
        await load();
        setSelected((prev) =>
          prev ? { ...prev, status: "open", resolved_at: null, resolved_by: null } : prev,
        );
      }
    } catch (e) {
      setThreadError(e instanceof ApiRequestError ? e.message : pick(lang, T.errReply));
    } finally {
      setReplySending(false);
    }
  }

  async function updateStatus(
    newStatus: RequestStatus,
    confirmTitle: L,
    confirmMsg: L,
    variant?: "danger",
  ) {
    if (!token || !selected) return;
    const ok = await confirm({
      title: pick(lang, confirmTitle),
      message: pick(lang, confirmMsg),
      ...(variant ? { variant } : {}),
    });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      await apiUpdateRequestStatus(token, selected.id, {
        status: newStatus,
        resolution_notes: resolutionDraft.trim() || null,
      });
      closeDetail();
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : pick(lang, T.errStatus));
    } finally {
      setBusy(false);
    }
  }

  async function sendRequest() {
    if (!token) return;
    const id = Number(compose.target_company_id.trim());
    if (!Number.isFinite(id) || id <= 0) {
      setErr(pick(lang, T.errTargetRequired));
      return;
    }
    if (!compose.subject.trim() || !compose.body.trim()) {
      setErr(pick(lang, T.errSubjectBodyRequired));
      return;
    }
    setBusy(true);
    setErr(null);
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
      setErr(e instanceof ApiRequestError ? e.message : pick(lang, T.errCreate));
    } finally {
      setBusy(false);
    }
  }

  const partyName = useCallback(
    (r: RequestInboxRow): { from: string; to: string } => ({
      from: r.requester_company?.name ?? r.requester?.name ?? "—",
      to: r.target_company?.name ?? "—",
    }),
    [],
  );

  const total = meta?.total ?? 0;
  const lastPage = meta?.last_page ?? 1;
  const fromRow = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const toRow = Math.min(page * PER_PAGE, total);

  // ── forbidden lock ──────────────────────────────────────────────────────────
  if (!allowed) {
    return (
      <div className="empty-state">
        <div className="es-icon">
          <i className="ti ti-lock" />
        </div>
        <div className="es-title">{pick(lang, T.forbiddenTitle)}</div>
        <div className="es-sub">{pick(lang, T.forbidden)}</div>
      </div>
    );
  }

  const detailParties = selected ? partyName(selected) : null;

  return (
    <>
      {/* ── filters: box sub-tabs · status filter · New request ── */}
      <div className="filter-card">
        <div className="sub-tabs">
          {BOXES.map((b) => (
            <button
              key={b}
              className={`sub-tab${box === b ? " active" : ""}`}
              onClick={() => {
                setBox(b);
                setPage(1);
              }}
              type="button"
            >
              {boxLabel(lang, b)}
            </button>
          ))}
        </div>
        <div className="filter-field">
          <span className="filter-label">{pick(lang, T.filterStatus)}</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as RequestStatus | "");
              setPage(1);
            }}
          >
            <option value="">{pick(lang, T.allStatuses)}</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(lang, s)}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-primary"
          style={{ marginInlineStart: "auto" }}
          onClick={() => {
            setErr(null);
            setComposeOpen(true);
          }}
          type="button"
        >
          <i className="ti ti-plus" />
          {pick(lang, T.newRequest)}
        </button>
      </div>

      {err && (
        <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}>
          <i className="ti ti-alert-circle" />
          <span>{err}</span>
        </div>
      )}

      {/* ── requests table ── */}
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{pick(lang, T.colSubject)}</th>
                <th>{pick(lang, T.colParties)}</th>
                <th>{pick(lang, T.colStatus)}</th>
                <th>{pick(lang, T.colCreated)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-secondary)" }}
                  >
                    {loading ? pick(lang, T.loading) : pick(lang, T.empty)}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const { from, to } = partyName(r);
                  return (
                    <tr key={r.id} onClick={() => setSelected(r)} style={{ cursor: "pointer" }}>
                      <td className="font-mono">REQ-{String(r.id).padStart(4, "0")}</td>
                      <td className="font-semibold">{r.subject}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className={`avatar sm ${avatarTone(r.id)}`}>{initials(from)}</span>
                          <span>{from}</span>
                          <i className="ti ti-arrow-right" style={{ color: "var(--text-tertiary)" }} />
                          <span className={`avatar sm ${avatarTone(r.id + 1)}`}>{initials(to)}</span>
                          <span>{to}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${statusBadgeCls(r.status)}`}>{statusLabel(lang, r.status)}</span>
                      </td>
                      <td className="cell-muted" title={formatDateTime(r.created_at, lang)}>
                        {formatDateTime(r.created_at, lang)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.last_page > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              {pick(lang, T.showing)} {fromRow}–{toRow} {pick(lang, T.of)} {total}
            </span>
            <div className="pagination-controls">
              <button
                className="btn btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                {pick(lang, T.prev)}
              </button>
              <button className="btn btn-sm btn-primary" type="button">
                {page}
              </button>
              <button
                className="btn btn-sm"
                disabled={page >= lastPage || loading}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                type="button"
              >
                {pick(lang, T.next)}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── detail / threaded-conversation modal ── */}
      <div className={`modal-overlay${selected ? " open" : ""}`}>
        <div className="modal lg">
          {selected && detailParties && (
            <>
              <div className="modal-header">
                <div style={{ minWidth: 0 }}>
                  <div className="modal-title">{selected.subject}</div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span>
                      {pick(lang, T.from)}: {detailParties.from}
                    </span>
                    <i className="ti ti-arrow-right" />
                    <span>
                      {pick(lang, T.to)}: {detailParties.to}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`badge ${statusBadgeCls(selected.status)}`}>
                    {statusLabel(lang, selected.status)}
                  </span>
                  <button className="icon-btn" title={pick(lang, T.close)} onClick={closeDetail} type="button">
                    <i className="ti ti-x" />
                  </button>
                </div>
              </div>

              <div className="modal-body">
                {/* Threaded conversation: opener message + replies, newest at bottom. */}
                <div className="thread">
                  <div className="opener-msg">
                    <div className="om-label">
                      {pick(lang, T.openerLabel)} ·{" "}
                      {selected.requester?.name ?? selected.requester_company?.name ?? "—"} ·{" "}
                      {formatDateTime(selected.created_at, lang)}
                    </div>
                    <div className="om-body">{selected.body}</div>
                  </div>

                  {threadLoading && <div className="thread-empty">{pick(lang, T.loading)}</div>}

                  {!threadLoading &&
                    thread.map((m) => {
                      const senderName = m.sender?.name ?? "—";
                      const mine =
                        user != null && m.sender != null && m.sender.id === user.id;
                      return (
                        <div key={m.id} className={`bubble${mine ? " staff" : ""}`}>
                          <span className={`b-avatar ${avatarTone(m.sender?.id ?? m.id)}`}>
                            {initials(senderName)}
                          </span>
                          <div className="b-wrap">
                            <div className="b-head">
                              <span className="b-name">{senderName}</span>
                              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                {formatDateTime(m.created_at, lang)}
                              </span>
                            </div>
                            <div className="b-body">{m.body}</div>
                          </div>
                        </div>
                      );
                    })}

                  {!threadLoading && !threadError && thread.length === 0 && (
                    <div className="thread-empty">{pick(lang, T.noReplies)}</div>
                  )}

                  {threadError && (
                    <div
                      className="alert"
                      style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}
                    >
                      <i className="ti ti-alert-circle" />
                      <span>{threadError}</span>
                    </div>
                  )}
                </div>

                {selected.resolution_notes && (
                  <div className="fld" style={{ marginTop: 16 }}>
                    <span className="fld-label">{pick(lang, T.resolutionNotes)}</span>
                    <div
                      className="b-body"
                      style={{ whiteSpace: "pre-wrap", padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }}
                    >
                      {selected.resolution_notes}
                    </div>
                  </div>
                )}

                {/* Reply composer */}
                <div className="composer" style={{ marginTop: 16 }}>
                  <textarea
                    value={replyDraft}
                    maxLength={10000}
                    placeholder={pick(lang, T.replyPlaceholder)}
                    onChange={(e) => setReplyDraft(e.target.value)}
                  />
                  <div className="composer-bar">
                    <span className="spacer" />
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={replySending || !replyDraft.trim()}
                      onClick={() => void sendReply()}
                      type="button"
                    >
                      <i className="ti ti-send" />
                      {replySending ? pick(lang, T.sending) : pick(lang, T.send)}
                    </button>
                  </div>
                </div>

                {/* Optional resolution note attached to the next status change */}
                <div className="fld" style={{ marginTop: 16 }}>
                  <span className="fld-label">{pick(lang, T.resolutionField)}</span>
                  <textarea
                    value={resolutionDraft}
                    maxLength={2000}
                    placeholder={pick(lang, T.resolutionPlaceholder)}
                    onChange={(e) => setResolutionDraft(e.target.value)}
                  />
                </div>

                <div
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <span>
                    {pick(lang, T.createdAt)}: {formatDateTime(selected.created_at, lang)}
                  </span>
                  {selected.resolved_at && (
                    <span>
                      {pick(lang, T.resolvedAt)}: {formatDateTime(selected.resolved_at, lang)}
                    </span>
                  )}
                  {selected.resolved_by && (
                    <span>
                      {pick(lang, T.resolvedBy)}: {selected.resolved_by.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="modal-footer" style={{ flexWrap: "wrap" }}>
                <button
                  className="btn"
                  disabled={busy || selected.status === "in_progress"}
                  onClick={() =>
                    void updateStatus("in_progress", T.confirmInProgressTitle, T.confirmInProgressMsg)
                  }
                  type="button"
                >
                  <i className="ti ti-progress" />
                  {pick(lang, T.markInProgress)}
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busy || selected.status === "resolved"}
                  onClick={() => void updateStatus("resolved", T.confirmResolveTitle, T.confirmResolveMsg)}
                  type="button"
                >
                  <i className="ti ti-circle-check" />
                  {pick(lang, T.resolve)}
                </button>
                <button
                  className="btn btn-danger"
                  disabled={busy || selected.status === "rejected"}
                  onClick={() =>
                    void updateStatus("rejected", T.confirmRejectTitle, T.confirmRejectMsg, "danger")
                  }
                  type="button"
                >
                  <i className="ti ti-x" />
                  {pick(lang, T.reject)}
                </button>
                <button className="btn" style={{ marginInlineStart: "auto" }} onClick={closeDetail} type="button">
                  {pick(lang, T.close)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── compose (New request) modal ── */}
      <div className={`modal-overlay${composeOpen ? " open" : ""}`}>
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title">{pick(lang, T.newRequest)}</div>
            <button
              className="icon-btn"
              title={pick(lang, T.cancel)}
              onClick={() => setComposeOpen(false)}
              type="button"
            >
              <i className="ti ti-x" />
            </button>
          </div>
          <div className="modal-body">
            <div className="form-grid">
              <div className="fld">
                <span className="fld-label">
                  {pick(lang, T.fieldTargetCompany)} <span style={{ color: "var(--danger)" }}>*</span>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={compose.target_company_id}
                  placeholder={pick(lang, T.targetCompanyPh)}
                  onChange={(e) =>
                    setCompose((p) => ({ ...p, target_company_id: e.target.value.replace(/[^0-9]/g, "") }))
                  }
                />
              </div>
              <div className="fld">
                <span className="fld-label">
                  {pick(lang, T.fieldSubject)} <span style={{ color: "var(--danger)" }}>*</span>
                </span>
                <input
                  type="text"
                  value={compose.subject}
                  placeholder={pick(lang, T.subjectPh)}
                  onChange={(e) => setCompose((p) => ({ ...p, subject: e.target.value }))}
                />
              </div>
              <div className="fld">
                <span className="fld-label">
                  {pick(lang, T.fieldBody)} <span style={{ color: "var(--danger)" }}>*</span>
                </span>
                <textarea
                  value={compose.body}
                  maxLength={10000}
                  placeholder={pick(lang, T.bodyPh)}
                  onChange={(e) => setCompose((p) => ({ ...p, body: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setComposeOpen(false)} type="button">
              {pick(lang, T.cancel)}
            </button>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void sendRequest()}
              type="button"
            >
              <i className="ti ti-send" />
              {busy ? pick(lang, T.sending) : pick(lang, T.send)}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
