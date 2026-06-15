"use client";

/**
 * Inbox → Cases pane (admin v3). Self-contained 1:1 port of `#pane-cases`
 * from docs/admin_designe/8_Inbox/inbox.html (lines 1003–1056) plus its detail
 * drawer (`#caseDrawer`, lines 1339–1383).
 *
 * Functionality ported verbatim from app/(admin)/bucket3/cases/page.tsx:
 *   - GET /cases (25/page; filter status/priority/search; sorted priority DESC
 *     then created_at DESC server-side)
 *   - POST /cases (title, description, priority, company_id, assigned_to_user_id)
 *   - GET /cases/{id} (re-fetch the open case after a PATCH)
 *   - PATCH /cases/{id} (re-anchors sla_due_at on priority change; sets
 *     closed_at on resolved/closed)
 *   - GET /cases/{id}/replies (non-staff = public only; staff = all)
 *   - POST /cases/{id}/replies (visibility public|internal; internal = staff
 *     only; posting re-opens a closed case)
 *   - Export CSV = client-side over the visible rows; disabled when empty
 *
 * SLA: the API returns `sla_remaining_minutes`; render a `.sla-chip`
 *   (over/escalated → `.over`, else `.warn` when < 60min, else `.ok`).
 *
 * Pure management.css + the `.inbox-page` thread/bubble/composer classes. No
 * admin Tailwind, no `--admin-*` tokens, no `@/components/ui*`. Self-contained
 * via useAdminAuth (token, user) + useLanguage (lang). Cases are staff-only.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { canAccessOperatorToolsNav, canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
import { formatDateTime } from "@/lib/format";

const PER_PAGE = 25;

const STATUSES = [
  "open",
  "in_progress",
  "pending_customer",
  "resolved",
  "closed",
  "escalated",
] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
type CaseStatus = (typeof STATUSES)[number];
type Priority = (typeof PRIORITIES)[number];

type CaseRow = {
  id: number;
  case_number: string;
  company_id: number | null;
  company_name: string | null;
  title: string;
  description: string;
  status: CaseStatus;
  priority: Priority;
  assigned_to: { id: number; name: string } | null;
  opened_by: { id: number; name: string } | null;
  opened_at: string | null;
  closed_at: string | null;
  sla_due_at: string | null;
  escalated_at: string | null;
  sla_remaining_minutes: number | null;
  closing_notes: string | null;
};

type Reply = {
  id: number;
  case_id: number;
  user: { id: number; name: string; email: string } | null;
  body: string;
  visibility: "public" | "internal";
  attachments: unknown;
  created_at: string | null;
};

type L = { hy: string; ru: string; en: string };

/** Trilingual label picker keyed on the active admin language. */
function pick(lang: string, map: L): string {
  if (lang === "ru") return map.ru;
  if (lang === "en") return map.en;
  return map.hy;
}

