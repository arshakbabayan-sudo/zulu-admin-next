"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiPlatformStats, type PlatformStats } from "@/lib/platform-admin-api";
import { useEffect, useState } from "react";

export default function DashboardPage() {
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
                  : "Failed to load stats"
            );
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, token]);

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Dashboard</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice message="Platform KPIs require super admin (GET /api/platform-admin/stats)." />
        </div>
      </div>
    );
  }

  if (err === "forbidden") {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Dashboard</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-3">
        <h1 className="admin-page-title">Dashboard</h1>
        <p className="text-sm text-red-600">{err}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-2">
        <h1 className="admin-page-title">Dashboard</h1>
        <p className="admin-page-subtitle">Loading platform stats…</p>
      </div>
    );
  }

  const keys = Object.keys(stats).sort();

  return (
    <div>
      <h1 className="admin-page-title">Platform overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {keys.map((k) => (
          <div
            key={k}
            className="admin-card px-5 py-4"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {k.replace(/_/g, " ")}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-800">
              {stats[k]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
