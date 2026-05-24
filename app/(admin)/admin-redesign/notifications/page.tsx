"use client";

/**
 * Notifications — v2 admin-redesign page (2026-05-24).
 * Mockup: docs/zulu-admin-v2.html page-view#notifications (lines 1028-1118).
 *
 * Layout:
 *   PageHeader (breadcrumb, title "Notifications", subtitle "Your inbox",
 *               Mark all as read + Preferences actions)
 *   SectionTabs (All / Unread / Mentions / System)
 *   Card with date-grouped notification rows (Today / Yesterday)
 *     each row = avatar(icon) + title + body + actions + unread dot
 *
 * Data is static demo for now; Phase Ե will wire to /api/admin/notifications.
 */

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { PageHeader, V2Card, V2Button } from "@/components/ui/v2";

type NotificationItem = {
  id: string;
  group: "today" | "yesterday";
  unread: boolean;
  avatarTone: "purple" | "teal" | "amber" | "blue";
  icon: "calendar" | "alert" | "receipt" | "user-plus" | "shield-x" | "edit";
  title: string;
  body: React.ReactNode;
  time: string;
  actions?: { label: string; variant: "primary" | "default" }[];
};

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    group: "today",
    unread: true,
    avatarTone: "purple",
    icon: "calendar",
    title: "New booking pending approval",
    body: (
      <>
        Booking <span className="font-mono">ZL-BK-892841</span> requires confirmation. Customer
        John Smith, Marriott Athens, $1,240.00.
      </>
    ),
    time: "2 min ago",
    actions: [
      { label: "View booking", variant: "primary" },
      { label: "Confirm", variant: "default" },
    ],
  },
  {
    id: "n2",
    group: "today",
    unread: true,
    avatarTone: "amber",
    icon: "alert",
    title: "Approval queue: 3 items waiting",
    body: "3 entities in approval queue including high-priority hotel #84 (Marriott Athens).",
    time: "15 min ago",
    actions: [{ label: "Open queue", variant: "primary" }],
  },
  {
    id: "n3",
    group: "today",
    unread: true,
    avatarTone: "teal",
    icon: "receipt",
    title: "Invoice INV-2026-128 issued",
    body: "Նարե Կարապետյան issued an invoice for Acme Travels — $1,240.00.",
    time: "1 hour ago",
  },
  {
    id: "n4",
    group: "today",
    unread: false,
    avatarTone: "blue",
    icon: "user-plus",
    title: "New user registered",
    body: "Maria Karapetyan (maria@example.com) registered as Customer.",
    time: "3 hours ago",
  },
  {
    id: "n5",
    group: "yesterday",
    unread: false,
    avatarTone: "amber",
    icon: "shield-x",
    title: "Failed login attempts detected",
    body: "3 failed login attempts for user sergey@zulu.am from IP 185.42.x.x.",
    time: "Yesterday at 22:14",
    actions: [{ label: "Review activity", variant: "default" }],
  },
  {
    id: "n6",
    group: "yesterday",
    unread: false,
    avatarTone: "purple",
    icon: "edit",
    title: "Permissions updated",
    body: "You updated the Editor role: granted Hotels.Edit and Bookings.Export permissions.",
    time: "Yesterday at 14:32",
  },
];

const TABS = [
  { key: "all", label: "All", count: 47 },
  { key: "unread", label: "Unread", count: 3 },
  { key: "mentions", label: "Mentions" },
  { key: "system", label: "System" },
] as const;

function tx(t: (k: string) => string, key: string, fallback: string): string {
  const r = t(key);
  return r === key ? fallback : r;
}

export default function AdminRedesignNotificationsPage() {
  const { t } = useLanguage();
  useDocumentTitle("Notifications — ZULU Admin");
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("all");

  const visible = NOTIFICATIONS.filter((n) =>
    activeTab === "unread" ? n.unread : true,
  );
  const todayGroup = visible.filter((n) => n.group === "today");
  const yesterdayGroup = visible.filter((n) => n.group === "yesterday");

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
            <V2Button icon={<ChecksIcon />}>
              {tx(t, "admin.notifications.mark_all_read", "Mark all as read")}
            </V2Button>
            <V2Button icon={<SettingsIcon />}>
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
              {tab.label}
              {"count" in tab && tab.count !== undefined ? (
                <span
                  className="ml-1 inline-flex items-center justify-center rounded-full px-[7px] py-[1px] text-[11px] font-medium"
                  style={{
                    backgroundColor: active ? "var(--admin-primary-light)" : "var(--admin-bg-tertiary)",
                    color: active ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                  }}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <V2Card>
        {todayGroup.length > 0 ? (
          <>
            <GroupHeader label="Today" />
            {todayGroup.map((n) => (
              <NotificationRow key={n.id} item={n} />
            ))}
          </>
        ) : null}
        {yesterdayGroup.length > 0 ? (
          <>
            <GroupHeader label="Yesterday" muted />
            {yesterdayGroup.map((n) => (
              <NotificationRow key={n.id} item={n} />
            ))}
          </>
        ) : null}
        {visible.length === 0 ? (
          <div className="px-5 py-[60px] text-center">
            <div className="text-[14px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>
              No notifications
            </div>
          </div>
        ) : null}
      </V2Card>

      <p className="mt-4 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
        🚧 <strong>Placeholder data</strong> — իրական notifications wiring-ը Փուլ Ե-ում
        (/api/admin/notifications endpoint արդեն կա, պետք է միացնել)։
      </p>
    </div>
  );
}

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

function NotificationRow({ item }: { item: NotificationItem }) {
  return (
    <div
      className="flex gap-3 border-b px-5 py-3.5"
      style={{
        borderColor: "var(--admin-border)",
        backgroundColor: item.unread ? "var(--admin-primary-light)" : "transparent",
      }}
    >
      <NotificationAvatar tone={item.avatarTone} icon={item.icon} />
      <div className="flex-1">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="text-[13px] font-medium" style={{ color: "var(--admin-text-primary)" }}>
            {item.title}
          </div>
          <span className="shrink-0 text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
            {item.time}
          </span>
        </div>
        <div className="text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>
          {item.body}
        </div>
        {item.actions ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.actions.map((a, i) => (
              <V2Button key={i} size="xs" variant={a.variant}>
                {a.label}
              </V2Button>
            ))}
          </div>
        ) : null}
      </div>
      {item.unread ? (
        <span
          aria-hidden
          className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: "var(--admin-primary)" }}
        />
      ) : null}
    </div>
  );
}

function NotificationAvatar({
  tone,
  icon,
}: {
  tone: NotificationItem["avatarTone"];
  icon: NotificationItem["icon"];
}) {
  const styles: Record<string, React.CSSProperties> = {
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
      {icon === "calendar" ? <CalIcon /> : icon === "alert" ? <AlertIcon /> : icon === "receipt" ? <ReceiptIcon /> : icon === "user-plus" ? <UPIcon /> : icon === "shield-x" ? <ShieldXIcon /> : <EditIcon />}
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
