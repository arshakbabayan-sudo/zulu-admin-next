"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { exportRowsAsCsv } from "@/lib/export-csv";
import { formatNumber } from "@/lib/format";
import {
  Select,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  Tabs,
  TR,
} from "@/components/ui";
import {
  PageHeader as V2PageHeader,

  FilterCard,
  FilterField,
  V2Card,
  V2Button,
} from "@/components/ui/v2";
import { SettingsSubgroupTabs } from "@/components/settings/SettingsSubgroupTabs";
import { Download, Plus, RefreshCw } from "lucide-react";

type WebhookStats = {
  total_subscriptions: number;
  active_subscriptions: number;
  deliveries_total: number;
  deliveries_success: number;
  deliveries_failed: number;
  deliveries_pending: number;
  success_rate: number | null;
};

type Subscription = {
  id: number;
  company_id: number;
  url: string;
  events: string[];
  status: string;
  created_at: string;
  company?: { id: number; name: string };
};

type Delivery = {
  id: number;
  subscription_id: number;
  event: string;
  status: "pending" | "success" | "failed";
  attempt_count: number;
  last_response_status: number | null;
  last_attempt_at: string | null;
  created_at: string;
  subscription?: { id: number; company_id: number; url: string };
};

export default function PlatformWebhooksPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [tab, setTab] = useState<"subscriptions" | "deliveries">("deliveries");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed || !token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setForbidden(false);

    void (async () => {
      try {
        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const baseURL = process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am";

        const [statsRes, subsRes, delivQs] = await Promise.all([
          fetch(`${baseURL}/platform-admin/webhooks/stats`, { headers }).then((r) => r.json()),
          fetch(`${baseURL}/platform-admin/webhooks/subscriptions`, { headers }).then((r) => r.json()),
          fetch(
            `${baseURL}/platform-admin/webhooks/deliveries${statusFilter ? `?status=${statusFilter}` : ""}`,
            { headers }
          ).then((r) => r.json()),
        ]);

        if (cancelled) return;
        if (statsRes?.success) setStats(statsRes.data);
        if (subsRes?.success) setSubscriptions(subsRes.data ?? []);
        if (delivQs?.success) setDeliveries(delivQs.data ?? []);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : t("admin.platform_webhooks.err_load"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, allowed, statusFilter, t]);

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.platform_webhooks.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Settings Webhooks page chrome. */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.platform_webhooks.title") },
        ]}
        title={t("admin.platform_webhooks.title")}
        subtitle={t("admin.platform_webhooks.subtitle")}
        actions={
          <>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              disabled={subscriptions.length === 0}
              onClick={() =>
                exportRowsAsCsv("webhook-subscriptions", subscriptions, [
                  ["id", (r) => r.id],
                  ["company_id", (r) => r.company_id],
                  ["company_name", (r) => r.company?.name ?? ""],
                  ["url", (r) => r.url],
                  ["events", (r) => r.events.join(";")],
                  ["status", (r) => r.status],
                  ["created_at", (r) => r.created_at],
                ])
              }
            >
              Export
            </V2Button>
            <V2Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              New webhook
            </V2Button>
          </>
        }
      />

      <SettingsSubgroupTabs activeHref="/platform/webhooks" />

      <div className="space-y-6">
      {error && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{error}</div>}

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t("admin.platform_webhooks.subscriptions")} value={`${stats.active_subscriptions} / ${stats.total_subscriptions}`} hint={t("admin.platform_webhooks.active_total")} />
          <StatCard label={t("admin.platform_webhooks.total_deliveries")} value={formatNumber(stats.deliveries_total, lang)} />
          <StatCard label={t("admin.platform_webhooks.success_rate")} value={stats.success_rate !== null ? `${stats.success_rate}%` : "—"} tone={stats.success_rate !== null && stats.success_rate >= 95 ? "good" : "warn"} />
          <StatCard label={t("admin.platform_webhooks.failed_lifetime")} value={formatNumber(stats.deliveries_failed, lang)} tone={stats.deliveries_failed > 0 ? "warn" : "neutral"} />
        </div>
      )}

      <Tabs
        value={tab}
        onChange={(v) => setTab(v as "subscriptions" | "deliveries")}
        items={[
          { id: "deliveries", label: t("admin.platform_webhooks.deliveries") },
          { id: "subscriptions", label: t("admin.platform_webhooks.subscriptions") },
        ]}
      />

      {tab === "deliveries" && (
        <>
          <FilterCard>
            <FilterField label={t("admin.platform_webhooks.status")}>
              <Select
                id="wh-status"
                fieldSize="sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="!h-[34px]"
              >
                <option value="">{t("common.all")}</option>
                <option value="pending">{t("admin.platform_webhooks.status_pending")}</option>
                <option value="success">{t("admin.platform_webhooks.status_success")}</option>
                <option value="failed">{t("admin.platform_webhooks.status_failed")}</option>
              </Select>
            </FilterField>
            <V2Button size="sm" onClick={() => setStatusFilter((s) => s)}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </V2Button>
          </FilterCard>

          <V2Card>
          <Table>
            <THead>
              <TR>
                <TH>{t("admin.crud.common.id")}</TH>
                <TH>{t("admin.platform_webhooks.event")}</TH>
                <TH>{t("admin.platform_webhooks.status")}</TH>
                <TH>{t("admin.platform_webhooks.url")}</TH>
                <TH>{t("admin.platform_webhooks.attempts")}</TH>
                <TH>{t("admin.platform_webhooks.http")}</TH>
                <TH>{t("admin.platform_webhooks.last_attempt")}</TH>
                <TH>{t("admin.platform_webhooks.created")}</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {loading ? <TEmpty colSpan={9}>{t("admin.platform_webhooks.loading")}</TEmpty>
                : deliveries.length === 0 ? <TEmpty colSpan={9}>{t("admin.platform_webhooks.empty_deliveries")}</TEmpty>
                : null}
              {deliveries.map((d) => (
                <TR key={d.id}>
                  <TD className="tabular-nums text-fg-t7 font-mono text-xs">#{d.id}</TD>
                  <TD>
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px] font-mono"
                      style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                    >
                      {d.event}
                    </span>
                  </TD>
                  <TD>
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                      style={deliveryStatusStyle(d.status)}
                    >
                      {t(`admin.platform_webhooks.status_${d.status}`)}
                    </span>
                  </TD>
                  <TD className="truncate max-w-xs text-xs text-fg-t7" title={d.subscription?.url ?? undefined}>
                    {d.subscription?.url ?? "—"}
                  </TD>
                  <TD className="tabular-nums text-xs">{d.attempt_count}</TD>
                  <TD className="tabular-nums text-xs">
                    {d.last_response_status !== null && d.last_response_status !== undefined ? (
                      <span
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold font-mono"
                        style={httpStatusStyle(d.last_response_status)}
                      >
                        {d.last_response_status}
                      </span>
                    ) : (
                      <span className="text-fg-t6">—</span>
                    )}
                  </TD>
                  <TD className="text-xs text-fg-t6" title={d.last_attempt_at ?? undefined}>
                    {formatRelativeTime(d.last_attempt_at)}
                  </TD>
                  <TD className="text-xs text-fg-t6" title={d.created_at}>
                    {formatRelativeTime(d.created_at)}
                  </TD>
                  <TD align="right">
                    {d.status === "failed" && (
                      <ReplayButton deliveryId={d.id} token={token ?? ""} onReplayed={() => setStatusFilter((s) => s)} />
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          </V2Card>
        </>
      )}

      {tab === "subscriptions" && (
        <V2Card>
        <Table>
          <THead>
            <TR>
              <TH>{t("admin.crud.common.id")}</TH>
              <TH>{t("admin.platform_webhooks.company")}</TH>
              <TH>{t("admin.platform_webhooks.url")}</TH>
              <TH>{t("admin.platform_webhooks.events")}</TH>
              <TH>{t("admin.platform_webhooks.status")}</TH>
              <TH>{t("admin.platform_webhooks.created")}</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? <TEmpty colSpan={6}>{t("admin.platform_webhooks.loading")}</TEmpty>
              : subscriptions.length === 0 ? <TEmpty colSpan={6}>{t("admin.platform_webhooks.empty_subscriptions")}</TEmpty>
              : null}
            {subscriptions.map((s) => {
              const companyName = s.company?.name ?? `#${s.company_id}`;
              const initials = getInitials(companyName);
              const tone = pickAvatarTone(s.company_id);
              return (
                <TR key={s.id}>
                  <TD className="tabular-nums text-fg-t7 font-mono text-xs">#{s.id}</TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={avatarStyle(tone)}
                        aria-hidden
                      >
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-fg-t8 truncate">{companyName}</div>
                      </div>
                    </div>
                  </TD>
                  <TD className="truncate max-w-xs text-xs text-fg-t7" title={s.url}>
                    {s.url}
                  </TD>
                  <TD className="text-xs text-fg-t6">{s.events.join(", ")}</TD>
                  <TD>
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                      style={subscriptionStatusStyle(s.status)}
                    >
                      {t(`admin.platform_webhooks.subscription_status_${s.status}`)}
                    </span>
                  </TD>
                  <TD className="text-xs text-fg-t6" title={s.created_at}>
                    {formatRelativeTime(s.created_at)}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        </V2Card>
      )}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: "good" | "warn" | "neutral" }) {
  const toneClass = tone === "good" ? "text-success-600" : tone === "warn" ? "text-warning-600" : "text-fg-t11";
  return (
    <div className="admin-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-fg-t6">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-fg-t6 mt-0.5">{hint}</div>}
    </div>
  );
}

function ReplayButton({
  deliveryId,
  token,
  onReplayed,
}: {
  deliveryId: number;
  token: string;
  onReplayed: () => void;
}) {
  const { t } = useLanguage();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replay = async () => {
    const ok = await confirm({ messageKey: "admin.platform_webhooks.confirm_replay" });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const baseURL = process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am";
      const res = await fetch(`${baseURL}/platform-admin/webhooks/deliveries/${deliveryId}/replay`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await res.json();
      if (json?.success) onReplayed();
      else setError(json?.message ?? t("admin.platform_webhooks.err_replay"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.platform_webhooks.err_replay"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={replay}
      disabled={busy}
      title={error ?? t("admin.platform_webhooks.replay_hint")}
      className="text-xs text-primary-500 hover:underline disabled:opacity-40"
    >
      {busy ? "…" : t("admin.platform_webhooks.replay")}
    </button>
  );
}

// v2 admin-redesign helpers.
function getInitials(name: string): string {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function pickAvatarTone(id: number | string): "purple" | "teal" | "amber" | "blue" {
  const tones: Array<"purple" | "teal" | "amber" | "blue"> = ["purple", "teal", "amber", "blue"];
  const n = typeof id === "number" ? id : id.length;
  return tones[n % tones.length]!;
}

function avatarStyle(tone: "purple" | "teal" | "amber" | "blue"): React.CSSProperties {
  const map: Record<"purple" | "teal" | "amber" | "blue", React.CSSProperties> = {
    purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
    teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  };
  return map[tone];
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

function deliveryStatusStyle(status: string): React.CSSProperties {
  switch (status) {
    case "success":
      return { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" };
    case "pending":
      return { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" };
    case "failed":
      return { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" };
    default:
      return { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" };
  }
}

function subscriptionStatusStyle(status: string): React.CSSProperties {
  switch (status) {
    case "active":
      return { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" };
    case "disabled":
    case "paused":
      return { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" };
    case "error":
      return { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" };
    default:
      return { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" };
  }
}

function httpStatusStyle(code: number): React.CSSProperties {
  if (code >= 200 && code < 300) {
    return { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" };
  }
  if (code >= 300 && code < 400) {
    return { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" };
  }
  if (code >= 400 && code < 500) {
    return { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" };
  }
  if (code >= 500) {
    return { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" };
  }
  return { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" };
}
