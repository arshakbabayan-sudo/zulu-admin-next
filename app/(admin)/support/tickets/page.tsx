"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessSupportNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { exportRowsAsCsv } from "@/lib/export-csv";
import { apiSupportTickets, type SupportTicketListRow } from "@/lib/support-api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  type BadgeTone,
  Input,

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

  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  IconButton,
} from "@/components/ui/v2";
import { SettingsSubgroupTabs } from "@/components/settings/SettingsSubgroupTabs";
import { Download, Eye } from "lucide-react";

const STATUSES = ["open", "pending", "resolved", "closed"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;

export default function SupportTicketsPage() {
  const { t } = useLanguage();
  const { token, user } = useAdminAuth();
  const allowed = canAccessSupportNav(user);
  const isSuper = user?.is_super_admin === true;
  const [rows, setRows] = useState<SupportTicketListRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [companyIdFilter, setCompanyIdFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const companyIdNum = companyIdFilter.trim() === "" ? undefined : Number(companyIdFilter);
  const companyIdParam =
    isSuper && companyIdNum !== undefined && Number.isFinite(companyIdNum) && companyIdNum > 0
      ? companyIdNum
      : undefined;

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiSupportTickets(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: search.trim() || undefined,
        company_id: companyIdParam,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.common.failed"));
    }
  }, [token, allowed, page, statusFilter, priorityFilter, search, companyIdParam, t]);

  useEffect(() => { load(); }, [load]);

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.support.tickets_title")}</h1>
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
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.support.tickets_title") },
        ]}
        title={t("admin.support.tickets_title")}
        actions={
          <V2Button
            icon={<Download className="h-4 w-4" />}
            disabled={rows.length === 0}
            onClick={() =>
              exportRowsAsCsv("support-tickets", rows, [
                ["id", (r) => r.id],
                ["subject", (r) => r.subject],
                ["status", (r) => r.status],
                ["priority", (r) => r.priority],
                ["company_id", (r) => r.company_id ?? ""],
                ["user_name", (r) => r.user?.name ?? ""],
                ["user_email", (r) => r.user?.email ?? ""],
                ["messages_count", (r) => r.messages_count ?? 0],
                ["created_at", (r) => r.created_at ?? ""],
                ["updated_at", (r) => r.updated_at ?? ""],
              ])
            }
          >
            Export
          </V2Button>
        }
      />

      <SettingsSubgroupTabs activeHref="/support/tickets" />

      <FilterCard>
        <FilterField label={t("admin.support.status")} minWidth={140}>
          <Select id="t-status" fieldSize="sm" value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }} className="!h-[34px]">
            <option value="">{t("common.all")}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </FilterField>
        <FilterField label={t("admin.support.priority")} minWidth={140}>
          <Select id="t-pri" fieldSize="sm" value={priorityFilter} onChange={(e) => { setPage(1); setPriorityFilter(e.target.value); }} className="!h-[34px]">
            <option value="">{t("common.all")}</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </FilterField>
        <FilterField label={t("admin.support.search_subject")} minWidth={200}>
          <Input
            id="t-q"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => setPage(1)}
            placeholder={t("admin.support.placeholder_substring")}
            className="!h-[34px]"
          />
        </FilterField>
        {isSuper && (
          <FilterField label={t("admin.support.company_id")} minWidth={140}>
            <Input
              id="t-co"
              value={companyIdFilter}
              onChange={(e) => setCompanyIdFilter(e.target.value)}
              onBlur={() => setPage(1)}
              placeholder={t("admin.support.placeholder_all")}
              className="!h-[34px] tabular-nums"
            />
          </FilterField>
        )}
        <V2Button size="sm" variant="primary" onClick={() => { setPage(1); load(); }}>{t("admin.support.apply")}</V2Button>
      </FilterCard>

      {err && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.support.table.id")}</TH>
            <TH>{t("admin.support.table.subject")}</TH>
            <TH>{t("admin.support.table.status")}</TH>
            <TH>{t("admin.support.table.priority")}</TH>
            <TH>{t("admin.support.table.company")}</TH>
            <TH>{t("admin.support.table.user")}</TH>
            <TH>{t("admin.support.table.msgs")}</TH>
            <TH align="right" />
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={8}>{t("admin.support.empty") || "No tickets."}</TEmpty> : null}
          {rows.map((r) => {
            const userName = r.user?.name ?? "—";
            const tone = pickAvatarTone(r.user?.id ?? r.id);
            return (
            <TR key={r.id} href={`/support/tickets/${r.id}`}>
              <TD className="tabular-nums text-fg-t7 font-mono text-xs">#{r.id}</TD>
              <TD className="max-w-xs font-medium text-fg-t8">{r.subject}</TD>
              <TD><Badge tone={ticketStatusTone(r.status)}>{r.status}</Badge></TD>
              <TD><Badge tone={priorityTone(r.priority)}>{r.priority}</Badge></TD>
              <TD className="tabular-nums text-xs text-fg-t7">{r.company_id ?? "—"}</TD>
              <TD>
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                    style={avatarStyle(tone)}
                    aria-hidden
                  >
                    {getInitials(userName)}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-fg-t8 truncate text-xs">{userName}</div>
                    {r.user?.id ? (
                      <div className="text-[11px] text-fg-t6 truncate">#{r.user.id}</div>
                    ) : null}
                  </div>
                </div>
              </TD>
              <TD className="tabular-nums text-xs text-fg-t7">{r.messages_count ?? "—"}</TD>
              <TD align="right" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <IconButton as="link" href={`/support/tickets/${r.id}`} aria-label="View">
                    <Eye className="h-4 w-4" />
                  </IconButton>
                </div>
              </TD>
            </TR>
            );
          })}
        </TBody>
      </Table>
      </V2Card>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
    </div>
  );
}

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

function ticketStatusTone(status: string): BadgeTone {
  switch (status) {
    case "open":
    case "resolved":
      return "success";
    case "pending":
    case "in_progress":
      return "warning";
    case "closed":
      return "danger";
    default:
      return "gray";
  }
}

function priorityTone(p: string): BadgeTone {
  switch (p) {
    case "high":
      return "danger";
    case "medium":
      return "warning";
    case "low":
      return "info";
    default:
      return "gray";
  }
}
