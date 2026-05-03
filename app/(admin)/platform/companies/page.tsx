"use client";

/**
 * Figma layout reference: Quest CRM Copy template
 *   - Client Table (list pattern):  4393:6787
 *   - Modal Client Type:             4381:5202
 * Brand tokens: ZULU purple primary (--admin-primary).
 * Mobile compromise: governance dropdown + multi-action column means horizontal
 *   scroll on <md is retained for this page (high cell density). A future pass
 *   should split into list-only + detail page to enable card list.
 * Last synced: 2026-05-03
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { StatusPill, autoStatusTone } from "@/components/ui/StatusPill";
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
      <div className="space-y-4">
        <h1 className="admin-page-title">Platform companies</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="admin-page-title">Platform companies</h1>
          {meta && (
            <p className="mt-1 text-sm text-fg-t6">
              {meta.total} total · page {meta.current_page} of {meta.last_page}
            </p>
          )}
        </div>
      </header>

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-current text-fg-t6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setSearch(searchDraft.trim());
                }
              }}
              placeholder="Search by name or slug…"
              className="h-9 w-full rounded-zulu border border-default bg-white pl-9 pr-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setSearch(searchDraft.trim());
            }}
            className="inline-flex h-9 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Apply
          </button>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">Governance</span>
            <select
              value={governanceFilter}
              onChange={(e) => {
                setPage(1);
                setGovernanceFilter(e.target.value);
              }}
              className="h-9 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">Any</option>
              {GOVERNANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">Seller</span>
            <select
              value={sellerFilter}
              onChange={(e) => {
                setPage(1);
                setSellerFilter(e.target.value);
              }}
              className="h-9 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">Any</option>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </label>
        </div>
      </div>

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      )}

      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-default bg-figma-bg-1 text-xs font-medium uppercase tracking-wide text-fg-t6">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Governance</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-fg-t6">
                    No companies found.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-default last:border-0 transition hover:bg-figma-bg-1">
                  <td className="px-4 py-3 tabular-nums text-fg-t7">{r.id}</td>
                  <td className="px-4 py-3 font-medium text-fg-t8">{r.name}</td>
                  <td className="px-4 py-3 text-fg-t7 capitalize">{r.type ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.status ? <StatusPill status={r.status} /> : <span className="text-fg-t6">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={draftGovernance[r.id] ?? r.governance_status}
                        onChange={(e) =>
                          setDraftGovernance((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        className="h-8 rounded-zulu border border-default bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                      >
                        {GOVERNANCE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                      <StatusPill status={r.governance_status} tone={autoStatusTone(r.governance_status)} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.is_seller ? (
                      <StatusPill status="yes" tone="success">
                        Yes
                        {r.active_seller_permissions_count != null && (
                          <span className="ml-1 tabular-nums">· {r.active_seller_permissions_count}</span>
                        )}
                      </StatusPill>
                    ) : (
                      <StatusPill status="no" tone="muted">No</StatusPill>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => saveGovernance(r.id)}
                        className="inline-flex h-8 items-center rounded-zulu border border-default bg-white px-2.5 text-xs font-medium text-fg-t7 transition hover:bg-figma-bg-1 disabled:opacity-40"
                      >
                        Save gov.
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void openPermissionsModal(r)}
                        className="inline-flex h-8 items-center rounded-zulu border border-default bg-white px-2.5 text-xs font-medium text-fg-t7 transition hover:bg-figma-bg-1 disabled:opacity-40"
                      >
                        Permissions…
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void toggleSeller(r)}
                        className="inline-flex h-8 items-center rounded-zulu border border-primary-100 bg-primary-50 px-2.5 text-xs font-medium text-primary transition hover:bg-primary-100 disabled:opacity-40"
                      >
                        {r.is_seller ? "Disable seller" : "Enable seller"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}

      {permModalCompany && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="perm-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePermissionsModal();
          }}
        >
          <div className="w-full max-w-zulu-modal overflow-hidden rounded-t-zulu-modal bg-white shadow-zulu-modal sm:rounded-zulu-modal">
            <div className="flex items-start justify-between gap-3 border-b border-default p-5">
              <div>
                <h2 id="perm-modal-title" className="text-base font-semibold text-fg-t8">
                  Seller service types
                </h2>
                <p className="mt-1 text-xs text-fg-t6">
                  {permModalCompany.name} · checked types are synced as active.
                </p>
              </div>
              <button
                type="button"
                onClick={closePermissionsModal}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-zulu text-fg-t6 transition hover:bg-figma-bg-1"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              {permLoadErr && (
                <div className="mb-3 rounded-zulu border border-error-100 bg-error-50 px-3 py-2 text-sm text-error-700">
                  {permLoadErr}
                </div>
              )}
              {permLoading ? (
                <p className="text-sm text-fg-t6">Loading…</p>
              ) : !permLoadErr ? (
                <ul className="space-y-2">
                  {SELLER_SERVICE_TYPES.map((tp) => (
                    <li key={tp}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-zulu border border-default bg-white px-3 py-2 text-sm transition hover:bg-figma-bg-1">
                        <input
                          type="checkbox"
                          checked={!!permSelected[tp]}
                          onChange={(e) =>
                            setPermSelected((prev) => ({ ...prev, [tp]: e.target.checked }))
                          }
                          style={{ accentColor: "var(--admin-primary)" }}
                          className="h-4 w-4"
                        />
                        <span className="text-fg-t8">{labelServiceType(tp)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-default bg-figma-bg-1 p-4">
              <button
                type="button"
                onClick={closePermissionsModal}
                className="inline-flex h-9 items-center rounded-zulu border border-default bg-white px-4 text-sm font-medium text-fg-t7 transition hover:bg-white/70"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!permLoadErr || permLoading || busyId === permModalCompany.id}
                onClick={() => void savePermissions()}
                className="inline-flex h-9 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
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
