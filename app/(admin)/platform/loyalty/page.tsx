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
  FormField,
  Input,
  PageHeader,
  Pagination,
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
  const { t } = useLanguage();
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
          setError(listJson?.message ?? t("admin.platform_loyalty.err_load"));
        }
        if (statsJson?.success) {
          setStats(statsJson.data);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) {
          setForbidden(true);
        } else {
          setError(e instanceof Error ? e.message : t("admin.platform_loyalty.err_load"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, allowed, baseURL, page, appliedFilters, t]);

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
      setError(e instanceof Error ? e.message : t("admin.platform_loyalty.err_load_detail"));
    }
  };

  const submitAdjust = async () => {
    if (!selected) return;
    const points = parseInt(adjustPoints, 10);
    if (isNaN(points) || points === 0) {
      setError(t("admin.platform_loyalty.err_points_non_zero"));
      return;
    }
    if (!adjustReason.trim()) {
      setError(t("admin.platform_loyalty.err_reason_required"));
      return;
    }
    if (
      !confirm(
        t("admin.platform_loyalty.confirm_adjust")
          .replace("{points}", `${points > 0 ? "+" : ""}${points}`)
          .replace("{user}", selected.user?.name ?? `user #${selected.user_id}`)
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
        await openDetail(selected);
        setAppliedFilters((n) => n + 1);
      } else {
        setError(json?.message ?? t("admin.platform_loyalty.err_adjust"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.platform_loyalty.err_adjust"));
    } finally {
      setActionLoading(false);
    }
  };

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.platform_loyalty.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.platform_loyalty.title")}
        subtitle={t("admin.platform_loyalty.subtitle")}
      />

      {error && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t("admin.platform_loyalty.accounts")}
            value={stats.total_accounts.toLocaleString()}
          />
          <StatCard
            label={t("admin.platform_loyalty.points_outstanding")}
            value={stats.total_points_outstanding.toLocaleString()}
          />
          <StatCard
            label={t("admin.platform_loyalty.lifetime_points")}
            value={stats.total_lifetime_points.toLocaleString()}
          />
          <StatCard
            label={t("admin.platform_loyalty.gold_plus_platinum")}
            value={String((stats.by_tier?.gold ?? 0) + (stats.by_tier?.platinum ?? 0))}
            tone="good"
          />
        </div>
      )}

      {stats && (
        <div className="grid gap-2 sm:grid-cols-4">
          {TIERS.map((tn) => (
            <div key={tn} className="admin-card p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                {t(`admin.platform_loyalty.tier_${tn}`)}
              </div>
              <div className="mt-1 text-lg font-bold tabular-nums">
                {(stats.by_tier?.[tn] ?? 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="admin-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label={t("admin.platform_loyalty.tier")} htmlFor="l-tier">
            <Select
              id="l-tier"
              fieldSize="sm"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {TIERS.map((tn) => (
                <option key={tn} value={tn}>
                  {t(`admin.platform_loyalty.tier_${tn}`)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {tier && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTier("");
                setPage(1);
                setAppliedFilters((n) => n + 1);
              }}
            >
              {t("common.reset")}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setPage(1);
              setAppliedFilters((n) => n + 1);
            }}
          >
            {t("common.apply")}
          </Button>
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>{t("admin.platform_loyalty.user")}</TH>
            <TH>{t("admin.platform_loyalty.tier")}</TH>
            <TH align="right">{t("admin.platform_loyalty.points_balance")}</TH>
            <TH align="right">{t("admin.platform_loyalty.lifetime_points")}</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {loading ? (
            <TEmpty colSpan={5}>{t("admin.platform_loyalty.loading")}</TEmpty>
          ) : accounts.length === 0 ? (
            <TEmpty colSpan={5}>{t("admin.platform_loyalty.empty")}</TEmpty>
          ) : null}
          {accounts.map((a) => (
            <TR key={a.id} onClick={() => openDetail(a)}>
              <TD className="text-xs">
                {a.user?.name ?? `#${a.user_id}`}
                {a.user?.email && <div className="text-fg-t6">{a.user.email}</div>}
              </TD>
              <TD>
                <TierBadge tier={a.tier} />
              </TD>
              <TD align="right" className="tabular-nums">
                {a.points_balance.toLocaleString()}
              </TD>
              <TD align="right" className="tabular-nums">
                {a.lifetime_points.toLocaleString()}
              </TD>
              <TD align="right" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => openDetail(a)}
                  className="text-xs text-primary-500 hover:underline"
                >
                  {t("admin.platform_loyalty.manage")}
                </button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {lastPage > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-fg-t6">
            {t("admin.platform_loyalty.pagination")
              .replace("{page}", String(page))
              .replace("{lastPage}", String(lastPage))
              .replace("{total}", total.toLocaleString())}
          </span>
          <Pagination
            page={page}
            lastPage={lastPage}
            onPage={setPage}
            prevLabel={t("common.prev")}
            nextLabel={t("common.next")}
          />
        </div>
      )}

      {/* Detail drawer (kept custom right-side drawer; Drawer primitive will replace later) */}
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
                aria-label={t("common.close")}
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="admin-card p-3">
                <div className="text-xs text-fg-t6">
                  {t("admin.platform_loyalty.tier")}
                </div>
                <div className="mt-1">
                  <TierBadge tier={selected.tier} />
                </div>
              </div>
              <div className="admin-card p-3">
                <div className="text-xs text-fg-t6">
                  {t("admin.platform_loyalty.balance")}
                </div>
                <div className="mt-1 text-lg font-bold tabular-nums">
                  {selected.points_balance.toLocaleString()}
                </div>
              </div>
              <div className="admin-card p-3">
                <div className="text-xs text-fg-t6">
                  {t("admin.platform_loyalty.lifetime")}
                </div>
                <div className="mt-1 text-lg font-bold tabular-nums">
                  {selected.lifetime_points.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-zulu border border-default bg-figma-bg-1 p-4">
              <h3 className="text-sm font-semibold">
                {t("admin.platform_loyalty.manual_adjust")}
              </h3>
              <p className="mt-1 text-xs text-fg-t6">
                {t("admin.platform_loyalty.manual_adjust_help")}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <FormField
                  label={t("admin.platform_loyalty.points_placeholder")}
                  htmlFor="l-points"
                >
                  <Input
                    id="l-points"
                    type="number"
                    value={adjustPoints}
                    onChange={(e) => setAdjustPoints(e.target.value)}
                  />
                </FormField>
                <FormField
                  label={t("admin.platform_loyalty.reason")}
                  htmlFor="l-reason"
                  className="sm:col-span-2"
                >
                  <Input
                    id="l-reason"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                  />
                </FormField>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={submitAdjust}
                  disabled={actionLoading || !adjustPoints || !adjustReason.trim()}
                >
                  {actionLoading
                    ? t("admin.platform_loyalty.applying")
                    : t("admin.platform_loyalty.apply_adjustment")}
                </Button>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                {t("admin.platform_loyalty.transactions")}{" "}
                {selected.transactions && `(${selected.transactions.length})`}
              </h3>
              {(!selected.transactions || selected.transactions.length === 0) && (
                <p className="mt-2 text-xs text-fg-t6">
                  {t("admin.platform_loyalty.no_transactions")}
                </p>
              )}
              {selected.transactions && selected.transactions.length > 0 && (
                <div className="mt-2 max-h-96 overflow-y-auto">
                  <Table className="min-w-0">
                    <THead>
                      <TR>
                        <TH>{t("admin.platform_loyalty.when")}</TH>
                        <TH>{t("admin.platform_loyalty.type")}</TH>
                        <TH align="right">{t("admin.platform_loyalty.points")}</TH>
                        <TH>{t("admin.platform_loyalty.reason")}</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {selected.transactions.map((tx) => (
                        <TR key={tx.id}>
                          <TD className="text-xs whitespace-nowrap">
                            {new Date(tx.created_at).toLocaleString()}
                          </TD>
                          <TD className="text-xs">{tx.type}</TD>
                          <TD
                            align="right"
                            className={`tabular-nums font-mono text-xs ${
                              tx.points > 0 ? "text-success-700" : "text-error-700"
                            }`}
                          >
                            {tx.points > 0 ? "+" : ""}
                            {tx.points.toLocaleString()}
                          </TD>
                          <TD className="text-xs">{tx.reason ?? "—"}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
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
      <div className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const { t } = useLanguage();
  const tone =
    tier === "platinum"
      ? "bg-primary-50 text-primary-600"
      : tier === "gold"
        ? "bg-warning-50 text-warning-700"
        : tier === "silver"
          ? "bg-figma-bg-1 text-fg-t11"
          : "bg-figma-bg-1 text-fg-t7";
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium uppercase ${tone}`}
    >
      {t(`admin.platform_loyalty.tier_${tier}`)}
    </span>
  );
}
