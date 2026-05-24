"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
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
import {
  Badge,
  type BadgeTone,
  Button,
  Pagination,
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
  V2Card,
  V2Button,
} from "@/components/ui/v2";
import { Download } from "lucide-react";

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
    void load();
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

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.notifications.title")}</h1>
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
          { label: t("admin.notifications.title") },
        ]}
        title={t("admin.notifications.title")}
        subtitle={unreadCount !== null ? `${t("admin.notifications.unread")}: ${unreadCount}` : undefined}
        actions={
          <>
            <V2Button icon={<Download className="h-4 w-4" />}>Export</V2Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busyAll || (unreadCount !== null && unreadCount === 0)}
              onClick={() => onMarkAllRead()}
            >
              {busyAll ? t("admin.notifications.marking") : t("admin.notifications.mark_all_read")}
            </Button>
          </>
        }
      />

      {err && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.crud.common.id")}</TH>
            <TH>{t("admin.notifications.status")}</TH>
            <TH>{t("admin.notifications.priority")}</TH>
            <TH>{t("admin.notifications.event")}</TH>
            <TH>{t("admin.notifications.col_title")}</TH>
            <TH>{t("admin.notifications.message")}</TH>
            <TH>{t("admin.notifications.company")}</TH>
            <TH>{t("admin.notifications.created")}</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={9}>{t("admin.notifications.empty") || "No notifications."}</TEmpty> : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums text-fg-t7 font-mono text-xs">#{r.id}</TD>
              <TD><Badge tone={notificationStatusTone(r.status)}>{r.status}</Badge></TD>
              <TD>
                {r.priority ? (
                  <Badge tone={priorityTone(r.priority)}>{r.priority}</Badge>
                ) : (
                  <span className="text-fg-t6">—</span>
                )}
              </TD>
              <TD>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={{
                    backgroundColor: "var(--admin-bg-tertiary)",
                    color: "var(--admin-text-secondary)",
                  }}
                >
                  {r.event_type}
                </span>
              </TD>
              <TD className="max-w-xs font-medium text-fg-t8">{r.title}</TD>
              <TD className="max-w-md truncate text-xs text-fg-t6">{r.message}</TD>
              <TD className="tabular-nums text-xs text-fg-t7">{r.related_company_id ?? "—"}</TD>
              <TD className="text-xs text-fg-t6" title={r.created_at ?? undefined}>
                {formatRelativeTime(r.created_at)}
              </TD>
              <TD align="right">
                {r.status === "unread" ? (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => onMarkRead(r.id)}
                    className="text-primary-500 underline text-xs disabled:opacity-40 hover:text-primary-700"
                  >
                    {busyId === r.id ? "…" : t("admin.notifications.mark_read")}
                  </button>
                ) : (
                  <span className="text-fg-t6 text-xs">—</span>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      </V2Card>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}

      <p className="text-xs text-fg-t7 mt-4">{t("admin.notifications.footer_help")}</p>
    </div>
  );
}

function notificationStatusTone(status: string): BadgeTone {
  switch (status) {
    case "read":
    case "sent":
      return "success";
    case "unread":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "gray";
  }
}

function priorityTone(p: string): BadgeTone {
  switch (p) {
    case "high":
    case "urgent":
      return "danger";
    case "medium":
      return "warning";
    case "low":
      return "info";
    default:
      return "gray";
  }
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
