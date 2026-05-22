"use client";

/**
 * Phase 5b — Contract template list (admin).
 * Backend: GET /platform-admin/contract-templates.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import {
  apiAdminContractTemplates,
  CONTRACT_LANGUAGES,
  CONTRACT_TYPES,
  contractTypeLabel,
  type ContractLanguage,
  type ContractTemplateRow,
  type ContractType,
} from "@/lib/contracts-api";
import {
  Button,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function PlatformContractTemplatesPage() {
  const { token, user } = useAdminAuth();
  const { lang, t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<ContractTemplateRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<ContractType | "">("");
  const [langFilter, setLangFilter] = useState<ContractLanguage | "">("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiAdminContractTemplates(token, {
        per_page: 100,
        type: typeFilter || undefined,
        language: langFilter || undefined,
      });
      setRows(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.contract_templates.err_load_failed"));
    }
  }, [token, allowed, typeFilter, langFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.contract_templates.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.contract_templates.title")}
        subtitle={`${rows.length} ${t("admin.contract_templates.meta_count_suffix")}`}
        actions={
          <Link
            href="/platform/contract-templates/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-500 px-4 text-ds-button-s font-ds-button-s font-semibold text-white transition hover:bg-purple-dark"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("admin.contract_templates.btn_new")}
          </Link>
        }
      />

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">{t("admin.contract_templates.filter_type")}</span>
            <Select
              fieldSize="sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ContractType | "")}
              className="!w-auto min-w-[200px]"
            >
              <option value="">{t("common.all")}</option>
              {CONTRACT_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {contractTypeLabel(tp)}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-t6">
            <span className="font-medium text-fg-t7">{t("admin.contract_templates.filter_language")}</span>
            <Select
              fieldSize="sm"
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value as ContractLanguage | "")}
              className="!w-auto min-w-[120px]"
            >
              <option value="">{t("common.all")}</option>
              {CONTRACT_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </Select>
          </label>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t("admin.crud.common.refresh")}
          </Button>
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
            <TH>{t("admin.contract_templates.col_name")}</TH>
            <TH>{t("admin.contract_templates.col_type")}</TH>
            <TH>{t("admin.contract_templates.col_language")}</TH>
            <TH>{t("admin.contract_templates.col_version")}</TH>
            <TH>{t("admin.contract_templates.col_published")}</TH>
            <TH>{t("admin.contract_templates.col_updated")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={6}>
              {t("admin.contract_templates.empty_state")}{" "}
              <Link href="/platform/contract-templates/new" className="text-primary hover:underline">
                {t("admin.contract_templates.empty_state_cta")} →
              </Link>
            </TEmpty>
          ) : null}
          {rows.map((tpl) => (
            <TR key={tpl.id} href={`/platform/contract-templates/${tpl.id}`}>
              <TD className="font-medium text-fg-t8">{tpl.name}</TD>
              <TD className="text-xs text-fg-t7">{contractTypeLabel(tpl.type)}</TD>
              <TD className="uppercase text-fg-t7">{tpl.language}</TD>
              <TD className="font-mono text-xs text-fg-t8">{tpl.version ?? "—"}</TD>
              <TD>
                {tpl.is_published ? (
                  <span className="text-xs font-medium text-success-700">{t("admin.contract_templates.status_published")}</span>
                ) : (
                  <span className="text-xs text-fg-t6">{t("admin.contract_templates.status_draft")}</span>
                )}
              </TD>
              <TD className="text-xs text-fg-t6">{formatDate(tpl.updated_at, lang)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
