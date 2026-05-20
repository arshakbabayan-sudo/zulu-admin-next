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
  Button,
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
import { Plus, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export default function PlatformContractsPage() {
  const { t } = useLanguage();
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
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load contracts");
    }
  }, [token, allowed, page, statusFilter, typeFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Contracts</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        subtitle={
          meta
            ? `${meta.total} total · page ${meta.current_page} of ${meta.last_page}`
            : "Platform and partner contracts"
        }
        actions={
          <Link
            href="/platform/contracts/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-500 px-4 text-ds-button-s font-ds-button-s font-semibold text-white transition hover:bg-purple-dark"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New contract
          </Link>
        }
      />

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
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
              placeholder="Search by contract number"
              className="h-10 w-full rounded-zulu border border-default bg-white pl-9 pr-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">Status</span>
            <Select
              fieldSize="sm"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value as ContractStatus | "");
              }}
              className="!w-auto min-w-[160px]"
            >
              <option value="">{t("common.all")}</option>
              {CONTRACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {contractStatusLabel(s)}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">Type</span>
            <Select
              fieldSize="sm"
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value as ContractType | "");
              }}
              className="!w-auto min-w-[200px]"
            >
              <option value="">{t("common.all")}</option>
              {CONTRACT_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {contractTypeLabel(tp)}
                </option>
              ))}
            </Select>
          </label>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <Table>
        <THead>
          <TR>
            <TH>#</TH>
            <TH>Type</TH>
            <TH>Status</TH>
            <TH>Party A</TH>
            <TH>Party B</TH>
            <TH>Template</TH>
            <TH>Effective</TH>
            <TH>Expires</TH>
            <TH>Created</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={9}>No contracts match the current filters.</TEmpty>
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
              <TD className="text-xs text-fg-t6">{formatDate(r.effective_date)}</TD>
              <TD className="text-xs text-fg-t6">{formatDate(r.expiry_date)}</TD>
              <TD className="text-xs text-fg-t6">{formatDate(r.created_at)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>

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
