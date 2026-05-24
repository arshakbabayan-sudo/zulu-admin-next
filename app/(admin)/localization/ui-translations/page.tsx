"use client";

/**
 * Phase-2 migration: replaces Triprex-style hardcoded purple (#7c3aed) +
 * inline styles with shared @/components/ui primitives + ZULU brand purple.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiAdminLanguages,
  apiUiTranslationsGetAdmin,
  apiUiTranslationsSave,
  type LocalizationLanguageRow,
  type UiTranslationRow,
} from "@/lib/localization-api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Save, Search } from "lucide-react";
import {
  Button,
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
  SectionTabs,
  V2Card,
} from "@/components/ui/v2";

const PER_PAGE = 50;

export default function UiTranslationsPage() {
  const { t } = useLanguage();
  const { token, user } = useAdminAuth();
  const isSuperAdmin = user?.is_super_admin === true;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [languages, setLanguages] = useState<LocalizationLanguageRow[]>([]);
  const [selectedLang, setSelectedLang] = useState<string>("");
  const [rows, setRows] = useState<UiTranslationRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const editRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!token) return;
    apiAdminLanguages(token)
      .then((res) => {
        setLanguages(res.data);
        const paramLang = searchParams.get("lang");
        const initial = (paramLang && res.data.find(l => l.code === paramLang))
          ? paramLang
          : res.data[0]?.code ?? "";
        setSelectedLang(initial);
      })
      .catch(() => setErr(t("admin.localization.err_load_languages")));
  }, [token, searchParams]);

  const loadTranslations = useCallback(async () => {
    if (!token || !selectedLang) return;
    setLoading(true);
    setErr(null);
    setRows([]);
    try {
      const res = await apiUiTranslationsGetAdmin(token, { lang: selectedLang, page, per_page: PER_PAGE, search });
      setRows(res.data.data);
      setLastPage(res.data.last_page);
      setEdits({});
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.localization.err_load"));
    } finally {
      setLoading(false);
    }
  }, [token, selectedLang, page, search]);

  useEffect(() => { loadTranslations(); }, [loadTranslations]);

  function handleEdit(key: string, value: string) {
    setEdits(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!token || !selectedLang || Object.keys(edits).length === 0) return;
    setSaving(true);
    setErr(null);
    setSuccessMsg(null);
    try {
      await apiUiTranslationsSave(token, { language_code: selectedLang, translations: edits });
      setSuccessMsg(t("admin.localization.saved_success").replace("{count}", String(Object.keys(edits).length)));
      await loadTranslations();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.localization.err_save"));
    } finally {
      setSaving(false);
    }
  }

  function handleSearch() {
    setPage(1);
    setSearch(searchInput);
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.localization.ui_title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice messageKey="admin.forbidden.ui_translations" />
        </div>
      </div>
    );
  }

  const hasEdits = Object.keys(edits).length > 0;

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.localization.ui_title") },
        ]}
        title={t("admin.localization.ui_title")}
        actions={
          <div className="flex items-center gap-2">
            <Select
              fieldSize="sm"
              value={selectedLang}
              onChange={(e) => {
                setSelectedLang(e.target.value);
                setPage(1);
                setSearch("");
                setSearchInput("");
                setEdits({});
              }}
              className="!w-auto min-w-[160px]"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name_en ?? l.name} ({l.code})
                </option>
              ))}
            </Select>
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-t6" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={t("admin.localization.search_placeholder")}
                className="!h-10 !pl-10 w-56"
              />
            </div>
            <Button size="sm" onClick={handleSearch}>
              <Search className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/localization/languages")}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t("admin.localization.go_back")}
            </Button>
          </div>
        }
      />

      <SectionTabs
        activeHref="/localization/ui-translations"
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

      {err && <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}
      {successMsg && <div className="mb-4 rounded-md border border-success-100 bg-success-50 px-4 py-2 text-sm text-success-700">{successMsg}</div>}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH align="center">{t("admin.localization.col_hash")}</TH>
            <TH>{t("admin.localization.col_key")}</TH>
            <TH>{t("admin.localization.col_value")}</TH>
          </TR>
        </THead>
        <TBody>
          {loading ? (
            <TEmpty colSpan={3}>{t("admin.localization.loading")}</TEmpty>
          ) : rows.length === 0 ? (
            <TEmpty colSpan={3}>{t("admin.localization.empty")}</TEmpty>
          ) : null}
          {rows.map((row, i) => {
            const editedValue = edits[row.key];
            const currentValue = editedValue !== undefined ? editedValue : row.value;
            return (
              <TR key={`${selectedLang}-${row.key}`}>
                <TD align="center" className="tabular-nums text-fg-t6">{(page - 1) * PER_PAGE + i + 1}</TD>
                <TD className="font-medium text-fg-t8">{row.key}</TD>
                <TD>
                  <Input
                    ref={(el) => { editRefs.current[row.key] = el as HTMLInputElement | null; }}
                    type="text"
                    value={currentValue}
                    onChange={(e) => handleEdit(row.key, e.target.value)}
                    className="!h-10"
                  />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      </V2Card>

      <div className="flex items-center justify-between mt-4">
        {lastPage > 1 ? (
          <Pagination page={page} lastPage={lastPage} onPage={setPage} className="!px-0 !py-0" />
        ) : <div />}
        <Button
          size="sm"
          disabled={saving || !hasEdits}
          onClick={handleSave}
        >
          <Save className="h-4 w-4" aria-hidden />
          {saving
            ? t("admin.localization.saving")
            : `${t("admin.localization.save")}${hasEdits ? ` (${Object.keys(edits).length})` : ""}`}
        </Button>
      </div>
    </div>
  );
}
