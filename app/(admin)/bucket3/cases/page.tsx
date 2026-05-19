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
import { canAccessOperatorToolsNav, canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
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

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

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
  const allowed = canAccessOperatorToolsNav(user) || canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
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
      setErr("Title and description are required");
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
        <h1 className="admin-page-title">Cases &amp; Assignments</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cases & Assignments"
        subtitle={
          meta
            ? `${meta.total} cases · sorted urgent → low`
            : "Long-running issues with priority, owner, and structured status"
        }
        actions={
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            New case
          </Button>
        }
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setSearch(searchDraft.trim());
                }
              }}
              placeholder="Search by case number or title"
              className="h-9 w-full rounded-zulu border border-default bg-white px-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">Status</span>
            <Select
              fieldSize="sm"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value as CaseStatus | "");
              }}
              className="!w-auto min-w-[160px]"
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">Priority</span>
            <Select
              fieldSize="sm"
              value={priorityFilter}
              onChange={(e) => {
                setPage(1);
                setPriorityFilter(e.target.value as Priority | "");
              }}
              className="!w-auto min-w-[140px]"
            >
              <option value="">All</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Case #</TH>
            <TH>Title</TH>
            <TH>Status</TH>
            <TH>Priority</TH>
            <TH>Assigned</TH>
            <TH>Opened</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={6}>No cases match the filter.</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id} onClick={() => setSelected(r)}>
              <TD className="font-mono text-xs text-fg-t8">{r.case_number}</TD>
              <TD className="font-medium text-fg-t8 max-w-[280px] truncate">{r.title}</TD>
              <TD>
                <StatusPill status={statusTier(r.status)}>{r.status}</StatusPill>
              </TD>
              <TD>
                <StatusPill status={priorityTier(r.priority)}>{r.priority}</StatusPill>
              </TD>
              <TD className="text-xs text-fg-t7">{r.assigned_to?.name ?? "—"}</TD>
              <TD className="text-xs text-fg-t6">{formatDate(r.opened_at)}</TD>
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

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="my-12 w-full max-w-2xl rounded-zulu bg-white p-6 shadow-zulu-card space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-fg-t6">{selected.case_number}</div>
                <h2 className="text-lg font-semibold">{selected.title}</h2>
              </div>
              <div className="flex gap-2">
                <StatusPill status={statusTier(selected.status)}>{selected.status}</StatusPill>
                <StatusPill status={priorityTier(selected.priority)}>{selected.priority}</StatusPill>
              </div>
            </div>
            <p className="whitespace-pre-wrap rounded-zulu border border-default bg-figma-bg-1/50 p-3 text-sm text-fg-t8">
              {selected.description}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-fg-t6">Opened by</div>
                <div className="text-fg-t8">{selected.opened_by?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-fg-t6">Assigned to</div>
                <div className="text-fg-t8">{selected.assigned_to?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-fg-t6">Opened at</div>
                <div className="text-fg-t8">{formatDate(selected.opened_at)}</div>
              </div>
              <div>
                <div className="text-fg-t6">Closed at</div>
                <div className="text-fg-t8">{formatDate(selected.closed_at)}</div>
              </div>
              <div className="col-span-2">
                <div className="text-fg-t6">Company</div>
                <div className="text-fg-t8">{selected.company_name ?? "—"}</div>
              </div>
            </div>
            <div className="space-y-2">
              <FormField label="Update status" htmlFor="case-status">
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
              <FormField label="Update priority" htmlFor="case-priority">
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
              <FormField label="Reassign (user id)" htmlFor="case-assign">
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
              <FormField label="Closing notes" htmlFor="case-closing-notes">
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
                <h3 className="text-sm font-semibold text-fg-t8">Conversation</h3>
                <span className="text-xs text-fg-t6">{replies.length} message{replies.length === 1 ? "" : "s"}</span>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-zulu border border-default bg-figma-bg-1/30 p-3">
                {replies.length === 0 ? (
                  <p className="text-xs text-fg-t6">No replies yet. Start the conversation below.</p>
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
                              Internal
                            </span>
                          )}
                          <span>{formatDate(r.created_at)}</span>
                        </div>
                      </div>
                      <div className="whitespace-pre-wrap text-fg-t7">{r.body}</div>
                    </div>
                  ))
                )}
              </div>
              <FormField label="Reply" htmlFor="case-reply-body">
                <Input
                  as="textarea"
                  id="case-reply-body"
                  rows={3}
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder="Type your reply…"
                />
              </FormField>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={replySending || !replyDraft.trim()}
                  onClick={() => void sendReply("public")}
                >
                  {replySending ? "Sending…" : "Send reply"}
                </Button>
                {isStaff && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={replySending || !replyDraft.trim()}
                    onClick={() => void sendReply("internal")}
                  >
                    Send internal note
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
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
            <h2 className="text-lg font-semibold">New case</h2>
            <FormField label="Title" htmlFor="case-new-title" required>
              <Input
                id="case-new-title"
                value={compose.title}
                onChange={(e) => setCompose((p) => ({ ...p, title: e.target.value }))}
              />
            </FormField>
            <FormField label="Description" htmlFor="case-new-desc" required>
              <Input
                as="textarea"
                id="case-new-desc"
                rows={5}
                value={compose.description}
                onChange={(e) => setCompose((p) => ({ ...p, description: e.target.value }))}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Priority" htmlFor="case-new-priority">
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
              <FormField label="Company id (optional)" htmlFor="case-new-company">
                <Input
                  id="case-new-company"
                  type="number"
                  min={1}
                  value={compose.company_id}
                  onChange={(e) => setCompose((p) => ({ ...p, company_id: e.target.value }))}
                />
              </FormField>
              <FormField
                label="Assign to user id (optional)"
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
                {busy ? "Creating…" : "Create case"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setComposeOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
