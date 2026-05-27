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
import { Search, Eye, Edit3, Download } from "lucide-react";
import Link from "next/link";
import { exportRowsAsCsv } from "@/lib/export-csv";
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
        actions={
          <V2Button
            icon={<Download className="h-4 w-4" />}
            disabled={rows.length === 0}
            onClick={() =>
              exportRowsAsCsv("employees", rows, [
                ["id", (r) => r.id],
                ["name", (r) => r.name],
                ["email", (r) => r.email],
                ["status", (r) => r.status],
                ["companies", (r) => r.companies.map((c) => `${c.name} (${c.role})`).join("; ")],
                ["created_at", (r) => r.created_at ?? ""],
              ])
            }
          >
            Export
          </V2Button>
        }
        // Phase Բ.4 — Option A (2026-05-28). The «+ Add employee» button used
        // to live here but had no onClick; this page is a super-admin
        // cross-company roll-up (uses /platform-admin/users + canAccessPlatformAdminNav).
        // Super-admin already adds employees per-company at /platform/companies/[id] >
        // Users (AddEmployeeModal wired there). Operator-tenant employee page is
        // separate work (Bucket D.4 / Phase Ը). Button removed to stop the dead
        // surface from confusing reviewers.
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
            <TH align="right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={7}>{t("admin.bucket3.employees.empty")}</TEmpty>
          ) : null}
          {rows.map((e) => {
            const initials = (e.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            const tone = pickAvatarTone(e.id);
            const primaryCompany = e.companies[0];
            const statusColor =
              e.status === "active"
                ? "var(--admin-success)"
                : e.status === "pending"
                  ? "var(--admin-warning)"
                  : e.status === "suspended"
                    ? "var(--admin-danger)"
                    : "var(--admin-text-tertiary)";
            return (
              <TR key={e.id}>
                <TD className="tabular-nums text-fg-t7 font-mono text-xs">EMP-{String(e.id).padStart(3, "0")}</TD>
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
                      <div className="font-medium text-fg-t8 truncate">{e.name}</div>
                      {primaryCompany ? (
                        <div className="text-[11px] text-fg-t6 truncate">{primaryCompany.role}</div>
                      ) : null}
                    </div>
                  </div>
                </TD>
                <TD className="text-xs">{e.email}</TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-[12px]">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: statusColor }}
                    />
                    <span className="capitalize">{e.status}</span>
                  </span>
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {e.companies.map((c) => (
                      <Link
                        key={c.id}
                        href={`/platform/companies/${c.id}`}
                        onClick={(ev) => ev.stopPropagation()}
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px] transition"
                        style={{
                          backgroundColor: "var(--admin-bg-tertiary)",
                          color: "var(--admin-text-secondary)",
                        }}
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </TD>
                <TD className="text-xs text-fg-t6">{formatDate(e.created_at, lang)}</TD>
                <TD align="right">
                  <div className="flex justify-end gap-1">
                    <IconButton
                      as="link"
                      href={`/platform/users/${e.id}`}
                      aria-label="View"
                    >
                      <Eye className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      as="link"
                      href={`/platform/users/${e.id}`}
                      aria-label="Edit"
                    >
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

// v2 admin-redesign — deterministic avatar tone picker so same user
// always gets same color (purple/teal/amber/blue rotation).
function pickAvatarTone(id: number): "purple" | "teal" | "amber" | "blue" {
  const tones: Array<"purple" | "teal" | "amber" | "blue"> = ["purple", "teal", "amber", "blue"];
  return tones[id % tones.length]!;
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
