"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { exportRowsAsCsv } from "@/lib/export-csv";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiAdminPages,
  apiCreateAdminPage,
  apiDeleteAdminPage,
  apiPatchAdminPageStatus,
  type AdminPageRow,
} from "@/lib/pages-api";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  FormField,
  Input,
  Modal,

  Pagination,
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
  V2Button,
  IconButton,
} from "@/components/ui/v2";
import { Download, Edit3, Eye, Plus, Trash2 } from "lucide-react";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function AddPageModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pageName: string, pageSlug: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [pageName, setPageName] = useState("");
  const [pageSlug, setPageSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPageName("");
      setPageSlug("");
      setSlugTouched(false);
      setErr(null);
      setSaving(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!slugTouched) setPageSlug(slugify(pageName));
  }, [pageName, slugTouched]);

  async function submit() {
    const cleanName = pageName.trim();
    const cleanSlug = pageSlug.trim();
    if (!cleanName || !cleanSlug) {
      setErr("Page name and slug are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSubmit(cleanName, cleanSlug);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Failed to create page");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("admin.pages.modal.title")}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>{t("admin.pages.modal.cancel")}</Button>
          <Button size="sm" disabled={saving} onClick={() => void submit()}>
            {saving ? t("admin.static_pages.editor.saving") : t("admin.pages.modal.create")}
          </Button>
        </>
      }
    >
      {err && <div className="mb-3 rounded-zulu border border-error-100 bg-error-50 px-3 py-2 text-sm text-error-700">{err}</div>}
      <div className="space-y-3">
        <FormField label={t("admin.pages.modal.name_label")} htmlFor="pg-name">
          <Input id="pg-name" value={pageName} onChange={(e) => setPageName(e.target.value)} placeholder="Home Page" />
        </FormField>
        <FormField label={t("admin.pages.modal.slug_label")} htmlFor="pg-slug">
          <Input
            id="pg-slug"
            value={pageSlug}
            onChange={(e) => { setSlugTouched(true); setPageSlug(slugify(e.target.value)); }}
            placeholder="home-page"
            className="font-mono"
          />
        </FormField>
      </div>
    </Modal>
  );
}

export default function AdminPagesListPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessPlatformAdminNav(user);

  const [rows, setRows] = useState<AdminPageRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const snStart = useMemo(() => {
    if (!meta) return 0;
    return (meta.current_page - 1) * meta.per_page;
  }, [meta]);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setIsLoading(true);
    try {
      const res = await apiAdminPages(token, { page });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load pages");
      setRows([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [token, allowed, page]);

  useEffect(() => { void load(); }, [load]);

  async function handleAdd(pageName: string, pageSlug: string) {
    if (!token) return;
    await apiCreateAdminPage(token, { page_name: pageName, page_slug: pageSlug });
    setPage(1);
    await load();
  }

  async function handleToggleStatus(row: AdminPageRow) {
    if (!token) return;
    setBusyId(row.id);
    try {
      await apiPatchAdminPageStatus(token, { page_id: row.id, status: row.status === 1 ? 0 : 1 });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Failed to update status");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(row: AdminPageRow) {
    if (!token) return;
    const ok = await confirm({
      message: t("admin.pages.confirm_delete").replace("{name}", row.page_name),
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(row.id);
    try {
      await apiDeleteAdminPage(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Failed to delete page");
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.pages.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <AddPageModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={handleAdd} />

      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.pages.title") },
        ]}
        title={t("admin.pages.title")}
        actions={
          <>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              disabled={rows.length === 0}
              onClick={() =>
                exportRowsAsCsv("cms-pages", rows, [
                  ["id", (r) => r.id],
                  ["page_name", (r) => r.page_name],
                  ["page_slug", (r) => r.page_slug],
                  ["meta_title", (r) => r.meta_title ?? ""],
                  ["meta_description", (r) => r.meta_description ?? ""],
                  ["meta_keywords", (r) => (r.meta_keywords ?? []).join(";")],
                  ["status", (r) => r.status],
                  ["enable_seo", (r) => (r.enable_seo ? "1" : "0")],
                  ["is_bread_crumb", (r) => (r.is_bread_crumb ? "1" : "0")],
                  ["created_at", (r) => r.created_at ?? ""],
                  ["updated_at", (r) => r.updated_at ?? ""],
                ])
              }
            >
              Export
            </V2Button>
            <V2Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}>
              {t("admin.pages.add_new")}
            </V2Button>
          </>
        }
      />

      <SectionTabs
        activeHref="/pages"
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

      <V2Card>
      <div className={`transition-opacity ${isLoading ? "pointer-events-none opacity-60" : "opacity-100"}`}>
        <Table>
          <THead>
            <TR>
              <TH>{t("admin.pages.col.sn")}</TH>
              <TH>{t("admin.pages.col.name")}</TH>
              <TH>{t("admin.pages.col.status")}</TH>
              <TH>{t("admin.pages.col.published")}</TH>
              <TH>{t("admin.pages.col.created")}</TH>
              <TH>{t("admin.pages.col.actions")}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? <TEmpty colSpan={6}>{t("admin.pages.empty")}</TEmpty> : null}
            {rows.map((row, index) => {
              const isActive = row.status === 1;
              const initials = (row.page_name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              const tone = pickAvatarTone(row.id);
              const statusColor = isActive ? "var(--admin-success)" : "var(--admin-text-tertiary)";
              return (
                <TR key={row.id}>
                  <TD className="tabular-nums font-mono text-xs text-fg-t7">#{snStart + index + 1}</TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold"
                        style={avatarStyle(tone)}
                        aria-hidden
                      >
                        {initials || "?"}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-fg-t8 truncate">{row.page_name}</div>
                        <div className="text-[11px] text-fg-t6 truncate font-mono">/{row.page_slug}</div>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 text-[12px]">
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: statusColor }}
                      />
                      <span className="capitalize">
                        {isActive ? t("admin.pages.status.active") : t("admin.pages.status.inactive")}
                      </span>
                    </span>
                  </TD>
                  <TD>
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => void handleToggleStatus(row)}
                      disabled={busyId === row.id}
                      aria-label={isActive ? "Set page inactive" : "Set page active"}
                    />
                  </TD>
                  <TD className="text-xs text-fg-t6">{formatRelativeTime(row.created_at)}</TD>
                  <TD align="right">
                    <div className="flex justify-end gap-1">
                      <IconButton as="link" href={`/pages/${row.id}/edit?mode=view`} aria-label={t("admin.pages.action.view")}>
                        <Eye className="h-4 w-4" />
                      </IconButton>
                      <IconButton as="link" href={`/pages/${row.id}/edit`} aria-label={t("admin.pages.action.edit")}>
                        <Edit3 className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        onClick={() => void handleDelete(row)}
                        aria-label={t("admin.pages.action.delete")}
                        disabled={busyId === row.id}
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
      </div>
      </V2Card>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
    </div>
  );
}

// v2 admin-redesign helpers — avatar tone + relative time.
function pickAvatarTone(id: number): "purple" | "teal" | "amber" | "blue" {
  const tones: Array<"purple" | "teal" | "amber" | "blue"> = ["purple", "teal", "amber", "blue"];
  return tones[id % tones.length]!;
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
