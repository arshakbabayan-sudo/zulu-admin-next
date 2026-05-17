"use client";

/**
 * Agent welcome / landing page (option B from 2026-05-05 audit).
 *
 * Travel agents in ZULU sell other operators' inventory through the public
 * zulu.am site (B2C surface). They don't own inventory, so the operator
 * admin tools don't apply, and they aren't platform admins, so the platform
 * dashboard is hidden too. Instead of showing an empty admin shell or a
 * 403 page, route them here with a clear explanation of where their tools
 * live.
 *
 * Defined by `defaultLandingPath()` in `lib/access.ts` to be the landing
 * page for users with the `agent` role and no operator/platform role.
 */

import { ExternalLink } from "lucide-react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button, PageHeader } from "@/components/ui";

export default function AgentWelcomePage() {
  const { user } = useAdminAuth();
  const { t } = useLanguage();

  const customerSiteUrl = "https://zulu.am";
  const companyName = user?.companies?.[0]?.name ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <PageHeader
        title={t("admin.agent.welcome.title")}
        subtitle={
          companyName ? (
            <span>
              {t("admin.agent.welcome.subtitle_prefix")} <strong>{companyName}</strong>
            </span>
          ) : undefined
        }
      />

      <section className="admin-card space-y-4 p-6">
        <p className="text-ds-body-2 text-fg-t11">{t("admin.agent.welcome.intro")}</p>
        <p className="text-ds-body-3 text-fg-t7">{t("admin.agent.welcome.body")}</p>
      </section>

      <section className="admin-card space-y-3 p-6">
        <h2 className="text-base font-semibold text-fg-t11">
          {t("admin.agent.welcome.tools_heading")}
        </h2>
        <ul className="space-y-2 text-ds-body-3 text-fg-t7">
          <li>• {t("admin.agent.welcome.tool_browse")}</li>
          <li>• {t("admin.agent.welcome.tool_book")}</li>
          <li>• {t("admin.agent.welcome.tool_commissions")}</li>
        </ul>
        <a href={customerSiteUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2">
          <Button size="sm">
            {t("admin.agent.welcome.cta_open_customer_site")}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Button>
        </a>
      </section>

      <section className="admin-card space-y-3 p-6">
        <h2 className="text-base font-semibold text-fg-t11">
          {t("admin.agent.welcome.help_heading")}
        </h2>
        <p className="text-ds-body-3 text-fg-t7">{t("admin.agent.welcome.help_body")}</p>
      </section>
    </div>
  );
}
