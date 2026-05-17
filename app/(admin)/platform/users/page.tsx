"use client";

/**
 * Figma layout reference: Quest CRM Copy template
 *   - Client Table (list pattern):           4393:6787
 *   - Settings/Admins (admin-list view):     10013:24500
 * Brand tokens: ZULU purple primary (--admin-primary).
 * Mobile rule: table converts to card list at <md.
 *
 * Phase-2 migration: ported to shared `@/components/ui` primitives
 * (PageHeader, Table, TR/TH/TD/TEmpty, Pagination, Input, Button).
 */

import Link from "next/link";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiDeactivatePlatformUser,
  apiPlatformUsers,
  type PlatformAdminUserRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  Button,
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

export default function PlatformUsersPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformAdminUserRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformUsers(token, { page, per_page: 20, search: search || undefined });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.users.err_load"));
    }
  }, [token, allowed, page, search, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function deactivate(id: number) {
    if (!token || !window.confirm(t("admin.users.confirm_deactivate").replace("{id}", String(id)))) return;
    setBusyId(id);
    try {
      await apiDeactivatePlatformUser(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.users.err_deactivate"));
    } finally {
      setBusyId(null);
    }
  }

  const k = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.users.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice messageKey={!allowed ? "admin.forbidden.platform_users" : undefined} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.users.title_long")}
        subtitle={
          meta
            ? t("admin.users.meta_summary")
                .replace("{total}", String(meta.total))
                .replace("{current}", String(meta.current_page))
                .replace("{last}", String(meta.last_page))
            : undefined
        }
      />

      <form
        className="admin-card flex flex-wrap items-center gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <div className="relative min-w-[220px] flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-t6"
          />
          <input
            placeholder={t("admin.users.search_placeholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-full rounded-zulu border border-default bg-white pl-9 pr-3 text-sm placeholder:text-fg-t6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <Button type="submit" size="sm">
          {t("common.search")}
        </Button>
      </form>

      {err ? (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      ) : null}

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <THead>
            <TR>
              <TH>{t("admin.users.col_id")}</TH>
              <TH>{t("admin.users.col_name")}</TH>
              <TH>{t("admin.users.col_email")}</TH>
              <TH>{t("admin.users.col_status")}</TH>
              <TH>{t("admin.users.col_companies")}</TH>
              <TH align="right">{t("admin.users.col_actions")}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TEmpty colSpan={6}>{t("admin.users.empty")}</TEmpty>
            ) : null}
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="tabular-nums">{r.id}</TD>
                <TD className="font-medium text-fg-t8">{r.name}</TD>
                <TD>{r.email}</TD>
                <TD>
                  <StatusPill status={r.status} />
                </TD>
                <TD>
                  {r.companies && r.companies.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {r.companies.slice(0, 3).map((c, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-default bg-figma-bg-1 px-2 py-0.5 text-xs text-fg-t7"
                        >
                          {c.name}
                          <span className="ml-1 text-fg-t6">({c.role})</span>
                        </span>
                      ))}
                      {r.companies.length > 3 ? (
                        <span className="rounded-full border border-default bg-white px-2 py-0.5 text-xs text-fg-t6">
                          +{r.companies.length - 3}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-fg-t6">—</span>
                  )}
                </TD>
                <TD align="right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      href={`/platform/users/${r.id}`}
                      className="inline-flex h-8 items-center rounded-zulu border border-default bg-white px-3 text-xs font-medium text-primary transition hover:bg-figma-bg-1"
                    >
                      {k("admin.users.btn_edit", "Edit")}
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === r.id || r.status === "inactive"}
                      onClick={() => deactivate(r.id)}
                      className="inline-flex h-8 items-center rounded-zulu border border-error-200 bg-white px-3 text-xs font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
                    >
                      {t("admin.users.btn_deactivate")}
                    </button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 && (
          <div className="admin-card p-6 text-center text-sm text-fg-t6">{t("admin.users.empty")}</div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="admin-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-xs text-fg-t6">#{r.id}</div>
                <div className="truncate font-medium text-fg-t8">{r.name}</div>
                <div className="truncate text-xs text-fg-t6">{r.email}</div>
              </div>
              <StatusPill status={r.status} />
            </div>
            {r.companies && r.companies.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {r.companies.map((c, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-default bg-figma-bg-1 px-2 py-0.5 text-xs text-fg-t7"
                  >
                    {c.name}
                    <span className="ml-1 text-fg-t6">({c.role})</span>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 border-t border-default pt-3">
              <Link
                href={`/platform/users/${r.id}`}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-zulu border border-default bg-white px-3 text-sm font-medium text-primary transition hover:bg-figma-bg-1"
              >
                {k("admin.users.btn_edit", "Edit")}
              </Link>
              <button
                type="button"
                disabled={busyId === r.id || r.status === "inactive"}
                onClick={() => deactivate(r.id)}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-zulu border border-error-200 bg-white px-3 text-sm font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
              >
                {t("admin.users.btn_deactivate")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
    </div>
  );
}
