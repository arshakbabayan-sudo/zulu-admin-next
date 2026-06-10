"use client";

/**
 * My profile cluster panes — Account · My company · My agents.
 *
 * Port of docs/admin_designe/my-profile/my-profile.html (cp-account /
 * cp-mycompany / cp-myagents) into the unified CRM surface (CrmPage.tsx).
 * Styled with the management.css design system (the same hero-card / card /
 * tile-grid / sub-tabs primitives the rest of CrmPage uses) and wired to the
 * REAL backend (the mock's data was static placeholder).
 *
 * My team reuses the existing <TeamPane> from CrmPage (the People→Team pill).
 *
 * Endpoints:
 *   Account      → PATCH /account/profile · GET /account/activity · GET
 *                  /account/pin · GET/DELETE /account/sessions · POST
 *                  /account/change-password · GET /api/files/storage-stats ·
 *                  <AdminTwoFactorCard> (2FA enable/disable)
 *   My company   → <SellerStatusCard> (GET/POST companies/{id}/seller-
 *                  applications) + <StripeConnectCard> (GET status / POST
 *                  onboarding-link)
 *   My agents    → GET /connections (active connections to agent agencies) +
 *                  <CompanyCommissionTab> (GET/PATCH operator commission-
 *                  settings + per-agent override). Per-agent stats are
 *                  placeholders pending a backend aggregation endpoint.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiSuccessEnvelope } from "@/lib/api-envelope";
import { crmStrings } from "./crm-i18n";
import type { PaneProps, TeamUser } from "./CrmPage";
import { SellerStatusCard } from "@/components/company/SellerStatusCard";
import { StripeConnectCard } from "@/components/company/StripeConnectCard";
import { AdminTwoFactorCard } from "@/components/account/AdminTwoFactorCard";
import CompanyCommissionTab from "@/components/CompanyCommissionTab";
import { apiFilesStorageStats, formatBytes, type StorageStats } from "@/lib/file-assets-api";
import {
  apiListAccountSessions,
  apiRevokeAccountSession,
  apiChangePassword,
  type AccountSession,
} from "@/lib/account-sessions-api";
import { apiConnectionsList, type ConnectionRow } from "@/lib/connections-api";

type MyProfilePaneProps = PaneProps & { user: TeamUser | null };

// ── local helpers (kept module-local to avoid a circular import on CrmPage) ──
function initials(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function fmtDate(input: string | null | undefined): string {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB");
}

function fmtDateTime(input: string | null | undefined): string {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function relativeTime(input: string | null | undefined): string {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB");
}

function humanize(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw.replace(/[_.-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Resolve the caller's own company id the same way the seller-status /
 *  payments pages do (active company first, then first owned company). */
function resolveCompanyId(user: TeamUser | null): number | null {
  if (!user) return null;
  const fromContext = user.context?.active_company_id;
  if (typeof fromContext === "number" && fromContext > 0) return fromContext;
  const first = user.companies?.[0]?.id;
  if (typeof first === "number" && first > 0) return first;
  return null;
}

// ════════════════════════════════════════════════════════════════
// Account pane — hero + 4 tiles + 5 sub-tabs (everyone)
// ════════════════════════════════════════════════════════════════
type AcTab = "overview" | "settings" | "security" | "activity" | "sessions";

type ActivityItem = {
  id: number;
  category: string;
  action: string;
  subject_type: string | null;
  subject_id: string | null;
  created_at: string;
};
type ActivityData = { recent: ActivityItem[]; histogram: number[] };
type PinStatus = { is_set: boolean; set_at: string | null };

