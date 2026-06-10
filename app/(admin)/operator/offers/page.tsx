"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ContentLanguagePill } from "@/components/ContentLanguagePill";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { TranslationsModal } from "@/components/TranslationsModal";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { canAccessOperatorToolsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { exportRowsAsCsv } from "@/lib/export-csv";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiOffers, apiPublishOffer, apiArchiveOffer, type OfferRow } from "@/lib/inventory-crud-api";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {

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
import { InventorySectionTabs } from "@/components/inventory/InventorySectionTabs";
import { Download, Languages } from "lucide-react";

const STATUSES = ["", "draft", "published", "archived"];

export default function OperatorOffersPage() {
  const { token, user } = useAdminAuth();
  const { t, contentLang } = useLanguage();
  const confirm = useConfirm();
  const allowed = canAccessOperatorToolsNav(user);
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [translateRow, setTranslateRow] = useState<OfferRow | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiOffers(token, { page, per_page: 20, status: statusFilter || undefined });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, allowed, page, statusFilter, contentLang]);

  useEffect(() => { load(); }, [load]);

  async function handlePublish(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.crud.offers.publish_confirm" });
    if (!ok) return;
    setBusyId(id);
    try { await apiPublishOffer(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  async function handleArchive(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.crud.offers.archive_confirm", variant: "danger" });
    if (!ok) return;
    setBusyId(id);
    try { await apiArchiveOffer(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.crud.offers.title")}</h1>
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
          { label: "Inventory", href: "/operator/hotels" },
          { label: t("admin.crud.offers.title") },
        ]}
        title={
          <span className="flex items-center gap-3">
            {t("admin.crud.offers.title")}
            <ContentLanguagePill />
          </span>
        }
        actions={
          <V2Button
            variant="default"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            disabled={rows.length === 0}
            onClick={() =>
              exportRowsAsCsv("offers", rows, [
                ["id", (r) => r.id],
                ["title", (r) => r.title],
                ["type", (r) => r.type],
                ["price", (r) => r.price ?? ""],
                ["currency", (r) => r.currency ?? ""],
                ["status", (r) => r.status],
                ["company_id", (r) => r.company_id ?? ""],
                ["company_name", (r) => r.company?.name ?? ""],
                ["created_at", (r) => r.created_at ?? ""],
                ["updated_at", (r) => r.updated_at ?? ""],
              ])
            }
          >
            Export
          </V2Button>
        }
      />

      <InventorySectionTabs activeHref="/operator/offers" activeCount={meta?.total} />

      <FilterCard>
        <FilterField label={t("admin.crud.offers.filter.status")} minWidth={180}>
          <Select
            id="off-status"
            fieldSize="sm"
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="!h-[34px]"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s || t("admin.crud.common.all")}</option>)}
          </Select>
        </FilterField>
        <V2Button variant="default" size="sm" onClick={load}>{t("admin.crud.common.refresh")}</V2Button>
      </FilterCard>

      {err && (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      )}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.crud.common.id")}</TH>
            <TH>{t("admin.crud.offers.col.title")}</TH>
            <TH>{t("admin.crud.offers.col.type")}</TH>
            <TH>{t("admin.crud.offers.col.price")}</TH>
            <TH>{t("admin.crud.common.status")}</TH>
            <TH>{t("admin.crud.offers.col.company")}</TH>
            <TH>{t("admin.crud.common.actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? <TEmpty colSpan={7}>{t("admin.crud.offers.empty")}</TEmpty> : null}
          {rows.map((r) => {
            const tone = pickAvatarTone(r.id);
            const initials = getInitials(r.title ?? "?");
            return (
            <TR key={r.id}>
              <TD className="tabular-nums font-mono text-xs text-fg-t7">#{r.id}</TD>
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
                    <div className="font-medium text-fg-t8 truncate">{r.title ?? "—"}</div>
                    {r.company?.name ? (
                      <div className="text-[11px] text-fg-t6 truncate">{r.company.name}</div>
                    ) : null}
                  </div>
                </div>
              </TD>
              <TD>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                >
                  {r.type ?? "—"}
                </span>
              </TD>
              <TD className="tabular-nums text-xs">
                {r.price != null ? `${r.currency ?? ""} ${Number(r.price).toFixed(2)}` : "—"}
              </TD>
              <TD>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={statusBadgeStyle(r.status ?? "")}
                >
                  {r.status ?? "—"}
                </span>
              </TD>
              <TD className="text-xs text-fg-t6">{r.company?.name ?? r.company_id ?? "—"}</TD>
              <TD align="right">
                <div className="flex justify-end items-center gap-1">
                  {r.status === "draft" && (
                    <V2Button
                      size="sm"
                      variant="default"
                      disabled={busyId === r.id}
                      onClick={() => void handlePublish(r.id)}
                    >
                      {t("admin.crud.common.publish")}
                    </V2Button>
                  )}
                  {r.status === "published" && (
                    <V2Button
                      size="sm"
                      variant="default"
                      disabled={busyId === r.id}
                      onClick={() => void handleArchive(r.id)}
                    >
                      {t("admin.crud.common.archive")}
                    </V2Button>
                  )}
                  <IconButton onClick={() => setTranslateRow(r)} aria-label="Translations">
                    <Languages className="h-4 w-4" />
                  </IconButton>
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

      <TranslationsModal
        open={translateRow !== null}
        onClose={() => setTranslateRow(null)}
        entityType="offer"
        entityId={translateRow?.id ?? null}
        entityLabel={translateRow?.title ?? undefined}
        fields={[
          { name: "title", label: "Title" },
          { name: "subtitle", label: "Subtitle" },
          { name: "description", label: "Description", multiline: true },
        ]}
      />
    </div>
  );
}

// v2 admin-redesign helpers — avatar tone, status badge, initials.
function getInitials(name: string): string {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
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

function statusBadgeStyle(status: string): React.CSSProperties {
  switch (status) {
    case "published":
    case "active":
      return { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" };
    case "draft":
    case "pending":
      return { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" };
    case "archived":
    case "expired":
    case "rejected":
      return { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" };
    default:
      return { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" };
  }
}
