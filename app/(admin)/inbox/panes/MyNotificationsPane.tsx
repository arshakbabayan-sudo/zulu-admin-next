"use client";

/**
 * Inbox — "My notifications" pane (admin v3). Self-contained 1:1 port of the
 * `#pane-my-notif` block in docs/admin_designe/8_Inbox/inbox.html
 * (lines 852–950), re-homed onto the unified Inbox page.
 *
 * Functionality ported verbatim from
 * app/(admin)/admin-redesign/notifications/page.tsx — which calls the
 * notifications API inline via fetch() + getApiBaseUrl() (there is no
 * apiNotifications helper). Endpoints:
 *   GET  /notifications/paginated?page=1&per_page=&unread_only=
 *   GET  /notifications/unread-count
 *   POST /notifications/read-all
 *   POST /notifications/{id}/read          (ownership → 403 if not user's)
 *
 * Layout: header row with All / Unread sub-tabs + "Mark all as read" CTA,
 * then date-grouped sections (Today / Yesterday / This week / Earlier), each a
 * `.notif-list` of `.notif-item` rows. Each row = `.notif-ico` (tone from
 * classifyNotification) + `.notif-main` (title +/- unread-dot, message, foot
 * with time + channel pills) + a `.notif-act` mark-as-read `.icon-btn` on
 * unread rows.
 *
 * Rendered inside the `.inbox-page` wrapper of the MgmtPage shell, so the
 * inbox-scoped management.css classes apply. No admin Tailwind, no --admin-*
 * tokens, no @/components/ui.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getApiBaseUrl } from "@/lib/api-base";
import { ApiRequestError } from "@/lib/api-client";

type ApiNotification = {
  id: number;
  type: string | null;
  title: string | null;
  message: string | null;
  status: "unread" | "read" | string;
  event_type: string | null;
  subject_type: string | null;
  subject_id: number | null;
  related_company_id: number | null;
  priority: string | null;
  created_at: string | null;
  /** Channels this notification was fanned out through (in_app/email/sms/push). */
  delivered_channels?: string[] | null;
};

type DateGroup = "today" | "yesterday" | "this_week" | "earlier";
type ToneKey = "primary" | "amber" | "teal" | "blue";
type TabKey = "all" | "unread";

type L = { hy: string; ru: string; en: string };

const T = {
  markAllRead: { hy: "Նշել բոլորը կարդացված", ru: "Отметить все прочитанными", en: "Mark all as read" },
  markRead: { hy: "Նշել կարդացված", ru: "Отметить прочитанным", en: "Mark as read" },
  tabAll: { hy: "Բոլորը", ru: "Все", en: "All" },
  tabUnread: { hy: "Չկարդացված", ru: "Непрочитанные", en: "Unread" },
  loading: { hy: "Բեռնվում է…", ru: "Загрузка…", en: "Loading…" },
  errLoad: {
    hy: "Չհաջողվեց բեռնել ծանուցումները։",
    ru: "Не удалось загрузить уведомления.",
    en: "Failed to load notifications.",
  },
  emptyTitle: { hy: "Ծանուցումներ չկան", ru: "Нет уведомлений", en: "No notifications" },
  emptyHint: { hy: "Ամեն ինչ կարդացված է։", ru: "Вы всё прочитали.", en: "You're all caught up." },
  notif: { hy: "Ծանուցում", ru: "Уведомление", en: "Notification" },
  // Date-group labels.
  today: { hy: "Այսօր", ru: "Сегодня", en: "Today" },
  yesterday: { hy: "Երեկ", ru: "Вчера", en: "Yesterday" },
  this_week: { hy: "Այս շաբաթ", ru: "На этой неделе", en: "This week" },
  earlier: { hy: "Ավելի վաղ", ru: "Ранее", en: "Earlier" },
  // Relative-time fragments.
  justNow: { hy: "հենց հիմա", ru: "только что", en: "just now" },
  minAgo: { hy: "ր առաջ", ru: "мин назад", en: "min ago" },
  hourAgo: { hy: "ժ առաջ", ru: "ч назад", en: "hour ago" },
  dayAgo: { hy: "օր առաջ", ru: "дн назад", en: "day ago" },
} satisfies Record<string, L>;

