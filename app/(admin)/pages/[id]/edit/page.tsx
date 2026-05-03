"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
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
import { useParams } from "next/navigation";
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

function getWidgetTranslatedContent(widget: AdminWidgetContentRow, lang: string): Record<string, unknown> | null {
  const code = normalizeLangCode(lang);
  const match = (widget.translations ?? []).find((row) => normalizeLangCode(row.lang) === code);
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

function statusBadge(active: boolean): string {
  return active
    ? "inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
    : "inline-flex items-center rounded-full bg-figma-bg-1 px-2 py-0.5 text-xs font-medium text-fg-t7";
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition ${
        checked ? "bg-violet-600" : "bg-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function AdminPageEditorLayoutPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const params = useParams<{ id: string }>();
  const pageId = Number(params?.id ?? 0);

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
        .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.sort_order - b.sort_order);
      setLanguages(enabledLanguages);
      const defaultLangCode = normalizeLangCode(
        enabledLanguages.find((lang) => lang.is_default)?.code ?? "en",
      );
      setDefaultLanguage(defaultLangCode);
      setActiveLanguage((prev) => {
        const normalizedPrev = normalizeLangCode(prev);
        const exists = enabledLanguages.some(
          (lang) => normalizeLangCode(lang.code) === normalizedPrev,
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

  useEffect(() => {
    if (!page) return;
    const isDefault = normalizeLangCode(activeLanguage) === normalizeLangCode(defaultLanguage);
    const translated = isDefault ? null : getPageTranslation(page, activeLanguage);
    setMenuName(translated?.page_name ?? (isDefault ? page.page_name ?? "" : ""));
    setSlugName(translated?.page_slug ?? (isDefault ? page.page_slug ?? "" : ""));
    setMetaTitle(translated?.meta_title ?? (isDefault ? page.meta_title ?? "" : ""));
    setMetaKeywords(
      (translated?.meta_keywords ?? (isDefault ? page.meta_keywords : []))?.join(", ") ?? "",
    );
    setMetaDescription(translated?.meta_description ?? (isDefault ? page.meta_description ?? "" : ""));
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
              translations: (res.data as AdminPageDetailRow).translations ?? prev.translations,
            }
          : prev,
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
      setErr(e instanceof ApiRequestError ? e.message : "Failed to update published status");
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
      setErr(e instanceof ApiRequestError ? e.message : "Failed to update widget status");
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteWidget(widget: AdminWidgetContentRow) {
    if (!token) return;
    if (!window.confirm(`Delete "${widgetLabel(widget.widget_slug)}" widget?`)) return;
    setBusyAction(`widget-delete:${widget.id}`);
    setErr(null);
    try {
      await apiDeleteAdminPageWidget(token, widget.id);
      setPage((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          widget_contents: (prev.widget_contents ?? []).filter((w) => w.id !== widget.id),
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
      setErr(e instanceof ApiRequestError ? e.message : "Failed to save widget content");
    } finally {
      setSavingWidgetId(null);
    }
  }

  const isDefaultLanguage = normalizeLangCode(activeLanguage) === normalizeLangCode(defaultLanguage);
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

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Page Editor</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (!Number.isFinite(pageId) || pageId <= 0) {
    return <p className="text-sm text-error-600">Invalid page id.</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Page Visual Editor</h1>
      <div className="mt-3 rounded border border-default bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {languages.map((lang) => {
              const isActive = normalizeLangCode(lang.code) === normalizeLangCode(activeLanguage);
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setActiveLanguage(lang.code)}
                  className={
                    isActive
                      ? "rounded-full border border-violet-300 bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700"
                      : "rounded-full border border-default bg-white px-3 py-1 text-xs font-medium text-fg-t7 hover:border-violet-300"
                  }
                >
                  {lang.code.toUpperCase()}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded bg-figma-bg-1 px-2 py-1 text-fg-t6">
              Editing: {activeLanguage.toUpperCase()}
            </span>
            {!isDefaultLanguage && !hasPageTranslation ? (
              <button
                type="button"
                onClick={copyPageFieldsFromDefault}
                className="rounded border border-violet-300 bg-violet-50 px-2 py-1 text-violet-700"
              >
                Copy page fields from default
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {err ? <p className="mt-2 text-sm text-error-600">{err}</p> : null}

      <section
        className={`mt-4 rounded border border-default bg-white p-4 transition-opacity ${
          loading ? "pointer-events-none opacity-60" : "opacity-100"
        }`}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-fg-t7">
            Menu Name
            <input
              value={menuName}
              onChange={(e) => setMenuName(e.target.value)}
              onBlur={() => void saveHeaderPatch({ page_name: menuName })}
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t7">
            Slug Name
            <input
              value={slugName}
              onChange={(e) => setSlugName(e.target.value)}
              onBlur={() => void saveHeaderPatch({ page_slug: slugName })}
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="text-sm text-fg-t7 md:col-span-2">
            Meta Title
            <input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              onBlur={() => void saveHeaderPatch({ meta_title: metaTitle })}
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t7 md:col-span-2">
            Meta Keywords (comma separated)
            <input
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
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-fg-t7 md:col-span-2">
            Meta Description
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              onBlur={() => void saveHeaderPatch({ meta_description: metaDescription })}
              rows={3}
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-5">
            <label className="inline-flex items-center gap-2 text-sm text-fg-t7">
              <input
                type="checkbox"
                checked={enableSeo}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setEnableSeo(checked);
                  void saveHeaderPatch({ enable_seo: checked });
                }}
              />
              Allow Page SEO
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-fg-t7">
              <input
                type="checkbox"
                checked={breadCrumb}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setBreadCrumb(checked);
                  void saveHeaderPatch({ is_bread_crumb: checked });
                }}
              />
              Bread Crumb Enable
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void togglePublished()}
              disabled={busyAction === "published" || page == null}
              className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {page?.status === 1 ? "Published" : "Unpublished"}
            </button>
            <button
              type="button"
              disabled={!slugName}
              onClick={() => window.open(`/${slugName}`, "_blank", "noopener,noreferrer")}
              className="rounded border border-default bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            >
              View Page
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <aside className="rounded border border-default bg-white p-4 lg:col-span-1">
          <h2 className="text-base font-semibold text-fg-t11">Widgets</h2>
          <p className="mt-1 text-xs text-fg-t6">Click a widget to add it to the canvas.</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {AVAILABLE_WIDGETS.map((widget) => (
              <button
                key={widget.slug}
                type="button"
                disabled={busyAction === `add:${widget.slug}`}
                onClick={() => void addWidget(widget.slug)}
                className="rounded border border-default bg-figma-bg-1 p-2 text-left hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-violet-100 text-[10px] font-semibold text-violet-700">
                    {widget.icon}
                  </span>
                  <span className="text-xs font-medium text-fg-t11">{widget.name}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded border border-default bg-white p-4 lg:col-span-2">
          <h2 className="text-base font-semibold text-fg-t11">Canvas</h2>
          <p className="mt-1 text-xs text-fg-t6">
            Added widgets appear here in page order. Edit details in Step 4.2.
          </p>

          <div className="mt-4 space-y-3">
            {widgets.length === 0 ? (
              <div className="rounded border border-dashed border-default p-6 text-center text-sm text-fg-t6">
                No widgets added yet.
              </div>
            ) : (
              widgets.map((widget) => {
                const active = widget.status === 1;
                const isOpen = openWidgetId === widget.id;
                const hasWidgetTranslation = !!getWidgetTranslatedContent(widget, activeLanguage);
                return (
                  <div key={widget.id} className="rounded border border-default bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-fg-t11">
                          {widgetLabel(widget.widget_slug)}
                        </div>
                        <div className="text-xs text-fg-t6">
                          Card: {widget.ui_card_number} | Position: {widget.position}
                        </div>
                        {!isDefaultLanguage ? (
                          <div className="mt-1 text-[11px]">
                            {hasWidgetTranslation ? (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                                {activeLanguage.toUpperCase()} translation
                              </span>
                            ) : (
                              <span className="rounded bg-warning-50 px-1.5 py-0.5 text-warning-700">
                                No {activeLanguage.toUpperCase()} translation
                              </span>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <span className={statusBadge(active)}>{active ? "Active" : "Inactive"}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Toggle
                        checked={active}
                        disabled={busyAction === `widget-status:${widget.id}`}
                        onChange={() => void toggleWidgetStatus(widget)}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setOpenWidgetId((prev) => (prev === widget.id ? null : widget.id))
                        }
                        className="rounded border border-default bg-white px-3 py-1 text-xs"
                      >
                        {isOpen ? "Close" : "Edit"}
                      </button>
                      <button
                        type="button"
                        disabled={busyAction === `widget-delete:${widget.id}`}
                        onClick={() => void deleteWidget(widget)}
                        className="rounded border border-red-300 bg-red-50 px-3 py-1 text-xs text-error-700 disabled:opacity-60"
                      >
                        Delete
                      </button>
                      {!isDefaultLanguage ? (
                        <button
                          type="button"
                          onClick={() => copyWidgetFromDefault(widget.id)}
                          className="rounded border border-violet-300 bg-violet-50 px-3 py-1 text-xs text-violet-700"
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
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
