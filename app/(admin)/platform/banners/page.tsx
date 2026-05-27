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
  apiBulkDeleteBanners,
  apiCreatePlatformBanner,
  apiDeletePlatformBanner,
  apiPlatformBanners,
  apiReorderBanners,
  apiUpdatePlatformBanner,
  type PlatformBannerRow,
} from "@/lib/platform-admin-api";
import { exportRowsAsCsv } from "@/lib/export-csv";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  FormField,
  Input,

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
  V2Button,
  IconButton,
} from "@/components/ui/v2";
import { Download, Edit3, Plus, Trash2 } from "lucide-react";

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
  // Phase 7.8 — bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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

  // Phase 7.8 — bulk delete + reorder
  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const all = rows.map((r) => r.id);
      const allSelected = all.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(all);
    });
  }

  async function handleBulkDelete() {
    if (!token || selectedIds.size === 0) return;
    const ok = await confirm({
      message: t("admin.banners.confirm_bulk_delete").replace("{count}", String(selectedIds.size)),
      variant: "danger",
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      const res = await apiBulkDeleteBanners(token, Array.from(selectedIds));
      setSelectedIds(new Set());
      alert(
        t("admin.banners.bulk_delete_result")
          .replace("{deleted}", String(res.data.deleted_count))
          .replace("{total}", String(res.data.requested_count)),
      );
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.banners.err_delete"));
    } finally {
      setBulkBusy(false);
    }
  }

  async function moveBanner(id: number, direction: "up" | "down") {
    if (!token) return;
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= rows.length) return;
    const next = rows.slice();
    const a = next[idx];
    const b = next[swapIdx];
    if (!a || !b) return;
    next[idx] = b;
    next[swapIdx] = a;
    setRows(next); // optimistic
    try {
      await apiReorderBanners(
        token,
        next.map((r) => r.id),
      );
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.banners.err_reorder"));
      await load(); // rollback
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
    <div>
      {/* v2 admin-redesign — Banners page chrome (Settings section). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.banners.title") },
        ]}
        title={t("admin.banners.title_long")}
        subtitle={t("admin.banners.subtitle")}
        actions={
          selectedIds.size > 0 ? (
            <V2Button
              variant="danger"
              disabled={bulkBusy}
              onClick={() => void handleBulkDelete()}
            >
              {bulkBusy
                ? t("admin.banners.bulk_deleting")
                : t("admin.banners.btn_bulk_delete").replace("{count}", String(selectedIds.size))}
            </V2Button>
          ) : (
            <>
              <V2Button
                icon={<Download className="h-4 w-4" />}
                disabled={rows.length === 0}
                onClick={() =>
                  exportRowsAsCsv("banners", rows, [
                    ["id", (r) => r.id],
                    ["sort_order", (r) => r.sort_order],
                    ["is_active", (r) => (r.is_active ? "1" : "0")],
                    ["title_en", (r) => r.title_en ?? ""],
                    ["title_ru", (r) => r.title_ru ?? ""],
                    ["title_hy", (r) => r.title_hy ?? ""],
                    ["link_url", (r) => r.link_url ?? ""],
                    ["created_at", (r) => r.created_at ?? ""],
                    ["updated_at", (r) => r.updated_at ?? ""],
                  ])
                }
              >
                Export
              </V2Button>
              <V2Button variant="primary" icon={<Plus className="h-4 w-4" />}>
                New banner
              </V2Button>
            </>
          )
        }
      />

      <SectionTabs
        activeHref="/platform/banners"
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

      <div className="space-y-6">
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

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>
              <input
                type="checkbox"
                aria-label={t("admin.banners.select_all")}
                checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                onChange={toggleSelectAll}
                className="h-4 w-4 cursor-pointer"
              />
            </TH>
            <TH>{t("admin.banners.col_id")}</TH>
            <TH>{t("admin.banners.col_preview")}</TH>
            <TH>{t("admin.banners.col_titles")}</TH>
            <TH>{t("admin.banners.col_link")}</TH>
            <TH>{t("admin.banners.col_sort")}</TH>
            <TH>{t("admin.banners.col_active")}</TH>
            <TH align="right">{t("admin.banners.col_actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={8}>{t("admin.banners.empty") || "No banners."}</TEmpty> : null}
          {rows.map((r, idx) => {
            const src = resolveBannerImageSrc(r);
            return (
              <TR key={r.id}>
                <TD>
                  <input
                    type="checkbox"
                    aria-label={`Select banner #${r.id}`}
                    checked={selectedIds.has(r.id)}
                    onChange={() => toggleSelected(r.id)}
                    className="h-4 w-4 cursor-pointer"
                  />
                </TD>
                <TD className="tabular-nums font-mono text-xs text-fg-t7">
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0 || busyId !== null}
                      onClick={() => void moveBanner(r.id, "up")}
                      className="text-[10px] text-fg-t6 disabled:opacity-20 hover:text-primary"
                      aria-label={t("admin.banners.move_up")}
                    >
                      ▲
                    </button>
                    <span>#{r.id}</span>
                    <button
                      type="button"
                      disabled={idx === rows.length - 1 || busyId !== null}
                      onClick={() => void moveBanner(r.id, "down")}
                      className="text-[10px] text-fg-t6 disabled:opacity-20 hover:text-primary"
                      aria-label={t("admin.banners.move_down")}
                    >
                      ▼
                    </button>
                  </div>
                </TD>
                <TD>
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={r.title_en ?? r.title_ru ?? r.title_hy ?? `Banner ${r.id}`} className="h-14 w-28 rounded object-cover" />
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
                  <span className="inline-flex items-center gap-1.5 text-[12px]">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: r.is_active ? "var(--admin-success)" : "var(--admin-text-tertiary)" }}
                    />
                    <span className="capitalize">{r.is_active ? t("admin.banners.yes") : t("admin.banners.no")}</span>
                  </span>
                </TD>
                <TD align="right">
                  <div className="flex justify-end gap-1">
                    <IconButton
                      onClick={() => openEdit(r)}
                      aria-label={t("admin.banners.btn_edit")}
                      disabled={busyId !== null}
                    >
                      <Edit3 className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      onClick={() => void remove(r.id)}
                      aria-label={t("admin.banners.btn_delete")}
                      disabled={busyId === r.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      </V2Card>
      </div>
    </div>
  );
}
