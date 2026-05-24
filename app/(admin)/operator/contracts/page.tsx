"use client";

/**
 * Phase 5 — Operator contracts list (seller side).
 * Backend: GET /seller/contracts. Returns contracts where the user belongs to
 * either party_a or party_b. No pagination on backend (returns plain array).
 *
 * Same view is rendered for /agent/contracts — both are sellers from the
 * backend perspective.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { canAccessOperatorToolsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiSellerContracts,
  apiSellerSignContract,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  contractStatusLabel,
  contractStatusTier,
  contractTypeLabel,
  type ContractRow,
  type ContractStatus,
  type ContractType,
} from "@/lib/contracts-api";
import {
  Button,
  PageHeader,
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
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
} from "@/components/ui/v2";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDate } from "@/lib/format";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

/** A row is signable if the partner side has not signed yet and the contract
 * is in a state that allows signing (`sent` or `signed_by_a`). */
function isSignableRow(r: ContractRow): boolean {
  return r.status === "sent" || r.status === "signed_by_a";
}

export default function OperatorContractsPage() {
  const { t, lang } = useLanguage();
  const { token, user } = useAdminAuth();
  const confirm = useConfirm();
  const allowed = canAccessOperatorToolsNav(user);
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<ContractType | "">("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [signingId, setSigningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiSellerContracts(token);
      setRows(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load contracts");
    }
  }, [token, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSign(id: string) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.operator.contracts.confirm_sign" });
    if (!ok) return;
    setSigningId(id);
    try {
      await apiSellerSignContract(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Sign failed");
    } finally {
      setSigningId(null);
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (typeFilter && r.type !== typeFilter) return false;
      return true;
    });
  }, [rows, statusFilter, typeFilter]);

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">My contracts</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign (2026-05-24) — sales workspace contracts page.
          Matches docs/zulu-admin-v2.html page-view#sales (lines 578-597). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Sales workspace", href: "/agent/contracts" },
          { label: "My contracts" },
        ]}
        title="My contracts"
        subtitle={`${rows.length} total · ${filteredRows.length} shown · agent contracts and sales agreements`}
      />

      <FilterCard>
        <FilterField label="Status" minWidth={160}>
          <Select
            fieldSize="sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContractStatus | "")}
            className="!h-[34px] !w-full"
          >
            <option value="">{t("common.all")}</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {contractStatusLabel(s)}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Type" minWidth={200}>
          <Select
            fieldSize="sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ContractType | "")}
            className="!h-[34px] !w-full"
          >
            <option value="">{t("common.all")}</option>
            {CONTRACT_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {contractTypeLabel(tp)}
              </option>
            ))}
          </Select>
        </FilterField>
        <V2Button size="sm" onClick={() => void load()} icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}>
          Refresh
        </V2Button>
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
            <TH>Type</TH>
            <TH>Status</TH>
            <TH>Counter party</TH>
            <TH>Template</TH>
            <TH>Effective</TH>
            <TH>Expires</TH>
            <TH align="right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {filteredRows.length === 0 ? (
            <TEmpty colSpan={8}>
              {rows.length === 0
                ? "You don't have any contracts yet. ZULU will send you a contract when you're approved as a partner."
                : "No contracts match the current filters."}
            </TEmpty>
          ) : null}
          {filteredRows.map((r) => (
            <TR key={r.id} href={`/operator/contracts/${r.id}`}>
              <TD className="font-mono text-xs text-fg-t8">{r.contract_number}</TD>
              <TD className="text-xs text-fg-t7">{contractTypeLabel(r.type)}</TD>
              <TD>
                <StatusPill status={contractStatusTier(r.status)}>
                  {contractStatusLabel(r.status)}
                </StatusPill>
              </TD>
              <TD>
                {r.partyA?.name ?? <span className="text-fg-t6">ZULU</span>}
                <span className="mx-1 text-fg-t6">↔</span>
                {r.partyB?.name ?? "—"}
              </TD>
              <TD className="text-xs text-fg-t7">
                {r.template?.name ?? "—"}
                {r.template?.language ? (
                  <span className="ml-1 text-fg-t6">({r.template.language.toUpperCase()})</span>
                ) : null}
              </TD>
              <TD className="text-xs text-fg-t6">{formatDate(r.effective_date, lang)}</TD>
              <TD className="text-xs text-fg-t6">{formatDate(r.expiry_date, lang)}</TD>
              <TD align="right">
                {isSignableRow(r) ? (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={signingId === r.id}
                    onClick={() => void handleSign(r.id)}
                  >
                    {signingId === r.id ? "Signing…" : "Sign"}
                  </Button>
                ) : (
                  <span className="text-xs text-fg-t6">—</span>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      </V2Card>
    </div>
  );
}
