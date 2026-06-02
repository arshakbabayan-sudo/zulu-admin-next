"use client";

/**
 * CRM → Customers list.
 *
 * The first data-backed CRM tab. Lists B2C customers (users with zero company
 * memberships) via the existing PlatformAdminController::listCustomers endpoint
 * (lib/customers-api.ts). Rows link to the per-customer CRM card at
 * /crm/customers/[id].
 *
 * NOTE (Arshak's decision #2): operators mostly sell to AGENTS, so an
 * agent-buyer vs B2C split is required per-role. That split is a backend
 * scoping concern (the list endpoint must branch on the caller's role) and
 * lands with the employee-sales / scoping work; for super-admin this view is
 * the platform-wide B2C customer base.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessCrmSection } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiCrmCustomers, CUSTOMER_STATUSES, type CustomerRow } from "@/lib/customers-api";
import {
  STATUS_BADGE_CLASS,
  avatarInitials,
  avatarStyle,
  formatRelativeTime,
  pickAvatarTone,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
import {
  PageHeader,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  EmptyState,
} from "@/components/ui/v2";
import { CrmSectionTabs } from "@/components/crm/CrmSectionTabs";
import { RefreshCw, Search, Users } from "lucide-react";

const PER_PAGE = 20;

function statusTone(status: string): StatusTone {
  switch (status) {
    case "active":
      return "success";
    case "pending":
      return "warning";
    case "suspended":
      return "danger";
    default:
      return "gray";
  }
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function CrmCustomersPage() {
  useDocumentTitle("CRM — Customers");
  const { token, user } = useAdminAuth();
  const allowed = canAccessCrmSection(user);

  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiCrmCustomers(token, {
        page,
        per_page: PER_PAGE,
        search,
        status,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) {
        setForbidden(true);
      } else {
        setErr(e instanceof Error ? e.message : "Failed to load customers");
      }
    } finally {
      setLoading(false);
    }
  }, [token, page, search, status]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed || forbidden) return <ForbiddenNotice />;

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "CRM", href: "/crm/pipeline" },
          { label: "Customers" },
        ]}
        title="Customers"
        subtitle={meta ? `${meta.total} customers` : undefined}
        actions={
          <V2Button onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </V2Button>
        }
      />
      <CrmSectionTabs activeHref="/crm/customers" counts={{ customers: meta?.total }} />

      <FilterCard>
        <FilterField label="Search" minWidth={260}>
          <form onSubmit={(e) => { e.preventDefault(); applySearch(); }} className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--admin-text-tertiary)" }}
            />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, email, phone…"
              className="h-[34px] w-full rounded-md border pl-9 pr-3 text-[12px] outline-none"
              style={{ borderColor: "var(--admin-border)", backgroundColor: "var(--bg-primary,#fff)" }}
            />
          </form>
        </FilterField>
        <FilterField label="Status">
          <select
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value); }}
            className="h-[34px] rounded-md border px-2 text-[12px] outline-none"
            style={{ borderColor: "var(--admin-border)", backgroundColor: "var(--bg-primary,#fff)" }}
          >
            {CUSTOMER_STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? titleCase(s) : "All statuses"}
              </option>
            ))}
          </select>
        </FilterField>
        <V2Button variant="primary" onClick={applySearch} icon={<Search className="h-4 w-4" />}>
          Apply
        </V2Button>
      </FilterCard>

      {err ? (
        <V2Card className="mb-4">
          <div className="p-4 text-[13px]" style={{ color: "var(--admin-danger)" }}>{err}</div>
        </V2Card>
      ) : null}

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No customers found"
          subtitle="No B2C customers match the current filter."
        />
      ) : (
        <V2Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead style={{ backgroundColor: "var(--admin-bg-secondary)" }}>
                <tr>
                  {["Customer", "Status", "Phone", "Bookings", "Joined"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]"
                      style={{ color: "var(--admin-text-secondary)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const tone = pickAvatarTone(c.id);
                  return (
                    <tr
                      key={c.id}
                      className="border-t transition hover:bg-[color:var(--admin-bg-secondary)]"
                      style={{ borderColor: "var(--admin-border)" }}
                    >
                      <td className="px-4 py-2.5">
                        <Link href={`/crm/customers/${c.id}`} className="flex items-center gap-2.5">
                          <span
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold"
                            style={avatarStyle(tone)}
                          >
                            {avatarInitials(c.name)}
                          </span>
                          <span>
                            <span className="block font-medium" style={{ color: "var(--admin-text-primary)" }}>
                              {c.name || "—"}
                            </span>
                            <span className="block text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                              {c.email}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusTone(c.status))}>
                          {c.status || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--admin-text-secondary)" }}>
                        {c.phone || "—"}
                      </td>
                      <td className="px-4 py-2.5">{c.bookings_count}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--admin-text-secondary)" }}>
                        {formatRelativeTime(c.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {meta ? (
            <div className="px-4 pb-4">
              <PaginationBar meta={meta} onPage={(p) => setPage(p)} />
            </div>
          ) : null}
        </V2Card>
      )}
    </div>
  );
}
