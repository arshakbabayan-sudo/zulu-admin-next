"use client";

/**
 * Figma layout reference: Quest CRM Copy template
 *   - Dashboard 1920: 9350:15768
 *   - Mobile dashboard: 10172:25208
 * Brand tokens: ZULU purple primary (--admin-primary).
 * Mobile rule: stat cards stack to single column at <sm.
 * Last synced: 2026-05-03
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiPlatformStats, type PlatformStats } from "@/lib/platform-admin-api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";

function humanizeStatKey(statKey: string): string {
  return statKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatCardIcon({ statKey }: { statKey: string }) {
  // Pick an SVG glyph based on the stat key's category (bookings, users, finance, …).
  // Falls back to a generic "stack" glyph.
  const k = statKey.toLowerCase();
  const stroke = "stroke-current";
  if (k.includes("user") || k.includes("client") || k.includes("agent") || k.includes("seller")) {
    return (
      <svg viewBox="0 0 24 24" className={`h-5 w-5 fill-none ${stroke}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (k.includes("booking") || k.includes("order") || k.includes("trip")) {
    return (
      <svg viewBox="0 0 24 24" className={`h-5 w-5 fill-none ${stroke}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    );
  }
  if (k.includes("revenue") || k.includes("finance") || k.includes("payment") || k.includes("invoice") || k.includes("amount")) {
    return (
      <svg viewBox="0 0 24 24" className={`h-5 w-5 fill-none ${stroke}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  if (k.includes("company") || k.includes("supplier") || k.includes("operator")) {
    return (
      <svg viewBox="0 0 24 24" className={`h-5 w-5 fill-none ${stroke}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01" />
      </svg>
    );
  }
  if (k.includes("review") || k.includes("rating")) {
    return (
      <svg viewBox="0 0 24 24" className={`h-5 w-5 fill-none ${stroke}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    );
  }
  if (k.includes("ticket") || k.includes("support")) {
    return (
      <svg viewBox="0 0 24 24" className={`h-5 w-5 fill-none ${stroke}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V7Z" />
        <path d="M9 7v14M15 7v14" strokeDasharray="2 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 fill-none ${stroke}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const { token, user } = useAdminAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const allowed = canAccessPlatformAdminNav(user);

  useEffect(() => {
    if (!allowed || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiPlatformStats(token);
        if (!cancelled) setStats(res.data);
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiRequestError && e.status === 403) {
            setErr("forbidden");
          } else {
            setErr(
              e instanceof ApiRequestError
                ? e.message
                : e instanceof Error
                  ? e.message
                  : t("admin.dashboard.load_failed")
            );
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, token, t]);

  const greeting = user?.name ? `${t("admin.dashboard.title")} — ${user.name}` : t("admin.dashboard.title");

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.dashboard.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice messageKey="admin.forbidden.dashboard_stats" />
        </div>
      </div>
    );
  }

  if (err === "forbidden") {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.dashboard.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-3">
        <h1 className="admin-page-title">{t("admin.dashboard.title")}</h1>
        <p className="text-sm text-error-600">{err}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="admin-page-title">{t("admin.dashboard.title")}</h1>
          <p className="mt-1 text-sm text-fg-t6">{t("admin.dashboard.loading_stats")}</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="admin-card p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="mt-4 h-8 w-24 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const keys = Object.keys(stats).sort();
  const resolveStatLabel = (statKey: string): string => {
    const key = `admin.dashboard.stats.${statKey}`;
    const translated = t(key);
    return translated === key ? humanizeStatKey(statKey) : translated;
  };

  const formatValue = (n: number): string => {
    if (Number.isFinite(n) === false) return "—";
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
    return new Intl.NumberFormat().format(n);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="admin-page-title">{greeting}</h1>
        <p className="mt-1 text-sm text-fg-t6">{t("admin.dashboard.platform_overview")}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {keys.map((k) => (
          <div
            key={k}
            className="admin-card group p-5 transition hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: "var(--admin-primary-soft)",
                  color: "var(--admin-primary)",
                }}
              >
                <StatCardIcon statKey={k} />
              </span>
              <span className="text-sm font-medium text-fg-t7">{resolveStatLabel(k)}</span>
            </div>
            <div className="mt-4 text-3xl font-semibold tabular-nums text-fg-t11">
              {formatValue(stats[k])}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
