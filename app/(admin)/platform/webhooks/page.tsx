"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  FormField,
  PageHeader,
  Select,
  StatusPill,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  Tabs,
  TR,
} from "@/components/ui";

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
            `${baseURL}/api/platform-admin/webhooks/deliveries${statusFilter ? `?status=${statusFilter}` : ""}`,
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
    <div className="space-y-6">
      <PageHeader title={t("admin.platform_webhooks.title")} subtitle={t("admin.platform_webhooks.subtitle")} />

      {error && <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{error}</div>}

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t("admin.platform_webhooks.subscriptions")} value={`${stats.active_subscriptions} / ${stats.total_subscriptions}`} hint={t("admin.platform_webhooks.active_total")} />
          <StatCard label={t("admin.platform_webhooks.total_deliveries")} value={stats.deliveries_total.toLocaleString()} />
          <StatCard label={t("admin.platform_webhooks.success_rate")} value={stats.success_rate !== null ? `${stats.success_rate}%` : "—"} tone={stats.success_rate !== null && stats.success_rate >= 95 ? "good" : "warn"} />
          <StatCard label={t("admin.platform_webhooks.failed_lifetime")} value={stats.deliveries_failed.toLocaleString()} tone={stats.deliveries_failed > 0 ? "warn" : "neutral"} />
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
          <div className="admin-card p-4">
            <FormField label={t("admin.platform_webhooks.status")} htmlFor="wh-status" className="max-w-xs">
              <Select
                id="wh-status"
                fieldSize="sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">{t("common.all")}</option>
                <option value="pending">{t("admin.platform_webhooks.status_pending")}</option>
                <option value="success">{t("admin.platform_webhooks.status_success")}</option>
                <option value="failed">{t("admin.platform_webhooks.status_failed")}</option>
              </Select>
            </FormField>
          </div>

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
                  <TD className="tabular-nums">{d.id}</TD>
                  <TD className="font-mono text-xs">{d.event}</TD>
                  <TD>
                    <StatusPill status={d.status}>
                      {t(`admin.platform_webhooks.status_${d.status}`)}
                    </StatusPill>
                  </TD>
                  <TD className="truncate max-w-xs">{d.subscription?.url ?? "—"}</TD>
                  <TD className="tabular-nums">{d.attempt_count}</TD>
                  <TD className="tabular-nums text-xs">{d.last_response_status ?? "—"}</TD>
                  <TD className="text-xs text-fg-t6">
                    {d.last_attempt_at ? new Date(d.last_attempt_at).toLocaleString() : "—"}
                  </TD>
                  <TD className="text-xs text-fg-t6">{new Date(d.created_at).toLocaleDateString()}</TD>
                  <TD align="right">
                    {d.status === "failed" && (
                      <ReplayButton deliveryId={d.id} token={token ?? ""} onReplayed={() => setStatusFilter((s) => s)} />
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {tab === "subscriptions" && (
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
            {subscriptions.map((s) => (
              <TR key={s.id}>
                <TD className="tabular-nums">{s.id}</TD>
                <TD>{s.company?.name ?? `#${s.company_id}`}</TD>
                <TD className="truncate max-w-xs">{s.url}</TD>
                <TD className="text-xs">{s.events.join(", ")}</TD>
                <TD>
                  <StatusPill status={s.status}>
                    {t(`admin.platform_webhooks.subscription_status_${s.status}`)}
                  </StatusPill>
                </TD>
                <TD className="text-xs text-fg-t6">{new Date(s.created_at).toLocaleDateString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
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
      const res = await fetch(`${baseURL}/api/platform-admin/webhooks/deliveries/${deliveryId}/replay`, {
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
