"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessOperatorStatisticsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiOperatorStatistics } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

export default function OperatorStatisticsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessOperatorStatisticsNav(user);
  const [companyIdInput, setCompanyIdInput] = useState("");
  const [payload, setPayload] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSuper = user?.is_super_admin === true;
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
        companyId = defaultCompanyId;
      }
      const res = await apiOperatorStatistics(token, companyId);
      setPayload(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setErr(e.message);
      } else {
        setErr("Failed to load statistics");
      }
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [token, allowed, isSuper, defaultCompanyId, companyIdInput]);

  useEffect(() => {
    if (!allowed) return;
    if (isSuper) return;
    load();
  }, [allowed, isSuper, load]);

  if (!allowed) {
    return (
      <div>
        <h1 className="admin-page-title">Operator statistics</h1>
        <div className="mt-4">
          <ForbiddenNotice messageKey="admin.forbidden.statistics_scope" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">Operator statistics</h1>
      {isSuper && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            company_id
            <input
              type="number"
              min={1}
              value={companyIdInput}
              onChange={(e) => setCompanyIdInput(e.target.value)}
              placeholder="Required for super-admin scope"
              className="ml-2 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="rounded bg-slate-800 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Load
          </button>
        </div>
      )}
      {!isSuper && defaultCompanyId && (
        <p className="mt-2 text-xs text-fg-t7">
          Using context active company id {defaultCompanyId} (server resolves membership).
        </p>
      )}
      {err && <p className="mt-4 text-sm text-error-600">{err}</p>}
      {loading && <p className="mt-4 text-sm text-fg-t7">Loading...</p>}
      {payload !== null && !loading && (
        <pre className="mt-4 max-h-[70vh] overflow-auto rounded border border-default bg-slate-800 p-4 text-xs text-slate-100">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
