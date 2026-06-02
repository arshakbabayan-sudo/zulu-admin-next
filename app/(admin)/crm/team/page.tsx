"use client";

/**
 * CRM → Team — per-employee sales leaderboard + flexible payroll.
 *
 * Arshak's priority feature: each employee's attributed sales (this month) +
 * generated revenue + computed pay, visible to the manager. Click an employee
 * to set their pay model (fixed / percent / fixed + percent). Backed by
 * /platform-admin/crm/team (+ /team/{user}/compensation).
 */

import { useCallback, useEffect, useState } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessCrmSection } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiCrmTeam,
  apiSetCrmCompensation,
  CRM_COMP_MODELS,
  type CrmCompModel,
  type CrmTeamRow,
} from "@/lib/crm-api";
import { avatarInitials, avatarStyle, pickAvatarTone } from "@/lib/admin-v2-helpers";
import { PageHeader, EmptyState, V2Card, V2Button } from "@/components/ui/v2";
import { CrmSectionTabs } from "@/components/crm/CrmSectionTabs";
import { AddEmployeeModal } from "@/components/employees/AddEmployeeModal";
import { Trophy, RefreshCw, X, UserPlus } from "lucide-react";

const MODEL_LABEL: Record<CrmCompModel, string> = {
  fixed: "Fixed only",
  percent: "Percent only",
  fixed_plus_percent: "Fixed + percent",
};

