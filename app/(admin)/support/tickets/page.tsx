"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessSupportNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiSupportTickets, type SupportTicketListRow } from "@/lib/support-api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Select,
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
} from "@/components/ui/v2";

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
      />

      <SectionTabs
        activeHref="/support/tickets"
        items={[
          { href: "/settings/pricing-rules", label: "Pricing rules" },
          { href: "/settings/money-flow", label: "Money flow" },
          { href: "/localization/languages", label: "Languages" },
          { href: "/localization/templates", label: "Email templates" },
          { href: "/platform/banners", label: "Banners" },
          { href: "/pages", label: "CMS pages" },
          { href: "/platform/notifications", label: "System notifications" },
          { href: "/platform/newsletter", label: "Newsletter" },
          { href: "/platform/loyalty", label: "Loyalty" },
          { href: "/bucket3/block-dates", label: "Block dates" },
          { href: "/bucket3/custom-fields", label: "Custom fields" },
          { href: "/platform/security", label: "Security" },
          { href: "/platform/webhooks", label: "Webhooks" },
          { href: "/platform/locations", label: "Locations" },
          { href: "/platform/settings/brand", label: "Brand" },
          { href: "/connections", label: "Connections" },
          { href: "/support/tickets", label: "Support", count: meta?.total },
          { href: "/platform/reviews", label: "Reviews" },
        ]}
      />

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
            <TH />
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={8}>{t("admin.support.empty") || "No tickets."}</TEmpty> : null}
          {rows.map((r) => (
            <TR key={r.id} href={`/support/tickets/${r.id}`}>
              <TD className="tabular-nums">{r.id}</TD>
              <TD className="max-w-xs">{r.subject}</TD>
              <TD><StatusPill status={r.status} /></TD>
              <TD>{r.priority}</TD>
              <TD className="tabular-nums">{r.company_id ?? "—"}</TD>
              <TD className="text-xs">{r.user?.name ?? "—"}</TD>
              <TD className="tabular-nums">{r.messages_count ?? "—"}</TD>
              <TD onClick={(e) => e.stopPropagation()}>
                <span className="text-xs text-primary-500 hover:text-primary-700">{t("admin.support.open")}</span>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      </V2Card>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
    </div>
  );
}
