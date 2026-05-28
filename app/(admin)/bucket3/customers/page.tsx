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
import {

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
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  IconButton,
} from "@/components/ui/v2";
import { Download, Edit3, Eye, Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { exportRowsAsCsv } from "@/lib/export-csv";

export default function Bucket3CustomersPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
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
        actions={
          <>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              disabled={rows.length === 0}
              onClick={() =>
                exportRowsAsCsv("customers", rows, [
                  ["id", (r) => r.id],
                  ["name", (r) => r.name],
                  ["email", (r) => r.email],
                  ["phone", (r) => r.phone ?? ""],
                  ["status", (r) => r.status],
                  ["preferred_language", (r) => r.preferred_language ?? ""],
                  ["nationality", (r) => r.nationality ?? ""],
                  ["bookings_count", (r) => r.bookings_count],
                  ["created_at", (r) => r.created_at ?? ""],
                ])
              }
            >
              Export
            </V2Button>
            <V2Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              Add customer
            </V2Button>
          </>
        }
      />

      <SectionTabs
        activeHref="/bucket3/customers"
        items={[
          { href: "/bucket3/employees", label: "Employees" },
          { href: "/bucket3/payroll", label: "Payroll" },
          { href: "/bucket3/non-service-hours", label: "Non-service hours" },
          { href: "/bucket3/cases", label: "Cases" },
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
            <TH align="right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={10}>
              {search.trim() || statusFilter ? t("admin.bucket3.customers.empty_filter") : t("admin.bucket3.customers.empty")}
            </TEmpty>
          ) : null}
          {rows.map((c) => {
            const initials = (c.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            const tone = pickAvatarTone(c.id);
            const statusColor =
              c.status === "active"
                ? "var(--admin-success)"
                : c.status === "pending"
                  ? "var(--admin-warning)"
                  : c.status === "suspended" || c.status === "banned"
                    ? "var(--admin-danger)"
                    : "var(--admin-text-tertiary)";
            return (
              <TR key={c.id} href={`/platform/users/${c.id}`}>
                <TD className="tabular-nums font-mono text-xs text-fg-t7">#{c.id}</TD>
                <TD>
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={avatarStyle(tone)}
                      aria-hidden
                    >
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-fg-t8 truncate">{c.name}</div>
                    </div>
                  </div>
                </TD>
                <TD className="text-xs">{c.email}</TD>
                <TD className="text-xs text-fg-t7 font-mono">{c.phone ?? "—"}</TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-[12px]">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: statusColor }}
                    />
                    <span className="capitalize">{c.status}</span>
                  </span>
                </TD>
                <TD className="tabular-nums">{c.bookings_count}</TD>
                <TD className="uppercase text-xs text-fg-t6">{c.preferred_language ?? "—"}</TD>
                <TD className="text-xs text-fg-t6">{c.nationality ?? "—"}</TD>
                <TD className="text-xs text-fg-t6">{formatRelativeTime(c.created_at)}</TD>
                <TD align="right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <IconButton as="link" href={`/platform/users/${c.id}`} aria-label="View">
                      <Eye className="h-4 w-4" />
                    </IconButton>
                    <IconButton as="link" href={`/platform/users/${c.id}`} aria-label="Edit">
                      <Edit3 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </TD>
              </TR>
            );
          })}
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

// v2 admin-redesign helpers — avatar tone + relative time.
function pickAvatarTone(id: number | string): "purple" | "teal" | "amber" | "blue" {
  const tones: Array<"purple" | "teal" | "amber" | "blue"> = ["purple", "teal", "amber", "blue"];
  const n = typeof id === "number" ? id : id.length;
  return tones[n % tones.length]!;
}

function avatarStyle(tone: "purple" | "teal" | "amber" | "blue"): React.CSSProperties {
  const map: Record<"purple" | "teal" | "amber" | "blue", React.CSSProperties> = {
    purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
    teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  };
  return map[tone];
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}
