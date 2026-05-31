"use client";

/**
 * CRM → Options — per-company CRM settings.
 *
 * Arshak's requirement: the manager controls HOW an employee's sales count.
 * Some operators count a booking only once it's confirmed; others count it
 * earlier (still pending). This page exposes that as checkboxes over the order
 * statuses; the Team leaderboard + payroll honour the saved selection.
 * Backed by GET/PUT /platform-admin/crm/settings.
 */

import { useCallback, useEffect, useState } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessCrmSection } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiCrmSettings, apiUpdateCrmSettings } from "@/lib/crm-api";
import { PageHeader, V2Card, V2CardHeader, V2CardBody, V2Button, EmptyState } from "@/components/ui/v2";
import { CrmSectionTabs } from "@/components/crm/CrmSectionTabs";
import { SlidersHorizontal, Check } from "lucide-react";

/** Human labels + helper text for each order status (Armenian-first). */
const STATUS_META: Record<string, { label: string; hint: string }> = {
  pending_payment: { label: "Pending payment (Վճարման սպասում)", hint: "Booking placed, not yet paid" },
  paid: { label: "Paid (Վճարված)", hint: "Payment received" },
  confirmed: { label: "Confirmed (Հաստատված)", hint: "Booking confirmed by the supplier" },
  completed: { label: "Completed (Ավարտված)", hint: "Trip/service delivered" },
};

export default function CrmOptionsPage() {
  useDocumentTitle("CRM — Options");
  const { token, user } = useAdminAuth();
  const allowed = canAccessCrmSection(user);

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiCrmSettings(token, {});
      setCompanyId(res.data.company_id);
      setOptions(res.data.sales_status_options);
      setSelected(new Set(res.data.sales_count_statuses));
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof Error ? e.message : "Failed to load options");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed || forbidden) return <ForbiddenNotice />;

  const toggle = (status: string) => {
    setSavedOk(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const save = async () => {
    if (!token || companyId == null) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await apiUpdateCrmSettings(token, {
        company_id: companyId,
        sales_count_statuses: Array.from(selected),
      });
      setSelected(new Set(res.data.sales_count_statuses));
      setSavedOk(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save options");
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
          { label: "Options" },
        ]}
        title="Options"
        subtitle="Control how your team's sales are counted"
      />
      <CrmSectionTabs activeHref="/crm/options" />

      {err ? (
        <div className="mb-4 rounded-md border p-4 text-[13px]" style={{ borderColor: "var(--admin-border)", color: "var(--admin-danger)" }}>
          {err}
        </div>
      ) : null}

      {companyId == null && !loading ? (
        <EmptyState
          icon={<SlidersHorizontal className="h-10 w-10" />}
          title="No company context"
          subtitle="Open this from a company account (operator / agent) to configure its CRM options."
        />
      ) : (
        <V2Card>
          <V2CardHeader
            title="Sales counting"
            subtitle="Which booking statuses count toward an employee's sales and payroll"
          />
          <V2CardBody>
            <div className="flex flex-col gap-2.5">
              {options.map((status) => {
                const meta = STATUS_META[status] ?? { label: status, hint: "" };
                const checked = selected.has(status);
                return (
                  <label
                    key={status}
                    className="flex cursor-pointer items-start gap-3 rounded-[8px] border p-3 transition"
                    style={{
                      borderColor: checked ? "var(--admin-primary)" : "var(--admin-border)",
                      backgroundColor: checked ? "var(--admin-primary-soft)" : "transparent",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(status)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      <span className="block text-[13px] font-medium" style={{ color: "var(--admin-text-primary)" }}>
                        {meta.label}
                      </span>
                      {meta.hint ? (
                        <span className="block text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                          {meta.hint}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>

            <p className="mt-4 text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
              An employee&apos;s sale is counted when its booking reaches any of the
              checked statuses. Default is Paid + Confirmed. At least one must stay checked.
            </p>

            <div className="mt-5 flex items-center gap-3">
              <V2Button variant="primary" onClick={() => void save()} disabled={saving || selected.size === 0}>
                {saving ? "Saving…" : "Save options"}
              </V2Button>
              {savedOk ? (
                <span className="inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--admin-success)" }}>
                  <Check className="h-4 w-4" /> Saved
                </span>
              ) : null}
            </div>
          </V2CardBody>
        </V2Card>
      )}
    </div>
  );
}
