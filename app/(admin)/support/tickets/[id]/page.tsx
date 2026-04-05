"use client";

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

  if (!allowed) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Ticket</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Ticket</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 text-sm">
        <Link href="/support/tickets" className="text-slate-600 underline">
          <- Tickets
        </Link>
      </div>
      <h1 className="text-xl font-semibold">Support ticket #{id}</h1>
      {isSuper && (
        <div className="mt-3 text-sm">
          <label className="text-slate-600">
            Scope: company_id (optional)
            <input
              value={companyIdFilter}
              onChange={(e) => setCompanyIdFilter(e.target.value)}
              className="ml-2 w-28 rounded border border-slate-300 px-2 py-1 tabular-nums"
              placeholder="omit = all"
            />
          </label>
          <button
            type="button"
            onClick={() => load()}
            className="ml-2 rounded border border-slate-300 bg-white px-2 py-1"
          >
            Reload
          </button>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {ticket && (
        <div className="mt-4 space-y-4">
          <div className="rounded border border-slate-200 bg-white p-4 text-sm">
            <div className="font-medium">{ticket.subject}</div>
            <div className="mt-2 text-slate-600">
              Status: {ticket.status} | Priority: {ticket.priority} | Company:{" "}
              {ticket.company_id ?? "-"}
            </div>
            <div className="mt-1 text-xs text-slate-700">
              User: {ticket.user ? `${ticket.user.name} <${ticket.user.email}>` : "-"}
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800">Thread</h2>
            <ul className="mt-3 space-y-3">
              {ticket.messages.map((m) => (
                <li
                  key={m.id}
                  className={
                    "rounded border px-3 py-2 text-sm " +
                    (m.is_admin_reply ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-100")
                  }
                >
                  <div className="text-xs text-slate-700">
                    {m.is_admin_reply ? "Admin" : "User"}
                    {m.user ? ` | ${m.user.name}` : ""} | {m.created_at ?? ""}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap text-slate-800">{m.message}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800">Admin reply</h2>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              className="mt-2 w-full max-w-xl rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="Message (required, max 5000 chars)"
            />
            <button
              type="button"
              disabled={busy || !reply.trim()}
              onClick={() => sendReply()}
              className="mt-2 rounded border border-slate-300 bg-white px-3 py-1 text-sm disabled:opacity-40"
            >
              Send reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
