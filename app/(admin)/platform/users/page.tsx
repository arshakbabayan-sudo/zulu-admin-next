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
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrompt } from "@/contexts/PromptDialogContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiAnonymizePlatformUser,
  apiDeactivatePlatformUser,
  apiHardDeletePlatformUser,
  apiPlatformUsers,
  type PlatformAdminUserRow,
  type PlatformUserTypeFilter,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";
import { Download, Edit3, MoreVertical, Plus, Search } from "lucide-react";
import {
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
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  IconButton,
} from "@/components/ui/v2";

export default function PlatformUsersPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  useDocumentTitle(t("admin.users.title"));
  const confirm = useConfirm();
  const prompt = usePrompt();
  const allowed = canAccessPlatformAdminNav(user);
  const isSuperAdmin = user?.is_super_admin === true;
  const [rows, setRows] = useState<PlatformAdminUserRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  // Phase 6.4 — type filter merges customers / staff / unverified
  const [typeFilter, setTypeFilter] = useState<PlatformUserTypeFilter>("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformUsers(token, {
        page,
        per_page: 20,
        search: search || undefined,
        type: typeFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.users.err_load"));
    }
  }, [token, allowed, page, search, typeFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deactivate(id: number) {
    if (!token) return;
    const ok = await confirm({
      message: t("admin.users.confirm_deactivate").replace("{id}", String(id)),
      variant: "danger",
    });
    if (!ok) return;
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

  // Phase 7.1 — "Ջնջել" (default platform-admin action)
  // Confirms by requiring the admin to type the user's exact name, then
  // anonymises PII and soft-deletes.
  async function anonymize(row: PlatformAdminUserRow) {
    if (!token) return;
    const typed = await prompt({
      title: t("admin.users.anonymize_title").replace("{name}", row.name),
      description: t("admin.users.anonymize_description"),
      placeholder: row.name,
      required: true,
      variant: "danger",
      confirmLabel: t("admin.users.btn_anonymize_confirm"),
    });
    if (typed === null) return;
    if (typed.trim() !== row.name.trim()) {
      alert(t("admin.users.confirm_name_mismatch"));
      return;
    }
    const reason = await prompt({
      title: t("admin.users.anonymize_reason_title"),
      description: t("admin.users.anonymize_reason_description"),
      placeholder: t("admin.users.reason_placeholder"),
      variant: "default",
    });
    if (reason === null) return;
    setBusyId(row.id);
    try {
      await apiAnonymizePlatformUser(token, row.id, reason || null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.users.err_anonymize"));
    } finally {
      setBusyId(null);
    }
  }

  // Phase 7.1 — "Ամբողջությամբ ջնջել" (super-admin only)
  // Two-step confirmation: type name AND mandatory reason.
  async function hardDelete(row: PlatformAdminUserRow) {
    if (!token || !isSuperAdmin) return;
    const typed = await prompt({
      title: t("admin.users.hard_delete_title").replace("{name}", row.name),
      description: t("admin.users.hard_delete_description"),
      placeholder: row.name,
      required: true,
      variant: "danger",
      confirmLabel: t("admin.users.btn_hard_delete_confirm"),
    });
    if (typed === null) return;
    if (typed.trim() !== row.name.trim()) {
      alert(t("admin.users.confirm_name_mismatch"));
      return;
    }
    const reason = await prompt({
      title: t("admin.users.hard_delete_reason_title"),
      description: t("admin.users.hard_delete_reason_description"),
      placeholder: t("admin.users.reason_placeholder"),
      required: true,
      minLength: 3,
      variant: "danger",
    });
    if (reason === null) return;
    setBusyId(row.id);
    try {
      await apiHardDeletePlatformUser(token, row.id, reason);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.users.err_hard_delete"));
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
    <div>
      {/* v2 admin-redesign — Marketplace ops Users page chrome. */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.users.title_long") },
        ]}
        title={t("admin.users.title_long")}
        subtitle={
          meta
            ? t("admin.users.meta_summary")
                .replace("{total}", String(meta.total))
                .replace("{current}", String(meta.current_page))
                .replace("{last}", String(meta.last_page))
            : undefined
        }
        actions={
          <>
            <V2Button icon={<Download className="h-4 w-4" />}>Export</V2Button>
            <V2Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              Add user
            </V2Button>
          </>
        }
      />

      <SectionTabs
        activeHref="/platform/users"
        items={[
          { href: "/platform/approvals", label: "Approval queue" },
          { href: "/platform/companies", label: "Companies access" },
          { href: "/platform/seller-applications", label: "Seller applications" },
          { href: "/platform/contracts", label: "Partnership agreements" },
          { href: "/platform/contract-templates", label: "Contract templates" },
          { href: "/platform/users", label: "Users", count: meta?.total },
          { href: "/platform/audit-logs", label: "Audit logs" },
          { href: "/bucket3/service-logs", label: "Service logs" },
          { href: "/bucket3/unverified-accounts", label: "Unverified accounts" },
        ]}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <FilterCard>
          <FilterField label={t("admin.users.search_placeholder")}>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-t6"
              />
              <input
                placeholder={t("admin.users.search_placeholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-[34px] w-full rounded-md border bg-white pl-9 pr-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
                style={{ borderColor: "var(--admin-border)" }}
              />
            </div>
          </FilterField>
          <FilterField label={t("admin.users.type_all")}>
            <select
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value as PlatformUserTypeFilter);
              }}
              className="h-[34px] rounded-md border bg-white px-2 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            >
              <option value="">{t("admin.users.type_all")}</option>
              <option value="customers">{t("admin.users.type_customers")}</option>
              <option value="staff">{t("admin.users.type_staff")}</option>
              <option value="unverified">{t("admin.users.type_unverified")}</option>
            </select>
          </FilterField>
          <V2Button type="submit" size="sm" variant="primary">
            {t("common.search")}
          </V2Button>
        </FilterCard>
      </form>

      {err ? (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      ) : null}

      {/* Desktop table */}
      <div className="hidden md:block">
        <V2Card>
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
            {rows.map((r) => {
              const initials = (r.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              const tone = pickAvatarTone(r.id);
              const primaryRole = r.companies && r.companies.length > 0 ? r.companies[0]!.role : null;
              const statusColor =
                r.status === "active"
                  ? "var(--admin-success)"
                  : r.status === "pending"
                    ? "var(--admin-warning)"
                    : r.status === "suspended" || r.status === "banned"
                      ? "var(--admin-danger)"
                      : "var(--admin-text-tertiary)";
              return (
              <TR key={r.id} href={`/platform/users/${r.id}`}>
                <TD className="tabular-nums font-mono text-xs text-fg-t7">#{r.id}</TD>
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
                      <div className="font-medium text-fg-t8 truncate">{r.name}</div>
                      {primaryRole ? (
                        <div className="text-[11px] text-fg-t6 truncate">{primaryRole}</div>
                      ) : null}
                    </div>
                  </div>
                </TD>
                <TD className="text-xs">{r.email}</TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-[12px]">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: statusColor }}
                    />
                    <span className="capitalize">{r.status}</span>
                  </span>
                </TD>
                <TD>
                  {r.companies && r.companies.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {r.companies.slice(0, 3).map((c, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                          style={{
                            backgroundColor: "var(--admin-bg-tertiary)",
                            color: "var(--admin-text-secondary)",
                          }}
                        >
                          {c.name}
                        </span>
                      ))}
                      {r.companies.length > 3 ? (
                        <span
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                          style={{
                            backgroundColor: "var(--admin-bg-tertiary)",
                            color: "var(--admin-text-tertiary)",
                          }}
                        >
                          +{r.companies.length - 3}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-fg-t6">—</span>
                  )}
                </TD>
                <TD align="right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton as="link" href={`/platform/users/${r.id}`} aria-label={k("admin.users.btn_edit", "Edit")}>
                      <Edit3 className="h-4 w-4" />
                    </IconButton>
                    <button
                      type="button"
                      disabled={busyId === r.id || r.status === "inactive"}
                      onClick={(e) => {
                        e.stopPropagation();
                        deactivate(r.id);
                      }}
                      className="inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition disabled:opacity-40"
                      style={{
                        color: "var(--admin-warning)",
                        borderColor: "var(--admin-warning-light)",
                        backgroundColor: "transparent",
                      }}
                    >
                      {t("admin.users.btn_deactivate")}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        anonymize(r);
                      }}
                      title={t("admin.users.btn_anonymize_tooltip")}
                      className="inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition disabled:opacity-40"
                      style={{
                        color: "var(--admin-danger)",
                        borderColor: "var(--admin-danger-light)",
                        backgroundColor: "transparent",
                      }}
                    >
                      {t("admin.users.btn_anonymize")}
                    </button>
                    {isSuperAdmin ? (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          hardDelete(r);
                        }}
                        title={t("admin.users.btn_hard_delete_tooltip")}
                        className="inline-flex h-7 items-center rounded-md border border-error-500 bg-error-600 px-2.5 text-[11px] font-semibold text-white transition hover:bg-error-700 disabled:opacity-40"
                      >
                        {t("admin.users.btn_hard_delete")}
                      </button>
                    ) : (
                      <IconButton aria-label="More">
                        <MoreVertical className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                </TD>
              </TR>
              );
            })}
          </TBody>
        </Table>
        </V2Card>
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
            <div className="flex flex-wrap gap-2 border-t border-default pt-3">
              <Link
                href={`/platform/users/${r.id}`}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-zulu border border-default bg-white px-3 text-sm font-medium text-primary transition hover:bg-figma-bg-1"
              >
                {k("admin.users.btn_edit", "Edit")}
              </Link>
              <button
                type="button"
                disabled={busyId === r.id || r.status === "inactive"}
                onClick={() => deactivate(r.id)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-zulu border border-warning-200 bg-white px-3 text-sm font-medium text-warning-700 transition hover:bg-warning-50 disabled:opacity-40"
              >
                {t("admin.users.btn_deactivate")}
              </button>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => anonymize(r)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-zulu border border-error-200 bg-white px-3 text-sm font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
              >
                {t("admin.users.btn_anonymize")}
              </button>
              {isSuperAdmin ? (
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => hardDelete(r)}
                  className="inline-flex h-10 w-full items-center justify-center rounded-zulu border border-error-500 bg-error-600 px-3 text-sm font-semibold text-white transition hover:bg-error-700 disabled:opacity-40"
                >
                  {t("admin.users.btn_hard_delete")}
                </button>
              ) : null}
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

// v2 admin-redesign helpers — avatar tone deterministic by id.
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
