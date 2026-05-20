"use client";

/**
 * Phase 6B — operator-side commission settings (default + per-agent overrides).
 *
 * Operator picks a calculation base (gross / post-platform-fee / custom) and
 * a percentage that gets paid to the agent for each referred booking. Adding
 * a per-agent override row lets the operator deviate from default for one
 * specific agent. Booking-time entitlement integration ships in Phase 6B
 * part 2 — this page is the configuration surface.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { canAccessOperatorToolsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiCommissionSettings,
  apiDeleteCommissionOverride,
  apiUpsertCommissionDefault,
  apiUpsertCommissionOverride,
  CALCULATION_BASES,
  calculationBaseLabel,
  type CalculationBase,
  type CommissionConfig,
  type CommissionSettingsResponse,
} from "@/lib/operator-commission-api";
import {
  Button,
  FormField,
  Input,
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
import { useCallback, useEffect, useState } from "react";

type DraftRow = {
  calculation_base: CalculationBase;
  default_percentage: string;
  custom_base_percentage: string;
  notes: string;
};

function configToDraft(c: CommissionConfig | null): DraftRow {
  return {
    calculation_base: c?.calculation_base ?? "gross",
    default_percentage:
      c?.default_percentage != null && Number.isFinite(c.default_percentage)
        ? String(c.default_percentage)
        : "",
    custom_base_percentage:
      c?.custom_base_percentage != null && Number.isFinite(c.custom_base_percentage)
        ? String(c.custom_base_percentage)
        : "",
    notes: c?.notes ?? "",
  };
}

export default function OperatorCommissionSettingsPage() {
  const { token, user } = useAdminAuth();
  const confirm = useConfirm();
  const allowed = canAccessOperatorToolsNav(user);
  const [data, setData] = useState<CommissionSettingsResponse | null>(null);
  const [defaultDraft, setDefaultDraft] = useState<DraftRow>(configToDraft(null));
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Inline editor state for the "add override" form.
  const [overrideAgentId, setOverrideAgentId] = useState("");
  const [overrideDraft, setOverrideDraft] = useState<DraftRow>(configToDraft(null));

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiCommissionSettings(token);
      setData(res.data);
      setDefaultDraft(configToDraft(res.data.default));
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else if (e instanceof ApiRequestError && e.status === 404) {
        setErr("No active operator company on this user.");
      } else setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
    }
  }, [token, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  function parseDraft(d: DraftRow) {
    const num = (s: string) => {
      const t = s.trim();
      if (t === "") return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    };
    return {
      calculation_base: d.calculation_base,
      default_percentage: num(d.default_percentage),
      custom_base_percentage: num(d.custom_base_percentage),
      notes: d.notes.trim() || null,
    };
  }

  async function saveDefault() {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      await apiUpsertCommissionDefault(token, parseDraft(defaultDraft));
      setSavedAt(new Date().toLocaleTimeString());
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveOverride() {
    if (!token) return;
    const id = Number(overrideAgentId.trim());
    if (!Number.isFinite(id) || id <= 0) {
      setErr("Pick a valid agent company id");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiUpsertCommissionOverride(token, id, parseDraft(overrideDraft));
      setSavedAt(new Date().toLocaleTimeString());
      setOverrideAgentId("");
      setOverrideDraft(configToDraft(null));
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeOverride(agentCompanyId: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.operator.commission_settings.confirm_remove_override", variant: "danger" });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      await apiDeleteCommissionOverride(token, agentCompanyId);
      setSavedAt(new Date().toLocaleTimeString());
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Agent commission</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent commission"
        subtitle="Configure how much commission your downstream agents earn on referred bookings."
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}
      {savedAt && (
        <div className="rounded-zulu border border-success-200 bg-success-50 px-4 py-2 text-sm text-success-700">
          Saved at {savedAt}
        </div>
      )}

      {!data ? (
        <div className="admin-card p-4 text-sm text-fg-t6">Loading…</div>
      ) : (
        <>
          <section className="admin-card p-4 space-y-3">
            <div>
              <h2 className="text-base font-semibold">Default for all agents</h2>
              <p className="text-xs text-fg-t6">
                Applied to every agent under your company unless an override below changes their rate.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Calculation base" htmlFor="default-base" required>
                <Select
                  id="default-base"
                  value={defaultDraft.calculation_base}
                  onChange={(e) =>
                    setDefaultDraft((p) => ({ ...p, calculation_base: e.target.value as CalculationBase }))
                  }
                >
                  {CALCULATION_BASES.map((b) => (
                    <option key={b} value={b}>
                      {calculationBaseLabel(b)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label="Agent commission %"
                htmlFor="default-percentage"
                helperText="e.g. 5.0 means agent gets 5% of the calculation base"
              >
                <Input
                  id="default-percentage"
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  value={defaultDraft.default_percentage}
                  onChange={(e) =>
                    setDefaultDraft((p) => ({ ...p, default_percentage: e.target.value }))
                  }
                  placeholder="0.000"
                />
              </FormField>
              {defaultDraft.calculation_base === "custom" && (
                <FormField
                  label="Custom base % of gross"
                  htmlFor="default-custom-base"
                  helperText="Use only with the 'Custom' base. e.g. 80 = agent's commission is calculated against 80% of the gross."
                  className="sm:col-span-2"
                >
                  <Input
                    id="default-custom-base"
                    type="number"
                    step="0.001"
                    min="0"
                    max="100"
                    value={defaultDraft.custom_base_percentage}
                    onChange={(e) =>
                      setDefaultDraft((p) => ({ ...p, custom_base_percentage: e.target.value }))
                    }
                  />
                </FormField>
              )}
              <FormField label="Notes" htmlFor="default-notes" className="sm:col-span-2">
                <Input
                  as="textarea"
                  id="default-notes"
                  rows={2}
                  value={defaultDraft.notes}
                  onChange={(e) => setDefaultDraft((p) => ({ ...p, notes: e.target.value }))}
                />
              </FormField>
            </div>
            <div>
              <Button size="sm" disabled={busy} onClick={() => void saveDefault()}>
                {busy ? "Saving…" : "Save default"}
              </Button>
            </div>
          </section>

          <section className="admin-card p-4 space-y-3">
            <div>
              <h2 className="text-base font-semibold">Per-agent overrides</h2>
              <p className="text-xs text-fg-t6">
                Override the default for specific agents (e.g. a strategic partner gets a higher %).
              </p>
            </div>

            <Table>
              <THead>
                <TR>
                  <TH>Agent</TH>
                  <TH>Base</TH>
                  <TH>Percentage</TH>
                  <TH>Notes</TH>
                  <TH align="right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {data.overrides.length === 0 ? (
                  <TEmpty colSpan={5}>No overrides yet — every agent uses the default rate.</TEmpty>
                ) : null}
                {data.overrides.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <div className="font-medium text-fg-t8">{row.agent_company_name ?? "—"}</div>
                      <div className="text-xs text-fg-t6">#{row.agent_company_id}</div>
                    </TD>
                    <TD className="text-xs text-fg-t7">{calculationBaseLabel(row.calculation_base)}</TD>
                    <TD className="tabular-nums">
                      {row.default_percentage != null ? `${row.default_percentage}%` : "—"}
                      {row.calculation_base === "custom" && row.custom_base_percentage != null && (
                        <span className="ml-1 text-xs text-fg-t6">
                          (base {row.custom_base_percentage}%)
                        </span>
                      )}
                    </TD>
                    <TD className="text-xs text-fg-t6">{row.notes ?? "—"}</TD>
                    <TD align="right">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onClick={() => void removeOverride(row.agent_company_id!)}
                      >
                        Remove
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </section>

          <section className="admin-card p-4 space-y-3">
            <h2 className="text-base font-semibold">Add a per-agent override</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Agent company ID" htmlFor="override-agent-id" required>
                <Input
                  id="override-agent-id"
                  type="number"
                  min={1}
                  value={overrideAgentId}
                  onChange={(e) => setOverrideAgentId(e.target.value)}
                  placeholder="e.g. 42"
                />
              </FormField>
              <FormField label="Calculation base" htmlFor="override-base" required>
                <Select
                  id="override-base"
                  value={overrideDraft.calculation_base}
                  onChange={(e) =>
                    setOverrideDraft((p) => ({ ...p, calculation_base: e.target.value as CalculationBase }))
                  }
                >
                  {CALCULATION_BASES.map((b) => (
                    <option key={b} value={b}>
                      {calculationBaseLabel(b)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Agent commission %" htmlFor="override-percentage">
                <Input
                  id="override-percentage"
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  value={overrideDraft.default_percentage}
                  onChange={(e) =>
                    setOverrideDraft((p) => ({ ...p, default_percentage: e.target.value }))
                  }
                />
              </FormField>
              {overrideDraft.calculation_base === "custom" && (
                <FormField label="Custom base % of gross" htmlFor="override-custom-base">
                  <Input
                    id="override-custom-base"
                    type="number"
                    step="0.001"
                    min="0"
                    max="100"
                    value={overrideDraft.custom_base_percentage}
                    onChange={(e) =>
                      setOverrideDraft((p) => ({ ...p, custom_base_percentage: e.target.value }))
                    }
                  />
                </FormField>
              )}
              <FormField label="Notes" htmlFor="override-notes" className="sm:col-span-2">
                <Input
                  as="textarea"
                  id="override-notes"
                  rows={2}
                  value={overrideDraft.notes}
                  onChange={(e) => setOverrideDraft((p) => ({ ...p, notes: e.target.value }))}
                />
              </FormField>
            </div>
            <div>
              <Button size="sm" disabled={busy || !overrideAgentId.trim()} onClick={() => void saveOverride()}>
                {busy ? "Saving…" : "Save override"}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
