"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiPlatformFinanceSummary,
  type PlatformFinanceSummary,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-700">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-800">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-700">{sub}</div>}
    </div>
  );
}

export default function PlatformFinanceSummaryPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [data, setData] = useState<PlatformFinanceSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformFinanceSummary(token);
      setData(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load finance summary");
    }
  }, [token, allowed]);

  useEffect(() => {
    load();
  }, [load]);

  if (!allowed) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Finance summary</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Finance summary</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Platform finance summary</h1>
      <button
        type="button"
        onClick={() => load()}
        className="mt-4 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
      >
        Refresh
      </button>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {data && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            label="Total payments (paid)"
            value={data.total_payments_paid.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            sub={`${data.payments_count_paid} paid payment(s)`}
          />
          <SummaryCard
            label="Commission accrued"
            value={data.total_commission_accrued.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          />
          <SummaryCard
            label="Commission pending"
            value={data.total_commission_pending.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            sub={`${data.commission_records_count} commission record(s) total`}
          />
        </div>
      )}
    </div>
  );
}
