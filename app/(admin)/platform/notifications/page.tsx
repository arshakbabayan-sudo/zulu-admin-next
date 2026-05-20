"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  Button,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";

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

type Meta = { total: number; per_page: number; current_page: number; last_page: number };
type Stats = {
  total: number;
  unread: number;
  read: number;
  by_event_type: Record<string, number>;
  by_priority: Record<string, number>;
};

export default function PlatformNotificationsPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
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

  const baseURL = useMemo(() => process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am", []);

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
          fetch(`${baseURL}/platform-admin/notifications?${params.toString()}`, { headers }),
          fetch(`${baseURL}/platform-admin/notifications/stats`, { headers }),
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
        } else setError(listJson?.message ?? t("admin.platform_notifications.err_load"));
        if (statsJson?.success) setStats(statsJson.data);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : t("admin.platform_notifications.err_load"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, allowed, baseURL, page, appliedFilters, t]);

  const applyFilters = () => { setPage(1); setAppliedFilters((n) => n + 1); };
  const resetFilters = () => {
    setUserId(""); setEventType(""); setStatus(""); setPriority(""); setFrom(""); setTo(""); setQ("");
    setPage(1); setAppliedFilters((n) => n + 1);
  };

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.platform_notifications.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.platform_notifications.title")} subtitle={t("admin.platform_notifications.subtitle")} />

      {error && <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{error}</div>}

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t("admin.platform_notifications.total")} value={formatNumber(stats.total, lang)} />
          <StatCard label={t("admin.platform_notifications.unread")} value={formatNumber(stats.unread, lang)} tone={stats.unread > 0 ? "warn" : "neutral"} />
          <StatCard label={t("admin.platform_notifications.read")} value={formatNumber(stats.read, lang)} tone="good" />
          <StatCard label={t("admin.platform_notifications.critical_lifetime")} value={String(stats.by_priority?.critical ?? 0)} tone={(stats.by_priority?.critical ?? 0) > 0 ? "warn" : "neutral"} />
        </div>
      )}

      {stats && Object.keys(stats.by_event_type ?? {}).length > 0 && (
        <div className="admin-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
            {t("admin.platform_notifications.top_events")}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(stats.by_event_type).slice(0, 12).map(([ev, count]) => (
              <button
                key={ev}
                type="button"
                onClick={() => { setEventType(ev); setPage(1); setAppliedFilters((n) => n + 1); }}
                className="rounded-zulu border border-default bg-figma-bg-1 px-2 py-1 text-xs hover:bg-white hover:border-primary-300 transition-colors"
              >
                <span className="font-mono">{ev}</span> <span className="text-fg-t6">({count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="admin-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label={t("admin.platform_notifications.user_id")} htmlFor="n-uid">
            <Input id="n-uid" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </FormField>
          <FormField label={t("admin.platform_notifications.event_type")} htmlFor="n-evt">
            <Select id="n-evt" fieldSize="sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="">{t("common.all")}</option>
              {EVENT_TYPES.map((e) => <option key={e} value={e}>{e}</option>)}
            </Select>
          </FormField>
          <FormField label={t("admin.platform_notifications.status")} htmlFor="n-status">
            <Select id="n-status" fieldSize="sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t("common.all")}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </FormField>
          <FormField label={t("admin.platform_notifications.priority")} htmlFor="n-pri">
            <Select id="n-pri" fieldSize="sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">{t("common.all")}</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </FormField>
          <FormField label={t("admin.platform_notifications.from")} htmlFor="n-from">
            <Input id="n-from" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </FormField>
          <FormField label={t("admin.platform_notifications.to")} htmlFor="n-to">
            <Input id="n-to" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </FormField>
          <FormField label={t("common.search")} htmlFor="n-q" className="sm:col-span-2">
            <Input
              id="n-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("admin.platform_notifications.search_placeholder")}
            />
          </FormField>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={resetFilters}>{t("common.reset")}</Button>
          <Button size="sm" onClick={applyFilters}>{t("common.apply")}</Button>
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>{t("admin.platform_notifications.when")}</TH>
            <TH>{t("admin.platform_notifications.user")}</TH>
            <TH>{t("admin.platform_notifications.event")}</TH>
            <TH>{t("admin.platform_notifications.col_title")}</TH>
            <TH>{t("admin.platform_notifications.priority")}</TH>
            <TH>{t("admin.platform_notifications.status")}</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {loading ? <TEmpty colSpan={7}>{t("admin.platform_notifications.loading")}</TEmpty>
            : rows.length === 0 ? <TEmpty colSpan={7}>{t("admin.platform_notifications.empty")}</TEmpty>
            : null}
          {rows.map((r) => (
            <TR key={r.id} onClick={() => setSelected(r)}>
              <TD className="text-xs text-fg-t6 whitespace-nowrap">{formatDateTime(r.created_at, lang)}</TD>
              <TD className="text-xs">
                {r.user?.name ?? `#${r.user_id}`}
                {r.user?.email && <div className="text-fg-t6">{r.user.email}</div>}
              </TD>
              <TD className="font-mono text-xs">{r.event_type ?? "—"}</TD>
              <TD className="text-xs truncate max-w-xs">{r.title}</TD>
              <TD>
                <StatusPill status={r.priority}>{t(`admin.platform_notifications.priority_${r.priority}`)}</StatusPill>
              </TD>
              <TD>
                <StatusPill status={r.status}>{t(`admin.platform_notifications.status_${r.status}`)}</StatusPill>
              </TD>
              <TD align="right" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  className="text-xs text-primary-500 hover:underline"
                >
                  {t("admin.platform_notifications.view")}
                </button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}

      {/* Detail drawer (kept custom right-side drawer; Drawer primitive will replace later) */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelected(null)}>
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <p className="mt-1 text-xs text-fg-t6">{selected.event_type ?? selected.type}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded p-1 text-fg-t6 hover:bg-figma-bg-1" aria-label="Close">✕</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill status={selected.priority}>{t(`admin.platform_notifications.priority_${selected.priority}`)}</StatusPill>
              <StatusPill status={selected.status}>{t(`admin.platform_notifications.status_${selected.status}`)}</StatusPill>
            </div>
            <div className="mt-4 rounded-zulu border border-default bg-figma-bg-1 p-3 text-sm whitespace-pre-wrap">{selected.message}</div>
            <dl className="mt-6 space-y-2 text-sm">
              <DetailRow label={t("admin.platform_notifications.user")} value={selected.user ? `${selected.user.name} <${selected.user.email}>` : `#${selected.user_id}`} />
              <DetailRow label={t("admin.platform_notifications.when")} value={formatDateTime(selected.created_at, lang)} />
              <DetailRow label={t("admin.platform_notifications.type")} value={selected.type} />
              <DetailRow label={t("admin.platform_notifications.event")} value={selected.event_type ?? "—"} />
              <DetailRow label={t("admin.platform_notifications.subject")} value={selected.subject_type ? `${selected.subject_type}${selected.subject_id ? " #" + selected.subject_id : ""}` : "—"} />
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "good" | "warn" | "neutral" }) {
  const toneClass = tone === "good" ? "text-success-600" : tone === "warn" ? "text-warning-600" : "text-fg-t11";
  return (
    <div className="admin-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-fg-t6">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
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
