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
import { useLanguage } from "@/contexts/LanguageContext";
import {
  apiCompanyCountryPermissions,
  apiCompanySellerPermissions,
  apiPatchCompanyGovernance,
  apiPatchCompanySellerPermissions,
  apiPlatformCompanies,
  apiSyncCompanyCountryPermissions,
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
  const { t } = useLanguage();
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
  // Country permissions (per-(company, country) seller licenses)
  const [countryHomeCode, setCountryHomeCode] = useState<string>("");
  const [countrySelected, setCountrySelected] = useState<Record<string, { code: string; name: string }>>({});
  const [countryQuery, setCountryQuery] = useState<string>("");
  const [countrySuggestions, setCountrySuggestions] = useState<Array<{ code: string; name: string; flag: string | null }>>([]);

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
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_load"));
    }
  }, [token, allowed, page, search, governanceFilter, sellerParam, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function openPermissionsModal(row: PlatformCompanyRow) {
    if (!token) return;
    setPermModalCompany(row);
    setPermLoadErr(null);
    setPermLoading(true);
    setPermSelected({});
    setCountrySelected({});
    setCountryHomeCode("");
    setCountryQuery("");
    setCountrySuggestions([]);
    try {
      const [permRes, countryRes] = await Promise.all([
        apiCompanySellerPermissions(token, row.id),
        apiCompanyCountryPermissions(token, row.id),
      ]);
      const next: Record<string, boolean> = {};
      for (const t of SELLER_SERVICE_TYPES) next[t] = false;
      for (const p of permRes.data.permissions) {
        if (p.status === "active" && (SELLER_SERVICE_TYPES as readonly string[]).includes(p.service_type)) {
          next[p.service_type] = true;
        }
      }
      setPermSelected(next);

      // Country permissions: keep only active rows in the editable set.
      const homeName = countryRes.data.home_country ?? "";
      const homeCode = homeName ? homeName.slice(0, 2).toUpperCase() : "";
      setCountryHomeCode(homeCode);
      const cs: Record<string, { code: string; name: string }> = {};
      for (const cp of countryRes.data.permissions) {
        if (cp.status === "active") {
          cs[cp.country_code] = { code: cp.country_code, name: cp.country_name };
        }
      }
      setCountrySelected(cs);
    } catch (e) {
      setPermLoadErr(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_load_permissions"));
    } finally {
      setPermLoading(false);
    }
  }

  function closePermissionsModal() {
    setPermModalCompany(null);
    setPermLoadErr(null);
    setPermSelected({});
    setCountrySelected({});
    setCountryHomeCode("");
    setCountryQuery("");
    setCountrySuggestions([]);
    setPermLoading(false);
  }

  async function fetchCountrySuggestions(q: string) {
    if (!q || q.trim().length < 1) {
      setCountrySuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8008/api"}/locations/search?q=${encodeURIComponent(q)}&types=country&limit=8`,
        { headers: { Accept: "application/json" } }
      );
      const json = await res.json();
      const arr = Array.isArray(json?.data) ? json.data : [];
      setCountrySuggestions(
        arr.map((i: { country_code: string; name: string; flag_emoji: string | null }) => ({
          code: i.country_code,
          name: i.name,
          flag: i.flag_emoji,
        }))
      );
    } catch {
      setCountrySuggestions([]);
    }
  }

  async function savePermissions() {
    if (!token || !permModalCompany) return;
    const permissions = SELLER_SERVICE_TYPES.filter((t) => permSelected[t]);
    setBusyId(permModalCompany.id);
    try {
      await apiPatchCompanySellerPermissions(token, permModalCompany.id, [...permissions]);
      // Country permissions: send the desired set; backend revokes anything else.
      await apiSyncCompanyCountryPermissions(
        token,
        permModalCompany.id,
        Object.values(countrySelected).map(({ code, name }) => ({ country_code: code, country_name: name }))
      );
      closePermissionsModal();
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_update"));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSeller(row: PlatformCompanyRow) {
    if (!token) return;
    const nextLabel = row.is_seller ? t("admin.platform_companies.disable_seller") : t("admin.platform_companies.enable_seller");
    if (
      !window.confirm(
        t("admin.platform_companies.confirm_toggle_seller")
          .replace("{action}", nextLabel)
          .replace("{name}", row.name)
      )
    ) {
      return;
    }
    setBusyId(row.id);
    try {
      await apiToggleCompanySeller(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_toggle"));
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
      alert(t("admin.platform_companies.no_change_to_save"));
      return;
    }
    const reason = window.prompt(t("admin.platform_companies.optional_reason")) ?? "";
    setBusyId(companyId);
    try {
      await apiPatchCompanyGovernance(token, companyId, {
        governance_status,
        reason: reason.trim() || undefined,
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.platform_companies.err_update"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.platform_companies.title")}</h1>
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
          <h1 className="admin-page-title">{t("admin.platform_companies.title")}</h1>
          {meta && (
            <p className="mt-1 text-sm text-fg-t6">
              {t("admin.platform_companies.meta")
                .replace("{total}", String(meta.total))
                .replace("{page}", String(meta.current_page))
                .replace("{lastPage}", String(meta.last_page))}
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
              placeholder={t("admin.platform_companies.search_placeholder")}
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
            {t("common.apply")}
          </button>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">{t("admin.platform_companies.governance")}</span>
            <select
              value={governanceFilter}
              onChange={(e) => {
                setPage(1);
                setGovernanceFilter(e.target.value);
              }}
              className="h-9 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">{t("common.any")}</option>
              {GOVERNANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">{t("admin.platform_companies.seller")}</span>
            <select
              value={sellerFilter}
              onChange={(e) => {
                setPage(1);
                setSellerFilter(e.target.value);
              }}
              className="h-9 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">{t("common.any")}</option>
              <option value="1">{t("admin.platform_companies.yes")}</option>
              <option value="0">{t("admin.platform_companies.no")}</option>
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
                <th className="px-4 py-3">{t("admin.crud.common.id")}</th>
                <th className="px-4 py-3">{t("admin.platform_companies.name")}</th>
                <th className="px-4 py-3">{t("admin.platform_companies.type")}</th>
                <th className="px-4 py-3">{t("admin.platform_companies.status")}</th>
                <th className="px-4 py-3">{t("admin.platform_companies.governance")}</th>
                <th className="px-4 py-3">{t("admin.platform_companies.seller")}</th>
                <th className="px-4 py-3 text-right">{t("admin.platform_companies.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-fg-t6">
                    {t("admin.platform_companies.empty")}
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
                        {t("admin.platform_companies.yes")}
                        {r.active_seller_permissions_count != null && (
                          <span className="ml-1 tabular-nums">· {r.active_seller_permissions_count}</span>
                        )}
                      </StatusPill>
                    ) : (
                      <StatusPill status="no" tone="muted">{t("admin.platform_companies.no")}</StatusPill>
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
                        {t("admin.platform_companies.save_gov")}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void openPermissionsModal(r)}
                        className="inline-flex h-8 items-center rounded-zulu border border-default bg-white px-2.5 text-xs font-medium text-fg-t7 transition hover:bg-figma-bg-1 disabled:opacity-40"
                      >
                        {t("admin.platform_companies.permissions")}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void toggleSeller(r)}
                        className="inline-flex h-8 items-center rounded-zulu border border-primary-100 bg-primary-50 px-2.5 text-xs font-medium text-primary transition hover:bg-primary-100 disabled:opacity-40"
                      >
                        {r.is_seller ? t("admin.platform_companies.disable_seller") : t("admin.platform_companies.enable_seller")}
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
                  {t("admin.platform_companies.seller_service_types")}
                </h2>
                <p className="mt-1 text-xs text-fg-t6">
                  {t("admin.platform_companies.modal_subtitle").replace("{name}", permModalCompany.name)}
                </p>
              </div>
              <button
                type="button"
                onClick={closePermissionsModal}
                aria-label={t("common.close")}
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
                <p className="text-sm text-fg-t6">{t("admin.platform_companies.loading")}</p>
              ) : !permLoadErr ? (
                <>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-t6">
                    Service Types (what they sell)
                  </h3>
                  <ul className="mb-5 space-y-2">
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

                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-t6">
                    Allowed Countries (where they can sell)
                  </h3>
                  {permModalCompany?.country && (
                    <div className="mb-2 rounded-zulu border border-success-100 bg-success-50 px-3 py-2 text-sm text-success-700">
                      🏠 Home country: <span className="font-medium">{permModalCompany.country}</span>
                      <span className="ml-1 text-xs text-success-600">(always allowed)</span>
                    </div>
                  )}
                  <ul className="mb-3 space-y-1">
                    {Object.values(countrySelected).map((c) => (
                      <li key={c.code} className="flex items-center justify-between rounded-zulu border border-default bg-white px-3 py-2 text-sm">
                        <span className="text-fg-t8">{c.name} <span className="text-fg-t6">({c.code})</span></span>
                        <button
                          type="button"
                          onClick={() =>
                            setCountrySelected((prev) => {
                              const n = { ...prev };
                              delete n[c.code];
                              return n;
                            })
                          }
                          className="text-xs text-error-600 hover:underline"
                        >
                          Revoke
                        </button>
                      </li>
                    ))}
                    {Object.keys(countrySelected).length === 0 && (
                      <li className="text-xs text-fg-t6">No additional countries granted yet.</li>
                    )}
                  </ul>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search a country to grant…"
                      value={countryQuery}
                      onChange={(e) => {
                        setCountryQuery(e.target.value);
                        void fetchCountrySuggestions(e.target.value);
                      }}
                      className="w-full rounded-zulu border border-default bg-white px-3 py-2 text-sm"
                    />
                    {countrySuggestions.length > 0 && (
                      <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-zulu border border-default bg-white shadow-md">
                        {countrySuggestions
                          .filter((s) => !countrySelected[s.code] && s.code.toUpperCase() !== countryHomeCode)
                          .map((s) => (
                            <li
                              key={s.code}
                              onClick={() => {
                                setCountrySelected((prev) => ({ ...prev, [s.code]: { code: s.code, name: s.name } }));
                                setCountryQuery("");
                                setCountrySuggestions([]);
                              }}
                              className="cursor-pointer px-3 py-2 text-sm hover:bg-figma-bg-1"
                            >
                              {s.flag} {s.name} <span className="text-fg-t6">({s.code})</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-default bg-figma-bg-1 p-4">
              <button
                type="button"
                onClick={closePermissionsModal}
                className="inline-flex h-9 items-center rounded-zulu border border-default bg-white px-4 text-sm font-medium text-fg-t7 transition hover:bg-white/70"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={!!permLoadErr || permLoading || busyId === permModalCompany.id}
                onClick={() => void savePermissions()}
                className="inline-flex h-9 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {t("admin.platform_companies.save_permissions")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
