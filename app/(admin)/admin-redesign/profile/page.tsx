"use client";

/**
 * My profile — v2 admin-redesign page (2026-05-24).
 * Mockup: docs/zulu-admin-v2.html page-view#profile (lines 936-1026).
 *
 * Layout:
 *   Hero card  — gradient cover, large avatar, name + verified mark + role badge,
 *                meta row (email, location, joined), Message + Edit profile actions,
 *                4 stat values (Projects led / Revenue / Files / Status),
 *                5-tab section-nav (Overview / Settings / Security / Activity / Sessions)
 *   Body 2/1   — left: Activity bar chart + Recent activity list
 *                right: Personal info + Storage breakdown
 *
 * Data is static demo for the current logged-in user; real profile/activity
 * wiring is Phase Ե.
 */

import { useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { V2Button, V2Card, V2CardBody, V2CardHeader } from "@/components/ui/v2";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "settings", label: "Settings" },
  { key: "security", label: "Security" },
  { key: "activity", label: "Activity" },
  { key: "sessions", label: "Sessions" },
] as const;

const ACTIVITY_HEIGHTS = [60, 85, 50, 110, 70, 95, 55, 120, 80, 100, 65, 125, 85, 75, 105, 90, 60, 115, 80, 100, 70, 110, 85, 65, 120, 95, 75, 105, 90];

const RECENT_ACTIVITY = [
  {
    icon: "upload",
    title: "contract-marriott.pdf",
    body: "Uploaded",
    time: "2 hours ago",
    avatarTone: "teal" as const,
  },
  {
    icon: "user-plus",
    title: "Դավիթ Հակոբյան",
    body: "Invited as Viewer",
    time: "Yesterday at 14:32",
    avatarTone: "purple" as const,
  },
  {
    icon: "edit",
    title: "Admin role",
    body: "Updated permissions",
    time: "May 20, 2026",
    avatarTone: "amber" as const,
  },
  {
    icon: "login",
    title: "Yerevan, Armenia",
    body: "Signed in from",
    time: "May 19, 2026",
    avatarTone: "blue" as const,
  },
];

function tx(t: (k: string) => string, key: string, fallback: string): string {
  const r = t(key);
  return r === key ? fallback : r;
}

