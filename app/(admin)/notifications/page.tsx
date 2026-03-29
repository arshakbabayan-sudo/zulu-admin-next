"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessNotificationsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiNotificationMarkRead,
  apiNotificationsMarkAllRead,
  apiNotificationsPaginated,
  apiNotificationsUnreadCount,
  type NotificationRow,
} from "@/lib/notifications-api";
import { useCallback, useEffect, useState } from "react";

export default function NotificationsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessNotificationsNav(user);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyAll, setBusyAll] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadUnread = useCallback(async () => {
    if (!token || !allowed) return;
    try {
      const res = await apiNotificationsUnreadCount(token);
      setUnreadCount(res.data.unread_count);
    } catch {
      setUnreadCount(null);
    }
  }, [token, allowed]);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiNotificationsPaginated(token, { page, per_page: 20 });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load notifications");
    }
  }, [token, allowed, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token || !allowed) return;
    loadUnread();
  }, [token, allowed, loadUnread]);

  const refreshAfterMutation = useCallback(async () => {
    await Promise.all([load(), loadUnread()]);
  }, [load, loadUnread]);

  const onMarkRead = async (id: number) => {
    if (!token) return;
    setBusyId(id);
    setErr(null);
    try {
      const res = await apiNotificationMarkRead(token, id);
      setRows((prev) => prev.map((r) => (r.id === id ? res.data : r)));
      await loadUnread();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to mark as read");
    } finally {
      setBusyId(null);
    }
  };

  const onMarkAllRead = async () => {
    if (!token) return;
    setBusyAll(true);
    setErr(null);
    try {
      await apiNotificationsMarkAllRead(token);
      await refreshAfterMutation();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to mark all as read");
    } finally {
      setBusyAll(false);
    }
  };

  if (!allowed) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Notifications</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Notifications</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Notifications</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {
          "GET /api/notifications/paginated · GET /api/notifications/unread-count · POST /api/notifications/{id}/read · POST /api/notifications/read-all"
        }
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        {unreadCount !== null && (
          <span className="rounded border border-zinc-200 bg-white px-2 py-1 tabular-nums text-zinc-700">
            Unread: {unreadCount}
          </span>
        )}
        <button
          type="button"
          disabled={busyAll || (unreadCount !== null && unreadCount === 0)}
          onClick={() => onMarkAllRead()}
          className="rounded border border-zinc-300 bg-white px-3 py-1 disabled:opacity-40"
        >
          {busyAll ? "Marking…" : "Mark all as read"}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Message</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.priority ?? "—"}</td>
                <td className="max-w-[140px] truncate px-3 py-2 text-xs">{r.event_type}</td>
                <td className="max-w-xs px-3 py-2">{r.title}</td>
                <td className="max-w-md truncate px-3 py-2 text-xs text-zinc-600">{r.message}</td>
                <td className="px-3 py-2 tabular-nums">{r.related_company_id ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">
                  {r.created_at ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {r.status === "unread" ? (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => onMarkRead(r.id)}
                      className="text-zinc-700 underline disabled:opacity-40"
                    >
                      {busyId === r.id ? "…" : "Mark read"}
                    </button>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
      <p className="mt-3 text-xs text-zinc-500">
        List pagination uses server ordering (newest first). Query filters are not exposed on this API;
        use mark-as-read to clear unread items.
      </p>
    </div>
  );
}
