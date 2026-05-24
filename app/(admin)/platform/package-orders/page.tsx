"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiPlatformPackageOrders, type PlatformPackageOrderRow } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";
import {
  Input,
  Pagination,
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
  IconButton,
} from "@/components/ui/v2";
import { Download, Eye } from "lucide-react";

export default function PlatformPackageOrdersPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformPackageOrderRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [companyIdDraft, setCompanyIdDraft] = useState("");
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformPackageOrders(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        payment_status: paymentStatusFilter || undefined,
        company_id: companyId,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.package_orders.err_load"));
    }
  }, [token, allowed, page, statusFilter, paymentStatusFilter, companyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyCompanyFilter() {
    const raw = companyIdDraft.trim();
    if (!raw) {
      setCompanyId(undefined);
      setPage(1);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setErr(t("admin.package_orders.err_invalid_company"));
      return;
    }
    setErr(null);
    setCompanyId(n);
    setPage(1);
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.package_orders.title_short")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Bookings Package orders page chrome. */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Bookings", href: "/platform/bookings" },
          { label: t("admin.package_orders.title") },
        ]}
        title={t("admin.package_orders.title")}
        actions={
          <V2Button icon={<Download className="h-4 w-4" />}>Export</V2Button>
        }
      />

      <SectionTabs
        activeHref="/platform/package-orders"
        items={[
          { href: "/platform/bookings", label: "All bookings" },
          { href: "/platform/package-orders", label: "Package orders", count: meta?.total },
        ]}
      />

      <FilterCard>
        <FilterField label={t("admin.approvals.filter_status")}>
          <Input
            id="po-status"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            placeholder={t("admin.package_orders.placeholder_status")}
            className="!h-[34px]"
          />
        </FilterField>
        <FilterField label={t("admin.package_orders.filter_payment_status")}>
          <Input
            id="po-pay"
            value={paymentStatusFilter}
            onChange={(e) => {
              setPage(1);
              setPaymentStatusFilter(e.target.value);
            }}
            placeholder={t("admin.package_orders.placeholder_payment_status")}
            className="!h-[34px]"
          />
        </FilterField>
        <FilterField label={t("admin.inventory_hotels.filter_company_id")}>
          <Input
            id="po-co"
            value={companyIdDraft}
            onChange={(e) => setCompanyIdDraft(e.target.value)}
            placeholder={t("admin.package_orders.placeholder_optional")}
            className="!h-[34px] tabular-nums"
          />
        </FilterField>
        <V2Button size="sm" onClick={applyCompanyFilter}>
          {t("admin.package_orders.btn_apply_company")}
        </V2Button>
      </FilterCard>

      {err ? (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      ) : null}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.invoices.col_id")}</TH>
            <TH>{t("admin.package_orders.col_order_number")}</TH>
            <TH>{t("admin.invoices.col_status")}</TH>
            <TH>{t("admin.package_orders.col_payment")}</TH>
            <TH>{t("admin.package_orders.col_total")}</TH>
            <TH>{t("admin.package_orders.col_package")}</TH>
            <TH>{t("admin.invoices.col_company")}</TH>
            <TH>{t("admin.package_orders.col_buyer")}</TH>
            <TH>{t("admin.approvals.col_created")}</TH>
            <TH align="right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={10}>{t("admin.package_orders.empty") || "No package orders."}</TEmpty>
          ) : null}
          {rows.map((r) => {
            const companyName = r.company?.name ?? `#${r.company_id}`;
            const buyerName = r.user?.name ?? `#${r.user_id}`;
            const companyInitials = getInitials(companyName);
            const buyerInitials = getInitials(buyerName);
            const companyTone = pickAvatarTone(r.company_id);
            const buyerTone = pickAvatarTone(r.user_id);
            return (
              <TR key={r.id}>
                <TD className="tabular-nums text-fg-t7 font-mono text-xs">#{r.id}</TD>
                <TD className="font-mono text-xs text-fg-t8">{r.order_number}</TD>
                <TD>
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={orderStatusStyle(r.status)}
                  >
                    {r.status}
                  </span>
                </TD>
                <TD>
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={paymentStatusStyle(r.payment_status)}
                  >
                    {r.payment_status}
                  </span>
                </TD>
                <TD className="tabular-nums font-medium text-fg-t8">
                  {r.final_total_snapshot} {r.currency}
                </TD>
                <TD className="text-xs text-fg-t7">
                  {r.package ? `${r.package.package_title} (#${r.package.id})` : `#${r.package_id}`}
                </TD>
                <TD>
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={avatarStyle(companyTone)}
                      aria-hidden
                    >
                      {companyInitials}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-fg-t8 truncate">{companyName}</div>
                    </div>
                  </div>
                </TD>
                <TD>
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={avatarStyle(buyerTone)}
                      aria-hidden
                    >
                      {buyerInitials}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-fg-t8 truncate">{buyerName}</div>
                    </div>
                  </div>
                </TD>
                <TD className="text-xs text-fg-t6" title={r.created_at ?? undefined}>
                  {formatRelativeTime(r.created_at)}
                </TD>
                <TD align="right">
                  <div className="flex justify-end gap-1">
                    <IconButton as="link" href={`/platform/package-orders/${r.id}`} aria-label="View">
                      <Eye className="h-4 w-4" />
                    </IconButton>
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      </V2Card>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
    </div>
  );
}

// v2 admin-redesign helpers.
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

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function orderStatusStyle(status: string): React.CSSProperties {
  switch (status) {
    case "confirmed":
    case "completed":
    case "fulfilled":
      return { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" };
    case "pending":
    case "partially_confirmed":
    case "in_progress":
      return { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" };
    case "cancelled":
    case "failed":
    case "partially_failed":
      return { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" };
    default:
      return { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" };
  }
}

function paymentStatusStyle(status: string): React.CSSProperties {
  switch (status) {
    case "paid":
    case "captured":
      return { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" };
    case "pending":
    case "authorized":
      return { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" };
    case "failed":
    case "refunded":
    case "voided":
      return { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" };
    default:
      return { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" };
  }
}
