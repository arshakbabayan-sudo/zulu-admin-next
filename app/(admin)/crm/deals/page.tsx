"use client";

/**
 * CRM → Deals — kanban board grouped by stage (New → Won/Lost).
 * Backed by /platform-admin/crm/deals (CrmController). Mirrors crm.html Deals.
 */

import { useCallback, useEffect, useState } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessCrmSection } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiCrmDeals,
  CRM_DEAL_STAGES,
  type CrmDeal,
  type CrmDealStage,
} from "@/lib/crm-api";
import { avatarInitials, avatarStyle, pickAvatarTone } from "@/lib/admin-v2-helpers";
import { PageHeader, EmptyState } from "@/components/ui/v2";
import { CrmSectionTabs } from "@/components/crm/CrmSectionTabs";
import { Briefcase, RefreshCw } from "lucide-react";

const STAGE_LABEL: Record<CrmDealStage, string> = {
  new: "New",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const STAGE_DOT: Record<CrmDealStage, string> = {
  new: "var(--admin-info)",
  qualified: "var(--admin-info-dark, #145EBE)",
  proposal: "var(--admin-primary)",
  negotiation: "var(--admin-primary-dark, #631351)",
  won: "var(--admin-success)",
  lost: "var(--admin-danger)",
};

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export default function CrmDealsPage() {
  useDocumentTitle("CRM — Deals");
  const { token, user } = useAdminAuth();
  const allowed = canAccessCrmSection(user);

  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiCrmDeals(token, { per_page: 200 });
      setDeals(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof Error ? e.message : "Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed || forbidden) return <ForbiddenNotice />;

  const byStage = (stage: CrmDealStage) => deals.filter((d) => d.stage === stage);
  const stageTotal = (stage: CrmDealStage) =>
    byStage(stage).reduce((sum, d) => sum + (d.value_amount || 0), 0);

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "CRM", href: "/crm/pipeline" },
          { label: "Deals" },
        ]}
        title="Deals"
        subtitle="Opportunity pipeline by stage"
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-[14px] text-[13px] font-medium"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />
      <CrmSectionTabs activeHref="/crm/deals" counts={{ deals: deals.length }} />

      {err ? (
        <div className="mb-4 rounded-md border p-4 text-[13px]" style={{ borderColor: "var(--admin-border)", color: "var(--admin-danger)" }}>
          {err}
        </div>
      ) : null}

      {!loading && deals.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-10 w-10" />}
          title="No deals yet"
          subtitle="Deals you and your team create will appear here, grouped by sales stage."
        />
      ) : (
        <div className="flex gap-3.5 overflow-x-auto pb-2">
          {CRM_DEAL_STAGES.map((stage) => {
            const cards = byStage(stage);
            return (
              <div
                key={stage}
                className="flex w-[280px] shrink-0 flex-col rounded-[12px] border"
                style={{ backgroundColor: "var(--admin-bg-secondary)", borderColor: "var(--admin-border)" }}
              >
                <div className="flex items-center gap-2 border-b px-3.5 py-3" style={{ borderColor: "var(--admin-border)" }}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: STAGE_DOT[stage] }} />
                  <span className="text-[12px] font-semibold uppercase tracking-[0.3px]">{STAGE_LABEL[stage]}</span>
                  <span
                    className="rounded-full px-[7px] py-px text-[11px] font-semibold"
                    style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                  >
                    {cards.length}
                  </span>
                  <span className="ml-auto text-[12px] font-semibold" style={{ color: "var(--admin-text-secondary)" }}>
                    {money(stageTotal(stage), cards[0]?.currency || "USD")}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 p-2.5">
                  {cards.map((d) => {
                    const tone = pickAvatarTone(d.customer?.id ?? d.id);
                    return (
                      <div
                        key={d.id}
                        className="rounded-[8px] border bg-white p-3"
                        style={{ borderColor: "var(--admin-border)" }}
                      >
                        <div className="mb-0.5 text-[13px] font-semibold" style={{ color: "var(--admin-text-primary)" }}>
                          {d.title}
                        </div>
                        <div className="mb-2.5 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--admin-text-secondary)" }}>
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold" style={avatarStyle(tone)}>
                            {avatarInitials(d.customer?.name)}
                          </span>
                          {d.customer?.name ?? "—"}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[13px] font-bold">{money(d.value_amount, d.currency)}</span>
                          <span className="text-[11px]" style={{ color: "var(--admin-text-tertiary)" }}>
                            {d.expected_close_date ?? ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {cards.length === 0 ? (
                    <p className="px-1 py-3 text-center text-[12px]" style={{ color: "var(--admin-text-tertiary)" }}>
                      —
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
