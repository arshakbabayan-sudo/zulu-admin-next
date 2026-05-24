"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiInvoices, apiIssueInvoice, apiCancelInvoice, downloadInvoicesCsv, type InvoiceRow } from "@/lib/invoices-api";
import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
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
} from "@/components/ui/v2";

const STATUSES = ["", "draft", "issued", "paid", "cancelled", "overdue"];

export default function PlatformInvoicesPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  // Phase 7.6 — date range filters (ISO YYYY-MM-DD)
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiInvoices(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.invoices.err_load"));
    }
  }, [token, allowed, page, statusFilter, fromDate, toDate, t]);

  // Phase 7.6 — CSV export with same filters
  async function handleExport() {
    if (!token) return;
    setExporting(true);
    try {
      await downloadInvoicesCsv(token, {
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : t("admin.invoices.err_export"));
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => { load(); }, [load]);

  async function handleIssue(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.invoices.confirm_issue" });
    if (!ok) return;
    setBusyId(id);
    try { await apiIssueInvoice(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : t("admin.invoices.err_generic")); }
    finally { setBusyId(null); }
  }

  async function handleCancel(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.invoices.confirm_cancel", variant: "danger" });
    if (!ok) return;
    setBusyId(id);
    try { await apiCancelInvoice(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : t("admin.invoices.err_generic")); }
    finally { setBusyId(null); }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.invoices.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Invoices page chrome (Finance section). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Finance", href: "/platform/finance-summary" },
          { label: t("admin.invoices.title") },
        ]}
        title={t("admin.invoices.title")}
        actions={
          <V2Button
            icon={<Download className="h-4 w-4" />}
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            {exporting ? t("admin.invoices.exporting") : t("admin.invoices.btn_export_csv")}
          </V2Button>
        }
      />

      <SectionTabs
        activeHref="/platform/invoices"
        items={[
          { href: "/platform/finance-summary", label: "Summary" },
          { href: "/platform/invoices", label: "Invoices", count: meta?.total },
          { href: "/platform/payments", label: "Payments" },
          { href: "/platform/commissions", label: "Commissions ledger" },
          { href: "/platform/finance", label: "Transactions" },
          { href: "/platform/vouchers", label: "Vouchers" },
        ]}
      />

      <FilterCard>
        <FilterField label={t("admin.approvals.filter_status")}>
          <Select
            id="inv-status"
            fieldSize="sm"
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="!h-[34px]"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s || t("common.all")}</option>)}
          </Select>
        </FilterField>
        <FilterField label={t("admin.invoices.filter_from")}>
          <input
            id="inv-from"
            type="date"
            value={fromDate}
            onChange={(e) => { setPage(1); setFromDate(e.target.value); }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <FilterField label={t("admin.invoices.filter_to")}>
          <input
            id="inv-to"
            type="date"
            value={toDate}
            onChange={(e) => { setPage(1); setToDate(e.target.value); }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        {(statusFilter || fromDate || toDate) && (
          <V2Button
            size="sm"
            onClick={() => {
              setPage(1);
              setStatusFilter("");
              setFromDate("");
              setToDate("");
            }}
          >
            {t("admin.invoices.btn_clear_filters")}
          </V2Button>
        )}
        <V2Button size="sm" onClick={load}>{t("admin.finance_summary.btn_refresh")}</V2Button>
      </FilterCard>

      {err && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.invoices.col_id")}</TH>
            <TH>{t("admin.invoices.col_invoice_number")}</TH>
            <TH>{t("admin.invoices.col_status")}</TH>
            <TH>{t("admin.invoices.col_amount")}</TH>
            <TH>{t("admin.invoices.col_company")}</TH>
            <TH>{t("admin.invoices.col_issued")}</TH>
            <TH>{t("admin.invoices.col_due")}</TH>
            <TH>{t("admin.invoices.col_actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={8}>{t("admin.invoices.empty")}</TEmpty> : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums font-mono text-xs text-fg-t7">#{r.id}</TD>
              <TD className="font-mono text-xs font-semibold text-fg-t8">{r.invoice_number ?? "—"}</TD>
              <TD>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={invoiceStatusBadgeStyle(r.status)}
                >
                  {r.status}
                </span>
              </TD>
              <TD className="tabular-nums font-medium text-fg-t8">
                {r.currency} {Number(r.total_amount).toFixed(2)}
              </TD>
              <TD className="text-fg-t8">{r.company?.name ?? "—"}</TD>
              <TD className="text-xs text-fg-t6">{formatRelativeTime(r.issued_at)}</TD>
              <TD className="text-xs text-fg-t6">{formatRelativeTime(r.due_date)}</TD>
              <TD>
                <div className="flex flex-wrap gap-2">
                  {r.status === "draft" && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void handleIssue(r.id)}
                      className="inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition disabled:opacity-40"
                      style={{
                        color: "var(--admin-info-dark)",
                        borderColor: "var(--admin-info-light)",
                        backgroundColor: "transparent",
                      }}
                    >
                      {t("admin.invoices.btn_issue")}
                    </button>
                  )}
                  {(r.status === "draft" || r.status === "issued") && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void handleCancel(r.id)}
                      className="inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition disabled:opacity-40"
                      style={{
                        color: "var(--admin-danger)",
                        borderColor: "var(--admin-danger-light)",
                        backgroundColor: "transparent",
                      }}
                    >
                      {t("common.cancel")}
                    </button>
                  )}
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      </V2Card>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
    </div>
  );
}

// v2 admin-redesign helpers — colored status pill + relative time.
function invoiceStatusBadgeStyle(status: string): React.CSSProperties {
  switch (status) {
    case "paid":
      return { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" };
    case "cancelled":
      return { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" };
    case "overdue":
      return { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" };
    case "issued":
      return { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" };
    case "draft":
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