const T = {
  forbiddenTitle: { hy: "Հասանելի չէ", ru: "Нет доступа", en: "No access" },
  forbidden: {
    hy: "Գործերը հասանելի են միայն անձնակազմին։",
    ru: "Дела доступны только сотрудникам.",
    en: "Cases are available to staff only.",
  },

  // header
  newCase: { hy: "Նոր գործ", ru: "Новое дело", en: "New case" },
  cardTitle: { hy: "Գործեր", ru: "Дела", en: "Cases" },
  exportCsv: { hy: "Ներբեռնել CSV", ru: "Скачать CSV", en: "Export CSV" },
  apply: { hy: "Կիրառել", ru: "Применить", en: "Apply" },

  // filters
  fltSearch: { hy: "Որոնում", ru: "Поиск", en: "Search" },
  searchPh: {
    hy: "Գործի համար կամ վերնագիր…",
    ru: "Номер дела или заголовок…",
    en: "Case number or title…",
  },
  fltStatus: { hy: "Կարգավիճակ", ru: "Статус", en: "Status" },
  fltPriority: { hy: "Առաջնահերթություն", ru: "Приоритет", en: "Priority" },
  allStatuses: { hy: "Բոլոր կարգավիճակները", ru: "Все статусы", en: "All statuses" },
  all: { hy: "Բոլորը", ru: "Все", en: "All" },

  // status labels
  stOpen: { hy: "Բաց", ru: "Открыто", en: "Open" },
  stInProgress: { hy: "Ընթացքում", ru: "В работе", en: "In progress" },
  stPendingCustomer: { hy: "Սպասում է հաճախորդին", ru: "Ожидает клиента", en: "Pending customer" },
  stResolved: { hy: "Լուծված", ru: "Решено", en: "Resolved" },
  stClosed: { hy: "Փակված", ru: "Закрыто", en: "Closed" },
  stEscalated: { hy: "Սրված", ru: "Эскалировано", en: "Escalated" },

  // priority labels
  prLow: { hy: "Ցածր", ru: "Низкий", en: "Low" },
  prNormal: { hy: "Միջին", ru: "Обычный", en: "Normal" },
  prHigh: { hy: "Բարձր", ru: "Высокий", en: "High" },
  prUrgent: { hy: "Հրատապ", ru: "Срочный", en: "Urgent" },

  // table columns
  colCaseNumber: { hy: "Գործի համար", ru: "Номер дела", en: "Case number" },
  colTitle: { hy: "Վերնագիր", ru: "Заголовок", en: "Title" },
  colStatus: { hy: "Կարգավիճակ", ru: "Статус", en: "Status" },
  colPriority: { hy: "Առաջնահերթություն", ru: "Приоритет", en: "Priority" },
  colSla: { hy: "SLA (ժամկետ)", ru: "SLA (срок)", en: "SLA" },
  colAssigned: { hy: "Պատասխանատու", ru: "Ответственный", en: "Assigned to" },
  colOpened: { hy: "Բացված", ru: "Открыто", en: "Opened" },

  empty: { hy: "Գործեր չկան։", ru: "Дел нет.", en: "No cases." },
  loading: { hy: "Բեռնվում է…", ru: "Загрузка…", en: "Loading…" },
  showing: { hy: "Ցուցադրվում է", ru: "Показано", en: "Showing" },
  of: { hy: "ընդ․", ru: "из", en: "of" },
  prev: { hy: "Նախորդ", ru: "Назад", en: "Prev" },
  next: { hy: "Հաջորդ", ru: "Вперёд", en: "Next" },

  // SLA chip
  overdue: { hy: "Ժամկետանց", ru: "Просрочено", en: "Overdue" },
  escalated: { hy: "Սրված", ru: "Эскалировано", en: "Escalated" },
  left: { hy: "մնաց", ru: "осталось", en: "left" },

  // drawer
  caseDetails: { hy: "Գործի մանրամասներ", ru: "Детали дела", en: "Case details" },
  description: { hy: "Նկարագրություն", ru: "Описание", en: "Description" },
  openedBy: { hy: "Բացել է", ru: "Открыл", en: "Opened by" },
  assignedTo: { hy: "Պատասխանատու", ru: "Ответственный", en: "Assigned to" },
  openedAt: { hy: "Բացման ժամ", ru: "Время открытия", en: "Opened at" },
  closedAt: { hy: "Փակման ժամ", ru: "Время закрытия", en: "Closed at" },
  company: { hy: "Ընկերություն", ru: "Компания", en: "Company" },
  slaDue: { hy: "SLA ժամկետ", ru: "Срок SLA", en: "SLA due" },

  statusAndPriority: { hy: "Կարգավիճակ և առաջնահերթություն", ru: "Статус и приоритет", en: "Status & priority" },
  priorityHint: {
    hy: "Առաջնահերթության փոփոխությունը վերահաշվարկում է SLA ժամկետը։",
    ru: "Изменение приоритета пересчитывает окно SLA.",
    en: "Changing priority re-anchors the SLA window.",
  },
  reassignLabel: { hy: "Պատասխանատու (օգտատիրոջ ID)", ru: "Ответственный (ID пользователя)", en: "Assigned to (user ID)" },
  closingNotes: { hy: "Փակման նշումներ", ru: "Заметки о закрытии", en: "Closing notes" },
  closingNotesPh: {
    hy: "Անհրաժեշտ համատեքստ լուծելիս կամ փակելիս…",
    ru: "Контекст при решении или закрытии…",
    en: "Required context when resolving or closing…",
  },
  closingNotesHint: { hy: "Առավելագույնը 5000 նիշ։", ru: "Максимум 5000 символов.", en: "Max 5,000 characters." },

  conversation: { hy: "Նամակագրություն", ru: "Переписка", en: "Conversation" },
  noReplies: { hy: "Դեռ պատասխաններ չկան։", ru: "Ответов пока нет.", en: "No replies yet." },
  internal: { hy: "Ներքին", ru: "Внутр.", en: "Internal" },
  publicReply: { hy: "Հրապարակային պատասխան", ru: "Публичный ответ", en: "Public reply" },
  internalNote: { hy: "Ներքին նշում", ru: "Внутренняя заметка", en: "Internal note" },
  replyPh: {
    hy: "Գրիր պատասխան… (առավելագույնը 10000 նիշ)",
    ru: "Напишите ответ… (макс. 10 000 символов)",
    en: "Write a reply… (max 10,000 chars)",
  },
  reopenNote: {
    hy: "Փակված գործում գրառումը նորից բացում է այն։",
    ru: "Сообщение в закрытом деле снова откроет его.",
    en: "Posting on a closed case re-opens it.",
  },
  sendReply: { hy: "Ուղարկել պատասխան", ru: "Отправить ответ", en: "Send reply" },
  sending: { hy: "Ուղարկվում է…", ru: "Отправка…", en: "Sending…" },
  close: { hy: "Փակել", ru: "Закрыть", en: "Close" },

  // compose modal
  fldTitle: { hy: "Վերնագիր", ru: "Заголовок", en: "Title" },
  fldDescription: { hy: "Նկարագրություն", ru: "Описание", en: "Description" },
  fldPriority: { hy: "Առաջնահերթություն", ru: "Приоритет", en: "Priority" },
  fldCompanyId: { hy: "Ընկերության ID", ru: "ID компании", en: "Company ID" },
  fldAssignee: { hy: "Պատասխանատու (օգտատիրոջ ID)", ru: "Ответственный (ID пользователя)", en: "Assignee (user ID)" },
  optional: { hy: "ոչ պարտադիր", ru: "необязательно", en: "optional" },
  create: { hy: "Ստեղծել", ru: "Создать", en: "Create" },
  creating: { hy: "Ստեղծվում է…", ru: "Создание…", en: "Creating…" },
  cancel: { hy: "Չեղարկել", ru: "Отмена", en: "Cancel" },

  // confirms
  confirmReopenTitle: { hy: "Նորից բացե՞լ գործը", ru: "Снова открыть дело?", en: "Re-open case?" },
  confirmReopenMsg: {
    hy: "Այս գործը փակ է — պատասխանը նորից կբացի այն։ Շարունակե՞լ։",
    ru: "Это дело закрыто — ответ снова откроет его. Продолжить?",
    en: "This case is closed — replying will re-open it. Continue?",
  },

  // errors
  errTitleAndDesc: {
    hy: "Վերնագիրն ու նկարագրությունը պարտադիր են։",
    ru: "Заголовок и описание обязательны.",
    en: "Title and description are required.",
  },
  errLoad: { hy: "Չհաջողվեց բեռնել գործերը։", ru: "Не удалось загрузить дела.", en: "Failed to load cases." },
  errReplies: { hy: "Չհաջողվեց բեռնել պատասխանները։", ru: "Не удалось загрузить ответы.", en: "Failed to load replies." },
  errCreate: { hy: "Չհաջողվեց ստեղծել գործը։", ru: "Не удалось создать дело.", en: "Failed to create case." },
  errUpdate: { hy: "Չհաջողվեց թարմացնել գործը։", ru: "Не удалось обновить дело.", en: "Failed to update case." },
  errReply: { hy: "Չհաջողվեց ուղարկել պատասխանը։", ru: "Не удалось отправить ответ.", en: "Failed to send reply." },
} satisfies Record<string, L>;

