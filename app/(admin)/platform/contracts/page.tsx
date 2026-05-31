"use client";

/**
 * v2 admin-redesign — Partnership agreements (Contracts) list page.
 *
 * Source spec: docs/admin_designe/marketplace_ops/marketplace_ops_implementation_prompt.md §3.E
 * Mockup: docs/admin_designe/marketplace_ops/marketplace_ops_mocks.html (PAGE 5 CONTRACTS)
 *
 * Chrome:
 *   - V2PageHeader with breadcrumb + Refresh / Export / New actions
 *   - MarketplaceOpsSectionTabs (counts: contracts)
 *   - 4 stat cards (Total / Signed / Drafts / Expiring 30d)
 *   - FilterCard (Status / Template / Search) + active filter chips
 *   - V2Card wrapping table with avatar / status pill / actions row
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { formatDate } from "@/lib/format";
import {
  apiAdminContracts,
  apiAdminContractTemplates,
  CONTRACT_STATUSES,
  contractStatusLabel,
  type ContractRow,
  type ContractStatus,
  type ContractTemplateRow,
} from "@/lib/contracts-api";
import { apiContractsStats, type ContractsStats } from "@/lib/marketplace-stats-api";
import {
  STATUS_BADGE_CLASS,
  avatarInitials,
  avatarStyle,
  pickAvatarTone,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
import { Pagination } from "@/components/ui";
import { MarketplaceOpsSectionTabs } from "@/components/marketplace/MarketplaceOpsSectionTabs";
import { exportRowsAsCsv } from "@/lib/export-csv";
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
  AlertCircle,
  Ban,
  Bell,
  Check,
  CircleCheck,
  Download,
  Edit3,
  Eye,
  FileText,
  MoreVertical,
  Plus,
  RefreshCw,
  Send,
  X as XIcon,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ContractStatusMeta = { tone: StatusTone; label: string; icon: React.ReactNode };

/**
 * Status → tone / label / icon. Spec §3.E lists 5 buckets but the backend
 * enum has 9 values (CONTRACT_STATUSES); we map the additional signed_by_*
 * and countersigned states to the "Signed" success bucket per spec wording
 * («signed_by_a / signed_by_b / countersigned / active → success Signed»).
 */
const STATUS_META: Record<ContractStatus, ContractStatusMeta> = {
  draft: { tone: "warning", label: "Draft", icon: <Edit3 className="h-3 w-3" /> },
  sent: { tone: "info", label: "Sent", icon: <Send className="h-3 w-3" /> },
  signed_by_a: { tone: "success", label: "Signed", icon: <Check className="h-3 w-3" /> },
  signed_by_b: { tone: "success", label: "Signed", icon: <Check className="h-3 w-3" /> },
  countersigned: { tone: "success", label: "Signed", icon: <Check className="h-3 w-3" /> },
  active: { tone: "success", label: "Active", icon: <CircleCheck className="h-3 w-3" /> },
  expired: { tone: "danger", label: "Expired", icon: <AlertCircle className="h-3 w-3" /> },
  terminated: { tone: "gray", label: "Terminated", icon: <Ban className="h-3 w-3" /> },
  disputed: { tone: "danger", label: "Disputed", icon: <AlertCircle className="h-3 w-3" /> },
};

const PER_PAGE = 25;

