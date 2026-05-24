"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrompt } from "@/contexts/PromptDialogContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiApproveSellerApplication,
  apiRejectSellerApplication,
  apiSellerApplications,
  type SellerApplicationRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";
import {

  Pagination,
  Select,
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

export default function SellerApplicationsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const prompt = usePrompt();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<SellerApplicationRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiSellerApplications(token, {
        page,
        per_page: 20,
        status: statusFilter === "" ? undefined : statusFilter,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.seller_applications.err_load"));
    }
  }, [token, allowed, page, statusFilter, t]);

  useEffect(() => { load(); }, [load]);

  async function approve(id: number) {
    if (!token) return;
    const notes = window.prompt(t("admin.seller_applications.prompt_optional_notes")) ?? "";
    setBusyId(id);
    try {
      await apiApproveSellerApplication(token, id, notes || undefined);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.seller_applications.err_approve"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    if (!token) return;
    // Phase 8.6 — reason is now OPTIONAL via the ZULU PromptModal (the
    // legacy window.prompt + alert+abort flow forced a reason; the user
    // wanted the ability to reject without a reason for low-info cases).
    const rejection_reason = await prompt({
      title: t("admin.seller_applications.prompt_rejection_reason"),
      description: t("admin.seller_applications.reject_reason_optional_hint"),
      placeholder: t("admin.seller_applications.reject_reason_placeholder"),
      variant: "danger",
      confirmLabel: t("admin.seller_applications.btn_reject"),
    });
    if (rejection_reason === null) return; // user cancelled
    setBusyId(id);
    try {
      await apiRejectSellerApplication(token, id, rejection_reason.trim() || "");
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.seller_applications.err_reject"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.seller_applications.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Seller applications page chrome (Marketplace ops). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.seller_applications.title") },
        ]}
        title={t("admin.seller_applications.title")}
        actions={
          <>
            <V2Button icon={<Download className="h-4 w-4" />}>Export</V2Button>
            <V2Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              New application
            </V2Button>
          </>
        }
      />

      <SectionTabs
        activeHref="/platform/seller-applications"
        items={[
          { href: "/platform/approvals", label: "Approval queue" },
          { href: "/platform/companies", label: "Companies access" },
          { href: "/platform/seller-applications", label: "Seller applications", count: meta?.total },
          { href: "/platform/contracts", label: "Partnership agreements" },
          { href: "/platform/contract-templates", label: "Contract templates" },
          { href: "/platform/audit-logs", label: "Audit logs" },
          { href: "/bucket3/service-logs", label: "Service logs" },
          { href: "/bucket3/unverified-accounts", label: "Unverified accounts" },
        ]}
      />

      <FilterCard>
        <FilterField label={t("admin.seller_applications.filter_status")} minWidth={220}>
          <Select
            id="sa-status"
            fieldSize="sm"
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="!h-[34px]"
          >
            <option value="">{t("admin.seller_applications.filter_default_queue")}</option>
            <option value="pending">{t("admin.seller_applications.status_pending")}</option>
            <option value="under_review">{t("admin.seller_applications.status_under_review")}</option>
            <option value="approved">{t("admin.seller_applications.status_approved")}</option>
            <option value="rejected">{t("admin.seller_applications.status_rejected")}</option>
          </Select>
        </FilterField>
      </FilterCard>

      {err && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.seller_applications.col_id")}</TH>
            <TH>{t("admin.seller_applications.col_company")}</TH>
            <TH>{t("admin.seller_applications.col_service")}</TH>
            <TH>{t("admin.seller_applications.col_status")}</TH>
            <TH>{t("admin.seller_applications.col_applied")}</TH>
            <TH align="right">{t("admin.seller_applications.col_actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={6}>{t("admin.seller_applications.empty") || "No applications."}</TEmpty> : null}
          {rows.map((r) => {
            const companyName = r.company_name ?? `Company #${r.company_id}`;
            const initials = getInitials(companyName);
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
                      <div className="font-medium text-fg-t8 truncate">{companyName}</div>
                      <div className="text-[11px] text-fg-t6 truncate">#{r.company_id}</div>
                    </div>
                  </div>
                </TD>
                <TD>
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                  >
                    {r.service_type}
                  </span>
                </TD>
                <TD>
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={statusBadgeStyle(r.status)}
                  >
                    {r.status}
                  </span>
                </TD>
                <TD className="text-xs text-fg-t6" title={r.applied_at ?? undefined}>
                  {formatRelativeTime(r.applied_at)}
                </TD>
                <TD align="right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => approve(r.id)}
                      className="inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition disabled:opacity-40"
                      style={{
                        color: "var(--admin-success)",
                        borderColor: "var(--admin-success-light)",
                        backgroundColor: "transparent",
                      }}
                    >
                      {t("admin.seller_applications.btn_approve")}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => reject(r.id)}
                      className="inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition disabled:opacity-40"
                      style={{
                        color: "var(--admin-danger)",
                        borderColor: "var(--admin-danger-light)",
                        backgroundColor: "transparent",
                      }}
                    >
                      {t("admin.seller_applications.btn_reject")}
                    </button>
                    <IconButton
                      as="link"
                      href={`/platform/companies/${r.company_id}`}
                      aria-label="View company"
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

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
    </div>
  );
}

// v2 admin-redesign helpers — deterministic avatar tones + status pills + relative time.
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
