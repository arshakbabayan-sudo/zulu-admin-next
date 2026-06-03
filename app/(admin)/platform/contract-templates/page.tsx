"use client";

/**
 * v2 admin-redesign — Contract templates page (Marketplace ops group).
 *
 * Source spec: docs/admin_designe/marketplace_ops/marketplace_ops_mocks.html (PAGE 6)
 * Migration prompt: docs/admin_designe/marketplace_ops/marketplace_ops_implementation_prompt.md §3.F
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { exportRowsAsCsv } from "@/lib/export-csv";
import {
  apiAdminContractTemplates,
  CONTRACT_TYPES,
  contractTypeLabel,
  type ContractTemplateRow,
  type ContractType,
} from "@/lib/contracts-api";
import { apiContractTemplatesStats, type ContractTemplatesStats } from "@/lib/marketplace-stats-api";
import {
  PageHeader as V2PageHeader,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  StatCard,
  StatGrid,
  IconButton,
  SuperAdminTag,
} from "@/components/ui/v2";
import { MarketplaceOpsSectionTabs } from "@/components/marketplace/MarketplaceOpsSectionTabs";
import {
  STATUS_BADGE_CLASS,
  formatRelativeTime,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
import {
  FileText as TemplateIcon,
  CheckCircle2 as CircleCheckIcon,
  Edit3 as EditIcon,
  Files as FileStackIcon,
  Check as CheckIcon,
  X as XIcon,
  Copy as CopyIcon,
  MoreVertical,
  Download,
  Plus,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

// 2026-06-04 admin v3 — backend uses `active` boolean (not "published" /
// "draft" / "archived"). The old TemplateStatus pseudo-enum was a frontend
// invention that mapped onto the phantom `is_published` field; replaced with
// a true/false toggle.
type TemplateStatus = "active" | "draft";

function templateStatus(tpl: ContractTemplateRow): TemplateStatus {
  // active === null (legacy rows) treated as active to match backend default.
  return tpl.active === false ? "draft" : "active";
}

function statusMeta(s: TemplateStatus): { tone: StatusTone; label: string; icon: React.ReactNode } {
  switch (s) {
    case "active":
      return { tone: "success", label: "Active", icon: <CheckIcon className="h-3 w-3" /> };
    case "draft":
    default:
      return { tone: "warning", label: "Inactive", icon: <EditIcon className="h-3 w-3" /> };
  }
}

/** Short-uuid → "#T-XX" shorthand (last 2 chars of id, uppercased). */
function shortTemplateId(id: string): string {
  if (!id) return "#T-??";
  const tail = id.slice(-2).toUpperCase();
  return `#T-${tail}`;
}

