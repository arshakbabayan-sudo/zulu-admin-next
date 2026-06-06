"use client";

/**
 * CRM group — shared section tabs rendered at the top of every CRM page.
 *
 * 2026-06-06 (#4 CRM consolidation, Arshak): the strip is grouped into three
 * clusters — Sales · People · Work — plus Options. "Work" folds in the pages
 * moved into CRM: Contracts (role-routed), Work hours, Payroll, Files.
 *
 * Contracts is role-routed (Arshak's Option A): the super-admin sees every
 * company's contracts (/platform/contracts); an operator/agent sees only their
 * own (/operator|/agent/contracts). The existing role-scoped pages are reused.
 *
 * Labels stay English to match every other admin SectionTabs strip; the sidebar
 * entry is translated via admin.nav.section.crm.
 */

import Link from "next/link";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";

export type CrmCounts = Partial<{
  leads: number;
  deals: number;
  customers: number;
  activities: number;
}>;

type Props = {
  activeHref: string;
  counts?: CrmCounts;
};

type Tab = {
  href: string;
  label: string;
  count?: number;
  /** Extra paths that should mark this tab active (role-routed Contracts). */
  match?: string[];
};

export function CrmSectionTabs({ activeHref, counts }: Props) {
  const { user } = useAdminAuth();

  // Role-routed Contracts target (Option A): reuse the existing scoped pages.
  const contractsHref =
    user?.is_super_admin || canAccessPlatformAdminNav(user)
      ? "/platform/contracts"
      : user?.roles?.includes("agent")
        ? "/agent/contracts"
        : "/operator/contracts";

  const groups: { label: string | null; tabs: Tab[] }[] = [
    {
      label: "Sales",
      tabs: [
        { href: "/crm/pipeline", label: "Pipeline" },
        { href: "/crm/leads", label: "Leads", count: counts?.leads },
        { href: "/crm/deals", label: "Deals", count: counts?.deals },
        { href: "/crm/activities", label: "Activities", count: counts?.activities },
        { href: "/crm/segments", label: "Segments" },
      ],
    },
    {
      label: "People",
      tabs: [
        { href: "/crm/customers", label: "Customers", count: counts?.customers },
        { href: "/crm/team", label: "Team" },
      ],
    },
    {
      label: "Work",
      tabs: [
        {
          href: contractsHref,
          label: "Contracts",
          match: ["/platform/contracts", "/operator/contracts", "/agent/contracts"],
        },
        { href: "/bucket3/non-service-hours", label: "Work hours" },
        { href: "/bucket3/payroll", label: "Payroll" },
        { href: "/admin-redesign/files", label: "Files" },
      ],
    },
    {
      label: null,
      tabs: [{ href: "/crm/options", label: "Options" }],
    },
  ];

  const isActive = (t: Tab): boolean => {
    const candidates = [t.href, ...(t.match ?? [])];
    return candidates.some((h) => activeHref === h || activeHref.startsWith(`${h}/`));
  };

  return (
    <div
      className="mb-5 flex flex-wrap items-end gap-x-1 gap-y-2 overflow-x-auto border-b"
      style={{ borderColor: "var(--admin-border)" }}
      role="tablist"
    >
      {groups.map((group, gi) => (
        <div key={group.label ?? `g${gi}`} className="flex items-end">
          {/* subtle divider before every group except the first */}
          {gi > 0 ? (
            <span className="mx-2 mb-2 h-4 w-px self-center" style={{ backgroundColor: "var(--admin-border)" }} aria-hidden />
          ) : null}
          <div className="flex flex-col">
            {group.label ? (
              <span
                className="px-[14px] pb-0.5 text-[9px] font-semibold uppercase tracking-[0.6px]"
                style={{ color: "var(--admin-text-tertiary, var(--admin-text-secondary))" }}
              >
                {group.label}
              </span>
            ) : (
              <span className="pb-0.5 text-[9px]" aria-hidden>&nbsp;</span>
            )}
            <div className="flex">
              {group.tabs.map((t) => {
                const active = isActive(t);
                return (
                  <Link
                    key={t.href + t.label}
                    href={t.href}
                    role="tab"
                    aria-selected={active}
                    className="-mb-px inline-flex h-[36px] items-center gap-1.5 whitespace-nowrap border-b-2 px-[14px] text-[13px] font-medium transition"
                    style={{
                      color: active ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                      borderBottomColor: active ? "var(--admin-primary)" : "transparent",
                    }}
                  >
                    {t.label}
                    {t.count !== undefined ? (
                      <span
                        className="ml-1 inline-flex items-center justify-center rounded-full px-[7px] py-[1px] text-[11px] font-medium"
                        style={{
                          backgroundColor: active ? "var(--admin-primary-light)" : "var(--admin-bg-tertiary)",
                          color: active ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                        }}
                      >
                        {t.count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
