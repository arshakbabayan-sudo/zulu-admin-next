"use client";

import { useEffect, useMemo } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PageHeader } from "@/components/ui";

/**
 * Platform-admin API documentation viewer (Sprint 74, PART 30).
 *
 * Renders Swagger UI from CDN. Pulls the spec from
 *   GET /api/platform-admin/openapi.json
 * which is auth-gated to platform admins.
 */
export default function PlatformApiDocsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);

  const baseURL = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am",
    []
  );

  useEffect(() => {
    if (!allowed || !token) return;

    // Inject Swagger UI from CDN once.
    const cssId = "swagger-ui-css";
    const jsId = "swagger-ui-js";
    let cssEl = document.getElementById(cssId) as HTMLLinkElement | null;
    if (!cssEl) {
      cssEl = document.createElement("link");
      cssEl.id = cssId;
      cssEl.rel = "stylesheet";
      cssEl.href = "https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui.css";
      document.head.appendChild(cssEl);
    }

    const initSwagger = () => {
      // @ts-expect-error — SwaggerUIBundle is injected at runtime by the CDN script
      const SwaggerUIBundle = window.SwaggerUIBundle;
      if (!SwaggerUIBundle) return;
      SwaggerUIBundle({
        url: `${baseURL}/platform-admin/openapi.json`,
        dom_id: "#swagger-ui-root",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout",
        requestInterceptor: (req: { headers: Record<string, string> }) => {
          req.headers["Authorization"] = `Bearer ${token}`;
          req.headers["Accept"] = "application/json";
          return req;
        },
      });
    };

    let jsEl = document.getElementById(jsId) as HTMLScriptElement | null;
    if (!jsEl) {
      jsEl = document.createElement("script");
      jsEl.id = jsId;
      jsEl.src = "https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js";
      jsEl.async = true;
      jsEl.onload = initSwagger;
      document.body.appendChild(jsEl);
    } else {
      initSwagger();
    }
  }, [allowed, token, baseURL]);

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.api_docs.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="API documentation" subtitle={t("admin.api_docs.subtitle")} />

      <div className="admin-card p-4 text-sm text-fg-t7">
        <p>
          {t("admin.api_docs.spec_source_prefix")} <code className="font-mono">storage/app/openapi.json</code> {t("admin.api_docs.spec_source_suffix")} (
          <code className="font-mono">api:generate-openapi</code> {t("admin.api_docs.spec_scheduler")}).
        </p>
        <p className="mt-1">
          {t("admin.api_docs.regenerate_hint")}{" "}
          <code className="font-mono">php artisan api:generate-openapi</code>
        </p>
      </div>

      <div id="swagger-ui-root" className="rounded-zulu border border-default bg-white" />
    </div>
  );
}
