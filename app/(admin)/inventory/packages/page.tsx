"use client";

/**
 * Inventory > Packages — oversight (all-companies) scope.
 *
 * Phase Ա.1 (2026-05-28) — merged from former `/platform/packages` route
 * so the Inventory group's scope toggle (rendered by AdminGroupTabs) can
 * flip between `/operator/packages` (mine) and `/inventory/packages`
 * (all-companies oversight), matching the Hotels/Flights/etc. pattern.
 *
 * Visual reference: `docs/admin_designe/inventory_operator/inventory_operator_mocks.html`
 *   page-pane `#page-packages` (Travel packages page, lines 1160-1333).
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PackageHomepageFeatureModal } from "@/components/PackageHomepageFeatureModal";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { exportRowsAsCsv } from "@/lib/export-csv";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiDeactivatePlatformPackage,
  apiPlatformPackages,
  type PlatformGovernancePackageRow,
} from "@/lib/platform-admin-api";
import {
  Button,
  Input,
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
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
} from "@/components/ui/v2";
import { Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function InventoryPackagesOversightPage() {
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
          { label: "Inventory", href: "/inventory/hotels" },
          { label: "Packages" },
        ]}
        title={t("admin.packages.title_long")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
          {/* Phase Ա.1 — scope switch back to the operator's own packages. */}
          <V2Button as="link" href="/operator/packages" variant="default">
            My packages
          </V2Button>
          <V2Button
            icon={<Download className="h-4 w-4" />}
            disabled={rows.length === 0}
            onClick={() =>
              exportRowsAsCsv("inventory-packages-oversight", rows, [
                ["id", (r) => r.id],
                ["package_title", (r) => r.package_title],
                ["package_type", (r) => r.package_type],
                ["status", (r) => r.status],
                ["company_id", (r) => r.company_id],
                ["company_name", (r) => r.company?.name ?? ""],
                ["is_public", (r) => (r.is_public ? "1" : "0")],
                ["is_bookable", (r) => (r.is_bookable ? "1" : "0")],
              ])
            }
          >
            Export
          </V2Button>
          </div>
        }
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
          {rows.map((r) => {
            const companyName = r.company?.name ?? `#${r.company_id}`;
            const initials = getInitials(companyName);
            const tone = pickAvatarTone(r.company_id);
            return (
              <TR key={r.id}>
                <TD className="tabular-nums text-fg-t7 font-mono text-xs">#{r.id}</TD>
                <TD className="font-medium text-fg-t8">{r.package_title}</TD>
                <TD>
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                  >
                    {r.package_type}
                  </span>
                </TD>
                <TD>
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={packageStatusStyle(r.status)}
                  >
                    {r.status}
                  </span>
                </TD>
                <TD>
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={avatarStyle(tone)}
                      aria-hidden
                    >
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-fg-t8 truncate">{companyName}</div>
                    </div>
                  </div>
                </TD>
                <TD className="text-xs tabular-nums">
                  <span className="inline-flex items-center gap-1.5 text-[12px]">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: r.is_public ? "var(--admin-success)" : "var(--admin-text-tertiary)" }}
                    />
                    {r.is_public ? t("admin.packages.yes") : t("admin.packages.no")}
                  </span>
                  <span className="mx-1 text-fg-t6">/</span>
                  <span className="inline-flex items-center gap-1.5 text-[12px]">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: r.is_bookable ? "var(--admin-success)" : "var(--admin-text-tertiary)" }}
                    />
                    {r.is_bookable ? t("admin.packages.yes") : t("admin.packages.no")}
                  </span>
                </TD>
                <TD align="right">
                  <div className="flex flex-wrap justify-end gap-2">
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
            );
          })}
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

function getInitials(name: string): string {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function pickAvatarTone(id: number | string): "purple" | "teal" | "amber" | "blue" {
  const tones: Array<"purple" | "teal" | "amber" | "blue"> = ["purple", "teal", "amber", "blue"];
  const n = typeof id === "number" ? id : id.length;
  return tones[n % tones.length]!;
}

function avatarStyle(tone: "purple" | "teal" | "amber" | "blue"): React.CSSProperties {
  const map: Record<"purple" | "teal" | "amber" | "blue", React.CSSProperties> = {
    purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
    teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  };
  return map[tone];
}

function packageStatusStyle(status: string): React.CSSProperties {
  switch (status) {
    case "active":
    case "published":
      return { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" };
    case "draft":
    case "pending":
      return { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" };
    case "inactive":
    case "deactivated":
    case "archived":
      return { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" };
    default:
      return { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" };
  }
}