export function AccountPane({ token, user, lang, registerAction, showToast }: MyProfilePaneProps) {
  const s = crmStrings(lang);
  const { refreshMe } = useAdminAuth();
  const [tab, setTab] = useState<AcTab>("overview");
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [pin, setPin] = useState<PinStatus | null>(null);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const displayName = user?.name ?? "—";
  const email = user?.email ?? "—";
  const phone = user?.phone ?? "—";
  const location =
    (user as (TeamUser & { location?: string | null }) | null)?.location ?? null;
  const lastLogin =
    (user as (TeamUser & { last_login_at?: string | null }) | null)?.last_login_at ?? null;
  const roleLabel = user?.is_super_admin
    ? s.superAdmin
    : humanize(user?.canonical_role ?? user?.roles?.[0] ?? null);
  const companyName = user?.companies?.[0]?.name ?? "ZULU";
  const emailVerified =
    (user as (TeamUser & { email_verified_at?: string | null }) | null)?.email_verified_at != null;

  // top-right action: Edit profile (hidden on tabs that don't need it? keep always)
  useEffect(() => {
    registerAction(
      <button className="btn btn-primary" onClick={() => setEditOpen(true)}>
        <i className="ti ti-edit" />
        {s.acActEditProfile}
      </button>
    );
    return () => registerAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // activity (29-day histogram + recent) — Overview + Activity tabs
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetchJson<ApiSuccessEnvelope<ActivityData>>(
          `/account/activity?limit=50`,
          { method: "GET", token }
        );
        if (!cancelled) setActivity(res.data);
      } catch {
        /* non-fatal */
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // storage stats — Overview tab tile + card
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFilesStorageStats(token);
        if (!cancelled) setStorage(res.data);
      } catch {
        /* non-fatal */
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // active session count — Sessions tile (same source as the Sessions sub-tab)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiListAccountSessions(token);
        if (!cancelled) setSessionCount(res.data.length);
      } catch {
        /* non-fatal */
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // PIN status — Security tab
  useEffect(() => {
    if (tab !== "security" || !token || pin !== null) return;
    void (async () => {
      try {
        const res = await apiFetchJson<ApiSuccessEnvelope<PinStatus>>(`/account/pin`, {
          method: "GET",
          token,
        });
        setPin(res.data);
      } catch {
        /* non-fatal */
      }
    })();
  }, [tab, token, pin]);

  const totalActions = activity ? activity.histogram.reduce((a, b) => a + b, 0) : 0;
  const storageUsed = storage ? formatBytes(storage.total_bytes) : "—";
  const storagePct =
    storage && storage.quota_bytes > 0
      ? Math.min(100, Math.round((storage.total_bytes / storage.quota_bytes) * 100))
      : 0;

  return (
    <div className="ac-pane-host">
      {/* hero */}
      <div className="hero-card">
        <div className="hero-avatar">{initials(displayName)}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="hero-name">
            <span>{displayName}</span>
            <span className="badge badge-primary">{roleLabel}</span>
            {emailVerified ? (
              <span className="verif">
                <i className="ti ti-rosette-discount-check" style={{ fontSize: 13 }} />
                {s.acVerified}
              </span>
            ) : null}
          </div>
          <div className="hero-meta">
            <span><i className="ti ti-building" style={{ fontSize: 14 }} /> {companyName}</span>
            <span><i className="ti ti-mail" style={{ fontSize: 14 }} /> {email}</span>
            {location ? (
              <span><i className="ti ti-map-pin" style={{ fontSize: 14 }} /> {location}</span>
            ) : null}
            {user?.created_at ? (
              <span><i className="ti ti-calendar" style={{ fontSize: 14 }} /> {s.acFldJoined} {fmtDate(user.created_at)}</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* tiles — each label honestly matches its data source:
          Actions = 30-day activity histogram sum · Files = storage file count ·
          Active sessions = real session list length · Storage = bytes used. */}
      <div className="tile-grid">
        <div className="tile">
          <div className="tile-v">{totalActions || "—"}</div>
          <div className="tile-l">{s.acTileActions}</div>
        </div>
        <div className="tile">
          <div className="tile-v">{storage ? storage.total_count : "—"}</div>
          <div className="tile-l">{s.acTileFiles}</div>
        </div>
        <div className="tile">
          <div className="tile-v">{sessionCount ?? "—"}</div>
          <div className="tile-l">{s.acTileSessions}</div>
        </div>
        <div className="tile">
          <div className="tile-v">{storageUsed}</div>
          <div className="tile-l">{s.acTileStorage}</div>
        </div>
      </div>

      {/* sub-tabs */}
      <div className="sub-tabs">
        {([
          ["overview", s.acTabOverview],
          ["settings", s.acTabSettings],
          ["security", s.acTabSecurity],
          ["activity", s.acTabActivity],
          ["sessions", s.acTabSessions],
        ] as Array<[AcTab, string]>).map(([key, label]) => (
          <button
            key={key}
            className={`sub-tab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <AccountOverview
          lang={lang}
          activity={activity}
          displayName={displayName}
          email={email}
          phone={phone}
          location={location}
          joined={user?.created_at ?? null}
          lastLogin={lastLogin}
          roleLabel={roleLabel}
          storage={storage}
          storageUsed={storageUsed}
          storagePct={storagePct}
        />
      ) : null}

      {tab === "settings" ? (
        <AccountSettings lang={lang} token={token} onSaved={refreshMe} showToast={showToast} />
      ) : null}

      {tab === "security" ? (
        <AccountSecurity lang={lang} token={token} pin={pin} onChangePassword={() => setPwOpen(true)} />
      ) : null}

      {tab === "activity" ? <AccountActivityLog lang={lang} activity={activity} /> : null}

      {tab === "sessions" ? <AccountSessions lang={lang} token={token} showToast={showToast} /> : null}

      <EditProfileDrawer
        open={editOpen}
        lang={lang}
        token={token}
        user={user}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); void refreshMe(); showToast(s.acSavedToast); }}
      />
      <ChangePasswordDrawer
        open={pwOpen}
        lang={lang}
        token={token}
        onClose={() => setPwOpen(false)}
        onSaved={(msg) => { setPwOpen(false); showToast(msg); }}
      />
    </div>
  );
}

function AccountOverview({
  lang,
  activity,
  displayName,
  email,
  phone,
  location,
  joined,
  lastLogin,
  roleLabel,
  storage,
  storageUsed,
  storagePct,
}: {
  lang: string;
  activity: ActivityData | null;
  displayName: string;
  email: string;
  phone: string;
  location: string | null;
  joined: string | null;
  lastLogin: string | null;
  roleLabel: string;
  storage: StorageStats | null;
  storageUsed: string;
  storagePct: number;
}) {
  const s = crmStrings(lang);
  const histogram = activity?.histogram ?? new Array(29).fill(0);
  const max = Math.max(1, ...histogram);
  const recent = (activity?.recent ?? []).slice(0, 5);
  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">{s.acActivityTitle}</div>
            <div className="card-subtitle">{s.acActivitySub}</div>
          </div>
        </div>
        <div className="card-body">
          <div className="barchart">
            {histogram.map((v, i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: `${Math.round((v / max) * 100)}%`,
                  minHeight: 2,
                  background: "var(--primary)",
                  borderRadius: 2,
                  display: "block",
                }}
              />
            ))}
          </div>
          <div className="bc-axis"><span>{s.acBcDaysAgo}</span><span>{s.acBcToday}</span></div>
        </div>
      </div>
      <div className="detail-card-grid">
        <div className="card">
          <div className="card-header"><div className="card-title">{s.acRecentTitle}</div></div>
          <div className="card-body">
            {recent.length === 0 ? (
              <span className="cell-muted">{s.acRecentEmpty}</span>
            ) : (
              recent.map((item) => (
                <div className="act-item" key={item.id}>
                  <span className="act-ic"><i className="ti ti-point" /></span>
                  <div className="act-body">
                    <div className="act-title">{humanize(item.action)}</div>
                    <div className="act-time">
                      {item.subject_type ? `${item.subject_type}${item.subject_id ? ` #${item.subject_id}` : ""} · ` : ""}
                      {relativeTime(item.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <div className="card">
            <div className="card-header"><div className="card-title">{s.acPersonalTitle}</div></div>
            <div className="card-body">
              <div className="info-grid">
                <div className="info-row"><span className="info-label">{s.acFldName}</span><span className="info-value">{displayName}</span></div>
                <div className="info-row"><span className="info-label">{s.acFldEmail}</span><span className="info-value">{email}</span></div>
                <div className="info-row"><span className="info-label">{s.acFldPhone}</span><span className="info-value">{phone}</span></div>
                <div className="info-row"><span className="info-label">{s.acFldJoined}</span><span className="info-value">{fmtDate(joined)}</span></div>
                <div className="info-row"><span className="info-label">{s.acFldLocation}</span><span className="info-value">{location ?? "—"}</span></div>
                <div className="info-row"><span className="info-label">{s.acFldLastLogin}</span><span className="info-value">{lastLogin ? fmtDateTime(lastLogin) : "—"}</span></div>
                <div className="info-row"><span className="info-label">{s.acFldRole}</span><span className="info-value">{roleLabel}</span></div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">{s.acStorageTitle}</div></div>
            <div className="card-body">
              <div className="storage-bar"><span style={{ width: `${storagePct}%` }} /></div>
              <div className="fm-storage-used">
                {storage ? `${storageUsed} ${s.acStorageOf} ${formatBytes(storage.quota_bytes)} ${s.acStorageUsed}` : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hy", label: "Հայերեն" },
  { value: "ru", label: "Русский" },
];

function AccountSettings({
  lang,
  token,
  onSaved,
  showToast,
}: {
  lang: string;
  token: string | null;
  onSaved: () => Promise<void> | void;
  showToast: (msg: string) => void;
}) {
  const s = crmStrings(lang);
  const { user } = useAdminAuth();
  const [displayLang, setDisplayLang] = useState(user?.preferred_language ?? "en");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayLang(user?.preferred_language ?? "en");
  }, [user?.preferred_language]);

  async function saveLang() {
    if (!token) return;
    setSaving(true);
    try {
      await apiFetchJson(`/account/profile`, {
        method: "PATCH",
        token,
        body: { preferred_language: displayLang },
      });
      await onSaved();
      showToast(s.acLangSavedToast);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ maxWidth: 680 }}>
        <div className="card-header">
          <div>
            <div className="card-title">{s.acSettingsLangTitle}</div>
            <div className="card-subtitle">{s.acSettingsLangSub}</div>
          </div>
        </div>
        <div className="card-body">
          <div className="fld" style={{ maxWidth: 280 }}>
            <span className="fld-label">{s.acFldDisplayLang}</span>
            <select value={displayLang} onChange={(e) => setDisplayLang(e.target.value)}>
              {LANG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="card-foot">
          <button className="btn btn-primary" disabled={saving} onClick={() => void saveLang()}>
            <i className="ti ti-check" />
            {s.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountSecurity({
  lang,
  token,
  pin,
  onChangePassword,
}: {
  lang: string;
  token: string | null;
  pin: PinStatus | null;
  onChangePassword: () => void;
}) {
  const s = crmStrings(lang);
  const tx = useCallback((_k: string, fb: string) => fb, []);
  return (
    <div>
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="card-header"><div className="card-title">{s.acSecurityTitle}</div></div>
        <div className="card-body">
          <div className="sec-row">
            <span className="sec-ic"><i className="ti ti-lock-password" /></span>
            <div className="sec-body">
              <div className="sec-title">
                {s.acPinTitle}{" "}
                <span className={`badge ${pin?.is_set ? "badge-success" : "badge-gray"}`}>
                  {pin?.is_set ? s.acPinSet : s.acPinNotSet}
                </span>
              </div>
              <div className="sec-sub">{s.acPinSub}</div>
            </div>
            <div className="sec-action">
              <a className="btn btn-sm" href="/bucket3/pin-settings"><i className="ti ti-edit" />{s.acManagePin}</a>
            </div>
          </div>
          <div className="sec-row">
            <span className="sec-ic"><i className="ti ti-key" /></span>
            <div className="sec-body">
              <div className="sec-title">{s.acPasswordTitle}</div>
              <div className="sec-sub">{s.acPasswordSub}</div>
            </div>
            <div className="sec-action">
              <button className="btn btn-sm" onClick={onChangePassword}><i className="ti ti-refresh" />{s.acChangePassword}</button>
            </div>
          </div>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="card-header">
          <div>
            <div className="card-title">{s.acTwoFaTitle}</div>
            <div className="card-subtitle">{s.acTwoFaSub}</div>
          </div>
        </div>
        <div className="card-body">
          <AdminTwoFactorCard token={token} tx={tx} />
        </div>
      </div>
    </div>
  );
}

function AccountActivityLog({ lang, activity }: { lang: string; activity: ActivityData | null }) {
  const s = crmStrings(lang);
  const rows = activity?.recent ?? null;
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">{s.acActivityLogTitle}</div>
          <div className="card-subtitle">{s.acActivityLogSub}</div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{s.acActColEvent}</th>
              <th>{s.acActColDetail}</th>
              <th>{s.acActColWhen}</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={3} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={3} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.acActEmpty}</td></tr>
            ) : (
              rows.map((item) => (
                <tr key={item.id}>
                  <td className="font-semibold">{humanize(item.action)}</td>
                  <td className="cell-muted">
                    {item.subject_type ? `${item.subject_type}${item.subject_id ? ` #${item.subject_id}` : ""}` : "—"}
                  </td>
                  <td className="cell-muted">{fmtDateTime(item.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountSessions({
  lang,
  token,
  showToast,
}: {
  lang: string;
  token: string | null;
  showToast: (msg: string) => void;
}) {
  const s = crmStrings(lang);
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiListAccountSessions(token);
      setSessions(res.data);
    } catch {
      setSessions([]);
    }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function revoke(id: number) {
    if (!token) return;
    setBusyId(id);
    try {
      await apiRevokeAccountSession(token, id);
      showToast(s.acSessionRevokedToast);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusyId(null);
    }
  }

  async function revokeAllOthers() {
    if (!token || !sessions) return;
    const others = sessions.filter((x) => !x.is_current);
    for (const x of others) {
      try { await apiRevokeAccountSession(token, x.id); } catch { /* keep going */ }
    }
    showToast(s.acSessionRevokedToast);
    await load();
  }

  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <div className="card-header">
        <div>
          <div className="card-title">{s.acSessionsTitle}</div>
          <div className="card-subtitle">{s.acSessionsSub}</div>
        </div>
        <button className="btn btn-sm btn-danger" onClick={() => void revokeAllOthers()}>
          <i className="ti ti-logout" />{s.acRevokeAll}
        </button>
      </div>
      <div className="card-body">
        {sessions === null ? (
          <span className="cell-muted">{s.loading}</span>
        ) : sessions.length === 0 ? (
          <span className="cell-muted">{s.acSessionsEmpty}</span>
        ) : (
          sessions.map((sess) => (
            <div className={`sess-item ${sess.is_current ? "current" : ""}`} key={sess.id}>
              <span className="sess-ic"><i className="ti ti-device-laptop" /></span>
              <div className="sess-body">
                <div className="sess-title">
                  {sess.name || s.acSessionUnnamed}
                  {sess.is_current ? <span className="badge badge-success">{s.acSessionThisDevice}</span> : null}
                </div>
                <div className="sess-meta">
                  {s.acSessionCreated} {fmtDate(sess.created_at)} · {s.acSessionLastUsed} {relativeTime(sess.last_used_at)}
                </div>
              </div>
              {!sess.is_current ? (
                <button className="btn btn-sm" disabled={busyId === sess.id} onClick={() => void revoke(sess.id)}>
                  <i className="ti ti-x" />{s.acRevoke}
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EditProfileDrawer({
  open,
  lang,
  token,
  user,
  onClose,
  onSaved,
}: {
  open: boolean;
  lang: string;
  token: string | null;
  user: TeamUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const s = crmStrings(lang);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [preferredLang, setPreferredLang] = useState("en");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setLocation((user as (TeamUser & { location?: string | null }) | null)?.location ?? "");
    setPreferredLang(user?.preferred_language ?? "en");
  }, [open, user]);

  async function submit() {
    if (!token) return;
    setBusy(true);
    try {
      await apiFetchJson(`/account/profile`, {
        method: "PATCH",
        token,
        body: {
          name: name.trim() || undefined,
          phone: phone.trim() || null,
          location: location.trim() || null,
          preferred_language: preferredLang,
        },
      });
      onSaved();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`drawer-overlay ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${open ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div className="card-title">{s.acActEditProfile}</div>
            <div className="card-subtitle">{s.acPersonalTitle}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          <div className="fld mb-3">
            <span className="fld-label">{s.acFldName}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fld mb-3">
            <span className="fld-label">{s.acFldPhone}</span>
            <input value={phone} placeholder="+374 ..." onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="fld mb-3">
            <span className="fld-label">{s.acFldLocation}</span>
            <input value={location} maxLength={120} placeholder="Yerevan, Armenia" onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="fld">
            <span className="fld-label">{s.acFldDisplayLang}</span>
            <select value={preferredLang} onChange={(e) => setPreferredLang(e.target.value)}>
              {LANG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="drawer-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            <i className="ti ti-device-floppy" />{s.save}
          </button>
        </div>
      </div>
    </>
  );
}

function ChangePasswordDrawer({
  open,
  lang,
  token,
  onClose,
  onSaved,
}: {
  open: boolean;
  lang: string;
  token: string | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const s = crmStrings(lang);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setCurrent(""); setNext(""); setConfirm(""); setErr(null); }
  }, [open]);

  async function submit() {
    if (!token) return;
    setErr(null);
    if (next.length < 8) { setErr(s.acPwMin); return; }
    if (next !== confirm) { setErr(s.acPwMismatch); return; }
    setBusy(true);
    try {
      const res = await apiChangePassword(token, {
        current_password: current,
        new_password: next,
        new_password_confirmation: confirm,
      });
      const revoked = res.data?.revoked_other_sessions ?? 0;
      onSaved(revoked > 0 ? s.acPwChangedRevoked : s.acPwChanged);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`drawer-overlay ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${open ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div className="card-title">{s.acChangePassword}</div>
            <div className="card-subtitle">{s.acPwNewHint}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          {err ? <div className="card" style={{ padding: 12, marginBottom: 12, color: "var(--danger)" }}>{err}</div> : null}
          <div className="fld mb-3">
            <span className="fld-label">{s.acPwCurrent}</span>
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="fld mb-3">
            <span className="fld-label">{s.acPwNew}</span>
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="fld">
            <span className="fld-label">{s.acPwConfirm}</span>
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <div className="drawer-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            <i className="ti ti-device-floppy" />{s.acChangePassword}
          </button>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// My company pane — Seller status + Payments (operator/agent owner)
// ════════════════════════════════════════════════════════════════
export function MyCompanyPane({ lang, token, user, registerAction }: MyProfilePaneProps) {
  const s = crmStrings(lang);
  const companyId = useMemo(() => resolveCompanyId(user), [user]);
  const tx = useCallback((_k: string, fb: string) => fb, []);

  useEffect(() => { registerAction(null); }, [registerAction]);

  if (companyId == null) {
    return (
      <div className="empty-state">
        <span className="es-icon"><i className="ti ti-building" /></span>
        <div className="es-title">{s.pgMyCompany}</div>
        <div className="es-sub">{s.mcNoCompany}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="alert">
        <i className="ti ti-info-circle" />
        <div>{s.mcAlert}</div>
      </div>
      <div className="detail-card-grid">
        <SellerStatusCard token={token} companyId={companyId} tx={tx} />
        <StripeConnectCard token={token} companyId={companyId} tx={tx} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// My agents pane — connected agent agencies + commission editor (operator)
// ════════════════════════════════════════════════════════════════
type AgentRow = {
  connectionId: number;
  agencyId: number;
  agencyName: string;
  status: string;
  since: string | null;
};

export function MyAgentsPane({ lang, token, user, registerAction }: MyProfilePaneProps) {
  const s = crmStrings(lang);
  const companyId = useMemo(() => resolveCompanyId(user), [user]);
  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [connFilter, setConnFilter] = useState("");
  const [detail, setDetail] = useState<AgentRow | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      // TODO(backend): a dedicated GET /platform-admin/connections filtered to
      // partner agent agencies would let us source owner/email/country/sales/
      // revenue per agency directly. For now we list service connections and
      // surface the connected counterpart company.
      const res = await apiConnectionsList(token, { per_page: 200, company_id: companyId ?? undefined });
      setRows(res.data);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, companyId]);
  useEffect(() => { void load(); }, [load]);

  // My agents has no page-header action button (filters + per-row actions live
  // in the pane). Clear any action the previous pane registered.
  useEffect(() => { registerAction(null); }, [registerAction]);

  // Collapse the connection list to one row per counterpart agency.
  const agencies = useMemo<AgentRow[]>(() => {
    const map = new Map<number, AgentRow>();
    rows.forEach((c) => {
      // The counterpart is the company the connection points to that is not us.
      const counterpartId = c.company_id && companyId && c.company_id === companyId ? c.target_id : c.company_id ?? c.target_id;
      const id = counterpartId ?? c.id;
      if (!map.has(id)) {
        map.set(id, {
          connectionId: c.id,
          agencyId: id,
          agencyName: c.company?.name ?? `#${id}`,
          status: c.status,
          since: c.created_at ?? null,
        });
      }
    });
    return Array.from(map.values());
  }, [rows, companyId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agencies.filter((a) => {
      if (q && !a.agencyName.toLowerCase().includes(q)) return false;
      if (connFilter === "active" && a.status !== "active" && a.status !== "accepted") return false;
      if (connFilter === "pending" && a.status !== "pending") return false;
      return true;
    });
  }, [agencies, search, connFilter]);

  if (detail) {
    return (
      <MyAgentDetail
        lang={lang}
        token={token}
        companyId={companyId}
        agent={detail}
        onBack={() => setDetail(null)}
      />
    );
  }

  const activeCount = agencies.filter((a) => a.status === "active" || a.status === "accepted").length;

  return (
    <div>
      <div className="alert"><i className="ti ti-info-circle" /><div>{s.agAlert}</div></div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="stat-card c-primary">
          <div className="stat-header"><i className="ti ti-affiliate" /></div>
          <div className="stat-value">{agencies.length}</div>
          <div className="stat-label">{s.agStatAgents}</div>
        </div>
        <div className="stat-card c-info">
          <div className="stat-header"><i className="ti ti-coin" /></div>
          <div className="stat-value">—</div>
          <div className="stat-label">{s.agStatRevenue}</div>
        </div>
        <div className="stat-card c-success">
          <div className="stat-header"><i className="ti ti-calendar-check" /></div>
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">{s.agStatBookings}</div>
        </div>
      </div>

      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input type="search" placeholder={s.agSearchPh} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.agFilterConnection}</span>
          <select value={connFilter} onChange={(e) => setConnFilter(e.target.value)}>
            <option value="">{s.agConnAll}</option>
            <option value="active">{s.agConnActive}</option>
            <option value="pending">{s.agConnPending}</option>
          </select>
        </div>
      </div>

      {err ? <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div> : null}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.agColAgency}</th>
                <th>{s.agColConnection}</th>
                <th>{s.agColSince}</th>
                <th className="num-cell">{s.agColSales}</th>
                <th className="num-cell">{s.agColRevenue}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.agEmpty}</td></tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.agencyId} onClick={() => setDetail(a)}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="avatar sm">{initials(a.agencyName)}</span>
                        {a.agencyName}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${a.status === "active" || a.status === "accepted" ? "badge-success" : a.status === "pending" ? "badge-warning" : "badge-gray"}`}>
                        {a.status === "active" || a.status === "accepted" ? s.agConnActive : a.status === "pending" ? s.agConnPending : humanize(a.status)}
                      </span>
                    </td>
                    <td className="cell-muted">{fmtDate(a.since)}</td>
                    {/* TODO(backend): per-agent stats aggregation */}
                    <td className="num-cell font-mono"><span className="muted-dash">—</span></td>
                    <td className="num-cell font-mono"><span className="muted-dash">—</span></td>
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button className="icon-btn" title={s.agTabOverview} onClick={() => setDetail(a)}><i className="ti ti-eye" /></button>
                        <button className="icon-btn" title={s.agSetCommission} onClick={() => setDetail(a)}><i className="ti ti-percentage" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const AG_MINI_DESTINATIONS = [
  { name: "Yerevan", pct: 88, val: 9 },
  { name: "Dilijan", pct: 60, val: 6 },
  { name: "Tatev", pct: 40, val: 4 },
  { name: "Sevan", pct: 20, val: 2 },
];
const AG_MINI_SERVICES = [
  { name: "Hotels", pct: 76, val: 12 },
  { name: "Excursions", pct: 44, val: 6 },
  { name: "Transfers", pct: 20, val: 3 },
];

function MyAgentDetail({
  lang,
  token,
  companyId,
  agent,
  onBack,
}: {
  lang: string;
  token: string | null;
  companyId: number | null;
  agent: AgentRow;
  onBack: () => void;
}) {
  const s = crmStrings(lang);
  const [tab, setTab] = useState<"stats" | "commission" | "bookings">("stats");
  return (
    <div>
      <button className="btn btn-ghost detail-back" onClick={onBack}>
        <i className="ti ti-arrow-left" />{s.agBackToAgents}
      </button>
      <div className="hero-card">
        <div className="hero-avatar">{initials(agent.agencyName)}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="hero-name">
            <span>{agent.agencyName}</span>
            <span className={`badge ${agent.status === "active" || agent.status === "accepted" ? "badge-success" : "badge-warning"}`}>
              {agent.status === "active" || agent.status === "accepted" ? s.agConnActive : s.agConnPending}
            </span>
          </div>
          <div className="hero-meta">
            <span><i className="ti ti-calendar" style={{ fontSize: 14 }} /> {s.agColSince} {fmtDate(agent.since)}</span>
          </div>
        </div>
      </div>
      <div className="sub-tabs">
        <button className={`sub-tab ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>{s.agTabOverview}</button>
        <button className={`sub-tab ${tab === "commission" ? "active" : ""}`} onClick={() => setTab("commission")}>{s.agTabCommission}</button>
        <button className={`sub-tab ${tab === "bookings" ? "active" : ""}`} onClick={() => setTab("bookings")}>{s.agTabBookings}</button>
      </div>

      {tab === "stats" ? (
        <div>
          <div className="alert"><i className="ti ti-info-circle" /><div>{s.agPerfNote}</div></div>
          <div className="stat-grid">
            {/* TODO(backend): per-agent stats aggregation */}
            <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-shopping-cart" /></div><div className="stat-value">—</div><div className="stat-label">{s.agStatSalesLbl}</div></div>
            <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-coin" /></div><div className="stat-value">—</div><div className="stat-label">{s.agStatRevenueLbl}</div></div>
            <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-percentage" /></div><div className="stat-value">—</div><div className="stat-label">{s.agStatCommissionPaid}</div></div>
            <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-calendar-check" /></div><div className="stat-value">—</div><div className="stat-label">{s.agStatBookingsLbl}</div></div>
          </div>
          <div className="detail-card-grid">
            <div className="card">
              <div className="card-header"><div className="card-title">{s.agTopDestinations}</div></div>
              <div className="card-body">
                <div className="mini-list">
                  {AG_MINI_DESTINATIONS.map((m) => (
                    <div className="mini-row" key={m.name}>
                      <span className="mr-name">{m.name}</span>
                      <span className="mr-track"><span style={{ width: `${m.pct}%` }} /></span>
                      <span className="mr-val">{m.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">{s.agByService}</div></div>
              <div className="card-body">
                <div className="mini-list">
                  {AG_MINI_SERVICES.map((m) => (
                    <div className="mini-row" key={m.name}>
                      <span className="mr-name">{m.name}</span>
                      <span className="mr-track"><span style={{ width: `${m.pct}%` }} /></span>
                      <span className="mr-val">{m.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "commission" ? (
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <div className="card-title">{s.agCommissionTitle}</div>
              <div className="card-subtitle">{s.agCommissionSub}</div>
            </div>
          </div>
          <div className="card-body">
            {token && companyId != null ? (
              <CompanyCommissionTab token={token} companyId={companyId} />
            ) : (
              <span className="cell-muted">{s.errGeneric}</span>
            )}
          </div>
        </div>
      ) : null}

      {tab === "bookings" ? (
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">{s.agBookingsTitle}</div></div>
          <div className="card-body">
            {/* TODO(backend): per-agent booking history endpoint */}
            <span className="cell-muted">{s.agBookingsSoon}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