export default function AdminRedesignProfilePage() {
  const { t } = useLanguage();
  const { user } = useAdminAuth();
  useDocumentTitle("My profile — ZULU Admin");
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("overview");

  const displayName = user?.name || tx(t, "admin.user.fallback_name", "User");
  const email = user?.email || "—";
  const initial = displayName.slice(0, 2).toUpperCase();
  const roleLabel = user?.context?.world || "User";

  return (
    <div>
      {/* Hero card */}
      <V2Card className="mb-4">
        <div
          style={{
            height: 120,
            background: "linear-gradient(135deg, var(--admin-primary-light) 0%, var(--admin-success-light) 100%)",
          }}
        />
        <div className="px-6 pb-5">
          <div className="-mt-[50px] flex flex-wrap items-end justify-between gap-3.5">
            <div className="flex flex-wrap items-end gap-4">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] text-[26px] font-semibold text-white"
                style={{
                  backgroundColor: "var(--admin-primary)",
                  borderColor: "white",
                }}
              >
                {initial}
              </div>
              <div className="pb-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[20px] font-semibold leading-tight" style={{ color: "var(--admin-text-primary)" }}>
                    {displayName}
                  </span>
                  <CheckBadgeIcon />
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={{ backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" }}
                  >
                    {roleLabel}
                  </span>
                </div>
                <div className="mt-2 text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>
                  ZULU Platform
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                  <span className="inline-flex items-center gap-1.5">
                    <MailIcon /> {email}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPinIcon /> Yerevan, Armenia
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarIcon /> Joined Jan 2024
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pb-1.5">
              <V2Button icon={<MessageIcon />}>Message</V2Button>
              <V2Button variant="primary" icon={<PencilIcon />}>
                Edit profile
              </V2Button>
            </div>
          </div>

          <div
            className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <ProfileStat value="142" label="Projects led" />
            <ProfileStat value="$12,440" label="Revenue generated" />
            <ProfileStat value="328" label="Files uploaded" />
            <ProfileStat value="Active" label="Current status" color="var(--admin-success)" />
          </div>

          {/* Section tabs (underline) */}
          <div
            className="mt-5 -mx-6 flex gap-1 overflow-x-auto border-b px-6"
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
                  className="-mb-px inline-flex h-[38px] items-center border-b-2 px-3.5 text-[13px] font-medium transition"
                  style={{
                    color: active ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                    borderBottomColor: active ? "var(--admin-primary)" : "transparent",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </V2Card>

      {/* 2/1 body grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Activity bar chart */}
          <V2Card>
            <V2CardHeader
              title="Activity"
              action={
                <select
                  defaultValue="30"
                  className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none"
                  style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }}
                >
                  <option value="30">Last 30 days</option>
                  <option value="7">Last 7 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              }
            />
            <V2CardBody>
              <svg viewBox="0 0 600 160" preserveAspectRatio="none" className="h-[160px] w-full">
                <line x1="0" y1="140" x2="600" y2="140" stroke="var(--admin-border)" />
                <line x1="0" y1="105" x2="600" y2="105" stroke="var(--admin-border)" strokeDasharray="2 4" />
                <line x1="0" y1="70" x2="600" y2="70" stroke="var(--admin-border)" strokeDasharray="2 4" />
                <line x1="0" y1="35" x2="600" y2="35" stroke="var(--admin-border)" strokeDasharray="2 4" />
                {ACTIVITY_HEIGHTS.map((h, i) => (
                  <rect
                    key={i}
                    x={10 + i * 20}
                    y={140 - h}
                    width={14}
                    height={h}
                    fill="var(--admin-primary)"
                    rx={2}
                  />
                ))}
              </svg>
            </V2CardBody>
          </V2Card>

          {/* Recent activity */}
          <V2Card>
            <V2CardHeader title="Recent activity" />
            <V2CardBody>
              {RECENT_ACTIVITY.map((item, idx) => {
                const isLast = idx === RECENT_ACTIVITY.length - 1;
                return (
                  <div
                    key={idx}
                    className={`flex gap-3 ${isLast ? "" : "mb-4 border-b pb-3.5"}`}
                    style={isLast ? undefined : { borderColor: "var(--admin-border)" }}
                  >
                    <ActivityAvatar tone={item.avatarTone} icon={item.icon} />
                    <div className="flex-1">
                      <div className="text-[13px]">
                        {item.body} <span className="font-medium">{item.title}</span>
                      </div>
                      <div className="mt-1 text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {item.time}
                      </div>
                    </div>
                  </div>
                );
              })}
            </V2CardBody>
          </V2Card>
        </div>

        <div className="space-y-4">
          {/* Personal info */}
          <V2Card>
            <V2CardHeader title="Personal info" />
            <V2CardBody>
              <InfoRow label="Full name" value={displayName} />
              <InfoRow label="Email" value={email} />
              <InfoRow label="Phone" value="+374 99 12 34 56" />
              <InfoRow
                label="Role"
                value={
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={{ backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" }}
                  >
                    {roleLabel}
                  </span>
                }
              />
              <InfoRow
                label="2-factor auth"
                value={
                  <span className="inline-flex items-center gap-2" style={{ color: "var(--admin-success)" }}>
                    <ShieldCheckIcon />
                    <span className="font-medium">Enabled</span>
                  </span>
                }
                last
              />
            </V2CardBody>
          </V2Card>

          {/* Storage */}
          <V2Card>
            <V2CardHeader title="Storage" />
            <V2CardBody>
              <div className="text-[22px] font-semibold">
                6.8 GB <span className="text-[13px] font-normal" style={{ color: "var(--admin-text-secondary)" }}>of 10 GB</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--admin-bg-tertiary)" }}>
                <div className="h-full rounded-full" style={{ width: "68%", backgroundColor: "var(--admin-primary)" }} />
              </div>
              <div className="mt-3.5 text-[12px]">
                <StorageRow color="var(--admin-primary)" label="Documents" value="3.2 GB" />
                <StorageRow color="var(--admin-success)" label="Images" value="2.1 GB" />
                <StorageRow color="var(--admin-warning)" label="Other" value="1.5 GB" last />
              </div>
            </V2CardBody>
          </V2Card>
        </div>
      </div>

      <p className="mt-4 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
        🚧 <strong>Placeholder data</strong> — իրական profile/activity/storage wiring-ը Փուլ Ե-ում։
      </p>
    </div>
  );
}

/* ─── small render helpers ─────────────────────────────────────────────── */

function ProfileStat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div>
      <div className="text-[22px] font-semibold" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
        {label}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-3"}>
      <div className="text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
        {label}
      </div>
      <div className="mt-1.5 text-[13px] font-medium">{value}</div>
    </div>
  );
}

function StorageRow({
  color,
  label,
  value,
  last,
}: {
  color: string;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`flex justify-between ${last ? "" : "mb-2"}`}>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span style={{ color: "var(--admin-text-secondary)" }}>{value}</span>
    </div>
  );
}

function ActivityAvatar({ tone, icon }: { tone: "teal" | "purple" | "amber" | "blue"; icon: string }) {
  const styles: Record<string, React.CSSProperties> = {
    purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
    teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  };
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
      style={styles[tone]}
      aria-hidden
    >
      {icon === "upload" ? <UploadIcon /> : icon === "user-plus" ? <UserPlusIcon /> : icon === "edit" ? <PencilIcon /> : <LoginIcon />}
    </span>
  );
}

/* ─── icon helpers ─────────────────────────────────────────────────────── */

function CheckBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="var(--admin-primary)" aria-hidden>
      <path d="M12 1.6 9.5 4l-3.4-.4-.4 3.4L1.6 12 4 14.5l-.4 3.4 3.4-.4L9.5 20 12 22.4 14.5 20l3.4.4.4-3.4L22.4 12 20 9.5l.4-3.4-3.4.4L14.5 4 12 1.6Zm-1.4 14L7 12l1.4-1.4 2.2 2.2 5-5L17 9.2l-6.4 6.4Z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={3} y={5} width={18} height={14} rx={2} />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12Z" />
      <circle cx={12} cy={10} r={2.5} />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={3} y={4} width={18} height={18} rx={2} />
      <line x1={3} y1={10} x2={21} y2={10} />
      <line x1={8} y1={2} x2={8} y2={6} />
      <line x1={16} y1={2} x2={16} y2={6} />
    </svg>
  );
}
function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1={12} y1={3} x2={12} y2={15} />
    </svg>
  );
}
function UserPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx={9} cy={7} r={4} />
      <line x1={20} y1={8} x2={20} y2={14} />
      <line x1={17} y1={11} x2={23} y2={11} />
    </svg>
  );
}
function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1={15} y1={12} x2={3} y2={12} />
    </svg>
  );
}
