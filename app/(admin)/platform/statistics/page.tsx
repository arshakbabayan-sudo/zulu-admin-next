"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";

/**
 * Platform-admin statistics dashboard (Sprint 61+69, PART 25).
 *
 * Wires to backend:
 *   GET /api/platform-admin/statistics/dashboard?days=N
 *   GET /api/platform-admin/statistics/revenue-series?days=N
 *   GET /api/platform-admin/statistics/orders-series?days=N
 *   GET /api/platform-admin/statistics/sellers?days=N&limit=M
 *   GET /api/platform-admin/statistics/sellers/{companyId}?days=N
 */

type Snapshot = {
  window_days: number;
  window_start: string;
  orders: {
    total_in_window: number;
    by_status: Record<string, number>;
    open_carts: number;
    paid: number;
    confirmed: number;
    failed: number;
  };
  revenue: { total: number; order_count: number; avg_order_value: number };
  users: { total: number; new_in_window: number };
  sellers: { total: number; by_type: Record<string, number> };
  vouchers: {
    total: number;
    issued_in_window: number;
    by_status: Record<string, number>;
  };
  contracts: { total: number; by_status: Record<string, number> };
  connections: { total: number; active: number; pending: number };
  package_sagas: {
    total_in_window: number;
    confirmed: number;
    failed: number;
    success_rate: number | null;
  };
  insurance: {
    active_policies: number;
    issued_in_window: number;
    total_premium_collected: number;
  };
  loyalty: {
    total_accounts: number;
    by_tier: Record<string, number>;
    points_outstanding: number;
  };
  top_sellers: TopSeller[];
};

type RevenuePoint = { date: string; revenue: number; orders: number };
type OrdersPoint = { date: string; total: number; by_status: Record<string, number> };
type TopSeller = {
  company_id: number;
  name: string | null;
  revenue: number;
  orders: number;
};
type SellerDetail = {
  company_id: number;
  window_days: number;
  total_orders: number;
  paid_orders: number;
  total_revenue: number;
  avg_order_value: number;
  orders_by_status: Record<string, number>;
  vouchers_issued: number;
};

