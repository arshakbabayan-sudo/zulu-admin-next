"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
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
import {

  Checkbox,

  Input,

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

  FilterCard,
  FilterField,
  V2Card,
  V2Button,
  IconButton,
} from "@/components/ui/v2";
import { SettingsSubgroupTabs } from "@/components/settings/SettingsSubgroupTabs";
import { Download, Trash2 } from "lucide-react";

const SOURCES = ["", "home", "footer", "newsletter-block", "other"];
const LANGS = ["", "en", "ru", "hy"];

export default function PlatformNewsletterPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
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
        actions={
          <V2Button icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
            Export
          </V2Button>
        }
      />

      <SettingsSubgroupTabs activeHref="/platform/newsletter" />

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
          {rows.map((r) => {
            const initials = getInitials(r.email);
            const tone = pickAvatarTone(r.id);
            return (
              <TR key={r.id}>
                <TD className="tabular-nums text-fg-t7 font-mono text-xs">#{r.id}</TD>
                <TD>
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={avatarStyle(tone)}
                      aria-hidden
                    >
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-fg-t8 truncate">{r.email}</div>
                      {r.source ? <div className="text-[11px] text-fg-t6 truncate">{r.source}</div> : null}
                    </div>
                  </div>
                </TD>
                <TD>
                  {r.lang ? (
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                      style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                    >
                      {r.lang}
                    </span>
                  ) : (
                    <span className="text-fg-t6">—</span>
                  )}
                </TD>
                <TD>
                  {r.source ? (
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                      style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                    >
                      {r.source}
                    </span>
                  ) : (
                    <span className="text-fg-t6">—</span>
                  )}
                </TD>
                <TD className="text-xs text-fg-t6" title={r.subscribed_at ?? undefined}>
                  {formatRelativeTime(r.subscribed_at)}
                </TD>
                <TD>
                  {r.unsubscribed_at ? (
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                      style={{ backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" }}
                      title={r.unsubscribed_at}
                    >
                      Unsubscribed
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                      style={{ backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" }}
                    >
                      {t("admin.newsletter.status_active")}
                    </span>
                  )}
                </TD>
                <TD align="right">
                  <div className="flex justify-end gap-1">
                    {!r.unsubscribed_at && (
                      <IconButton
                        onClick={() => void handleDelete(r.id)}
                        disabled={busyId === r.id}
                        aria-label={t("admin.newsletter.btn_unsubscribe")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      </V2Card>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
    </div>
  );
}

// v2 admin-redesign helpers — avatar / relative-time.
function getInitials(name: string): string {
  return (name || "?").split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function pickAvatarTone(id: number | string): "purple" | "teal" | "amber" | "blue" {
  const tones: Array<"purple" | "teal" | "amber" | "blue"> = ["purple", "teal", "amber", "blue"];
  const n = typeof id === "number" ? id : id.length;
  return tones[n % tones.length]!;
}

function avatarStyle(tone: "purple" | "teal" | "amber" | "blue"): React.CSSProperties {
  const map: Record<"purple" | "teal" | "amber" | "blue", React.CSSProperties> = {
    purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
    teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  };
  return map[tone];
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}
