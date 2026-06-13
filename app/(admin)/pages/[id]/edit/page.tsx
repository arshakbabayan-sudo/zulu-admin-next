"use client";

/**
 * admin v3 — CMS page editor restyled onto the magenta "mgmt" design system.
 *
 * Mounts the same self-contained chrome as Settings (sidebar + header from
 * MgmtPage, `.mgmt-page-host` window-lock), and swaps the old Tailwind/v2
 * primitives (admin-card / FormField / Button / Switch / StatusPill / lucide)
 * for the magenta component classes (.card / .fld / .btn / .switch / .badge /
 * ti icons). The powerful widget builder (18 widget types, language tabs, page
 * meta + SEO, canvas) is unchanged — only its surface is restyled.
 */

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessNotificationsNav, canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";
import {
  apiAddAdminPageWidget,
  apiAdminPage,
  apiDeleteAdminPageWidget,
  apiPatchAdminPage,
  apiPatchAdminPageStatus,
  apiUpdateAdminPageWidget,
  type AdminPageDetailRow,
  type AdminWidgetContentRow,
} from "@/lib/pages-api";
import { apiAdminLanguages, type LocalizationLanguageRow } from "@/lib/localization-api";
import "../../../platform/management/management.css";
import { Sidebar, Header } from "../../../platform/management/MgmtPage";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WidgetForm } from "./WidgetForm";

type AvailableWidget = { slug: string; name: string; icon: string };

const AVAILABLE_WIDGETS: AvailableWidget[] = [
  { slug: "sliders", name: "Sliders", icon: "SL" },
  { slug: "search", name: "Search", icon: "SR" },
  { slug: "about-us", name: "About Us", icon: "AB" },
  { slug: "why-choose-us", name: "Why Choose Us", icon: "WC" },
  { slug: "fun-facts", name: "Fun Facts", icon: "FF" },
  { slug: "testimonials", name: "Testimonials", icon: "TS" },
  { slug: "faq", name: "FAQ", icon: "FQ" },
  { slug: "contact-us", name: "Contact Us", icon: "CU" },
  { slug: "text-editor", name: "Text Editor", icon: "TE" },
  { slug: "code-editor", name: "Code Editor", icon: "CE" },
  { slug: "blogs", name: "Blogs", icon: "BL" },
  { slug: "features", name: "Features", icon: "FT" },
  { slug: "cta", name: "CTA", icon: "CA" },
  { slug: "home-hero", name: "Home Hero", icon: "HH" },
  { slug: "home-special-offers", name: "Home Special Offers", icon: "HS" },
  { slug: "home-popular-destinations", name: "Home Popular Destinations", icon: "HD" },
  { slug: "home-partners", name: "Home Partners", icon: "HP" },
  { slug: "home-newsletter", name: "Home Newsletter", icon: "HN" },
];

function widgetLabel(slug: string): string {
  const m = AVAILABLE_WIDGETS.find((w) => w.slug === slug);
  return m?.name ?? slug;
}

function normalizeLangCode(value: string): string {
  return value.trim().toLowerCase().slice(0, 5);
}

function getPageTranslation(page: AdminPageDetailRow | null, lang: string) {
  if (!page) return null;
  const code = normalizeLangCode(lang);
  return (page.translations ?? []).find((row) => normalizeLangCode(row.lang) === code) ?? null;
}

function getWidgetTranslatedContent(
  widget: AdminWidgetContentRow,
  lang: string
): Record<string, unknown> | null {
  const code = normalizeLangCode(lang);
  const match = (widget.translations ?? []).find(
    (row) => normalizeLangCode(row.lang) === code
  );
  return match?.widget_content ?? null;
}

function isValidWidgetContentPayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

