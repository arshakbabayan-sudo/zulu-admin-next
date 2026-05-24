"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDateTime } from "@/lib/format";
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
import {
  Button,
  Checkbox,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Select,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  FilterCard,
  FilterField,
  V2Card,
  V2Button,
} from "@/components/ui/v2";

const SOURCES = ["", "home", "footer", "newsletter-block", "other"];
const LANGS = ["", "en", "ru", "hy"];

export default function PlatformNewsletterPage() {
  const { token, user } = useAdminAuth();
  const { t, lang: uiLang } = useLanguage();
  const confirm = useConfirm();
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
    const ok = await confirm({ messageKey: "admin.newsletter.confirm_unsubscribe" });
    if (!ok) return;
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
      headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" },
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
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.newsletter.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Settings Newsletter page chrome. */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.newsletter.title_long") },
        ]}
        title={t("admin.newsletter.title_long")}
      />

      <SectionTabs
        activeHref="/platform/newsletter"
        items={[
          { href: "/settings/pricing-rules", label: "Pricing rules" },
          { href: "/settings/money-flow", label: "Money flow" },
          { href: "/localization/languages", label: "Languages" },
          { href: "/localization/templates", label: "Email templates" },
          { href: "/platform/banners", label: "Banners" },
          { href: "/pages", label: "CMS pages" },
          { href: "/platform/notifications", label: "System notifications" },
          { href: "/platform/newsletter", label: "Newsletter", count: meta?.total },
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

      {stats && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="admin-card p-4">
            <p className="text-xs text-fg-t6 uppercase tracking-wide">{t("admin.newsletter.stat_active")}</p>
            <p className="mt-1 text-2xl font-semibold text-fg-t11 tabular-nums">{stats.total_active}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-xs text-fg-t6 uppercase tracking-wide">{t("admin.newsletter.stat_by_lang")}</p>
            <p className="mt-1 text-xs text-fg-t8">
              {Object.entries(stats.by_lang).map(([k, v]) => `${k}: ${v}`).join("  ·  ") || "—"}
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-xs text-fg-t6 uppercase tracking-wide">{t("admin.newsletter.stat_by_source")}</p>
            <p className="mt-1 text-xs text-fg-t8">
              {Object.entries(stats.by_source).map(([k, v]) => `${k || "—"}: ${v}`).join("  ·  ") || "—"}
            </p>
          </div>
        </div>
      )}

      <FilterCard>
        <FilterField label={t("admin.newsletter.filter_source")}>
          <Select id="nl-src" fieldSize="sm" value={source} onChange={(e) => { setPage(1); setSource(e.target.value); }} className="!h-[34px]">
            {SOURCES.map((s) => <option key={s} value={s}>{s || t("common.all")}</option>)}
          </Select>
        </FilterField>
        <FilterField label={t("admin.newsletter.filter_lang")}>
          <Select id="nl-lang" fieldSize="sm" value={lang} onChange={(e) => { setPage(1); setLang(e.target.value); }} className="!h-[34px]">
            {LANGS.map((l) => <option key={l} value={l}>{l || t("common.all")}</option>)}
          </Select>
        </FilterField>
        <FilterField label={t("admin.newsletter.filter_search")}>
          <Input
            id="nl-q"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); setSearch(searchDraft.trim()); } }}
            placeholder={t("admin.newsletter.search_placeholder")}
            className="!h-[34px]"
          />
        </FilterField>
        <Checkbox
          checked={activeOnly}
          onChange={(e) => { setPage(1); setActiveOnly(e.target.checked); }}
          label={t("admin.newsletter.filter_active_only")}
        />
        <V2Button size="sm" variant="primary" onClick={() => { setPage(1); setSearch(searchDraft.trim()); }}>
          {t("admin.newsletter.btn_apply")}
        </V2Button>
        <V2Button size="sm" onClick={exportCsv}>
          {t("admin.newsletter.btn_export_csv")}
        </V2Button>
      </FilterCard>

      {err && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.newsletter.col_id")}</TH>
            <TH>{t("admin.newsletter.col_email")}</TH>
            <TH>{t("admin.newsletter.col_lang")}</TH>
            <TH>{t("admin.newsletter.col_source")}</TH>
            <TH>{t("admin.newsletter.col_subscribed")}</TH>
            <TH>{t("admin.newsletter.col_unsubscribed")}</TH>
            <TH>{t("admin.newsletter.col_actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={7}>{t("admin.newsletter.empty")}</TEmpty> : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums">{r.id}</TD>
              <TD className="font-medium">{r.email}</TD>
              <TD className="text-xs">{r.lang ?? "—"}</TD>
              <TD className="text-xs">{r.source ?? "—"}</TD>
              <TD className="text-xs">{formatDateTime(r.subscribed_at, uiLang)}</TD>
              <TD className="text-xs">
                {r.unsubscribed_at ? (
                  <span className="text-error-600">{formatDateTime(r.unsubscribed_at, uiLang)}</span>
                ) : (
                  <span className="text-success-700">{t("admin.newsletter.status_active")}</span>
                )}
              </TD>
              <TD>
                {!r.unsubscribed_at && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void handleDelete(r.id)}
                    className="text-xs text-error-600 underline disabled:opacity-40 hover:text-error-800"
                  >
                    {t("admin.newsletter.btn_unsubscribe")}
                  </button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      </V2Card>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
    </div>
  );
}
