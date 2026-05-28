"use client";

/**
 * Notifications — v2 admin-redesign page (2026-05-24).
 * Mockup: docs/zulu-admin-v2.html page-view#notifications (lines 1028-1118).
 *
 * Layout:
 *   PageHeader (breadcrumb, title "Notifications", subtitle "Your inbox",
 *               Mark all as read + Preferences actions)
 *   SectionTabs (All / Unread / Mentions / System)
 *   Card with date-grouped notification rows (Today / Yesterday / This week / Earlier)
 *     each row = avatar(icon) + title + body + actions + unread dot
 *
 * 2026-05-24 wiring: now backed by /api/notifications/paginated, /read-all,
 * /{id}/read, /unread-count (NotificationController). No apiNotifications
 * helper exists, so this page calls fetch() inline using getApiBaseUrl().
 *
 * NotificationResource shape:
 *   { id, type, title, message, status: "unread"|"read", event_type,
 *     subject_type, subject_id, related_company_id, priority, created_at }
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { getApiBaseUrl } from "@/lib/api-base";
import { PageHeader, V2Card, V2Button } from "@/components/ui/v2";

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

type IconKey = "calendar" | "alert" | "receipt" | "user-plus" | "shield-x" | "edit" | "bell";
type ToneKey = "purple" | "teal" | "amber" | "blue";

const TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "mentions", label: "Mentions" },
  { key: "system", label: "System" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function tx(t: (k: string) => string, key: string, fallback: string): string {
  const r = t(key);
  return r === key ? fallback : r;
}

/**
 * Map notification type/event_type to an icon + tone tuple.
 * Falls back to "bell" / "purple" so unknown types still render.
 */
