"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessLocalizationLanguagesNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiLocalizationLanguages,
  apiLocalizationToggleLanguage,
  type LocalizationLanguageRow,
} from "@/lib/localization-api";
import { useCallback, useEffect, useState } from "react";

export default function LocalizationLanguagesPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessLocalizationLanguagesNav(user);
  const [rows, setRows] = useState<LocalizationLanguageRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiLocalizationLanguages(token);
      setRows(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load languages");
    }
  }, [token, allowed]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(row: LocalizationLanguageRow) {
    if (!token) return;
    setBusyId(row.id);
    try {
      await apiLocalizationToggleLanguage(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Toggle failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Languages</h1>
        <div className="mt-4">
          <ForbiddenNotice message="Enabling or disabling languages requires super admin." />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Languages</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Languages</h1>
      <p className="mt-2 text-xs text-slate-700">
        The list includes enabled languages only. After disabling, a language disappears here until it is
        re-enabled via legacy admin or direct API if you still have its id.
      </p>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase text-slate-700">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Name (EN)</th>
              <th className="px-3 py-2">Default</th>
              <th className="px-3 py-2">Sort</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-mono">{r.code}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.name_en ?? "-"}</td>
                <td className="px-3 py-2">{r.is_default ? "Yes" : "-"}</td>
                <td className="px-3 py-2">{r.sort_order}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => toggle(r)}
                    className="rounded bg-slate-800 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    {busyId === r.id ? "..." : "Toggle enabled"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
