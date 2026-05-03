"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";

/**
 * Platform-admin voucher viewer (Sprint 56, PART 09).
 *
 * Wires to backend:
 *   GET  /api/platform-admin/vouchers
 *   GET  /api/platform-admin/vouchers/{id}
 *   POST /api/platform-admin/vouchers/{id}/void
 *   POST /api/platform-admin/vouchers/{id}/reissue
 */

const STATUSES = ["issued", "used", "void", "reissued", "expired"] as const;
const SERVICE_TYPES = [
  "flight",
  "hotel",
  "transfer",
  "car",
  "excursion",
  "visa",
  "insurance",
  "package",
] as const;

type VoucherRow = {
  id: number;
  voucher_number: string;
  order_id: number | null;
  service_type: string;
  status: string;
  holder_name: string;
  language: string;
  valid_from: string | null;
  valid_to: string | null;
  used_at: string | null;
  verification_count: number;
  pdf_url: string | null;
  qr_image_url: string | null;
  reissued_from_id: number | null;
  created_at: string;
  order?: { id: number; order_number: string; user_id: number };
  issuer_company?: { id: number; name: string };
};

type VerificationLog = {
  id: number;
  scanned_at: string;
  scanner_ip: string | null;
  result: string;
};

type Meta = {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
};

export default function PlatformVouchersPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);

  const [status, setStatus] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [q, setQ] = useState("");
  const [appliedFilters, setAppliedFilters] = useState(0);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<VoucherRow | null>(null);
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
        params.set("per_page", "25");
        if (status) params.set("status", status);
        if (serviceType) params.set("service_type", serviceType);
        if (q.trim()) params.set("q", q.trim());

        const res = await fetch(`${baseURL}/api/platform-admin/vouchers?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (res.status === 403) {
          if (!cancelled) setForbidden(true);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        if (json?.success) {
          setRows(json.data ?? []);
          setMeta(json.meta ?? null);
        } else {
          setError(json?.message ?? "Failed to load vouchers");
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
    setServiceType("");
    setQ("");
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  const openDetail = async (row: VoucherRow) => {
    setSelected(row);
    setLogs([]);
    setDetailLoading(true);
    try {
      const res = await fetch(`${baseURL}/api/platform-admin/vouchers/${row.id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await res.json();
      if (json?.success) {
        setSelected(json.data.voucher);
        setLogs(json.data.verification_logs ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const voidVoucher = async (id: number) => {
    if (!confirm("Void this voucher? This action cannot be undone.")) return;
    setActionLoading("void");
    try {
      const res = await fetch(`${baseURL}/api/platform-admin/vouchers/${id}/void`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await res.json();
      if (json?.success) {
        setSelected(json.data);
        setAppliedFilters((n) => n + 1);
      } else {
        setError(json?.message ?? "Void failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Void failed");
    } finally {
      setActionLoading(null);
    }
  };

  const reissueVoucher = async (id: number) => {
    if (!confirm("Reissue this voucher? Original will be marked 'reissued'.")) return;
    setActionLoading("reissue");
    try {
      const res = await fetch(`${baseURL}/api/platform-admin/vouchers/${id}/reissue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json?.success) {
        setSelected(json.data);
        setAppliedFilters((n) => n + 1);
      } else {
        setError(json?.message ?? "Reissue failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reissue failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">Vouchers</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">Vouchers</h1>
      <p className="admin-page-subtitle">Issued vouchers across the platform with QR + audit trail.</p>

      {error && <p className="mt-2 text-sm text-error-600">{error}</p>}

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
          Service type
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fg-t6 sm:col-span-2">
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Voucher number or holder name"
            className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
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
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Service</th>
              <th className="px-3 py-2">Holder</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Valid</th>
              <th className="px-3 py-2">Scans</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-fg-t6">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-fg-t6">
                  No vouchers found.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 font-mono text-xs">{r.voucher_number}</td>
                <td className="px-3 py-2 text-xs">{r.service_type}</td>
                <td className="px-3 py-2 text-xs">{r.holder_name}</td>
                <td className="px-3 py-2">
                  <VoucherStatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2 text-xs text-fg-t7">
                  {r.valid_from ? new Date(r.valid_from).toLocaleDateString() : "—"}
                  {r.valid_to ? ` → ${new Date(r.valid_to).toLocaleDateString()}` : ""}
                </td>
                <td className="px-3 py-2 tabular-nums text-xs">{r.verification_count}</td>
                <td className="px-3 py-2 text-xs text-fg-t7">
                  {new Date(r.created_at).toLocaleDateString()}
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
      {meta && meta.last_page > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-fg-t6">
            Page {meta.current_page} of {meta.last_page} ({meta.total.toLocaleString()} entries)
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
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              disabled={page >= meta.last_page}
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
                <h2 className="text-lg font-semibold">Voucher {selected.voucher_number}</h2>
                <p className="mt-1 text-xs text-fg-t6">
                  {selected.service_type} · {selected.language.toUpperCase()}
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
              {selected.pdf_url && (
                <a
                  href={selected.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-default bg-white px-3 py-1.5 text-xs hover:bg-figma-bg-1"
                >
                  Open PDF
                </a>
              )}
              {selected.status === "issued" && (
                <>
                  <button
                    type="button"
                    onClick={() => reissueVoucher(selected.id)}
                    disabled={actionLoading !== null}
                    className="rounded border border-default bg-white px-3 py-1.5 text-xs hover:bg-figma-bg-1 disabled:opacity-50"
                  >
                    {actionLoading === "reissue" ? "Reissuing…" : "Reissue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => voidVoucher(selected.id)}
                    disabled={actionLoading !== null}
                    className="rounded border border-error-300 bg-error-50 px-3 py-1.5 text-xs text-error-700 hover:bg-error-100 disabled:opacity-50"
                  >
                    {actionLoading === "void" ? "Voiding…" : "Void"}
                  </button>
                </>
              )}
            </div>

            <dl className="mt-6 space-y-2 text-sm">
              <DetailRow label="Status" value={selected.status} />
              <DetailRow label="Holder" value={selected.holder_name} />
              <DetailRow
                label="Order"
                value={selected.order?.order_number ?? `#${selected.order_id}`}
              />
              <DetailRow
                label="Issuer"
                value={selected.issuer_company?.name ?? "—"}
              />
              <DetailRow
                label="Valid"
                value={
                  selected.valid_from
                    ? `${new Date(selected.valid_from).toLocaleDateString()}${
                        selected.valid_to
                          ? " → " + new Date(selected.valid_to).toLocaleDateString()
                          : ""
                      }`
                    : "—"
                }
              />
              <DetailRow
                label="Used at"
                value={selected.used_at ? new Date(selected.used_at).toLocaleString() : "—"}
              />
              <DetailRow label="Scan count" value={String(selected.verification_count)} />
              {selected.reissued_from_id && (
                <DetailRow
                  label="Reissued from"
                  value={`#${selected.reissued_from_id}`}
                />
              )}
            </dl>

            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                Verification log {logs.length > 0 && `(${logs.length})`}
              </h3>
              {detailLoading && <p className="mt-2 text-xs text-fg-t6">Loading…</p>}
              {!detailLoading && logs.length === 0 && (
                <p className="mt-2 text-xs text-fg-t6">No scans yet.</p>
              )}
              {logs.length > 0 && (
                <div className="mt-2 max-h-80 overflow-y-auto rounded border border-default">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-figma-bg-1 text-fg-t7">
                      <tr>
                        <th className="px-2 py-1">When</th>
                        <th className="px-2 py-1">IP</th>
                        <th className="px-2 py-1">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l) => (
                        <tr key={l.id} className="border-t border-default">
                          <td className="px-2 py-1">{new Date(l.scanned_at).toLocaleString()}</td>
                          <td className="px-2 py-1 font-mono">{l.scanner_ip ?? "—"}</td>
                          <td className="px-2 py-1">{l.result}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VoucherStatusBadge({ status }: { status: string }) {
  const tone =
    status === "issued"
      ? "bg-success-50 text-success-700"
      : status === "used"
        ? "bg-figma-bg-1 text-fg-t7"
        : status === "void"
          ? "bg-error-50 text-error-700"
          : status === "reissued"
            ? "bg-warning-50 text-warning-700"
            : "bg-figma-bg-1 text-fg-t6";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone}`}>
      {status}
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
