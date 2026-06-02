"use client";

/**
 * v2 admin-redesign — Invoices list page (Finance group).
 *
 * Source spec: docs/admin_designe/finance_group_mocks.html (PAGE 2 INVOICES)
 * Migration prompt: docs/admin_designe/finance_group_implementation_prompt.md §3.B
 *
 * Chrome:
 *   - V2PageHeader + breadcrumb + Export + New invoice
 *   - FinanceSectionTabs
 *   - 4 plain stat cards (Total / Paid / Issued / Overdue)
 *   - FilterCard + active filter chips
 *   - V2Card wrapping table with bulk-select checkbox
 *   - Status badges with icons (check, clock, alert-circle, edit, ban)
 *   - Company column with avatar + name
 *   - Due date in danger color when overdue
 *   - IconButton row for actions (View / Issue / Mark paid / Send reminder / More)
 *   - Pagination inside V2Card
 */

import Link from "next/link";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessFinanceSection } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiInvoices, apiIssueInvoice, apiCancelInvoice, apiPayInvoice, apiSendInvoiceReminder, downloadInvoicesCsv, type InvoiceRow } from "@/lib/invoices-api";
import { apiInvoicesStats, type InvoicesStats } from "@/lib/finance-stats-api";
import { formatMoney } from "@/lib/format";
import {
  STATUS_BADGE_CLASS,
  avatarInitials,
  avatarStyle,
  formatRelativeTime,
  pickAvatarTone,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  AlertCircle,
  Edit3,
  Ban,
  Download,
  RefreshCw,
  Plus,
  Eye,
  Send,
  Mail,
  MoreVertical,
  XCircle,
  X as XIcon,
  FileText,
  CircleCheck,
  Clock as ClockIcon2,
  AlertCircle as AlertCircle2,
} from "lucide-react";
import { Pagination } from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  StatCard,
  StatGrid,
  IconButton,
} from "@/components/ui/v2";
import { FinanceSectionTabs } from "@/components/finance/FinanceSectionTabs";

const STATUSES = ["", "draft", "issued", "paid", "cancelled", "overdue"] as const;

type InvoiceStatusMeta = { tone: StatusTone; label: string; icon: React.ReactNode };

const STATUS_META: Record<string, InvoiceStatusMeta> = {
  paid: { tone: "success", label: "Paid", icon: <Check className="h-3 w-3" /> },
  issued: { tone: "warning", label: "Issued", icon: <Clock className="h-3 w-3" /> },
  overdue: { tone: "danger", label: "Overdue", icon: <AlertCircle className="h-3 w-3" /> },
  draft: { tone: "gray", label: "Draft", icon: <Edit3 className="h-3 w-3" /> },
  cancelled: { tone: "gray", label: "Cancelled", icon: <Ban className="h-3 w-3" /> },
};

function dueLabel(due: string | null | undefined, status: string): { text: string; tone: "default" | "warning" | "danger" } {
  if (!due) return { text: "—", tone: "default" };
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return { text: "—", tone: "default" };
  const diffMs = d.getTime() - Date.now();
  const days = Math.round(diffMs / 86_400_000);
  if (status === "overdue" || (days < 0 && status !== "paid" && status !== "cancelled")) {
    const lateDays = Math.abs(days);
    return { text: `${lateDays} day${lateDays === 1 ? "" : "s"} late`, tone: "danger" };
  }
  if (days >= 0 && days <= 5 && status === "issued") return { text: `In ${days} day${days === 1 ? "" : "s"}`, tone: "warning" };
  return { text: d.toLocaleDateString(), tone: "default" };
}

