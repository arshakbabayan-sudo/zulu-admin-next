"use client";

/**
 * Operator statistics page.
 *
 * Visibility — who can see this page?
 *   The sidebar entry only shows when `user.context.operator_statistics_platform_scope === true`.
 *   That flag is set on the backend by `AdminAccessService::isAdminStatisticsSuperScope($user)`,
 *   which currently returns true only for super_admin users (PART 18 §4.2).
 *
 *   In Armenian, plain language: «Operator statistics» էջը բացվում է միայն
 *   super admin-ի համար (ZULU-ի գլխավոր ադմինի դերը)։ Operator-ները, agent-ները
 *   կամ սովորական ադմինները չպետք է տեսնեն այս բաժինը sidebar-ում։ Որպես
 *   alternative՝ super_admin-ը այստեղից կարող է որոշակի company-ի վիճակագրությունը
 *   նայել՝ ընտրելով company_id-ով։
 *
 * If you change permission semantics here, update:
 *   - `backend/app/Services/Admin/AdminAccessService::isAdminStatisticsSuperScope()`
 *   - `backend/app/Http/Resources/Api/UserResource::operator_statistics_platform_scope`
 *   - `zulu-admin-next/lib/access::canAccessOperatorStatisticsNav()`
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessOperatorStatisticsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiOperatorStatistics } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";
import { Button, FormField, Input, PageHeader } from "@/components/ui";

export default function OperatorStatisticsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
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
        setErr(t("admin.operator_statistics.err_load"));
      }
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [token, allowed, isSuper, defaultCompanyId, companyIdInput]);

  useEffect(() => {
    if (!allowed) return;
    if (isSuper) return;
    void load();
  }, [allowed, isSuper, load]);

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.operator_statistics.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice messageKey="admin.forbidden.statistics_scope" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.operator_statistics.title")} />

      {isSuper && (
        <div className="admin-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <FormField label={t("admin.inventory_hotels.filter_company_id")} htmlFor="stats-co" className="max-w-xs">
              <Input
                id="stats-co"
                type="number"
                min={1}
                value={companyIdInput}
                onChange={(e) => setCompanyIdInput(e.target.value)}
                placeholder={t("admin.operator_statistics.placeholder_company_required")}
              />
            </FormField>
            <Button size="sm" onClick={() => load()} disabled={loading}>
              {t("admin.content_translations.btn_load")}
            </Button>
          </div>
        </div>
      )}

      {!isSuper && defaultCompanyId && (
        <p className="text-xs text-fg-t7">
          {t("admin.operator_statistics.context_active_company").replace("{id}", String(defaultCompanyId))}
        </p>
      )}

      {err && <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}
      {loading && <p className="text-sm text-fg-t7">{t("common.loading")}</p>}
      {payload !== null && !loading && (
        <pre className="max-h-[70vh] overflow-auto rounded-zulu border border-default bg-slate-800 p-4 text-xs text-slate-100">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
