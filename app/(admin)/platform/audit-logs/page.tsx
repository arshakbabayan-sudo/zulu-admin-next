"use client";

/**
 * v2 admin-redesign — Audit logs list (Marketplace ops group).
 *
 * Source spec: docs/admin_designe/marketplace_ops/marketplace_ops_implementation_prompt.md §3.G
 * Mockup: docs/admin_designe/marketplace_ops/marketplace_ops_mocks.html (PAGE 7 AUDIT LOGS).
 *
 * Migrated 2026-05-26 to MarketplaceOpsSectionTabs + StatGrid (4 cards from
 * apiAuditLogsStats) + v2 PageHeader/FilterCard/V2Card/StatCard/IconButton.
 *
 * Backend wiring is preserved verbatim:
 *   GET  /api/platform-admin/audit-logs
 *   GET  /api/platform-admin/audit-logs/{id}
 *   POST /api/platform-admin/audit-logs/verify-integrity
 */

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDateTime, formatNumber } from "@/lib/format";
import { apiAuditLogsStats, type AuditLogsStats } from "@/lib/marketplace-stats-api";
import {
  STATUS_BADGE_CLASS,
  avatarInitials,
  avatarStyle,
  formatRelativeTime,
  pickAvatarTone,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
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
  SuperAdminTag,
} from "@/components/ui/v2";
import { LogsInnerTabs, MarketplaceOpsSectionTabs } from "@/components/marketplace/MarketplaceOpsSectionTabs";
import {
  AlertTriangle,
  CircleX,
  Download,
  Eye,
  History,
  RefreshCw,
  ShieldCheck,
  Users as UsersIcon,
  X as XIcon,
  XCircle,
} from "lucide-react";

const CATEGORIES = [
  "auth",
  "data_change",
  "financial",
  "approval",
  "contract",
  "support",
  "admin_actions",
  "api",
  "security",
  "system",
] as const;

// Action-type filter — maps a friendly group name to a keyword that the
// audit log's `action` column is matched against (LIKE). Backend treats
// the `action` filter as a contains-match.
const ACTION_TYPES: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "approve", label: "Approve" },
  { value: "login", label: "Login" },
];

// Resource filter — maps to subject_type (App\\Models\\...).
const RESOURCE_TYPES: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "Company", label: "Company" },
  { value: "User", label: "User" },
  { value: "Booking", label: "Booking" },
  { value: "Contract", label: "Contract" },
  { value: "Hotel", label: "Hotel" },
];

// Severity filter — derived from the category, no backend column yet.
const SEVERITY_LEVELS: Array<{ value: string; label: string; tone: StatusTone }> = [
  { value: "", label: "All", tone: "gray" },
  { value: "info", label: "Info", tone: "info" },
  { value: "warning", label: "Warning", tone: "warning" },
  { value: "critical", label: "Critical", tone: "danger" },
];

type AuditLogRow = {
  id: string;
  category: string;
  actor_type: string;
  actor_id: number | null;
  actor_name_snapshot: string | null;
  subject_type: string | null;
  subject_id: string | null;
  action: string;
  changes: unknown;
  context: unknown;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  hash: string;
  previous_log_hash: string | null;
  created_at: string;
};

type Meta = {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
};

type IntegrityResult = {
  corrupted_log_ids: string[];
  is_intact: boolean;
  limit_checked: number;
};

function severityFor(row: AuditLogRow): { value: "info" | "warning" | "critical"; tone: StatusTone; label: string } {
  const cat = row.category;
  const action = row.action.toLowerCase();
  if (cat === "security" || action.includes("fail") || action.includes("denied") || action.includes("breach")) {
    return { value: "critical", tone: "danger", label: "Critical" };
  }
  if (cat === "auth" || cat === "admin_actions" || action.includes("delete")) {
    return { value: "warning", tone: "warning", label: "Warning" };
  }
  return { value: "info", tone: "info", label: "Info" };
}

function shortType(t: string): string {
  const i = t.lastIndexOf("\\");
  return i >= 0 ? t.slice(i + 1) : t;
}

