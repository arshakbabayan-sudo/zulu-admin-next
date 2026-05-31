"use client";

/**
 * Footer administration. Manages footer_columns + footer_links.
 * Phase-2 migration to shared @/components/ui primitives.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiAdminFooter,
  apiSyncFooter,
  type FooterColumnAdminRow,
  type FooterLinkAdminRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";
import { Button, Checkbox, FormField, Input } from "@/components/ui";
import { PageHeader as V2PageHeader, V2Button } from "@/components/ui/v2";
import { SettingsSubgroupTabs } from "@/components/settings/SettingsSubgroupTabs";

type EditLink = FooterLinkAdminRow & { _tempId?: string };
type EditCol = Omit<FooterColumnAdminRow, "links"> & { links: EditLink[]; _tempId?: string };

function tempId(): string { return `new-${Math.random().toString(36).slice(2, 9)}`; }

export default function PlatformFooterPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const allowed = canAccessPlatformAdminNav(user);
  const [columns, setColumns] = useState<EditCol[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    try {
      const res = await apiAdminFooter(token);
      setColumns(res.data.columns.map((c) => ({ ...c, links: c.links.map((l) => ({ ...l })) })));
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.commission.err_load"));
    }
  }, [token, allowed]);

  useEffect(() => { void load(); }, [load]);

  function updateColumn(idx: number, patch: Partial<EditCol>) {
    setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function updateLink(colIdx: number, linkIdx: number, patch: Partial<EditLink>) {
    setColumns((prev) =>
      prev.map((c, i) =>
        i === colIdx ? { ...c, links: c.links.map((l, j) => (j === linkIdx ? { ...l, ...patch } : l)) } : c
      )
    );
  }

  function addColumn() {
    setColumns((prev) => [
      ...prev,
      { id: 0, _tempId: tempId(), slug: "", title_en: "", title_ru: null, title_hy: null, position: prev.length + 1, is_visible: true, links: [] },
    ]);
  }

  function removeColumn(idx: number) {
    setColumns((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveColumn(idx: number, delta: -1 | 1) {
    setColumns((prev) => {
      const newIdx = idx + delta;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx]!;
      copy[idx] = copy[newIdx]!;
      copy[newIdx] = tmp;
      return copy.map((c, i) => ({ ...c, position: i + 1 }));
    });
  }

  function addLink(colIdx: number) {
    setColumns((prev) =>
      prev.map((c, i) =>
        i === colIdx
          ? {
              ...c,
              links: [...c.links, {
                id: 0, _tempId: tempId(), column_id: c.id, label_en: "", label_ru: null, label_hy: null,
                url: "/", position: c.links.length + 1, is_visible: true, open_in_new_tab: false,
              }],
            }
          : c
      )
    );
  }

  function removeLink(colIdx: number, linkIdx: number) {
    setColumns((prev) =>
      prev.map((c, i) => (i === colIdx ? { ...c, links: c.links.filter((_, j) => j !== linkIdx) } : c))
    );
  }

  function moveLink(colIdx: number, linkIdx: number, delta: -1 | 1) {
    setColumns((prev) =>
      prev.map((c, i) => {
        if (i !== colIdx) return c;
        const newIdx = linkIdx + delta;
        if (newIdx < 0 || newIdx >= c.links.length) return c;
        const copy = [...c.links];
        const tmp = copy[linkIdx]!;
        copy[linkIdx] = copy[newIdx]!;
        copy[newIdx] = tmp;
        return { ...c, links: copy.map((l, k) => ({ ...l, position: k + 1 })) };
      })
    );
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setErr(null);
    try {
      const payload = columns.map((c) => ({
        id: c.id && c.id > 0 ? c.id : null,
        slug: c.slug || null,
        title_en: c.title_en,
        title_ru: c.title_ru,
        title_hy: c.title_hy,
        position: c.position,
        is_visible: c.is_visible,
        links: c.links.map((l) => ({
          id: l.id && l.id > 0 ? l.id : null,
          label_en: l.label_en,
          label_ru: l.label_ru,
          label_hy: l.label_hy,
          url: l.url,
          position: l.position,
          is_visible: l.is_visible,
          open_in_new_tab: l.open_in_new_tab,
        })),
      }));
      const res = await apiSyncFooter(token, payload);
      setColumns(res.data.columns.map((c) => ({ ...c, links: c.links.map((l) => ({ ...l })) })));
      setSavedAt(Date.now());
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : t("admin.commission.err_save"));
    } finally {
      setSaving(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.footer.title_short")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
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
          { label: t("admin.footer.title") || "Footer" },
        ]}
        title={t("admin.footer.title")}
        actions={
          <>
            <V2Button onClick={addColumn}>{t("admin.footer.add_column")}</V2Button>
            <V2Button variant="primary" disabled={saving} onClick={() => void handleSave()}>
              {saving ? t("admin.crud.common.saving") : t("admin.header_menu.save_all")}
            </V2Button>
          </>
        }
      />
      <SettingsSubgroupTabs activeHref="/platform/settings/footer" />
      <div className="max-w-5xl space-y-6 mt-6">

      {err && <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}
      {savedAt && <div className="rounded-zulu border border-success-100 bg-success-50 px-4 py-2 text-sm text-success-700">{t("admin.brand.saved")}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {columns.map((col, colIdx) => (
          <div key={col.id || col._tempId} className="admin-card p-3">
            <div className="grid gap-2 md:grid-cols-3">
              <FormField label={t("admin.footer.title_en")} htmlFor={`fc-ten-${colIdx}`}>
                <Input id={`fc-ten-${colIdx}`} value={col.title_en} onChange={(e) => updateColumn(colIdx, { title_en: e.target.value })} />
              </FormField>
              <FormField label={t("admin.footer.title_ru")} htmlFor={`fc-tru-${colIdx}`}>
                <Input id={`fc-tru-${colIdx}`} value={col.title_ru ?? ""} onChange={(e) => updateColumn(colIdx, { title_ru: e.target.value === "" ? null : e.target.value })} />
              </FormField>
              <FormField label={t("admin.footer.title_hy")} htmlFor={`fc-thy-${colIdx}`}>
                <Input id={`fc-thy-${colIdx}`} value={col.title_hy ?? ""} onChange={(e) => updateColumn(colIdx, { title_hy: e.target.value === "" ? null : e.target.value })} />
              </FormField>
              <FormField label={t("admin.footer.slug_optional")} htmlFor={`fc-slug-${colIdx}`}>
                <Input id={`fc-slug-${colIdx}`} value={col.slug ?? ""} onChange={(e) => updateColumn(colIdx, { slug: e.target.value })} className="font-mono" />
              </FormField>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              <Checkbox
                checked={col.is_visible}
                onChange={(e) => updateColumn(colIdx, { is_visible: e.target.checked })}
                label={t("admin.header_menu.visible")}
              />
              <div className="flex items-center gap-1">
                <button type="button" disabled={colIdx === 0} onClick={() => moveColumn(colIdx, -1)} className="rounded-zulu border border-default px-2 py-1 text-xs disabled:opacity-30 hover:bg-figma-bg-1">↑ {t("admin.footer.col_short")}</button>
                <button type="button" disabled={colIdx === columns.length - 1} onClick={() => moveColumn(colIdx, 1)} className="rounded-zulu border border-default px-2 py-1 text-xs disabled:opacity-30 hover:bg-figma-bg-1">↓ {t("admin.footer.col_short")}</button>
                <button type="button" onClick={() => removeColumn(colIdx)} className="rounded-zulu border border-error-200 bg-error-50 px-2 py-1 text-xs text-error-700 hover:bg-error-100">{t("admin.footer.remove_column")}</button>
              </div>
            </div>

            <div className="mt-3 border-t border-default pt-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold text-fg-t7">{t("admin.footer.links")}</p>
                <button type="button" onClick={() => addLink(colIdx)} className="text-xs text-primary-500 underline hover:text-primary-700">
                  {t("admin.footer.add_link")}
                </button>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {col.links.map((link, linkIdx) => (
                  <div key={link.id || link._tempId} className="rounded-zulu border border-default bg-figma-bg-1 p-2">
                    <div className="grid gap-2 md:grid-cols-3">
                      <FormField label={t("admin.header_menu.label_en")} htmlFor={`fl-len-${colIdx}-${linkIdx}`}>
                        <Input id={`fl-len-${colIdx}-${linkIdx}`} value={link.label_en} onChange={(e) => updateLink(colIdx, linkIdx, { label_en: e.target.value })} />
                      </FormField>
                      <FormField label={t("admin.header_menu.label_ru")} htmlFor={`fl-lru-${colIdx}-${linkIdx}`}>
                        <Input id={`fl-lru-${colIdx}-${linkIdx}`} value={link.label_ru ?? ""} onChange={(e) => updateLink(colIdx, linkIdx, { label_ru: e.target.value === "" ? null : e.target.value })} />
                      </FormField>
                      <FormField label={t("admin.header_menu.label_hy")} htmlFor={`fl-lhy-${colIdx}-${linkIdx}`}>
                        <Input id={`fl-lhy-${colIdx}-${linkIdx}`} value={link.label_hy ?? ""} onChange={(e) => updateLink(colIdx, linkIdx, { label_hy: e.target.value === "" ? null : e.target.value })} />
                      </FormField>
                      <FormField label="URL" htmlFor={`fl-url-${colIdx}-${linkIdx}`} className="md:col-span-2">
                        <Input id={`fl-url-${colIdx}-${linkIdx}`} value={link.url} onChange={(e) => updateLink(colIdx, linkIdx, { url: e.target.value })} className="font-mono" />
                      </FormField>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Checkbox
                          checked={link.is_visible}
                          onChange={(e) => updateLink(colIdx, linkIdx, { is_visible: e.target.checked })}
                          label={t("admin.header_menu.visible")}
                        />
                        <Checkbox
                          checked={link.open_in_new_tab}
                          onChange={(e) => updateLink(colIdx, linkIdx, { open_in_new_tab: e.target.checked })}
                          label={t("admin.header_menu.new_tab")}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" disabled={linkIdx === 0} onClick={() => moveLink(colIdx, linkIdx, -1)} className="rounded-zulu border border-default px-2 py-1 text-xs disabled:opacity-30 hover:bg-white">↑</button>
                        <button type="button" disabled={linkIdx === col.links.length - 1} onClick={() => moveLink(colIdx, linkIdx, 1)} className="rounded-zulu border border-default px-2 py-1 text-xs disabled:opacity-30 hover:bg-white">↓</button>
                        <button type="button" onClick={() => removeLink(colIdx, linkIdx)} className="rounded-zulu border border-error-200 bg-error-50 px-2 py-1 text-xs text-error-700 hover:bg-error-100">{t("admin.commission.btn_remove")}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-default bg-white py-3 -mx-4 px-4">
        <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
          {saving ? t("admin.crud.common.saving") : t("admin.header_menu.save_all")}
        </Button>
      </div>
      </div>
    </div>
  );
}
