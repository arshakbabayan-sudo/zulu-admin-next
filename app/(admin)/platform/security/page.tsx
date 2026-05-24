"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import {
  Button,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
} from "@/components/ui/v2";
import { formatDateTime, formatNumber } from "@/lib/format";

type TwoFactorRow = {
  id: number;
  user_id: number;
  enabled_at: string | null;
  confirmed_at: string | null;
  last_verified_at: string | null;
  user?: { id: number; name: string; email: string; role: string; is_super_admin: boolean };
};

type Meta = { total: number; per_page: number; current_page: number; last_page: number };
type Stats = { total_users: number; two_factor_confirmed: number; two_factor_pending: number; two_factor_coverage_pct: number };

export default function PlatformSecurityPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<TwoFactorRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [appliedFilters, setAppliedFilters] = useState(0);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [forceLogoutUserId, setForceLogoutUserId] = useState("");

  const baseURL = useMemo(() => process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am", []);

  useEffect(() => {
    if (!allowed || !token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setForbidden(false);

    void (async () => {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("per_page", "50");
        if (q.trim()) params.set("q", q.trim());

        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const [listRes, statsRes] = await Promise.all([
          fetch(`${baseURL}/platform-admin/security/two-factor?${params.toString()}`, { headers }),
          fetch(`${baseURL}/platform-admin/security/stats`, { headers }),
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
          setMeta(listJson.meta ?? null);
        } else {
          setError(listJson?.message ?? t("admin.security.err_load"));
        }
        if (statsJson?.success) setStats(statsJson.data);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
        else setError(e instanceof Error ? e.message : t("admin.security.err_load"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, allowed, baseURL, page, appliedFilters, t]);

  const applyFilters = () => { setPage(1); setAppliedFilters((n) => n + 1); };

  const forceDisable = async (row: TwoFactorRow) => {
    const target = row.user?.name ?? `user #${row.user_id}`;
    const ok = await confirm({
      message: t("admin.security.confirm_force_disable_2fa").replace("{target}", target),
      variant: "danger",
    });
    if (!ok) return;
    setActionLoading(`disable-${row.user_id}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${baseURL}/platform-admin/security/users/${row.user_id}/force-disable-2fa`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await res.json();
      if (json?.success) {
        setSuccess(t("admin.security.success_2fa_disabled").replace("{id}", String(row.user_id)));
        setAppliedFilters((n) => n + 1);
      } else setError(json?.message ?? t("admin.security.err_force_disable"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.security.err_force_disable"));
    } finally { setActionLoading(null); }
  };

  const forceLogoutById = async (userId: number, userName?: string) => {
    const target = userName ?? `user #${userId}`;
    const ok = await confirm({
      message: t("admin.security.confirm_force_logout").replace("{target}", target),
      variant: "danger",
    });
    if (!ok) return;
    setActionLoading(`logout-${userId}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${baseURL}/platform-admin/security/users/${userId}/force-logout`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await res.json();
      if (json?.success) {
        setSuccess(t("admin.security.success_force_logout").replace("{count}", String(json.data.tokens_revoked)).replace("{id}", String(userId)));
      } else setError(json?.message ?? t("admin.security.err_force_logout"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.security.err_force_logout"));
    } finally { setActionLoading(null); }
  };

  const submitForceLogout = async () => {
    const id = parseInt(forceLogoutUserId.trim(), 10);
    if (isNaN(id) || id <= 0) { setError(t("admin.security.err_invalid_user_id")); return; }
    await forceLogoutById(id);
    setForceLogoutUserId("");
  };

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.security.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Security page chrome (Settings section). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.security.title") },
        ]}
        title={t("admin.security.title")}
        subtitle={t("admin.security.subtitle")}
      />

      <SectionTabs
        activeHref="/platform/security"
        items={[
          { href: "/settings/pricing-rules", label: "Pricing rules" },
          { href: "/settings/money-flow", label: "Money flow" },
          { href: "/localization/languages", label: "Languages" },
          { href: "/localization/templates", label: "Email templates" },
          { href: "/platform/banners", label: "Banners" },
          { href: "/pages", label: "CMS pages" },
          { href: "/platform/notifications", label: "System notifications" },
          { href: "/platform/newsletter", label: "Newsletter" },
          { href: "/platform/loyalty", label: "Loyalty" },
          { href: "/bucket3/block-dates", label: "Block dates" },
          { href: "/bucket3/custom-fields", label: "Custom fields" },
          { href: "/platform/security", label: "Security" },
          { href: "/platform/webhooks", label: "Webhooks" },
          { href: "/platform/locations", label: "Locations" },
          { href: "/platform/settings/brand", label: "Brand" },
          { href: "/connections", label: "Connections" },
          { href: "/support/tickets", label: "Support" },
          { href: "/platform/reviews", label: "Reviews" },
        ]}
      />

      <div className="space-y-6">
      {error && <div className="rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{error}</div>}
      {success && <div className="rounded-md border border-success-100 bg-success-50 px-4 py-2 text-sm text-success-700">{success}</div>}

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t("admin.security.stat_total_users")} value={formatNumber(stats.total_users, lang)} />
          <StatCard label={t("admin.security.stat_2fa_enabled")} value={formatNumber(stats.two_factor_confirmed, lang)} tone="good" />
          <StatCard label={t("admin.security.stat_2fa_pending")} value={formatNumber(stats.two_factor_pending, lang)} tone={stats.two_factor_pending > 0 ? "warn" : "neutral"} />
          <StatCard label={t("admin.security.stat_coverage")} value={`${stats.two_factor_coverage_pct}%`} tone={stats.two_factor_coverage_pct >= 50 ? "good" : "warn"} />
        </div>
      )}

      {/* Force-logout incident block */}
      <section className="rounded-zulu border border-error-200 bg-error-50/50 p-4">
        <h2 className="text-sm font-semibold text-error-700">{t("admin.security.incident_title")}</h2>
        <p className="mt-1 text-xs text-error-600">{t("admin.security.incident_help")}</p>
        <div className="mt-3 flex items-end gap-2">
          <FormField label="" htmlFor="sec-uid" className="max-w-xs">
            <Input
              id="sec-uid"
              value={forceLogoutUserId}
              onChange={(e) => setForceLogoutUserId(e.target.value)}
              placeholder={t("admin.security.placeholder_user_id")}
            />
          </FormField>
          <Button
            variant="danger"
            size="sm"
            onClick={submitForceLogout}
            disabled={!forceLogoutUserId.trim() || actionLoading !== null}
          >
            {t("admin.security.btn_force_logout")}
          </Button>
        </div>
      </section>

      <FilterCard>
        <FilterField label={t("admin.security.search_label")} minWidth={320}>
          <Input
            id="sec-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
            className="!h-[34px]"
          />
        </FilterField>
        <V2Button size="sm" variant="primary" onClick={applyFilters}>{t("admin.security.btn_apply")}</V2Button>
        {q && <V2Button size="sm" onClick={() => { setQ(""); setPage(1); setAppliedFilters((n) => n + 1); }}>{t("common.reset")}</V2Button>}
      </FilterCard>

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.security.col_user")}</TH>
            <TH>{t("admin.security.col_role")}</TH>
            <TH>{t("admin.security.col_confirmed_at")}</TH>
            <TH>{t("admin.security.col_last_verified")}</TH>
            <TH align="right">{t("admin.security.col_actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {loading ? <TEmpty colSpan={5}>{t("common.loading")}</TEmpty>
            : rows.length === 0 ? <TEmpty colSpan={5}>{t("admin.security.empty")}</TEmpty>
            : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="text-xs">
                {r.user?.name ?? `#${r.user_id}`}
                {r.user?.email && <div className="text-fg-t6">{r.user.email}</div>}
              </TD>
              <TD className="text-xs">
                {r.user?.is_super_admin ? (
                  <span className="rounded bg-warning-50 px-2 py-0.5 text-warning-700">{t("admin.security.role_super_admin")}</span>
                ) : (
                  <span className="text-fg-t7">{r.user?.role ?? "—"}</span>
                )}
              </TD>
              <TD className="text-xs text-fg-t6">{formatDateTime(r.confirmed_at, lang)}</TD>
              <TD className="text-xs text-fg-t6">{r.last_verified_at ? formatDateTime(r.last_verified_at, lang) : t("admin.security.never")}</TD>
              <TD align="right">
                <div className="inline-flex gap-2">
                  <button
                    type="button"
                    onClick={() => forceLogoutById(r.user_id, r.user?.name)}
                    disabled={actionLoading !== null}
                    className="text-xs text-warning-700 hover:underline disabled:opacity-40"
                  >
                    {actionLoading === `logout-${r.user_id}` ? "…" : t("admin.security.btn_force_logout")}
                  </button>
                  <button
                    type="button"
                    onClick={() => forceDisable(r)}
                    disabled={actionLoading !== null}
                    className="text-xs text-error-700 hover:underline disabled:opacity-40"
                  >
                    {actionLoading === `disable-${r.user_id}` ? "…" : t("admin.security.btn_disable_2fa")}
                  </button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      </V2Card>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "good" | "warn" | "neutral" }) {
  const toneClass = tone === "good" ? "text-success-600" : tone === "warn" ? "text-warning-600" : "text-fg-t11";
  return (
    <div className="admin-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-fg-t6">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
