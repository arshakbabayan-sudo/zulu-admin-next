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
            setErr(e instanceof ApiRequestError ? e.message : "Failed to load stats");
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
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
        <div className="mt-4">
          <ForbiddenNotice message="Platform KPIs require super admin (GET /api/platform-admin/stats)." />
        </div>
      </div>
    );
  }

  if (err === "forbidden") {
    return (
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="mt-2 text-sm text-red-600">{err}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-500">Loading platform stats…</p>
      </div>
    );
  }

  const keys = Object.keys(stats).sort();

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900">Platform overview</h1>
      <p className="mt-1 text-sm text-zinc-500">GET /api/platform-admin/stats</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {keys.map((k) => (
          <div
            key={k}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="text-xs font-medium uppercase text-zinc-500">
              {k.replace(/_/g, " ")}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
              {stats[k]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
