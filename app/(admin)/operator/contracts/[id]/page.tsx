"use client";

/**
 * Phase 5b — Seller-side contract detail.
 *
 * Backend: GET /seller/contracts/{id}, POST /seller/contracts/{id}/sign.
 * Mirrors the admin detail layout but with the Sign action instead of
 * send/countersign/terminate. Same component used by /agent/contracts/[id]
 * via re-export.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessOperatorToolsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  apiSellerContract,
  apiSellerSignContract,
  contractStatusLabel,
  contractStatusTier,
  contractTypeLabel,
  type ContractDetail,
} from "@/lib/contracts-api";
import { Button, PageHeader, StatusPill } from "@/components/ui";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function isSignableRow(status: string): boolean {
  return status === "sent" || status === "signed_by_a";
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

export default function SellerContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const { token, user } = useAdminAuth();
  const { lang } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessOperatorToolsNav(user);
  const [row, setRow] = useState<ContractDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [signing, setSigning] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed || !id) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiSellerContract(token, id);
      setRow(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else if (e instanceof ApiRequestError && e.status === 404) setErr("Contract not found");
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load contract");
    }
  }, [token, allowed, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSign() {
    if (!token || !row) return;
    const ok = await confirm({ messageKey: "admin.operator.contracts.confirm_sign" });
    if (!ok) return;
    setSigning(true);
    try {
      await apiSellerSignContract(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Sign failed");
    } finally {
      setSigning(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Contract detail</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Contract detail</h1>
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
        <Link href="/operator/contracts" className="text-sm text-primary hover:underline">
          ← Back to my contracts
        </Link>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Contract detail</h1>
        <div className="admin-card p-4 text-sm text-fg-t6">Loading…</div>
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
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              ← Back
            </Button>
            {isSignableRow(row.status) && (
              <Button size="sm" disabled={signing} onClick={() => void handleSign()}>
                {signing ? "Signing…" : "Sign"}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="admin-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-fg-t8">Parties</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">Party A</dt>
              <dd className="text-right text-fg-t8">
                {row.partyA?.name ?? <span className="text-fg-t6">ZULU</span>}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">Party B</dt>
              <dd className="text-right text-fg-t8">{row.partyB?.name ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="admin-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-fg-t8">Schedule</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">Effective</dt>
              <dd className="text-right text-fg-t8">{formatDate(row.effective_date, lang)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">Expires</dt>
              <dd className="text-right text-fg-t8">{formatDate(row.expiry_date, lang)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">Auto-renew</dt>
              <dd className="text-right text-fg-t8">{row.auto_renew ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">Language</dt>
              <dd className="text-right text-fg-t8 uppercase">{row.language}</dd>
            </div>
            {row.terminated_at && (
              <>
                <div className="flex justify-between gap-3 border-t border-default pt-2">
                  <dt className="text-fg-t6">Terminated at</dt>
                  <dd className="text-right text-fg-t8">{formatDateTime(row.terminated_at, lang)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-t6">Reason</dt>
                  <dd className="text-right text-fg-t8">{row.termination_reason ?? "—"}</dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </div>

      <div className="admin-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-fg-t8">Template</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <div>
            <dt className="text-xs text-fg-t6">Name</dt>
            <dd className="text-fg-t8">{row.template?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-t6">Type</dt>
            <dd className="text-fg-t8">{row.template?.type ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-t6">Version</dt>
            <dd className="text-fg-t8 font-mono">{row.template?.version ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-t6">Language</dt>
            <dd className="text-fg-t8 uppercase">{row.template?.language ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <JsonBlock label="Commission clause" value={row.commission_clause} />
        <JsonBlock label="Payment terms" value={row.payment_terms} />
        <JsonBlock label="Cancellation policy" value={row.cancellation_policy} />
      </div>

      {row.signed_pdf_url && (
        <div className="admin-card p-4">
          <h3 className="mb-2 text-sm font-semibold text-fg-t8">Signed PDF</h3>
          <a
            href={row.signed_pdf_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Download signed PDF →
          </a>
        </div>
      )}

      {row.versions && row.versions.length > 0 && (
        <div className="admin-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-fg-t8">Version history</h3>
          <ul className="space-y-2 text-sm">
            {row.versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-zulu border border-default px-3 py-2"
              >
                <span className="font-mono text-fg-t8">v{v.version_number}</span>
                <span className="text-xs text-fg-t6">{formatDateTime(v.created_at, lang)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
