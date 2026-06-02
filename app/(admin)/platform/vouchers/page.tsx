"use client";

/**
 * v2 admin-redesign — Vouchers list + detail drawer (Finance group).
 *
 * Source spec: docs/admin_designe/finance_group_mocks.html (PAGE 6 VOUCHERS)
 * Migration prompt: docs/admin_designe/finance_group_implementation_prompt.md §3.E
 *
 * Chrome:
 *   - V2PageHeader + breadcrumb + Export + Issue voucher
 *   - FinanceSectionTabs
 *   - 4 plain stat cards (Total / Active / Verifications / Voided)
 *   - FilterCard + active filter chips
 *   - V2Card wrapping table
 *   - Status badges with Tabler-style icons
 *   - Avatar + holder name
 *   - IconButton row (View / More)
 *   - Right-side detail drawer (Variant B) with sections:
 *       Holder information, Voucher details, Verification log table, Files
 *     Drawer footer: Close · Void (danger) · Reissue (primary) — visible per status
 *   - ESC closes drawer; click overlay closes drawer
 */

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { canAccessFinanceSection } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiListVouchers,
  apiVoucherDetail,
  apiVoidVoucher,
  apiReissueVoucher,
} from "@/lib/vouchers-api";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDate, formatDateTime } from "@/lib/format";
import { apiVouchersStats, type VouchersStats } from "@/lib/finance-stats-api";
import {
  STATUS_BADGE_CLASS,
  avatarInitials,
  avatarStyle,
  formatRelativeTime,
  pickAvatarTone,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
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
import {
  Download,
  Eye,
  Plus,
  MoreVertical,
  X as XIcon,
  Check,
  Eye as EyeIcon,
  Ban,
  RotateCcw,
  Clock as ClockOff,
  Ticket,
  CircleCheck,
  ScanEye as EyeCheck,
  Ban as BanIcon2,
  FileDown,
  XCircle,
} from "lucide-react";
import { FinanceSectionTabs } from "@/components/finance/FinanceSectionTabs";
import { exportRowsAsCsv } from "@/lib/export-csv";
import { FinanceQuickActionDrawer, type QuickActionMode } from "@/components/finance/FinanceQuickActionDrawer";

const STATUSES = ["issued", "used", "void", "reissued", "expired"] as const;
const SERVICE_TYPES = ["flight", "hotel", "transfer", "car", "excursion", "visa", "insurance", "package"] as const;

type VoucherRow = {
  id: number;
  voucher_number: string;
  order_id: number | null;
  service_type: string;
  status: string;
  holder_name: string;
  language: string;
  valid_from: string | null;
  valid_to: string | null;
  used_at: string | null;
  verification_count: number;
  pdf_url: string | null;
  qr_image_url: string | null;
  reissued_from_id: number | null;
  created_at: string;
  order?: { id: number; order_number: string; user_id: number };
  issuer_company?: { id: number; name: string };
};

type VerificationLog = {
  id: number;
  scanned_at: string;
  scanner_ip: string | null;
  result: string;
};

type Meta = { total: number; per_page: number; current_page: number; last_page: number };

const VOUCHER_STATUS_META: Record<string, { tone: StatusTone; label: string; icon: React.ReactNode }> = {
  issued: { tone: "success", label: "Issued", icon: <Check className="h-3 w-3" /> },
  used: { tone: "info", label: "Used", icon: <EyeIcon className="h-3 w-3" /> },
  void: { tone: "gray", label: "Void", icon: <Ban className="h-3 w-3" /> },
  reissued: { tone: "warning", label: "Reissued", icon: <RotateCcw className="h-3 w-3" /> },
  expired: { tone: "danger", label: "Expired", icon: <ClockOff className="h-3 w-3" /> },
};

export default function PlatformVouchersPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessFinanceSection(user);

  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);

  const [status, setStatus] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [q, setQ] = useState("");
  const [appliedFilters, setAppliedFilters] = useState(0);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<VoucherRow | null>(null);
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<VouchersStats | null>(null);
  const [quickMode, setQuickMode] = useState<QuickActionMode | null>(null);

  useEffect(() => {
    if (!allowed || !token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setForbidden(false);

    void (async () => {
      try {
        const res = await apiListVouchers(token, {
          page,
          per_page: 25,
          status: status || undefined,
          service_type: serviceType || undefined,
          q: q.trim() || undefined,
        });
        if (cancelled) return;
        setRows(res.data ?? []);
        setMeta((res.meta as unknown as Meta) ?? null);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) {
          setForbidden(true);
        } else if (e instanceof ApiRequestError && (e.status === 404 || /not found/i.test(e.message))) {
          setRows([]);
          setMeta(null);
        } else {
          setError(e instanceof Error ? e.message : t("admin.platform_vouchers.err_load"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, allowed, page, appliedFilters, status, serviceType, q, t]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiVouchersStats(token, "30d")
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  // ESC closes drawer
  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  const resetFilters = () => {
    setStatus("");
    setServiceType("");
    setQ("");
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  const openDetail = async (row: VoucherRow) => {
    if (!token) return;
    setSelected(row);
    setLogs([]);
    setDetailLoading(true);
    try {
      const res = await apiVoucherDetail(token, row.id);
      setSelected(res.data.voucher as unknown as VoucherRow);
      setLogs((res.data.verification_logs as unknown as VerificationLog[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.platform_vouchers.err_load_detail"));
    } finally {
      setDetailLoading(false);
    }
  };

  const voidVoucher = async (id: number) => {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.platform_vouchers.confirm_void", variant: "danger" });
    if (!ok) return;
    setActionLoading("void");
    try {
      const res = await apiVoidVoucher(token, id);
      setSelected(res.data as unknown as VoucherRow);
      setAppliedFilters((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.platform_vouchers.err_void"));
    } finally {
      setActionLoading(null);
    }
  };

  const reissueVoucher = async (id: number) => {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.platform_vouchers.confirm_reissue" });
    if (!ok) return;
    setActionLoading("reissue");
    try {
      const res = await apiReissueVoucher(token, id);
      setSelected(res.data as unknown as VoucherRow);
      setAppliedFilters((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.platform_vouchers.err_reissue"));
    } finally {
      setActionLoading(null);
    }
  };

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.platform_vouchers.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (status)
    activeChips.push({
      key: "status",
      label: `Status: ${VOUCHER_STATUS_META[status]?.label ?? status}`,
      clear: () => {
        setStatus("");
        applyFilters();
      },
    });
  if (serviceType)
    activeChips.push({
      key: "service",
      label: `Service: ${serviceType}`,
      clear: () => {
        setServiceType("");
        applyFilters();
      },
    });
  if (q.trim())
    activeChips.push({
      key: "search",
      label: `“${q.trim()}”`,
      clear: () => {
        setQ("");
        applyFilters();
      },
    });

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Finance", href: "/platform/finance-summary" },
          { label: t("admin.platform_vouchers.title") },
        ]}
        title={t("admin.platform_vouchers.title")}
        subtitle={
          t("admin.platform_vouchers.subtitle") !== "admin.platform_vouchers.subtitle"
            ? t("admin.platform_vouchers.subtitle")
            : "Issue and manage service vouchers with verification logs"
        }
        actions={
          <>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              disabled={rows.length === 0}
              onClick={() =>
                exportRowsAsCsv("vouchers", rows, [
                  ["id", (r) => r.id],
                  ["voucher_number", (r) => r.voucher_number],
                  ["order_id", (r) => r.order_id ?? ""],
                  ["service_type", (r) => r.service_type],
                  ["status", (r) => r.status],
                  ["holder_name", (r) => r.holder_name],
                  ["language", (r) => r.language],
                  ["valid_from", (r) => r.valid_from ?? ""],
                ])
              }
            >
              Export CSV
            </V2Button>
            <V2Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setQuickMode("issue-voucher")}>
              Issue voucher
            </V2Button>
          </>
        }
      />

      <FinanceSectionTabs activeHref="/platform/vouchers" counts={{ vouchers: meta?.total }} />

      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<Ticket style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.total_count.toLocaleString() : meta?.total ?? "—"}
          label="Total vouchers (30d)"
        />
        <StatCard
          icon={<CircleCheck style={{ color: "var(--admin-success)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.active_issued_count.toLocaleString() : "—"}
          label="Active (issued)"
        />
        <StatCard
          icon={<EyeCheck style={{ color: "var(--admin-info)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.verifications_7d.toLocaleString() : "—"}
          label="Verifications (7d)"
        />
        <StatCard
          icon={<BanIcon2 style={{ color: "var(--admin-danger)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.voided_count.toLocaleString() : "—"}
          label="Voided"
        />
      </StatGrid>

      {error ? (
        <div
          className="mb-4 rounded-md border px-4 py-2 text-sm"
          style={{
            borderColor: "var(--admin-danger-light)",
            backgroundColor: "var(--admin-danger-light)",
            color: "var(--admin-danger-dark)",
          }}
        >
          {error}
        </div>
      ) : null}

      <FilterCard>
        <FilterField label={t("admin.platform_vouchers.status")}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">{t("common.all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {VOUCHER_STATUS_META[s]?.label ?? s}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label={t("admin.platform_vouchers.service_type")}>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">{t("common.all")}</option>
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label={t("common.search")} minWidth={240}>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("admin.platform_vouchers.search_placeholder")}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <V2Button variant="primary" onClick={applyFilters}>
          {t("common.apply")}
        </V2Button>
        {activeChips.length > 0 ? <V2Button onClick={resetFilters}>{t("common.reset")}</V2Button> : null}
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
            onClick={resetFilters}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium opacity-80 hover:opacity-100"
            style={{ color: "var(--admin-text-secondary)" }}
          >
            <XCircle className="h-3 w-3" />
            Clear all
          </button>
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
                <th className="px-4 py-2.5 text-left">{t("admin.platform_vouchers.number")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.platform_vouchers.service")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.platform_vouchers.holder")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.platform_vouchers.status")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.platform_vouchers.valid")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.platform_vouchers.scans")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.platform_vouchers.created")}</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    {t("admin.platform_vouchers.loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    {t("admin.platform_vouchers.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const statusMeta = VOUCHER_STATUS_META[r.status] ?? VOUCHER_STATUS_META.issued!;
                  const tone = pickAvatarTone(r.id);
                  const isSelected = selected?.id === r.id;
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{
                        borderColor: "var(--admin-border)",
                        backgroundColor: isSelected ? "var(--admin-primary-soft)" : undefined,
                      }}
                      onClick={() => void openDetail(r)}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-fg-t8">{r.voucher_number}</td>
                      <td className="px-4 py-3 text-[12px]">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle("gray")}>
                          {r.service_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                            style={avatarStyle(tone)}
                          >
                            {avatarInitials(r.holder_name) || "?"}
                          </span>
                          <span className="text-fg-t8">{r.holder_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusMeta.tone)}>
                          {statusMeta.icon}
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {r.valid_from ? (
                          <>
                            {formatDate(r.valid_from, lang)}
                            {r.valid_to ? ` → ${formatDate(r.valid_to, lang)}` : ""}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-fg-t8 tabular-nums">{r.verification_count}</td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {formatRelativeTime(r.created_at)}
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton aria-label="View" onClick={() => void openDetail(r)}>
                            <Eye />
                          </IconButton>
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
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} vouchers
            </span>
            <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
          </div>
        ) : null}
      </V2Card>

      {/* Detail drawer — Variant B */}
      {selected ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 transition-opacity"
            onClick={() => setSelected(null)}
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col bg-white shadow-2xl"
            style={{ borderLeft: "1px solid var(--admin-border)" }}
            role="dialog"
            aria-label="Voucher details"
          >
            <header className="border-b px-5 py-4" style={{ borderColor: "var(--admin-border)" }}>
              <div className="mb-3 flex items-center justify-between">
                <IconButton aria-label="Close" onClick={() => setSelected(null)}>
                  <XIcon />
                </IconButton>
                <IconButton aria-label="More">
                  <MoreVertical />
                </IconButton>
              </div>
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-[14px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>
                  {selected.voucher_number}
                </span>
                {(() => {
                  const sm = VOUCHER_STATUS_META[selected.status] ?? VOUCHER_STATUS_META.issued!;
                  return (
                    <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(sm.tone)}>
                      {sm.icon}
                      {sm.label}
                    </span>
                  );
                })()}
              </div>
              <div className="text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                {selected.service_type} · {selected.language?.toUpperCase()}
              </div>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <section>
                <h3
                  className="mb-3 text-[11px] font-semibold uppercase tracking-[0.5px]"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  Holder information
                </h3>
                <div className="grid gap-2">
                  <InfoRow label="Name" value={selected.holder_name} />
                  <InfoRow label="Order" value={selected.order?.order_number ?? `#${selected.order_id ?? "—"}`} />
                  <InfoRow label="Language" value={selected.language?.toUpperCase()} />
                </div>
              </section>

              <section>
                <h3
                  className="mb-3 text-[11px] font-semibold uppercase tracking-[0.5px]"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  Voucher details
                </h3>
                <div className="grid gap-2">
                  <InfoRow label="Service" value={selected.service_type} />
                  <InfoRow label="Issuer" value={selected.issuer_company?.name ?? "—"} />
                  <InfoRow
                    label="Valid"
                    value={
                      selected.valid_from
                        ? `${formatDate(selected.valid_from, lang)}${
                            selected.valid_to ? ` → ${formatDate(selected.valid_to, lang)}` : ""
                          }`
                        : "—"
                    }
                  />
                  <InfoRow label="Used at" value={formatDateTime(selected.used_at, lang)} />
                  <InfoRow label="Scan count" value={String(selected.verification_count)} />
                  {selected.reissued_from_id ? (
                    <InfoRow label="Reissued from" value={`#${selected.reissued_from_id}`} />
                  ) : null}
                </div>
              </section>

              <section>
                <h3
                  className="mb-3 text-[11px] font-semibold uppercase tracking-[0.5px]"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  Verification log {logs.length > 0 ? `(${logs.length} scans)` : ""}
                </h3>
                {detailLoading ? (
                  <p className="text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                    {t("admin.platform_vouchers.loading")}
                  </p>
                ) : logs.length === 0 ? (
                  <p className="text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                    {t("admin.platform_vouchers.no_scans")}
                  </p>
                ) : (
                  <div className="rounded-md border overflow-hidden" style={{ borderColor: "var(--admin-border)" }}>
                    <table className="w-full text-[12px]">
                      <thead
                        className="text-[11px] font-semibold uppercase tracking-[0.5px]"
                        style={{
                          backgroundColor: "var(--admin-bg-secondary)",
                          color: "var(--admin-text-secondary)",
                        }}
                      >
                        <tr>
                          <th className="px-3 py-2 text-left">When</th>
                          <th className="px-3 py-2 text-left">IP</th>
                          <th className="px-3 py-2 text-left">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((l) => (
                          <tr key={l.id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                            <td className="px-3 py-2" style={{ color: "var(--admin-text-secondary)" }}>
                              {formatDateTime(l.scanned_at, lang)}
                            </td>
                            <td className="px-3 py-2 font-mono">{l.scanner_ip ?? "—"}</td>
                            <td className="px-3 py-2">
                              <span
                                className={STATUS_BADGE_CLASS}
                                style={statusBadgeStyle(l.result === "valid" ? "success" : "warning")}
                              >
                                {l.result}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h3
                  className="mb-3 text-[11px] font-semibold uppercase tracking-[0.5px]"
                  style={{ color: "var(--admin-text-secondary)" }}
                >
                  Files
                </h3>
                {selected.pdf_url ? (
                  <a
                    href={selected.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-[36px] w-full items-center justify-center gap-1.5 rounded-md border bg-white px-3.5 text-[13px] font-medium transition hover:bg-[color:var(--admin-bg-secondary)]"
                    style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }}
                  >
                    <FileDown className="h-4 w-4" />
                    Download voucher PDF
                  </a>
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                    No PDF available
                  </p>
                )}
              </section>
            </div>

            <footer
              className="flex items-center gap-2 border-t px-5 py-3.5"
              style={{ borderColor: "var(--admin-border)", backgroundColor: "var(--admin-bg-secondary)" }}
            >
              <V2Button onClick={() => setSelected(null)}>Close</V2Button>
              <div className="flex-1" />
              {selected.status === "issued" ? (
                <>
                  <V2Button
                    onClick={() => void voidVoucher(selected.id)}
                    disabled={actionLoading !== null}
                    icon={<Ban className="h-4 w-4" />}
                    className="text-[color:var(--admin-danger)]"
                  >
                    {actionLoading === "void" ? t("admin.platform_vouchers.voiding") : "Void"}
                  </V2Button>
                  <V2Button
                    variant="primary"
                    onClick={() => void reissueVoucher(selected.id)}
                    disabled={actionLoading !== null}
                    icon={<RotateCcw className="h-4 w-4" />}
                  >
                    {actionLoading === "reissue" ? t("admin.platform_vouchers.reissuing") : "Reissue"}
                  </V2Button>
                </>
              ) : null}
            </footer>
          </aside>
        </>
      ) : null}

      <FinanceQuickActionDrawer
        mode={quickMode}
        token={token ?? null}
        onClose={() => setQuickMode(null)}
        onSuccess={(_m, payload) => {
          setQuickMode(null);
          alert(payload.message);
          setAppliedFilters((n) => n + 1);
        }}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="grid grid-cols-[120px_1fr] gap-3 py-1.5"
      style={{ borderBottom: "1px dashed var(--admin-border)" }}
    >
      <span className="text-[12px] font-medium" style={{ color: "var(--admin-text-secondary)" }}>
        {label}
      </span>
      <span className="text-[13px]" style={{ color: "var(--admin-text-primary)" }}>
        {value}
      </span>
    </div>
  );
}