export default function PlatformContractsPage() {
  const { t, lang } = useLanguage();
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "">("");
  const [templateFilter, setTemplateFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ContractsStats | null>(null);
  const [templates, setTemplates] = useState<ContractTemplateRow[]>([]);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await apiAdminContracts(token, {
        page,
        per_page: PER_PAGE,
        status: statusFilter || undefined,
        q: search.trim() || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.contracts.err_load_failed"));
    } finally {
      setLoading(false);
    }
  }, [token, allowed, page, statusFilter, search, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiContractsStats(token)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiAdminContractTemplates(token, { per_page: 100 })
      .then((res) => setTemplates(res.data))
      .catch(() => setTemplates([]));
  }, [token, allowed]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${STATUS_META[statusFilter]?.label ?? contractStatusLabel(statusFilter)}`,
        clear: () => {
          setPage(1);
          setStatusFilter("");
        },
      });
    }
    if (templateFilter) {
      const tpl = templates.find((tp) => tp.id === templateFilter);
      chips.push({
        key: "template",
        label: `Template: ${tpl?.name ?? templateFilter}`,
        clear: () => {
          setPage(1);
          setTemplateFilter("");
        },
      });
    }
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `“${search.trim()}”`,
        clear: () => {
          setPage(1);
          setSearch("");
          setSearchDraft("");
        },
      });
    }
    return chips;
  }, [statusFilter, templateFilter, search, templates]);

  function clearAllFilters() {
    setPage(1);
    setStatusFilter("");
    setTemplateFilter("");
    setSearch("");
    setSearchDraft("");
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.contracts.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  // Client-side template filter (backend doesn't expose `template_id` param yet).
  const filteredRows = templateFilter
    ? rows.filter((r) => r.template_id === templateFilter)
    : rows;

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Management", href: "/platform/companies" },
          { label: t("admin.contracts.title") },
        ]}
        title={t("admin.contracts.title")}
        subtitle={
          t("admin.contracts.subtitle") !== "admin.contracts.subtitle"
            ? t("admin.contracts.subtitle")
            : "Partnership agreements signed with marketplace operators and agents"
        }
        actions={
          <>
            <V2Button onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh">
              {""}
            </V2Button>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              disabled={rows.length === 0}
              onClick={() =>
                exportRowsAsCsv("contracts", rows, [
                  ["id", (r) => r.id],
                  ["contract_number", (r) => r.contract_number],
                  ["type", (r) => r.type],
                  ["status", (r) => r.status],
                  ["party_a_company_id", (r) => r.party_a_company_id ?? ""],
                  ["party_b_company_id", (r) => r.party_b_company_id],
                  ["language", (r) => r.language],
                ])
              }
            >
              Export
            </V2Button>
            <Link
              href="/platform/contracts/new"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-500 px-4 text-ds-button-s font-ds-button-s font-semibold text-white transition hover:bg-purple-dark"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t("admin.contracts.btn_new")}
            </Link>
          </>
        }
      />

      <MarketplaceOpsSectionTabs activeHref="/platform/contracts" counts={{ contracts: stats?.total }} />

      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<FileText style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.total.toLocaleString() : "—"}
          label="Total contracts"
        />
        <StatCard
          icon={<CircleCheck style={{ color: "var(--admin-success)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.signed.toLocaleString() : "—"}
          label="Signed (active)"
        />
        <StatCard
          icon={<Edit3 style={{ color: "var(--admin-warning)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.drafts.toLocaleString() : "—"}
          label="Drafts"
        />
        <StatCard
          icon={<AlertCircle style={{ color: "var(--admin-danger)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.expiring_30d.toLocaleString() : "—"}
          label="Expiring (30d)"
        />
      </StatGrid>

      <FilterCard>
        <FilterField label={t("admin.contracts.filter_status")}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as ContractStatus | "");
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">{t("common.all")}</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s]?.label ?? contractStatusLabel(s)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Template">
          <select
            value={templateFilter}
            onChange={(e) => {
              setPage(1);
              setTemplateFilter(e.target.value);
            }}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">{t("common.all")}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
                {tpl.version ? ` (v${tpl.version})` : ""}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Search" minWidth={240}>
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setSearch(searchDraft.trim());
              }
            }}
            placeholder={t("admin.contracts.search_placeholder")}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <V2Button
          variant="primary"
          size="md"
          onClick={() => {
            setPage(1);
            setSearch(searchDraft.trim());
          }}
        >
          Apply
        </V2Button>
        {activeChips.length > 0 ? (
          <V2Button size="md" onClick={clearAllFilters}>
            Clear
          </V2Button>
        ) : null}
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
                <th className="px-4 py-2.5 text-left">ID</th>
                <th className="px-4 py-2.5 text-left">{t("admin.contracts.col_template") ?? "Title"}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.contracts.col_party_b")}</th>
                <th className="px-4 py-2.5 text-left">Template</th>
                <th className="px-4 py-2.5 text-left">{t("admin.contracts.col_status")}</th>
                <th className="px-4 py-2.5 text-left">Signed at</th>
                <th className="px-4 py-2.5 text-left">{t("admin.contracts.col_expires")}</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    {loading ? "Loading…" : t("admin.contracts.empty_state")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const statusMeta = STATUS_META[r.status] ?? STATUS_META.draft;
                  const partyBName = r.partyB?.name ?? null;
                  const partyBKey = r.partyB?.id ?? r.party_b_company_id ?? r.id;
                  const tone = pickAvatarTone(partyBKey);
                  const shortId =
                    r.contract_number && r.contract_number.length > 0
                      ? r.contract_number
                      : `#${String(r.id).slice(0, 8)}`;

                  // Expiry colour: danger if past, warning if within 30 days.
                  let expiryStyle: React.CSSProperties | undefined;
                  let expiryLabel = "—";
                  if (r.expiry_date) {
                    const ms = new Date(r.expiry_date).getTime();
                    if (!Number.isNaN(ms)) {
                      expiryLabel = formatDate(r.expiry_date, lang);
                      const days = Math.floor((ms - Date.now()) / 86_400_000);
                      if (days < 0) {
                        expiryStyle = { color: "var(--admin-danger-dark)", fontWeight: 600 };
                      } else if (days <= 30) {
                        expiryStyle = { color: "var(--admin-warning-dark)", fontWeight: 600 };
                      }
                    }
                  }

                  return (
                    <tr
                      key={r.id}
                      className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-fg-t7">
                        <Link
                          href={`/platform/contracts/${r.id}`}
                          className="hover:underline"
                          style={{ color: "var(--admin-primary)" }}
                        >
                          {shortId}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-medium text-fg-t8 truncate">{r.contract_number}</div>
                          {r.template?.version ? (
                            <div className="text-[11px] text-fg-t6 truncate">v{r.template.version}</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {partyBName ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                              style={avatarStyle(tone)}
                              aria-hidden
                            >
                              {avatarInitials(partyBName)}
                            </span>
                            <span className="text-fg-t8 truncate">{partyBName}</span>
                          </div>
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-fg-t7">
                        {r.template?.name ?? "—"}
                        {r.template?.language ? (
                          <span className="ml-1 text-fg-t6">({r.template.language.toUpperCase()})</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusMeta.tone)}>
                          {statusMeta.icon}
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                        {r.effective_date ? formatDate(r.effective_date, lang) : "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={expiryStyle ?? { color: "var(--admin-text-secondary)" }}>
                        {expiryLabel}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton as="link" href={`/platform/contracts/${r.id}`} aria-label="View">
                            <Eye />
                          </IconButton>
                          {r.signed_pdf_url ? (
                            <IconButton
                              as="link"
                              href={r.signed_pdf_url}
                              aria-label="Download PDF"
                            >
                              <Download />
                            </IconButton>
                          ) : null}
                          {(r.status === "sent" || r.status === "signed_by_a" || r.status === "signed_by_b") ? (
                            <IconButton aria-label="Send reminder">
                              <Bell />
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
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} contracts
            </span>
            <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
          </div>
        ) : null}
      </V2Card>
    </div>
  );
}