export default function PlatformAuditLogsPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [stats, setStats] = useState<AuditLogsStats | null>(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);

  const [actionType, setActionType] = useState("");
  const [actor, setActor] = useState("");
  const [resource, setResource] = useState("");
  const [severity, setSeverity] = useState("");
  const [q, setQ] = useState("");
  const [appliedFilters, setAppliedFilters] = useState(0);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<AuditLogRow | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [verifying, setVerifying] = useState(false);

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

    void (async () => {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("per_page", String(perPage));
        if (actionType) params.set("action", actionType);
        if (actor.trim()) {
          // Actor input is free-text — if numeric, send as actor_id, else send as q.
          if (/^\d+$/.test(actor.trim())) params.set("actor_id", actor.trim());
        }
        if (resource) params.set("subject_type", resource);
        if (q.trim()) params.set("q", q.trim());

        const res = await fetch(
          `${baseURL}/platform-admin/audit-logs?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
        );
        if (res.status === 403) {
          if (!cancelled) setForbidden(true);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        if (json?.success) {
          setRows(json.data ?? []);
          setMeta(json.meta ?? null);
        } else if (res.status === 404 || json?.message === "Not found") {
          setRows([]);
          setMeta(null);
        } else {
          setError(json?.message ?? t("admin.platform_audit_logs.err_load"));
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) {
          setForbidden(true);
        } else {
          setError(e instanceof Error ? e.message : t("admin.platform_audit_logs.err_load"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, allowed, baseURL, page, perPage, appliedFilters, t, actionType, actor, resource, q]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiAuditLogsStats(token, "30d")
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  // Severity is a client-side filter — there's no backend column yet.
  const visibleRows = useMemo(() => {
    if (!severity) return rows;
    return rows.filter((r) => severityFor(r).value === severity);
  }, [rows, severity]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  const resetFilters = () => {
    setActionType("");
    setActor("");
    setResource("");
    setSeverity("");
    setQ("");
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (actionType) {
      const lbl = ACTION_TYPES.find((a) => a.value === actionType)?.label ?? actionType;
      chips.push({
        key: "action",
        label: `Action: ${lbl}`,
        clear: () => {
          setPage(1);
          setActionType("");
          setAppliedFilters((n) => n + 1);
        },
      });
    }
    if (actor.trim()) {
      chips.push({
        key: "actor",
        label: `Actor: ${actor.trim()}`,
        clear: () => {
          setPage(1);
          setActor("");
          setAppliedFilters((n) => n + 1);
        },
      });
    }
    if (resource) {
      chips.push({
        key: "resource",
        label: `Resource: ${resource}`,
        clear: () => {
          setPage(1);
          setResource("");
          setAppliedFilters((n) => n + 1);
        },
      });
    }
    if (severity) {
      const lbl = SEVERITY_LEVELS.find((s) => s.value === severity)?.label ?? severity;
      chips.push({
        key: "severity",
        label: `Severity: ${lbl}`,
        clear: () => {
          setSeverity("");
        },
      });
    }
    if (q.trim()) {
      chips.push({
        key: "q",
        label: `“${q.trim()}”`,
        clear: () => {
          setPage(1);
          setQ("");
          setAppliedFilters((n) => n + 1);
        },
      });
    }
    return chips;
  }, [actionType, actor, resource, severity, q]);

  const verifyIntegrity = async () => {
    if (!token) return;
    setVerifying(true);
    setIntegrity(null);
    try {
      const res = await fetch(
        `${baseURL}/platform-admin/audit-logs/verify-integrity?limit=1000`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }
      );
      const json = await res.json();
      if (json?.success) {
        setIntegrity(json.data);
      } else {
        setError(json?.message ?? t("admin.platform_audit_logs.err_integrity_check"));
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("admin.platform_audit_logs.err_integrity_check")
      );
    } finally {
      setVerifying(false);
    }
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const headers = [
      "id",
      "created_at",
      "category",
      "action",
      "actor_type",
      "actor_id",
      "actor_name",
      "subject_type",
      "subject_id",
      "ip_address",
    ];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.created_at,
          r.category,
          r.action,
          r.actor_type,
          r.actor_id ?? "",
          r.actor_name_snapshot ?? "",
          r.subject_type ?? "",
          r.subject_id ?? "",
          r.ip_address ?? "",
        ]
          .map(escape)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-page-${meta?.current_page ?? page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.platform_audit_logs.title")}</h1>
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
          { label: "Management", href: "/platform/companies" },
          { label: t("admin.platform_audit_logs.title") },
        ]}
        title={t("admin.platform_audit_logs.title")}
        titleBadge={<SuperAdminTag />}
        subtitle={t("admin.platform_audit_logs.subtitle")}
        actions={
          <>
            <V2Button onClick={applyFilters} icon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh">
              {""}
            </V2Button>
            <V2Button
              size="md"
              onClick={verifyIntegrity}
              disabled={verifying}
              icon={<ShieldCheck className="h-4 w-4" />}
            >
              {verifying
                ? t("admin.platform_audit_logs.verifying")
                : t("admin.platform_audit_logs.verify_integrity")}
            </V2Button>
            <V2Button
              size="md"
              onClick={exportCsv}
              disabled={rows.length === 0}
              icon={<Download className="h-4 w-4" />}
            >
              {t("admin.platform_audit_logs.export_csv_page")}
            </V2Button>
          </>
        }
      />

      <MarketplaceOpsSectionTabs activeHref="/platform/audit-logs" />

      {/* Phase 2B (2026-05-31) — Logs is one feature, two facets. Audit and
          Services share the same backend endpoint with a category filter;
          surfacing them as inner tabs of one Logs feature makes the
          relationship obvious. The outer "Logs" tab in the Management strip
          stays highlighted for both views. */}
      <LogsInnerTabs activeHref="/platform/audit-logs" />

      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<History style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.total.toLocaleString() : "—"}
          label="Total events (30d)"
        />
        <StatCard
          icon={<UsersIcon style={{ color: "var(--admin-info)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.active_admins.toLocaleString() : "—"}
          label="Active admin users"
        />
        <StatCard
          icon={<AlertTriangle style={{ color: "var(--admin-warning)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.suspicious.toLocaleString() : "—"}
          label="Suspicious events"
        />
        <StatCard
          icon={<CircleX style={{ color: "var(--admin-danger)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.failed.toLocaleString() : "—"}
          label="Failed attempts"
        />
      </StatGrid>

      {error ? (
        <div
          className="mb-4 rounded-md border px-4 py-2 text-sm"
          style={{
            borderColor: "var(--admin-danger-light)",
            backgroundColor: "var(--admin-danger-light)",
            color: "var(--admin-danger-dark)",
          }}
        >
          {error}
        </div>
      ) : null}

      {integrity ? (
        <div
          className="mb-4 rounded-md border px-4 py-2 text-sm"
          style={{
            borderColor: integrity.is_intact ? "var(--admin-success-light)" : "var(--admin-danger-light)",
            backgroundColor: integrity.is_intact ? "var(--admin-success-light)" : "var(--admin-danger-light)",
            color: integrity.is_intact ? "var(--admin-success-dark)" : "var(--admin-danger-dark)",
          }}
        >
          {integrity.is_intact
            ? t("admin.platform_audit_logs.hash_chain_intact").replace(
                "{limit}",
                String(integrity.limit_checked)
              )
            : t("admin.platform_audit_logs.tampered_detected")
                .replace("{count}", String(integrity.corrupted_log_ids.length))
                .replace("{limit}", String(integrity.limit_checked))}
        </div>
      ) : null}

      <FilterCard>
        <FilterField label="Action type">
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            {ACTION_TYPES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Actor">
          {/* TODO: replace free-text actor input with admin-user dropdown
              once a lightweight "/platform-admin/users?role=staff" picker is wired. */}
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="Name or user ID"
            className="h-[34px] w-[160px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <FilterField label="Resource">
          <select
            value={resource}
            onChange={(e) => setResource(e.target.value)}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            {RESOURCE_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Severity">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            {SEVERITY_LEVELS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Category">
          <select
            value=""
            onChange={(e) => {
              // category is encoded into subject_type or surfaced via q on backend
              // — we keep an open-ended dropdown to mirror older behaviour.
              setQ(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">{t("common.all")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Search" minWidth={220}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Action, subject, actor name"
            className="h-[34px] w-full rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <V2Button size="md" onClick={resetFilters}>
          {t("common.reset")}
        </V2Button>
        <V2Button size="md" variant="primary" onClick={applyFilters}>
          {t("common.apply")}
        </V2Button>
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
            onClick={resetFilters}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium opacity-80 hover:opacity-100"
            style={{ color: "var(--admin-text-secondary)" }}
          >
            <XCircle className="h-3 w-3" />
            Clear all
          </button>
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
                <th className="px-4 py-2.5 text-left">Actor</th>
                <th className="px-4 py-2.5 text-left">Action</th>
                <th className="px-4 py-2.5 text-left">Resource</th>
                <th className="px-4 py-2.5 text-left">Severity</th>
                <th className="px-4 py-2.5 text-left">IP</th>
                <th className="px-4 py-2.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: "var(--admin-text-secondary)" }}
                  >
                    {t("admin.platform_audit_logs.loading")}
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: "var(--admin-text-secondary)" }}
                  >
                    {t("admin.platform_audit_logs.empty")}
                  </td>
                </tr>
              ) : (
                visibleRows.map((r) => {
                  const isSystem = !r.actor_id && (r.actor_type === "system" || r.actor_type.toLowerCase().includes("system"));
                  const actorName = isSystem ? "System" : r.actor_name_snapshot ?? r.actor_type ?? "Unknown";
                  const tone = pickAvatarTone(r.actor_id ?? r.id);
                  const sev = severityFor(r);
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                      onClick={() => setSelected(r)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-[12px] text-fg-t8">{formatRelativeTime(r.created_at)}</div>
                        <div
                          className="text-[10px] font-mono"
                          style={{ color: "var(--admin-text-tertiary)" }}
                          title={formatDateTime(r.created_at, lang)}
                        >
                          {new Date(r.created_at).toISOString().replace("T", " ").slice(0, 19)} UTC
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                            style={avatarStyle(tone)}
                            aria-hidden
                          >
                            {isSystem ? "SY" : avatarInitials(actorName)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-fg-t8">{actorName}</div>
                            <div className="truncate text-[11px] font-mono" style={{ color: "var(--admin-text-tertiary)" }}>
                              {r.actor_type}
                              {r.actor_id ? ` #${r.actor_id}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={STATUS_BADGE_CLASS}
                            style={statusBadgeStyle(
                              r.action.toLowerCase().includes("delete")
                                ? "danger"
                                : r.action.toLowerCase().includes("create")
                                  ? "success"
                                  : r.action.toLowerCase().includes("approve")
                                    ? "primary"
                                    : "info"
                            )}
                          >
                            {r.action}
                          </span>
                          <span className="font-mono text-[11px]" style={{ color: "var(--admin-text-tertiary)" }}>
                            {r.category}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px]">
                        {r.subject_type ? (
                          <span className="text-fg-t8">
                            {shortType(r.subject_type).toLowerCase()}
                            {r.subject_id ? `:${r.subject_id}` : ""}
                          </span>
                        ) : (
                          <span style={{ color: "var(--admin-text-tertiary)" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(sev.tone)}>
                          {sev.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {r.ip_address ?? "—"}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton aria-label="View details" onClick={() => setSelected(r)}>
                            <Eye />
                          </IconButton>
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
              {t("admin.platform_audit_logs.pagination")
                .replace("{page}", String(meta.current_page))
                .replace("{lastPage}", String(meta.last_page))
                .replace("{total}", formatNumber(meta.total, lang))}
            </span>
            <Pagination
              page={meta.current_page}
              lastPage={meta.last_page}
              onPage={setPage}
              prevLabel={t("common.prev")}
              nextLabel={t("common.next")}
            />
          </div>
        ) : null}
      </V2Card>

      {selected ? (
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
                <h2 className="text-lg font-semibold">{t("admin.platform_audit_logs.entry")}</h2>
                <p className="mt-1 font-mono text-xs text-fg-t6 break-all">{selected.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded p-1 text-fg-t6 hover:bg-figma-bg-1"
                aria-label={t("common.close")}
              >
                ✕
              </button>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <DetailRow
                label={t("admin.platform_audit_logs.time")}
                value={formatDateTime(selected.created_at, lang)}
              />
              <DetailRow label={t("admin.platform_audit_logs.category")} value={selected.category} />
              <DetailRow label={t("admin.platform_audit_logs.action")} value={selected.action} />
              <DetailRow
                label={t("admin.platform_audit_logs.actor")}
                value={
                  selected.actor_name_snapshot
                    ? `${selected.actor_name_snapshot} (${selected.actor_type}${
                        selected.actor_id ? " #" + selected.actor_id : ""
                      })`
                    : selected.actor_type
                }
              />
              <DetailRow
                label={t("admin.platform_audit_logs.subject")}
                value={
                  selected.subject_type
                    ? `${selected.subject_type}${selected.subject_id ? " #" + selected.subject_id : ""}`
                    : "—"
                }
              />
              <DetailRow label={t("admin.platform_audit_logs.ip")} value={selected.ip_address ?? "—"} />
              <DetailRow
                label={t("admin.platform_audit_logs.request_id")}
                value={selected.request_id ?? "—"}
              />
              <DetailRow
                label={t("admin.platform_audit_logs.user_agent")}
                value={selected.user_agent ?? "—"}
                mono
              />
              <DetailRow label={t("admin.platform_audit_logs.hash")} value={selected.hash} mono small />
              <DetailRow
                label={t("admin.platform_audit_logs.previous_hash")}
                value={selected.previous_log_hash ?? "—"}
                mono
                small
              />
            </dl>
            {selected.changes !== null ? (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                  {t("admin.platform_audit_logs.changes")}
                </h3>
                <pre className="mt-1 overflow-x-auto rounded-zulu bg-figma-bg-1 p-3 font-mono text-xs">
                  {JSON.stringify(selected.changes, null, 2)}
                </pre>
              </div>
            ) : null}
            {selected.context !== null ? (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                  {t("admin.platform_audit_logs.context")}
                </h3>
                <pre className="mt-1 overflow-x-auto rounded-zulu bg-figma-bg-1 p-3 font-mono text-xs">
                  {JSON.stringify(selected.context, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <dt className="text-xs uppercase tracking-wide text-fg-t6">{label}</dt>
      <dd className={`break-all ${mono ? "font-mono" : ""} ${small ? "text-xs" : "text-sm"}`}>{value}</dd>
    </div>
  );
}