function classifyNotification(n: ApiNotification): { icon: IconKey; tone: ToneKey } {
  const key = `${n.type ?? ""} ${n.event_type ?? ""}`.toLowerCase();
  if (/booking|reservation|order/.test(key)) return { icon: "calendar", tone: "purple" };
  if (/approv|moderation|review/.test(key)) return { icon: "alert", tone: "amber" };
  if (/invoice|payment|receipt/.test(key)) return { icon: "receipt", tone: "teal" };
  if (/user|register|signup/.test(key)) return { icon: "user-plus", tone: "blue" };
  if (/security|login|auth|failed/.test(key)) return { icon: "shield-x", tone: "amber" };
  if (/permission|role|update|edit/.test(key)) return { icon: "edit", tone: "purple" };
  return { icon: "bell", tone: "purple" };
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

function formatRelativeTime(createdAt: string | null): string {
  if (!createdAt) return "";
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "";
  const ms = Date.now() - created.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return created.toLocaleDateString();
}

export default function AdminRedesignNotificationsPage() {
  const { t } = useLanguage();
  const { token, user } = useAdminAuth();
  const router = useRouter();
  useDocumentTitle("Notifications — ZULU Admin");

  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apiBase = getApiBaseUrl().replace(/\/$/, "");

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
        throw new Error(`HTTP ${resp.status}`);
      }
      const json = (await resp.json()) as { success: boolean; data: ApiNotification[] };
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : tx(t, "admin.notifications.err_load", "Failed to load notifications."),
      );
    } finally {
      setLoading(false);
    }
  }, [token, apiBase, activeTab, t]);

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
      // Optimistic update
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "read" } : n)),
      );
      void fetchUnreadCount();
    } catch {
      // ignore
    }
  }

  // Tab filtering applied client-side on top of the unread_only server filter.
  const visible = useMemo(() => {
    if (activeTab === "mentions") {
      return items.filter((n) => /mention/i.test(`${n.type ?? ""} ${n.event_type ?? ""}`));
    }
    if (activeTab === "system") {
      return items.filter((n) => /system|broadcast/i.test(`${n.type ?? ""} ${n.event_type ?? ""}`));
    }
    return items;
  }, [items, activeTab]);

  const grouped = useMemo(() => {
    const buckets: Record<DateGroup, ApiNotification[]> = {
      today: [],
      yesterday: [],
      this_week: [],
      earlier: [],
    };
    for (const n of visible) buckets[groupByDate(n.created_at)].push(n);
    return buckets;
  }, [visible]);

  const totalAll = items.length;
  const totalUnread = unreadCount ?? items.filter((n) => n.status === "unread").length;

  const tabCount = (key: TabKey): number | undefined => {
    if (key === "all") return totalAll || undefined;
    if (key === "unread") return totalUnread || undefined;
    return undefined;
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: tx(t, "admin.nav.section.notifications_v2", "Notifications") },
        ]}
        title={tx(t, "admin.nav.section.notifications_v2", "Notifications")}
        subtitle={tx(t, "admin.notifications.subtitle", "Your inbox")}
        actions={
          <>
            {/* Phase Ա.3 — Bulk notifications relocated under Notifications.
                Admin uses per-page nav (no group-config tabs), so the link
                lives here as a super-admin header action. */}
            {user?.is_super_admin ? (
              <V2Button
                icon={<BellIcon />}
                onClick={() => router.push("/bucket3/bulk-notifications")}
              >
                {tx(t, "admin.nav.tab.bucket3.bulk_notifications", "Bulk notifications")}
              </V2Button>
            ) : null}
            <V2Button icon={<ChecksIcon />} onClick={() => void markAllRead()}>
              {tx(t, "admin.notifications.mark_all_read", "Mark all as read")}
            </V2Button>
            <V2Button
              icon={<SettingsIcon />}
              onClick={() => router.push("/admin-redesign/profile")}
            >
              {tx(t, "admin.notifications.preferences", "Preferences")}
            </V2Button>
          </>
        }
      />

      {/* Section tabs */}
      <div
        className="mb-5 flex flex-wrap gap-1 overflow-x-auto border-b"
        style={{ borderColor: "var(--admin-border)" }}
        role="tablist"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const count = tabCount(tab.key);
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.key)}
              className="-mb-px inline-flex h-[38px] items-center gap-1 whitespace-nowrap border-b-2 px-3.5 text-[13px] font-medium transition"
              style={{
                color: active ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                borderBottomColor: active ? "var(--admin-primary)" : "transparent",
              }}
            >
              {tx(t, `admin.notifications.tab.${tab.key}`, tab.label)}
              {count !== undefined ? (
                <span
                  className="ml-1 inline-flex items-center justify-center rounded-full px-[7px] py-[1px] text-[11px] font-medium"
                  style={{
                    backgroundColor: active ? "var(--admin-primary-light)" : "var(--admin-bg-tertiary)",
                    color: active ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                  }}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {err ? (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      ) : null}

      <V2Card>
        {(["today", "yesterday", "this_week", "earlier"] as DateGroup[]).map((bucket) => {
          const list = grouped[bucket];
          if (list.length === 0) return null;
          return (
            <div key={bucket}>
              <GroupHeader
                label={tx(t, `admin.notifications.group.${bucket}`, GROUP_LABEL[bucket])}
                muted={bucket !== "today"}
              />
              {list.map((n) => (
                <NotificationRow key={n.id} item={n} onMarkRead={markOneRead} />
              ))}
            </div>
          );
        })}
        {!loading && visible.length === 0 ? (
          <div className="px-5 py-[60px] text-center">
            <div
              className="text-[14px] font-semibold"
              style={{ color: "var(--admin-text-primary)" }}
            >
              {tx(t, "admin.notifications.empty", "No notifications")}
            </div>
            <div
              className="mt-1 text-[12px]"
              style={{ color: "var(--admin-text-secondary)" }}
            >
              {tx(t, "admin.notifications.empty_hint", "You're all caught up.")}
            </div>
          </div>
        ) : null}
        {loading ? (
          <div className="px-5 py-[60px] text-center text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
            {tx(t, "common.loading", "Loading…")}
          </div>
        ) : null}
      </V2Card>
    </div>
  );
}

const GROUP_LABEL: Record<DateGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This week",
  earlier: "Earlier",
};

function GroupHeader({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <div
      className="border-b px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.5px]"
      style={{
        borderColor: "var(--admin-border)",
        backgroundColor: muted ? "var(--admin-bg-secondary)" : "transparent",
        color: "var(--admin-text-secondary)",
      }}
    >
      {label}
    </div>
  );
}