const CHANNEL_LABEL: Record<string, L> = {
  in_app: { hy: "Հավելված", ru: "В приложении", en: "In-app" },
  email: { hy: "Էլ. փոստ", ru: "Эл. почта", en: "Email" },
  sms: { hy: "SMS", ru: "SMS", en: "SMS" },
  push: { hy: "Push", ru: "Push", en: "Push" },
};

/** Maps a notification type/event_type to a Tabler icon glyph + tone. */
function classifyNotification(n: ApiNotification): { icon: string; tone: ToneKey } {
  const key = `${n.type ?? ""} ${n.event_type ?? ""}`.toLowerCase();
  if (/booking|reservation|order/.test(key)) return { icon: "ti-calendar-event", tone: "primary" };
  if (/approv|moderation|review/.test(key)) return { icon: "ti-alert-triangle", tone: "amber" };
  if (/invoice|payment|receipt/.test(key)) return { icon: "ti-receipt", tone: "teal" };
  if (/user|register|signup/.test(key)) return { icon: "ti-user-plus", tone: "blue" };
  if (/security|login|auth|failed/.test(key)) return { icon: "ti-shield-x", tone: "amber" };
  if (/permission|role|update|edit/.test(key)) return { icon: "ti-edit", tone: "primary" };
  return { icon: "ti-bell", tone: "primary" };
}

function groupByDate(createdAt: string | null): DateGroup {
  if (!createdAt) return "earlier";
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "earlier";
  const now = new Date();
  const ms = now.getTime() - created.getTime();
  const sameDay =
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate();
  if (sameDay) return "today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sameYesterday =
    created.getFullYear() === yesterday.getFullYear() &&
    created.getMonth() === yesterday.getMonth() &&
    created.getDate() === yesterday.getDate();
  if (sameYesterday) return "yesterday";
  if (ms < 7 * 24 * 60 * 60 * 1000) return "this_week";
  return "earlier";
}