export default function AdminPageEditorLayoutPage() {
  const { token, user, logout } = useAdminAuth();
  const { t, lang, setLang, languageOptions } = useLanguage();
  const router = useRouter();
  const confirm = useConfirm();
  const allowed = canAccessPlatformAdminNav(user);
  const params = useParams<{ id: string }>();
  const pageId = Number(params?.id ?? 0);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [page, setPage] = useState<AdminPageDetailRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [openWidgetId, setOpenWidgetId] = useState<number | null>(null);
  const [savingWidgetId, setSavingWidgetId] = useState<number | null>(null);

  const [menuName, setMenuName] = useState("");
  const [slugName, setSlugName] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaKeywords, setMetaKeywords] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [enableSeo, setEnableSeo] = useState(false);
  const [breadCrumb, setBreadCrumb] = useState(true);
  const [languages, setLanguages] = useState<LocalizationLanguageRow[]>([]);
  const [activeLanguage, setActiveLanguage] = useState("en");
  const [defaultLanguage, setDefaultLanguage] = useState("en");

  const widgets = useMemo(() => {
    const source = page?.widget_contents ?? [];
    return [...source]
      .sort((a, b) => a.position - b.position)
      .map((widget) => {
        const translatedContent =
          normalizeLangCode(activeLanguage) === normalizeLangCode(defaultLanguage)
            ? null
            : getWidgetTranslatedContent(widget, activeLanguage);
        return translatedContent
          ? { ...widget, widget_content: translatedContent }
          : widget;
      });
  }, [page?.widget_contents, activeLanguage, defaultLanguage]);

  const load = useCallback(async () => {
    if (!token || !allowed || !Number.isFinite(pageId) || pageId <= 0) return;
    setErr(null);
    setForbidden(false);
    setLoading(true);
    try {
      const [pageRes, langRes] = await Promise.all([
        apiAdminPage(token, pageId),
        apiAdminLanguages(token),
      ]);
      setPage(pageRes.data);
      const enabledLanguages = (langRes.data ?? [])
        .filter((lang) => lang.is_enabled !== false)
        .sort(
          (a, b) =>
            Number(b.is_default) - Number(a.is_default) || a.sort_order - b.sort_order
        );
      setLanguages(enabledLanguages);
      const defaultLangCode = normalizeLangCode(
        enabledLanguages.find((lang) => lang.is_default)?.code ?? "en"
      );
      setDefaultLanguage(defaultLangCode);
      setActiveLanguage((prev) => {
        const normalizedPrev = normalizeLangCode(prev);
        const exists = enabledLanguages.some(
          (lang) => normalizeLangCode(lang.code) === normalizedPrev
        );
        return exists ? normalizedPrev : defaultLangCode;
      });
      setEnableSeo(!!pageRes.data.enable_seo);
      setBreadCrumb(!!pageRes.data.is_bread_crumb);
      setOpenWidgetId(null);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load page");
    } finally {
      setLoading(false);
    }
  }, [token, allowed, pageId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Header notification badge (non-critical chrome) — mirrors SettingsPage.
  useEffect(() => {
    if (!token || !canAccessNotificationsNav(user)) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiNotificationsUnreadCount(token);
        if (!cancelled) setUnreadCount(res.data.unread_count ?? 0);
      } catch {
        /* badge is non-critical chrome */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  useEffect(() => {
    if (!page) return;
    const isDefault =
      normalizeLangCode(activeLanguage) === normalizeLangCode(defaultLanguage);
    const translated = isDefault ? null : getPageTranslation(page, activeLanguage);
    setMenuName(translated?.page_name ?? (isDefault ? page.page_name ?? "" : ""));
    setSlugName(translated?.page_slug ?? (isDefault ? page.page_slug ?? "" : ""));
    setMetaTitle(translated?.meta_title ?? (isDefault ? page.meta_title ?? "" : ""));
    setMetaKeywords(
      (translated?.meta_keywords ?? (isDefault ? page.meta_keywords : []))?.join(", ") ??
        ""
    );
    setMetaDescription(
      translated?.meta_description ?? (isDefault ? page.meta_description ?? "" : "")
    );
  }, [page, activeLanguage, defaultLanguage]);

  async function saveHeaderPatch(
    patch: Partial<
      Pick<
        AdminPageDetailRow,
        | "page_name"
        | "page_slug"
        | "meta_title"
        | "meta_keywords"
        | "meta_description"
        | "enable_seo"
        | "is_bread_crumb"
      >
    >
  ) {
    if (!token || !page) return;
    try {
      setBusyAction("header");
      const nextKeywords =
        patch.meta_keywords ??
        metaKeywords
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part !== "");
      const payload = {
        page_name: patch.page_name ?? menuName,
        page_slug: patch.page_slug ?? slugName,
        meta_title: patch.meta_title ?? metaTitle,
        meta_keywords: nextKeywords,
        meta_description: patch.meta_description ?? metaDescription,
        enable_seo: patch.enable_seo ?? enableSeo,
        is_bread_crumb: patch.is_bread_crumb ?? breadCrumb,
      };
      const res = await apiPatchAdminPage(token, page.id, payload, {
        lang: activeLanguage,
      });
      setPage((prev) =>
        prev
          ? {
              ...prev,
              ...res.data,
              translations:
                (res.data as AdminPageDetailRow).translations ?? prev.translations,
            }
          : prev
      );
      setMenuName(payload.page_name ?? "");
      setSlugName(payload.page_slug ?? "");
      setMetaTitle(payload.meta_title ?? "");
      setMetaKeywords(nextKeywords.join(", "));
      setMetaDescription(payload.meta_description ?? "");
      setEnableSeo(!!res.data.enable_seo);
      setBreadCrumb(!!res.data.is_bread_crumb);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to update page");
    } finally {
      setBusyAction(null);
    }
  }

  async function togglePublished() {
    if (!token || !page) return;
    const nextStatus = page.status === 1 ? 0 : 1;
    setBusyAction("published");
    setErr(null);
    try {
      const res = await apiPatchAdminPageStatus(token, {
        page_id: page.id,
        status: nextStatus as 0 | 1,
      });
      setPage((prev) => (prev ? { ...prev, status: res.data.status } : prev));
    } catch (e) {
      setErr(
        e instanceof ApiRequestError ? e.message : "Failed to update published status"
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function addWidget(widgetSlug: string) {
    if (!token || !page) return;
    setBusyAction(`add:${widgetSlug}`);
    setErr(null);
    try {
      const res = await apiAddAdminPageWidget(token, {
        page_id: page.id,
        widget_slug: widgetSlug,
      });
      setPage((prev) => {
        if (!prev) return prev;
        const next = [...(prev.widget_contents ?? []), res.data];
        return { ...prev, widget_contents: next };
      });
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to add widget");
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleWidgetStatus(widget: AdminWidgetContentRow) {
    if (!token) return;
    const nextStatus: 0 | 1 = widget.status === 1 ? 0 : 1;
    setBusyAction(`widget-status:${widget.id}`);
    setErr(null);
    try {
      const res = await apiUpdateAdminPageWidget(token, {
        widget_content_id: widget.id,
        status: nextStatus,
      });
      setPage((prev) => {
        if (!prev) return prev;
        const next = (prev.widget_contents ?? []).map((w) =>
          w.id === widget.id ? { ...w, status: res.data.status } : w
        );
        return { ...prev, widget_contents: next };
      });
    } catch (e) {
      setErr(
        e instanceof ApiRequestError ? e.message : "Failed to update widget status"
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteWidget(widget: AdminWidgetContentRow) {
    if (!token) return;
    const ok = await confirm({
      message: t("admin.pages.confirm_delete_widget").replace("{label}", widgetLabel(widget.widget_slug)),
      variant: "danger",
    });
    if (!ok) return;
    setBusyAction(`widget-delete:${widget.id}`);
    setErr(null);
    try {
      await apiDeleteAdminPageWidget(token, widget.id);
      setPage((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          widget_contents: (prev.widget_contents ?? []).filter(
            (w) => w.id !== widget.id
          ),
        };
      });
      setOpenWidgetId((prev) => (prev === widget.id ? null : prev));
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to delete widget");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveWidgetContent(widgetId: number, content: Record<string, unknown>) {
    if (!token) return;
    if (!isValidWidgetContentPayload(content)) {
      setErr("Widget content payload is invalid JSON object.");
      return;
    }
    setSavingWidgetId(widgetId);
    setErr(null);
    try {
      const isDefaultLanguage =
        normalizeLangCode(activeLanguage) === normalizeLangCode(defaultLanguage);
      const body = isDefaultLanguage
        ? {
            widget_content_id: widgetId,
            widget_content: content,
          }
        : {
            widget_content_id: widgetId,
            translations: [{ lang: activeLanguage, widget_content: content }],
          };
      const res = await apiUpdateAdminPageWidget(token, body, {
        lang: activeLanguage,
      });
      setPage((prev) => {
        if (!prev) return prev;
        const next = (prev.widget_contents ?? []).map((w) =>
          w.id === widgetId
            ? {
                ...w,
                widget_content: res.data.widget_content,
                status: res.data.status,
                translations: res.data.translations,
              }
            : w
        );
        return { ...prev, widget_contents: next };
      });
    } catch (e) {
      setErr(
        e instanceof ApiRequestError ? e.message : "Failed to save widget content"
      );
    } finally {
      setSavingWidgetId(null);
    }
  }

  const isDefaultLanguage =
    normalizeLangCode(activeLanguage) === normalizeLangCode(defaultLanguage);
  const hasPageTranslation = !!getPageTranslation(page, activeLanguage);

  function copyPageFieldsFromDefault() {
    if (!page) return;
    setMenuName(page.page_name ?? "");
    setSlugName(page.page_slug ?? "");
    setMetaTitle(page.meta_title ?? "");
    setMetaKeywords((page.meta_keywords ?? []).join(", "));
    setMetaDescription(page.meta_description ?? "");
  }

  function copyWidgetFromDefault(widgetId: number) {
    if (!page) return;
    const source = (page.widget_contents ?? []).find((w) => w.id === widgetId);
    if (!source) return;
    void saveWidgetContent(widgetId, source.widget_content ?? {});
  }

  const editorTitle = page?.page_name ?? t("admin.pages.editor.title");
  const published = page?.status === 1;

  // Shared mgmt chrome (sidebar + header + window-locked host), mirroring
  // SettingsPage. Every render path returns through this shell so the editor
  // lives inside the same magenta surface as the rest of Settings.
  function shell(body: React.ReactNode, header?: React.ReactNode) {
    return (
      <div className="mgmt-page mgmt-page-host">
        <div className={`layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <Sidebar collapsed={sidebarCollapsed} unreadCount={unreadCount} />
          <div className="main">
            <Header
              collapsed={sidebarCollapsed}
              onHamburger={() => setSidebarCollapsed((v) => !v)}
              user={user ?? null}
              token={token}
              lang={lang}
              languageOptions={languageOptions}
              onSetLang={setLang}
              unreadCount={unreadCount}
              onLogout={() => void logout().then(() => router.push("/login"))}
              onNavigate={(href) => router.push(href)}
            />
            <div className="page">
              <div className="page-header">
                <div>
                  <div className="breadcrumb">
                    <a onClick={() => router.push("/dashboard")}>Home</a>
                    <i className="ti ti-chevron-right" />
                    <a onClick={() => router.push("/pages")}>Settings</a>
                    <i className="ti ti-chevron-right" />
                    <a onClick={() => router.push("/pages")}>CMS pages</a>
                    <i className="ti ti-chevron-right" />
                    <span className="breadcrumb-current">{editorTitle}</span>
                  </div>
                  <h1 className="page-title">
                    <span>{editorTitle}</span>
                  </h1>
                  <div className="page-subtitle">{t("admin.pages.editor.title")}</div>
                </div>
                {header ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {header}
                  </div>
                ) : null}
              </div>
              {body}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!allowed || forbidden) {
    return shell(
      <div className="card">
        <div className="card-body">
          <p className="font-semibold" style={{ marginBottom: 4 }}>
            {t("admin.forbidden.title")}
          </p>
          <p className="text-secondary text-sm">{t("admin.forbidden.default_detail")}</p>
        </div>
      </div>
    );
  }

  if (!Number.isFinite(pageId) || pageId <= 0) {
    return shell(
      <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}>
        <i className="ti ti-alert-triangle" />
        Invalid page id.
      </div>
    );
  }

  const headerActions = (
    <>
      <button
        className="btn btn-primary"
        onClick={() => void togglePublished()}
        disabled={busyAction === "published" || page == null}
      >
        <i className={`ti ${published ? "ti-circle-check" : "ti-circle-dashed"}`} />
        {published
          ? t("admin.pages.editor.published_btn")
          : t("admin.pages.editor.draft_btn")}
      </button>
      <button
        className="btn"
        disabled={!slugName}
        onClick={() => window.open(`/${slugName}`, "_blank", "noopener,noreferrer")}
      >
        <i className="ti ti-external-link" />
        {t("admin.pages.editor.view_page")}
      </button>
    </>
  );

  return shell(
    <>
      {/* Language tabs + editing indicator */}
      <div className="card">
        <div className="card-body" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div className="lang-seg">
            {languages.map((langRow) => {
              const isActive =
                normalizeLangCode(langRow.code) === normalizeLangCode(activeLanguage);
              return (
                <button
                  key={langRow.code}
                  type="button"
                  className={isActive ? "active" : ""}
                  onClick={() => setActiveLanguage(langRow.code)}
                >
                  {langRow.code.toUpperCase()}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="badge badge-gray">
              {t("admin.pages.editor.editing")}: {activeLanguage.toUpperCase()}
            </span>
            {!isDefaultLanguage && !hasPageTranslation ? (
              <button className="btn btn-sm" onClick={copyPageFieldsFromDefault}>
                {t("admin.pages.editor.copy_default")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {err && (
        <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}>
          <i className="ti ti-alert-triangle" />
          {err}
        </div>
      )}

      <section
        className="card"
        style={loading ? { pointerEvents: "none", opacity: 0.6 } : undefined}
      >
        <div className="card-header">
          <div className="card-title">{t("admin.pages.editor.title")}</div>
        </div>
        <div className="card-body">
        <div className="form-grid">
          <div className="fld">
            <label className="fld-label" htmlFor="pe-menu">
              {t("admin.pages.editor.menu_name")}
            </label>
            <input
              id="pe-menu"
              value={menuName}
              onChange={(e) => setMenuName(e.target.value)}
              onBlur={() => void saveHeaderPatch({ page_name: menuName })}
            />
          </div>
          <div className="fld">
            <label className="fld-label" htmlFor="pe-slug">
              {t("admin.pages.editor.slug_name")}
            </label>
            <input
              id="pe-slug"
              className="font-mono"
              value={slugName}
              onChange={(e) => setSlugName(e.target.value)}
              onBlur={() => void saveHeaderPatch({ page_slug: slugName })}
            />
          </div>
          <div className="fld span-2">
            <label className="fld-label" htmlFor="pe-mt">
              {t("admin.pages.editor.meta_title")}
            </label>
            <input
              id="pe-mt"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              onBlur={() => void saveHeaderPatch({ meta_title: metaTitle })}
            />
          </div>
          <div className="fld span-2">
            <label className="fld-label" htmlFor="pe-mk">
              {t("admin.pages.editor.meta_keywords")}
            </label>
            <input
              id="pe-mk"
              value={metaKeywords}
              onChange={(e) => setMetaKeywords(e.target.value)}
              onBlur={() =>
                void saveHeaderPatch({
                  meta_keywords: metaKeywords
                    .split(",")
                    .map((part) => part.trim())
                    .filter((part) => part !== ""),
                })
              }
            />
          </div>
          <div className="fld span-2">
            <label className="fld-label" htmlFor="pe-md">
              {t("admin.pages.editor.meta_description")}
            </label>
            <textarea
              id="pe-md"
              rows={3}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              onBlur={() => void saveHeaderPatch({ meta_description: metaDescription })}
            />
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
          <label className="switch-row">
            <span className="switch">
              <input
                type="checkbox"
                checked={enableSeo}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setEnableSeo(checked);
                  void saveHeaderPatch({ enable_seo: checked });
                }}
              />
              <span className="switch-slider" />
            </span>
            <span className="text-sm">{t("admin.pages.editor.allow_seo")}</span>
          </label>
          <label className="switch-row">
            <span className="switch">
              <input
                type="checkbox"
                checked={breadCrumb}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setBreadCrumb(checked);
                  void saveHeaderPatch({ is_bread_crumb: checked });
                }}
              />
              <span className="switch-slider" />
            </span>
            <span className="text-sm">{t("admin.pages.editor.breadcrumb")}</span>
          </label>
        </div>
        </div>
      </section>

      {/* Content = the widget builder (widgets palette + canvas) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="cms-builder-grid">
        <aside className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Widgets</div>
              <div className="card-subtitle">Click a widget to add it to the canvas.</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {AVAILABLE_WIDGETS.map((widget) => (
                <button
                  key={widget.slug}
                  type="button"
                  className="cms-widget-add"
                  disabled={busyAction === `add:${widget.slug}`}
                  onClick={() => void addWidget(widget.slug)}
                >
                  <span className="cms-widget-ico">{widget.icon}</span>
                  <span className="cms-widget-name">{widget.name}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Canvas</div>
              <div className="card-subtitle">Added widgets appear here in page order.</div>
            </div>
          </div>
          <div className="card-body">
            {widgets.length === 0 ? (
              <div className="empty-state">
                <i className="ti ti-layout-board" />
                <div>No widgets added yet.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {widgets.map((widget) => {
                  const active = widget.status === 1;
                  const isOpen = openWidgetId === widget.id;
                  const hasWidgetTranslation = !!getWidgetTranslatedContent(
                    widget,
                    activeLanguage
                  );
                  return (
                    <div key={widget.id} className="cms-widget-row">
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div className="font-semibold" style={{ fontSize: 13 }}>
                            {widgetLabel(widget.widget_slug)}
                          </div>
                          <div className="text-secondary text-sm">
                            Card: {widget.ui_card_number} | Position: {widget.position}
                          </div>
                          {!isDefaultLanguage ? (
                            <div style={{ marginTop: 4 }}>
                              {hasWidgetTranslation ? (
                                <span className="badge badge-success">
                                  {activeLanguage.toUpperCase()} translation
                                </span>
                              ) : (
                                <span className="badge badge-warning">
                                  No {activeLanguage.toUpperCase()} translation
                                </span>
                              )}
                            </div>
                          ) : null}
                        </div>
                        <span className={`badge ${active ? "badge-success" : "badge-gray"}`}>
                          {active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <label className="switch" aria-label="Toggle widget status">
                          <input
                            type="checkbox"
                            checked={active}
                            disabled={busyAction === `widget-status:${widget.id}`}
                            onChange={() => void toggleWidgetStatus(widget)}
                          />
                          <span className="switch-slider" />
                        </label>
                        <button
                          className="btn btn-sm"
                          onClick={() =>
                            setOpenWidgetId((prev) => (prev === widget.id ? null : widget.id))
                          }
                        >
                          {isOpen ? "Close" : "Edit"}
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={busyAction === `widget-delete:${widget.id}`}
                          onClick={() => void deleteWidget(widget)}
                        >
                          Delete
                        </button>
                        {!isDefaultLanguage ? (
                          <button
                            className="btn btn-sm"
                            onClick={() => copyWidgetFromDefault(widget.id)}
                          >
                            Copy from default
                          </button>
                        ) : null}
                      </div>

                      {isOpen ? (
                        <WidgetForm
                          key={`${widget.id}-${activeLanguage}`}
                          widget={widget}
                          activeLanguage={activeLanguage}
                          saving={savingWidgetId === widget.id}
                          onSave={async (payload) => {
                            await saveWidgetContent(widget.id, payload);
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    headerActions
  );
}
