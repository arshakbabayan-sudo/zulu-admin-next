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
import { useLanguage } from "@/contexts/LanguageContext";
import { useCallback, useEffect, useState } from "react";

export default function NotificationsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessNotificationsNav(user);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyAll, setBusyAll] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Single mount call — fetch paginated list and unread count in parallel.
  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const [listRes, countRes] = await Promise.all([
        apiNotificationsPaginated(token, { page, per_page: 20 }),
        apiNotificationsUnreadCount(token).catch(() => null),
      ]);
      setRows(listRes.data);
      setMeta(listRes.meta);
      if (countRes) setUnreadCount(countRes.data.unread_count);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.notifications.err_load"));
    }
  }, [token, allowed, page]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshUnread = useCallback(async () => {
    if (!token || !allowed) return;
    try {
      const res = await apiNotificationsUnreadCount(token);
      setUnreadCount(res.data.unread_count);
    } catch {
      // non-critical
    }
  }, [token, allowed]);

  const onMarkRead = async (id: number) => {
    if (!token) return;
    setBusyId(id);
    setErr(null);
    try {
      const res = await apiNotificationMarkRead(token, id);
      setRows((prev) => prev.map((r) => (r.id === id ? res.data : r)));
      await refreshUnread();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.notifications.err_mark_read"));
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
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.notifications.err_mark_all_read"));
    } finally {
      setBusyAll(false);
    }
  };

  if (!allowed) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.notifications.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.notifications.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.notifications.title")}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        {unreadCount !== null && (
          <span className="rounded border border-default bg-white px-2 py-1 tabular-nums text-fg-t7">
            {t("admin.notifications.unread")}: {unreadCount}
          </span>
        )}
        <button
          type="button"
          disabled={busyAll || (unreadCount !== null && unreadCount === 0)}
          onClick={() => onMarkAllRead()}
          className="rounded border border-default bg-white px-3 py-1 disabled:opacity-40"
        >
          {busyAll ? t("admin.notifications.marking") : t("admin.notifications.mark_all_read")}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.crud.common.id")}</th>
              <th className="px-3 py-2">{t("admin.notifications.status")}</th>
              <th className="px-3 py-2">{t("admin.notifications.priority")}</th>
              <th className="px-3 py-2">{t("admin.notifications.event")}</th>
              <th className="px-3 py-2">{t("admin.notifications.col_title")}</th>
              <th className="px-3 py-2">{t("admin.notifications.message")}</th>
              <th className="px-3 py-2">{t("admin.notifications.company")}</th>
              <th className="px-3 py-2">{t("admin.notifications.created")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.priority ?? "-"}</td>
                <td className="max-w-[140px] truncate px-3 py-2 text-xs">{r.event_type}</td>
                <td className="max-w-xs px-3 py-2">{r.title}</td>
                <td className="max-w-md truncate px-3 py-2 text-xs text-fg-t6">{r.message}</td>
                <td className="px-3 py-2 tabular-nums">{r.related_company_id ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-fg-t7">
                  {r.created_at ?? "-"}
                </td>
                <td className="px-3 py-2">
                  {r.status === "unread" ? (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => onMarkRead(r.id)}
                      className="text-fg-t7 underline disabled:opacity-40"
                    >
                      {busyId === r.id ? "..." : t("admin.notifications.mark_read")}
                    </button>
                  ) : (
                    <span className="text-fg-t6">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
      <p className="mt-3 text-xs text-fg-t7">
        {t("admin.notifications.footer_help")}
      </p>
    </div>
  );
}
