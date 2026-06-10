"use client";

/**
 * Phase 7.3 — Commission settings widget on the admin company-detail page.
 * Reuses /operator/commission-settings endpoints with ?company_id={id} so
 * platform-admin / super-admin can view + edit any company's default
 * commission % + per-agent overrides without navigating to the operator's
 * own commission page.
 *
 * Rendered inside MgmtPage's company-detail .detail-pane > .card > .card-body,
 * so the markup uses the management.css idiom (.section-label / .form-grid /
 * .fld / .btn / .table / .empty-state) — same primitives as the sibling
 * Profile / Staff panes. Logic + API calls are identical to the original
 * Tailwind version; only the markup/classes changed (roadmap §6).
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

/** DB-translation shim: falls back to the canonical English while the
 *  ui_translations row for `key` hasn't been seeded yet (t returns the key). */
function tx(t: (k: string) => string, key: string, fallback: string): string {
  const v = t(key);
  return v === key ? fallback : v;
}

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
      setErr(
        e instanceof ApiRequestError
          ? e.message
          : tx(t, "admin.commission.err_load", "Failed to load commission settings"),
      );
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
      setErr(
        e instanceof ApiRequestError
          ? e.message
          : tx(t, "admin.commission.err_save", "Failed to save commission settings"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveOverride() {
    const agentId = Number(overrideAgentId);
    if (!Number.isFinite(agentId) || agentId <= 0) {
      setErr(tx(t, "admin.commission.err_agent_id", "Please enter a valid agent company ID"));
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
      setErr(
        e instanceof ApiRequestError
          ? e.message
          : tx(t, "admin.commission.err_save", "Failed to save commission settings"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteOverride(row: CommissionConfig) {
    if (row.agent_company_id == null) return;
    const ok = await confirm({
      message: tx(
        t,
        "admin.commission.confirm_delete_override",
        'Delete override for "{name}"?',
      ).replace("{name}", row.agent_company_name ?? `#${row.agent_company_id}`),
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiDeleteCommissionOverride(token, row.agent_company_id, companyId);
      await load();
    } catch (e) {
      setErr(
        e instanceof ApiRequestError
          ? e.message
          : tx(t, "admin.commission.err_save", "Failed to save commission settings"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <p className="cell-muted" style={{ margin: 0 }}>
        {tx(t, "admin.commission.loading", "Loading commission settings…")}
      </p>
    );
  }

  const lblCalculationBase = tx(t, "admin.commission.calculation_base", "Calculation base");
  const lblPercentage = tx(t, "admin.commission.default_percentage", "Percentage (%)");

  return (
    <div>
      {err && (
        <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}>
          <i className="ti ti-alert-circle" />
          <div>{err}</div>
        </div>
      )}

      {/* DEFAULT section */}
      <div className="section-label">
        {tx(t, "admin.commission.default_title", "Default commission for all agents")}
      </div>
      <div className="text-sm text-secondary mb-3">
        {tx(
          t,
          "admin.commission.default_hint",
          "Applied to every agent unless an override row below exists for that agent.",
        )}
      </div>

      <div className="form-grid">
        <div className="fld">
          <span className="fld-label">{lblCalculationBase}</span>
          <select
            value={defaultDraft.calculation_base}
            onChange={(e) =>
              setDefaultDraft({
                ...defaultDraft,
                calculation_base: e.target.value as CalculationBase,
              })
            }
          >
            {CALCULATION_BASES.map((b) => (
              <option key={b} value={b}>
                {calculationBaseLabel(b, t)}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <span className="fld-label">{lblPercentage}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={defaultDraft.default_percentage}
            onChange={(e) =>
              setDefaultDraft({ ...defaultDraft, default_percentage: e.target.value })
            }
            placeholder="0.00"
          />
        </div>
        {defaultDraft.calculation_base === "custom" && (
          <div className="fld">
            <span className="fld-label">
              {tx(t, "admin.commission.custom_base", "Custom base percentage (%)")}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={defaultDraft.custom_base_percentage}
              onChange={(e) =>
                setDefaultDraft({ ...defaultDraft, custom_base_percentage: e.target.value })
              }
              placeholder="0.00"
            />
          </div>
        )}
        <div className="fld span-2">
          <span className="fld-label">{tx(t, "admin.commission.notes", "Notes (optional)")}</span>
          <textarea
            value={defaultDraft.notes}
            onChange={(e) => setDefaultDraft({ ...defaultDraft, notes: e.target.value })}
            placeholder={tx(
              t,
              "admin.commission.notes_placeholder",
              "Internal note about how this default was decided…",
            )}
          />
        </div>
      </div>

      <div className="flex items-center gap-3" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void saveDefault()}
        >
          <i className="ti ti-device-floppy" />
          {tx(t, "admin.commission.save_default", "Save default")}
        </button>
        {savedAt && (
          <span className="text-sm" style={{ color: "var(--success-dark)" }}>
            {tx(t, "admin.commission.saved_just_now", "Saved just now")}
          </span>
        )}
      </div>

      {/* OVERRIDES section */}
      <div className="section-label" style={{ marginTop: 28 }}>
        {tx(t, "admin.commission.overrides_title", "Per-agent overrides")}
      </div>
      <div className="text-sm text-secondary mb-3">
        {tx(
          t,
          "admin.commission.overrides_hint",
          "Override the default for specific agents — used when a partner has negotiated a different rate.",
        )}
      </div>

      {data.overrides.length === 0 ? (
        <div className="empty-state mb-4" style={{ padding: "28px 20px" }}>
          <i className="ti ti-percentage" />
          {tx(t, "admin.commission.no_overrides", "No per-agent overrides yet.")}
        </div>
      ) : (
        <div
          className="mb-4"
          style={{
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{tx(t, "admin.commission.agent", "Agent")}</th>
                  <th>{lblCalculationBase}</th>
                  <th className="num-cell">{lblPercentage}</th>
                  <th style={{ textAlign: "right" }}>
                    {tx(t, "admin.commission.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.overrides.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">
                      {r.agent_company_name ?? `#${r.agent_company_id}`}
                    </td>
                    <td className="cell-muted">{calculationBaseLabel(r.calculation_base, t)}</td>
                    <td className="num-cell">
                      {r.default_percentage != null ? `${r.default_percentage}%` : "—"}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ color: "var(--danger-dark)", borderColor: "var(--danger-light)" }}
                          disabled={busy}
                          onClick={() => void deleteOverride(r)}
                        >
                          <i className="ti ti-trash" />
                          {tx(t, "admin.commission.delete", "Delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add override form */}
      <div className="section-label" style={{ marginTop: 20 }}>
        {tx(t, "admin.commission.add_override", "Add per-agent override")}
      </div>
      <div className="form-grid">
        <div className="fld">
          <span className="fld-label">
            {tx(t, "admin.commission.agent_company_id", "Agent company ID")}
          </span>
          <input
            type="number"
            min="1"
            value={overrideAgentId}
            onChange={(e) => setOverrideAgentId(e.target.value)}
            placeholder={tx(t, "admin.commission.agent_id_placeholder", "e.g. 19")}
          />
        </div>
        <div className="fld">
          <span className="fld-label">{lblCalculationBase}</span>
          <select
            value={overrideDraft.calculation_base}
            onChange={(e) =>
              setOverrideDraft({
                ...overrideDraft,
                calculation_base: e.target.value as CalculationBase,
              })
            }
          >
            {CALCULATION_BASES.map((b) => (
              <option key={b} value={b}>
                {calculationBaseLabel(b, t)}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <span className="fld-label">{lblPercentage}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={overrideDraft.default_percentage}
            onChange={(e) =>
              setOverrideDraft({ ...overrideDraft, default_percentage: e.target.value })
            }
            placeholder="0.00"
          />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          className="btn"
          disabled={busy || overrideAgentId === ""}
          onClick={() => void saveOverride()}
        >
          {tx(t, "admin.commission.add_override_btn", "+ Add override")}
        </button>
      </div>
    </div>
  );
}
