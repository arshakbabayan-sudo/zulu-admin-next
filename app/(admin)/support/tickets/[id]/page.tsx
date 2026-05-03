"use client";

/**
 * Figma layout reference: Quest CRM Copy template
 *   - Invoice Details (status header + document + line items): 9318:15771
 *   - View Case (mobile detail):                                10485:27881
 * Brand tokens: ZULU purple primary (--admin-primary).
 * Mobile rule: status row stacks vertically; messages keep timeline pattern.
 * Last synced: 2026-05-03
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessSupportNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiSupportTicket,
  apiSupportTicketReply,
  type SupportTicketDetail,
} from "@/lib/support-api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type StatusTone = "info" | "success" | "warning" | "error" | "muted";

function statusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s.includes("open") || s.includes("new") || s.includes("pending")) return "warning";
  if (s.includes("progress") || s.includes("review")) return "info";
  if (s.includes("resolved") || s.includes("closed") || s.includes("done")) return "success";
  if (s.includes("escalat") || s.includes("urgent") || s.includes("error")) return "error";
  return "muted";
}

function priorityTone(priority: string): StatusTone {
  const p = priority.toLowerCase();
  if (p.includes("urgent") || p.includes("critical") || p.includes("high")) return "error";
  if (p.includes("medium") || p.includes("normal")) return "warning";
  if (p.includes("low")) return "muted";
  return "info";
}

const TONE_PILL: Record<StatusTone, string> = {
  success: "bg-success-50 text-success-700 border-success-100",
  warning: "bg-warning-50 text-warning-700 border-warning-100",
  info: "bg-info-50 text-info-700 border-info-100",
  error: "bg-error-50 text-error-700 border-error-100",
  muted: "bg-figma-bg-1 text-fg-t6 border-default",
};

const TONE_BAR: Record<StatusTone, string> = {
  success: "bg-success-500",
  warning: "bg-warning-500",
  info: "bg-info-500",
  error: "bg-error-500",
  muted: "bg-slate-300",
};

function StatusPill({ value, tone }: { value: string; tone: StatusTone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${TONE_PILL[tone]}`}>
      {value || "—"}
    </span>
  );
}

function StatusStep({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone: StatusTone;
}) {
  return (
    <div className="admin-card overflow-hidden">
      <div className={`h-1 ${TONE_BAR[tone]}`} />
      <div className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-fg-t6">{label}</div>
        <div className="mt-1 text-sm font-semibold text-fg-t8">{value}</div>
      </div>
    </div>
  );
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function SupportTicketDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { token, user } = useAdminAuth();
  const allowed = canAccessSupportNav(user);
  const isSuper = user?.is_super_admin === true;
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [companyIdFilter, setCompanyIdFilter] = useState("");

  const companyIdParam =
    isSuper &&
    companyIdFilter.trim() !== "" &&
    Number.isFinite(Number(companyIdFilter)) &&
    Number(companyIdFilter) > 0
      ? Number(companyIdFilter)
      : undefined;

  const load = useCallback(async () => {
    if (!token || !allowed || !Number.isFinite(id) || id < 1) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiSupportTicket(token, id, companyIdParam);
      setTicket(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else if (e instanceof ApiRequestError && e.status === 404) setErr("Ticket not found.");
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
    }
  }, [token, allowed, id, companyIdParam]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply() {
    if (!token || !reply.trim()) return;
    setBusy(true);
    try {
      await apiSupportTicketReply(token, id, reply.trim(), companyIdParam);
      setReply("");
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Reply failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Ticket</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  const lastMessage = ticket?.messages?.[ticket.messages.length - 1];
  const lastReplyDate = lastMessage?.created_at;
  const createdAt = ticket?.messages?.[0]?.created_at;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/support/tickets"
          className="inline-flex items-center gap-1.5 text-sm text-fg-t6 transition hover:text-primary"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Tickets
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="admin-page-title">Support ticket #{id}</h1>
          {ticket && (
            <p className="mt-1 text-sm text-fg-t6">
              {ticket.subject}
            </p>
          )}
        </div>
        {ticket && (
          <div className="flex items-center gap-2">
            <StatusPill value={ticket.status} tone={statusTone(ticket.status)} />
            <StatusPill value={`Priority: ${ticket.priority}`} tone={priorityTone(ticket.priority)} />
          </div>
        )}
      </header>

      {isSuper && (
        <div className="admin-card flex flex-wrap items-end gap-3 p-4">
          <label className="flex flex-col text-xs text-fg-t6">
            <span className="mb-1 font-medium text-fg-t7">Scope: company_id (super-admin only)</span>
            <input
              value={companyIdFilter}
              onChange={(e) => setCompanyIdFilter(e.target.value)}
              placeholder="omit = all"
              className="h-9 w-40 rounded-zulu border border-default bg-white px-3 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex h-9 items-center rounded-zulu border border-default bg-white px-3 text-sm font-medium text-fg-t7 transition hover:bg-figma-bg-1"
          >
            Reload
          </button>
        </div>
      )}

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      {ticket && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatusStep label="Created" value={formatDateTime(createdAt)} tone="info" />
            <StatusStep
              label="Last reply"
              value={lastMessage ? `${lastMessage.is_admin_reply ? "Admin" : "User"} · ${formatDateTime(lastReplyDate)}` : "—"}
              tone="muted"
            />
            <StatusStep label="Status" value={ticket.status || "—"} tone={statusTone(ticket.status)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="admin-card p-5">
                <h2 className="text-base font-semibold text-fg-t8">{ticket.subject}</h2>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-fg-t6">Status</dt>
                    <dd className="text-fg-t8 capitalize">{ticket.status}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-t6">Priority</dt>
                    <dd className="text-fg-t8 capitalize">{ticket.priority}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-t6">Company</dt>
                    <dd className="text-fg-t8">{ticket.company_id ?? "—"}</dd>
                  </div>
                  <div className="sm:col-span-3">
                    <dt className="text-xs text-fg-t6">Submitted by</dt>
                    <dd className="text-fg-t8">
                      {ticket.user ? (
                        <>
                          {ticket.user.name}
                          <span className="ml-1 text-xs text-fg-t6">&lt;{ticket.user.email}&gt;</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="admin-card p-5">
                <h2 className="text-base font-semibold text-fg-t8">Conversation</h2>
                <ol className="mt-4 space-y-4">
                  {ticket.messages.map((m) => (
                    <li
                      key={m.id}
                      className={`relative rounded-zulu border p-4 text-sm ${
                        m.is_admin_reply
                          ? "border-primary-100 bg-primary-50"
                          : "border-default bg-figma-bg-1"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 text-xs">
                        <span
                          className={`inline-flex h-5 items-center rounded-full px-2 font-medium ${
                            m.is_admin_reply
                              ? "bg-primary text-white"
                              : "bg-white text-fg-t7 border border-default"
                          }`}
                        >
                          {m.is_admin_reply ? "Admin" : "User"}
                        </span>
                        {m.user && <span className="text-fg-t7">{m.user.name}</span>}
                        <span className="text-fg-t6">·</span>
                        <span className="text-fg-t6">{formatDateTime(m.created_at)}</span>
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-fg-t8">{m.message}</div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <aside className="space-y-6">
              <div className="admin-card p-5">
                <h2 className="text-base font-semibold text-fg-t8">Reply</h2>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={6}
                  maxLength={5000}
                  placeholder="Type a reply… (required, max 5000 chars)"
                  className="mt-3 w-full rounded-zulu border border-default bg-white px-3 py-2 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
                <div className="mt-1 text-right text-xs text-fg-t6">{reply.length} / 5000</div>
                <button
                  type="button"
                  disabled={busy || !reply.trim()}
                  onClick={() => sendReply()}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {busy ? "Sending…" : "Send reply"}
                </button>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
