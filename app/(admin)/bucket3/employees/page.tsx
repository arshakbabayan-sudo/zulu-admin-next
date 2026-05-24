"use client";

/**
 * Phase 7.5 — Employees (staff users across all companies).
 *
 * Bucket-3 sub-5 per the roadmap. Replaces the ComingSoonPage placeholder.
 * Lists users that belong to at least one company (operator / agent / staff)
 * — the inverse of /bucket3/customers. For super-admin oversight.
 *
 * Per-company employee management lives on /platform/companies/[id]; this
 * page is the cross-company roll-up.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
import { formatDate } from "@/lib/format";
import {
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
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  FilterCard,
  FilterField,
  V2Card,
} from "@/components/ui/v2";
import { Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type EmployeeRow = {
  id: number;
  name: string;
  email: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  companies: { id: number; name: string; role: string }[];
};

async function fetchEmployees(
  token: string,
  page: number,
  search: string,
  status: string
): Promise<ApiSuccessEnvelope<EmployeeRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", "25");
  q.set("with_companies", "1");
  if (search) q.set("search", search);
  if (status) q.set("status", status);
  return apiFetchJson(`/platform-admin/users?${q.toString()}`, { method: "GET", token });
}

export default function Bucket3EmployeesPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await fetchEmployees(token, page, search.trim(), statusFilter);
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load employees");
    }
  }, [token, allowed, page, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.bucket3.employees.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — My company → Employees page chrome.
          Matches docs/zulu-admin-v2.html page-view#company (lines 673-709). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "My company", href: "/bucket3/employees" },
          { label: t("admin.bucket3.employees.title") },
        ]}
        title={t("admin.bucket3.employees.title")}
        subtitle={
          meta
            ? t("admin.bucket3.employees.subtitle_count").replace("{count}", String(meta.total))
            : t("admin.bucket3.employees.subtitle")
        }
      />

      <SectionTabs
        activeHref="/bucket3/employees"
        items={[
          { href: "/bucket3/employees", label: "Employees", count: meta?.total },
          { href: "/bucket3/payroll", label: "Payroll" },
          { href: "/bucket3/non-service-hours", label: "Non-service hours" },
          { href: "/bucket3/cases", label: "Cases" },
          { href: "/bucket3/bulk-notifications", label: "Bulk notifications" },
          { href: "/bucket3/pin-settings", label: "PIN settings" },
          { href: "/bucket3/customers", label: "Customers" },
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
              placeholder={t("admin.bucket3.employees.search_placeholder")}
              className="h-[34px] w-full rounded-md border bg-white pl-8 pr-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            />
          </div>
        </FilterField>
        <FilterField label={t("admin.bucket3.employees.filter.status")}>
          <Select
            fieldSize="sm"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="!h-[34px] !min-w-[140px]"
          >
            <option value="">{t("common.all")}</option>
            <option value="active">{t("admin.bucket3.employees.status.active")}</option>
            <option value="inactive">{t("admin.bucket3.employees.status.inactive")}</option>
            <option value="pending">{t("admin.bucket3.employees.status.pending")}</option>
            <option value="suspended">{t("admin.bucket3.employees.status.suspended")}</option>
          </Select>
        </FilterField>
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
            <TH>{t("admin.bucket3.employees.col.name")}</TH>
            <TH>{t("admin.bucket3.employees.col.email")}</TH>
            <TH>{t("admin.bucket3.employees.col.status")}</TH>
            <TH>{t("admin.bucket3.employees.col.companies")}</TH>
            <TH>{t("admin.bucket3.employees.col.joined")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={6}>{t("admin.bucket3.employees.empty")}</TEmpty>
          ) : null}
          {rows.map((e) => (
            <TR key={e.id} href={`/platform/users/${e.id}`}>
              <TD className="tabular-nums text-fg-t7">{e.id}</TD>
              <TD className="font-medium text-fg-t8">{e.name}</TD>
              <TD className="text-xs">{e.email}</TD>
              <TD>
                <StatusPill status={e.status}>{e.status}</StatusPill>
              </TD>
              <TD>
                <div className="flex flex-wrap gap-1">
                  {e.companies.map((c) => (
                    <Link
                      key={c.id}
                      href={`/platform/companies/${c.id}`}
                      onClick={(ev) => ev.stopPropagation()}
                      className="inline-flex items-center rounded-md border border-default bg-figma-bg-1 px-2 py-0.5 text-xs text-fg-t7 hover:bg-figma-bg-1/60"
                    >
                      {c.name}
                      <span className="ml-1 text-fg-t6">· {c.role}</span>
                    </Link>
                  ))}
                </div>
              </TD>
              <TD className="text-xs text-fg-t6">{formatDate(e.created_at, lang)}</TD>
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
