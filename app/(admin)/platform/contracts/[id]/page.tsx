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
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
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

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

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
      else if (e instanceof ApiRequestError && e.status === 404) setErr("Contract not found");
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load contract");
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
      alert(e instanceof ApiRequestError ? e.message : "Send failed");
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
      alert(e instanceof ApiRequestError ? e.message : "Counter-sign failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTerminate() {
    if (!token || !row) return;
    const reason = terminateReason.trim();
    if (reason.length === 0) {
      alert("Termination reason is required.");
      return;
    }
    setBusyAction("terminate");
    try {
      await apiAdminTerminateContract(token, row.id, reason);
      setTerminating(false);
      setTerminateReason("");
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Terminate failed");
    } finally {
      setBusyAction(null);
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
        <Link href="/platform/contracts" className="text-sm text-primary hover:underline">
          ← Back to contracts
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
            <Button variant="outline" size="sm" onClick={() => router.push("/platform/contracts")}>
              ← Back
            </Button>
            {canSend(row.status) && (
              <Button size="sm" disabled={busyAction !== null} onClick={() => void handleSend()}>
                {busyAction === "send" ? "Sending…" : "Send to partner"}
              </Button>
            )}
            {canCountersign(row.status) && (
              <Button size="sm" disabled={busyAction !== null} onClick={() => void handleCountersign()}>
                {busyAction === "countersign" ? "Signing…" : "Counter-sign as ZULU"}
              </Button>
            )}
            {canTerminate(row.status) && !terminating && (
              <Button variant="danger" size="sm" onClick={() => setTerminating(true)}>
                Terminate
              </Button>
            )}
          </div>
        }
      />

      {terminating && (
        <div className="admin-card p-4 space-y-3 border-error-100">
          <h3 className="text-sm font-semibold text-error-700">Terminate contract</h3>
          <p className="text-xs text-fg-t6">
            Provide a reason that will be recorded with the termination. Both parties keep access to the
            terminated contract; status changes to <code className="rounded bg-figma-bg-1 px-1">terminated</code>.
          </p>
          <textarea
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
            placeholder="Reason for termination…"
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
              {busyAction === "terminate" ? "Terminating…" : "Confirm termination"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTerminating(false);
                setTerminateReason("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

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
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">Created by</dt>
              <dd className="text-right text-fg-t8">
                {row.createdBy ? `${row.createdBy.name} (${row.createdBy.email})` : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="admin-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-fg-t8">Schedule</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">Effective</dt>
              <dd className="text-right text-fg-t8">{formatDate(row.effective_date)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">Expires</dt>
              <dd className="text-right text-fg-t8">{formatDate(row.expiry_date)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">Auto-renew</dt>
              <dd className="text-right text-fg-t8">{row.auto_renew ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">Notice (days)</dt>
              <dd className="text-right text-fg-t8 tabular-nums">{row.termination_notice_days ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-t6">Language</dt>
              <dd className="text-right text-fg-t8 uppercase">{row.language}</dd>
            </div>
            {row.terminated_at && (
              <>
                <div className="flex justify-between gap-3 border-t border-default pt-2">
                  <dt className="text-fg-t6">Terminated at</dt>
                  <dd className="text-right text-fg-t8">{formatDateTime(row.terminated_at)}</dd>
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
                <div>
                  <span className="font-mono text-fg-t8">v{v.version_number}</span>
                  {v.created_by_user_id && (
                    <span className="ml-2 text-xs text-fg-t6">by user #{v.created_by_user_id}</span>
                  )}
                </div>
                <span className="text-xs text-fg-t6">{formatDateTime(v.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
