"use client";

/**
 * My profile — v2 admin-redesign page (2026-05-24).
 * Mockup: docs/zulu-admin-v2.html page-view#profile (lines 936-1026).
 *
 * Layout:
 *   Hero card  — gradient cover, large avatar, name + verified mark + role badge,
 *                meta row (email, location TBD, joined, last seen), Message + Edit
 *                profile actions, 4 stat values, 5-tab section-nav
 *   Body 2/1   — left: Activity bar chart + Recent activity list
 *                right: Personal info + Storage breakdown
 *
 * 2026-05-24 wiring: now backed by useAdminAuth().user for the current user.
 * Activity bar chart and Recent activity render zero/empty state — there's
 * no /api/audit-logs?user_id=X endpoint exposing per-user feed yet (the
 * /platform-admin/audit-logs route is platform-wide and gated). Storage stays
 * static at 0 GB until a File manager backend ships.
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

function tx(t: (k: string) => string, key: string, fallback: string): string {
  const r = t(key);
  return r === key ? fallback : r;
}

function getInitials(name: string): string {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function humanizeRole(raw: string | undefined | null): string {
  if (!raw) return "User";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminRedesignProfilePage() {
  const { t } = useLanguage();
  const { user } = useAdminAuth();
  useDocumentTitle("My profile — ZULU Admin");
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("overview");

  const displayName = user?.name || tx(t, "admin.user.fallback_name", "User");
  const email = user?.email || "—";
  const initials = getInitials(displayName);
  const phone = user?.phone || "—";

  // Role badge: super admin > canonical_role > context.world
  const roleLabel = user?.is_super_admin
    ? tx(t, "admin.profile.role.super_admin", "Super admin")
    : humanizeRole(user?.canonical_role ?? user?.context?.world ?? null);

  const joinedDateText =
    user?.created_at
      ? `${tx(t, "admin.profile.joined", "Joined")} ${formatDateLong(user.created_at)}`
      : tx(t, "admin.profile.joined_unknown", "Joined —");

  return (
    <div>
      {/* Hero card */}
      <V2Card className="mb-4">
        <div
          style={{
            height: 120,
            background:
              "linear-gradient(135deg, var(--admin-primary-light) 0%, var(--admin-success-light) 100%)",
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
                {initials}
              </div>
              <div className="pb-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="text-[20px] font-semibold leading-tight"
                    style={{ color: "var(--admin-text-primary)" }}
                  >
                    {displayName}
                  </span>
                  <CheckBadgeIcon />
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={{
                      backgroundColor: "var(--admin-primary-light)",
                      color: "var(--admin-primary-dark)",
                    }}
                  >
                    {roleLabel}
                  </span>
                </div>
                <div
                  className="mt-2 text-[13px]"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  {user?.companies?.[0]?.name || "ZULU Platform"}
                </div>
                <div
                  className="mt-2 flex flex-wrap gap-4 text-[12px]"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <MailIcon /> {email}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPinIcon /> —
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarIcon /> {joinedDateText}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pb-1.5">
              <V2Button icon={<MessageIcon />}>{tx(t, "admin.profile.message", "Message")}</V2Button>
              <V2Button variant="primary" icon={<PencilIcon />}>
                {tx(t, "admin.profile.edit", "Edit profile")}
              </V2Button>
            </div>
          </div>

          <div
            className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <ProfileStat
              value={String(user?.companies?.length ?? 0)}
              label={tx(t, "admin.profile.stat.companies", "Companies")}
            />
            <ProfileStat
              value={String((user?.roles ?? []).length || (user?.canonical_role ? 1 : 0))}
              label={tx(t, "admin.profile.stat.roles", "Roles assigned")}
            />
            <ProfileStat
              value={user?.is_super_admin ? tx(t, "common.yes", "Yes") : tx(t, "common.no", "No")}
              label={tx(t, "admin.profile.stat.super_admin", "Super admin")}
            />
            <ProfileStat
              value={user?.status ? user.status : tx(t, "admin.profile.stat.active", "Active")}
              label={tx(t, "admin.profile.stat.current_status", "Current status")}
              color={user?.status && user.status !== "active" ? "var(--admin-warning)" : "var(--admin-success)"}
            />
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
                  {tx(t, `admin.profile.tab.${tab.key}`, tab.label)}
                </button>
              );
            })}
          </div>
        </div>
      </V2Card>

      {/* Tab body */}
      {activeTab === "overview" ? (
        <OverviewTab
          displayName={displayName}
          email={email}
          phone={phone}
          roleLabel={roleLabel}
          joinedDateText={joinedDateText}
          lastSeenText={tx(
            t,
            "admin.profile.last_seen_unavailable",
            "Last seen — (Phase 2: needs last_login_at)",
          )}
          activityHeights={EMPTY_ACTIVITY}
          activityPhase2Hint={tx(
            t,
            "admin.profile.activity_phase2",
            "Activity tracking ready in Phase 2 — needs /api/audit-logs?user_id=X endpoint.",
          )}
        />
      ) : null}

      {activeTab !== "overview" ? (
        <V2Card>
          <V2CardBody>
            <div className="py-10 text-center">
              <div
                className="text-[14px] font-semibold"
                style={{ color: "var(--admin-text-primary)" }}
              >
                {tx(t, `admin.profile.tab.${activeTab}`, activeTab)}
              </div>
              <div
                className="mt-1 text-[12px]"
                style={{ color: "var(--admin-text-secondary)" }}
              >
                {tx(
                  t,
                  "admin.profile.tab.phase2_placeholder",
                  "Coming in Phase 2 — backend support needed.",
                )}
              </div>
            </div>
          </V2CardBody>
        </V2Card>
      ) : null}
    </div>
  );
}

