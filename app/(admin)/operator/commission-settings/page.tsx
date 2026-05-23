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
import { useLanguage } from "@/contexts/LanguageContext";
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
  const { t, lang } = useLanguage();
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
        setErr(t("admin.commission.err_no_operator"));
      } else setErr(e instanceof ApiRequestError ? e.message : t("admin.commission.err_load"));
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
      setSavedAt(new Date().toLocaleTimeString(lang));
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.commission.err_save"));
    } finally {
      setBusy(false);
    }
  }

  async function saveOverride() {
    if (!token) return;
    const id = Number(overrideAgentId.trim());
    if (!Number.isFinite(id) || id <= 0) {
      setErr(t("admin.commission.err_invalid_agent_id"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiUpsertCommissionOverride(token, id, parseDraft(overrideDraft));
      setSavedAt(new Date().toLocaleTimeString(lang));
      setOverrideAgentId("");
      setOverrideDraft(configToDraft(null));
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.commission.err_save"));
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
      setSavedAt(new Date().toLocaleTimeString(lang));
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.commission.err_remove"));
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.commission.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.commission.title")}
        subtitle={t("admin.commission.subtitle")}
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}
      {savedAt && (
        <div className="rounded-zulu border border-success-200 bg-success-50 px-4 py-2 text-sm text-success-700">
          {t("admin.commission.saved_at")} {savedAt}
        </div>
      )}

      {!data ? (
        <div className="admin-card p-4 text-sm text-fg-t6">{t("admin.commission.loading")}</div>
      ) : (
        <>
          <section className="admin-card p-4 space-y-3">
            <div>
              <h2 className="text-base font-semibold">{t("admin.commission.default_section")}</h2>
              <p className="text-xs text-fg-t6">{t("admin.commission.default_section_hint")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("admin.commission.field.calculation_base")} htmlFor="default-base" required>
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
                label={t("admin.commission.field.agent_percentage")}
                htmlFor="default-percentage"
                helperText={t("admin.commission.field.agent_percentage_hint")}
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
                  label={t("admin.commission.field.custom_base")}
                  htmlFor="default-custom-base"
                  helperText={t("admin.commission.field.custom_base_hint")}
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
              <FormField label={t("admin.commission.field.notes")} htmlFor="default-notes" className="sm:col-span-2">
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
                {busy ? t("admin.crud.common.saving") : t("admin.commission.btn_save_default")}
              </Button>
            </div>
          </section>

          <section className="admin-card p-4 space-y-3">
            <div>
              <h2 className="text-base font-semibold">{t("admin.commission.overrides_section")}</h2>
              <p className="text-xs text-fg-t6">{t("admin.commission.overrides_section_hint")}</p>
            </div>

            <Table>
              <THead>
                <TR>
                  <TH>{t("admin.commission.col.agent")}</TH>
                  <TH>{t("admin.commission.col.base")}</TH>
                  <TH>{t("admin.commission.col.percentage")}</TH>
                  <TH>{t("admin.commission.field.notes")}</TH>
                  <TH align="right">{t("admin.crud.common.actions")}</TH>
                </TR>
              </THead>
              <TBody>
                {data.overrides.length === 0 ? (
                  <TEmpty colSpan={5}>{t("admin.commission.empty_overrides")}</TEmpty>
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
                          ({t("admin.commission.col.base").toLowerCase()} {row.custom_base_percentage}%)
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
                        {t("admin.commission.btn_remove")}
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </section>

          <section className="admin-card p-4 space-y-3">
            <h2 className="text-base font-semibold">{t("admin.commission.add_override")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("admin.commission.field.agent_company_id")} htmlFor="override-agent-id" required>
                <Input
                  id="override-agent-id"
                  type="number"
                  min={1}
                  value={overrideAgentId}
                  onChange={(e) => setOverrideAgentId(e.target.value)}
                  placeholder="e.g. 42"
                />
              </FormField>
              <FormField label={t("admin.commission.field.calculation_base")} htmlFor="override-base" required>
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
              <FormField label={t("admin.commission.field.agent_percentage")} htmlFor="override-percentage">
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
                <FormField label={t("admin.commission.field.custom_base")} htmlFor="override-custom-base">
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
              <FormField label={t("admin.commission.field.notes")} htmlFor="override-notes" className="sm:col-span-2">
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
                {busy ? t("admin.crud.common.saving") : t("admin.commission.btn_save_override")}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
