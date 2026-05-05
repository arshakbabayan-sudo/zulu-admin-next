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

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AgentWelcomePage() {
  const { user } = useAdminAuth();
  const { t } = useLanguage();

  const customerSiteUrl = "https://zulu.am";
  const companyName = user?.companies?.[0]?.name ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <header>
        <h1 className="admin-page-title">{t("admin.agent.welcome.title")}</h1>
        {companyName && (
          <p className="mt-1 text-sm text-fg-t6">
            {t("admin.agent.welcome.subtitle_prefix")} <strong>{companyName}</strong>
          </p>
        )}
      </header>

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
        <a
          href={customerSiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-zulu px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "var(--admin-primary)" }}
        >
          {t("admin.agent.welcome.cta_open_customer_site")}
          <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden>
            <path d="M11 3a1 1 0 100 2h2.586l-7.293 7.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
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