export default function PlatformContractTemplatesPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<ContractTemplateRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"" | TemplateStatus>("");
  const [typeFilter, setTypeFilter] = useState<ContractType | "">("");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ContractTemplatesStats | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const res = await apiAdminContractTemplates(token, {
        per_page: 100,
        type: typeFilter || undefined,
      });
      setRows(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.contract_templates.err_load_failed"));
    } finally {
      setLoading(false);
    }
  }, [token, allowed, typeFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !allowed) return;
    void apiContractTemplatesStats(token)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [token, allowed]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((tpl) => {
      const s = templateStatus(tpl);
      if (statusFilter && s !== statusFilter) return false;
      if (q) {
        const hit =
          tpl.id?.toLowerCase().includes(q) ||
          tpl.name?.toLowerCase().includes(q) ||
          tpl.type?.toLowerCase().includes(q) ||
          String(tpl.version ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, statusFilter, search]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${statusMeta(statusFilter).label}`,
        clear: () => setStatusFilter(""),
      });
    }
    if (typeFilter) {
      chips.push({
        key: "type",
        label: `Type: ${contractTypeLabel(typeFilter)}`,
        clear: () => setTypeFilter(""),
      });
    }
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `“${search.trim()}”`,
        clear: () => setSearch(""),
      });
    }
    return chips;
  }, [statusFilter, typeFilter, search]);

  function clearAllFilters() {
    setStatusFilter("");
    setTypeFilter("");
    setSearch("");
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.contract_templates.title")}</h1>
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
          { label: "Management", href: "/platform/companies" },
          { label: t("admin.contract_templates.title") },
        ]}
        title={t("admin.contract_templates.title")}
        titleBadge={<SuperAdminTag />}
        subtitle="Reusable contract templates with placeholders and default variables"
        actions={
          <>
            <V2Button onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh">
              {""}
            </V2Button>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              disabled={rows.length === 0}
              onClick={() =>
                exportRowsAsCsv("contract-templates", rows, [
                  ["id", (r) => r.id],
                  ["name", (r) => r.name],
                  ["type", (r) => r.type],
                  ["language", (r) => r.language],
                  ["version", (r) => String(r.version ?? "")],
                  ["active", (r) => (r.active === false ? "0" : "1")],
                  ["created_at", (r) => r.created_at ?? ""],
                  ["updated_at", (r) => r.updated_at ?? ""],
                ])
              }
            >
              Export
            </V2Button>
            <V2Button as="link" href="/platform/contract-templates/new" variant="primary" icon={<Plus className="h-4 w-4" />}>
              {t("admin.contract_templates.btn_new")}
            </V2Button>
          </>
        }
      />

      <MarketplaceOpsSectionTabs
        activeHref="/platform/contract-templates"
        counts={{ contractTemplates: stats?.total ?? rows.length }}
      />

      <StatGrid cols={4} className="mb-5">
        <StatCard
          icon={<TemplateIcon style={{ color: "var(--admin-primary)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.total.toLocaleString() : "—"}
          label="Total templates"
        />
        <StatCard
          icon={<CircleCheckIcon style={{ color: "var(--admin-success)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.published.toLocaleString() : "—"}
          label="Published"
        />
        <StatCard
          icon={<EditIcon style={{ color: "var(--admin-warning)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.drafts.toLocaleString() : "—"}
          label="Drafts"
        />
        <StatCard
          icon={<FileStackIcon style={{ color: "var(--admin-info)" }} className="h-[22px] w-[22px]" />}
          value={stats ? stats.contracts_created.toLocaleString() : "—"}
          label="Contracts created"
        />
      </StatGrid>

      <FilterCard>
        <FilterField label="Status">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | TemplateStatus)}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </FilterField>
        <FilterField label={t("admin.contract_templates.filter_type")}>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ContractType | "")}
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <option value="">{t("common.all")}</option>
            {CONTRACT_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {contractTypeLabel(tp)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Search" minWidth={240}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Template name..."
            className="h-[34px] rounded-md border bg-white px-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
            style={{ borderColor: "var(--admin-border)" }}
          />
        </FilterField>
        <V2Button variant="primary" size="md" onClick={() => void load()}>
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
            <XIcon className="h-3 w-3" />
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
                <th className="px-4 py-2.5 text-left">{t("admin.contract_templates.col_name")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.contract_templates.col_version")}</th>
                <th className="px-4 py-2.5 text-left">Variables</th>
                <th className="px-4 py-2.5 text-left">{t("admin.contract_templates.col_published")}</th>
                <th className="px-4 py-2.5 text-left">Used in</th>
                <th className="px-4 py-2.5 text-left">{t("admin.contract_templates.col_updated")}</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: "var(--admin-text-secondary)" }}>
                    {loading ? "Loading…" : (
                      <>
                        {t("admin.contract_templates.empty_state")}{" "}
                        <Link
                          href="/platform/contract-templates/new"
                          className="font-medium underline"
                          style={{ color: "var(--admin-primary)" }}
                        >
                          {t("admin.contract_templates.empty_state_cta")} →
                        </Link>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRows.map((tpl) => {
                  const s = templateStatus(tpl);
                  const sMeta = statusMeta(s);
                  return (
                    <tr
                      key={tpl.id}
                      className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-fg-t7">{shortTemplateId(tpl.id)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <Link
                            href={`/platform/contract-templates/${tpl.id}`}
                            className="font-medium text-fg-t8 hover:underline"
                          >
                            {tpl.name}
                          </Link>
                          <span className="text-[11px]" style={{ color: "var(--admin-text-tertiary)" }}>
                            {contractTypeLabel(tpl.type)} · {tpl.language?.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-fg-t8 tabular-nums">{tpl.version ?? "—"}</td>
                      <td className="px-4 py-3">
                        {/* Variable count not yet on list endpoint — show "—" until backend ships it. */}
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle("gray")}>
                          —
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(sMeta.tone)}>
                          {sMeta.icon}
                          {sMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px]">
                        {/* usage_count not yet on list endpoint — show "—" until backend ships it. */}
                        <span style={{ color: "var(--admin-text-tertiary)" }}>—</span>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--admin-text-secondary)" }} title={tpl.updated_at ?? undefined}>
                        {formatRelativeTime(tpl.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton
                            as="link"
                            href={`/platform/contract-templates/${tpl.id}`}
                            aria-label="Edit"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            as="link"
                            href={`/platform/contract-templates/new?clone=${tpl.id}`}
                            aria-label="Copy"
                          >
                            <CopyIcon />
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
      </V2Card>
    </div>
  );
}
