"use client";

/**
 * Phase 7.1 — B2C customers list.
 *
 * Replaces the ComingSoonPage placeholder shipped in Phase 4 (commit 476cc36).
 * Lists users with zero company memberships — pure B2C end users — with
 * search by name / email / phone, status filter, and the booking count
 * captured at list time (withCount on the backend).
 *
 * A future iteration adds lifetime spend, loyalty tier, acquisition source.
 * For now this is the working first cut of Bucket-3 sub-1.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiCustomers,
  CUSTOMER_STATUSES,
  type CustomerRow,
} from "@/lib/customers-api";
import { formatDate } from "@/lib/format";
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
import { RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function Bucket3CustomersPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  useDocumentTitle(t("admin.bucket3.customers.title"));
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiCustomers(token, {
        page,
        per_page: 25,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load customers");
    }
  }, [token, allowed, page, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.bucket3.customers.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.bucket3.customers.title")}
        subtitle={
          meta
            ? t("admin.bucket3.customers.subtitle_count")
                .replace("{count}", String(meta.total))
                .replace("{page}", String(meta.current_page))
                .replace("{last}", String(meta.last_page))
            : t("admin.bucket3.customers.subtitle")
        }
      />

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-t6"
            />
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
              placeholder={t("admin.bucket3.customers.search_placeholder")}
              className="h-10 w-full rounded-zulu border border-default bg-white pl-9 pr-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <Button
            size="sm"
            onClick={() => {
              setPage(1);
              setSearch(searchDraft.trim());
            }}
          >
            {t("common.apply")}
          </Button>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">{t("admin.bucket3.customers.filter.status")}</span>
            <Select
              fieldSize="sm"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
              className="!w-auto min-w-[140px]"
            >
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s ? s.charAt(0).toUpperCase() + s.slice(1) : t("common.all")}
                </option>
              ))}
            </Select>
          </label>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t("admin.bucket3.customers.refresh")}
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
            <TH>{t("admin.bucket3.customers.col.name")}</TH>
            <TH>{t("admin.bucket3.customers.col.email")}</TH>
            <TH>{t("admin.bucket3.customers.col.phone")}</TH>
            <TH>{t("admin.bucket3.customers.col.status")}</TH>
            <TH>{t("admin.bucket3.customers.col.bookings")}</TH>
            <TH>{t("admin.bucket3.customers.col.language")}</TH>
            <TH>{t("admin.bucket3.customers.col.nationality")}</TH>
            <TH>{t("admin.bucket3.customers.col.joined")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={9}>
              {search.trim() || statusFilter ? t("admin.bucket3.customers.empty_filter") : t("admin.bucket3.customers.empty")}
            </TEmpty>
          ) : null}
          {rows.map((c) => (
            <TR key={c.id} href={`/platform/users/${c.id}`}>
              <TD className="tabular-nums text-fg-t7">{c.id}</TD>
              <TD className="font-medium text-fg-t8">{c.name}</TD>
              <TD className="text-xs">{c.email}</TD>
              <TD className="text-xs text-fg-t7">{c.phone ?? "—"}</TD>
              <TD>
                <StatusPill status={c.status}>{c.status}</StatusPill>
              </TD>
              <TD className="tabular-nums">{c.bookings_count}</TD>
              <TD className="uppercase text-xs text-fg-t6">{c.preferred_language ?? "—"}</TD>
              <TD className="text-xs text-fg-t6">{c.nationality ?? "—"}</TD>
              <TD className="text-xs text-fg-t6">{formatDate(c.created_at, lang)}</TD>
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
