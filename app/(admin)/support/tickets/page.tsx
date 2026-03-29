"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessSupportNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiSupportTickets, type SupportTicketListRow } from "@/lib/support-api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const STATUSES = ["open", "pending", "resolved", "closed"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;

export default function SupportTicketsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessSupportNav(user);
  const isSuper = user?.is_super_admin === true;
  const [rows, setRows] = useState<SupportTicketListRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [companyIdFilter, setCompanyIdFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const companyIdNum =
    companyIdFilter.trim() === "" ? undefined : Number(companyIdFilter);
  const companyIdParam =
    isSuper && companyIdNum !== undefined && Number.isFinite(companyIdNum) && companyIdNum > 0
      ? companyIdNum
      : undefined;

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiSupportTickets(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: search.trim() || undefined,
        company_id: companyIdParam,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load tickets");
    }
  }, [token, allowed, page, statusFilter, priorityFilter, search, companyIdParam]);

  useEffect(() => {
    load();
  }, [load]);

  if (!allowed) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Support tickets</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Support tickets</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Support tickets</h1>
      <p className="mt-1 text-sm text-zinc-500">
        GET /api/support/tickets · super admin (optional ?company_id=) or company admin (scoped)
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="text-zinc-600">
          Status
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="ml-2 rounded border border-zinc-300 px-2 py-1"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-zinc-600">
          Priority
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPage(1);
              setPriorityFilter(e.target.value);
            }}
            className="ml-2 rounded border border-zinc-300 px-2 py-1"
          >
            <option value="">All</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-zinc-600">
          Search subject
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => setPage(1)}
            className="ml-2 rounded border border-zinc-300 px-2 py-1"
            placeholder="Substring"
          />
        </label>
        {isSuper && (
          <label className="text-zinc-600">
            Company ID
            <input
              value={companyIdFilter}
              onChange={(e) => setCompanyIdFilter(e.target.value)}
              onBlur={() => setPage(1)}
              className="ml-2 w-24 rounded border border-zinc-300 px-2 py-1 tabular-nums"
              placeholder="All"
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => {
            setPage(1);
            load();
          }}
          className="rounded border border-zinc-300 bg-white px-3 py-1"
        >
          Apply
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Msgs</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="max-w-xs px-3 py-2">{r.subject}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.priority}</td>
                <td className="px-3 py-2 tabular-nums">{r.company_id ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.user?.name ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{r.messages_count ?? "—"}</td>
                <td className="px-3 py-2">
                  <Link href={`/support/tickets/${r.id}`} className="text-zinc-700 underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