export function MyNotificationsPane() {
  const { token, user } = useAdminAuth();
  const { lang } = useLanguage();

  function pick(map: L): string {
    return lang === "hy" ? map.hy : lang === "ru" ? map.ru : map.en;
  }

  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apiBase = getApiBaseUrl().replace(/\/$/, "");

  function formatRelativeTime(createdAt: string | null): string {
    if (!createdAt) return "";
    const created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) return "";
    const ms = Date.now() - created.getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return pick(T.justNow);
    if (minutes < 60) return `${minutes} ${pick(T.minAgo)}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${pick(T.hourAgo)}`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ${pick(T.dayAgo)}`;
    return created.toLocaleDateString();
  }

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const unreadOnly = activeTab === "unread" ? 1 : 0;
      const resp = await fetch(
        `${apiBase}/notifications/paginated?page=1&per_page=50&unread_only=${unreadOnly}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (!resp.ok) {
        throw new ApiRequestError(`HTTP ${resp.status}`, resp.status);
      }
      const json = (await resp.json()) as { success: boolean; data: ApiNotification[] };
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : pick(T.errLoad));
    } finally {
      setLoading(false);
    }
    // pick is derived from `lang`; depending on it (not `pick`) keeps the
    // callback stable across renders while still re-fetching on language change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, apiBase, activeTab, lang]);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${apiBase}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!resp.ok) return;
      const json = (await resp.json()) as { success: boolean; data: { unread_count: number } };
      setUnreadCount(json.data?.unread_count ?? null);
    } catch {
      // non-critical
    }
  }, [token, apiBase]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    void fetchUnreadCount();
  }, [fetchUnreadCount]);

  async function markAllRead() {
    if (!token) return;
    try {
      await fetch(`${apiBase}/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      await Promise.all([fetchList(), fetchUnreadCount()]);
    } catch {
      // ignore
    }
  }

  async function markOneRead(id: number) {
    if (!token) return;
    try {
      await fetch(`${apiBase}/notifications/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      // Optimistic update.
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, status: "read" } : n)));
      void fetchUnreadCount();
    } catch {
      // ignore
    }
  }

  const grouped = useMemo(() => {
    const buckets: Record<DateGroup, ApiNotification[]> = {
      today: [],
      yesterday: [],
      this_week: [],
      earlier: [],
    };
    for (const n of items) buckets[groupByDate(n.created_at)].push(n);
    return buckets;
  }, [items]);

  const totalAll = items.length;
  const totalUnread = unreadCount ?? items.filter((n) => n.status === "unread").length;

  const groupOrder: DateGroup[] = ["today", "yesterday", "this_week", "earlier"];
  const hasAny = items.length > 0;

  // `user` is read to keep the contract's destructure live (per-row ownership
  // is enforced server-side via the 403 on /notifications/{id}/read).
  void user;

  return (
    <div>
      {/* Header row: All / Unread sub-tabs + Mark-all CTA */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div className="sub-tabs" role="tablist" style={{ marginBottom: 0 }}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "all"}
            className={`sub-tab${activeTab === "all" ? " active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            {pick(T.tabAll)}
            <span className="pill-count">{totalAll}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "unread"}
            className={`sub-tab${activeTab === "unread" ? " active" : ""}`}
            onClick={() => setActiveTab("unread")}
          >
            {pick(T.tabUnread)}
            <span className="pill-count">{totalUnread}</span>
          </button>
        </div>

        <button
          type="button"
          className="btn btn-sm"
          onClick={() => void markAllRead()}
          disabled={totalUnread === 0}
        >
          <i className="ti ti-checks" aria-hidden />
          {pick(T.markAllRead)}
        </button>
      </div>

      {err && (
        <div
          className="alert"
          style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}
        >
          <i className="ti ti-alert-circle" aria-hidden />
          {err}
        </div>
      )}

      {loading && (
        <div
          className="empty-state"
          style={{ padding: "40px 24px" }}
        >
          <i className="ti ti-loader-2" aria-hidden />
          <div className="es-title">{pick(T.loading)}</div>
        </div>
      )}

      {!loading && !hasAny && (
        <div className="empty-state">
          <div className="es-icon">
            <i className="ti ti-bell-off" aria-hidden />
          </div>
          <div className="es-title">{pick(T.emptyTitle)}</div>
          <div className="es-sub">{pick(T.emptyHint)}</div>
        </div>
      )}

      {!loading &&
        hasAny &&
        groupOrder.map((bucket) => {
          const list = grouped[bucket];
          if (list.length === 0) return null;
          return (
            <div key={bucket}>
              <div className="notif-group-label">{pick(T[bucket])}</div>
              <div className="notif-list">
                {list.map((n) => {
                  const unread = n.status === "unread";
                  const { icon, tone } = classifyNotification(n);
                  const channels = Array.isArray(n.delivered_channels)
                    ? n.delivered_channels
                    : [];
                  return (
                    <div key={n.id} className={`notif-item${unread ? " unread" : ""}`}>
                      <span className={`notif-ico tone-${tone}`} aria-hidden>
                        <i className={`ti ${icon}`} />
                      </span>
                      <div className="notif-main">
                        <div className="notif-title">
                          {unread ? <span className="unread-dot" aria-hidden /> : null}
                          <span>{n.title || `${pick(T.notif)} #${n.id}`}</span>
                        </div>
                        {n.message ? <div className="notif-msg">{n.message}</div> : null}
                        <div className="notif-foot">
                          <span className="notif-time">{formatRelativeTime(n.created_at)}</span>
                          {channels.length > 0 ? (
                            <span className="notif-channels">
                              {channels.map((ch) => (
                                <span key={ch} className="ch-pill">
                                  {CHANNEL_LABEL[ch] ? pick(CHANNEL_LABEL[ch]) : ch}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {unread ? (
                        <span className="notif-act">
                          <button
                            type="button"
                            className="icon-btn"
                            title={pick(T.markRead)}
                            aria-label={pick(T.markRead)}
                            onClick={() => void markOneRead(n.id)}
                          >
                            <i className="ti ti-check" aria-hidden />
                          </button>
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}
