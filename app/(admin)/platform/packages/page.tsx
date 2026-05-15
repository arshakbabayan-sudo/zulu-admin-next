"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PackageHomepageFeatureModal } from "@/components/PackageHomepageFeatureModal";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiDeactivatePlatformPackage,
  apiPlatformPackages,
  type PlatformGovernancePackageRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

export default function PlatformPackagesGovernancePage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformGovernancePackageRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [companyIdDraft, setCompanyIdDraft] = useState("");
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [featureRow, setFeatureRow] = useState<PlatformGovernancePackageRow | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformPackages(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        company_id: companyId,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.packages.err_load"));
    }
  }, [token, allowed, page, statusFilter, companyId, t]);

  useEffect(() => {
    load();
  }, [load]);

  function applyCompanyFilter() {
    const trimmed = companyIdDraft.trim();
    if (!trimmed) {
      setCompanyId(undefined);
      setPage(1);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) {
      setErr(t("admin.packages.err_invalid_company"));
      return;
    }
    setErr(null);
    setCompanyId(n);
    setPage(1);
  }

  async function deactivate(pkg: PlatformGovernancePackageRow) {
    if (!token) return;
    const reason = window.prompt(
      t("admin.packages.prompt_deactivate_reason")
        .replace("{title}", pkg.package_title)
        .replace("{id}", String(pkg.id)),
      ""
    );
    if (reason === null) return;
    setBusyId(pkg.id);
    try {
      await apiDeactivatePlatformPackage(token, pkg.id, reason.trim() || undefined);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.packages.err_deactivate"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.packages.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.packages.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.packages.title_long")}</h1>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-fg-t6">
          {t("admin.packages.filter_status")}
          <input
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            placeholder={t("admin.packages.placeholder_status")}
            className="ml-2 rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-fg-t6">
          {t("admin.packages.filter_company_id")}
          <input
            value={companyIdDraft}
            onChange={(e) => setCompanyIdDraft(e.target.value)}
            placeholder={t("admin.packages.placeholder_optional")}
            className="ml-2 w-24 rounded border border-default px-2 py-1 text-sm tabular-nums"
          />
        </label>
        <button
          type="button"
          onClick={applyCompanyFilter}
          className="rounded border border-default bg-white px-3 py-1 text-sm hover:bg-figma-bg-1"
        >
          {t("admin.packages.btn_apply_company")}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.packages.col_id")}</th>
              <th className="px-3 py-2">{t("admin.packages.col_title")}</th>
              <th className="px-3 py-2">{t("admin.packages.col_type")}</th>
              <th className="px-3 py-2">{t("admin.packages.col_status")}</th>
              <th className="px-3 py-2">{t("admin.packages.col_company")}</th>
              <th className="px-3 py-2">{t("admin.packages.col_public_bookable")}</th>
              <th className="px-3 py-2">{t("admin.packages.col_actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2">{r.package_title}</td>
                <td className="px-3 py-2 text-xs">{r.package_type}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-xs">
                  {r.company ? r.company.name : `- (${r.company_id})`}
                </td>
                <td className="px-3 py-2 text-xs tabular-nums">
                  {r.is_public ? t("admin.packages.yes") : t("admin.packages.no")} / {r.is_bookable ? t("admin.packages.yes") : t("admin.packages.no")}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setFeatureRow(r)}
                      className="rounded border border-default bg-white px-2 py-1 text-xs text-fg-t7 hover:bg-figma-bg-1"
                    >
                      {t("admin.packages.btn_homepage_feature")}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => deactivate(r)}
                      className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-error-800 hover:bg-error-50 disabled:opacity-50"
                    >
                      {busyId === r.id ? "..." : t("admin.packages.btn_force_deactivate")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
      <PackageHomepageFeatureModal
        packageId={featureRow?.id ?? null}
        packageTitle={featureRow?.package_title ?? null}
        onClose={() => setFeatureRow(null)}
      />
    </div>
  );
}
