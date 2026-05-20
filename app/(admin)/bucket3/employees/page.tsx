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
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
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

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

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
        <h1 className="admin-page-title">Employees</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        subtitle={
          meta
            ? `${meta.total} staff users across all companies`
            : "Staff users belonging to operator / agent companies"
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
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setSearch(searchDraft.trim());
                }
              }}
              placeholder="Search by name or email"
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
                setStatusFilter(e.target.value);
              }}
              className="!w-auto min-w-[140px]"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </Select>
          </label>
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
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Status</TH>
            <TH>Companies</TH>
            <TH>Joined</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={6}>No employees match the filter.</TEmpty>
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
              <TD className="text-xs text-fg-t6">{formatDate(e.created_at)}</TD>
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
