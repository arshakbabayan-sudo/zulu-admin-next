"use client";

/**
 * Per-operator price-markup card — super-admin sets the two markup percentages
 * the platform applies on top of this operator's supplier price:
 *   - Agent markup (netto)  → charged to seller_b2b (agent) buyers
 *   - Customer markup (brutto) → the customer-site DISPLAY price, and the
 *     charge for ordinary (client/guest) buyers — shown == charged.
 *
 * An empty field means "no per-operator value" → the company falls back to the
 * global B2C markup default (today's 15%). Wired to the existing company-profile
 * update endpoint (`PATCH /platform-admin/companies/{id}/profile`), which now
 * accepts `agent_markup_percent` / `customer_markup_percent`
 * (nullable|numeric|min:0|max:100).
 *
 * Rendered on the company-detail Commission tab, above CompanyCommissionTab, so
 * it uses the same management.css primitives (.section-label / .form-grid /
 * .fld / .btn) as its sibling pane.
 */

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiPatchCompanyProfile,
  type PlatformCompanyRow,
} from "@/lib/platform-admin-api";
import { markupStrings } from "@/app/(admin)/platform/companies/[id]/markup-i18n";

type Props = {
  token: string;
  company: PlatformCompanyRow;
  /** Bubble the saved row up so the parent's `company` state stays canonical. */
  onSaved: (next: PlatformCompanyRow) => void;
};

/** number|null → input string ("" for null/undefined). */
function toField(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? String(v) : "";
}

/** input string → number|null. "" → null. Returns `undefined` when invalid. */
function parsePercent(s: string): number | null | undefined {
  const v = s.trim();
  if (v === "") return null;
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n)) return undefined;
  if (n < 0 || n > 100) return undefined;
  return n;
}

export default function CompanyPriceMarkupCard({ token, company, onSaved }: Props) {
  const { lang } = useLanguage();
  const s = markupStrings(lang);

  const [agent, setAgent] = useState<string>(() => toField(company.agent_markup_percent));
  const [customer, setCustomer] = useState<string>(() =>
    toField(company.customer_markup_percent),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Reset the draft whenever the saved company row changes.
  useEffect(() => {
    setAgent(toField(company.agent_markup_percent));
    setCustomer(toField(company.customer_markup_percent));
    setErr(null);
  }, [company.agent_markup_percent, company.customer_markup_percent]);

  const dirty =
    agent.trim() !== toField(company.agent_markup_percent) ||
    customer.trim() !== toField(company.customer_markup_percent);

  function reset() {
    setAgent(toField(company.agent_markup_percent));
    setCustomer(toField(company.customer_markup_percent));
    setErr(null);
  }

  async function save() {
    const agentVal = parsePercent(agent);
    const customerVal = parsePercent(customer);
    if (agentVal === undefined || customerVal === undefined) {
      setErr(s.errRange);
      return;
    }
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await apiPatchCompanyProfile(token, company.id, {
        agent_markup_percent: agentVal,
        customer_markup_percent: customerVal,
      });
      onSaved(res.data);
      setSaved(true);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errSave);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div className="section-label">{s.title}</div>
      <div className="text-sm text-secondary mb-3">{s.hint}</div>

      {err && (
        <div
          className="alert mb-3"
          style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}
        >
          <i className="ti ti-alert-circle" />
          <div>{err}</div>
        </div>
      )}

      <div className="form-grid">
        <div className="fld">
          <span className="fld-label">{s.agentLabel}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            placeholder={s.emptyHint}
          />
        </div>
        <div className="fld">
          <span className="fld-label">{s.customerLabel}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder={s.emptyHint}
          />
        </div>
      </div>

      <div className="text-sm text-secondary" style={{ marginTop: 8 }}>
        {s.emptyHint}
      </div>

      <div className="flex items-center gap-3" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          <i className="ti ti-device-floppy" />
          {s.save}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy || !dirty}
          onClick={reset}
        >
          {s.cancel}
        </button>
        {saved && !dirty && (
          <span className="text-sm" style={{ color: "var(--success-dark)" }}>
            {s.saved}
          </span>
        )}
      </div>
    </div>
  );
}
