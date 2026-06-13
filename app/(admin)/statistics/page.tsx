"use client";

/**
 * Operator statistics page (roadmap §11).
 *
 * Who sees it?
 *   - Super / platform-stats scope: cross-company drill-down (enter a company_id).
 *   - A tenant operator-admin: their OWN company, scoped server-side. The nav
 *     gate `canAccessOperatorStatisticsNav` now returns true for both
 *     (operator_statistics_platform_scope OR operator_statistics_own_scope).
 *
 * The data comes from GET /api/operator/statistics (StatisticsService). Charts
 * are hand-rolled SVG + the shared MiniBars, matching the admin v2 pattern.
 *
 * If you change permission semantics here, update:
 *   - backend `AdminAccessService::isAdminStatisticsSuperScope()` / UserResource
 *     `operator_statistics_platform_scope` + `operator_statistics_own_scope`
 *   - `zulu-admin-next/lib/access::canAccessOperatorStatisticsNav()`
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { MiniBars } from "../crm/MiniBars";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessOperatorStatisticsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiOperatorStatistics } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, FormField, Input } from "@/components/ui";
import { PageHeader as V2PageHeader, V2Card } from "@/components/ui/v2";
import { serviceLabel, statStrings } from "./statistics-i18n";

type OperatorStats = {
  stats: {
    total_bookings: number;
    active_offers: number;
    primary_currency: string | null;
    revenue_by_currency: Record<string, number>;
    commission_by_currency: Record<string, number>;
    bookings_by_type: Record<string, number>;
  };
  trend: { currency: string | null; labels: string[]; values: number[] };
  service_breakdown: { type: string; bookings: number; revenue: number }[];
  top_destinations: { name: string; bookings: number }[];
};

function tx(t: (k: string) => string, key: string, fallback: string): string {
  const v = t(key);
  return v === key ? fallback : v;
}

function money(amount: number, currency: string | null, lang: string): string {
  if (!currency) return amount.toLocaleString(lang, { maximumFractionDigits: 0 });
  try {
    return new Intl.NumberFormat(lang, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString(lang, { maximumFractionDigits: 0 })} ${currency}`;
  }
}

/** 12-point revenue bar chart (hand-rolled SVG, admin v2 pattern). */
function TrendBars({ labels, values, lang }: { labels: string[]; values: number[]; lang: string }) {
  const max = Math.max(...values, 1);
  const W = 760;
  const H = 200;
  const padX = 10;
  const padTop = 16;
  const padBottom = 26;
  const n = Math.max(values.length, 1);
  const slot = (W - padX * 2) / n;
  const bw = Math.max(slot - 8, 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="revenue trend">
      {values.map((v, i) => {
        const h = Math.round((v / max) * (H - padTop - padBottom));
        const x = padX + i * slot + (slot - bw) / 2;
        const y = H - padBottom - h;
        const monthLabel = (labels[i] ?? "").split(" ")[0];
        return (
          <g key={i}>
            {v > 0 ? (
              <title>{`${labels[i]}: ${v.toLocaleString(lang, { maximumFractionDigits: 0 })}`}</title>
            ) : null}
            <rect x={x} y={y} width={bw} height={Math.max(h, v > 0 ? 2 : 0)} rx={3} fill="var(--admin-primary)" opacity={v > 0 ? 1 : 0.18} />
            <text x={x + bw / 2} y={H - 9} textAnchor="middle" fontSize="9" fill="var(--admin-text-tertiary)">
              {monthLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function HeroCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-default bg-white p-4 sm:p-5">
      <div className="text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>{label}</div>
      <div className="mt-1 text-[22px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>{value}</div>
      {sub ? <div className="mt-0.5 text-[11px]" style={{ color: "var(--admin-text-tertiary)" }}>{sub}</div> : null}
    </div>
  );
}

export default function OperatorStatisticsPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const s = useMemo(() => statStrings(lang), [lang]);
  const allowed = canAccessOperatorStatisticsNav(user);
  const [companyIdInput, setCompanyIdInput] = useState("");
  const [payload, setPayload] = useState<OperatorStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSuper = user?.is_super_admin === true || user?.operator_statistics_platform_scope === true;
  const defaultCompanyId = user?.context?.active_company_id ?? null;

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setLoading(true);
    setErr(null);
    try {
      let companyId: number | null | undefined;
      if (isSuper) {
        const parsed = parseInt(companyIdInput.trim(), 10);
        companyId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      } else {
        // Own-scope operator: the backend resolves their own company; the param
        // is ignored for non-platform-scope callers, so null is fine.
        companyId = defaultCompanyId;
      }
      const res = await apiOperatorStatistics(token, companyId);
      setPayload(res.data as OperatorStats);
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setErr(e.message);
      } else {
        setErr(t("admin.operator_statistics.err_load"));
      }
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [token, allowed, isSuper, defaultCompanyId, companyIdInput, t]);

  useEffect(() => {
    if (!allowed) return;
    if (isSuper) return; // super picks a company first
    void load();
  }, [allowed, isSuper, load]);

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.operator_statistics.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice messageKey="admin.forbidden.statistics_scope" />
        </div>
      </div>
    );
  }

  const stats = payload?.stats;
  const primary = stats?.primary_currency ?? null;
  const revenue = primary ? stats?.revenue_by_currency?.[primary] ?? 0 : 0;
  const commission = primary ? stats?.commission_by_currency?.[primary] ?? 0 : 0;
  const otherCurrencies = stats
    ? Object.keys(stats.revenue_by_currency).filter((c) => c !== primary)
    : [];
  const trendEmpty = !payload || payload.trend.values.every((v) => v === 0);

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: t("admin.operator_statistics.title") },
        ]}
        title={t("admin.operator_statistics.title")}
        subtitle={tx(t, "admin.statistics.subtitle", "Your sales and service performance.")}
      />

      <div className="space-y-5">
        {isSuper && (
          <div className="admin-card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <FormField label={t("admin.inventory_hotels.filter_company_id")} htmlFor="stats-co" className="max-w-xs">
                <Input
                  id="stats-co"
                  type="number"
                  min={1}
                  value={companyIdInput}
                  onChange={(e) => setCompanyIdInput(e.target.value)}
                  placeholder={t("admin.operator_statistics.placeholder_company_required")}
                />
              </FormField>
              <Button size="sm" onClick={() => load()} disabled={loading}>
                {t("admin.content_translations.btn_load")}
              </Button>
            </div>
          </div>
        )}

        {!isSuper && defaultCompanyId && (
          <p className="text-xs text-fg-t7">
            {t("admin.operator_statistics.context_active_company").replace("{id}", String(defaultCompanyId))}
          </p>
        )}

        {err && <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}
        {loading && <p className="text-sm text-fg-t7">{t("common.loading")}</p>}

        {payload && stats && !loading && (
          <>
            {/* Hero cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <HeroCard label={s.heroRevenue} value={primary ? money(revenue, primary, lang) : "—"} sub={otherCurrencies.length ? `+${otherCurrencies.length}` : undefined} />
              <HeroCard label={s.heroBookings} value={String(stats.total_bookings)} />
              <HeroCard label={s.heroCommission} value={primary ? money(commission, primary, lang) : "—"} />
              <HeroCard label={s.heroOffers} value={String(stats.active_offers)} />
            </div>

            {/* Revenue trend */}
            <V2Card>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[14px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>
                  {s.revenueTrend}{primary ? ` · ${primary}` : ""}
                </div>
              </div>
              {trendEmpty ? (
                <p className="py-10 text-center text-[13px]" style={{ color: "var(--admin-text-tertiary)" }}>{s.noData}</p>
              ) : (
                <TrendBars labels={payload.trend.labels} values={payload.trend.values} lang={lang} />
              )}
            </V2Card>

            {/* Breakdowns */}
            <div className="grid gap-4 lg:grid-cols-2">
              <V2Card>
                <div className="mb-2 text-[14px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>{s.byService}</div>
                <MiniBars
                  empty={s.noBreakdown}
                  rows={payload.service_breakdown.map((r) => ({ name: serviceLabel(s, r.type), val: r.bookings }))}
                />
              </V2Card>
              <V2Card>
                <div className="mb-2 text-[14px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>{s.topDestinations}</div>
                <MiniBars
                  empty={s.noBreakdown}
                  rows={payload.top_destinations.map((r) => ({ name: r.name, val: r.bookings }))}
                />
              </V2Card>
            </div>

            {/* Revenue by currency (only when more than one) */}
            {otherCurrencies.length > 0 && (
              <V2Card>
                <div className="mb-2 text-[14px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>{s.revenueByCurrency}</div>
                <div className="flex flex-wrap gap-x-8 gap-y-1.5">
                  {Object.entries(stats.revenue_by_currency).map(([cur, amt]) => (
                    <div key={cur} className="text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>
                      <span className="font-medium" style={{ color: "var(--admin-text-primary)" }}>{money(amt, cur, lang)}</span>
                    </div>
                  ))}
                </div>
              </V2Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
