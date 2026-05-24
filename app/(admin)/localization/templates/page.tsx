"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessLocalizationTemplatesNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiLocalizationLanguages,
  apiLocalizationTemplateGet,
  apiLocalizationTemplatePatch,
  NOTIFICATION_TEMPLATE_EVENTS,
  type LocalizationLanguageRow,
} from "@/lib/localization-api";
import { useCallback, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
} from "@/components/ui/v2";

const CHANNELS = ["in_app", "email"] as const;

export default function LocalizationTemplatesPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessLocalizationTemplatesNav(user);

  const [langs, setLangs] = useState<LocalizationLanguageRow[]>([]);
  const langsLoaded = useRef(false);
  const [event, setEvent] = useState<string>(NOTIFICATION_TEMPLATE_EVENTS[0]);
  const [lang, setLang] = useState("en");
  const [channel, setChannel] = useState<string>("in_app");
  const [titleTemplate, setTitleTemplate] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const ensureLangsLoaded = useCallback(async () => {
    if (langsLoaded.current) return;
    try {
      const res = await apiLocalizationLanguages(token);
      setLangs(res.data);
      langsLoaded.current = true;
    } catch {
      // non-critical
    }
  }, [token]);

  async function loadTemplate() {
    setErr(null);
    setMsg(null);
    setBusy(true);
    await ensureLangsLoaded();
    try {
      const res = await apiLocalizationTemplateGet(token, event, { lang, channel });
      setTitleTemplate(res.data.title_template);
      setBodyTemplate(res.data.body_template);
      setIsActive(res.data.is_active);
      setMsg(t("admin.localization_templates.msg_loaded"));
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 404) {
        setTitleTemplate("");
        setBodyTemplate("");
        setIsActive(true);
        setMsg(t("admin.localization_templates.msg_not_found"));
      } else {
        setErr(e instanceof ApiRequestError ? e.message : t("admin.localization_templates.err_load"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    if (!token) return;
    setErr(null);
    setMsg(null);
    setForbidden(false);
    setBusy(true);
    await ensureLangsLoaded();
    try {
      await apiLocalizationTemplatePatch(token, event, {
        lang,
        channel,
        title_template: titleTemplate,
        body_template: bodyTemplate,
        is_active: isActive,
      });
      setMsg(t("admin.localization_templates.msg_saved"));
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.localization_templates.err_save"));
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.localization_templates.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice messageKey={!allowed ? "admin.forbidden.templates" : undefined} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.localization_templates.title") },
        ]}
        title={t("admin.localization_templates.title")}
      />

      <SectionTabs
        activeHref="/localization/templates"
        items={[
          { href: "/settings/pricing-rules", label: "Pricing rules" },
          { href: "/settings/money-flow", label: "Money flow" },
          { href: "/localization/languages", label: "Languages" },
          { href: "/localization/templates", label: "Email templates" },
          { href: "/platform/banners", label: "Banners" },
          { href: "/pages", label: "CMS pages" },
          { href: "/platform/notifications", label: "System notifications" },
          { href: "/platform/newsletter", label: "Newsletter" },
          { href: "/platform/loyalty", label: "Loyalty" },
          { href: "/bucket3/block-dates", label: "Block dates" },
          { href: "/bucket3/custom-fields", label: "Custom fields" },
          { href: "/platform/security", label: "Security" },
          { href: "/platform/webhooks", label: "Webhooks" },
          { href: "/platform/locations", label: "Locations" },
          { href: "/platform/settings/brand", label: "Brand" },
          { href: "/connections", label: "Connections" },
          { href: "/support/tickets", label: "Support" },
          { href: "/platform/reviews", label: "Reviews" },
        ]}
      />

      <div className="space-y-6">
      {msg && (
        <div className="rounded-zulu border border-success-100 bg-success-50 px-4 py-2 text-sm text-success-700">{msg}</div>
      )}
      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      )}

      <div className="admin-card p-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          <FormField label={t("admin.localization_templates.field_event")} htmlFor="loc-event" className="max-w-md flex-1">
            <Select id="loc-event" fieldSize="sm" value={event} onChange={(e) => setEvent(e.target.value)}>
              {NOTIFICATION_TEMPLATE_EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
            </Select>
          </FormField>
          <FormField label={t("admin.localization_templates.field_language")} htmlFor="loc-lang" className="max-w-[140px]">
            <Select id="loc-lang" fieldSize="sm" value={lang} onChange={(e) => setLang(e.target.value)}>
              {langs.length === 0 ? (
                <option value={lang}>{lang}</option>
              ) : (
                langs.map((l) => <option key={l.id} value={l.code}>{l.code}</option>)
              )}
            </Select>
          </FormField>
          <FormField label={t("admin.localization_templates.field_channel")} htmlFor="loc-ch" className="max-w-[140px]">
            <Select id="loc-ch" fieldSize="sm" value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FormField>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => loadTemplate()}>
            {t("admin.localization_templates.btn_load")}
          </Button>
          <Button size="sm" disabled={busy || !token} onClick={() => saveTemplate()}>
            {t("admin.localization_templates.btn_save")}
          </Button>
        </div>
      </div>

      <div className="admin-card p-4 space-y-4">
        <FormField label={t("admin.localization_templates.field_title_template")} htmlFor="t-title">
          <Input
            id="t-title"
            value={titleTemplate}
            onChange={(e) => setTitleTemplate(e.target.value)}
            maxLength={512}
            className="max-w-3xl"
          />
        </FormField>
        <FormField label={t("admin.localization_templates.field_body_template")} htmlFor="t-body">
          <Input
            id="t-body"
            as="textarea"
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            rows={12}
            className="max-w-3xl font-mono"
          />
        </FormField>
        <Checkbox
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          label={t("admin.localization_templates.field_active")}
        />
      </div>
      </div>
    </div>
  );
}