export default function PlatformInvoicesPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessFinanceSection(user);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<InvoicesStats | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, statusFilter, fromDate, toDate, t]);

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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiInvoicesStats(token, "30d")
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  async function handleIssue(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.invoices.confirm_issue" });
    if (!ok) return;
    setBusyId(id);
    try {
      await apiIssueInvoice(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.invoices.err_generic"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.invoices.confirm_cancel", variant: "danger" });
    if (!ok) return;
    setBusyId(id);
    try {
      await apiCancelInvoice(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.invoices.err_generic"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkPaid(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.invoices.confirm_mark_paid" });
    if (!ok) return;
    setBusyId(id);
    try {
      await apiPayInvoice(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.invoices.err_generic"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSendReminder(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.invoices.confirm_send_reminder" });
    if (!ok) return;
    setBusyId(id);
    try {
      const res = await apiSendInvoiceReminder(token, id);
      alert(res.data.message || "Reminder sent.");
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : t("admin.invoices.err_generic");
      alert(msg);
    } finally {
      setBusyId(null);
    }
  }

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (statusFilter)
      chips.push({
        key: "status",
        label: `Status: ${STATUS_META[statusFilter]?.label ?? statusFilter}`,
        clear: () => {
          setPage(1);
          setStatusFilter("");
        },
      });
    if (fromDate || toDate) {
      const label = fromDate && toDate ? `${fromDate} → ${toDate}` : fromDate ? `From ${fromDate}` : `Until ${toDate}`;
      chips.push({
        key: "date",
        label,
        clear: () => {
          setPage(1);
          setFromDate("");
          setToDate("");
        },
      });
    }
    if (search.trim())
      chips.push({
        key: "search",
        label: `“${search.trim()}”`,
        clear: () => {
          setPage(1);
          setSearch("");
        },
      });
    return chips;
  }, [statusFilter, fromDate, toDate, search]);

  function clearAllFilters() {
    setPage(1);
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setSearch("");
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

  const filteredRows = search.trim()
    ? rows.filter((r) => {
        const q = search.trim().toLowerCase();
        return (
          String(r.id).includes(q) ||
          r.invoice_number?.toLowerCase().includes(q) ||
          r.company?.name?.toLowerCase().includes(q)
        );
      })
    : rows;

  function toggleRow(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filteredRows.map((r) => r.id)));
  }

  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.id));

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Finance", href: "/platform/finance-summary" },
          { label: t("admin.invoices.title") },
        ]}
        title={t("admin.invoices.title")}
        subtitle={
          t("admin.invoices.subtitle") !== "admin.invoices.subtitle"
            ? t("admin.invoices.subtitle")
            : "Platform invoices with status tracking and CSV export"
        }
        actions={
          <>
            <V2Button onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh">
              {""}
            </V2Button>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              {exporting ? t("admin.invoices.exporting") : t("admin.invoices.btn_export_csv")}
            </V2Button>
            <V2Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              New invoice
            </V2Button>
          </>
        }
      />

      <FinanceSectionTabs activeHref="/platform/invoices" counts={{ invoices: meta?.total }} />

      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<FileText style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.total_count.toLocaleString() : "—"}
          label="Total invoices (30d)"
        />
        <StatCard
          icon={<CircleCheck style={{ color: "var(--admin-success)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.paid_count.toLocaleString() : "—"}
          label="Paid"
          footer={stats ? `${stats.paid_pct.toFixed(0)}% of total` : undefined}
        />
        <StatCard
          icon={<ClockIcon2 style={{ color: "var(--admin-warning)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.issued_pending_count.toLocaleString() : "—"}
          label="Issued (pending)"
        />
        <StatCard
          icon={<AlertCircle2 style={{ color: "var(--admin-danger)" }} className="h-[22px] w-[22px]" />}
          value={stats ? formatMoney(stats.overdue_amount, lang) : "—"}
          label="Overdue total"
          footer={stats && stats.overdue_count > 0 ? `${stats.overdue_count} overdue` : undefined}
        />
      </StatGrid>

      <FilterCard>
        <FilterField label={t("admin.approvals.filter_status")}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? STATUS_META[s]?.label ?? s : t("common.all")}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label={t("admin.invoices.filter_from")}>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setPage(1);
              setFromDate(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <FilterField label={t("admin.invoices.filter_to")}>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setPage(1);
              setToDate(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <FilterField label="Search" minWidth={240}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Invoice number, company..."
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <V2Button variant="primary" onClick={() => void load()}>
          Apply
        </V2Button>
        {activeChips.length > 0 ? <V2Button onClick={clearAllFilters}>Clear</V2Button> : null}
      </FilterCard>

      {activeChips.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium" style={{ color: "var(--admin-text-secondary)" }}>
            Active filters:
          </span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium transition hover:opacity-80"
              style={{
                backgroundColor: "var(--admin-primary-soft)",
                borderColor: "var(--admin-primary-light)",
                color: "var(--admin-primary)",
              }}
            >
              {chip.label}
              <XIcon className="h-3 w-3 opacity-70" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium opacity-80 hover:opacity-100"
            style={{ color: "var(--admin-text-secondary)" }}
          >
            <XCircle className="h-3 w-3" />
            Clear all
          </button>
        </div>
      ) : null}

      {err ? (
        <div
          className="mb-4 rounded-md border px-4 py-2 text-sm"
          style={{
            borderColor: "var(--admin-danger-light)",
            backgroundColor: "var(--admin-danger-light)",
            color: "var(--admin-danger-dark)",
          }}
        >
          {err}
        </div>
      ) : null}

      <V2Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead
              className="text-[11px] font-semibold uppercase tracking-[0.5px]"
              style={{ backgroundColor: "var(--admin-bg-secondary)", color: "var(--admin-text-secondary)" }}
            >
              <tr>
                <th className="px-4 py-2.5 text-left" style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-2.5 text-left">{t("admin.invoices.col_id")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.invoices.col_invoice_number")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.invoices.col_status")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.invoices.col_amount")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.invoices.col_company")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.invoices.col_issued")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.invoices.col_due")}</th>
                <th className="px-4 py-2.5 text-right">{t("admin.invoices.col_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    {loading ? "Loading…" : t("admin.invoices.empty")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const statusMeta = STATUS_META[r.status] ?? STATUS_META.draft!;
                  const due = dueLabel(r.due_date, r.status);
                  const tone = pickAvatarTone(r.company?.id ?? r.id);
                  return (
                    <tr
                      key={r.id}
                      className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleRow(r.id)}
                          aria-label={`Select invoice ${r.id}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-fg-t7">#{r.id}</td>
                      <td className="px-4 py-3 font-mono text-[12px]">
                        <Link
                          href={`/platform/invoices?focus=${r.id}`}
                          className="hover:opacity-80"
                          style={{ color: "var(--admin-primary)" }}
                        >
                          {r.invoice_number ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusMeta.tone)}>
                          {statusMeta.icon}
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-fg-t8 tabular-nums">
                        {formatMoney(r.total_amount, lang, r.currency)}
                      </td>
                      <td className="px-4 py-3">
                        {r.company?.name ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                              style={avatarStyle(tone)}
                            >
                              {avatarInitials(r.company.name)}
                            </span>
                            <span className="text-fg-t8">{r.company.name}</span>
                          </div>
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {formatRelativeTime(r.issued_at)}
                      </td>
                      <td
                        className="px-4 py-3 text-[12px]"
                        style={{
                          color:
                            due.tone === "danger"
                              ? "var(--admin-danger)"
                              : due.tone === "warning"
                              ? "var(--admin-warning-dark)"
                              : "var(--admin-text-secondary)",
                          fontWeight: due.tone === "default" ? 400 : 500,
                        }}
                      >
                        {due.text}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton aria-label="View">
                            <Eye />
                          </IconButton>
                          {r.status === "draft" ? (
                            <IconButton
                              aria-label="Issue"
                              onClick={() => void handleIssue(r.id)}
                              disabled={busyId === r.id}
                            >
                              <Send />
                            </IconButton>
                          ) : null}
                          {r.status === "issued" ? (
                            <IconButton
                              aria-label="Mark paid"
                              onClick={() => void handleMarkPaid(r.id)}
                              disabled={busyId === r.id}
                            >
                              <Check />
                            </IconButton>
                          ) : null}
                          {r.status === "overdue" || r.status === "issued" ? (
                            <IconButton
                              aria-label="Send reminder"
                              onClick={() => void handleSendReminder(r.id)}
                              disabled={busyId === r.id}
                            >
                              <Mail />
                            </IconButton>
                          ) : null}
                          {(r.status === "draft" || r.status === "issued") ? (
                            <IconButton
                              aria-label={t("common.cancel")}
                              onClick={() => void handleCancel(r.id)}
                              disabled={busyId === r.id}
                            >
                              <Ban />
                            </IconButton>
                          ) : null}
                          <IconButton aria-label="More">
                            <MoreVertical />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {meta && meta.last_page > 1 ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 text-[12px]"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}
          >
            <span>
              Showing {(meta.current_page - 1) * meta.per_page + 1}–
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} invoices
            </span>
            <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
          </div>
        ) : null}
      </V2Card>
    </div>
  );
}
