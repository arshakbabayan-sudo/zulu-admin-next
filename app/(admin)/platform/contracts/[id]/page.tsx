"use client";

/**
 * Phase 5b — Admin contract detail page.
 *
 * Surfaces:
 * - Header metadata (number, type, status pill, language, dates)
 * - Parties (party A = ZULU for platform-type, partner company for partner-type;
 *   party B = the seller company)
 * - Template reference
 * - Commission clause / payment terms / cancellation policy JSON viewers
 * - Version history (versions[] with version_number + created_at)
 * - Action buttons (state-dependent):
 *    - Send: draft → sent
 *    - Countersign: signed_by_b → countersigned (ZULU side)
 *    - Terminate: active → terminated (with reason)
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  apiAdminContract,
  apiAdminCountersignContract,
  apiAdminSendContract,
  apiAdminTerminateContract,
  contractStatusLabel,
  contractStatusTier,
  contractTypeLabel,
  type ContractDetail,
} from "@/lib/contracts-api";
import { Button, PageHeader, StatusPill } from "@/components/ui";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function canSend(status: string): boolean {
  return status === "draft";
}

function canCountersign(status: string): boolean {
  // ZULU side (party A) counter-signs after partner (party B) has signed.
  return status === "signed_by_b";
}

function canTerminate(status: string): boolean {
  return status === "active" || status === "countersigned";
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  const empty = typeof value === "object" && value !== null && Object.keys(value as object).length === 0;
  if (empty) return null;
  return (
    <div className="rounded-zulu border border-default bg-figma-bg-1/50 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-t6">{label}</div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-fg-t8">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default function AdminContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const { token, user } = useAdminAuth();
  const { lang, t } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessPlatformAdminNav(user);
  const [row, setRow] = useState<ContractDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyAction, setBusyAction] = useState<"send" | "countersign" | "terminate" | null>(null);
  const [terminating, setTerminating] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");

  const load = useCallback(async () => {
    if (!token || !allowed || !id) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiAdminContract(token, id);
      setRow(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else if (e instanceof ApiRequestError && e.status === 404) setErr(t("admin.contract_detail.err_not_found"));
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.contract_detail.err_load"));
    }
  }, [token, allowed, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSend() {
    if (!token || !row) return;
    const ok = await confirm({ messageKey: "admin.platform_contracts.confirm_send_for_signing" });
    if (!ok) return;
    setBusyAction("send");
    try {
      await apiAdminSendContract(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.contract_detail.err_send"));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCountersign() {
    if (!token || !row) return;
    const ok = await confirm({ messageKey: "admin.platform_contracts.confirm_counter_sign" });
    if (!ok) return;
    setBusyAction("countersign");
    try {
      await apiAdminCountersignContract(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.contract_detail.err_countersign"));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTerminate() {
    if (!token || !row) return;
    const reason = terminateReason.trim();
    if (reason.length === 0) {
      alert(t("admin.contract_detail.err_reason_required"));
      return;
    }
    setBusyAction("terminate");
    try {
      await apiAdminTerminateContract(token, row.id, reason);
      setTerminating(false);
      setTerminateReason("");
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.contract_detail.err_terminate"));
    } finally {
      setBusyAction(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.contract_detail.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.contract_detail.title")}</h1>
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
        <Link href="/platform/contracts" className="text-sm text-primary hover:underline">
          ← {t("admin.contract_detail.back_to_contracts")}
        </Link>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.contract_detail.title")}</h1>
        <div className="admin-card p-4 text-sm text-fg-t6">{t("admin.commission.loading")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <span className="font-mono text-base">{row.contract_number}</span>
            <StatusPill status={contractStatusTier(row.status)}>
              {contractStatusLabel(row.status)}
            </StatusPill>
          </span>
        }
        subtitle={contractTypeLabel(row.type)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/platform/contracts")}>
              ← {t("common.back")}
            </Button>
            {canSend(row.status) && (
              <Button size="sm" disabled={busyAction !== null} onClick={() => void handleSend()}>
                {busyAction === "send" ? t("admin.contract_detail.btn_sending") : t("admin.contract_detail.btn_send")}
              </Button>
            )}
            {canCountersign(row.status) && (
              <Button size="sm" disabled={busyAction !== null} onClick={() => void handleCountersign()}>
                {busyAction === "countersign" ? t("admin.contract_detail.btn_signing") : t("admin.contract_detail.btn_countersign")}
              </Button>
            )}
            {canTerminate(row.status) && !terminating && (
              <Button variant="danger" size="sm" onClick={() => setTerminating(true)}>
                {t("admin.contract_detail.btn_terminate")}
              </Button>
            )}
          </div>
        }
      />

      {terminating && (
        <div className="admin-card p-4 space-y-3 border-error-100">
          <h3 className="text-sm font-semibold text-error-700">{t("admin.contract_detail.terminate_title")}</h3>
          <p className="text-xs text-fg-t6">{t("admin.contract_detail.terminate_hint")}</p>
          <textarea
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
            placeholder={t("admin.contract_detail.terminate_reason_placeholder")}
            rows={3}
            className="w-full rounded-zulu border border-default bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={busyAction !== null || terminateReason.trim().length === 0}
              onClick={() => void handleTerminate()}
            >
              {busyAction === "terminate" ? t("admin.contract_detail.btn_terminating") : t("admin.contract_detail.btn_confirm_terminate")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTerminating(false);
                setTerminateReason("");
              }}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="admin-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-fg-t8">{t("admin.contract_detail.parties_section")}</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">{t("admin.contracts.col_party_a")}</dt>
              <dd className="text-right text-fg-t8">
                {row.partyA?.name ?? <span className="text-fg-t6">ZULU</span>}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">{t("admin.contracts.col_party_b")}</dt>
              <dd className="text-right text-fg-t8">{row.partyB?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">{t("admin.contract_detail.created_by")}</dt>
              <dd className="text-right text-fg-t8">
                {row.createdBy ? `${row.createdBy.name} (${row.createdBy.email})` : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="admin-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-fg-t8">{t("admin.contract_new.section.schedule")}</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">{t("admin.contracts.col_effective")}</dt>
              <dd className="text-right text-fg-t8">{formatDate(row.effective_date, lang)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">{t("admin.contracts.col_expires")}</dt>
              <dd className="text-right text-fg-t8">{formatDate(row.expiry_date, lang)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">{t("admin.contract_new.field.auto_renew")}</dt>
              <dd className="text-right text-fg-t8">{row.auto_renew ? t("admin.contract_detail.yes") : t("admin.contract_detail.no")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">{t("admin.contract_detail.notice_days")}</dt>
              <dd className="text-right text-fg-t8 tabular-nums">{row.termination_notice_days ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">{t("admin.contract_new.field.language")}</dt>
              <dd className="text-right text-fg-t8 uppercase">{row.language}</dd>
            </div>
            {row.terminated_at && (
              <>
                <div className="flex justify-between gap-3 border-t border-default pt-2">
                  <dt className="text-fg-t6">{t("admin.contract_detail.terminated_at")}</dt>
                  <dd className="text-right text-fg-t8">{formatDateTime(row.terminated_at, lang)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-t6">{t("admin.contract_detail.reason")}</dt>
                  <dd className="text-right text-fg-t8">{row.termination_reason ?? "—"}</dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </div>

      <div className="admin-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-fg-t8">{t("admin.contracts.col_template")}</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <div>
            <dt className="text-xs text-fg-t6">{t("admin.contract_templates.col_name")}</dt>
            <dd className="text-fg-t8">{row.template?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-t6">{t("admin.contracts.col_type")}</dt>
            <dd className="text-fg-t8">{row.template?.type ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-t6">{t("admin.contract_templates.col_version")}</dt>
            <dd className="text-fg-t8 font-mono">{row.template?.version ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-t6">{t("admin.contract_new.field.language")}</dt>
            <dd className="text-fg-t8 uppercase">{row.template?.language ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <JsonBlock label={t("admin.contract_new.field.commission_clause")} value={row.commission_clause} />
        <JsonBlock label={t("admin.contract_new.field.payment_terms")} value={row.payment_terms} />
        <JsonBlock label={t("admin.contract_new.field.cancellation_policy")} value={row.cancellation_policy} />
      </div>

      {row.signed_pdf_url && (
        <div className="admin-card p-4">
          <h3 className="mb-2 text-sm font-semibold text-fg-t8">{t("admin.contract_detail.signed_pdf")}</h3>
          <a
            href={row.signed_pdf_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            {t("admin.contract_detail.download_signed_pdf")} →
          </a>
        </div>
      )}

      {row.versions && row.versions.length > 0 && (
        <div className="admin-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-fg-t8">{t("admin.contract_detail.version_history")}</h3>
          <ul className="space-y-2 text-sm">
            {row.versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-zulu border border-default px-3 py-2"
              >
                <div>
                  <span className="font-mono text-fg-t8">v{v.version_number}</span>
                  {v.created_by_user_id && (
                    <span className="ml-2 text-xs text-fg-t6">{t("admin.contract_detail.by_user")} #{v.created_by_user_id}</span>
                  )}
                </div>
                <span className="text-xs text-fg-t6">{formatDateTime(v.created_at, lang)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
