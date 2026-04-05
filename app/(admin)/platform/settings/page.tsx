"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiPatchPlatformSetting, apiPlatformSettings, type PlatformSettingRow } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

export default function PlatformSettingsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformSettingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformSettings(token);
      setRows(res.data);
      const d: Record<string, string> = {};
      for (const r of res.data) d[r.key] = r.value;
      setDrafts(d);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load settings");
    }
  }, [token, allowed]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(key: string) {
    if (!token) return;
    const value = drafts[key];
    if (value === undefined) return;
    setBusyKey(key);
    setMsg(null);
    try {
      await apiPatchPlatformSetting(token, key, value);
      setMsg("Saved.");
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Update failed");
    } finally {
      setBusyKey(null);
    }
  }

  if (!allowed) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Platform settings</h1>
      {msg && <p className="mt-2 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 space-y-4">
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="text-xs font-mono text-slate-700">{r.key}</div>
            {r.description && (
              <p className="mt-1 text-xs text-slate-600">{r.description}</p>
            )}
            <div className="mt-2 text-xs text-slate-400">
              type: {r.type} | id: {r.id}
            </div>
            <textarea
              value={drafts[r.key] ?? r.value}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [r.key]: e.target.value }))}
              rows={3}
              className="mt-2 w-full max-w-xl rounded border border-slate-300 px-2 py-1 font-mono text-sm"
            />
            <button
              type="button"
              disabled={busyKey === r.key}
              onClick={() => save(r.key)}
              className="mt-2 rounded bg-slate-800 px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              {busyKey === r.key ? "Saving..." : "Save"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
