"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Platform-admin notification oversight (Sprint 59, PART 23).
 *
 * Wires to backend:
 *   GET /api/platform-admin/notifications
 *   GET /api/platform-admin/notifications/stats
 */

const STATUSES = ["unread", "read"] as const;
const PRIORITIES = ["low", "normal", "high", "critical"] as const;

const EVENT_TYPES = [
  "package_order.created",
  "package_order.paid",
  "package_order.confirmed",
  "package_order.partially_confirmed",
  "package_order.partially_failed",
  "package_order.cancelled",
  "order.confirmed",
  "order.cancelled",
  "order.paid",
  "order.fulfilled",
  "payment.succeeded",
  "payment.failed",
  "voucher.issued",
  "voucher.voided",
  "voucher.reissued",
  "account.welcome",
  "account.password_reset",
] as const;

type NotificationRow = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  status: string;
  event_type: string | null;
  subject_type: string | null;
  subject_id: string | null;
  priority: string;
  created_at: string;
  user?: { id: number; name: string; email: string };
};

type Meta = {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
};

type Stats = {
  total: number;
  unread: number;
  read: number;
  by_event_type: Record<string, number>;
  by_priority: Record<string, number>;
};

export default function PlatformNotificationsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);

  const [userId, setUserId] = useState("");
  const [eventType, setEventType] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [appliedFilters, setAppliedFilters] = useState(0);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<NotificationRow | null>(null);

  const baseURL = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am",
    []
  );

  useEffect(() => {
    if (!allowed || !token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setForbidden(false);

    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("per_page", "50");
        if (userId.trim()) params.set("user_id", userId.trim());
        if (eventType) params.set("event_type", eventType);
        if (status) params.set("status", status);
        if (priority) params.set("priority", priority);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (q.trim()) params.set("q", q.trim());

        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const [listRes, statsRes] = await Promise.all([
          fetch(`${baseURL}/api/platform-admin/notifications?${params.toString()}`, { headers }),
          fetch(`${baseURL}/api/platform-admin/notifications/stats`, { headers }),
        ]);

        if (listRes.status === 403 || statsRes.status === 403) {
          if (!cancelled) setForbidden(true);
          return;
        }

        const listJson = await listRes.json();
        const statsJson = await statsRes.json();
        if (cancelled) return;

        if (listJson?.success) {
          setRows(listJson.data ?? []);
          setMeta(listJson.meta ?? null);
        } else {
          setError(listJson?.message ?? t("admin.platform_notifications.err_load"));
        }
        if (statsJson?.success) {
          setStats(statsJson.data);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) {
          setForbidden(true);
        } else {
          setError(e instanceof Error ? e.message : t("admin.platform_notifications.err_load"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, allowed, baseURL, page, appliedFilters, t]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  const resetFilters = () => {
    setUserId("");
    setEventType("");
    setStatus("");
    setPriority("");
    setFrom("");
    setTo("");
    setQ("");
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.platform_notifications.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.platform_notifications.title")}</h1>
      <p className="admin-page-subtitle">{t("admin.platform_notifications.subtitle")}</p>

      {error && <p className="mt-2 text-sm text-error-600">{error}</p>}

      {/* Stats */}
      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t("admin.platform_notifications.total")} value={stats.total.toLocaleString()} />
          <StatCard
            label={t("admin.platform_notifications.unread")}
            value={stats.unread.toLocaleString()}
            tone={stats.unread > 0 ? "warn" : "neutral"}
          />
          <StatCard label={t("admin.platform_notifications.read")} value={stats.read.toLocaleString()} tone="good" />
          <StatCard
            label={t("admin.platform_notifications.critical_lifetime")}
            value={String(stats.by_priority?.critical ?? 0)}
            tone={(stats.by_priority?.critical ?? 0) > 0 ? "warn" : "neutral"}
          />
        </div>
      )}

      {/* Top events */}
      {stats && Object.keys(stats.by_event_type ?? {}).length > 0 && (
        <div className="mt-4 rounded border border-default bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
            {t("admin.platform_notifications.top_events")}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(stats.by_event_type)
              .slice(0, 12)
              .map(([ev, count]) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => {
                    setEventType(ev);
                    setPage(1);
                    setAppliedFilters((n) => n + 1);
                  }}
                  className="rounded border border-default bg-figma-bg-1 px-2 py-1 text-xs hover:bg-white"
                >
                  <span className="font-mono">{ev}</span>{" "}
                  <span className="text-fg-t7">({count})</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 grid gap-3 rounded border border-default bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-fg-t6">
          {t("admin.platform_notifications.user_id")}
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-fg-t6">
          {t("admin.platform_notifications.event_type")}
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          >
            <option value="">{t("common.all")}</option>
            {EVENT_TYPES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fg-t6">
          {t("admin.platform_notifications.status")}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          >
            <option value="">{t("common.all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fg-t6">
          {t("admin.platform_notifications.priority")}
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          >
            <option value="">{t("common.all")}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fg-t6">
          {t("admin.platform_notifications.from")}
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-fg-t6">
          {t("admin.platform_notifications.to")}
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-fg-t6 sm:col-span-2">
          {t("common.search")}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("admin.platform_notifications.search_placeholder")}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-figma-bg-1"
          >
            {t("common.reset")}
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
          >
            {t("common.apply")}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.platform_notifications.when")}</th>
              <th className="px-3 py-2">{t("admin.platform_notifications.user")}</th>
              <th className="px-3 py-2">{t("admin.platform_notifications.event")}</th>
              <th className="px-3 py-2">{t("admin.platform_notifications.col_title")}</th>
              <th className="px-3 py-2">{t("admin.platform_notifications.priority")}</th>
              <th className="px-3 py-2">{t("admin.platform_notifications.status")}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-fg-t6">
                  {t("admin.platform_notifications.loading")}
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-fg-t6">
                  {t("admin.platform_notifications.empty")}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 text-xs text-fg-t7 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.user?.name ?? `#${r.user_id}`}
                  {r.user?.email && <div className="text-fg-t6">{r.user.email}</div>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.event_type ?? "—"}</td>
                <td className="px-3 py-2 text-xs truncate max-w-xs">{r.title}</td>
                <td className="px-3 py-2">
                  <PriorityBadge priority={r.priority} />
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="text-xs text-primary-500 hover:underline"
                  >
                    {t("admin.platform_notifications.view")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-fg-t6">
            {t("admin.platform_notifications.pagination")
              .replace("{page}", String(meta.current_page))
              .replace("{lastPage}", String(meta.last_page))
              .replace("{total}", meta.total.toLocaleString())}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border border-default bg-white px-3 py-1 disabled:opacity-50"
            >
              {t("common.prev")}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              disabled={page >= meta.last_page}
              className="rounded border border-default bg-white px-3 py-1 disabled:opacity-50"
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      )}

      {/* Detail */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={() => setSelected(null)}
        >
          <div
            className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <p className="mt-1 text-xs text-fg-t6">
                  {selected.event_type ?? selected.type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded p-1 text-fg-t6 hover:bg-figma-bg-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <PriorityBadge priority={selected.priority} />
              <StatusBadge status={selected.status} />
            </div>

            <div className="mt-4 rounded border border-default bg-figma-bg-1 p-3 text-sm whitespace-pre-wrap">
              {selected.message}
            </div>

            <dl className="mt-6 space-y-2 text-sm">
              <DetailRow
                label={t("admin.platform_notifications.user")}
                value={
                  selected.user
                    ? `${selected.user.name} <${selected.user.email}>`
                    : `#${selected.user_id}`
                }
              />
              <DetailRow
                label={t("admin.platform_notifications.when")}
                value={new Date(selected.created_at).toLocaleString()}
              />
              <DetailRow label={t("admin.platform_notifications.type")} value={selected.type} />
              <DetailRow label={t("admin.platform_notifications.event")} value={selected.event_type ?? "—"} />
              <DetailRow
                label={t("admin.platform_notifications.subject")}
                value={
                  selected.subject_type
                    ? `${selected.subject_type}${selected.subject_id ? " #" + selected.subject_id : ""}`
                    : "—"
                }
              />
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-success-600"
      : tone === "warn"
        ? "text-warning-600"
        : "text-fg-t11";
  return (
    <div className="admin-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-fg-t6">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useLanguage();
  const tone =
    priority === "critical"
      ? "bg-error-50 text-error-700"
      : priority === "high"
        ? "bg-warning-50 text-warning-700"
        : priority === "low"
          ? "bg-figma-bg-1 text-fg-t6"
          : "bg-figma-bg-1 text-fg-t11";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone}`}>
      {t(`admin.platform_notifications.priority_${priority}`)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const tone =
    status === "unread"
      ? "bg-warning-50 text-warning-700"
      : "bg-success-50 text-success-700";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone}`}>
      {t(`admin.platform_notifications.status_${status}`)}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <dt className="text-xs uppercase tracking-wide text-fg-t6">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}
