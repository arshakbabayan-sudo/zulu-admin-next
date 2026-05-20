"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { getApiPublicOrigin } from "@/lib/api-base";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiCreatePlatformBanner,
  apiDeletePlatformBanner,
  apiPlatformBanners,
  apiUpdatePlatformBanner,
  type PlatformBannerRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  FormField,
  Input,
  PageHeader,
  StatusPill,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";

function resolveBannerImageSrc(row: PlatformBannerRow): string | null {
  const u = row.image_url;
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const origin = getApiPublicOrigin().replace(/\/$/, "");
  return u.startsWith("/") ? `${origin}${u}` : `${origin}/${u}`;
}

export default function PlatformBannersPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformBannerRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<PlatformBannerRow | null>(null);

  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createTitleEn, setCreateTitleEn] = useState("");
  const [createTitleRu, setCreateTitleRu] = useState("");
  const [createTitleHy, setCreateTitleHy] = useState("");
  const [createLink, setCreateLink] = useState("");
  const [createSort, setCreateSort] = useState("0");

  const [editFile, setEditFile] = useState<File | null>(null);
  const [editTitleEn, setEditTitleEn] = useState("");
  const [editTitleRu, setEditTitleRu] = useState("");
  const [editTitleHy, setEditTitleHy] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editSort, setEditSort] = useState("0");

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformBanners(token);
      setRows(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.banners.err_load"));
    }
  }, [token, allowed, t]);

  useEffect(() => { load(); }, [load]);

  function openEdit(row: PlatformBannerRow) {
    setEditing(row);
    setEditFile(null);
    setEditTitleEn(row.title_en ?? "");
    setEditTitleRu(row.title_ru ?? "");
    setEditTitleHy(row.title_hy ?? "");
    setEditLink(row.link_url ?? "");
    setEditSort(String(row.sort_order ?? 0));
  }

  async function submitCreate() {
    if (!token || !createFile) {
      alert(t("admin.banners.err_image_required"));
      return;
    }
    const fd = new FormData();
    fd.append("image", createFile);
    fd.append("title_en", createTitleEn);
    fd.append("title_ru", createTitleRu);
    fd.append("title_hy", createTitleHy);
    if (createLink.trim()) fd.append("link_url", createLink.trim());
    fd.append("sort_order", String(parseInt(createSort, 10) || 0));
    setBusyId(-1);
    try {
      await apiCreatePlatformBanner(token, fd);
      setCreateFile(null);
      setCreateTitleEn("");
      setCreateTitleRu("");
      setCreateTitleHy("");
      setCreateLink("");
      setCreateSort("0");
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.banners.err_create"));
    } finally {
      setBusyId(null);
    }
  }

  async function submitEdit() {
    if (!token || !editing) return;
    const fd = new FormData();
    if (editFile) fd.append("image", editFile);
    fd.append("title_en", editTitleEn);
    fd.append("title_ru", editTitleRu);
    fd.append("title_hy", editTitleHy);
    if (editLink.trim()) fd.append("link_url", editLink.trim());
    fd.append("sort_order", String(parseInt(editSort, 10) || 0));
    setBusyId(editing.id);
    try {
      await apiUpdatePlatformBanner(token, editing.id, fd);
      setEditing(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.banners.err_update"));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.banners.confirm_delete", variant: "danger" });
    if (!ok) return;
    setBusyId(id);
    try {
      await apiDeletePlatformBanner(token, id);
      if (editing?.id === id) setEditing(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.banners.err_delete"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.banners.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.banners.title_long")} subtitle={t("admin.banners.subtitle")} />

      {err && <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>}

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-fg-t8">{t("admin.banners.create_title")}</h2>
        <div className="grid max-w-xl gap-3">
          <FormField label={t("admin.banners.field_image_required")} htmlFor="b-img">
            <input
              id="b-img"
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              onChange={(e) => setCreateFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs file:mr-3 file:rounded-zulu file:border file:border-default file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-fg-t7 hover:file:bg-figma-bg-1"
            />
          </FormField>
          <FormField label={t("admin.banners.field_title_en")} htmlFor="b-ten">
            <Input id="b-ten" value={createTitleEn} onChange={(e) => setCreateTitleEn(e.target.value)} />
          </FormField>
          <FormField label={t("admin.banners.field_title_ru")} htmlFor="b-tru">
            <Input id="b-tru" value={createTitleRu} onChange={(e) => setCreateTitleRu(e.target.value)} />
          </FormField>
          <FormField label={t("admin.banners.field_title_hy")} htmlFor="b-thy">
            <Input id="b-thy" value={createTitleHy} onChange={(e) => setCreateTitleHy(e.target.value)} />
          </FormField>
          <FormField label={t("admin.banners.field_link")} htmlFor="b-link">
            <Input id="b-link" value={createLink} onChange={(e) => setCreateLink(e.target.value)} />
          </FormField>
          <FormField label={t("admin.banners.field_sort")} htmlFor="b-sort" className="max-w-[120px]">
            <Input id="b-sort" value={createSort} onChange={(e) => setCreateSort(e.target.value)} className="tabular-nums" />
          </FormField>
          <Button size="sm" disabled={busyId !== null} onClick={() => submitCreate()} className="w-fit">
            {t("admin.banners.btn_create")}
          </Button>
        </div>
      </section>

      {editing && (
        <section className="admin-card border-warning-200 bg-warning-50/30 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-fg-t8">
            {t("admin.banners.edit_title").replace("{id}", String(editing.id))}
          </h2>
          <div className="grid max-w-xl gap-3">
            <FormField label={t("admin.banners.field_new_image_optional")} htmlFor="be-img">
              <input
                id="be-img"
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs file:mr-3 file:rounded-zulu file:border file:border-default file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-fg-t7 hover:file:bg-figma-bg-1"
              />
            </FormField>
            <FormField label={t("admin.banners.field_title_en")} htmlFor="be-ten">
              <Input id="be-ten" value={editTitleEn} onChange={(e) => setEditTitleEn(e.target.value)} />
            </FormField>
            <FormField label={t("admin.banners.field_title_ru")} htmlFor="be-tru">
              <Input id="be-tru" value={editTitleRu} onChange={(e) => setEditTitleRu(e.target.value)} />
            </FormField>
            <FormField label={t("admin.banners.field_title_hy")} htmlFor="be-thy">
              <Input id="be-thy" value={editTitleHy} onChange={(e) => setEditTitleHy(e.target.value)} />
            </FormField>
            <FormField label={t("admin.banners.field_link")} htmlFor="be-link">
              <Input id="be-link" value={editLink} onChange={(e) => setEditLink(e.target.value)} />
            </FormField>
            <FormField label={t("admin.banners.field_sort")} htmlFor="be-sort" className="max-w-[120px]">
              <Input id="be-sort" value={editSort} onChange={(e) => setEditSort(e.target.value)} className="tabular-nums" />
            </FormField>
            <div className="flex gap-2">
              <Button size="sm" disabled={busyId !== null} onClick={() => submitEdit()}>
                {t("admin.banners.btn_save")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </section>
      )}

      <Table>
        <THead>
          <TR>
            <TH>{t("admin.banners.col_id")}</TH>
            <TH>{t("admin.banners.col_preview")}</TH>
            <TH>{t("admin.banners.col_titles")}</TH>
            <TH>{t("admin.banners.col_link")}</TH>
            <TH>{t("admin.banners.col_sort")}</TH>
            <TH>{t("admin.banners.col_active")}</TH>
            <TH>{t("admin.banners.col_actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={7}>{t("admin.banners.empty") || "No banners."}</TEmpty> : null}
          {rows.map((r) => {
            const src = resolveBannerImageSrc(r);
            return (
              <TR key={r.id}>
                <TD className="tabular-nums">{r.id}</TD>
                <TD>
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-14 w-28 rounded object-cover" />
                  ) : (
                    "—"
                  )}
                </TD>
                <TD className="max-w-xs text-xs text-fg-t7">
                  en: {r.title_en ?? "—"}<br />
                  ru: {r.title_ru ?? "—"}<br />
                  hy: {r.title_hy ?? "—"}
                </TD>
                <TD className="max-w-[140px] truncate text-xs">{r.link_url ?? "—"}</TD>
                <TD className="tabular-nums">{r.sort_order}</TD>
                <TD>
                  <StatusPill status={r.is_active ? "active" : "inactive"}>
                    {r.is_active ? t("admin.banners.yes") : t("admin.banners.no")}
                  </StatusPill>
                </TD>
                <TD>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => openEdit(r)}
                      className="text-left text-xs text-primary-500 underline disabled:opacity-40 hover:text-primary-700"
                    >
                      {t("admin.banners.btn_edit")}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => remove(r.id)}
                      className="text-left text-xs text-error-700 underline disabled:opacity-40 hover:text-error-800"
                    >
                      {t("admin.banners.btn_delete")}
                    </button>
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
