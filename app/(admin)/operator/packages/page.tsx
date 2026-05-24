"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ContentLanguagePill } from "@/components/ContentLanguagePill";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { MainImageDescriptionFields } from "@/components/MainImageDescriptionFields";
import { LatLngFields } from "@/components/LatLngFields";
import { OfferStatusBadge, isSubmittableStatus } from "@/components/OfferStatusBadge";
import { PaginationBar } from "@/components/PaginationBar";
import { TranslationTabs } from "@/components/TranslationTabs";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { ApiRequestError } from "@/lib/api-client";
import { apiSubmitOfferForReview } from "@/lib/platform-admin-api";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiPackages,
  apiCreatePackage,
  apiUpdatePackage,
  apiDeletePackage,
  apiActivatePackage,
  apiDeactivatePackage,
  type PackageRow,
  type PackagePayload,
} from "@/lib/inventory-crud-api";
import {
  Button,
  Checkbox,
  FormField,
  Input,
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
  IconButton,
} from "@/components/ui/v2";
import { Download, Plus, Edit3, Trash2, Power, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const PACKAGE_TYPES = ["flight", "hotel", "transfer", "multi_service", "custom"];
const STATUSES = ["", "draft", "active", "inactive", "archived"];

export default function OperatorPackagesPage() {
  const { token } = useAdminAuth();
  const { t, contentLang } = useLanguage();
  const confirm = useConfirm();
  const [rows, setRows] = useState<PackageRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<PackagePayload | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPackages(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.crud.common.failed"));
    }
  }, [token, page, statusFilter, contentLang]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditId(null);
    setForm({
      package_title: "",
      package_subtitle: "",
      package_type: "multi_service",
      destination_city: "",
      destination_country: "",
      destination_location_id: null,
      duration_days: undefined,
      min_nights: null,
      adults_count: 2,
      children_count: 0,
      base_price: null,
      currency: "USD",
      main_image: "",
      short_description: "",
      is_featured: false,
      latitude: null,
      longitude: null,
    } as PackagePayload);
    setFormErr(null);
  }

  function openEdit(r: PackageRow) {
    setEditId(r.id);
    setForm({
      package_title: r.package_title ?? "",
      package_subtitle: r.package_subtitle ?? "",
      package_type: r.package_type ?? "multi_service",
      destination_city: r.destination_city ?? "",
      destination_country: r.destination_country ?? "",
      destination_location_id:
        (r as { destination_location_id?: number | null }).destination_location_id ?? null,
      duration_days: r.duration_days ?? undefined,
      min_nights: r.min_nights ?? null,
      adults_count: r.adults_count ?? 2,
      children_count: r.children_count ?? 0,
      base_price: r.base_price != null ? Number(r.base_price) : null,
      currency: r.currency ?? "USD",
      main_image: r.main_image ?? "",
      short_description: r.short_description ?? "",
      is_featured: r.is_featured ?? false,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
    } as PackagePayload);
    setFormErr(null);
  }

  function closeForm() {
    setForm(null);
    setEditId(null);
    setFormErr(null);
  }

  async function handleSubmit() {
    if (!token || !form) return;
    setBusy(true);
    setFormErr(null);
    try {
      if (editId != null) await apiUpdatePackage(token, editId, form);
      else await apiCreatePackage(token, form);
      closeForm();
      await load();
    } catch (e) {
      setFormErr(e instanceof ApiRequestError ? e.message : t("admin.crud.common.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.crud.packages.delete_confirm", variant: "danger" });
    if (!ok) return;
    setBusyId(id);
    try {
      await apiDeletePackage(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggle(r: PackageRow) {
    if (!token) return;
    const messageKey =
      r.status === "active"
        ? "admin.crud.packages.deactivate_confirm"
        : "admin.crud.packages.activate_confirm";
    const ok = await confirm({ messageKey, variant: r.status === "active" ? "danger" : undefined });
    if (!ok) return;
    setBusyId(r.id);
    try {
      if (r.status === "active") await apiDeactivatePackage(token, r.id);
      else await apiActivatePackage(token, r.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSubmitForReview(offerId: number) {
    if (!token) return;
    const ok = await confirm({
      message: "Submit this package for super-admin review? Once submitted, you cannot edit it until it's approved or rejected.",
    });
    if (!ok) return;
    setBusyId(offerId);
    try {
      await apiSubmitOfferForReview(token, offerId);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Submit failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.crud.packages.title")}</h1>
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
          { label: t("admin.crud.packages.title") },
        ]}
        title={
          <span className="inline-flex items-center gap-3">
            {t("admin.crud.packages.title")}
            {form === null && <ContentLanguagePill />}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <V2Button variant="default" size="sm" icon={<Download className="h-4 w-4" />}>
              Export
            </V2Button>
            <V2Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              {t("admin.crud.packages.new_btn")}
            </V2Button>
          </div>
        }
      />

      <SectionTabs
        activeHref="/operator/packages"
        items={[
          { href: "/operator/hotels", label: "Hotels" },
          { href: "/operator/flights", label: "Flights" },
          { href: "/operator/transfers", label: "Transfers" },
          { href: "/operator/cars", label: "Cars" },
          { href: "/operator/excursions", label: "Excursions" },
          { href: "/operator/visas", label: "Visas" },
          { href: "/operator/packages", label: "Packages", count: meta?.total },
          { href: "/operator/offers", label: "Offers" },
        ]}
      />

      <FilterCard>
        <FilterField label={t("admin.crud.packages.filter.status")} minWidth={180}>
          <Select
            id="pkg-status"
            fieldSize="sm"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="!h-[34px]"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s || t("admin.crud.common.all")}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterCard>

      {err && (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      {form && (
        <section className="admin-card p-4">
          <h2 className="mb-3 text-base font-semibold">
            {editId ? t("admin.crud.packages.form_edit") : t("admin.crud.packages.form_new")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("admin.crud.packages.field.title")} htmlFor="pkg-title">
              <Input
                id="pkg-title"
                value={form.package_title ?? ""}
                onChange={(e) =>
                  setForm((p) => (p ? { ...p, package_title: e.target.value } : p))
                }
              />
            </FormField>
            <FormField
              label={t("admin.crud.packages.field.subtitle")}
              htmlFor="pkg-subtitle"
              className="sm:col-span-2"
            >
              <Input
                id="pkg-subtitle"
                value={form.package_subtitle ?? ""}
                onChange={(e) =>
                  setForm((p) => (p ? { ...p, package_subtitle: e.target.value } : p))
                }
                placeholder={t("admin.crud.packages.field.subtitle_placeholder")}
              />
            </FormField>
            <FormField label={t("admin.crud.packages.field.type")} htmlFor="pkg-type">
              <Select
                id="pkg-type"
                fieldSize="sm"
                value={form.package_type ?? ""}
                onChange={(e) =>
                  setForm((p) => (p ? { ...p, package_type: e.target.value } : p))
                }
              >
                {PACKAGE_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </Select>
            </FormField>
            <LocationCascadeSelect
              token={token}
              value={
                (form as { destination_location_id?: number | null })
                  .destination_location_id ?? null
              }
              label={t("admin.crud.packages.field.destination_location")}
              onChange={(locationId, meta) =>
                setForm((p) =>
                  p
                    ? ({
                        ...p,
                        destination_location_id: locationId ?? null,
                        destination_country: meta.country?.name ?? p.destination_country,
                        destination_city:
                          meta.city?.name ?? meta.region?.name ?? p.destination_city,
                      } as PackagePayload)
                    : p
                )
              }
            />
            <FormField label={t("admin.crud.packages.field.base_price")} htmlFor="pkg-price">
              <Input
                id="pkg-price"
                type="number"
                step="0.01"
                min="0"
                value={form.base_price ?? ""}
                onChange={(e) =>
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          base_price:
                            e.target.value === "" ? null : Number(e.target.value),
                        }
                      : p
                  )
                }
                placeholder="e.g. 580.00"
              />
            </FormField>
            <FormField label={t("admin.crud.packages.field.currency")} htmlFor="pkg-curr">
              <Input
                id="pkg-curr"
                value={(form["currency"] as string) ?? ""}
                onChange={(e) =>
                  setForm((p) => (p ? { ...p, currency: e.target.value } : p))
                }
              />
            </FormField>
            <FormField label={t("admin.crud.packages.field.duration")} htmlFor="pkg-dur">
              <Input
                id="pkg-dur"
                type="number"
                min="1"
                value={form.duration_days ?? ""}
                onChange={(e) =>
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          duration_days: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        }
                      : p
                  )
                }
              />
            </FormField>
            <FormField label={t("admin.crud.packages.field.min_nights")} htmlFor="pkg-mn">
              <Input
                id="pkg-mn"
                type="number"
                min="0"
                value={form.min_nights ?? ""}
                onChange={(e) =>
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          min_nights:
                            e.target.value === "" ? null : Number(e.target.value),
                        }
                      : p
                  )
                }
                placeholder={t("admin.crud.packages.field.min_nights_placeholder")}
              />
            </FormField>
            <FormField label={t("admin.crud.packages.field.adults")} htmlFor="pkg-ad">
              <Input
                id="pkg-ad"
                type="number"
                min="1"
                value={form.adults_count ?? ""}
                onChange={(e) =>
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          adults_count:
                            e.target.value === "" ? null : Number(e.target.value),
                        }
                      : p
                  )
                }
              />
            </FormField>
            <FormField label={t("admin.crud.packages.field.children")} htmlFor="pkg-ch">
              <Input
                id="pkg-ch"
                type="number"
                min="0"
                value={form.children_count ?? ""}
                onChange={(e) =>
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          children_count:
                            e.target.value === "" ? null : Number(e.target.value),
                        }
                      : p
                  )
                }
              />
            </FormField>
            <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox
                checked={!!form.is_featured}
                onChange={(e) =>
                  setForm((p) => (p ? { ...p, is_featured: e.target.checked } : p))
                }
              />
              <span className="font-medium text-fg-t7">
                Featured (surfaces this package on the homepage carousel)
              </span>
            </label>
            <MainImageDescriptionFields
              mainImage={(form.main_image as string | null | undefined) ?? ""}
              shortDescription={(form.short_description as string | null | undefined) ?? ""}
              onMainImageChange={(v) =>
                setForm((p) => (p ? { ...p, main_image: v } : p))
              }
              onShortDescriptionChange={(v) =>
                setForm((p) => (p ? { ...p, short_description: v } : p))
              }
              section="packages"
              altText={t("admin.crud.packages.main_image_alt")}
            />
            <LatLngFields
              latitude={form.latitude != null ? String(form.latitude) : ""}
              longitude={form.longitude != null ? String(form.longitude) : ""}
              onLatitudeChange={(v) =>
                setForm((p) =>
                  p ? { ...p, latitude: v.trim() === "" ? null : Number(v) } : p
                )
              }
              onLongitudeChange={(v) =>
                setForm((p) =>
                  p ? { ...p, longitude: v.trim() === "" ? null : Number(v) } : p
                )
              }
            />
          </div>
          {formErr && <p className="mt-2 text-sm text-error-600">{formErr}</p>}
          {editId !== null && (
            <div className="mt-6 rounded-zulu border border-default bg-figma-bg-1 p-3">
              <h3 className="mb-2 text-sm font-medium text-fg-t6">
                Translations{" "}
                <span className="text-fg-t7 font-normal">(EN-ից բացի՝ RU / HY)</span>
              </h3>
              <TranslationTabs
                entityType="package"
                entityId={editId}
                fields={[
                  { name: "package_title", label: t("admin.crud.packages.field.package_title") },
                  { name: "package_subtitle", label: t("admin.crud.packages.field.subtitle") },
                  { name: "short_description", label: t("admin.crud.packages.field.short_description"), multiline: true },
                ]}
              />
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void handleSubmit()}>
              {busy ? t("admin.crud.common.saving") : t("common.save")}
            </Button>
            <Button variant="outline" size="sm" onClick={closeForm}>
              {t("common.cancel")}
            </Button>
          </div>
        </section>
      )}

      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.crud.common.id")}</TH>
            <TH>{t("admin.crud.packages.col.title")}</TH>
            <TH>{t("admin.crud.packages.col.type")}</TH>
            <TH>{t("admin.crud.packages.col.destination")}</TH>
            <TH>{t("admin.crud.packages.col.days")}</TH>
            <TH>Review status</TH>
            <TH>{t("admin.crud.packages.col.company")}</TH>
            <TH>{t("admin.crud.common.actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={8}>{t("admin.crud.packages.empty")}</TEmpty>
          ) : null}
          {rows.map((r) => {
            const tone = pickAvatarTone(r.id);
            const initials = getInitials(r.package_title ?? "?");
            const destination = [r.destination_city, r.destination_country].filter(Boolean).join(", ");
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
                    <div className="font-medium text-fg-t8 truncate max-w-[180px]">{r.package_title ?? "—"}</div>
                    {destination ? (
                      <div className="text-[11px] text-fg-t6 truncate max-w-[180px]">{destination}</div>
                    ) : null}
                  </div>
                </div>
              </TD>
              <TD>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                >
                  {r.package_type ?? "—"}
                </span>
              </TD>
              <TD>
                {r.destination_country ? (
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                    style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                  >
                    {r.destination_country}
                  </span>
                ) : (
                  <span className="text-xs text-fg-t6">—</span>
                )}
              </TD>
              <TD className="tabular-nums text-xs">{r.duration_days ?? "—"}</TD>
              <TD>
                <OfferStatusBadge status={r.offer?.status ?? null} />
              </TD>
              <TD className="text-xs text-fg-t6">{r.company?.name ?? r.company_id ?? "—"}</TD>
              <TD align="right">
                <div className="flex justify-end items-center gap-1">
                  {r.offer?.id && isSubmittableStatus(r.offer.status) && (
                    <IconButton
                      onClick={() => void handleSubmitForReview(r.offer!.id!)}
                      disabled={busyId === r.offer.id}
                      aria-label="Submit for review"
                    >
                      <Send />
                    </IconButton>
                  )}
                  <IconButton
                    onClick={() => void handleToggle(r)}
                    disabled={busyId === r.id}
                    aria-label={r.status === "active" ? t("admin.crud.common.deactivate") : t("admin.crud.common.activate")}
                  >
                    <Power />
                  </IconButton>
                  <IconButton onClick={() => openEdit(r)} aria-label={t("admin.crud.common.edit")}>
                    <Edit3 />
                  </IconButton>
                  <IconButton
                    onClick={() => void handleDelete(r.id)}
                    disabled={busyId === r.id}
                    aria-label={t("admin.crud.common.delete")}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              </TD>
            </TR>
            );
          })}
        </TBody>
      </Table>
      </V2Card>

      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}

// v2 admin-redesign helpers — avatar tone, initials.
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
