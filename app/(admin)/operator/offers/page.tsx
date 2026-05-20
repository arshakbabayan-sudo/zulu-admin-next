"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ContentLanguagePill } from "@/components/ContentLanguagePill";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { TranslationsModal } from "@/components/TranslationsModal";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { canAccessOperatorToolsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiOffers, apiPublishOffer, apiArchiveOffer, type OfferRow } from "@/lib/inventory-crud-api";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Button,
  FormField,
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

const STATUSES = ["", "draft", "published", "archived"];

export default function OperatorOffersPage() {
  const { token, user } = useAdminAuth();
  const { t, contentLang } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessOperatorToolsNav(user);
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [translateRow, setTranslateRow] = useState<OfferRow | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiOffers(token, { page, per_page: 20, status: statusFilter || undefined });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, allowed, page, statusFilter, contentLang]);

  useEffect(() => { load(); }, [load]);

  async function handlePublish(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.crud.offers.publish_confirm" });
    if (!ok) return;
    setBusyId(id);
    try { await apiPublishOffer(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  async function handleArchive(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.crud.offers.archive_confirm", variant: "danger" });
    if (!ok) return;
    setBusyId(id);
    try { await apiArchiveOffer(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.crud.offers.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {t("admin.crud.offers.title")}
            <ContentLanguagePill />
          </span>
        }
      />

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={t("admin.crud.offers.filter.status")} htmlFor="off-status" className="max-w-xs">
            <Select
              id="off-status"
              fieldSize="sm"
              value={statusFilter}
              onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s || t("admin.crud.common.all")}</option>)}
            </Select>
          </FormField>
          <Button variant="outline" size="sm" onClick={load}>{t("admin.crud.common.refresh")}</Button>
        </div>
      </div>

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      )}

      <Table>
        <THead>
          <TR>
            <TH>{t("admin.crud.common.id")}</TH>
            <TH>{t("admin.crud.offers.col.title")}</TH>
            <TH>{t("admin.crud.offers.col.type")}</TH>
            <TH>{t("admin.crud.offers.col.price")}</TH>
            <TH>{t("admin.crud.common.status")}</TH>
            <TH>{t("admin.crud.offers.col.company")}</TH>
            <TH>{t("admin.crud.common.actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={7}>{t("admin.crud.offers.empty")}</TEmpty> : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums">{r.id}</TD>
              <TD className="font-medium max-w-[200px] truncate">{r.title}</TD>
              <TD className="text-xs">{r.type}</TD>
              <TD className="tabular-nums">
                {r.price != null ? `${r.currency ?? ""} ${Number(r.price).toFixed(2)}` : "—"}
              </TD>
              <TD><StatusPill status={r.status} /></TD>
              <TD className="text-xs">{r.company?.name ?? r.company_id ?? "—"}</TD>
              <TD>
                <div className="flex flex-col gap-1">
                  {r.status === "draft" && (
                    <button type="button" disabled={busyId === r.id} onClick={() => void handlePublish(r.id)}
                      className="text-left text-xs text-success-700 underline disabled:opacity-40">{t("admin.crud.common.publish")}</button>
                  )}
                  {r.status === "published" && (
                    <button type="button" disabled={busyId === r.id} onClick={() => void handleArchive(r.id)}
                      className="text-left text-xs text-warning-700 underline disabled:opacity-40">{t("admin.crud.common.archive")}</button>
                  )}
                  <button type="button" onClick={() => setTranslateRow(r)}
                    className="text-left text-xs text-info-700 underline">Translations</button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}

      <TranslationsModal
        open={translateRow !== null}
        onClose={() => setTranslateRow(null)}
        entityType="offer"
        entityId={translateRow?.id ?? null}
        entityLabel={translateRow?.title ?? undefined}
        fields={[
          { name: "title", label: "Title" },
          { name: "subtitle", label: "Subtitle" },
          { name: "description", label: "Description", multiline: true },
        ]}
      />
    </div>
  );
}
