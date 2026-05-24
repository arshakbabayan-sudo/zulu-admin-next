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
 * 2026-05-24 wiring round 2:
 *   - Activity card + Recent activity now fetch /account/activity (29-day
 *     histogram + recent audit log entries).
 *   - "Last seen" + new "Active today" stat use user.last_login_at.
 *   - Message button → mailto: link.
 *   - Edit profile button → drawer that PATCHes /account/profile.
 *   - Settings tab: edit preferred_language inline.
 *   - Security tab: PIN status from /account/pin + "Manage PIN" link to
 *     /bucket3/pin-settings (in-place change-password is parked because
 *     no /account/change-password endpoint exists).
 *   - Activity tab: full /account/activity list (limit=50).
 *   - Sessions tab: real /account/sessions list with last-used + created
 *     dates + Revoke action per row; current device is pinned + disabled.
 *   - Security tab: Change-password Drawer hitting /account/change-password.
 *   - Profile shows + edits the new `location` column (was hard-coded "—").
 */

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { apiFetchJson, ApiRequestError } from "@/lib/api-client";
import type { ApiSuccessEnvelope } from "@/lib/api-envelope";
import { apiFilesStorageStats, formatBytes, type StorageStats } from "@/lib/file-assets-api";
import {
  V2Button,
  V2Card,
  V2CardBody,
  V2CardHeader,
} from "@/components/ui/v2";
import {
  Drawer,
  DrawerSection,
  FormField,
  Input,
  Select,
} from "@/components/ui";
import { IconButton } from "@/components/ui/v2";
import {
  apiChangePassword,
  apiListAccountSessions,
  apiRevokeAccountSession,
  type AccountSession,
} from "@/lib/account-sessions-api";
import {
  Bell,
  CheckCircle2,
  Edit3,
  FileText,
  Monitor,
  Receipt,
  ShieldCheck,
  Trash2,
} from "lucide-react";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "settings", label: "Settings" },
  { key: "security", label: "Security" },
  { key: "activity", label: "Activity" },
  { key: "sessions", label: "Sessions" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type ActivityItem = {
  id: number;
  category: string;
  action: string;
  subject_type: string | null;
  subject_id: string | null;
  created_at: string;
};

type ActivityData = {
  recent: ActivityItem[];
  histogram: number[]; // length 29
};

type PinStatus = { is_set: boolean; set_at: string | null };

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

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return "—";
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

function humanizeRole(raw: string | undefined | null): string {
  if (!raw) return "User";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeAction(action: string): string {
  return action
    .replace(/[_.-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function activityIcon(category: string): React.ReactNode {
  switch (category) {
    case "data_change":
      return <Edit3 className="h-4 w-4" />;
    case "approval":
      return <CheckCircle2 className="h-4 w-4" />;
    case "financial":
      return <Receipt className="h-4 w-4" />;
    case "contract":
      return <FileText className="h-4 w-4" />;
    case "security":
      return <ShieldCheck className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
}

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hy", label: "Հայերեն (Armenian)" },
  { value: "ru", label: "Русский (Russian)" },
];

type ProfileFormState = {
  name: string;
  phone: string;
  location: string;
  preferred_language: string;
};

export default function AdminRedesignProfilePage() {
  const { t } = useLanguage();
  const { token, user, refreshMe } = useAdminAuth();
  useDocumentTitle("My profile — ZULU Admin");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Activity + PIN state
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [activityErr, setActivityErr] = useState<string | null>(null);
  const [activityLimit, setActivityLimit] = useState<number>(10);
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);

  // Real storage stats from /api/files/storage-stats — wired 2026-05-25.
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);

  // Edit-profile drawer state
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<ProfileFormState>({
    name: "",
    phone: "",
    location: "",
    preferred_language: "en",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Settings tab — inline language edit
  const [settingsLang, setSettingsLang] = useState<string>(user?.preferred_language ?? "en");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsToast, setSettingsToast] = useState<string | null>(null);

  const displayName = user?.name || tx(t, "admin.user.fallback_name", "User");
  const email = user?.email || "—";
  const initials = getInitials(displayName);
  const phone = user?.phone || "—";
  const location =
    (user as (typeof user) & { location?: string | null } | null)?.location ?? null;
  const locationText = location && location.trim() !== "" ? location : null;

  // Role badge: super admin > canonical_role > context.world
  const roleLabel = user?.is_super_admin
    ? tx(t, "admin.profile.role.super_admin", "Super admin")
    : humanizeRole(user?.canonical_role ?? user?.context?.world ?? null);

  const joinedDateText =
    user?.created_at
      ? `${tx(t, "admin.profile.joined", "Joined")} ${formatDateLong(user.created_at)}`
      : tx(t, "admin.profile.joined_unknown", "Joined —");

  // Re-sync settings-tab state when user changes (e.g. after refreshMe).
  useEffect(() => {
    setSettingsLang(user?.preferred_language ?? "en");
  }, [user?.preferred_language]);

  // Load activity for the current limit. Re-runs when the Activity tab is
  // opened with a bigger limit (50).
  const loadActivity = useCallback(
    async (limit: number) => {
      if (!token) return;
      setActivityErr(null);
      try {
        const res = await apiFetchJson<ApiSuccessEnvelope<ActivityData>>(
          `/account/activity?limit=${limit}`,
          { method: "GET", token }
        );
        setActivity(res.data);
      } catch (e) {
        setActivityErr(
          e instanceof ApiRequestError
            ? e.message
            : tx(t, "admin.profile.err_activity", "Failed to load activity")
        );
      }
    },
    [token, t]
  );

  useEffect(() => {
    void loadActivity(activityLimit);
  }, [loadActivity, activityLimit]);

  // Load storage stats once for the Overview tab's Storage card.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFilesStorageStats(token);
        if (!cancelled) setStorageStats(res.data);
      } catch {
        // non-fatal — Storage card falls back to a 0/quota display
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Load PIN status once when the Security tab is opened.
  useEffect(() => {
    if (activeTab !== "security" || !token || pinStatus !== null) return;
    void (async () => {
      try {
        const res = await apiFetchJson<ApiSuccessEnvelope<PinStatus>>(`/account/pin`, {
          method: "GET",
          token,
        });
        setPinStatus(res.data);
      } catch {
        // non-fatal — Security tab still shows a "Manage PIN" link
      }
    })();
  }, [activeTab, token, pinStatus]);

  const openEdit = () => {
    setForm({
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      location: (user as (typeof user) & { location?: string | null } | null)?.location ?? "",
      preferred_language: user?.preferred_language ?? "en",
    });
    setSaveError(null);
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetchJson<ApiSuccessEnvelope<unknown>>(`/account/profile`, {
        method: "PATCH",
        token,
        body: {
          name: form.name.trim() || undefined,
          phone: form.phone.trim() || null,
          location: form.location.trim() || null,
          preferred_language: form.preferred_language,
        },
      });
      await refreshMe();
      setEditOpen(false);
    } catch (e) {
      setSaveError(
        e instanceof ApiRequestError
          ? e.message
          : tx(t, "admin.profile.err_save", "Failed to save profile")
      );
    } finally {
      setSaving(false);
    }
  };

  const saveLanguageInline = async (lang: string) => {
    if (!token) return;
    setSettingsSaving(true);
    setSettingsToast(null);
    try {
      await apiFetchJson<ApiSuccessEnvelope<unknown>>(`/account/profile`, {
        method: "PATCH",
        token,
        body: { preferred_language: lang },
      });
      await refreshMe();
      setSettingsToast(tx(t, "admin.profile.settings_saved", "Settings saved"));
      window.setTimeout(() => setSettingsToast(null), 2500);
    } catch (e) {
      setSettingsToast(
        e instanceof ApiRequestError
          ? e.message
          : tx(t, "admin.profile.err_save", "Failed to save")
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  const lastLoginIso = (user as (typeof user) & { last_login_at?: string | null } | null)
    ?.last_login_at ?? null;
  const lastSeenText = lastLoginIso
    ? formatRelativeTime(lastLoginIso)
    : tx(t, "admin.profile.never_logged_in", "Never");

  // "Active today" — derive from last_login_at when present.
  const activeTodayBool =
    !!lastLoginIso &&
    Number.isFinite(new Date(lastLoginIso).getTime()) &&
    Date.now() - new Date(lastLoginIso).getTime() < 24 * 60 * 60 * 1000;

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
                    <MapPinIcon />
                    {locationText ? (
                      <span>{locationText}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={openEdit}
                        className="underline decoration-dotted underline-offset-2"
                        style={{ color: "var(--admin-text-secondary)" }}
                      >
                        {tx(t, "admin.profile.location_not_set", "Not set (edit)")}
                      </button>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarIcon /> {joinedDateText}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pb-1.5">
              <V2Button
                icon={<MessageIcon />}
                onClick={() => {
                  if (user?.email) {
                    window.location.href = `mailto:${user.email}`;
                  }
                }}
                disabled={!user?.email}
              >
                {tx(t, "admin.profile.message", "Message")}
              </V2Button>
              <V2Button variant="primary" icon={<PencilIcon />} onClick={openEdit}>
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
              value={
                activeTodayBool
                  ? tx(t, "admin.profile.stat.active_today_yes", "Yes")
                  : tx(t, "admin.profile.stat.active_today_no", "No")
              }
              label={tx(t, "admin.profile.stat.active_today", "Active today")}
              color={activeTodayBool ? "var(--admin-success)" : undefined}
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
                  onClick={() => {
                    setActiveTab(tab.key);
                    if (tab.key === "activity") setActivityLimit(50);
                    else if (tab.key === "overview") setActivityLimit(10);
                  }}
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
          locationText={locationText}
          onEditLocation={openEdit}
          roleLabel={roleLabel}
          joinedDateText={joinedDateText}
          lastSeenText={lastSeenText}
          activity={activity}
          activityErr={activityErr}
          storageStats={storageStats}
        />
      ) : null}

      {activeTab === "settings" ? (
        <SettingsTab
          settingsLang={settingsLang}
          setSettingsLang={setSettingsLang}
          onSave={() => void saveLanguageInline(settingsLang)}
          saving={settingsSaving}
          toast={settingsToast}
          tx={(k, fb) => tx(t, k, fb)}
        />
      ) : null}

      {activeTab === "security" ? (
        <SecurityTab
          pinStatus={pinStatus}
          token={token}
          onPasswordChanged={() => {
            void refreshMe();
          }}
          tx={(k, fb) => tx(t, k, fb)}
        />
      ) : null}

      {activeTab === "activity" ? (
        <ActivityTab activity={activity} activityErr={activityErr} tx={(k, fb) => tx(t, k, fb)} />
      ) : null}

      {activeTab === "sessions" ? (
        <SessionsTab token={token} tx={(k, fb) => tx(t, k, fb)} />
      ) : null}

      {/* Edit profile drawer */}
      <Drawer
        open={editOpen}
        onClose={() => (saving ? undefined : setEditOpen(false))}
        title={tx(t, "admin.profile.edit_title", "Edit profile")}
        subtitle={tx(
          t,
          "admin.profile.edit_subtitle",
          "Update your display info. Email + password are managed separately."
        )}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <V2Button onClick={() => setEditOpen(false)} disabled={saving}>
              {tx(t, "common.cancel", "Cancel")}
            </V2Button>
            <V2Button variant="primary" onClick={() => void submitEdit()} disabled={saving}>
              {saving ? tx(t, "common.saving", "Saving…") : tx(t, "common.save", "Save")}
            </V2Button>
          </div>
        }
      >
        <DrawerSection>
          {saveError ? (
            <div className="mb-3 rounded-md border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
              {saveError}
            </div>
          ) : null}
          <FormField label={tx(t, "admin.profile.form.name", "Full name")} htmlFor="prof-name">
            <Input
              id="prof-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={saving}
            />
          </FormField>
        </DrawerSection>
        <DrawerSection>
          <FormField label={tx(t, "admin.profile.form.phone", "Phone")} htmlFor="prof-phone">
            <Input
              id="prof-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+374 ..."
              disabled={saving}
            />
          </FormField>
        </DrawerSection>
        <DrawerSection>
          <FormField
            label={tx(t, "admin.profile.form.location", "Location")}
            htmlFor="prof-location"
            helperText={tx(
              t,
              "admin.profile.form.location_help",
              "City, country, or anything you want colleagues to see."
            )}
          >
            <Input
              id="prof-location"
              value={form.location}
              maxLength={120}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Yerevan, Armenia"
              disabled={saving}
            />
          </FormField>
        </DrawerSection>
        <DrawerSection>
          <FormField
            label={tx(t, "admin.profile.form.preferred_language", "Preferred language")}
            htmlFor="prof-lang"
            helperText={tx(
              t,
              "admin.profile.form.preferred_language_help",
              "Used for emails and admin chrome.",
            )}
          >
            <Select
              id="prof-lang"
              value={form.preferred_language}
              onChange={(e) =>
                setForm((f) => ({ ...f, preferred_language: e.target.value }))
              }
              disabled={saving}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </FormField>
        </DrawerSection>
      </Drawer>
    </div>
  );
}

/* ─── Tab bodies ──────────────────────────────────────────────────────── */

function OverviewTab({
  displayName,
  email,
  phone,
  locationText,
  onEditLocation,
  roleLabel,
  joinedDateText,
  lastSeenText,
  activity,
  activityErr,
  storageStats,
}: {
  displayName: string;
  email: string;
  phone: string;
  locationText: string | null;
  onEditLocation: () => void;
  roleLabel: string;
  joinedDateText: string;
  lastSeenText: string;
  activity: ActivityData | null;
  activityErr: string | null;
  storageStats: StorageStats | null;
}) {
  const heights = activity ? scaleHistogram(activity.histogram) : new Array(29).fill(0);
  const recentPreview = (activity?.recent ?? []).slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        {/* Activity bar chart */}
        <V2Card>
          <V2CardHeader title="Activity" />
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
              {heights.map((h, i) => (
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
              {activityErr
                ? activityErr
                : activity
                  ? `Last 29 days · ${activity.histogram.reduce((a, b) => a + b, 0)} actions`
                  : "Loading…"}
            </div>
          </V2CardBody>
        </V2Card>

        {/* Recent activity */}
        <V2Card>
          <V2CardHeader title="Recent activity" />
          <V2CardBody>
            {recentPreview.length === 0 ? (
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
                  Actions you take in the admin will appear here.
                </div>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--admin-border)" }}>
                {recentPreview.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </ul>
            )}
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
            <InfoRow
              label="Location"
              value={
                locationText ?? (
                  <button
                    type="button"
                    onClick={onEditLocation}
                    className="underline decoration-dotted underline-offset-2 text-[13px] font-medium"
                    style={{ color: "var(--admin-text-secondary)" }}
                  >
                    Not set (edit)
                  </button>
                )
              }
            />
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

        {/* Storage — wired to /api/files/storage-stats (Phase Ե, 2026-05-25) */}
        <V2Card>
          <V2CardHeader title="Storage" />
          <V2CardBody>
            <ProfileStorageBody stats={storageStats} />
          </V2CardBody>
        </V2Card>
      </div>
    </div>
  );
}

function SettingsTab({
  settingsLang,
  setSettingsLang,
  onSave,
  saving,
  toast,
  tx: trans,
}: {
  settingsLang: string;
  setSettingsLang: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  toast: string | null;
  tx: (k: string, fb: string) => string;
}) {
  return (
    <V2Card>
      <V2CardHeader title={trans("admin.profile.settings.title", "Account settings")} />
      <V2CardBody>
        <div className="max-w-md space-y-4">
          <FormField
            label={trans("admin.profile.form.preferred_language", "Preferred language")}
            htmlFor="settings-lang"
            helperText={trans(
              "admin.profile.settings.lang_help",
              "Controls admin chrome + email language."
            )}
          >
            <Select
              id="settings-lang"
              value={settingsLang}
              onChange={(e) => setSettingsLang(e.target.value)}
              disabled={saving}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex items-center gap-3">
            <V2Button variant="primary" onClick={onSave} disabled={saving}>
              {saving
                ? trans("common.saving", "Saving…")
                : trans("admin.profile.settings.save_lang", "Save language")}
            </V2Button>
            {toast ? (
              <span
                className="text-[12px]"
                style={{ color: "var(--admin-success-dark)" }}
              >
                {toast}
              </span>
            ) : null}
          </div>
        </div>
        <p
          className="mt-6 text-[11px]"
          style={{ color: "var(--admin-text-tertiary)" }}
        >
          {trans(
            "admin.profile.settings.notif_phase2",
            "Notification preferences (email digest, in-app pings, mobile push) will land alongside the notification-prefs backend column — Phase 2."
          )}
        </p>
      </V2CardBody>
    </V2Card>
  );
}

function SecurityTab({
  pinStatus,
  token,
  onPasswordChanged,
  tx: trans,
}: {
  pinStatus: PinStatus | null;
  token: string | null;
  onPasswordChanged: () => void;
  tx: (k: string, fb: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [pwForm, setPwForm] = useState({
    current_password: "",
    new_password: "",
    new_password_confirmation: "",
  });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reset = () => {
    setPwForm({ current_password: "", new_password: "", new_password_confirmation: "" });
    setPwError(null);
  };

  const submit = async () => {
    if (!token) return;
    setPwError(null);
    if (pwForm.new_password.length < 8) {
      setPwError(trans("admin.profile.security.pw_min", "New password must be at least 8 characters."));
      return;
    }
    if (pwForm.new_password !== pwForm.new_password_confirmation) {
      setPwError(trans("admin.profile.security.pw_mismatch", "Passwords do not match."));
      return;
    }
    setPwSaving(true);
    try {
      const res = await apiChangePassword(token, pwForm);
      setOpen(false);
      reset();
      const revoked = res.data?.revoked_other_sessions ?? 0;
      setToast(
        revoked > 0
          ? trans("admin.profile.security.pw_changed_revoked", "Password changed. Other devices were signed out.")
          : trans("admin.profile.security.pw_changed", "Password changed.")
      );
      onPasswordChanged();
      window.setTimeout(() => setToast(null), 4000);
    } catch (e) {
      setPwError(
        e instanceof ApiRequestError
          ? e.message
          : trans("admin.profile.security.pw_err", "Failed to change password.")
      );
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <V2Card>
        <V2CardHeader title={trans("admin.profile.security.pin_title", "Account PIN")} />
        <V2CardBody>
          <div className="text-[13px]">
            {pinStatus === null ? (
              <span style={{ color: "var(--admin-text-secondary)" }}>
                {trans("common.loading", "Loading…")}
              </span>
            ) : pinStatus.is_set ? (
              <>
                <span
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={{
                    backgroundColor: "var(--admin-success-light)",
                    color: "var(--admin-success-dark)",
                  }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {trans("admin.profile.security.pin_set", "PIN is set")}
                </span>
                {pinStatus.set_at ? (
                  <span
                    className="ml-2 text-[12px]"
                    style={{ color: "var(--admin-text-secondary)" }}
                  >
                    {trans("admin.profile.security.pin_set_at", "Last updated")}{" "}
                    {formatDateLong(pinStatus.set_at)}
                  </span>
                ) : null}
              </>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                style={{
                  backgroundColor: "var(--admin-warning-light)",
                  color: "var(--admin-warning-dark)",
                }}
              >
                {trans("admin.profile.security.pin_unset", "Not set")}
              </span>
            )}
          </div>
          <p
            className="mt-3 text-[12px]"
            style={{ color: "var(--admin-text-secondary)" }}
          >
            {trans(
              "admin.profile.security.pin_desc",
              "The PIN gates sensitive admin actions like hard-delete and role deletion."
            )}
          </p>
          <div className="mt-4">
            <V2Button as="link" href="/bucket3/pin-settings" variant="primary">
              {trans("admin.profile.security.manage_pin", "Manage PIN")}
            </V2Button>
          </div>
        </V2CardBody>
      </V2Card>

      <V2Card>
        <V2CardHeader title={trans("admin.profile.security.password_title", "Password")} />
        <V2CardBody>
          <p
            className="text-[12px]"
            style={{ color: "var(--admin-text-secondary)" }}
          >
            {trans(
              "admin.profile.security.password_desc",
              "Change your sign-in password. Other devices will be signed out automatically; this device stays signed in."
            )}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <V2Button variant="primary" onClick={() => setOpen(true)}>
              {trans("admin.profile.security.change_password", "Change password")}
            </V2Button>
            {toast ? (
              <span className="text-[12px]" style={{ color: "var(--admin-success-dark)" }}>
                {toast}
              </span>
            ) : null}
          </div>
        </V2CardBody>
      </V2Card>

      <Drawer
        open={open}
        onClose={() => (pwSaving ? undefined : (setOpen(false), reset()))}
        title={trans("admin.profile.security.change_password", "Change password")}
        subtitle={trans(
          "admin.profile.security.change_password_subtitle",
          "Verify your current password, then pick a new one (min 8 characters)."
        )}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <V2Button
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={pwSaving}
            >
              {trans("common.cancel", "Cancel")}
            </V2Button>
            <V2Button variant="primary" onClick={() => void submit()} disabled={pwSaving}>
              {pwSaving
                ? trans("common.saving", "Saving…")
                : trans("admin.profile.security.change_password", "Change password")}
            </V2Button>
          </div>
        }
      >
        <DrawerSection>
          {pwError ? (
            <div className="mb-3 rounded-md border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
              {pwError}
            </div>
          ) : null}
          <FormField
            label={trans("admin.profile.security.current_password", "Current password")}
            htmlFor="pw-current"
          >
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={pwForm.current_password}
              onChange={(e) =>
                setPwForm((f) => ({ ...f, current_password: e.target.value }))
              }
              disabled={pwSaving}
            />
          </FormField>
        </DrawerSection>
        <DrawerSection>
          <FormField
            label={trans("admin.profile.security.new_password", "New password")}
            htmlFor="pw-new"
            helperText={trans("admin.profile.security.pw_new_help", "Minimum 8 characters.")}
          >
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={pwForm.new_password}
              onChange={(e) =>
                setPwForm((f) => ({ ...f, new_password: e.target.value }))
              }
              disabled={pwSaving}
            />
          </FormField>
        </DrawerSection>
        <DrawerSection>
          <FormField
            label={trans("admin.profile.security.confirm_password", "Confirm new password")}
            htmlFor="pw-confirm"
          >
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={pwForm.new_password_confirmation}
              onChange={(e) =>
                setPwForm((f) => ({ ...f, new_password_confirmation: e.target.value }))
              }
              disabled={pwSaving}
            />
          </FormField>
        </DrawerSection>
      </Drawer>
    </div>
  );
}

function ActivityTab({
  activity,
  activityErr,
  tx: trans,
}: {
  activity: ActivityData | null;
  activityErr: string | null;
  tx: (k: string, fb: string) => string;
}) {
  return (
    <V2Card>
      <V2CardHeader title={trans("admin.profile.activity.title", "Activity log")} />
      <V2CardBody>
        {activityErr ? (
          <div className="rounded-md border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
            {activityErr}
          </div>
        ) : !activity ? (
          <div className="py-6 text-center text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
            {trans("common.loading", "Loading…")}
          </div>
        ) : activity.recent.length === 0 ? (
          <div className="py-8 text-center">
            <div
              className="text-[13px] font-medium"
              style={{ color: "var(--admin-text-primary)" }}
            >
              {trans("admin.profile.activity.empty", "No activity yet")}
            </div>
            <div
              className="mt-1 text-[11px]"
              style={{ color: "var(--admin-text-secondary)" }}
            >
              {trans(
                "admin.profile.activity.empty_hint",
                "Actions you take in the admin will appear here."
              )}
            </div>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--admin-border)" }}>
            {activity.recent.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </V2CardBody>
    </V2Card>
  );
}

function SessionsTab({
  token,
  tx: trans,
}: {
  token: string | null;
  tx: (k: string, fb: string) => string;
}) {
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const res = await apiListAccountSessions(token);
      setSessions(res.data);
    } catch (e) {
      setErr(
        e instanceof ApiRequestError
          ? e.message
          : trans("admin.profile.sessions.err", "Failed to load sessions.")
      );
    }
  }, [token, trans]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: number) => {
    if (!token) return;
    setBusyId(id);
    setErr(null);
    try {
      await apiRevokeAccountSession(token, id);
      setToast(trans("admin.profile.sessions.revoked", "Session revoked."));
      window.setTimeout(() => setToast(null), 2500);
      await load();
    } catch (e) {
      setErr(
        e instanceof ApiRequestError
          ? e.message
          : trans("admin.profile.sessions.revoke_err", "Failed to revoke session.")
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <V2Card>
      <V2CardHeader title={trans("admin.profile.sessions.title", "Active sessions")} />
      <V2CardBody>
        {err ? (
          <div className="mb-3 rounded-md border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
            {err}
          </div>
        ) : null}
        {toast ? (
          <div className="mb-3 text-[12px]" style={{ color: "var(--admin-success-dark)" }}>
            {toast}
          </div>
        ) : null}
        {sessions === null ? (
          <div className="py-6 text-center text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
            {trans("common.loading", "Loading…")}
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-[13px] font-medium" style={{ color: "var(--admin-text-primary)" }}>
              {trans("admin.profile.sessions.empty", "No active sessions on file.")}
            </div>
            <div className="mt-1 text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
              {trans(
                "admin.profile.sessions.empty_hint",
                "Each device you sign in from shows up here."
              )}
            </div>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--admin-border)" }}>
            {sessions.map((s) => (
              <li key={s.id} className="flex items-start gap-3 py-3">
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: s.is_current
                      ? "var(--admin-success-light)"
                      : "var(--admin-primary-light)",
                    color: s.is_current
                      ? "var(--admin-success-dark)"
                      : "var(--admin-primary-dark)",
                  }}
                >
                  <Monitor className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>
                      {s.name || trans("admin.profile.sessions.unnamed", "Unnamed session")}
                    </span>
                    {s.is_current ? (
                      <span
                        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3px]"
                        style={{
                          backgroundColor: "var(--admin-success-light)",
                          color: "var(--admin-success-dark)",
                        }}
                      >
                        {trans("admin.profile.sessions.this_device", "This device")}
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]"
                    style={{ color: "var(--admin-text-secondary)" }}
                  >
                    <span>
                      {trans("admin.profile.sessions.created", "Created")}{" "}
                      {formatDateLong(s.created_at)}
                    </span>
                    <span>
                      {trans("admin.profile.sessions.last_used", "Last used")}{" "}
                      {s.last_used_at ? formatRelativeTime(s.last_used_at) : "—"}
                    </span>
                    {s.expires_at ? (
                      <span>
                        {trans("admin.profile.sessions.expires", "Expires")}{" "}
                        {formatDateLong(s.expires_at)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <IconButton
                    aria-label={trans("admin.profile.sessions.revoke", "Revoke session")}
                    onClick={() => void revoke(s.id)}
                    disabled={s.is_current || busyId === s.id}
                    title={
                      s.is_current
                        ? trans("admin.profile.sessions.cannot_revoke_current", "Sign out to end this device's session.")
                        : trans("admin.profile.sessions.revoke", "Revoke session")
                    }
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 text-[11px]" style={{ color: "var(--admin-text-tertiary)" }}>
          {trans(
            "admin.profile.sessions.note",
            "Each row is one Sanctum personal access token. Revoking ends that device's session immediately."
          )}
        </div>
      </V2CardBody>
    </V2Card>
  );
}

/* ─── small render helpers ─────────────────────────────────────────────── */

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: "var(--admin-primary-light)",
          color: "var(--admin-primary-dark)",
        }}
      >
        {activityIcon(item.category)}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] font-medium"
          style={{ color: "var(--admin-text-primary)" }}
        >
          {humanizeAction(item.action)}
        </div>
        <div className="text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
          {item.subject_type ? `${item.subject_type}${item.subject_id ? ` #${item.subject_id}` : ""} · ` : ""}
          {formatRelativeTime(item.created_at)}
        </div>
      </div>
    </li>
  );
}

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

function ProfileStorageBody({ stats }: { stats: StorageStats | null }) {
  if (!stats) {
    return (
      <div className="text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
        Loading…
      </div>
    );
  }
  const pct =
    stats.quota_bytes > 0
      ? Math.min(100, Math.round((stats.total_bytes / stats.quota_bytes) * 100))
      : 0;
  const docs =
    (stats.by_bucket.application?.bytes ?? 0) + (stats.by_bucket.text?.bytes ?? 0);
  const images = stats.by_bucket.image?.bytes ?? 0;
  const media =
    (stats.by_bucket.video?.bytes ?? 0) + (stats.by_bucket.audio?.bytes ?? 0);
  const other = stats.by_bucket.other?.bytes ?? 0;
  return (
    <>
      <div className="text-[22px] font-semibold">
        {formatBytes(stats.total_bytes)}{" "}
        <span
          className="text-[13px] font-normal"
          style={{ color: "var(--admin-text-secondary)" }}
        >
          of {formatBytes(stats.quota_bytes)}
        </span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--admin-bg-tertiary)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: "var(--admin-primary)" }}
        />
      </div>
      <div className="mt-3.5 text-[12px]">
        <StorageRow color="var(--admin-primary)" label="Documents" value={formatBytes(docs)} />
        <StorageRow color="var(--admin-success)" label="Images" value={formatBytes(images)} />
        <StorageRow color="var(--admin-info)" label="Media" value={formatBytes(media)} />
        <StorageRow color="var(--admin-warning)" label="Other" value={formatBytes(other)} last />
      </div>
      <div
        className="mt-3 text-[11px]"
        style={{ color: "var(--admin-text-tertiary)" }}
      >
        {stats.total_count} {stats.total_count === 1 ? "file" : "files"} across all folders.
      </div>
    </>
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

/** Scale a 29-point histogram to bar heights for the 160px-tall SVG (max 130px). */
function scaleHistogram(values: number[]): number[] {
  const max = Math.max(1, ...values);
  return values.map((v) => Math.round((v / max) * 130));
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
