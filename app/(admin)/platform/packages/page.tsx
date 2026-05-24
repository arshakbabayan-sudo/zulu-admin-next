"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

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
import {
  Button,
  FormField,
  Input,
  PageHeader,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
} from "@/components/ui/v2";
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
    void load();
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

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.packages.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Inventory", href: "/operator/hotels" },
          { label: "Packages oversight" },
        ]}
        title={t("admin.packages.title_long")}
      />

      <SectionTabs
        activeHref="/platform/packages"
        items={[
          { href: "/operator/hotels", label: "Hotels" },
          { href: "/operator/flights", label: "Flights" },
          { href: "/operator/transfers", label: "Transfers" },
          { href: "/operator/cars", label: "Cars" },
          { href: "/operator/excursions", label: "Excursions" },
          { href: "/operator/visas", label: "Visas" },
          { href: "/operator/packages", label: "Packages" },
          { href: "/operator/offers", label: "Offers" },
          { href: "/platform/packages", label: "Packages oversight", count: meta?.total },
        ]}
      />

      <FilterCard>
        <FilterField label={t("admin.packages.filter_status")} minWidth={200}>
          <Input
            id="pp-status"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            placeholder={t("admin.packages.placeholder_status")}
            className="!h-[34px]"
          />
        </FilterField>
        <FilterField label={t("admin.packages.filter_company_id")} minWidth={180}>
          <Input
            id="pp-company"
            value={companyIdDraft}
            onChange={(e) => setCompanyIdDraft(e.target.value)}
            placeholder={t("admin.packages.placeholder_optional")}
            className="!h-[34px] tabular-nums"
          />
        </FilterField>
        <V2Button size="sm" variant="primary" onClick={applyCompanyFilter}>
          {t("admin.packages.btn_apply_company")}
        </V2Button>
      </FilterCard>

      {err && (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.packages.col_id")}</TH>
            <TH>{t("admin.packages.col_title")}</TH>
            <TH>{t("admin.packages.col_type")}</TH>
            <TH>{t("admin.packages.col_status")}</TH>
            <TH>{t("admin.packages.col_company")}</TH>
            <TH>{t("admin.packages.col_public_bookable")}</TH>
            <TH>{t("admin.packages.col_actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={7}>—</TEmpty> : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums">{r.id}</TD>
              <TD>{r.package_title}</TD>
              <TD className="text-xs">{r.package_type}</TD>
              <TD>{r.status}</TD>
              <TD className="text-xs">
                {r.company ? r.company.name : `- (${r.company_id})`}
              </TD>
              <TD className="text-xs tabular-nums">
                {r.is_public ? t("admin.packages.yes") : t("admin.packages.no")} /{" "}
                {r.is_bookable ? t("admin.packages.yes") : t("admin.packages.no")}
              </TD>
              <TD>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFeatureRow(r)}
                  >
                    {t("admin.packages.btn_homepage_feature")}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => deactivate(r)}
                  >
                    {busyId === r.id
                      ? "..."
                      : t("admin.packages.btn_force_deactivate")}
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      </V2Card>

      {meta && <PaginationBar meta={meta} onPage={setPage} />}

      <PackageHomepageFeatureModal
        packageId={featureRow?.id ?? null}
        packageTitle={featureRow?.package_title ?? null}
        onClose={() => setFeatureRow(null)}
      />
    </div>
  );
}