function NotificationRow({
  item,
  onMarkRead,
}: {
  item: ApiNotification;
  onMarkRead: (id: number) => void;
}) {
  const unread = item.status === "unread";
  const { icon, tone } = classifyNotification(item);
  return (
    <div
      className="flex gap-3 border-b px-5 py-3.5"
      style={{
        borderColor: "var(--admin-border)",
        backgroundColor: unread ? "var(--admin-primary-light)" : "transparent",
      }}
    >
      <NotificationAvatar tone={tone} icon={icon} />
      <div className="flex-1">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div
            className="text-[13px] font-medium"
            style={{ color: "var(--admin-text-primary)" }}
          >
            {item.title || `Notification #${item.id}`}
          </div>
          <span
            className="shrink-0 text-[11px]"
            style={{ color: "var(--admin-text-secondary)" }}
          >
            {formatRelativeTime(item.created_at)}
          </span>
        </div>
        {item.message ? (
          <div
            className="text-[13px]"
            style={{ color: "var(--admin-text-secondary)" }}
          >
            {item.message}
          </div>
        ) : null}
        {Array.isArray(item.delivered_channels) && item.delivered_channels.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.delivered_channels.map((ch) => (
              <ChannelPill key={ch} channel={ch} />
            ))}
          </div>
        ) : null}
        {unread ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <V2Button size="xs" variant="primary" onClick={() => onMarkRead(item.id)}>
              Mark as read
            </V2Button>
          </div>
        ) : null}
      </div>
      {unread ? (
        <span
          aria-hidden
          className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: "var(--admin-primary)" }}
        />
      ) : null}
    </div>
  );
}

function ChannelPill({ channel }: { channel: string }) {
  const label =
    channel === "in_app"
      ? "in-app"
      : channel === "email"
        ? "email"
        : channel === "sms"
          ? "SMS"
          : channel === "push"
            ? "push"
            : channel;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[1px] text-[10px] font-medium"
      style={{
        backgroundColor: "var(--admin-bg-tertiary)",
        color: "var(--admin-text-secondary)",
      }}
    >
      {label}
    </span>
  );
}

function NotificationAvatar({ tone, icon }: { tone: ToneKey; icon: IconKey }) {
  const styles: Record<ToneKey, React.CSSProperties> = {
    purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
    teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  };
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      style={styles[tone]}
      aria-hidden
    >
      {icon === "calendar" ? (
        <CalIcon />
      ) : icon === "alert" ? (
        <AlertIcon />
      ) : icon === "receipt" ? (
        <ReceiptIcon />
      ) : icon === "user-plus" ? (
        <UPIcon />
      ) : icon === "shield-x" ? (
        <ShieldXIcon />
      ) : icon === "edit" ? (
        <EditIcon />
      ) : (
        <BellIcon />
      )}
    </span>
  );
}

/* ─── icons ────────────────────────────────────────────────────────────── */

function ChecksIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3 12 5 5L20 5" />
      <path d="m13 17 5 5L30 10" transform="translate(-9 -5)" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx={12} cy={12} r={3} />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.13.42.4.79.75 1.05.36.26.79.4 1.24.4H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={3} y={4} width={18} height={18} rx={2} />
      <line x1={3} y1={10} x2={21} y2={10} />
      <line x1={8} y1={2} x2={8} y2={6} />
      <line x1={16} y1={2} x2={16} y2={6} />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1={12} y1={9} x2={12} y2={13} />
      <line x1={12} y1={17} x2={12} y2={17} />
    </svg>
  );
}
function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 2h16v20l-4-2-4 2-4-2-4 2z" />
      <line x1={8} y1={7} x2={16} y2={7} />
      <line x1={8} y1={11} x2={16} y2={11} />
      <line x1={8} y1={15} x2={13} y2={15} />
    </svg>
  );
}
function UPIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx={9} cy={7} r={4} />
      <line x1={20} y1={8} x2={20} y2={14} />
      <line x1={17} y1={11} x2={23} y2={11} />
    </svg>
  );
}
function ShieldXIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
      <line x1={9.5} y1={10.5} x2={14.5} y2={15.5} />
      <line x1={14.5} y1={10.5} x2={9.5} y2={15.5} />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
