"use client";

/**
 * Static-page rich-text editor (Sprint 3 of ZULU CMS roadmap).
 * Edits about / contact / terms / privacy / cookies via TipTap with
 * 3-language tabs (EN/RU/HY). Server-side route: PATCH
 * /api/platform-admin/static-pages/{slug}.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { TipTapEditor } from "@/components/TipTapEditor";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiAdminStaticPage,
  apiUpdateStaticPage,
  STATIC_PAGE_SLUGS,
  type StaticPageAdminPayload,
  type StaticPageSlug,
} from "@/lib/platform-admin-api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Lang = "en" | "ru" | "hy";

const LANG_TABS: Array<{ key: Lang; label: string }> = [
  { key: "en", label: "EN" },
  { key: "ru", label: "RU" },
  { key: "hy", label: "HY" },
];

function isValidSlug(s: string): s is StaticPageSlug {
  return (STATIC_PAGE_SLUGS as readonly string[]).includes(s);
}

export default function StaticPageEditPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [data, setData] = useState<StaticPageAdminPayload | null>(null);
  const [activeLang, setActiveLang] = useState<Lang>("en");
  const [forbidden, setForbidden] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed || !slug || !isValidSlug(slug)) return;
    setErr(null);
    try {
      const res = await apiAdminStaticPage(token, slug);
      setData(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
    }
  }, [token, allowed, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed || forbidden) {
    return (
      <div>
        <Link href="/platform/settings/pages" className="mb-2 inline-flex items-center gap-1 text-xs text-violet-700 hover:underline">
          ← Back to Pages
        </Link>
        <h1 className="admin-page-title">Page editor</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (!slug || !isValidSlug(slug)) {
    return (
      <div>
        <Link href="/platform/settings/pages" className="mb-2 inline-flex items-center gap-1 text-xs text-violet-700 hover:underline">
          ← Back to Pages
        </Link>
        <h1 className="admin-page-title">Page editor</h1>
        <p className="mt-4 text-sm text-error-600">Unknown page slug.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Link href="/platform/settings/pages" className="mb-2 inline-flex items-center gap-1 text-xs text-violet-700 hover:underline">
          ← Back to Pages
        </Link>
        <h1 className="admin-page-title">Page editor</h1>
        <p className="mt-4 text-sm text-fg-t7">Loading…</p>
      </div>
    );
  }

  async function handleSave() {
    if (!token || !data) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await apiUpdateStaticPage(token, slug as StaticPageSlug, {
        name: data.name,
        meta_title: data.meta_title,
        meta_description: data.meta_description,
        body_html_en: data.body_html_en,
        body_html_ru: data.body_html_ru,
        body_html_hy: data.body_html_hy,
      });
      setData(res.data);
      setSavedAt(Date.now());
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const bodyField: keyof StaticPageAdminPayload = (`body_html_${activeLang}` as keyof StaticPageAdminPayload);
  const bodyValue = (data[bodyField] as string | null) ?? "";

  return (
    <div className="max-w-4xl">
      <Link href="/platform/settings/pages" className="mb-2 inline-flex items-center gap-1 text-xs text-violet-700 hover:underline">
        ← Back to Pages
      </Link>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="admin-page-title">Edit page: {data.name}</h1>
          <p className="text-xs text-fg-t7 font-mono">/{slug}</p>
        </div>
      </div>

      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      {savedAt && <p className="mt-2 text-sm text-emerald-700">Saved.</p>}

      <section className="mt-4 rounded-lg border border-default bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-fg-t11">Page meta</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs">
            <span className="text-fg-t6">Display name (internal)</span>
            <input
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="text-fg-t6">SEO title</span>
            <input
              value={data.meta_title ?? ""}
              onChange={(e) => setData({ ...data, meta_title: e.target.value === "" ? null : e.target.value })}
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs md:col-span-2">
            <span className="text-fg-t6">SEO description</span>
            <textarea
              value={data.meta_description ?? ""}
              onChange={(e) => setData({ ...data, meta_description: e.target.value === "" ? null : e.target.value })}
              rows={2}
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-default bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-fg-t11">Body content</h2>
          <div className="flex items-center gap-1">
            {LANG_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveLang(tab.key)}
                className={
                  activeLang === tab.key
                    ? "rounded-md border border-violet-300 bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700"
                    : "rounded-md border border-default bg-white px-3 py-1 text-xs font-medium text-fg-t7 hover:border-violet-300"
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <TipTapEditor
          value={bodyValue}
          onChange={(html) => setData({ ...data, [bodyField]: html })}
          minHeight="320px"
        />
      </section>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-default bg-white py-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="admin-btn-primary"
        >
          {saving ? "Saving…" : "Save all"}
        </button>
      </div>
    </div>
  );
}
