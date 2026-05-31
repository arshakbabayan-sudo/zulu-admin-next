/**
 * CRM placeholder page — header + section tabs + a clean "in build" notice.
 *
 * Used by the CRM tabs whose backend isn't built yet (Pipeline / Leads /
 * Deals / Activities / Segments / Team). Renders the real section chrome so
 * the navigation works and never 404s, with an honest EmptyState instead of
 * fabricated demo data. Each tab swaps in its real page as its backend ships.
 */

"use client";

import type { ReactNode } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessCrmSection } from "@/lib/access";
import { PageHeader, EmptyState } from "@/components/ui/v2";
import { CrmSectionTabs } from "./CrmSectionTabs";

type Props = {
  activeHref: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  message?: string;
};

export function CrmComingSoon({ activeHref, title, subtitle, icon, message }: Props) {
  const { user } = useAdminAuth();
  if (!canAccessCrmSection(user)) {
    return <ForbiddenNotice />;
  }
  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "CRM", href: "/crm/pipeline" },
          { label: title },
        ]}
        title={title}
        subtitle={subtitle}
      />
      <CrmSectionTabs activeHref={activeHref} />
      <EmptyState
        icon={icon}
        title={`${title} — in build`}
        subtitle={
          message ??
          "This CRM tab is being built. Its data and actions land in the next step."
        }
      />
    </div>
  );
}
