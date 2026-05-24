"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiApproveGenericApproval,
  apiPlatformApprovals,
  apiRejectGenericApproval,
  type GenericApprovalRow,
} from "@/lib/platform-admin-api";
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

function canActOnApproval(status: string): boolean {
  return status === "pending" || status === "under_review";
}

export default function GenericApprovalsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<GenericApprovalRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [entityTypeDraft, setEntityTypeDraft] = useState("");
  const [entityType, setEntityType] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformApprovals(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        entity_type: entityType || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.approvals.err_load"));
    }
  }, [token, allowed, page, statusFilter, entityType, t]);

  useEffect(() => { load(); }, [load]);

  async function approve(id: number) {
    if (!token) return;
    const decision_notes = window.prompt(t("admin.approvals.prompt_notes_approve")) ?? "";
    setBusyId(id);
    try {
      await apiApproveGenericApproval(token, id, decision_notes.trim() || undefined);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.approvals.err_approve"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    if (!token) return;
    const decision_notes = window.prompt(t("admin.approvals.prompt_notes_reject")) ?? "";
    setBusyId(id);
    try {
      await apiRejectGenericApproval(token, id, decision_notes.trim() || undefined);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.approvals.err_reject"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.approvals.title_short")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Marketplace ops approvals page chrome.
          Matches docs/zulu-admin-v2.html page-view#marketplace (lines 715-748). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Marketplace ops", href: "/platform/approvals" },
          { label: t("admin.approvals.title") },
        ]}
        title={t("admin.approvals.title")}
      />

      <SectionTabs
        activeHref="/platform/approvals"
        items={[
          { href: "/platform/approvals", label: "Approval queue", count: meta?.total },
          { href: "/platform/companies", label: "Companies access" },
          { href: "/platform/seller-applications", label: "Seller applications" },
          { href: "/platform/contracts", label: "Partnership agreements" },
          { href: "/platform/contract-templates", label: "Contract templates" },
          { href: "/platform/audit-logs", label: "Audit logs" },
          { href: "/bucket3/service-logs", label: "Service logs" },
          { href: "/bucket3/unverified-accounts", label: "Unverified accounts" },
        ]}
      />

      <FilterCard>
        <FilterField label={t("admin.approvals.filter_status")} minWidth={180}>
          <Select
            id="ap-status"
            fieldSize="sm"
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="!h-[34px]"
          >
            <option value="">{t("admin.approvals.status_any")}</option>
            <option value="pending">{t("admin.approvals.status_pending")}</option>
            <option value="under_review">{t("admin.approvals.status_under_review")}</option>
            <option value="approved">{t("admin.approvals.status_approved")}</option>
            <option value="rejected">{t("admin.approvals.status_rejected")}</option>
          </Select>
        </FilterField>
        <FilterField label={t("admin.approvals.filter_entity_type")} minWidth={200}>
          <Input
            id="ap-ent"
            value={entityTypeDraft}
            onChange={(e) => setEntityTypeDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setEntityType(entityTypeDraft.trim());
              }
            }}
            placeholder={t("admin.approvals.placeholder_entity_type")}
            className="!h-[34px]"
          />
        </FilterField>
        <V2Button
          size="sm"
          variant="primary"
          onClick={() => { setPage(1); setEntityType(entityTypeDraft.trim()); }}
        >
          {t("admin.approvals.btn_apply_filter")}
        </V2Button>
      </FilterCard>

      {err && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.approvals.col_id")}</TH>
            <TH>{t("admin.approvals.col_entity")}</TH>
            <TH>{t("admin.approvals.col_status")}</TH>
            <TH>{t("admin.approvals.col_priority")}</TH>
            <TH>{t("admin.approvals.col_requested_by")}</TH>
            <TH>{t("admin.approvals.col_created")}</TH>
            <TH>{t("admin.approvals.col_actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={7}>{t("admin.approvals.empty") || "No approvals."}</TEmpty> : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums">{r.id}</TD>
              <TD>
                <span className="font-mono text-xs">{r.entity_type}</span> #{r.entity_id}
              </TD>
              <TD><StatusPill status={r.status} /></TD>
              <TD>{r.priority ?? "—"}</TD>
              <TD className="text-xs">
                {r.requested_by ? (
                  <>
                    {r.requested_by.name}
                    <br />
                    <span className="text-fg-t6">{r.requested_by.email}</span>
                  </>
                ) : (
                  "—"
                )}
              </TD>
              <TD className="text-xs text-fg-t6">{r.created_at ?? "—"}</TD>
              <TD className="space-x-2">
                {canActOnApproval(r.status) ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => approve(r.id)}
                      className="text-xs text-success-700 underline disabled:opacity-40 hover:text-success-800"
                    >
                      {t("admin.approvals.btn_approve")}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => reject(r.id)}
                      className="text-xs text-error-700 underline disabled:opacity-40 hover:text-error-800"
                    >
                      {t("admin.approvals.btn_reject")}
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-fg-t6">—</span>
                )}
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
