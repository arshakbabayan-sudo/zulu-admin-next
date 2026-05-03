"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";

/**
 * Platform-admin connections oversight (Sprint 57, PART 18).
 *
 * Wires to backend:
 *   GET  /api/platform-admin/connections
 *   GET  /api/platform-admin/connections/stats
 *   GET  /api/platform-admin/connections/{id}
 *   POST /api/platform-admin/connections/{id}/force-terminate
 */

const STATUSES = ["proposed", "active", "paused", "terminated", "rejected"] as const;
const TYPES = ["supplier_reseller", "mutual", "white_label", "partner_feed"] as const;

type ConnectionRow = {
  id: string;
  type: string;
  status: string;
  seller_a_company_id: number;
  seller_b_company_id: number;
  proposed_at: string | null;
  responded_at: string | null;
  terminated_at: string | null;
  termination_reason: string | null;
  seller_a?: { id: number; name: string; type: string };
  seller_b?: { id: number; name: string; type: string };
  proposed_by?: { id: number; name: string; email: string };
  responded_by?: { id: number; name: string; email: string };
  partner_agreement?: unknown;
  commission_override_rule?: unknown;
};

type Stats = {
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
};

export default function PlatformConnectionsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [appliedFilters, setAppliedFilters] = useState(0);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ConnectionRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");

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
        if (status) params.set("status", status);
        if (type) params.set("type", type);
        if (sellerId.trim()) params.set("seller_id", sellerId.trim());

        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const [listRes, statsRes] = await Promise.all([
          fetch(`${baseURL}/api/platform-admin/connections?${params.toString()}`, { headers }),
          fetch(`${baseURL}/api/platform-admin/connections/stats`, { headers }),
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
          setLastPage(listJson.last_page ?? 1);
          setTotal(listJson.total ?? 0);
        } else {
          setError(listJson?.message ?? "Failed to load");
        }
        if (statsJson?.success) {
          setStats(statsJson.data);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) {
          setForbidden(true);
        } else {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, allowed, baseURL, page, appliedFilters]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  const resetFilters = () => {
    setStatus("");
    setType("");
    setSellerId("");
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  const openDetail = async (row: ConnectionRow) => {
    setSelected(row);
    setTerminateReason("");
    try {
      const res = await fetch(`${baseURL}/api/platform-admin/connections/${row.id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await res.json();
      if (json?.success) {
        setSelected(json.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load detail");
    }
  };

  const forceTerminate = async () => {
    if (!selected) return;
    if (!terminateReason.trim()) {
      setError("Termination reason is required");
      return;
    }
    if (!confirm(`Force-terminate connection ${selected.id}? This is irreversible.`)) return;

    setActionLoading(true);
    try {
      const res = await fetch(
        `${baseURL}/api/platform-admin/connections/${selected.id}/force-terminate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: terminateReason.trim() }),
        }
      );
      const json = await res.json();
      if (json?.success) {
        setSelected(json.data);
        setAppliedFilters((n) => n + 1);
        setTerminateReason("");
      } else {
        setError(json?.message ?? "Force-terminate failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Force-terminate failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">Connections</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">Connections</h1>
      <p className="admin-page-subtitle">B2B partnerships between sellers across the platform.</p>

      {error && <p className="mt-2 text-sm text-error-600">{error}</p>}

      {/* Stats */}
      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total connections" value={stats.total.toLocaleString()} />
          <StatCard
            label="Active"
            value={String(stats.by_status?.active ?? 0)}
            tone="good"
          />
          <StatCard
            label="Proposed"
            value={String(stats.by_status?.proposed ?? 0)}
            tone="warn"
          />
          <StatCard
            label="Terminated"
            value={String(stats.by_status?.terminated ?? 0)}
            tone="neutral"
          />
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 grid gap-3 rounded border border-default bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-fg-t6">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fg-t6">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fg-t6">
          Seller (company ID)
          <input
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            placeholder="matches either side"
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <div className="flex items-end justify-end gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-figma-bg-1"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">Seller A</th>
              <th className="px-3 py-2">Seller B</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Proposed by</th>
              <th className="px-3 py-2">Proposed at</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-fg-t6">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-fg-t6">
                  No connections found.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 text-xs">
                  {r.seller_a?.name ?? `#${r.seller_a_company_id}`}
                  <div className="text-fg-t6">{r.seller_a?.type ?? ""}</div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.seller_b?.name ?? `#${r.seller_b_company_id}`}
                  <div className="text-fg-t6">{r.seller_b?.type ?? ""}</div>
                </td>
                <td className="px-3 py-2 text-xs">{r.type}</td>
                <td className="px-3 py-2">
                  <ConnectionStatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2 text-xs">{r.proposed_by?.name ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-fg-t7">
                  {r.proposed_at ? new Date(r.proposed_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => openDetail(r)}
                    className="text-xs text-primary-500 hover:underline"
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-fg-t6">
            Page {page} of {lastPage} ({total.toLocaleString()} entries)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border border-default bg-white px-3 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage}
              className="rounded border border-default bg-white px-3 py-1 disabled:opacity-50"
            >
              Next
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
                <h2 className="text-lg font-semibold">Connection</h2>
                <p className="mt-1 font-mono text-xs text-fg-t6 break-all">{selected.id}</p>
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

            <dl className="mt-4 space-y-2 text-sm">
              <DetailRow
                label="Seller A"
                value={`${selected.seller_a?.name ?? "#" + selected.seller_a_company_id} (${selected.seller_a?.type ?? "—"})`}
              />
              <DetailRow
                label="Seller B"
                value={`${selected.seller_b?.name ?? "#" + selected.seller_b_company_id} (${selected.seller_b?.type ?? "—"})`}
              />
              <DetailRow label="Type" value={selected.type} />
              <DetailRow label="Status" value={selected.status} />
              <DetailRow
                label="Proposed by"
                value={
                  selected.proposed_by
                    ? `${selected.proposed_by.name} <${selected.proposed_by.email}>`
                    : "—"
                }
              />
              <DetailRow
                label="Proposed at"
                value={selected.proposed_at ? new Date(selected.proposed_at).toLocaleString() : "—"}
              />
              <DetailRow
                label="Responded by"
                value={
                  selected.responded_by
                    ? `${selected.responded_by.name} <${selected.responded_by.email}>`
                    : "—"
                }
              />
              <DetailRow
                label="Responded at"
                value={
                  selected.responded_at ? new Date(selected.responded_at).toLocaleString() : "—"
                }
              />
              {selected.terminated_at && (
                <>
                  <DetailRow
                    label="Terminated at"
                    value={new Date(selected.terminated_at).toLocaleString()}
                  />
                  <DetailRow
                    label="Termination reason"
                    value={selected.termination_reason ?? "—"}
                  />
                </>
              )}
            </dl>

            {selected.partner_agreement !== undefined && selected.partner_agreement !== null && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                  Partner agreement
                </h3>
                <pre className="mt-1 overflow-x-auto rounded bg-figma-bg-1 p-3 font-mono text-xs">
                  {JSON.stringify(selected.partner_agreement, null, 2)}
                </pre>
              </div>
            )}
            {selected.commission_override_rule !== undefined &&
              selected.commission_override_rule !== null && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                    Commission override
                  </h3>
                  <pre className="mt-1 overflow-x-auto rounded bg-figma-bg-1 p-3 font-mono text-xs">
                    {JSON.stringify(selected.commission_override_rule, null, 2)}
                  </pre>
                </div>
              )}

            {/* Force-terminate action */}
            {!["terminated", "rejected"].includes(selected.status) && (
              <div className="mt-6 rounded border border-error-300 bg-error-50 p-4">
                <h3 className="text-sm font-semibold text-error-700">Force-terminate</h3>
                <p className="mt-1 text-xs text-error-600">
                  Reason is required. The connection will be marked terminated with prefix
                  <code className="ml-1 rounded bg-white px-1 font-mono">ADMIN: …</code>
                </p>
                <textarea
                  value={terminateReason}
                  onChange={(e) => setTerminateReason(e.target.value)}
                  rows={2}
                  placeholder="Reason for force-termination"
                  className="mt-2 w-full rounded border border-error-300 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={forceTerminate}
                  disabled={actionLoading || !terminateReason.trim()}
                  className="mt-2 rounded bg-error-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-error-700 disabled:opacity-50"
                >
                  {actionLoading ? "Terminating…" : "Force-terminate"}
                </button>
              </div>
            )}
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

function ConnectionStatusBadge({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-success-50 text-success-700"
      : status === "proposed"
        ? "bg-warning-50 text-warning-700"
        : status === "paused"
          ? "bg-figma-bg-1 text-fg-t7"
          : status === "terminated" || status === "rejected"
            ? "bg-error-50 text-error-700"
            : "bg-figma-bg-1 text-fg-t6";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone}`}>
      {status}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <dt className="text-xs uppercase tracking-wide text-fg-t6">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}
