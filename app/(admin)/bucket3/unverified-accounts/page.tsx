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

  Pagination,
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
} from "@/components/ui/v2";
import { Download, Search } from "lucide-react";
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
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.bucket3.unverified_accounts.title") },
        ]}
        title={t("admin.bucket3.unverified_accounts.title")}
        subtitle={
          meta
            ? t("admin.bucket3.unverified_accounts.subtitle_count").replace("{count}", String(meta.total))
            : t("admin.bucket3.unverified_accounts.subtitle")
        }
        actions={
          <V2Button icon={<Download className="h-4 w-4" />}>Export</V2Button>
        }
      />

      <SectionTabs
        activeHref="/bucket3/unverified-accounts"
        items={[
          { href: "/platform/approvals", label: "Approval queue" },
          { href: "/platform/companies", label: "Companies access" },
          { href: "/platform/seller-applications", label: "Seller applications" },
          { href: "/platform/contracts", label: "Partnership agreements" },
          { href: "/platform/contract-templates", label: "Contract templates" },
          { href: "/platform/audit-logs", label: "Audit logs" },
          { href: "/bucket3/service-logs", label: "Service logs" },
          { href: "/bucket3/unverified-accounts", label: "Unverified accounts", count: meta?.total },
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
              placeholder={t("admin.bucket3.unverified_accounts.search_placeholder")}
              className="h-[34px] w-full rounded-md border bg-white pl-8 pr-3 text-[12px] outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
            />
          </div>
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
          {rows.map((u) => {
            const tone = pickAvatarTone(u.id);
            return (
            <TR key={u.id} href={`/platform/users/${u.id}`}>
              <TD className="tabular-nums text-fg-t7 font-mono text-xs">#{u.id}</TD>
              <TD>
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={avatarStyle(tone)}
                    aria-hidden
                  >
                    {getInitials(u.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-fg-t8 truncate">{u.name}</div>
                    <div className="text-[11px] text-fg-t6 truncate">{u.email}</div>
                  </div>
                </div>
              </TD>
              <TD className="text-xs">{u.email}</TD>
              <TD>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={statusBadgeStyle(u.status)}
                >
                  {u.status}
                </span>
              </TD>
              <TD>
                {u.email_verified_at ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px]">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: "var(--admin-success)" }}
                    />
                    <span>{formatDate(u.email_verified_at, lang)}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[12px]">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: "var(--admin-warning)" }}
                    />
                    <span>{t("admin.bucket3.unverified_accounts.not_verified")}</span>
                  </span>
                )}
              </TD>
              <TD className="text-xs text-fg-t7 capitalize">{u.intended_role ?? "—"}</TD>
              <TD className="text-xs text-fg-t6">
                {u.companies.length === 0
                  ? t("admin.bucket3.unverified_accounts.b2c_no_company")
                  : u.companies.map((c) => c.name).join(", ")}
              </TD>
              <TD className="text-xs text-fg-t6" title={u.created_at ?? undefined}>{formatRelativeTime(u.created_at)}</TD>
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

// v2 admin-redesign helpers.
function getInitials(name: string): string {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

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

function statusBadgeStyle(status: string): React.CSSProperties {
  switch (status) {
    case "approved":
    case "active":
    case "verified":
      return { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" };
    case "pending":
      return { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" };
    case "rejected":
    case "disabled":
    case "unverified":
      return { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" };
    default:
      return { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" };
  }
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