function money(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export default function CrmTeamPage() {
  useDocumentTitle("CRM — Team");
  const { token, user } = useAdminAuth();
  const allowed = canAccessCrmSection(user);

  const [rows, setRows] = useState<CrmTeamRow[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [month, setMonth] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // Compensation editor
  const [editRow, setEditRow] = useState<CrmTeamRow | null>(null);
  const [model, setModel] = useState<CrmCompModel>("fixed_plus_percent");
  const [base, setBase] = useState("0");
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);

  // The company whose team this is — for the operator/agent it's their own.
  // Used to add an employee straight from here (Arshak: employee-add belongs
  // in CRM → Team, not the Directory).
  const teamCompany =
    companyId != null
      ? user?.companies?.find((c) => c.id === companyId) ?? user?.companies?.[0] ?? null
      : null;
  const [percent, setPercent] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiCrmTeam(token, {});
      setRows(res.data);
      setCompanyId(res.meta.company_id);
      setMonth(res.meta.month ?? "");
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof Error ? e.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed || forbidden) return <ForbiddenNotice />;

  const openEditor = (row: CrmTeamRow) => {
    setEditRow(row);
    setModel(row.compensation?.model ?? "fixed_plus_percent");
    setBase(String(row.compensation?.base_amount ?? 0));
    setPercent(String(row.compensation?.commission_percent ?? 0));
    setCurrency(row.compensation?.currency ?? row.pay_currency ?? "USD");
  };

  const save = async () => {
    if (!token || !editRow || companyId == null) return;
    setSaving(true);
    try {
      await apiSetCrmCompensation(token, editRow.user.id, {
        company_id: companyId,
        model,
        base_amount: Number(base) || 0,
        commission_percent: Number(percent) || 0,
        currency,
      });
      setEditRow(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save compensation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "CRM", href: "/crm/pipeline" },
          { label: "Team" },
        ]}
        title="Team"
        subtitle={month ? `Sales performance by employee — ${month}` : "Sales performance by employee"}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border px-[14px] text-[13px] font-medium"
              style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            {teamCompany ? (
              <V2Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setAddEmployeeOpen(true)}>
                Add employee
              </V2Button>
            ) : null}
          </div>
        }
      />
      <CrmSectionTabs activeHref="/crm/team" />

      {err ? (
        <div className="mb-4 rounded-md border p-4 text-[13px]" style={{ borderColor: "var(--admin-border)", color: "var(--admin-danger)" }}>
          {err}
        </div>
      ) : null}

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-10 w-10" />}
          title="No team members"
          subtitle="When your company has employees, their monthly sales and payroll will appear here."
        />
      ) : (
        <V2Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead style={{ backgroundColor: "var(--admin-bg-secondary)" }}>
                <tr>
                  {["Employee", "Sales (orders)", "Won deals", "Revenue", "Pay model", "Computed pay", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]"
                      style={{ color: "var(--admin-text-secondary)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const tone = pickAvatarTone(r.user.id);
                  const revenueLabel =
                    r.revenue_by_currency.length === 0
                      ? "—"
                      : r.revenue_by_currency.map((rc) => money(rc.revenue, rc.currency)).join(" · ");
                  return (
                    <tr key={r.user.id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2.5">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold" style={avatarStyle(tone)}>
                            {avatarInitials(r.user.name)}
                          </span>
                          <span>
                            <span className="block font-medium" style={{ color: "var(--admin-text-primary)" }}>{r.user.name}</span>
                            <span className="block text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>{r.user.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{r.orders_count}</td>
                      <td className="px-4 py-2.5">{r.won_deals}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--admin-text-secondary)" }}>{revenueLabel}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--admin-text-secondary)" }}>
                        {r.compensation ? MODEL_LABEL[r.compensation.model] : "Not set"}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-semibold">{money(r.computed_pay, r.pay_currency)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => openEditor(r)}
                          className="rounded-md border px-2.5 py-1 text-[12px] font-medium"
                          style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }}
                        >
                          {r.compensation ? "Edit pay" : "Set pay"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </V2Card>
      )}

      {/* Compensation editor drawer */}
      {editRow ? (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setEditRow(null)} aria-hidden />
          <div
            className="fixed inset-y-0 right-0 z-50 flex w-[420px] max-w-full flex-col bg-white shadow-xl"
            style={{ borderLeft: "1px solid var(--admin-border)" }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--admin-border)" }}>
              <div>
                <div className="text-[15px] font-semibold">Compensation</div>
                <div className="text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>{editRow.user.name}</div>
              </div>
              <button type="button" onClick={() => setEditRow(null)} aria-label="Close" className="rounded-md p-1 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <label className="mb-1 block text-[12px] font-medium" style={{ color: "var(--admin-text-secondary)" }}>Pay model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as CrmCompModel)}
                className="mb-4 h-[36px] w-full rounded-md border px-2 text-[13px]"
                style={{ borderColor: "var(--admin-border)" }}
              >
                {CRM_COMP_MODELS.map((m) => (
                  <option key={m} value={m}>{MODEL_LABEL[m]}</option>
                ))}
              </select>

              {model !== "percent" ? (
                <>
                  <label className="mb-1 block text-[12px] font-medium" style={{ color: "var(--admin-text-secondary)" }}>Base salary</label>
                  <input
                    type="number"
                    value={base}
                    onChange={(e) => setBase(e.target.value)}
                    className="mb-4 h-[36px] w-full rounded-md border px-2 text-[13px]"
                    style={{ borderColor: "var(--admin-border)" }}
                  />
                </>
              ) : null}

              {model !== "fixed" ? (
                <>
                  <label className="mb-1 block text-[12px] font-medium" style={{ color: "var(--admin-text-secondary)" }}>Commission %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    className="mb-4 h-[36px] w-full rounded-md border px-2 text-[13px]"
                    style={{ borderColor: "var(--admin-border)" }}
                  />
                </>
              ) : null}

              <label className="mb-1 block text-[12px] font-medium" style={{ color: "var(--admin-text-secondary)" }}>Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-[36px] w-full rounded-md border px-2 text-[13px]"
                style={{ borderColor: "var(--admin-border)" }}
              >
                {["USD", "AMD", "EUR", "RUB"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <p className="mt-4 text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
                Pay is computed against revenue in the selected currency. Sales in other
                currencies are shown on the row for visibility.
              </p>
            </div>
            <div className="border-t px-5 py-4" style={{ borderColor: "var(--admin-border)" }}>
              <V2Button variant="primary" onClick={() => void save()} disabled={saving} className="w-full justify-center">
                {saving ? "Saving…" : "Save compensation"}
              </V2Button>
            </div>
          </div>
        </>
      ) : null}

      {/* Add an employee to this company's team (email invite OR manager-set
          login+password). For operators/agents this is their own company. */}
      {teamCompany && token ? (
        <AddEmployeeModal
          open={addEmployeeOpen}
          onClose={() => setAddEmployeeOpen(false)}
          token={token}
          companyId={teamCompany.id}
          companyName={teamCompany.name}
          onSuccess={() => {
            setAddEmployeeOpen(false);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
