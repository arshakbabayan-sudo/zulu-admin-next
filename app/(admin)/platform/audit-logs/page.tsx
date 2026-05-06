"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Platform-admin audit log viewer (Sprint 53, PART 26).
 *
 * Wires to backend:
 *   GET  /api/platform-admin/audit-logs
 *   GET  /api/platform-admin/audit-logs/{id}
 *   POST /api/platform-admin/audit-logs/verify-integrity
 */

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

export default function PlatformAuditLogsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);

  const [category, setCategory] = useState("");
  const [action, setAction] = useState("");
  const [subjectType, setSubjectType] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [actorId, setActorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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

    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("per_page", String(perPage));
        if (category) params.set("category", category);
        if (action.trim()) params.set("action", action.trim());
        if (subjectType.trim()) params.set("subject_type", subjectType.trim());
        if (subjectId.trim()) params.set("subject_id", subjectId.trim());
        if (actorId.trim()) params.set("actor_id", actorId.trim());
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (q.trim()) params.set("q", q.trim());

        const res = await fetch(
          `${baseURL}/api/platform-admin/audit-logs?${params.toString()}`,
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
          // Treat backend "Not found" as empty list, not as an error
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
  }, [token, allowed, baseURL, page, perPage, appliedFilters, t]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  const resetFilters = () => {
    setCategory("");
    setAction("");
    setSubjectType("");
    setSubjectId("");
    setActorId("");
    setFrom("");
    setTo("");
    setQ("");
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  const verifyIntegrity = async () => {
    if (!token) return;
    setVerifying(true);
    setIntegrity(null);
    try {
      const res = await fetch(
        `${baseURL}/api/platform-admin/audit-logs/verify-integrity?limit=1000`,
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
      setError(e instanceof Error ? e.message : t("admin.platform_audit_logs.err_integrity_check"));
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
      <div>
        <h1 className="admin-page-title">{t("admin.platform_audit_logs.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="admin-page-title">{t("admin.platform_audit_logs.title")}</h1>
          <p className="admin-page-subtitle">
            {t("admin.platform_audit_logs.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={verifyIntegrity}
            disabled={verifying}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-figma-bg-1 disabled:opacity-50"
          >
            {verifying ? t("admin.platform_audit_logs.verifying") : t("admin.platform_audit_logs.verify_integrity")}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-figma-bg-1 disabled:opacity-50"
          >
            {t("admin.platform_audit_logs.export_csv_page")}
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-error-600">{error}</p>}

      {integrity && (
        <div
          className={`mt-4 rounded border px-3 py-2 text-sm ${
            integrity.is_intact
              ? "border-success-300 bg-success-50 text-success-700"
              : "border-error-300 bg-error-50 text-error-700"
          }`}
        >
          {integrity.is_intact ? (
            <>{t("admin.platform_audit_logs.hash_chain_intact").replace("{limit}", String(integrity.limit_checked))}</>
          ) : (
            <>
              {t("admin.platform_audit_logs.tampered_detected")
                .replace("{count}", String(integrity.corrupted_log_ids.length))
                .replace("{limit}", String(integrity.limit_checked))}
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 grid gap-3 rounded border border-default bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-fg-t6">
          {t("admin.platform_audit_logs.category")}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          >
            <option value="">{t("common.all")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fg-t6">
          {t("admin.platform_audit_logs.action")}
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="user.login"
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-fg-t6">
          {t("admin.platform_audit_logs.subject_type")}
          <input
            value={subjectType}
            onChange={(e) => setSubjectType(e.target.value)}
            placeholder="App\Models\Order"
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-fg-t6">
          {t("admin.platform_audit_logs.subject_id")}
          <input
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-fg-t6">
          {t("admin.platform_audit_logs.actor_id")}
          <input
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-fg-t6">
          {t("admin.platform_audit_logs.from")}
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-fg-t6">
          {t("admin.platform_audit_logs.to")}
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-fg-t6">
          {t("common.search")}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="action, subject, actor name"
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
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.platform_audit_logs.time")}</th>
              <th className="px-3 py-2">{t("admin.platform_audit_logs.category")}</th>
              <th className="px-3 py-2">{t("admin.platform_audit_logs.action")}</th>
              <th className="px-3 py-2">{t("admin.platform_audit_logs.actor")}</th>
              <th className="px-3 py-2">{t("admin.platform_audit_logs.subject")}</th>
              <th className="px-3 py-2">{t("admin.platform_audit_logs.ip")}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-fg-t6">
                  {t("admin.platform_audit_logs.loading")}
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-fg-t6">
                  {t("admin.platform_audit_logs.empty")}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 text-xs text-fg-t7 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <CategoryBadge category={r.category} />
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                <td className="px-3 py-2 text-xs">
                  {r.actor_name_snapshot ?? r.actor_type}
                  {r.actor_id ? <span className="text-fg-t6"> #{r.actor_id}</span> : null}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.subject_type ? (
                    <>
                      <span className="text-fg-t6">{shortType(r.subject_type)}</span>
                      {r.subject_id ? <span> #{r.subject_id}</span> : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-fg-t7">{r.ip_address ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="text-xs text-primary-500 hover:underline"
                  >
                    {t("admin.platform_audit_logs.details")}
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
            {t("admin.platform_audit_logs.pagination")
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

      {/* Detail drawer */}
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
              <DetailRow label={t("admin.platform_audit_logs.time")} value={new Date(selected.created_at).toLocaleString()} />
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
              <DetailRow label={t("admin.platform_audit_logs.request_id")} value={selected.request_id ?? "—"} />
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
            {selected.changes !== null && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                  {t("admin.platform_audit_logs.changes")}
                </h3>
                <pre className="mt-1 overflow-x-auto rounded bg-figma-bg-1 p-3 font-mono text-xs">
                  {JSON.stringify(selected.changes, null, 2)}
                </pre>
              </div>
            )}
            {selected.context !== null && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                  {t("admin.platform_audit_logs.context")}
                </h3>
                <pre className="mt-1 overflow-x-auto rounded bg-figma-bg-1 p-3 font-mono text-xs">
                  {JSON.stringify(selected.context, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function shortType(t: string): string {
  const i = t.lastIndexOf("\\");
  return i >= 0 ? t.slice(i + 1) : t;
}

function CategoryBadge({ category }: { category: string }) {
  const { t } = useLanguage();
  const tone =
    category === "security" || category === "auth"
      ? "bg-warning-50 text-warning-700"
      : category === "financial"
        ? "bg-success-50 text-success-700"
        : category === "admin_actions"
          ? "bg-primary-50 text-primary-600"
          : "bg-figma-bg-1 text-fg-t7";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone}`}>
      {t(`admin.platform_audit_logs.category_${category}`)}
    </span>
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
      <dd
        className={`break-all ${mono ? "font-mono" : ""} ${small ? "text-xs" : "text-sm"}`}
      >
        {value}
      </dd>
    </div>
  );
}
