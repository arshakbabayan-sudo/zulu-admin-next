"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiCompanyApplications, type CompanyApplicationRow } from "@/lib/platform-admin-api";
import { exportRowsAsCsv } from "@/lib/export-csv";
import { useCallback, useEffect, useState } from "react";
import {
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
import { Download, Eye, Plus } from "lucide-react";

export default function CompanyApplicationsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<CompanyApplicationRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiCompanyApplications(token, {
        page,
        status: statusFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.company_applications.err_load"));
    }
  }, [token, allowed, page, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.company_applications.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Marketplace ops Company applications page chrome. */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.company_applications.title") },
        ]}
        title={t("admin.company_applications.title")}
        actions={
          <>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              disabled={rows.length === 0}
              onClick={() =>
                exportRowsAsCsv("company-applications", rows, [
                  ["id", (r) => r.id],
                  ["company_name", (r) => r.company_name],
                  ["company_type", (r) => r.company_type ?? ""],
                  ["business_email", (r) => r.business_email],
                  ["country", (r) => r.country ?? ""],
                  ["city", (r) => r.city ?? ""],
                  ["phone", (r) => r.phone ?? ""],
                  ["tax_id", (r) => r.tax_id ?? ""],
                  ["contact_person", (r) => r.contact_person ?? ""],
                  ["applicant_email", (r) => r.user?.email ?? ""],
                  ["intended_role", (r) => r.user?.intended_role ?? ""],
                ])
              }
            >
              Export
            </V2Button>
            <V2Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              New application
            </V2Button>
          </>
        }
      />

      <SectionTabs
        activeHref="/platform/companies"
        items={[
          { href: "/platform/approvals", label: "Approval queue" },
          { href: "/platform/companies", label: "Companies access", count: meta?.total },
          { href: "/platform/seller-applications", label: "Seller applications" },
          { href: "/platform/contracts", label: "Partnership agreements" },
          { href: "/platform/contract-templates", label: "Contract templates" },
          { href: "/platform/users", label: "Users" },
          { href: "/platform/audit-logs", label: "Audit logs" },
          { href: "/bucket3/service-logs", label: "Service logs" },
        ]}
      />

      <FilterCard>
        <FilterField label={t("admin.approvals.filter_status")}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-2 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">{t("common.all")}</option>
            <option value="pending">{t("admin.approvals.status_pending")}</option>
            <option value="under_review">{t("admin.approvals.status_under_review")}</option>
            <option value="approved">{t("admin.approvals.status_approved")}</option>
            <option value="rejected">{t("admin.approvals.status_rejected")}</option>
          </select>
        </FilterField>
      </FilterCard>
      {err && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}
      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.company_applications.col_id")}</TH>
            <TH>{t("admin.company_applications.col_company")}</TH>
            <TH>Role</TH>
            <TH>{t("admin.company_applications.col_email")}</TH>
            <TH>{t("admin.company_applications.col_status")}</TH>
            <TH>{t("admin.company_applications.col_submitted")}</TH>
            <TH align="right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={7}>{t("admin.company_applications.empty") || "No applications."}</TEmpty>
          ) : null}
          {rows.map((r) => {
            // Prefer the intended_role set at /register (Phase-8 onwards);
            // fall back to the application's own company_type when the
            // pre-registration user link isn't present.
            const role = r.user?.intended_role ?? r.company_type ?? null;
            const roleLabel = role === "agent" ? "Tour agent" : role === "operator" ? "Tour operator" : "—";
            const initials = getInitials(r.company_name);
            const tone = pickAvatarTone(r.id);
            return (
              <TR key={r.id}>
                <TD className="tabular-nums font-mono text-xs text-fg-t7">APP-{String(r.id).padStart(3, "0")}</TD>
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
                      <div className="font-medium text-fg-t8 truncate">{r.company_name}</div>
                      {r.user?.name ? (
                        <div className="text-[11px] text-fg-t6 truncate">{r.user.name}</div>
                      ) : null}
                    </div>
                  </div>
                </TD>
                <TD>
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={roleBadgeStyle(role)}
                  >
                    {roleLabel}
                  </span>
                </TD>
                <TD className="text-xs">{r.business_email}</TD>
                <TD>
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={statusBadgeStyle(r.status)}
                  >
                    {r.status}
                  </span>
                </TD>
                <TD className="text-xs text-fg-t6" title={r.submitted_at ?? undefined}>
                  {formatRelativeTime(r.submitted_at)}
                </TD>
                <TD align="right">
                  <div className="flex justify-end gap-1">
                    <IconButton
                      as="link"
                      href={`/platform/company-applications/${r.id}`}
                      aria-label={t("admin.company_applications.btn_open")}
                    >
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
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}

// v2 admin-redesign helpers — avatar / badge / relative-time.
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

function statusBadgeStyle(status: string): React.CSSProperties {
  switch (status) {
    case "approved":
    case "active":
    case "published":
      return { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" };
    case "pending":
    case "under_review":
    case "draft":
      return { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" };
    case "rejected":
    case "expired":
    case "archived":
      return { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" };
    default:
      return { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" };
  }
}

function roleBadgeStyle(role: string | null | undefined): React.CSSProperties {
  if (role === "agent") {
    return { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" };
  }
  if (role === "operator") {
    return { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" };
  }
  return { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" };
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
