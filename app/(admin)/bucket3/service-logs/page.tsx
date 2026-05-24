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
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
import { formatDateTime } from "@/lib/format";
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
} from "@/components/ui/v2";
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
  const { t, lang } = useLanguage();
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
        <h1 className="admin-page-title">{t("admin.bucket3.service_logs.title")}</h1>
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
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.bucket3.service_logs.title") },
        ]}
        title={t("admin.bucket3.service_logs.title")}
        subtitle={
          meta
            ? t("admin.bucket3.service_logs.subtitle_count")
                .replace("{count}", String(meta.total))
                .replace("{page}", String(meta.current_page))
                .replace("{last}", String(meta.last_page))
            : t("admin.bucket3.service_logs.subtitle")
        }
        actions={
          <Link
            href="/platform/audit-logs"
            className="inline-flex h-10 items-center rounded-md border-2 border-primary-500 px-4 text-ds-button-s font-ds-button-s font-semibold text-primary-500 transition hover:bg-primary-50"
          >
            {t("admin.bucket3.service_logs.full_audit_log")}
          </Link>
        }
      />

      <SectionTabs
        activeHref="/bucket3/service-logs"
        items={[
          { href: "/platform/approvals", label: "Approval queue" },
          { href: "/platform/companies", label: "Companies access" },
          { href: "/platform/seller-applications", label: "Seller applications" },
          { href: "/platform/contracts", label: "Partnership agreements" },
          { href: "/platform/contract-templates", label: "Contract templates" },
          { href: "/platform/audit-logs", label: "Audit logs" },
          { href: "/bucket3/service-logs", label: "Service logs", count: meta?.total },
          { href: "/bucket3/unverified-accounts", label: "Unverified accounts" },
        ]}
      />

      <FilterCard>
        <FilterField label="Search" minWidth={220}>
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
              placeholder={t("admin.bucket3.service_logs.search_placeholder")}
              className="h-[34px] w-full rounded-md border bg-white pl-8 pr-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            />
          </div>
        </FilterField>
        <FilterField label={t("admin.bucket3.service_logs.filter.category")}>
          <Select
            fieldSize="sm"
            value={category}
            onChange={(e) => {
              setPage(1);
              setCategory(e.target.value as ServiceCategory | "");
            }}
            className="!h-[34px] !min-w-[160px]"
          >
            <option value="">{t("admin.bucket3.service_logs.all_categories")}</option>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
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
            <TH>{t("admin.bucket3.service_logs.col.category")}</TH>
            <TH>{t("admin.bucket3.service_logs.col.action")}</TH>
            <TH>{t("admin.bucket3.service_logs.col.actor")}</TH>
            <TH>{t("admin.bucket3.service_logs.col.subject")}</TH>
            <TH>{t("admin.bucket3.service_logs.col.when")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={6}>{t("admin.bucket3.service_logs.empty")}</TEmpty>
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
              <TD className="text-xs text-fg-t6">{formatDateTime(r.created_at, lang)}</TD>
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
