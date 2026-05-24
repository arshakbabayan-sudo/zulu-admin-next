"use client";

/**
 * Phase 5 — Platform contracts list (admin side).
 * Backend: GET /platform-admin/contracts (paginated). Filters: status, type, q.
 *
 * Actions (send / countersign / terminate / create) live on the detail/create
 * pages — this page is the index + filter strip.
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
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  contractStatusLabel,
  contractStatusTier,
  contractTypeLabel,
  type ContractRow,
  type ContractStatus,
  type ContractType,
} from "@/lib/contracts-api";
import {

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
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
} from "@/components/ui/v2";
import { Plus, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function PlatformContractsPage() {
  const { t, lang } = useLanguage();
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<ContractType | "">("");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiAdminContracts(token, {
        page,
        per_page: 25,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        q: search.trim() || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.contracts.err_load_failed"));
    }
  }, [token, allowed, page, statusFilter, typeFilter, search, t]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <div>
      {/* v2 admin-redesign — Marketplace ops Partnership agreements page chrome. */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.contracts.title") },
        ]}
        title={t("admin.contracts.title")}
        subtitle={
          meta
            ? `${meta.total} ${t("admin.contracts.meta_total_suffix")} · ${t("admin.contracts.meta_page_prefix")} ${meta.current_page}/${meta.last_page}`
            : t("admin.contracts.subtitle")
        }
        actions={
          <Link
            href="/platform/contracts/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-500 px-4 text-ds-button-s font-ds-button-s font-semibold text-white transition hover:bg-purple-dark"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("admin.contracts.btn_new")}
          </Link>
        }
      />

      <SectionTabs
        activeHref="/platform/contracts"
        items={[
          { href: "/platform/approvals", label: "Approval queue" },
          { href: "/platform/companies", label: "Companies access" },
          { href: "/platform/seller-applications", label: "Seller applications" },
          { href: "/platform/contracts", label: "Partnership agreements", count: meta?.total },
          { href: "/platform/contract-templates", label: "Contract templates" },
          { href: "/platform/users", label: "Users" },
          { href: "/platform/audit-logs", label: "Audit logs" },
          { href: "/bucket3/service-logs", label: "Service logs" },
          { href: "/bucket3/unverified-accounts", label: "Unverified accounts" },
        ]}
      />

      <FilterCard>
        <FilterField label={t("admin.contracts.search_placeholder")}>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-t6"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder={t("admin.contracts.search_placeholder")}
              className="h-[34px] w-full rounded-md border bg-white pl-9 pr-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            />
          </div>
        </FilterField>
        <FilterField label={t("admin.contracts.filter_status")}>
          <Select
            fieldSize="sm"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as ContractStatus | "");
            }}
            className="!h-[34px]"
          >
            <option value="">{t("common.all")}</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {contractStatusLabel(s)}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label={t("admin.contracts.filter_type")}>
          <Select
            fieldSize="sm"
            value={typeFilter}
            onChange={(e) => {
              setPage(1);
              setTypeFilter(e.target.value as ContractType | "");
            }}
            className="!h-[34px]"
          >
            <option value="">{t("common.all")}</option>
            {CONTRACT_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {contractTypeLabel(tp)}
              </option>
            ))}
          </Select>
        </FilterField>
        <V2Button size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          {t("admin.crud.common.refresh")}
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
            <TH>#</TH>
            <TH>{t("admin.contracts.col_type")}</TH>
            <TH>{t("admin.contracts.col_status")}</TH>
            <TH>{t("admin.contracts.col_party_a")}</TH>
            <TH>{t("admin.contracts.col_party_b")}</TH>
            <TH>{t("admin.contracts.col_template")}</TH>
            <TH>{t("admin.contracts.col_effective")}</TH>
            <TH>{t("admin.contracts.col_expires")}</TH>
            <TH>{t("admin.contracts.col_created")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={9}>{t("admin.contracts.empty_state")}</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id} href={`/platform/contracts/${r.id}`}>
              <TD className="font-mono text-xs text-fg-t8">{r.contract_number}</TD>
              <TD className="text-xs text-fg-t7">{contractTypeLabel(r.type)}</TD>
              <TD>
                <StatusPill status={contractStatusTier(r.status)}>
                  {contractStatusLabel(r.status)}
                </StatusPill>
              </TD>
              <TD>{r.partyA?.name ?? <span className="text-fg-t6">ZULU</span>}</TD>
              <TD>{r.partyB?.name ?? "—"}</TD>
              <TD className="text-xs text-fg-t7">
                {r.template?.name ?? "—"}
                {r.template?.language ? (
                  <span className="ml-1 text-fg-t6">({r.template.language.toUpperCase()})</span>
                ) : null}
              </TD>
              <TD className="text-xs text-fg-t6">{formatDate(r.effective_date, lang)}</TD>
              <TD className="text-xs text-fg-t6">{formatDate(r.expiry_date, lang)}</TD>
              <TD className="text-xs text-fg-t6">{formatDate(r.created_at, lang)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      </V2Card>

      {meta && meta.last_page > 1 && (
        <Pagination
          page={meta.current_page}
          lastPage={meta.last_page}
          onPage={(p) => setPage(p)}
        />
      )}
    </div>
  );
}
