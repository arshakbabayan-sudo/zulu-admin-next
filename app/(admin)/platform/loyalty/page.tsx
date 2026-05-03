"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";

/**
 * Platform-admin loyalty oversight (Sprint 58, PART 27).
 *
 * Wires to backend:
 *   GET  /api/platform-admin/loyalty/accounts
 *   GET  /api/platform-admin/loyalty/accounts/{userId}/transactions
 *   POST /api/platform-admin/loyalty/accounts/{userId}/adjust
 *   GET  /api/platform-admin/loyalty/stats
 */

const TIERS = ["bronze", "silver", "gold", "platinum"] as const;

type Account = {
  id: number;
  user_id: number;
  tier: string;
  points_balance: number;
  lifetime_points: number;
  user?: { id: number; name: string; email: string };
};

type Transaction = {
  id: number;
  type: string;
  points: number;
  reason: string | null;
  created_at: string;
};

type AccountDetail = Account & {
  transactions?: Transaction[];
};

type Stats = {
  total_accounts: number;
  by_tier: Record<string, number>;
  total_points_outstanding: number;
  total_lifetime_points: number;
};

export default function PlatformLoyaltyPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [tier, setTier] = useState("");
  const [appliedFilters, setAppliedFilters] = useState(0);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<AccountDetail | null>(null);
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

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
        if (tier) params.set("tier", tier);

        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const [listRes, statsRes] = await Promise.all([
          fetch(`${baseURL}/api/platform-admin/loyalty/accounts?${params.toString()}`, { headers }),
          fetch(`${baseURL}/api/platform-admin/loyalty/stats`, { headers }),
        ]);

        if (listRes.status === 403 || statsRes.status === 403) {
          if (!cancelled) setForbidden(true);
          return;
        }

        const listJson = await listRes.json();
        const statsJson = await statsRes.json();
        if (cancelled) return;

        if (listJson?.success) {
          setAccounts(listJson.data ?? []);
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

  const openDetail = async (acct: Account) => {
    setSelected({ ...acct });
    setAdjustPoints("");
    setAdjustReason("");
    try {
      const res = await fetch(
        `${baseURL}/api/platform-admin/loyalty/accounts/${acct.user_id}/transactions`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
      );
      const json = await res.json();
      if (json?.success) {
        setSelected({ ...json.data, user: acct.user });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load detail");
    }
  };

  const submitAdjust = async () => {
    if (!selected) return;
    const points = parseInt(adjustPoints, 10);
    if (isNaN(points) || points === 0) {
      setError("Points must be a non-zero integer");
      return;
    }
    if (!adjustReason.trim()) {
      setError("Reason is required");
      return;
    }
    if (
      !confirm(
        `Apply ${points > 0 ? "+" : ""}${points} points to ${selected.user?.name ?? "user #" + selected.user_id}?`
      )
    )
      return;

    setActionLoading(true);
    try {
      const res = await fetch(
        `${baseURL}/api/platform-admin/loyalty/accounts/${selected.user_id}/adjust`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ points, reason: adjustReason.trim() }),
        }
      );
      const json = await res.json();
      if (json?.success) {
        // Refresh detail
        await openDetail(selected);
        setAppliedFilters((n) => n + 1);
      } else {
        setError(json?.message ?? "Adjust failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Adjust failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">Loyalty</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">Loyalty</h1>
      <p className="admin-page-subtitle">Customer loyalty accounts and tier distribution.</p>

      {error && <p className="mt-2 text-sm text-error-600">{error}</p>}

      {/* Stats */}
      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Accounts" value={stats.total_accounts.toLocaleString()} />
          <StatCard
            label="Points outstanding"
            value={stats.total_points_outstanding.toLocaleString()}
          />
          <StatCard
            label="Lifetime points"
            value={stats.total_lifetime_points.toLocaleString()}
          />
          <StatCard
            label="Gold + Platinum"
            value={String(
              (stats.by_tier?.gold ?? 0) + (stats.by_tier?.platinum ?? 0)
            )}
            tone="good"
          />
        </div>
      )}

      {/* Tier distribution */}
      {stats && (
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {TIERS.map((t) => (
            <div key={t} className="rounded border border-default bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                {t}
              </div>
              <div className="mt-1 text-lg font-bold tabular-nums">
                {(stats.by_tier?.[t] ?? 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-end gap-3 rounded border border-default bg-white p-4">
        <label className="text-xs text-fg-t6">
          Tier
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="mt-1 block rounded border border-default px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setAppliedFilters((n) => n + 1);
          }}
          className="rounded bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
        >
          Apply
        </button>
        {tier && (
          <button
            type="button"
            onClick={() => {
              setTier("");
              setPage(1);
              setAppliedFilters((n) => n + 1);
            }}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-figma-bg-1"
          >
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2 text-right">Points balance</th>
              <th className="px-3 py-2 text-right">Lifetime points</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-fg-t6">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-fg-t6">
                  No accounts found.
                </td>
              </tr>
            )}
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 text-xs">
                  {a.user?.name ?? `#${a.user_id}`}
                  {a.user?.email && (
                    <div className="text-fg-t6">{a.user.email}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <TierBadge tier={a.tier} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {a.points_balance.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-fg-t7">
                  {a.lifetime_points.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => openDetail(a)}
                    className="text-xs text-primary-500 hover:underline"
                  >
                    Manage
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
                <h2 className="text-lg font-semibold">
                  {selected.user?.name ?? `User #${selected.user_id}`}
                </h2>
                {selected.user?.email && (
                  <p className="mt-1 text-xs text-fg-t6">{selected.user.email}</p>
                )}
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

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded border border-default p-3">
                <div className="text-xs text-fg-t6">Tier</div>
                <div className="mt-1">
                  <TierBadge tier={selected.tier} />
                </div>
              </div>
              <div className="rounded border border-default p-3">
                <div className="text-xs text-fg-t6">Balance</div>
                <div className="mt-1 text-lg font-bold tabular-nums">
                  {selected.points_balance.toLocaleString()}
                </div>
              </div>
              <div className="rounded border border-default p-3">
                <div className="text-xs text-fg-t6">Lifetime</div>
                <div className="mt-1 text-lg font-bold tabular-nums">
                  {selected.lifetime_points.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Manual adjust */}
            <div className="mt-6 rounded border border-default bg-figma-bg-1 p-4">
              <h3 className="text-sm font-semibold">Manual adjust</h3>
              <p className="mt-1 text-xs text-fg-t6">
                Use positive to credit, negative to deduct. Reason is required and stored on the
                transaction.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <input
                  type="number"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                  placeholder="±points"
                  className="rounded border border-default px-2 py-1 text-sm"
                />
                <input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Reason"
                  className="col-span-2 rounded border border-default px-2 py-1 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={submitAdjust}
                disabled={actionLoading || !adjustPoints || !adjustReason.trim()}
                className="mt-3 rounded bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {actionLoading ? "Applying…" : "Apply adjustment"}
              </button>
            </div>

            {/* Transactions */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                Transactions {selected.transactions && `(${selected.transactions.length})`}
              </h3>
              {(!selected.transactions || selected.transactions.length === 0) && (
                <p className="mt-2 text-xs text-fg-t6">No transactions yet.</p>
              )}
              {selected.transactions && selected.transactions.length > 0 && (
                <div className="mt-2 max-h-96 overflow-y-auto rounded border border-default">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-figma-bg-1 text-fg-t7">
                      <tr>
                        <th className="px-2 py-1">When</th>
                        <th className="px-2 py-1">Type</th>
                        <th className="px-2 py-1 text-right">Points</th>
                        <th className="px-2 py-1">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.transactions.map((t) => (
                        <tr key={t.id} className="border-t border-default">
                          <td className="px-2 py-1">
                            {new Date(t.created_at).toLocaleString()}
                          </td>
                          <td className="px-2 py-1">{t.type}</td>
                          <td
                            className={`px-2 py-1 text-right tabular-nums font-mono ${
                              t.points > 0 ? "text-success-700" : "text-error-700"
                            }`}
                          >
                            {t.points > 0 ? "+" : ""}
                            {t.points.toLocaleString()}
                          </td>
                          <td className="px-2 py-1">{t.reason ?? "—"}</td>
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

function TierBadge({ tier }: { tier: string }) {
  const tone =
    tier === "platinum"
      ? "bg-primary-50 text-primary-600"
      : tier === "gold"
        ? "bg-warning-50 text-warning-700"
        : tier === "silver"
          ? "bg-figma-bg-1 text-fg-t11"
          : "bg-figma-bg-1 text-fg-t7";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium uppercase ${tone}`}>
      {tier}
    </span>
  );
}
