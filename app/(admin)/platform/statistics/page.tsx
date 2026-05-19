"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Button,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";

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
  const { t } = useLanguage();
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
        const [sRes, rRes, oRes, tRes] = await Promise.all([
          fetch(`${baseURL}/platform-admin/statistics/dashboard?days=${days}`, { headers }),
          fetch(`${baseURL}/platform-admin/statistics/revenue-series?days=${days}`, { headers }),
          fetch(`${baseURL}/platform-admin/statistics/orders-series?days=${days}`, { headers }),
          fetch(`${baseURL}/platform-admin/statistics/sellers?days=${days}&limit=20`, { headers }),
        ]);

        if ([sRes, rRes, oRes, tRes].some((res) => res.status === 403)) {
          if (!cancelled) setForbidden(true);
          return;
        }

        const [sJ, rJ, oJ, tJ] = await Promise.all([
          sRes.json(),
          rRes.json(),
          oRes.json(),
          tRes.json(),
        ]);
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
          setError(e instanceof Error ? e.message : t("admin.platform_statistics.err_load"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, allowed, baseURL, days, t]);

  const openSellerDetail = async (s: TopSeller) => {
    setSelectedSeller(s);
    setSellerDetail(null);
    try {
      const res = await fetch(
        `${baseURL}/platform-admin/statistics/sellers/${s.company_id}?days=${days}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
      );
      const json = await res.json();
      if (json?.success) setSellerDetail(json.data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("admin.platform_statistics.err_load_seller_detail")
      );
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
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.platform_statistics.title_short")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...revenueSeries.map((p) => p.revenue), 1);
  const maxOrders = Math.max(...ordersSeries.map((p) => p.total), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.platform_statistics.title")}
        subtitle={t("admin.platform_statistics.subtitle")}
        actions={
          <>
            <Select
              fieldSize="sm"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
            >
              <option value="7">{t("admin.platform_statistics.range_7")}</option>
              <option value="14">{t("admin.platform_statistics.range_14")}</option>
              <option value="30">{t("admin.platform_statistics.range_30")}</option>
              <option value="60">{t("admin.platform_statistics.range_60")}</option>
              <option value="90">{t("admin.platform_statistics.range_90")}</option>
              <option value="180">{t("admin.platform_statistics.range_180")}</option>
              <option value="365">{t("admin.platform_statistics.range_year")}</option>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={revenueSeries.length === 0}
            >
              {t("admin.platform_statistics.export_revenue_csv")}
            </Button>
          </>
        }
      />

      {error && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {error}
        </div>
      )}
      {loading && (
        <p className="text-sm text-fg-t6">{t("admin.platform_statistics.loading")}</p>
      )}

      {snapshot && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label={t("admin.platform_statistics.revenue")}
              value={`$${snapshot.revenue.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              hint={`${snapshot.revenue.order_count.toLocaleString()} ${t("admin.platform_statistics.paid_orders")}`}
            />
            <Kpi
              label={t("admin.platform_statistics.avg_order_value")}
              value={`$${snapshot.revenue.avg_order_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            />
            <Kpi
              label={t("admin.platform_statistics.new_users")}
              value={snapshot.users.new_in_window.toLocaleString()}
              hint={`${snapshot.users.total.toLocaleString()} ${t("admin.platform_statistics.total")}`}
            />
            <Kpi
              label={t("admin.platform_statistics.saga_success")}
              value={
                snapshot.package_sagas.success_rate !== null
                  ? `${snapshot.package_sagas.success_rate}%`
                  : "—"
              }
              hint={`${snapshot.package_sagas.total_in_window} ${t("admin.platform_statistics.sagas")}`}
              tone={
                snapshot.package_sagas.success_rate !== null &&
                snapshot.package_sagas.success_rate >= 95
                  ? "good"
                  : "warn"
              }
            />
          </div>

          <div className="admin-card p-4">
            <h2 className="text-sm font-semibold">
              {t("admin.platform_statistics.daily_revenue")}
            </h2>
            <div className="mt-3 flex h-40 items-end gap-1">
              {revenueSeries.map((p) => (
                <div
                  key={p.date}
                  className="group relative flex-1 bg-primary-500 hover:bg-primary-600 transition-colors"
                  style={{
                    height: `${(p.revenue / maxRevenue) * 100}%`,
                    minHeight: p.revenue > 0 ? 2 : 1,
                  }}
                  title={`${p.date} — $${p.revenue.toFixed(2)} (${p.orders} ${t("admin.platform_statistics.orders")})`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-fg-t6">
              <span>{revenueSeries[0]?.date ?? ""}</span>
              <span>
                {t("admin.platform_statistics.max")}: $
                {maxRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span>{revenueSeries[revenueSeries.length - 1]?.date ?? ""}</span>
            </div>
          </div>

          <div className="admin-card p-4">
            <h2 className="text-sm font-semibold">
              {t("admin.platform_statistics.daily_orders")}
            </h2>
            <div className="mt-3 flex h-40 items-end gap-1">
              {ordersSeries.map((p) => (
                <div
                  key={p.date}
                  className="group relative flex-1 bg-success-500 hover:bg-success-600 transition-colors"
                  style={{
                    height: `${(p.total / maxOrders) * 100}%`,
                    minHeight: p.total > 0 ? 2 : 1,
                  }}
                  title={`${p.date} — ${p.total} ${t("admin.platform_statistics.orders")}`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-fg-t6">
              <span>{ordersSeries[0]?.date ?? ""}</span>
              <span>
                {t("admin.platform_statistics.max")}: {maxOrders.toLocaleString()}
              </span>
              <span>{ordersSeries[ordersSeries.length - 1]?.date ?? ""}</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <BreakdownCard
              title={t("admin.platform_statistics.sellers")}
              total={snapshot.sellers.total}
              byKey={snapshot.sellers.by_type}
            />
            <BreakdownCard
              title={t("admin.platform_statistics.vouchers")}
              total={snapshot.vouchers.total}
              byKey={snapshot.vouchers.by_status}
            />
            <BreakdownCard
              title={t("admin.platform_statistics.contracts")}
              total={snapshot.contracts.total}
              byKey={snapshot.contracts.by_status}
            />
            <BreakdownCard
              title={t("admin.platform_statistics.loyalty_by_tier")}
              total={snapshot.loyalty.total_accounts}
              byKey={snapshot.loyalty.by_tier}
            />
            <div className="admin-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                {t("admin.platform_statistics.insurance")}
              </h3>
              <div className="mt-2 text-sm">
                <div>
                  {t("admin.platform_statistics.active_policies")}:{" "}
                  <span className="font-bold tabular-nums">
                    {snapshot.insurance.active_policies}
                  </span>
                </div>
                <div>
                  {t("admin.platform_statistics.issued_in_window")}:{" "}
                  <span className="font-bold tabular-nums">
                    {snapshot.insurance.issued_in_window}
                  </span>
                </div>
                <div className="mt-1 text-fg-t7">
                  {t("admin.platform_statistics.premium")}: $
                  {snapshot.insurance.total_premium_collected.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
            <div className="admin-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                {t("admin.platform_statistics.connections")}
              </h3>
              <div className="mt-2 text-sm">
                <div>
                  {t("admin.platform_statistics.total")}:{" "}
                  <span className="font-bold tabular-nums">
                    {snapshot.connections.total}
                  </span>
                </div>
                <div>
                  {t("admin.platform_statistics.active")}:{" "}
                  <span className="font-bold tabular-nums text-success-700">
                    {snapshot.connections.active}
                  </span>
                </div>
                <div>
                  {t("admin.platform_statistics.pending")}:{" "}
                  <span className="font-bold tabular-nums text-warning-700">
                    {snapshot.connections.pending}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="admin-card p-4">
            <h2 className="text-sm font-semibold">
              {t("admin.platform_statistics.top_sellers_by_revenue")}
            </h2>
            <div className="mt-3">
              <Table>
                <THead>
                  <TR>
                    <TH>#</TH>
                    <TH>{t("admin.platform_statistics.seller")}</TH>
                    <TH align="right">{t("admin.platform_statistics.revenue")}</TH>
                    <TH align="right">{t("admin.platform_statistics.orders")}</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {topSellers.length === 0 ? (
                    <TEmpty colSpan={5}>
                      {t("admin.platform_statistics.no_paid_orders")}
                    </TEmpty>
                  ) : null}
                  {topSellers.map((s, idx) => (
                    <TR key={s.company_id} onClick={() => openSellerDetail(s)}>
                      <TD className="text-fg-t6">{idx + 1}</TD>
                      <TD>
                        {s.name ??
                          t("admin.platform_statistics.company_label").replace(
                            "{id}",
                            String(s.company_id)
                          )}
                      </TD>
                      <TD align="right" className="font-bold tabular-nums">
                        $
                        {s.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </TD>
                      <TD align="right" className="tabular-nums">
                        {s.orders}
                      </TD>
                      <TD align="right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openSellerDetail(s)}
                          className="text-xs text-primary-500 hover:underline"
                        >
                          {t("admin.platform_statistics.drill_down")}
                        </button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </div>
        </>
      )}

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
                  {selectedSeller.name ??
                    t("admin.platform_statistics.company_label").replace(
                      "{id}",
                      String(selectedSeller.company_id)
                    )}
                </h2>
                <p className="mt-1 text-xs text-fg-t6">
                  {t("admin.platform_statistics.last_days").replace("{days}", String(days))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSeller(null)}
                className="rounded p-1 text-fg-t6 hover:bg-figma-bg-1"
                aria-label={t("common.close")}
              >
                ✕
              </button>
            </div>

            {!sellerDetail && (
              <p className="mt-4 text-sm text-fg-t6">
                {t("admin.platform_statistics.loading")}
              </p>
            )}
            {sellerDetail && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Kpi
                    label={t("admin.platform_statistics.revenue")}
                    value={`$${sellerDetail.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  />
                  <Kpi
                    label={t("admin.platform_statistics.avg_order")}
                    value={`$${sellerDetail.avg_order_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  />
                  <Kpi
                    label={t("admin.platform_statistics.paid_orders")}
                    value={sellerDetail.paid_orders.toLocaleString()}
                  />
                  <Kpi
                    label={t("admin.platform_statistics.total_orders")}
                    value={sellerDetail.total_orders.toLocaleString()}
                  />
                </div>

                <div className="mt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                    {t("admin.platform_statistics.orders_by_status")}
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {Object.entries(sellerDetail.orders_by_status).map(([status, count]) => (
                      <li
                        key={status}
                        className="flex justify-between border-b border-default py-1"
                      >
                        <span>{status}</span>
                        <span className="font-bold tabular-nums">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 rounded-zulu border border-default bg-figma-bg-1 p-3 text-sm">
                  {t("admin.platform_statistics.vouchers_issued_in_window")}:{" "}
                  <span className="font-bold tabular-nums">
                    {sellerDetail.vouchers_issued}
                  </span>
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
    <div className="admin-card p-4">
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
