"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiCompanySellerPermissions,
  apiPatchCompanyGovernance,
  apiPatchCompanySellerPermissions,
  apiPlatformCompanies,
  apiToggleCompanySeller,
  SELLER_SERVICE_TYPES,
  type PlatformCompanyRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useMemo, useState } from "react";

const GOVERNANCE_STATUSES = ["pending", "active", "suspended", "rejected"] as const;

function labelServiceType(t: string): string {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

export default function PlatformCompaniesPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformCompanyRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [governanceFilter, setGovernanceFilter] = useState<string>("");
  const [sellerFilter, setSellerFilter] = useState<string>("");
  const [draftGovernance, setDraftGovernance] = useState<Record<number, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [permModalCompany, setPermModalCompany] = useState<PlatformCompanyRow | null>(null);
  const [permSelected, setPermSelected] = useState<Record<string, boolean>>({});
  const [permLoadErr, setPermLoadErr] = useState<string | null>(null);
  const [permLoading, setPermLoading] = useState(false);

  const sellerParam = useMemo((): boolean | undefined => {
    if (sellerFilter === "1") return true;
    if (sellerFilter === "0") return false;
    return undefined;
  }, [sellerFilter]);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformCompanies(token, {
        page,
        per_page: 20,
        search: search || undefined,
        governance_status: governanceFilter || undefined,
        is_seller: sellerParam,
      });
      setRows(res.data);
      setMeta(res.meta);
      setDraftGovernance((prev) => {
        const next = { ...prev };
        for (const r of res.data) {
          next[r.id] = r.governance_status;
        }
        return next;
      });
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
    }
  }, [token, allowed, page, search, governanceFilter, sellerParam]);

  useEffect(() => {
    load();
  }, [load]);

  async function openPermissionsModal(row: PlatformCompanyRow) {
    if (!token) return;
    setPermModalCompany(row);
    setPermLoadErr(null);
    setPermLoading(true);
    setPermSelected({});
    try {
      const res = await apiCompanySellerPermissions(token, row.id);
      const next: Record<string, boolean> = {};
      for (const t of SELLER_SERVICE_TYPES) next[t] = false;
      for (const p of res.data.permissions) {
        if (p.status === "active" && (SELLER_SERVICE_TYPES as readonly string[]).includes(p.service_type)) {
          next[p.service_type] = true;
        }
      }
      setPermSelected(next);
    } catch (e) {
      setPermLoadErr(e instanceof ApiRequestError ? e.message : "Failed to load permissions");
    } finally {
      setPermLoading(false);
    }
  }

  function closePermissionsModal() {
    setPermModalCompany(null);
    setPermLoadErr(null);
    setPermSelected({});
    setPermLoading(false);
  }

  async function savePermissions() {
    if (!token || !permModalCompany) return;
    const permissions = SELLER_SERVICE_TYPES.filter((t) => permSelected[t]);
    setBusyId(permModalCompany.id);
    try {
      await apiPatchCompanySellerPermissions(token, permModalCompany.id, [...permissions]);
      closePermissionsModal();
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSeller(row: PlatformCompanyRow) {
    if (!token) return;
    const nextLabel = row.is_seller ? "disable" : "enable";
    if (
      !window.confirm(
        `${nextLabel.charAt(0).toUpperCase() + nextLabel.slice(1)} seller for "${row.name}"?`
      )
    ) {
      return;
    }
    setBusyId(row.id);
    try {
      await apiToggleCompanySeller(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Toggle failed");
    } finally {
      setBusyId(null);
    }
  }

  async function saveGovernance(companyId: number) {
    if (!token) return;
    const governance_status = draftGovernance[companyId];
    if (!governance_status) return;
    const row = rows.find((r) => r.id === companyId);
    if (row && governance_status === row.governance_status) {
      alert("No change to save.");
      return;
    }
    const reason = window.prompt("Optional reason (stored with governance change)") ?? "";
    setBusyId(companyId);
    try {
      await apiPatchCompanyGovernance(token, companyId, {
        governance_status,
        reason: reason.trim() || undefined,
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Platform companies</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Platform companies</h1>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">
          Search
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setSearch(searchDraft.trim());
              }
            }}
            className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="Name, slug..."
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setSearch(searchDraft.trim());
          }}
          className="rounded border border-slate-300 bg-white px-3 py-1 text-sm"
        >
          Apply search
        </button>
        <label className="text-sm text-slate-600">
          Governance
          <select
            value={governanceFilter}
            onChange={(e) => {
              setPage(1);
              setGovernanceFilter(e.target.value);
            }}
            className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">Any</option>
            {GOVERNANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Seller
          <select
            value={sellerFilter}
            onChange={(e) => {
              setPage(1);
              setSellerFilter(e.target.value);
            }}
            className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">Any</option>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </label>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase text-slate-700">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Governance</th>
              <th className="px-3 py-2">Seller</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.type ?? "-"}</td>
                <td className="px-3 py-2">{r.status ?? "-"}</td>
                <td className="px-3 py-2">
                  <select
                    value={draftGovernance[r.id] ?? r.governance_status}
                    onChange={(e) =>
                      setDraftGovernance((prev) => ({ ...prev, [r.id]: e.target.value }))
                    }
                    className="max-w-[140px] rounded border border-slate-300 px-1 py-0.5 text-xs"
                  >
                    {GOVERNANCE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {r.is_seller ? "yes" : "no"}
                  {r.active_seller_permissions_count != null ? (
                    <span className="ml-1 text-slate-700 tabular-nums">
                      ({r.active_seller_permissions_count} types)
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => saveGovernance(r.id)}
                      className="text-left text-xs text-blue-700 underline disabled:opacity-40"
                    >
                      Save governance
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void openPermissionsModal(r)}
                      className="text-left text-xs text-blue-700 underline disabled:opacity-40"
                    >
                      Service permissions...
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void toggleSeller(r)}
                      className="text-left text-xs text-blue-700 underline disabled:opacity-40"
                    >
                      Toggle seller
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}

      {permModalCompany && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="perm-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePermissionsModal();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded border border-slate-200 bg-white p-4 shadow-lg">
            <h2 id="perm-modal-title" className="text-base font-semibold">
              Seller service types - {permModalCompany.name}
            </h2>
            <p className="mt-1 text-xs text-slate-700">
              Checked types are synced as active; unchecked are removed from the active set (same as Blade
              matrix).
            </p>
            {permLoadErr && <p className="mt-2 text-sm text-red-600">{permLoadErr}</p>}
            {permLoading ? (
              <p className="mt-4 text-sm text-slate-600">Loading...</p>
            ) : !permLoadErr ? (
              <ul className="mt-4 space-y-2">
                {SELLER_SERVICE_TYPES.map((t) => (
                  <li key={t}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!permSelected[t]}
                        onChange={(e) =>
                          setPermSelected((prev) => ({ ...prev, [t]: e.target.checked }))
                        }
                      />
                      {labelServiceType(t)}
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={closePermissionsModal}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!permLoadErr || permLoading || busyId === permModalCompany.id}
                onClick={() => void savePermissions()}
                className="rounded bg-slate-800 px-3 py-1 text-sm text-white disabled:opacity-40"
              >
                Save permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
