"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { getApiBaseUrl } from "@/lib/api-base";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiDeleteNewsletterSubscription,
  apiNewsletterStats,
  apiNewsletterSubscriptions,
  type NewsletterStats,
  type NewsletterSubscriptionRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

const SOURCES = ["", "home", "footer", "newsletter-block", "other"];
const LANGS = ["", "en", "ru", "hy"];

export default function PlatformNewsletterPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<NewsletterSubscriptionRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState("");
  const [lang, setLang] = useState("");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [stats, setStats] = useState<NewsletterStats | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiNewsletterSubscriptions(token, {
        page,
        per_page: 25,
        source: source || undefined,
        lang: lang || undefined,
        search: search || undefined,
        active_only: activeOnly,
      });
      setRows(res.data);
      setMeta(res.meta as unknown as ApiListMeta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.newsletter.err_load"));
    }
  }, [token, allowed, page, source, lang, search, activeOnly, t]);

  const loadStats = useCallback(async () => {
    if (!token || !allowed) return;
    try {
      const res = await apiNewsletterStats(token);
      setStats(res.data);
    } catch {
      // non-blocking
    }
  }, [token, allowed]);

  useEffect(() => {
    void load();
    void loadStats();
  }, [load, loadStats]);

  async function handleDelete(id: number) {
    if (!token) return;
    if (!window.confirm(t("admin.newsletter.confirm_unsubscribe"))) return;
    setBusyId(id);
    try {
      await apiDeleteNewsletterSubscription(token, id);
      await load();
      await loadStats();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.newsletter.err_unsubscribe"));
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    if (!token) return;
    const q = new URLSearchParams();
    if (source) q.set("source", source);
    if (lang) q.set("lang", lang);
    q.set("active_only", activeOnly ? "1" : "0");
    const url = `${getApiBaseUrl().replace(/\/$/, "")}/api/platform-admin/newsletter/subscriptions/export.csv?${q.toString()}`;
    void fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/csv",
      },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .catch(() => alert(t("admin.newsletter.err_export")));
  }

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.newsletter.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">{t("admin.newsletter.title_long")}</h1>

      {stats && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-default bg-white p-3">
            <p className="text-xs text-fg-t7">{t("admin.newsletter.stat_active")}</p>
            <p className="mt-1 text-2xl font-semibold text-fg-t11 tabular-nums">{stats.total_active}</p>
          </div>
          <div className="rounded border border-default bg-white p-3">
            <p className="text-xs text-fg-t7">{t("admin.newsletter.stat_by_lang")}</p>
            <p className="mt-1 text-xs text-fg-t8">
              {Object.entries(stats.by_lang).map(([k, v]) => `${k}: ${v}`).join("  ·  ") || "—"}
            </p>
          </div>
          <div className="rounded border border-default bg-white p-3">
            <p className="text-xs text-fg-t7">{t("admin.newsletter.stat_by_source")}</p>
            <p className="mt-1 text-xs text-fg-t8">
              {Object.entries(stats.by_source).map(([k, v]) => `${k || "—"}: ${v}`).join("  ·  ") || "—"}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-fg-t6">
          {t("admin.newsletter.filter_source")}
          <select
            value={source}
            onChange={(e) => {
              setPage(1);
              setSource(e.target.value);
            }}
            className="ml-2 rounded border border-default px-2 py-1 text-sm"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s || t("common.all")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-fg-t6">
          {t("admin.newsletter.filter_lang")}
          <select
            value={lang}
            onChange={(e) => {
              setPage(1);
              setLang(e.target.value);
            }}
            className="ml-2 rounded border border-default px-2 py-1 text-sm"
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {l || t("common.all")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-fg-t6">
          {t("admin.newsletter.filter_search")}
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setSearch(searchDraft.trim());
              }
            }}
            placeholder={t("admin.newsletter.search_placeholder")}
            className="ml-2 w-56 rounded border border-default px-2 py-1 text-sm"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-fg-t6">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => {
              setPage(1);
              setActiveOnly(e.target.checked);
            }}
            className="h-4 w-4"
          />
          {t("admin.newsletter.filter_active_only")}
        </label>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setSearch(searchDraft.trim());
          }}
          className="rounded border border-default bg-white px-3 py-1 text-sm hover:bg-figma-bg-1"
        >
          {t("admin.newsletter.btn_apply")}
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-700"
        >
          {t("admin.newsletter.btn_export_csv")}
        </button>
      </div>

      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}

      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.newsletter.col_id")}</th>
              <th className="px-3 py-2">{t("admin.newsletter.col_email")}</th>
              <th className="px-3 py-2">{t("admin.newsletter.col_lang")}</th>
              <th className="px-3 py-2">{t("admin.newsletter.col_source")}</th>
              <th className="px-3 py-2">{t("admin.newsletter.col_subscribed")}</th>
              <th className="px-3 py-2">{t("admin.newsletter.col_unsubscribed")}</th>
              <th className="px-3 py-2">{t("admin.newsletter.col_actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-fg-t6">
                  {t("admin.newsletter.empty")}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 tabular-nums text-fg-t7">{r.id}</td>
                <td className="px-3 py-2 font-medium">{r.email}</td>
                <td className="px-3 py-2 text-xs">{r.lang ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.source ?? "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {r.subscribed_at ? new Date(r.subscribed_at).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.unsubscribed_at ? (
                    <span className="text-error-600">
                      {new Date(r.unsubscribed_at).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-emerald-700">{t("admin.newsletter.status_active")}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {!r.unsubscribed_at && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void handleDelete(r.id)}
                      className="text-xs text-error-600 underline disabled:opacity-40"
                    >
                      {t("admin.newsletter.btn_unsubscribe")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
