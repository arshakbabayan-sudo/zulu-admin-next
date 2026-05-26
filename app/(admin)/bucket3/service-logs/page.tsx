"use client";

/**
 * v2 admin-redesign — Service logs (Marketplace ops group, Bucket 3 surface).
 *
 * Source spec: docs/admin_designe/marketplace_ops/marketplace_ops_implementation_prompt.md §3.H
 * Mockup: docs/admin_designe/marketplace_ops/marketplace_ops_mocks.html (PAGE 8 SERVICE LOGS).
 *
 * Migrated 2026-05-26. Wraps the existing /platform-admin/audit-logs endpoint
 * with a curated set of categories (data_change / financial / approval /
 * contract). The platform's full audit log lives at /platform/audit-logs;
 * this Bucket-3 surface is the operations-focused subset.
 *
 * The 4 stat cards intentionally render em-dash placeholders. A separate
 * /platform-admin/service-logs/stats endpoint is deferred — see TODO below.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
import { formatDateTime } from "@/lib/format";
import { STATUS_BADGE_CLASS, formatRelativeTime, statusBadgeStyle, type StatusTone } from "@/lib/admin-v2-helpers";
import { Pagination } from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  StatCard,
  StatGrid,
  IconButton,
} from "@/components/ui/v2";
import { MarketplaceOpsSectionTabs } from "@/components/marketplace/MarketplaceOpsSectionTabs";
import {
  CircleX,
  Download,
  Eye,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  Webhook,
  X as XIcon,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ServiceCategory = "data_change" | "financial" | "approval" | "contract";

// Service filter — maps a friendly name to the audit-log `category` column.
const SERVICE_OPTIONS: Array<{ value: ServiceCategory | ""; label: string; emoji: string }> = [
  { value: "", label: "All services", emoji: "" },
  { value: "data_change", label: "Email (SendGrid)", emoji: "📧" },
  { value: "approval", label: "SMS (Twilio)", emoji: "📱" },
  { value: "contract", label: "Webhook", emoji: "🔗" },
  { value: "financial", label: "Payment gateway", emoji: "💳" },
];

// Status filter is a client-side match against the audit `action` keyword.
const STATUS_OPTIONS: Array<{ value: string; label: string; tone: StatusTone }> = [
  { value: "", label: "All", tone: "gray" },
  { value: "success", label: "Success", tone: "success" },
  { value: "failed", label: "Failed", tone: "danger" },
  { value: "pending", label: "Pending", tone: "info" },
  { value: "retry", label: "Retry", tone: "warning" },
];

type AuditRow = {
  id: number;
  category: string;
  action: string;
  actor_id: number | null;
  actor_type: string | null;
  subject_type: string | null;
  subject_id: string | number | null;
  created_at: string;
};

async function fetchServiceLogs(
  token: string,
  page: number,
  category: ServiceCategory | "",
  search: string
): Promise<ApiSuccessEnvelope<AuditRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", "25");
  if (category) q.set("category", category);
  if (search) q.set("q", search);
  return apiFetchJson(`/platform-admin/audit-logs?${q.toString()}`, {
    method: "GET",
    token,
  });
}

function serviceMetaFor(category: string): { emoji: string; label: string } {
  switch (category) {
    case "data_change":
      return { emoji: "📧", label: "SendGrid" };
    case "approval":
      return { emoji: "📱", label: "Twilio" };
    case "contract":
      return { emoji: "🔗", label: "Webhook" };
    case "financial":
      return { emoji: "💳", label: "Stripe" };
    default:
      return { emoji: "🔧", label: category };
  }
}

function statusFor(action: string): { tone: StatusTone; label: string } {
  const a = (action || "").toLowerCase();
  if (a.includes("fail") || a.includes("error") || a.includes("denied")) {
    return { tone: "danger", label: "Failed" };
  }
  if (a.includes("retry")) return { tone: "warning", label: "Retry" };
  if (a.includes("pending") || a.includes("queued") || a.includes("processing")) {
    return { tone: "info", label: "Pending" };
  }
  return { tone: "success", label: "Delivered" };
}

export default function Bucket3ServiceLogsPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<ServiceCategory | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await fetchServiceLogs(token, page, category, search.trim());
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load service logs");
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, category, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter((r) => statusFor(r.action).label.toLowerCase() === statusFilter);
  }, [rows, statusFilter]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (category) {
      const opt = SERVICE_OPTIONS.find((o) => o.value === category);
      chips.push({
        key: "service",
        label: `Service: ${opt?.label ?? category}`,
        clear: () => {
          setPage(1);
          setCategory("");
        },
      });
    }
    if (statusFilter) {
      const opt = STATUS_OPTIONS.find((o) => o.value === statusFilter);
      chips.push({
        key: "status",
        label: `Status: ${opt?.label ?? statusFilter}`,
        clear: () => setStatusFilter(""),
      });
    }
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `“${search.trim()}”`,
        clear: () => {
          setPage(1);
          setSearch("");
          setSearchDraft("");
        },
      });
    }
    return chips;
  }, [category, statusFilter, search]);

  function clearAllFilters() {
    setPage(1);
    setCategory("");
    setStatusFilter("");
    setSearch("");
    setSearchDraft("");
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.bucket3.service_logs.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.bucket3.service_logs.title") },
        ]}
        title={t("admin.bucket3.service_logs.title")}
        subtitle={
          meta
            ? t("admin.bucket3.service_logs.subtitle_count")
                .replace("{count}", String(meta.total))
                .replace("{page}", String(meta.current_page))
                .replace("{last}", String(meta.last_page))
            : t("admin.bucket3.service_logs.subtitle")
        }
        actions={
          <>
            <V2Button onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh">
              {""}
            </V2Button>
            <V2Button icon={<Download className="h-4 w-4" />}>Export</V2Button>
            <Link
              href="/platform/audit-logs"
              className="inline-flex h-10 items-center rounded-md border px-4 text-[12px] font-semibold transition hover:opacity-80"
              style={{
                borderColor: "var(--admin-primary-light)",
                color: "var(--admin-primary)",
                backgroundColor: "var(--admin-primary-soft)",
              }}
            >
              {t("admin.bucket3.service_logs.full_audit_log")}
            </Link>
          </>
        }
      />

      <MarketplaceOpsSectionTabs activeHref="/bucket3/service-logs" />

      {/* TODO: replace em-dash placeholders with real counts once a
          /platform-admin/service-logs/stats endpoint ships
          (emails_sent_7d / sms_sent_7d / webhooks_7d / failures_7d). */}
      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<Mail style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value="—"
          label="Emails sent (7d)"
        />
        <StatCard
          icon={<MessageCircle style={{ color: "var(--admin-info)" }} className="h-[22px] w-[22px]" />}
          value="—"
          label="SMS sent (7d)"
        />
        <StatCard
          icon={<Webhook style={{ color: "var(--admin-warning)" }} className="h-[22px] w-[22px]" />}
          value="—"
          label="Webhook calls (7d)"
        />
        <StatCard
          icon={<CircleX style={{ color: "var(--admin-danger)" }} className="h-[22px] w-[22px]" />}
          value="—"
          label="Failures (7d)"
        />
      </StatGrid>

      <FilterCard>
        <FilterField label="Service">
          <select
            value={category}
            onChange={(e) => {
              setPage(1);
              setCategory(e.target.value as ServiceCategory | "");
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            {SERVICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.emoji ? `${o.emoji} ${o.label}` : o.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Status">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Search" minWidth={240}>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--admin-text-tertiary)" }}
            />
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setSearch(searchDraft.trim());
                }
              }}
              placeholder={t("admin.bucket3.service_logs.search_placeholder")}
              className="h-[34px] w-full rounded-md border bg-white pl-9 pr-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            />
          </div>
        </FilterField>
        <V2Button
          variant="primary"
          size="md"
          onClick={() => {
            setPage(1);
            setSearch(searchDraft.trim());
          }}
        >
          Apply
        </V2Button>
        {activeChips.length > 0 ? (
          <V2Button size="md" onClick={clearAllFilters}>
            Clear
          </V2Button>
        ) : null}
      </FilterCard>

      {activeChips.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium" style={{ color: "var(--admin-text-secondary)" }}>
            Active filters:
          </span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium transition hover:opacity-80"
              style={{
                backgroundColor: "var(--admin-primary-soft)",
                borderColor: "var(--admin-primary-light)",
                color: "var(--admin-primary)",
              }}
            >
              {chip.label}
              <XIcon className="h-3 w-3 opacity-70" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium opacity-80 hover:opacity-100"
            style={{ color: "var(--admin-text-secondary)" }}
          >
            <XCircle className="h-3 w-3" />
            Clear all
          </button>
        </div>
      ) : null}

      {err ? (
        <div
          className="mb-4 rounded-md border px-4 py-2 text-sm"
          style={{
            borderColor: "var(--admin-danger-light)",
            backgroundColor: "var(--admin-danger-light)",
            color: "var(--admin-danger-dark)",
          }}
        >
          {err}
        </div>
      ) : null}

      <V2Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead
              className="text-[11px] font-semibold uppercase tracking-[0.5px]"
              style={{ backgroundColor: "var(--admin-bg-secondary)", color: "var(--admin-text-secondary)" }}
            >
              <tr>
                <th className="px-4 py-2.5 text-left">When</th>
                <th className="px-4 py-2.5 text-left">Service</th>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-left">Recipient / Target</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Duration</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    Loading…
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    {t("admin.bucket3.service_logs.empty")}
                  </td>
                </tr>
              ) : (
                visibleRows.map((r) => {
                  const svc = serviceMetaFor(r.category);
                  const st = statusFor(r.action);
                  return (
                    <tr
                      key={r.id}
                      className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                    >
                      <td className="px-4 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--admin-text-secondary)" }}>
                        <span title={formatDateTime(r.created_at, lang)}>{formatRelativeTime(r.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            backgroundColor: "var(--admin-bg-tertiary)",
                            color: "var(--admin-text-secondary)",
                          }}
                        >
                          <span aria-hidden>{svc.emoji}</span>
                          {svc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-fg-t8">{r.action}</td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {r.subject_type
                          ? `${r.subject_type.replace(/^.*\\/, "")}${r.subject_id != null ? ` #${r.subject_id}` : ""}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(st.tone)}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
                        —
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton aria-label="View">
                            <Eye />
                          </IconButton>
                          {st.tone === "danger" ? (
                            <IconButton aria-label="Retry">
                              <RefreshCw />
                            </IconButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {meta && meta.last_page > 1 ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 text-[12px]"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}
          >
            <span>
              Showing {(meta.current_page - 1) * meta.per_page + 1}–
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} entries
            </span>
            <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={(p) => setPage(p)} />
          </div>
        ) : null}
      </V2Card>
    </div>
  );
}
