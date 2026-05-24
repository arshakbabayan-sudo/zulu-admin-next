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
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "My company", href: "/bucket3/employees" },
          { label: t("admin.bucket3.customers.title") },
        ]}
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

      <SectionTabs
        activeHref="/bucket3/customers"
        items={[
          { href: "/bucket3/employees", label: "Employees" },
          { href: "/bucket3/payroll", label: "Payroll" },
          { href: "/bucket3/non-service-hours", label: "Non-service hours" },
          { href: "/bucket3/cases", label: "Cases" },
          { href: "/bucket3/bulk-notifications", label: "Bulk notifications" },
          { href: "/bucket3/pin-settings", label: "PIN settings" },
          { href: "/bucket3/customers", label: "Customers", count: meta?.total },
          { href: "/bucket3/subscriptions", label: "Subscriptions" },
          { href: "/bucket3/per-x-invoicing", label: "Per-X invoicing" },
        ]}
      />

      <FilterCard>
        <FilterField label="Search" minWidth={240}>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "var(--admin-text-tertiary)" }}
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
              className="h-[34px] w-full rounded-md border bg-white pl-8 pr-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            />
          </div>
        </FilterField>
        <FilterField label={t("admin.bucket3.customers.filter.status")}>
          <Select
            fieldSize="sm"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="!h-[34px] !min-w-[140px]"
          >
            {CUSTOMER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : t("common.all")}
              </option>
            ))}
          </Select>
        </FilterField>
        <V2Button size="sm" variant="primary" onClick={() => { setPage(1); setSearch(searchDraft.trim()); }}>
          {t("common.apply")}
        </V2Button>
        <V2Button size="sm" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          {t("admin.bucket3.customers.refresh")}
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