const STATUS_LABEL: Record<CaseStatus, L> = {
  open: T.stOpen,
  in_progress: T.stInProgress,
  pending_customer: T.stPendingCustomer,
  resolved: T.stResolved,
  closed: T.stClosed,
  escalated: T.stEscalated,
};

const PRIORITY_LABEL: Record<Priority, L> = {
  low: T.prLow,
  normal: T.prNormal,
  high: T.prHigh,
  urgent: T.prUrgent,
};

/**
 * Status badge tone per the mockup:
 *   open → gray, in_progress/pending_customer → warning,
 *   resolved/closed → success, escalated → danger.
 */
function statusBadgeCls(s: CaseStatus): string {
  switch (s) {
    case "open":
      return "badge-gray";
    case "in_progress":
    case "pending_customer":
      return "badge-warning";
    case "resolved":
    case "closed":
      return "badge-success";
    case "escalated":
      return "badge-danger";
  }
}

/** Priority badge tone: urgent/high → danger/warning, normal/low → gray. */
function priorityBadgeCls(p: Priority): string {
  switch (p) {
    case "urgent":
      return "badge-danger";
    case "high":
      return "badge-warning";
    case "normal":
    case "low":
      return "badge-gray";
  }
}

/** Deterministic bubble-avatar tone, mirroring the mockup's rotating tints. */
function bubbleTone(id: number): string {
  const tones = ["", "tone-teal", "tone-amber", "tone-blue"];
  return tones[Math.abs(id) % tones.length] ?? "";
}

