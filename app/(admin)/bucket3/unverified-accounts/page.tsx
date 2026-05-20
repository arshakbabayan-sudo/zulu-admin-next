"use client";

/**
 * Phase 7.8 — Unverified accounts.
 *
 * Replaces the ComingSoonPage placeholder. Surfaces users where attention is
 * still needed: status='pending' OR never confirmed their email. Backend
 * sorts oldest first so the queue surfaces stragglers.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
import {
  PageHeader,
  Pagination,
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
import { useCallback, useEffect, useState } from "react";

type UnverifiedRow = {
  id: number;
  name: string;
  email: string;
  status: string;
  email_verified_at: string | null;
  intended_role: string | null;
  created_at: string | null;
  companies: { id: number; name: string; role: string }[];
};

async function fetchUnverified(
  token: string,
  page: number,
  search: string
): Promise<ApiSuccessEnvelope<UnverifiedRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", "25");
  if (search) q.set("search", search);
  return apiFetchJson(`/platform-admin/unverified-accounts?${q.toString()}`, {
    method: "GET",
    token,
  });
}

export default function Bucket3UnverifiedAccountsPage() {
  const { token, user } = useAdminAuth();
  const { t, lang } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<UnverifiedRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await fetchUnverified(token, page, search.trim());
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load unverified accounts");
    }
  }, [token, allowed, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.bucket3.unverified_accounts.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.bucket3.unverified_accounts.title")}
        subtitle={
          meta
            ? t("admin.bucket3.unverified_accounts.subtitle_count").replace("{count}", String(meta.total))
            : t("admin.bucket3.unverified_accounts.subtitle")
        }
      />

      <div className="admin-card p-4">
        <div className="relative max-w-md">
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
            placeholder={t("admin.bucket3.unverified_accounts.search_placeholder")}
            className="h-10 w-full rounded-zulu border border-default bg-white pl-9 pr-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
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
            <TH>{t("admin.bucket3.unverified_accounts.col.name")}</TH>
            <TH>{t("admin.bucket3.unverified_accounts.col.email")}</TH>
            <TH>{t("admin.bucket3.unverified_accounts.col.status")}</TH>
            <TH>{t("admin.bucket3.unverified_accounts.col.email_verified")}</TH>
            <TH>{t("admin.bucket3.unverified_accounts.col.intended_role")}</TH>
            <TH>{t("admin.bucket3.unverified_accounts.col.companies")}</TH>
            <TH>{t("admin.bucket3.unverified_accounts.col.registered")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={8}>{t("admin.bucket3.unverified_accounts.empty")}</TEmpty>
          ) : null}
          {rows.map((u) => (
            <TR key={u.id} href={`/platform/users/${u.id}`}>
              <TD className="tabular-nums text-fg-t7">{u.id}</TD>
              <TD className="font-medium text-fg-t8">{u.name}</TD>
              <TD className="text-xs">{u.email}</TD>
              <TD>
                <StatusPill status={u.status}>{u.status}</StatusPill>
              </TD>
              <TD>
                {u.email_verified_at ? (
                  <span className="text-xs text-success-700">{formatDate(u.email_verified_at, lang)}</span>
                ) : (
                  <span className="text-xs text-warning-700">{t("admin.bucket3.unverified_accounts.not_verified")}</span>
                )}
              </TD>
              <TD className="text-xs text-fg-t7 capitalize">{u.intended_role ?? "—"}</TD>
              <TD className="text-xs text-fg-t6">
                {u.companies.length === 0
                  ? t("admin.bucket3.unverified_accounts.b2c_no_company")
                  : u.companies.map((c) => c.name).join(", ")}
              </TD>
              <TD className="text-xs text-fg-t6">{formatDate(u.created_at, lang)}</TD>
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