const EMPTY_ACTIVITY = new Array(29).fill(0) as number[];

function OverviewTab({
  displayName,
  email,
  phone,
  roleLabel,
  joinedDateText,
  lastSeenText,
  activityHeights,
  activityPhase2Hint,
}: {
  displayName: string;
  email: string;
  phone: string;
  roleLabel: string;
  joinedDateText: string;
  lastSeenText: string;
  activityHeights: number[];
  activityPhase2Hint: string;
}) {
  return (
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
                style={{
                  borderColor: "var(--admin-border)",
                  color: "var(--admin-text-primary)",
                }}
                disabled
              >
                <option value="30">Last 30 days</option>
                <option value="7">Last 7 days</option>
                <option value="90">Last 90 days</option>
              </select>
            }
          />
          <V2CardBody>
            <svg
              viewBox="0 0 600 160"
              preserveAspectRatio="none"
              className="h-[160px] w-full"
            >
              <line x1="0" y1="140" x2="600" y2="140" stroke="var(--admin-border)" />
              <line x1="0" y1="105" x2="600" y2="105" stroke="var(--admin-border)" strokeDasharray="2 4" />
              <line x1="0" y1="70" x2="600" y2="70" stroke="var(--admin-border)" strokeDasharray="2 4" />
              <line x1="0" y1="35" x2="600" y2="35" stroke="var(--admin-border)" strokeDasharray="2 4" />
              {activityHeights.map((h, i) => (
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
            <div
              className="mt-3 text-center text-[11px]"
              style={{ color: "var(--admin-text-tertiary)" }}
            >
              {activityPhase2Hint}
            </div>
          </V2CardBody>
        </V2Card>

        {/* Recent activity */}
        <V2Card>
          <V2CardHeader title="Recent activity" />
          <V2CardBody>
            <div className="py-8 text-center">
              <div
                className="text-[13px] font-medium"
                style={{ color: "var(--admin-text-primary)" }}
              >
                No recent activity yet
              </div>
              <div
                className="mt-1 text-[11px]"
                style={{ color: "var(--admin-text-secondary)" }}
              >
                Phase 2 — needs a per-user audit-logs endpoint.
              </div>
            </div>
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
            <InfoRow label="Phone" value={phone} />
            <InfoRow label="Joined" value={joinedDateText} />
            <InfoRow label="Location" value="—" />
            <InfoRow label="Last seen" value={lastSeenText} />
            <InfoRow
              label="Role"
              value={
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={{
                    backgroundColor: "var(--admin-primary-light)",
                    color: "var(--admin-primary-dark)",
                  }}
                >
                  {roleLabel}
                </span>
              }
              last
            />
          </V2CardBody>
        </V2Card>

        {/* Storage — placeholder until File manager backend ships */}
        <V2Card>
          <V2CardHeader title="Storage" />
          <V2CardBody>
            <div className="text-[22px] font-semibold">
              0 GB{" "}
              <span
                className="text-[13px] font-normal"
                style={{ color: "var(--admin-text-secondary)" }}
              >
                of 10 GB
              </span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--admin-bg-tertiary)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: "0%", backgroundColor: "var(--admin-primary)" }}
              />
            </div>
            <div className="mt-3.5 text-[12px]">
              <StorageRow color="var(--admin-primary)" label="Documents" value="0 GB" />
              <StorageRow color="var(--admin-success)" label="Images" value="0 GB" />
              <StorageRow color="var(--admin-warning)" label="Other" value="0 GB" last />
            </div>
            <div
              className="mt-3 text-[11px]"
              style={{ color: "var(--admin-text-tertiary)" }}
            >
              Real storage data available when File manager backend ships.
            </div>
          </V2CardBody>
        </V2Card>
      </div>
    </div>
  );
}

/* ─── small render helpers ─────────────────────────────────────────────── */

function ProfileStat({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color?: string;
}) {
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
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        {label}
      </span>
      <span style={{ color: "var(--admin-text-secondary)" }}>{value}</span>
    </div>
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