function initials(name: string | null | undefined): string {
  return (
    (name ?? "")
      .trim()
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/**
 * SLA chip descriptor for a row: escalated/overdue → `.over`, else `.warn`
 * when under 60 minutes remain, else `.ok`. Returns null for closed cases or
 * when the API omitted `sla_remaining_minutes`.
 */
function slaChip(
  row: CaseRow,
  lang: string,
): { cls: "ok" | "warn" | "over"; icon: string; label: string } | null {
  if (row.closed_at) return null;
  if (row.escalated_at) {
    return { cls: "over", icon: "ti-clock-exclamation", label: pick(lang, T.escalated) };
  }
  const m = row.sla_remaining_minutes;
  if (m === null || m === undefined) return null;
  if (m < 0) {
    const oh = Math.floor(Math.abs(m) / 60);
    const om = Math.abs(m) % 60;
    return { cls: "over", icon: "ti-clock-exclamation", label: `${pick(lang, T.overdue)} ${oh}h ${om}m` };
  }
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  const cls: "ok" | "warn" = m < 60 ? "warn" : "ok";
  return { cls, icon: "ti-clock", label: `${hours}h ${mins.toString().padStart(2, "0")}m ${pick(lang, T.left)}` };
}

type CaseListResult = ApiSuccessEnvelope<CaseRow[]> & { meta: ApiListMeta };

/** Build + download a CSV from the rendered rows (client-side). */
function exportRows(rows: CaseRow[]): void {
  const headers = [
    "id",
    "case_number",
    "title",
    "status",
    "priority",
    "company_name",
    "assigned_to",
    "opened_by",
    "opened_at",
    "closed_at",
    "sla_due_at",
  ];
  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.case_number,
        r.title,
        r.status,
        r.priority,
        r.company_name ?? "",
        r.assigned_to?.name ?? "",
        r.opened_by?.name ?? "",
        r.opened_at ?? "",
        r.closed_at ?? "",
        r.sla_due_at ?? "",
      ]
        .map(escape)
        .join(","),
    ),
  ];
  const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cases-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CasesPane() {
  const { token, user } = useAdminAuth();
  const { lang } = useLanguage();
  const confirm = useConfirm();

  const allowed = canAccessOperatorToolsNav(user) || canAccessPlatformAdminNav(user);
  const isStaff = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<CaseRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  // filter inputs (draft) vs applied (drives the request)
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");

  // detail drawer
  const [selected, setSelected] = useState<CaseRow | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyVisibility, setReplyVisibility] = useState<"public" | "internal">("public");
  const [replySending, setReplySending] = useState(false);

  // compose modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({
    title: "",
    description: "",
    priority: "normal" as Priority,
    company_id: "",
    assigned_to_user_id: "",
  });

  // Ref of latest rows so the (stable) export handler always sees current data.
  const rowsRef = useRef<CaseRow[]>([]);
  rowsRef.current = rows;

  const statusLabel = useCallback((s: CaseStatus) => pick(lang, STATUS_LABEL[s]), [lang]);
  const priorityLabel = useCallback((p: Priority) => pick(lang, PRIORITY_LABEL[p]), [lang]);

  // ── data load ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setLoading(true);
    setErr(null);
    setForbidden(false);
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("per_page", String(PER_PAGE));
      if (statusFilter) q.set("status", statusFilter);
      if (priorityFilter) q.set("priority", priorityFilter);
      if (search.trim()) q.set("search", search.trim());
      const res = await apiFetchJson<CaseListResult>(`/cases?${q.toString()}`, { method: "GET", token });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : pick(lang, T.errLoad));
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, statusFilter, priorityFilter, search, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── replies for the open case ──────────────────────────────────────────────
  const loadReplies = useCallback(
    async (caseId: number) => {
      if (!token) return;
      try {
        const res = await apiFetchJson<ApiSuccessEnvelope<Reply[]>>(`/cases/${caseId}/replies`, {
          method: "GET",
          token,
        });
        setReplies(res.data);
      } catch (e) {
        if (!(e instanceof ApiRequestError && e.status === 403)) {
          setErr(e instanceof ApiRequestError ? e.message : pick(lang, T.errReplies));
        }
        setReplies([]);
      }
    },
    [token, lang],
  );

  useEffect(() => {
    if (selected) {
      void loadReplies(selected.id);
    } else {
      setReplies([]);
      setReplyDraft("");
      setReplyVisibility("public");
    }
  }, [selected, loadReplies]);

  // ── filters ────────────────────────────────────────────────────────────────
  function applyFilters() {
    setSearch(searchDraft.trim());
    setPage(1);
  }

  // ── send reply (re-opens a closed case) ────────────────────────────────────
  const sendReply = useCallback(async () => {
    if (!token || !selected) return;
    const body = replyDraft.trim();
    if (!body) return;

    // Confirm before re-opening an already-closed case.
    if (selected.closed_at) {
      const ok = await confirm({
        title: pick(lang, T.confirmReopenTitle),
        message: pick(lang, T.confirmReopenMsg),
      });
      if (!ok) return;
    }

    setReplySending(true);
    setErr(null);
    try {
      await apiFetchJson(`/cases/${selected.id}/replies`, {
        method: "POST",
        token,
        body: { body, visibility: replyVisibility },
      });
      setReplyDraft("");
      await loadReplies(selected.id);
      // Posting may have reopened a closed case; refresh list + open case.
      await load();
      const res = await apiFetchJson<ApiSuccessEnvelope<CaseRow>>(`/cases/${selected.id}`, {
        method: "GET",
        token,
      });
      setSelected(res.data);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : pick(lang, T.errReply));
    } finally {
      setReplySending(false);
    }
  }, [token, selected, replyDraft, replyVisibility, confirm, lang, loadReplies, load]);

  // ── create case ────────────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (!token) return;
    setErr(null);
    if (!compose.title.trim() || !compose.description.trim()) {
      setErr(pick(lang, T.errTitleAndDesc));
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        title: compose.title.trim(),
        description: compose.description.trim(),
        priority: compose.priority,
      };
      if (compose.company_id.trim()) body.company_id = Number(compose.company_id);
      if (compose.assigned_to_user_id.trim()) body.assigned_to_user_id = Number(compose.assigned_to_user_id);
      await apiFetchJson(`/cases`, { method: "POST", token, body });
      setComposeOpen(false);
      setCompose({
        title: "",
        description: "",
        priority: "normal",
        company_id: "",
        assigned_to_user_id: "",
      });
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : pick(lang, T.errCreate));
    } finally {
      setBusy(false);
    }
  }, [token, compose, lang, load]);

  // ── patch case (status / priority / assignee / closing notes) ──────────────
  const patchCase = useCallback(
    async (id: number, patch: Record<string, unknown>) => {
      if (!token) return;
      setBusy(true);
      setErr(null);
      try {
        await apiFetchJson(`/cases/${id}`, { method: "PATCH", token, body: patch });
        await load();
        // Re-fetch the open case so the drawer reflects re-anchored SLA / closed_at.
        if (selected?.id === id) {
          const res = await apiFetchJson<ApiSuccessEnvelope<CaseRow>>(`/cases/${id}`, {
            method: "GET",
            token,
          });
          setSelected(res.data);
        }
      } catch (e) {
        setErr(e instanceof ApiRequestError ? e.message : pick(lang, T.errUpdate));
      } finally {
        setBusy(false);
      }
    },
    [token, selected, lang, load],
  );

  // ── staff gate (early return) ──────────────────────────────────────────────
  if (!allowed || forbidden) {
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

  const firstIdx = meta ? (meta.current_page - 1) * meta.per_page + 1 : 0;
  const lastIdx = meta ? Math.min(meta.current_page * meta.per_page, meta.total) : 0;

  return (
    <>
      {/* ── filters ── */}
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 1 }}>
          <span className="filter-label">{pick(lang, T.fltSearch)}</span>
          <input
            type="search"
            value={searchDraft}
            placeholder={pick(lang, T.searchPh)}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{pick(lang, T.fltStatus)}</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as CaseStatus | "");
              setPage(1);
            }}
          >
            <option value="">{pick(lang, T.allStatuses)}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{pick(lang, T.fltPriority)}</span>
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value as Priority | "");
              setPage(1);
            }}
          >
            <option value="">{pick(lang, T.all)}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {priorityLabel(p)}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={applyFilters} type="button">
          <i className="ti ti-filter" />
          {pick(lang, T.apply)}
        </button>
        <button className="btn btn-primary" onClick={() => setComposeOpen(true)} type="button">
          <i className="ti ti-plus" />
          {pick(lang, T.newCase)}
        </button>
      </div>

      {err && (
        <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}>
          <i className="ti ti-alert-circle" />
          <span>{err}</span>
        </div>
      )}

      {/* ── table ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">{pick(lang, T.cardTitle)}</div>
          <button
            className="btn btn-sm"
            disabled={rows.length === 0}
            onClick={() => exportRows(rowsRef.current)}
            type="button"
          >
            <i className="ti ti-download" />
            {pick(lang, T.exportCsv)}
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{pick(lang, T.colCaseNumber)}</th>
                <th>{pick(lang, T.colTitle)}</th>
                <th>{pick(lang, T.colStatus)}</th>
                <th>{pick(lang, T.colPriority)}</th>
                <th>{pick(lang, T.colSla)}</th>
                <th>{pick(lang, T.colAssigned)}</th>
                <th>{pick(lang, T.colOpened)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                    {loading ? pick(lang, T.loading) : pick(lang, T.empty)}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const sla = slaChip(r, lang);
                  const assignedName = r.assigned_to?.name ?? null;
                  return (
                    <tr key={r.id} onClick={() => setSelected(r)} style={{ cursor: "pointer" }}>
                      <td className="font-mono">{r.case_number}</td>
                      <td>
                        <span className="truncate" style={{ maxWidth: 280 }}>
                          {r.title}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${statusBadgeCls(r.status)}`}>{statusLabel(r.status)}</span>
                      </td>
                      <td>
                        <span className={`badge ${priorityBadgeCls(r.priority)}`}>{priorityLabel(r.priority)}</span>
                      </td>
                      <td>
                        {sla ? (
                          <span className={`sla-chip ${sla.cls}`}>
                            <i className={`ti ${sla.icon}`} />
                            {sla.label}
                          </span>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                      <td>
                        {assignedName ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className={`avatar sm ${bubbleTone(r.id).replace("tone-", "avatar-")}`}>
                              {initials(assignedName)}
                            </span>
                            {assignedName}
                          </div>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                      <td className="cell-muted" title={formatDateTime(r.opened_at, lang)}>
                        {formatDateTime(r.opened_at, lang)}
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
              {pick(lang, T.showing)} {firstIdx}–{lastIdx} {pick(lang, T.of)} {meta.total}
            </span>
            <div className="pagination-controls">
              <button
                className="btn btn-sm"
                disabled={meta.current_page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                {pick(lang, T.prev)}
              </button>
              <button className="btn btn-sm btn-primary" type="button">
                {meta.current_page}
              </button>
              <button
                className="btn btn-sm"
                disabled={meta.current_page >= meta.last_page || loading}
                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                type="button"
              >
                {pick(lang, T.next)}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── case detail drawer ── */}
      <div className={`drawer-overlay ${selected ? "open" : ""}`} onClick={() => setSelected(null)} />
      <div className={`drawer ${selected ? "open" : ""}`}>
        {selected && (
          <>
            <div className="drawer-header">
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    fontFamily: "ui-monospace,SFMono-Regular,monospace",
                  }}
                >
                  {selected.case_number}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{selected.title}</div>
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className={`badge ${statusBadgeCls(selected.status)}`}>{statusLabel(selected.status)}</span>
                  <span className={`badge ${priorityBadgeCls(selected.priority)}`}>
                    {priorityLabel(selected.priority)}
                  </span>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)} type="button">
                <i className="ti ti-x" />
              </button>
            </div>

            <div className="drawer-body">
              <div className="drawer-section">{pick(lang, T.caseDetails)}</div>
              <div className="info-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="info-row" style={{ gridTemplateColumns: "1fr", border: "none", padding: 0 }}>
                  <div className="info-label">{pick(lang, T.openedBy)}</div>
                  <div className="info-value">{selected.opened_by?.name ?? "—"}</div>
                </div>
                <div className="info-row" style={{ gridTemplateColumns: "1fr", border: "none", padding: 0 }}>
                  <div className="info-label">{pick(lang, T.assignedTo)}</div>
                  <div className="info-value">{selected.assigned_to?.name ?? "—"}</div>
                </div>
                <div className="info-row" style={{ gridTemplateColumns: "1fr", border: "none", padding: 0 }}>
                  <div className="info-label">{pick(lang, T.openedAt)}</div>
                  <div className="info-value">{formatDateTime(selected.opened_at, lang)}</div>
                </div>
                <div className="info-row" style={{ gridTemplateColumns: "1fr", border: "none", padding: 0 }}>
                  <div className="info-label">{pick(lang, T.closedAt)}</div>
                  <div className="info-value">{selected.closed_at ? formatDateTime(selected.closed_at, lang) : "—"}</div>
                </div>
                <div className="info-row" style={{ gridTemplateColumns: "1fr", border: "none", padding: 0 }}>
                  <div className="info-label">{pick(lang, T.company)}</div>
                  <div className="info-value">{selected.company_name ?? "—"}</div>
                </div>
                <div className="info-row" style={{ gridTemplateColumns: "1fr", border: "none", padding: 0 }}>
                  <div className="info-label">{pick(lang, T.slaDue)}</div>
                  <div className="info-value" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {selected.sla_due_at ? formatDateTime(selected.sla_due_at, lang) : "—"}
                    {(() => {
                      const chip = slaChip(selected, lang);
                      return chip ? (
                        <span className={`sla-chip ${chip.cls}`}>
                          <i className={`ti ${chip.icon}`} />
                          {chip.label}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              <div className="drawer-section">{pick(lang, T.description)}</div>
              <div className="opener-msg">
                <div className="om-body">{selected.description}</div>
              </div>

              <div className="drawer-section">{pick(lang, T.statusAndPriority)}</div>
              <div className="form-grid">
                <div className="fld">
                  <label className="fld-label">{pick(lang, T.fltStatus)}</label>
                  <select
                    value={selected.status}
                    disabled={busy}
                    onChange={(e) => void patchCase(selected.id, { status: e.target.value })}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fld">
                  <label className="fld-label">{pick(lang, T.fltPriority)}</label>
                  <select
                    value={selected.priority}
                    disabled={busy}
                    onChange={(e) => void patchCase(selected.id, { priority: e.target.value })}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {priorityLabel(p)}
                      </option>
                    ))}
                  </select>
                  <div className="fld-hint">{pick(lang, T.priorityHint)}</div>
                </div>
                <div className="fld span-2">
                  <label className="fld-label">{pick(lang, T.reassignLabel)}</label>
                  <input
                    type="number"
                    min={1}
                    defaultValue={selected.assigned_to?.id ?? ""}
                    disabled={busy}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      void patchCase(selected.id, { assigned_to_user_id: v ? Number(v) : null });
                    }}
                  />
                </div>
                <div className="fld span-2">
                  <label className="fld-label">{pick(lang, T.closingNotes)}</label>
                  <textarea
                    defaultValue={selected.closing_notes ?? ""}
                    maxLength={5000}
                    placeholder={pick(lang, T.closingNotesPh)}
                    style={{ minHeight: 64 }}
                    disabled={busy}
                    onBlur={(e) => void patchCase(selected.id, { closing_notes: e.target.value.trim() || null })}
                  />
                  <div className="fld-hint">{pick(lang, T.closingNotesHint)}</div>
                </div>
              </div>

              <div className="drawer-section">{pick(lang, T.conversation)}</div>
              <div className="thread">
                <div className="opener-msg">
                  <div className="om-label">
                    {pick(lang, T.openedBy)} {selected.opened_by?.name ?? "—"}
                    {selected.opened_at ? ` · ${formatDateTime(selected.opened_at, lang)}` : ""}
                  </div>
                  <div className="om-body">{selected.description}</div>
                </div>
                {replies.length === 0 ? (
                  <div className="thread-empty">{pick(lang, T.noReplies)}</div>
                ) : (
                  replies.map((reply) => {
                    const isStaffReply = reply.user?.id != null && reply.user.id === selected.assigned_to?.id;
                    const isInternal = reply.visibility === "internal";
                    const cls = ["bubble", isInternal || isStaffReply ? "staff" : "", isInternal ? "internal" : ""]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <div key={reply.id} className={cls}>
                        <div className={`b-avatar ${bubbleTone(reply.user?.id ?? reply.id)}`}>
                          {initials(reply.user?.name)}
                        </div>
                        <div className="b-wrap">
                          <div className="b-head">
                            {isInternal && <span className="b-int-tag">{pick(lang, T.internal)}</span>}
                            <span className="b-name">{reply.user?.name ?? "—"}</span>
                            <span title={formatDateTime(reply.created_at, lang)}>
                              {formatDateTime(reply.created_at, lang)}
                            </span>
                          </div>
                          <div className="b-body">{reply.body}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="composer">
                {isStaff && (
                  <div className="lang-seg" style={{ marginBottom: 8 }}>
                    <button
                      type="button"
                      className={replyVisibility === "public" ? "active" : ""}
                      onClick={() => setReplyVisibility("public")}
                    >
                      {pick(lang, T.publicReply)}
                    </button>
                    <button
                      type="button"
                      className={replyVisibility === "internal" ? "active" : ""}
                      onClick={() => setReplyVisibility("internal")}
                    >
                      {pick(lang, T.internalNote)}
                    </button>
                  </div>
                )}
                <textarea
                  value={replyDraft}
                  maxLength={10000}
                  placeholder={pick(lang, T.replyPh)}
                  onChange={(e) => setReplyDraft(e.target.value)}
                />
                <div className="composer-bar">
                  <span className="scope-note">
                    <i className="ti ti-info-circle" />
                    {pick(lang, T.reopenNote)}
                  </span>
                  <span className="spacer" />
                  <button
                    className="btn btn-primary"
                    disabled={replySending || !replyDraft.trim()}
                    onClick={() => void sendReply()}
                    type="button"
                  >
                    <i className="ti ti-send" />
                    {replySending ? pick(lang, T.sending) : pick(lang, T.sendReply)}
                  </button>
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <button className="btn" onClick={() => setSelected(null)} type="button">
                {pick(lang, T.close)}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── new-case modal ── */}
      <div className={`modal-overlay ${composeOpen ? "open" : ""}`}>
        <div className="modal" style={{ width: 560 }}>
          <div className="modal-header">
            <div className="modal-title">{pick(lang, T.newCase)}</div>
            <button className="icon-btn" onClick={() => setComposeOpen(false)} type="button">
              <i className="ti ti-x" />
            </button>
          </div>
          <div className="modal-body">
            <div className="form-grid">
              <div className="fld span-2">
                <label className="fld-label">
                  {pick(lang, T.fldTitle)} <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={compose.title}
                  onChange={(e) => setCompose((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="fld span-2">
                <label className="fld-label">
                  {pick(lang, T.fldDescription)} <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <textarea
                  value={compose.description}
                  style={{ minHeight: 96 }}
                  onChange={(e) => setCompose((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="fld">
                <label className="fld-label">{pick(lang, T.fldPriority)}</label>
                <select
                  value={compose.priority}
                  onChange={(e) => setCompose((p) => ({ ...p, priority: e.target.value as Priority }))}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {priorityLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label className="fld-label">
                  {pick(lang, T.fldCompanyId)}{" "}
                  <span className="fld-hint" style={{ display: "inline" }}>
                    {pick(lang, T.optional)}
                  </span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={compose.company_id}
                  onChange={(e) => setCompose((p) => ({ ...p, company_id: e.target.value }))}
                />
              </div>
              <div className="fld span-2">
                <label className="fld-label">
                  {pick(lang, T.fldAssignee)}{" "}
                  <span className="fld-hint" style={{ display: "inline" }}>
                    {pick(lang, T.optional)}
                  </span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={compose.assigned_to_user_id}
                  onChange={(e) => setCompose((p) => ({ ...p, assigned_to_user_id: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setComposeOpen(false)} type="button">
              {pick(lang, T.cancel)}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void handleCreate()} type="button">
              <i className="ti ti-check" />
              {busy ? pick(lang, T.creating) : pick(lang, T.create)}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
