"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import {
  Button,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";

/**
 * Platform-admin connections oversight (Sprint 57, PART 18).
 *
 * Wires to backend:
 *   GET  /api/platform-admin/connections
 *   GET  /api/platform-admin/connections/stats
 *   GET  /api/platform-admin/connections/{id}
 *   POST /api/platform-admin/connections/{id}/force-terminate
 */

const STATUSES = ["proposed", "active", "paused", "terminated", "rejected"] as const;
const TYPES = ["supplier_reseller", "mutual", "white_label", "partner_feed"] as const;

type ConnectionRow = {
  id: string;
  type: string;
  status: string;
  seller_a_company_id: number;
  seller_b_company_id: number;
  proposed_at: string | null;
  responded_at: string | null;
  terminated_at: string | null;
  termination_reason: string | null;
  seller_a?: { id: number; name: string; type: string };
  seller_b?: { id: number; name: string; type: string };
  proposed_by?: { id: number; name: string; email: string };
  responded_by?: { id: number; name: string; email: string };
  partner_agreement?: unknown;
  commission_override_rule?: unknown;
};

type Stats = {
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
};

export default function PlatformConnectionsPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [appliedFilters, setAppliedFilters] = useState(0);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ConnectionRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");

  const baseURL = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am",
    []
  );

  useEffect(() => {
    if (!allowed || !token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setForbidden(false);

    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("per_page", "50");
        if (status) params.set("status", status);
        if (type) params.set("type", type);
        if (sellerId.trim()) params.set("seller_id", sellerId.trim());

        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        const [listRes, statsRes] = await Promise.all([
          fetch(`${baseURL}/platform-admin/connections?${params.toString()}`, { headers }),
          fetch(`${baseURL}/platform-admin/connections/stats`, { headers }),
        ]);

        if (listRes.status === 403 || statsRes.status === 403) {
          if (!cancelled) setForbidden(true);
          return;
        }

        const listJson = await listRes.json();
        const statsJson = await statsRes.json();
        if (cancelled) return;

        if (listJson?.success) {
          setRows(listJson.data ?? []);
          setLastPage(listJson.last_page ?? 1);
          setTotal(listJson.total ?? 0);
        } else {
          setError(listJson?.message ?? t("admin.platform_connections.err_load"));
        }
        if (statsJson?.success) {
          setStats(statsJson.data);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 403) {
          setForbidden(true);
        } else {
          setError(e instanceof Error ? e.message : t("admin.platform_connections.err_load"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, allowed, baseURL, page, appliedFilters, t]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  const resetFilters = () => {
    setStatus("");
    setType("");
    setSellerId("");
    setPage(1);
    setAppliedFilters((n) => n + 1);
  };

  const openDetail = async (row: ConnectionRow) => {
    setSelected(row);
    setTerminateReason("");
    try {
      const res = await fetch(`${baseURL}/platform-admin/connections/${row.id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await res.json();
      if (json?.success) {
        setSelected(json.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.platform_connections.err_load_detail"));
    }
  };

  const forceTerminate = async () => {
    if (!selected) return;
    if (!terminateReason.trim()) {
      setError(t("admin.platform_connections.err_termination_reason_required"));
      return;
    }
    const ok = await confirm({
      message: t("admin.platform_connections.confirm_force_terminate").replace("{id}", selected.id),
      variant: "danger",
    });
    if (!ok) return;

    setActionLoading(true);
    try {
      const res = await fetch(
        `${baseURL}/platform-admin/connections/${selected.id}/force-terminate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: terminateReason.trim() }),
        }
      );
      const json = await res.json();
      if (json?.success) {
        setSelected(json.data);
        setAppliedFilters((n) => n + 1);
        setTerminateReason("");
      } else {
        setError(json?.message ?? t("admin.platform_connections.err_force_terminate"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.platform_connections.err_force_terminate"));
    } finally {
      setActionLoading(false);
    }
  };

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.platform_connections.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.platform_connections.title")}
        subtitle={t("admin.platform_connections.subtitle")}
      />

      {error && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t("admin.platform_connections.total_connections")}
            value={formatNumber(stats.total, lang)}
          />
          <StatCard
            label={t("admin.platform_connections.status_active")}
            value={String(stats.by_status?.active ?? 0)}
            tone="good"
          />
          <StatCard
            label={t("admin.platform_connections.status_proposed")}
            value={String(stats.by_status?.proposed ?? 0)}
            tone="warn"
          />
          <StatCard
            label={t("admin.platform_connections.status_terminated")}
            value={String(stats.by_status?.terminated ?? 0)}
            tone="neutral"
          />
        </div>
      )}

      <div className="admin-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={t("admin.platform_connections.status")} htmlFor="c-status">
            <Select
              id="c-status"
              fieldSize="sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`admin.platform_connections.status_${s}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("admin.platform_connections.type")} htmlFor="c-type">
            <Select
              id="c-type"
              fieldSize="sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {tt}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label={t("admin.platform_connections.seller_company_id")}
            htmlFor="c-seller"
          >
            <Input
              id="c-seller"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              placeholder={t("admin.platform_connections.seller_placeholder")}
            />
          </FormField>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={resetFilters}>
            {t("common.reset")}
          </Button>
          <Button size="sm" onClick={applyFilters}>
            {t("common.apply")}
          </Button>
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>{t("admin.platform_connections.seller_a")}</TH>
            <TH>{t("admin.platform_connections.seller_b")}</TH>
            <TH>{t("admin.platform_connections.type")}</TH>
            <TH>{t("admin.platform_connections.status")}</TH>
            <TH>{t("admin.platform_connections.proposed_by")}</TH>
            <TH>{t("admin.platform_connections.proposed_at")}</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {loading ? (
            <TEmpty colSpan={7}>{t("admin.platform_connections.loading")}</TEmpty>
          ) : rows.length === 0 ? (
            <TEmpty colSpan={7}>{t("admin.platform_connections.empty")}</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id} onClick={() => openDetail(r)}>
              <TD className="text-xs">
                {r.seller_a?.name ?? `#${r.seller_a_company_id}`}
                {r.seller_a?.type && <div className="text-fg-t6">{r.seller_a.type}</div>}
              </TD>
              <TD className="text-xs">
                {r.seller_b?.name ?? `#${r.seller_b_company_id}`}
                {r.seller_b?.type && <div className="text-fg-t6">{r.seller_b.type}</div>}
              </TD>
              <TD className="text-xs">{r.type}</TD>
              <TD>
                <StatusPill status={r.status}>
                  {t(`admin.platform_connections.status_${r.status}`)}
                </StatusPill>
              </TD>
              <TD className="text-xs">{r.proposed_by?.name ?? "—"}</TD>
              <TD className="text-xs whitespace-nowrap">
                {formatDate(r.proposed_at, lang)}
              </TD>
              <TD align="right" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => openDetail(r)}
                  className="text-xs text-primary-500 hover:underline"
                >
                  {t("admin.platform_connections.details")}
                </button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {lastPage > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-fg-t6">
            {t("admin.platform_connections.pagination")
              .replace("{page}", String(page))
              .replace("{lastPage}", String(lastPage))
              .replace("{total}", formatNumber(total, lang))}
          </span>
          <Pagination
            page={page}
            lastPage={lastPage}
            onPage={setPage}
            prevLabel={t("common.prev")}
            nextLabel={t("common.next")}
          />
        </div>
      )}

      {/* Detail drawer (kept custom right-side drawer; Drawer primitive will replace later) */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={() => setSelected(null)}
        >
          <div
            className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {t("admin.platform_connections.connection")}
                </h2>
                <p className="mt-1 font-mono text-xs text-fg-t6 break-all">{selected.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded p-1 text-fg-t6 hover:bg-figma-bg-1"
                aria-label={t("common.close")}
              >
                ✕
              </button>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <DetailRow
                label={t("admin.platform_connections.seller_a")}
                value={`${selected.seller_a?.name ?? "#" + selected.seller_a_company_id} (${selected.seller_a?.type ?? "—"})`}
              />
              <DetailRow
                label={t("admin.platform_connections.seller_b")}
                value={`${selected.seller_b?.name ?? "#" + selected.seller_b_company_id} (${selected.seller_b?.type ?? "—"})`}
              />
              <DetailRow label={t("admin.platform_connections.type")} value={selected.type} />
              <DetailRow label={t("admin.platform_connections.status")} value={selected.status} />
              <DetailRow
                label={t("admin.platform_connections.proposed_by")}
                value={
                  selected.proposed_by
                    ? `${selected.proposed_by.name} <${selected.proposed_by.email}>`
                    : "—"
                }
              />
              <DetailRow
                label={t("admin.platform_connections.proposed_at")}
                value={
                  formatDateTime(selected.proposed_at, lang)
                }
              />
              <DetailRow
                label={t("admin.platform_connections.responded_by")}
                value={
                  selected.responded_by
                    ? `${selected.responded_by.name} <${selected.responded_by.email}>`
                    : "—"
                }
              />
              <DetailRow
                label={t("admin.platform_connections.responded_at")}
                value={
                  formatDateTime(selected.responded_at, lang)
                }
              />
              {selected.terminated_at && (
                <>
                  <DetailRow
                    label={t("admin.platform_connections.terminated_at")}
                    value={formatDateTime(selected.terminated_at, lang)}
                  />
                  <DetailRow
                    label={t("admin.platform_connections.termination_reason")}
                    value={selected.termination_reason ?? "—"}
                  />
                </>
              )}
            </dl>

            {selected.partner_agreement !== undefined && selected.partner_agreement !== null && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                  {t("admin.platform_connections.partner_agreement")}
                </h3>
                <pre className="mt-1 overflow-x-auto rounded-zulu bg-figma-bg-1 p-3 font-mono text-xs">
                  {JSON.stringify(selected.partner_agreement, null, 2)}
                </pre>
              </div>
            )}
            {selected.commission_override_rule !== undefined &&
              selected.commission_override_rule !== null && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-t6">
                    {t("admin.platform_connections.commission_override")}
                  </h3>
                  <pre className="mt-1 overflow-x-auto rounded-zulu bg-figma-bg-1 p-3 font-mono text-xs">
                    {JSON.stringify(selected.commission_override_rule, null, 2)}
                  </pre>
                </div>
              )}

            {!["terminated", "rejected"].includes(selected.status) && (
              <div className="mt-6 rounded-zulu border border-error-200 bg-error-50 p-4">
                <h3 className="text-sm font-semibold text-error-700">
                  {t("admin.platform_connections.force_terminate")}
                </h3>
                <p className="mt-1 text-xs text-error-600">
                  {t("admin.platform_connections.force_terminate_help")}
                  <code className="ml-1 rounded bg-white px-1 font-mono">ADMIN: …</code>
                </p>
                <textarea
                  value={terminateReason}
                  onChange={(e) => setTerminateReason(e.target.value)}
                  rows={2}
                  placeholder={t(
                    "admin.platform_connections.force_terminate_reason_placeholder"
                  )}
                  className="mt-2 w-full rounded-zulu border border-error-300 px-2 py-1 text-sm focus:border-error-500 focus:outline-none"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={forceTerminate}
                    disabled={actionLoading || !terminateReason.trim()}
                  >
                    {actionLoading
                      ? t("admin.platform_connections.terminating")
                      : t("admin.platform_connections.force_terminate")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-success-600"
      : tone === "warn"
        ? "text-warning-600"
        : "text-fg-t11";
  return (
    <div className="admin-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-fg-t6">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <dt className="text-xs uppercase tracking-wide text-fg-t6">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}
