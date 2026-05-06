"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Platform-admin webhook deliveries viewer (Sprint 52, PART 30).
 *
 * Wires to backend (Sprint 52):
 *   GET /api/platform-admin/webhooks/stats
 *   GET /api/platform-admin/webhooks/subscriptions
 *   GET /api/platform-admin/webhooks/deliveries
 */

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
  const { t } = useLanguage();
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

    (async () => {
      try {
        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const baseURL = process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am";

        const [statsRes, subsRes, delivQs] = await Promise.all([
          fetch(`${baseURL}/api/platform-admin/webhooks/stats`, { headers }).then((r) => r.json()),
          fetch(`${baseURL}/api/platform-admin/webhooks/subscriptions`, { headers }).then((r) => r.json()),
          fetch(
            `${baseURL}/api/platform-admin/webhooks/deliveries${
              statusFilter ? `?status=${statusFilter}` : ""
            }`,
            { headers }
          ).then((r) => r.json()),
        ]);

        if (cancelled) return;
        if (statsRes?.success) setStats(statsRes.data);
        if (subsRes?.success) setSubscriptions(subsRes.data ?? []);
        if (delivQs?.success) setDeliveries(delivQs.data ?? []);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) {
          setForbidden(true);
        } else {
          setError(e instanceof Error ? e.message : t("admin.platform_webhooks.err_load"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, allowed, statusFilter, t]);

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.platform_webhooks.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.platform_webhooks.title")}</h1>
      <p className="admin-page-subtitle">{t("admin.platform_webhooks.subtitle")}</p>

      {error && <p className="mt-2 text-sm text-error-600">{error}</p>}

      {/* Stats grid */}
      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t("admin.platform_webhooks.subscriptions")} value={`${stats.active_subscriptions} / ${stats.total_subscriptions}`} hint={t("admin.platform_webhooks.active_total")} />
          <StatCard label={t("admin.platform_webhooks.total_deliveries")} value={stats.deliveries_total.toLocaleString()} />
          <StatCard label={t("admin.platform_webhooks.success_rate")} value={stats.success_rate !== null ? `${stats.success_rate}%` : "—"} tone={stats.success_rate !== null && stats.success_rate >= 95 ? "good" : "warn"} />
          <StatCard label={t("admin.platform_webhooks.failed_lifetime")} value={stats.deliveries_failed.toLocaleString()} tone={stats.deliveries_failed > 0 ? "warn" : "neutral"} />
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex gap-2 border-b border-default">
        <TabButton active={tab === "deliveries"} onClick={() => setTab("deliveries")}>
          {t("admin.platform_webhooks.deliveries")}
        </TabButton>
        <TabButton active={tab === "subscriptions"} onClick={() => setTab("subscriptions")}>
          {t("admin.platform_webhooks.subscriptions")}
        </TabButton>
      </div>

      {tab === "deliveries" && (
        <div className="mt-4">
          <div className="flex items-center gap-3 mb-3">
            <label className="text-sm text-fg-t6">
              {t("admin.platform_webhooks.status")}:
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="ml-2 rounded border border-default px-2 py-1 text-sm"
              >
                <option value="">{t("common.all")}</option>
                <option value="pending">{t("admin.platform_webhooks.status_pending")}</option>
                <option value="success">{t("admin.platform_webhooks.status_success")}</option>
                <option value="failed">{t("admin.platform_webhooks.status_failed")}</option>
              </select>
            </label>
          </div>

          <div className="overflow-x-auto rounded border border-default bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
                <tr>
                  <th className="px-3 py-2">{t("admin.crud.common.id")}</th>
                  <th className="px-3 py-2">{t("admin.platform_webhooks.event")}</th>
                  <th className="px-3 py-2">{t("admin.platform_webhooks.status")}</th>
                  <th className="px-3 py-2">{t("admin.platform_webhooks.url")}</th>
                  <th className="px-3 py-2">{t("admin.platform_webhooks.attempts")}</th>
                  <th className="px-3 py-2">{t("admin.platform_webhooks.http")}</th>
                  <th className="px-3 py-2">{t("admin.platform_webhooks.last_attempt")}</th>
                  <th className="px-3 py-2">{t("admin.platform_webhooks.created")}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-fg-t6">
                      {t("admin.platform_webhooks.loading")}
                    </td>
                  </tr>
                )}
                {!loading && deliveries.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-fg-t6">
                      {t("admin.platform_webhooks.empty_deliveries")}
                    </td>
                  </tr>
                )}
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-b border-default hover:bg-figma-bg-1">
                    <td className="px-3 py-2 tabular-nums text-fg-t7">{d.id}</td>
                    <td className="px-3 py-2 font-mono text-xs">{d.event}</td>
                    <td className="px-3 py-2">
                      <DeliveryStatusBadge status={d.status} />
                    </td>
                  <td className="px-3 py-2 truncate max-w-xs">{d.subscription?.url ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{d.attempt_count}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{d.last_response_status ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-fg-t7">
                      {d.last_attempt_at ? new Date(d.last_attempt_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-fg-t7">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {d.status === "failed" && (
                        <ReplayButton
                          deliveryId={d.id}
                          token={token ?? ""}
                          onReplayed={() => setStatusFilter((s) => s)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "subscriptions" && (
        <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
              <tr>
                  <th className="px-3 py-2">{t("admin.crud.common.id")}</th>
                  <th className="px-3 py-2">{t("admin.platform_webhooks.company")}</th>
                  <th className="px-3 py-2">{t("admin.platform_webhooks.url")}</th>
                  <th className="px-3 py-2">{t("admin.platform_webhooks.events")}</th>
                  <th className="px-3 py-2">{t("admin.platform_webhooks.status")}</th>
                  <th className="px-3 py-2">{t("admin.platform_webhooks.created")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-fg-t6">
                    {t("admin.platform_webhooks.loading")}
                  </td>
                </tr>
              )}
              {!loading && subscriptions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-fg-t6">
                    {t("admin.platform_webhooks.empty_subscriptions")}
                  </td>
                </tr>
              )}
              {subscriptions.map((s) => (
                <tr key={s.id} className="border-b border-default hover:bg-figma-bg-1">
                  <td className="px-3 py-2 tabular-nums text-fg-t7">{s.id}</td>
                  <td className="px-3 py-2">{s.company?.name ?? `#${s.company_id}`}</td>
                  <td className="px-3 py-2 truncate max-w-xs">{s.url}</td>
                  <td className="px-3 py-2 text-xs">{s.events.join(", ")}</td>
                  <td className="px-3 py-2">
                    <SubscriptionStatusBadge status={s.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-fg-t7">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active ? "border-primary-500 text-primary-500" : "border-transparent text-fg-t6 hover:text-fg-t11"
      }`}
    >
      {children}
    </button>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replay = async () => {
    if (!confirm(t("admin.platform_webhooks.confirm_replay"))) return;
    setBusy(true);
    setError(null);
    try {
      const baseURL = process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am";
      const res = await fetch(
        `${baseURL}/api/platform-admin/webhooks/deliveries/${deliveryId}/replay`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }
      );
      const json = await res.json();
      if (json?.success) {
        onReplayed();
      } else {
        setError(json?.message ?? t("admin.platform_webhooks.err_replay"));
      }
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

function DeliveryStatusBadge({ status }: { status: Delivery["status"] }) {
  const { t } = useLanguage();
  const cls =
    status === "success"
      ? "bg-success-50 text-success-700"
      : status === "failed"
        ? "bg-error-50 text-error-700"
        : "bg-warning-50 text-warning-700";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{t(`admin.platform_webhooks.status_${status}`)}</span>;
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const cls = status === "active" ? "bg-success-50 text-success-700" : "bg-figma-bg-1 text-fg-t6";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{t(`admin.platform_webhooks.subscription_status_${status}`)}</span>;
}
