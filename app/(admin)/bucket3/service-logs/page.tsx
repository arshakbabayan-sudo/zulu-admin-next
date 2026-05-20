"use client";

/**
 * Phase 7.9 — Service logs.
 *
 * Wraps the existing /platform-admin/audit-logs endpoint with a curated set
 * of categories that map to service-affecting activity (data_change /
 * financial / approval / contract). The platform's full audit log lives
 * at /platform/audit-logs; this Bucket-3 surface is the operations-focused
 * subset.
 *
 * Replaces the ComingSoonPage placeholder.
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

const SERVICE_CATEGORIES = ["data_change", "financial", "approval", "contract"] as const;
type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

type AuditRow = {
  id: number;
  category: string;
  action: string;
  actor_id: number | null;
  actor_type: string | null;
  subject_type: string | null;
  subject_id: string | number | null;
  created_at: string;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

async function fetchServiceLogs(
  token: string,
  page: number,
  category: ServiceCategory | "",
  search: string
): Promise<ApiSuccessEnvelope<AuditRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", "25");
  if (category) q.set("category", category);
  if (search) q.set("q", search);
  return apiFetchJson(`/platform-admin/audit-logs?${q.toString()}`, {
    method: "GET",
    token,
  });
}

export default function Bucket3ServiceLogsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<ServiceCategory | "">("");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await fetchServiceLogs(token, page, category, search.trim());
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load service logs");
    }
  }, [token, allowed, page, category, search]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Service logs</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service logs"
        subtitle={
          meta
            ? `${meta.total} service events · page ${meta.current_page} of ${meta.last_page}`
            : "Operations-scoped subset of the audit log (data_change / financial / approval / contract)"
        }
        actions={
          <Link
            href="/platform/audit-logs"
            className="inline-flex h-10 items-center rounded-md border-2 border-primary-500 px-4 text-ds-button-s font-ds-button-s font-semibold text-primary-500 transition hover:bg-primary-50"
          >
            Full audit log →
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
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setSearch(searchDraft.trim());
                }
              }}
              placeholder="Search by action or subject id"
              className="h-10 w-full rounded-zulu border border-default bg-white pl-9 pr-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">Category</span>
            <Select
              fieldSize="sm"
              value={category}
              onChange={(e) => {
                setPage(1);
                setCategory(e.target.value as ServiceCategory | "");
              }}
              className="!w-auto min-w-[160px]"
            >
              <option value="">All service categories</option>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
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
            <TH>Category</TH>
            <TH>Action</TH>
            <TH>Actor</TH>
            <TH>Subject</TH>
            <TH>When</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={6}>No service-log entries match the filter.</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums text-fg-t7">{r.id}</TD>
              <TD className="text-xs text-fg-t7">{r.category}</TD>
              <TD className="font-mono text-xs text-fg-t8">{r.action}</TD>
              <TD className="text-xs text-fg-t6">
                {r.actor_id ? (
                  <Link
                    href={`/platform/users/${r.actor_id}`}
                    className="text-info-700 hover:underline"
                  >
                    {r.actor_type ?? "user"} #{r.actor_id}
                  </Link>
                ) : (
                  <span>{r.actor_type ?? "—"}</span>
                )}
              </TD>
              <TD className="text-xs text-fg-t7">
                {r.subject_type ? `${r.subject_type}${r.subject_id != null ? ` #${r.subject_id}` : ""}` : "—"}
              </TD>
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
