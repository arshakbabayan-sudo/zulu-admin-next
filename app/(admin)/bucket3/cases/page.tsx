"use client";

/**
 * Phase 7.10 — Cases & Assignments.
 *
 * Replaces the ComingSoonPage placeholder. Advanced case management:
 * priority, assigned officer, structured statuses, opened/closed audit.
 * SLA timers + escalation rules are follow-ups.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessOperatorToolsNav, canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
import { formatDateTime } from "@/lib/format";
import {
  ActiveFiltersChips,
  Button,
  Drawer,
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
} from "@/components/ui/v2";
import { useDebounce } from "@/hooks/useDebounce";
import { useCallback, useEffect, useState } from "react";

const STATUSES = ["open", "in_progress", "pending_customer", "resolved", "closed", "escalated"] as const;
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

function formatSlaChip(row: CaseRow): { label: string; tone: "neutral" | "success" | "warning" | "danger" } | null {
  if (row.closed_at) return null;
  if (row.escalated_at) {
    return { label: "Escalated", tone: "danger" };
  }
  const m = row.sla_remaining_minutes;
  if (m === null || m === undefined) return null;
  if (m < 0) {
    const overdueH = Math.floor(Math.abs(m) / 60);
    const overdueM = Math.abs(m) % 60;
    return { label: `Overdue ${overdueH}h ${overdueM}m`, tone: "danger" };
  }
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  const tone: "neutral" | "warning" | "success" = m < 60 ? "warning" : "success";
  return { label: `${hours}h ${mins.toString().padStart(2, "0")}m left`, tone };
}

type Reply = {
  id: number;
  case_id: number;
  user: { id: number; name: string; email: string } | null;
  body: string;
  visibility: "public" | "internal";
  attachments: unknown;
  created_at: string | null;
};

function priorityTier(p: Priority): "neutral" | "info" | "warning" | "danger" {
  switch (p) {
    case "low":
      return "neutral";
    case "normal":
      return "info";
    case "high":
      return "warning";
    case "urgent":
      return "danger";
  }
}

function statusTier(s: CaseStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (s) {
    case "open":
      return "info";
    case "in_progress":
      return "warning";
    case "pending_customer":
      return "neutral";
    case "resolved":
    case "closed":
      return "success";
    case "escalated":
      return "danger";
  }
}

async function fetchCases(
  token: string,
  page: number,
  filters: { status: CaseStatus | ""; priority: Priority | ""; search: string }
): Promise<ApiSuccessEnvelope<CaseRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", "25");
  if (filters.status) q.set("status", filters.status);
  if (filters.priority) q.set("priority", filters.priority);
  if (filters.search) q.set("search", filters.search);
  return apiFetchJson(`/cases?${q.toString()}`, { method: "GET", token });
}

export default function Bucket3CasesPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  useDocumentTitle(t("admin.bucket3.cases.title"));
  const allowed = canAccessOperatorToolsNav(user) || canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebounce(searchDraft, 300);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<CaseRow | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyDraft, setReplyDraft] = useState("");
  const [replySending, setReplySending] = useState(false);
  const isStaff = canAccessPlatformAdminNav(user);
  const [compose, setCompose] = useState({
    title: "",
    description: "",
    priority: "normal" as Priority,
    company_id: "",
    assigned_to_user_id: "",
  });

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await fetchCases(token, page, {
        status: statusFilter,
        priority: priorityFilter,
        search: search.trim(),
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load cases");
    }
  }, [token, allowed, page, statusFilter, priorityFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

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
          setErr(e instanceof ApiRequestError ? e.message : "Failed to load replies");
        }
        setReplies([]);
      }
    },
    [token]
  );

  useEffect(() => {
    if (selected) {
      void loadReplies(selected.id);
    } else {
      setReplies([]);
      setReplyDraft("");
    }
  }, [selected, loadReplies]);

  async function sendReply(visibility: "public" | "internal") {
    if (!token || !selected) return;
    const body = replyDraft.trim();
    if (!body) return;
    setReplySending(true);
    try {
      await apiFetchJson(`/cases/${selected.id}/replies`, {
        method: "POST",
        token,
        body: { body, visibility },
      });
      setReplyDraft("");
      await loadReplies(selected.id);
      // Posting may have reopened a closed case; refresh the list silently.
      void load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Reply failed");
    } finally {
      setReplySending(false);
    }
  }

  async function handleCreate() {
    if (!token) return;
    setErr(null);
    if (!compose.title.trim() || !compose.description.trim()) {
      setErr(t("admin.bucket3.cases.error.title_and_description"));
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
      setErr(e instanceof ApiRequestError ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function patchCase(id: number, body: Record<string, unknown>) {
    if (!token) return;
    setBusy(true);
    try {
      await apiFetchJson(`/cases/${id}`, { method: "PATCH", token, body });
      await load();
      // Re-fetch the selected case to refresh modal view.
      if (selected?.id === id) {
        const res = await apiFetchJson<ApiSuccessEnvelope<CaseRow>>(`/cases/${id}`, {
          method: "GET",
          token,
        });
        setSelected(res.data);
      }
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.bucket3.cases.title")}</h1>
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
          { label: "My company", href: "/bucket3/employees" },
          { label: t("admin.bucket3.cases.title") },
        ]}
        title={t("admin.bucket3.cases.title")}
        subtitle={
          meta
            ? t("admin.bucket3.cases.subtitle_count").replace("{count}", String(meta.total))
            : t("admin.bucket3.cases.subtitle")
        }
        actions={
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            {t("admin.bucket3.cases.new_case")}
          </Button>
        }
      />

      <SectionTabs
        activeHref="/bucket3/cases"
        items={[
          { href: "/bucket3/employees", label: "Employees" },
          { href: "/bucket3/payroll", label: "Payroll" },
          { href: "/bucket3/non-service-hours", label: "Non-service hours" },
          { href: "/bucket3/cases", label: "Cases", count: meta?.total },
          { href: "/bucket3/bulk-notifications", label: "Bulk notifications" },
          { href: "/bucket3/pin-settings", label: "PIN settings" },
          { href: "/bucket3/customers", label: "Customers" },
          { href: "/bucket3/subscriptions", label: "Subscriptions" },
          { href: "/bucket3/per-x-invoicing", label: "Per-X invoicing" },
        ]}
      />

      <div className="space-y-6">
      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <div className="admin-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => {
                setSearchDraft(e.target.value);
                setPage(1);
              }}
              placeholder={t("admin.bucket3.cases.search_placeholder")}
              className="h-10 w-full rounded-zulu border border-default bg-white px-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">{t("admin.bucket3.cases.filter.status")}</span>
            <Select
              fieldSize="sm"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value as CaseStatus | "");
              }}
              className="!w-auto min-w-[160px]"
            >
              <option value="">{t("common.all")}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">{t("admin.bucket3.cases.filter.priority")}</span>
            <Select
              fieldSize="sm"
              value={priorityFilter}
              onChange={(e) => {
                setPage(1);
                setPriorityFilter(e.target.value as Priority | "");
              }}
              className="!w-auto min-w-[140px]"
            >
              <option value="">{t("common.all")}</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <ActiveFiltersChips
          filters={[
            {
              key: "search",
              label: "Search",
              value: searchDraft,
              onRemove: () => setSearchDraft(""),
            },
            {
              key: "status",
              label: "Status",
              value: statusFilter,
              onRemove: () => setStatusFilter(""),
            },
            {
              key: "priority",
              label: "Priority",
              value: priorityFilter,
              onRemove: () => setPriorityFilter(""),
            },
          ]}
          onClearAll={() => {
            setSearchDraft("");
            setStatusFilter("");
            setPriorityFilter("");
            setPage(1);
          }}
        />
      </div>

      <Table>
        <THead>
          <TR>
            <TH>{t("admin.bucket3.cases.col.case_number")}</TH>
            <TH>{t("admin.bucket3.cases.col.title")}</TH>
            <TH>{t("admin.bucket3.cases.col.status")}</TH>
            <TH>{t("admin.bucket3.cases.col.priority")}</TH>
            <TH>{t("admin.bucket3.cases.col.sla")}</TH>
            <TH>{t("admin.bucket3.cases.col.assigned")}</TH>
            <TH>{t("admin.bucket3.cases.col.opened")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={7}>{t("admin.bucket3.cases.empty")}</TEmpty>
          ) : null}
          {rows.map((r) => {
            const sla = formatSlaChip(r);
            return (
              <TR key={r.id} onClick={() => setSelected(r)}>
                <TD className="font-mono text-xs text-fg-t8">{r.case_number}</TD>
                <TD className="font-medium text-fg-t8 max-w-[280px] truncate">{r.title}</TD>
                <TD>
                  <StatusPill status={statusTier(r.status)}>{r.status}</StatusPill>
                </TD>
                <TD>
                  <StatusPill status={priorityTier(r.priority)}>{r.priority}</StatusPill>
                </TD>
                <TD>
                  {sla ? <StatusPill status={sla.tone}>{sla.label}</StatusPill> : <span className="text-xs text-fg-t6">—</span>}
                </TD>
                <TD className="text-xs text-fg-t7">{r.assigned_to?.name ?? "—"}</TD>
                <TD className="text-xs text-fg-t6">{formatDateTime(r.opened_at, lang)}</TD>
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

      {/* A5 — Detail drawer (was: full-screen modal) */}
      {selected && (
        <Drawer
          open
          onClose={() => setSelected(null)}
          size="xl"
          title={
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-fg-t6">{selected.case_number}</span>
              <span>{selected.title}</span>
            </div>
          }
          subtitle={
            <div className="flex gap-2">
              <StatusPill status={statusTier(selected.status)}>{selected.status}</StatusPill>
              <StatusPill status={priorityTier(selected.priority)}>{selected.priority}</StatusPill>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Legacy header content (StatusPill x2) moved into Drawer title/subtitle props above */}
            <p className="whitespace-pre-wrap rounded-zulu border border-default bg-figma-bg-1/50 p-3 text-sm text-fg-t8">
              {selected.description}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-fg-t6">{t("admin.bucket3.cases.label.opened_by")}</div>
                <div className="text-fg-t8">{selected.opened_by?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-fg-t6">{t("admin.bucket3.cases.label.assigned_to")}</div>
                <div className="text-fg-t8">{selected.assigned_to?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-fg-t6">{t("admin.bucket3.cases.label.opened_at")}</div>
                <div className="text-fg-t8">{formatDateTime(selected.opened_at, lang)}</div>
              </div>
              <div>
                <div className="text-fg-t6">{t("admin.bucket3.cases.label.closed_at")}</div>
                <div className="text-fg-t8">{formatDateTime(selected.closed_at, lang)}</div>
              </div>
              <div className="col-span-2">
                <div className="text-fg-t6">{t("admin.bucket3.cases.label.company")}</div>
                <div className="text-fg-t8">{selected.company_name ?? "—"}</div>
              </div>
            </div>
            <div className="space-y-2">
              <FormField label={t("admin.bucket3.cases.field.update_status")} htmlFor="case-status">
                <Select
                  id="case-status"
                  value={selected.status}
                  onChange={(e) => void patchCase(selected.id, { status: e.target.value })}
                  disabled={busy}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label={t("admin.bucket3.cases.field.update_priority")} htmlFor="case-priority">
                <Select
                  id="case-priority"
                  value={selected.priority}
                  onChange={(e) => void patchCase(selected.id, { priority: e.target.value })}
                  disabled={busy}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label={t("admin.bucket3.cases.field.reassign")} htmlFor="case-assign">
                <Input
                  id="case-assign"
                  type="number"
                  min={1}
                  defaultValue={selected.assigned_to?.id ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    void patchCase(selected.id, {
                      assigned_to_user_id: v ? Number(v) : null,
                    });
                  }}
                  disabled={busy}
                />
              </FormField>
              <FormField label={t("admin.bucket3.cases.field.closing_notes")} htmlFor="case-closing-notes">
                <Input
                  as="textarea"
                  id="case-closing-notes"
                  rows={3}
                  defaultValue={selected.closing_notes ?? ""}
                  onBlur={(e) => void patchCase(selected.id, { closing_notes: e.target.value.trim() || null })}
                  disabled={busy}
                />
              </FormField>
            </div>
            {/* Conversation thread */}
            <div className="space-y-2 border-t border-default pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-fg-t8">{t("admin.bucket3.cases.conversation")}</h3>
                <span className="text-xs text-fg-t6">{t("admin.bucket3.cases.replies_count").replace("{count}", String(replies.length))}</span>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-zulu border border-default bg-figma-bg-1/30 p-3">
                {replies.length === 0 ? (
                  <p className="text-xs text-fg-t6">{t("admin.bucket3.cases.no_replies")}</p>
                ) : (
                  replies.map((r) => (
                    <div
                      key={r.id}
                      className={`rounded-zulu p-2 text-xs ${
                        r.visibility === "internal"
                          ? "border border-warning-200 bg-warning-50"
                          : "border border-default bg-white"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="font-medium text-fg-t8">{r.user?.name ?? "Unknown"}</div>
                        <div className="flex items-center gap-2 text-fg-t6">
                          {r.visibility === "internal" && (
                            <span className="rounded bg-warning-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-900">
                              {t("admin.bucket3.cases.internal")}
                            </span>
                          )}
                          <span>{formatDateTime(r.created_at, lang)}</span>
                        </div>
                      </div>
                      <div className="whitespace-pre-wrap text-fg-t7">{r.body}</div>
                    </div>
                  ))
                )}
              </div>
              <FormField label={t("admin.bucket3.cases.field.reply")} htmlFor="case-reply-body">
                <Input
                  as="textarea"
                  id="case-reply-body"
                  rows={3}
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder={t("admin.bucket3.cases.field.reply_placeholder")}
                />
              </FormField>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={replySending || !replyDraft.trim()}
                  onClick={() => void sendReply("public")}
                >
                  {replySending ? t("admin.bucket3.cases.sending") : t("admin.bucket3.cases.send_reply")}
                </Button>
                {isStaff && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={replySending || !replyDraft.trim()}
                    onClick={() => void sendReply("internal")}
                  >
                    {t("admin.bucket3.cases.send_internal")}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                {t("admin.bucket3.cases.close")}
              </Button>
            </div>
          </div>
        </Drawer>
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
            <h2 className="text-lg font-semibold">{t("admin.bucket3.cases.new_case")}</h2>
            <FormField label={t("admin.bucket3.cases.field.title")} htmlFor="case-new-title" required>
              <Input
                id="case-new-title"
                value={compose.title}
                onChange={(e) => setCompose((p) => ({ ...p, title: e.target.value }))}
              />
            </FormField>
            <FormField label={t("admin.bucket3.cases.field.description")} htmlFor="case-new-desc" required>
              <Input
                as="textarea"
                id="case-new-desc"
                rows={5}
                value={compose.description}
                onChange={(e) => setCompose((p) => ({ ...p, description: e.target.value }))}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("admin.bucket3.cases.field.priority")} htmlFor="case-new-priority">
                <Select
                  id="case-new-priority"
                  value={compose.priority}
                  onChange={(e) => setCompose((p) => ({ ...p, priority: e.target.value as Priority }))}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label={t("admin.bucket3.cases.field.company_id")} htmlFor="case-new-company">
                <Input
                  id="case-new-company"
                  type="number"
                  min={1}
                  value={compose.company_id}
                  onChange={(e) => setCompose((p) => ({ ...p, company_id: e.target.value }))}
                />
              </FormField>
              <FormField
                label={t("admin.bucket3.cases.field.assignee")}
                htmlFor="case-new-assignee"
                className="sm:col-span-2"
              >
                <Input
                  id="case-new-assignee"
                  type="number"
                  min={1}
                  value={compose.assigned_to_user_id}
                  onChange={(e) => setCompose((p) => ({ ...p, assigned_to_user_id: e.target.value }))}
                />
              </FormField>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void handleCreate()}>
                {busy ? t("admin.bucket3.cases.creating") : t("admin.bucket3.cases.create")}
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