export default function PlatformStatisticsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);

  const [days, setDays] = useState(30);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [revenueSeries, setRevenueSeries] = useState<RevenuePoint[]>([]);
  const [ordersSeries, setOrdersSeries] = useState<OrdersPoint[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSeller, setSelectedSeller] = useState<TopSeller | null>(null);
  const [sellerDetail, setSellerDetail] = useState<SellerDetail | null>(null);

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
        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const [s, r, o, t] = await Promise.all([
          fetch(`${baseURL}/api/platform-admin/statistics/dashboard?days=${days}`, { headers }),
          fetch(`${baseURL}/api/platform-admin/statistics/revenue-series?days=${days}`, { headers }),
          fetch(`${baseURL}/api/platform-admin/statistics/orders-series?days=${days}`, { headers }),
          fetch(`${baseURL}/api/platform-admin/statistics/sellers?days=${days}&limit=20`, { headers }),
        ]);

        if ([s, r, o, t].some((res) => res.status === 403)) {
          if (!cancelled) setForbidden(true);
          return;
        }

        const [sJ, rJ, oJ, tJ] = await Promise.all([s.json(), r.json(), o.json(), t.json()]);
        if (cancelled) return;

        if (sJ?.success) setSnapshot(sJ.data);
        if (rJ?.success) setRevenueSeries(rJ.data ?? []);
        if (oJ?.success) setOrdersSeries(oJ.data ?? []);
        if (tJ?.success) setTopSellers(tJ.data ?? []);
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
  }, [token, allowed, baseURL, days]);

  const openSellerDetail = async (s: TopSeller) => {
    setSelectedSeller(s);
    setSellerDetail(null);
    try {
      const res = await fetch(
        `${baseURL}/api/platform-admin/statistics/sellers/${s.company_id}?days=${days}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
      );
      const json = await res.json();
      if (json?.success) setSellerDetail(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load seller detail");
    }
  };

  const exportCsv = () => {
    if (revenueSeries.length === 0) return;
    const lines = ["date,revenue,orders"];
    for (const p of revenueSeries) {
      lines.push(`${p.date},${p.revenue},${p.orders}`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">Statistics</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...revenueSeries.map((p) => p.revenue), 1);
  const maxOrders = Math.max(...ordersSeries.map((p) => p.total), 1);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="admin-page-title">Platform statistics</h1>
          <p className="admin-page-subtitle">
            Revenue, orders, sellers, and per-vertical breakdowns over the selected window.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm"
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
            <option value="365">Last year</option>
          </select>
          <button
            type="button"
            onClick={exportCsv}
            disabled={revenueSeries.length === 0}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-figma-bg-1 disabled:opacity-50"
          >
            Export revenue CSV
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-error-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-fg-t6">Loading…</p>}

      {snapshot && (
        <>
          {/* Headline KPIs */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Revenue"
              value={`$${snapshot.revenue.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              hint={`${snapshot.revenue.order_count.toLocaleString()} paid orders`}
            />
            <Kpi
              label="Avg order value"
              value={`$${snapshot.revenue.avg_order_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            />
            <Kpi
              label="New users"
              value={snapshot.users.new_in_window.toLocaleString()}
              hint={`${snapshot.users.total.toLocaleString()} total`}
            />
            <Kpi
              label="Saga success"
              value={
                snapshot.package_sagas.success_rate !== null
                  ? `${snapshot.package_sagas.success_rate}%`
                  : "—"
              }
              hint={`${snapshot.package_sagas.total_in_window} sagas`}
              tone={
                snapshot.package_sagas.success_rate !== null &&
                snapshot.package_sagas.success_rate >= 95
                  ? "good"
                  : "warn"
              }
            />
          </div>

          {/* Revenue chart */}
          <div className="mt-6 rounded border border-default bg-white p-4">
            <h2 className="text-sm font-semibold">Daily revenue</h2>
            <div className="mt-3 flex h-40 items-end gap-1">
              {revenueSeries.map((p) => (
                <div
                  key={p.date}
                  className="group relative flex-1 bg-primary-500 hover:bg-primary-600"
                  style={{
                    height: `${(p.revenue / maxRevenue) * 100}%`,
                    minHeight: p.revenue > 0 ? 2 : 1,
                  }}
                  title={`${p.date} — $${p.revenue.toFixed(2)} (${p.orders} orders)`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-fg-t6">
              <span>{revenueSeries[0]?.date ?? ""}</span>
              <span>Max: ${maxRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span>{revenueSeries[revenueSeries.length - 1]?.date ?? ""}</span>
            </div>
          </div>

          {/* Orders chart */}
          <div className="mt-4 rounded border border-default bg-white p-4">
            <h2 className="text-sm font-semibold">Daily orders</h2>
            <div className="mt-3 flex h-40 items-end gap-1">
              {ordersSeries.map((p) => (
                <div
                  key={p.date}
                  className="group relative flex-1 bg-success-500 hover:bg-success-600"
                  style={{
                    height: `${(p.total / maxOrders) * 100}%`,
                    minHeight: p.total > 0 ? 2 : 1,
                  }}
                  title={`${p.date} — ${p.total} orders`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-fg-t6">
              <span>{ordersSeries[0]?.date ?? ""}</span>
              <span>Max: {maxOrders.toLocaleString()}</span>
              <span>{ordersSeries[ordersSeries.length - 1]?.date ?? ""}</span>
            </div>
          </div>

          {/* Per-vertical breakdowns */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <BreakdownCard title="Sellers" total={snapshot.sellers.total} byKey={snapshot.sellers.by_type} />
            <BreakdownCard title="Vouchers" total={snapshot.vouchers.total} byKey={snapshot.vouchers.by_status} />
            <BreakdownCard title="Contracts" total={snapshot.contracts.total} byKey={snapshot.contracts.by_status} />
            <BreakdownCard
              title="Loyalty (by tier)"
              total={snapshot.loyalty.total_accounts}
              byKey={snapshot.loyalty.by_tier}
            />
            <div className="rounded border border-default bg-white p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">Insurance</h3>
              <div className="mt-2 text-sm">
                <div>
                  Active policies:{" "}
                  <span className="font-bold tabular-nums">{snapshot.insurance.active_policies}</span>
                </div>
                <div>
                  Issued in window:{" "}
                  <span className="font-bold tabular-nums">
                    {snapshot.insurance.issued_in_window}
                  </span>
                </div>
                <div className="mt-1 text-fg-t7">
                  Premium: ${snapshot.insurance.total_premium_collected.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            <div className="rounded border border-default bg-white p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">Connections</h3>
              <div className="mt-2 text-sm">
                <div>
                  Total: <span className="font-bold tabular-nums">{snapshot.connections.total}</span>
                </div>
                <div>
                  Active:{" "}
                  <span className="font-bold tabular-nums text-success-700">
                    {snapshot.connections.active}
                  </span>
                </div>
                <div>
                  Pending:{" "}
                  <span className="font-bold tabular-nums text-warning-700">
                    {snapshot.connections.pending}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Top sellers */}
          <div className="mt-6 rounded border border-default bg-white p-4">
            <h2 className="text-sm font-semibold">Top sellers by revenue</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-default text-xs uppercase text-fg-t7">
                <tr>
                  <th className="px-2 py-1">#</th>
                  <th className="px-2 py-1">Seller</th>
                  <th className="px-2 py-1 text-right">Revenue</th>
                  <th className="px-2 py-1 text-right">Orders</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {topSellers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-center text-fg-t6">
                      No paid orders in window.
                    </td>
                  </tr>
                )}
                {topSellers.map((s, idx) => (
                  <tr key={s.company_id} className="border-b border-default hover:bg-figma-bg-1">
                    <td className="px-2 py-1 text-fg-t6">{idx + 1}</td>
                    <td className="px-2 py-1">{s.name ?? `Company #${s.company_id}`}</td>
                    <td className="px-2 py-1 text-right font-bold tabular-nums">
                      ${s.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{s.orders}</td>
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => openSellerDetail(s)}
                        className="text-xs text-primary-500 hover:underline"
                      >
                        Drill down
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Seller drill-down */}
      {selectedSeller && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={() => setSelectedSeller(null)}
        >
          <div
            className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {selectedSeller.name ?? `Company #${selectedSeller.company_id}`}
                </h2>
                <p className="mt-1 text-xs text-fg-t6">Last {days} days</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSeller(null)}
                className="rounded p-1 text-fg-t6 hover:bg-figma-bg-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {!sellerDetail && <p className="mt-4 text-sm text-fg-t6">Loading…</p>}
            {sellerDetail && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Kpi
                    label="Revenue"
                    value={`$${sellerDetail.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  />
                  <Kpi
                    label="Avg order"
                    value={`$${sellerDetail.avg_order_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  />
                  <Kpi label="Paid orders" value={sellerDetail.paid_orders.toLocaleString()} />
                  <Kpi label="Total orders" value={sellerDetail.total_orders.toLocaleString()} />
                </div>

                <div className="mt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                    Orders by status
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {Object.entries(sellerDetail.orders_by_status).map(([status, count]) => (
                      <li key={status} className="flex justify-between border-b border-default py-1">
                        <span>{status}</span>
                        <span className="font-bold tabular-nums">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 rounded border border-default bg-figma-bg-1 p-3 text-sm">
                  Vouchers issued in window:{" "}
                  <span className="font-bold tabular-nums">{sellerDetail.vouchers_issued}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
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
      {hint && <div className="text-xs text-fg-t6 mt-0.5">{hint}</div>}
    </div>
  );
}

function BreakdownCard({
  title,
  total,
  byKey,
}: {
  title: string;
  total: number;
  byKey: Record<string, number>;
}) {
  return (
    <div className="rounded border border-default bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">{title}</h3>
      <div className="mt-2 text-lg font-bold tabular-nums">{total.toLocaleString()}</div>
      <ul className="mt-2 space-y-1 text-xs">
        {Object.entries(byKey).map(([k, v]) => (
          <li key={k} className="flex justify-between">
            <span className="text-fg-t7">{k}</span>
            <span className="font-mono">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
