"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePrompt } from "@/contexts/PromptDialogContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiModerateReview, apiPlatformReviews, type PlatformReviewRow } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";
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
} from "@/components/ui/v2";
import { Download, Star } from "lucide-react";

const MOD_STATUSES = ["published", "hidden", "rejected"] as const;

export default function PlatformReviewsPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
  const prompt = usePrompt();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformReviewRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformReviews(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.reviews.err_load"));
    }
  }, [token, allowed, page, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function moderate(id: number, status: (typeof MOD_STATUSES)[number]) {
    if (!token) return;
    const notes = await prompt({
      title: t("admin.reviews.moderate_title"),
      placeholder: t("admin.reviews.prompt_notes"),
      variant: status === "rejected" ? "danger" : "default",
    });
    if (notes === null) return;
    setBusyId(id);
    try {
      await apiModerateReview(token, id, {
        status,
        notes: notes.trim() || null,
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.reviews.err_moderation"));
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.reviews.title_short")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* v2 admin-redesign — Reviews page chrome (Settings sibling, standalone). */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings", href: "/settings/pricing-rules" },
          { label: t("admin.reviews.title") },
        ]}
        title={t("admin.reviews.title")}
        actions={
          <V2Button icon={<Download className="h-4 w-4" />}>Export</V2Button>
        }
      />

      <FilterCard>
        <FilterField label={t("admin.reviews.filter_status")} minWidth={220}>
          <Select
            id="r-status"
            fieldSize="sm"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="!h-[34px]"
          >
            <option value="">{t("common.all")}</option>
            <option value="pending">{t("admin.approvals.status_pending")}</option>
            <option value="published">{t("admin.reviews.status_published")}</option>
            <option value="hidden">{t("admin.reviews.status_hidden")}</option>
            <option value="rejected">{t("admin.approvals.status_rejected")}</option>
          </Select>
        </FilterField>
      </FilterCard>

      {err ? (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      ) : null}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.invoices.col_id")}</TH>
            <TH>{t("admin.reviews.col_rating")}</TH>
            <TH>{t("admin.reviews.col_text")}</TH>
            <TH>{t("admin.invoices.col_status")}</TH>
            <TH>{t("admin.reviews.col_target")}</TH>
            <TH>{t("admin.reviews.col_user")}</TH>
            <TH>{t("admin.reviews.col_moderate")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={7}>{t("admin.reviews.empty") || "No reviews."}</TEmpty>
          ) : null}
          {rows.map((r) => {
            const userName = r.user?.name ?? "—";
            const initials = (userName !== "—" ? userName : "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            const tone = pickAvatarTone(r.id);
            const statusColor =
              r.status === "published"
                ? "var(--admin-success)"
                : r.status === "pending"
                  ? "var(--admin-warning)"
                  : r.status === "rejected"
                    ? "var(--admin-danger)"
                    : "var(--admin-text-tertiary)";
            return (
            <TR key={r.id}>
              <TD className="tabular-nums font-mono text-xs text-fg-t7">#{r.id}</TD>
              <TD>
                <div className="inline-flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5"
                      style={{
                        fill: i < (r.rating ?? 0) ? "var(--admin-warning)" : "transparent",
                        color: i < (r.rating ?? 0) ? "var(--admin-warning)" : "var(--admin-border)",
                      }}
                      aria-hidden
                    />
                  ))}
                  <span className="ml-1 tabular-nums text-xs text-fg-t7">{r.rating}</span>
                </div>
              </TD>
              <TD className="max-w-xs text-xs text-fg-t7">
                {(r.review_text ?? "").slice(0, 200)}
                {(r.review_text?.length ?? 0) > 200 ? "…" : ""}
              </TD>
              <TD>
                <span className="inline-flex items-center gap-1.5 text-[12px]">
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: statusColor }}
                  />
                  <span className="capitalize">{r.status}</span>
                </span>
              </TD>
              <TD>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={{
                    backgroundColor: "var(--admin-bg-tertiary)",
                    color: "var(--admin-text-secondary)",
                  }}
                >
                  {r.target_entity_type} #{r.target_entity_id}
                </span>
              </TD>
              <TD>
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                    style={avatarStyle(tone)}
                    aria-hidden
                  >
                    {initials || "?"}
                  </span>
                  <div className="font-medium text-fg-t8 truncate text-xs">{userName}</div>
                </div>
              </TD>
              <TD>
                <div className="flex flex-col gap-1">
                  {MOD_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => moderate(r.id, s)}
                      className="text-left text-xs text-primary-500 underline disabled:opacity-40 hover:text-primary-700"
                    >
                      {t("admin.reviews.btn_set").replace("{status}", s)}
                    </button>
                  ))}
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

// v2 admin-redesign helpers — avatar tone.
function pickAvatarTone(id: number | string): "purple" | "teal" | "amber" | "blue" {
  const tones: Array<"purple" | "teal" | "amber" | "blue"> = ["purple", "teal", "amber", "blue"];
  const n = typeof id === "number" ? id : id.length;
  return tones[Math.abs(n) % tones.length]!;
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
