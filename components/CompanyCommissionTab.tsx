"use client";

/**
 * Phase 7.3 — Commission settings widget on the admin company-detail page.
 * Reuses /operator/commission-settings endpoints with ?company_id={id} so
 * platform-admin / super-admin can view + edit any company's default
 * commission % + per-agent overrides without navigating to the operator's
 * own commission page.
 *
 * Trimmed version of /operator/commission-settings UI — same primitives,
 * same API, scoped to a specific company id.
 */

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
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

type Props = {
  token: string;
  companyId: number;
};

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

function parseDecimal(s: string): number | null {
  const v = s.trim();
  if (v === "") return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export default function CompanyCommissionTab({ token, companyId }: Props) {
  const { t } = useLanguage();
  const confirm = useConfirm();
  const [data, setData] = useState<CommissionSettingsResponse | null>(null);
  const [defaultDraft, setDefaultDraft] = useState<DraftRow>(configToDraft(null));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Inline override editor
  const [overrideAgentId, setOverrideAgentId] = useState<string>("");
  const [overrideDraft, setOverrideDraft] = useState<DraftRow>(configToDraft(null));

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiCommissionSettings(token, companyId);
      setData(res.data);
      setDefaultDraft(configToDraft(res.data.default));
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.commission.err_load"));
    }
  }, [token, companyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDefault() {
    setBusy(true);
    setErr(null);
    try {
      await apiUpsertCommissionDefault(
        token,
        {
          calculation_base: defaultDraft.calculation_base,
          default_percentage: parseDecimal(defaultDraft.default_percentage),
          custom_base_percentage: parseDecimal(defaultDraft.custom_base_percentage),
          notes: defaultDraft.notes.trim() || null,
        },
        companyId,
      );
      setSavedAt(new Date().toISOString());
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.commission.err_save"));
    } finally {
      setBusy(false);
    }
  }

  async function saveOverride() {
    const agentId = Number(overrideAgentId);
    if (!Number.isFinite(agentId) || agentId <= 0) {
      setErr(t("admin.commission.err_agent_id"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiUpsertCommissionOverride(
        token,
        agentId,
        {
          calculation_base: overrideDraft.calculation_base,
          default_percentage: parseDecimal(overrideDraft.default_percentage),
          custom_base_percentage: parseDecimal(overrideDraft.custom_base_percentage),
          notes: overrideDraft.notes.trim() || null,
        },
        companyId,
      );
      setOverrideAgentId("");
      setOverrideDraft(configToDraft(null));
      setSavedAt(new Date().toISOString());
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.commission.err_save"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteOverride(row: CommissionConfig) {
    if (row.agent_company_id == null) return;
    const ok = await confirm({
      message: t("admin.commission.confirm_delete_override").replace(
        "{name}",
        row.agent_company_name ?? `#${row.agent_company_id}`,
      ),
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiDeleteCommissionOverride(token, row.agent_company_id, companyId);
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.commission.err_save"));
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="text-sm text-fg-t6">{t("admin.commission.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      {/* DEFAULT section */}
      <section className="rounded-zulu border border-default bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-fg-t8">
          {t("admin.commission.default_title")}
        </h3>
        <p className="mb-4 text-xs text-fg-t6">{t("admin.commission.default_hint")}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fg-t7">{t("admin.commission.calculation_base")}</span>
            <select
              value={defaultDraft.calculation_base}
              onChange={(e) =>
                setDefaultDraft({
                  ...defaultDraft,
                  calculation_base: e.target.value as CalculationBase,
                })
              }
              className="h-10 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              {CALCULATION_BASES.map((b) => (
                <option key={b} value={b}>
                  {calculationBaseLabel(b)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-fg-t7">{t("admin.commission.default_percentage")}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={defaultDraft.default_percentage}
              onChange={(e) =>
                setDefaultDraft({ ...defaultDraft, default_percentage: e.target.value })
              }
              className="h-10 rounded-zulu border border-default px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="0.00"
            />
          </label>
          {defaultDraft.calculation_base === "custom" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t7">{t("admin.commission.custom_base")}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={defaultDraft.custom_base_percentage}
                onChange={(e) =>
                  setDefaultDraft({ ...defaultDraft, custom_base_percentage: e.target.value })
                }
                className="h-10 rounded-zulu border border-default px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="0.00"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-fg-t7">{t("admin.commission.notes")}</span>
            <textarea
              value={defaultDraft.notes}
              onChange={(e) => setDefaultDraft({ ...defaultDraft, notes: e.target.value })}
              className="min-h-[60px] rounded-zulu border border-default px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder={t("admin.commission.notes_placeholder")}
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveDefault()}
            className="inline-flex h-10 items-center rounded-zulu bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {t("admin.commission.save_default")}
          </button>
          {savedAt && (
            <span className="text-xs text-success-700">
              {t("admin.commission.saved_just_now")}
            </span>
          )}
        </div>
      </section>

      {/* OVERRIDES section */}
      <section className="rounded-zulu border border-default bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-fg-t8">
          {t("admin.commission.overrides_title")}
        </h3>
        <p className="mb-4 text-xs text-fg-t6">{t("admin.commission.overrides_hint")}</p>

        {data.overrides.length === 0 ? (
          <p className="mb-4 text-sm text-fg-t6">{t("admin.commission.no_overrides")}</p>
        ) : (
          <table className="mb-4 w-full text-left text-sm">
            <thead className="border-b border-default text-xs uppercase tracking-wide text-fg-t6">
              <tr>
                <th className="py-2">{t("admin.commission.agent")}</th>
                <th className="py-2">{t("admin.commission.calculation_base")}</th>
                <th className="py-2 text-right">{t("admin.commission.default_percentage")}</th>
                <th className="py-2 text-right">{t("admin.commission.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {data.overrides.map((r) => (
                <tr key={r.id} className="border-b border-default last:border-0">
                  <td className="py-2">
                    {r.agent_company_name ?? `#${r.agent_company_id}`}
                  </td>
                  <td className="py-2 text-fg-t7">{calculationBaseLabel(r.calculation_base)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {r.default_percentage != null ? `${r.default_percentage}%` : "—"}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteOverride(r)}
                      className="inline-flex h-8 items-center rounded-zulu border border-error-200 bg-white px-2.5 text-xs font-medium text-error-700 transition hover:bg-error-50 disabled:opacity-40"
                    >
                      {t("admin.commission.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Add override form */}
        <div className="rounded-zulu border border-default bg-figma-bg-1/40 p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-t6">
            {t("admin.commission.add_override")}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t7">
                {t("admin.commission.agent_company_id")}
              </span>
              <input
                type="number"
                min="1"
                value={overrideAgentId}
                onChange={(e) => setOverrideAgentId(e.target.value)}
                className="h-10 rounded-zulu border border-default px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder={t("admin.commission.agent_id_placeholder")}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t7">{t("admin.commission.calculation_base")}</span>
              <select
                value={overrideDraft.calculation_base}
                onChange={(e) =>
                  setOverrideDraft({
                    ...overrideDraft,
                    calculation_base: e.target.value as CalculationBase,
                  })
                }
                className="h-10 rounded-zulu border border-default bg-white px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                {CALCULATION_BASES.map((b) => (
                  <option key={b} value={b}>
                    {calculationBaseLabel(b)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t7">{t("admin.commission.default_percentage")}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={overrideDraft.default_percentage}
                onChange={(e) =>
                  setOverrideDraft({ ...overrideDraft, default_percentage: e.target.value })
                }
                className="h-10 rounded-zulu border border-default px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="0.00"
              />
            </label>
          </div>
          <div className="mt-3">
            <button
              type="button"
              disabled={busy || overrideAgentId === ""}
              onClick={() => void saveOverride()}
              className="inline-flex h-10 items-center rounded-zulu border border-default bg-white px-4 text-sm font-semibold text-fg-t8 transition hover:bg-figma-bg-1 disabled:opacity-40"
            >
              {t("admin.commission.add_override_btn")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
