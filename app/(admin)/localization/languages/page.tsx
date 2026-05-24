"use client";

/**
 * Phase-2 migration to shared @/components/ui primitives.
 *
 * Also strips inline Triprex purple (#7c3aed) and replaces every brand-coloured
 * surface with ZULU primary tokens via the shared Button / Switch / Modal /
 * Table primitives.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessLocalizationLanguagesNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiAdminLanguages,
  apiLocalizationCreateLanguage,
  apiLocalizationDeleteLanguage,
  apiLocalizationScan,
  apiLocalizationScanStatus,
  apiSetDefaultLanguage,
  apiEditLanguage,
  type LocalizationLanguageRow,
  type ScanScope,
  type ScanStatusResponse,
} from "@/lib/localization-api";
import {
  Button,
  FormField,
  Input,
  Modal,
  PageHeader,
  Switch,
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
import { Info, Pencil, Trash2, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const LANG_TO_COUNTRY: Record<string, string> = {
  en: "gb",
  ru: "ru",
  hy: "am",
  ar: "sa",
  fr: "fr",
  de: "de",
  es: "es",
  it: "it",
  pt: "pt",
  zh: "cn",
  ja: "jp",
  ko: "kr",
  tr: "tr",
  pl: "pl",
  nl: "nl",
  uk: "ua",
  he: "il",
  fa: "ir",
  hi: "in",
  bn: "bd",
};

function FlagImg({ code }: { code: string }) {
  const country = LANG_TO_COUNTRY[code.toLowerCase()] ?? code.toLowerCase().slice(0, 2);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/20x15/${country}.png`}
      srcSet={`https://flagcdn.com/40x30/${country}.png 2x`}
      width={20}
      height={15}
      alt={code}
      className="inline-block rounded-sm object-cover"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function EditModal({
  row,
  onClose,
  onSave,
}: {
  row: LocalizationLanguageRow;
  onClose: () => void;
  onSave: (name: string, nameEn: string, rtl: boolean) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(row.name);
  const [nameEn, setNameEn] = useState(row.name_en ?? "");
  const [rtl, setRtl] = useState(row.rtl ?? false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name || !nameEn) {
      setErr(t("admin.languages.fields_required"));
      return;
    }
    setSaving(true);
    try {
      await onSave(name, nameEn, rtl);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.languages.err_save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("admin.languages.edit_title").replace("{code}", row.code.toUpperCase())}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" disabled={saving} onClick={submit}>
            {saving ? t("admin.localization.saving") : t("common.save")}
          </Button>
        </>
      }
    >
      {err && (
        <div className="mb-3 rounded-zulu border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
          {err}
        </div>
      )}
      <div className="space-y-3">
        <FormField label={t("admin.languages.label_native_name")} htmlFor="lang-name">
          <Input id="lang-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label={t("admin.languages.label_name_en")} htmlFor="lang-nameen">
          <Input
            id="lang-nameen"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
        </FormField>
        <Switch
          checked={rtl}
          onCheckedChange={setRtl}
          label={t("admin.languages.label_rtl")}
        />
      </div>
    </Modal>
  );
}

function AddModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (code: string, name: string, nameEn: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!code || !name || !nameEn) {
      setErr(t("admin.languages.fields_required"));
      return;
    }
    setAdding(true);
    try {
      await onAdd(code, name, nameEn);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.languages.err_failed"));
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("admin.languages.add_title")}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" disabled={adding} onClick={submit}>
            {adding ? t("admin.languages.adding") : t("admin.languages.add_language")}
          </Button>
        </>
      }
    >
      {err && (
        <div className="mb-3 rounded-zulu border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
          {err}
        </div>
      )}
      <div className="space-y-3">
        <FormField label={t("admin.languages.label_code")} htmlFor="add-code">
          <Input
            id="add-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase())}
            placeholder={t("admin.languages.placeholder_code")}
            className="font-mono"
          />
        </FormField>
        <FormField label={t("admin.languages.label_native_name")} htmlFor="add-name">
          <Input
            id="add-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("admin.languages.placeholder_native")}
          />
        </FormField>
        <FormField label={t("admin.languages.label_name_en")} htmlFor="add-nameen">
          <Input
            id="add-nameen"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder={t("admin.languages.placeholder_name_en")}
          />
        </FormField>
      </div>
    </Modal>
  );
}

function AiTranslatorPanel({ token }: { token: string }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<null | ScanScope | "status">(null);
  const [output, setOutput] = useState<string>("");
  const [status, setStatus] = useState<ScanStatusResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!token) return;
    setBusy("status");
    setErr(null);
    try {
      const res = await apiLocalizationScanStatus(token);
      setStatus(res.data);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Status check failed");
    } finally {
      setBusy(null);
    }
  }, [token]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  async function runScan(scope: ScanScope, dryRun: boolean) {
    if (!token) return;
    setBusy(scope);
    setErr(null);
    setOutput("");
    try {
      const res = await apiLocalizationScan(token, { scope, dry_run: dryRun });
      setOutput(res.data.output);
      setTimeout(() => {
        refreshStatus();
      }, 500);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Scan failed");
    } finally {
      setBusy(null);
    }
  }

  const pendingTotal = status?.pending?.total ?? 0;
  const failedTotal = status?.failed?.total ?? 0;

  return (
    <section className="admin-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-fg-t11">
          🤖 {t("admin.localization.ai_translator_title")}
        </h2>
        <div className="flex items-center gap-3 text-xs text-fg-t7">
          <span>
            {t("admin.localization.ai_pending")}:{" "}
            <b className="tabular-nums">{pendingTotal}</b>
          </span>
          {failedTotal > 0 && (
            <span className="text-error-700">
              {t("admin.localization.ai_failed")}:{" "}
              <b className="tabular-nums">{failedTotal}</b>
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshStatus}
            disabled={busy !== null}
          >
            {busy === "status" ? "…" : t("admin.localization.ai_refresh")}
          </Button>
        </div>
      </div>

      <p className="mt-2 text-sm text-fg-t6 leading-relaxed">
        {t("admin.localization.ai_description")}
      </p>

      {err && (
        <div className="mt-3 rounded-zulu border border-error-100 bg-error-50 px-3 py-2 text-xs text-error-700">
          {err}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => runScan("both", true)}
          disabled={busy !== null}
        >
          🔍 {t("admin.localization.ai_dry_run")}
        </Button>
        <Button size="sm" onClick={() => runScan("ui", false)} disabled={busy !== null}>
          ✨ {t("admin.localization.ai_scan_ui")}
        </Button>
        <Button
          size="sm"
          onClick={() => runScan("content", false)}
          disabled={busy !== null}
        >
          ✨ {t("admin.localization.ai_scan_content")}
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => runScan("both", false)}
          disabled={busy !== null}
        >
          ✨ {t("admin.localization.ai_scan_both")}
        </Button>
      </div>

      {output && (
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-zulu bg-slate-900 px-4 py-3 font-mono text-xs leading-relaxed text-slate-100">
          {output}
        </pre>
      )}
    </section>
  );
}

export default function LocalizationLanguagesPage() {
  const { t } = useLanguage();
  const { token, user } = useAdminAuth();
  const confirmDialog = useConfirm();
  const allowed = canAccessLocalizationLanguagesNav(user);

  const [rows, setRows] = useState<LocalizationLanguageRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editRow, setEditRow] = useState<LocalizationLanguageRow | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    try {
      const res = await apiAdminLanguages(token);
      setRows(res.data);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.languages.err_load"));
    }
  }, [token, allowed, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSetDefault(row: LocalizationLanguageRow) {
    if (!token || row.is_default) return;
    setBusyId(row.id);
    try {
      await apiSetDefaultLanguage(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.languages.err_failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(row: LocalizationLanguageRow) {
    if (!token) return;
    const ok = await confirmDialog({
      message: t("admin.localization.languages.confirm_delete")
        .replace("{name}", row.name_en ?? row.name)
        .replace("{code}", row.code),
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(row.id);
    try {
      await apiLocalizationDeleteLanguage(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.languages.err_delete"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleEdit(name: string, nameEn: string, rtl: boolean) {
    if (!token || !editRow) return;
    await apiEditLanguage(token, editRow.id, { name, name_en: nameEn, rtl });
    await load();
  }

  async function handleAdd(code: string, name: string, nameEn: string) {
    if (!token) return;
    await apiLocalizationCreateLanguage(token, { code, name, name_en: nameEn });
    await load();
  }

  async function handleToggleRtl(row: LocalizationLanguageRow) {
    if (!token) return;
    setBusyId(row.id);
    try {
      await apiEditLanguage(token, row.id, {
        name: row.name,
        name_en: row.name_en ?? row.name,
        rtl: !(row.rtl ?? false),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.languages.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice messageKey="admin.forbidden.languages" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {editRow && (
        <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleEdit} />
      )}

      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.languages.title") },
        ]}
        title={t("admin.languages.title")}
        actions={
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.languages.add_new")}
          </Button>
        }
      />

      <SectionTabs
        activeHref="/localization/languages"
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

      {err && (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH align="center">{t("admin.languages.table_sn")}</TH>
            <TH>{t("admin.languages.table_name")}</TH>
            <TH>{t("admin.languages.table_code")}</TH>
            <TH align="center">{t("admin.languages.table_rtl")}</TH>
            <TH align="center">{t("admin.languages.table_default")}</TH>
            <TH align="center">{t("admin.languages.table_option")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={6}>{t("admin.languages.no_rows")}</TEmpty>
          ) : null}
          {rows.map((row, i) => (
            <TR key={row.id}>
              <TD align="center" className="text-fg-t6">
                {i + 1}
              </TD>
              <TD className="font-medium">{row.name}</TD>
              <TD>
                <span className="inline-flex items-center gap-2 font-mono">
                  <FlagImg code={row.code} />
                  {row.code}
                </span>
              </TD>
              <TD align="center">
                <div className="flex justify-center">
                  <Switch
                    checked={row.rtl ?? false}
                    disabled={busyId === row.id}
                    onCheckedChange={() => handleToggleRtl(row)}
                    aria-label={t("admin.languages.table_rtl")}
                  />
                </div>
              </TD>
              <TD align="center">
                <div className="flex justify-center">
                  <Switch
                    checked={row.is_default}
                    disabled={busyId === row.id || row.is_default}
                    onCheckedChange={() => handleSetDefault(row)}
                    aria-label={t("admin.languages.table_default")}
                  />
                </div>
              </TD>
              <TD align="center">
                <div className="flex items-center justify-center gap-2">
                  <Link
                    href={`/localization/ui-translations?lang=${row.code}`}
                    title={t("admin.languages.btn_view_translations")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-success-500 text-white transition-colors hover:bg-success-600"
                  >
                    <Info className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEditRow(row)}
                    disabled={busyId === row.id}
                    title={t("admin.languages.btn_edit")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary-500 text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(row)}
                    disabled={busyId === row.id || row.is_default}
                    title={t("admin.languages.btn_delete")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-error-500 text-white transition-colors hover:bg-error-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      </V2Card>

      {token && <div className="mt-6"><AiTranslatorPanel token={token} /></div>}
    </div>
  );
}
