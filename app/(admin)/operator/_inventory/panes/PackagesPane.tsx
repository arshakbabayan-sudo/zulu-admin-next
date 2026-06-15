"use client";

/**
 * Packages pane — 1:1 port of #pane-packages in inventory.html.
 *
 * One package per type=package offer (offer_id create-only). In-pane card form:
 * basic info · destination · pricing (incl. display_price_mode) · details ·
 * visibility · marketing · location · custom fields. Activate/Deactivate toggle.
 * ⚠ main_image / short_description / lat/lng / destination_location_id /
 * is_featured persist on write but are NOT returned by PackageResource (won't
 * round-trip on reload) — flagged inline, matching INTEGRATION.md §6.
 */

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiPackages,
  apiCreatePackage,
  apiUpdatePackage,
  apiDeletePackage,
  apiActivatePackage,
  apiDeactivatePackage,
  apiCustomFieldValues,
  type PackageRow,
  type PackagePayload,
} from "@/lib/inventory-crud-api";
import { apiSubmitOfferForReview } from "@/lib/platform-admin-api";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { ImageUploadField } from "@/components/ImageUploadField";
import { CustomFieldsRenderer } from "@/components/CustomFieldsRenderer";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { userHasPermission } from "@/lib/access";
import { inventoryStrings } from "../inventory-i18n";
import type { InventoryPaneProps } from "../types";

const PACKAGE_TYPES = ["multi_service", "flight", "hotel", "transfer", "custom"];
const DISPLAY_PRICE_MODES = ["total", "per_person", "from_price"];

function lab(lang: string): Record<string, string> {
  const en: Record<string, string> = {
    secBasic: "Basic info", secDest: "Destination", secPricing: "Pricing", secDetails: "Details", secVisibility: "Visibility", secMarketing: "Marketing", secLocation: "Location", secCustom: "Custom fields",
    title: "Title", subtitle: "Subtitle", type: "Type", typeHint: "model constants fixed / dynamic / semi_fixed (authoritative)", offerId: "Offer ID", offerIdHint: "Requires pre-existing type=package offer · create-only",
    destLocation: "Destination location", destHint: "persisted but not returned by API", basePrice: "Base price", currency: "Currency", displayPriceMode: "Display price mode",
    durationDays: "Duration (days)", minNights: "Minimum nights", adultsCount: "Adults count", childrenCount: "Children count",
    featured: "Featured", featuredHint: "is_featured · persisted but not returned by API", mainImage: "Main image", shortDesc: "Short description", apiGapHint: "persisted but not returned by API", latitude: "Latitude", longitude: "Longitude",
    colTitle: "Title", colType: "Type", colDest: "Destination", colDuration: "Duration", colReview: "Review status", colCompany: "Company",
    fTitle: "Title", fType: "Type", fDest: "Destination", fDuration: "Duration (days)", allTypes: "All types",
    newPkg: "New package", back: "Back to packages", save: "Save package", activate: "Activate", deactivate: "Deactivate",
    deleteConfirm: "Delete this package? This is permanent (hard delete).", activateConfirm: "Activate this package?", deactivateConfirm: "Deactivate this package?",
    lockBanner: "This package is submitted for review and locked from editing until it is approved or rejected.",
  };
  const hy: Record<string, string> = {
    secBasic: "Հիմնական տվյալներ", secDest: "Նպատակակետ", secPricing: "Գին", secDetails: "Մանրամասներ", secVisibility: "Տեսանելիություն", secMarketing: "Մարքեթինգ", secLocation: "Տեղ", secCustom: "Հատուկ դաշտեր",
    title: "Վերնագիր", subtitle: "Ենթավերնագիր", type: "Տեսակ", typeHint: "մոդելի հաստատ. արժեքները՝ fixed / dynamic / semi_fixed", offerId: "Առաջարկի ID", offerIdHint: "Պահանջում է առկա type=package առաջարկ · միայն ստեղծելիս",
    destLocation: "Նպատակակետի վայր", destHint: "պահվում է, բայց API-ն չի վերադարձնում", basePrice: "Հիմնական գին", currency: "Արժույթ", displayPriceMode: "Գնի ցուցադրման ռեժիմ",
    durationDays: "Տևողություն (օր)", minNights: "Նվազ. գիշեր", adultsCount: "Մեծահասակների քանակ", childrenCount: "Երեխաների քանակ",
    featured: "Առանձնացված", featuredHint: "is_featured · պահվում է, բայց API-ն չի վերադարձնում", mainImage: "Հիմնական նկար", shortDesc: "Կարճ նկարագրություն", apiGapHint: "պահվում է, բայց API-ն չի վերադարձնում", latitude: "Լայնություն", longitude: "Երկայնություն",
    colTitle: "Վերնագիր", colType: "Տեսակ", colDest: "Նպատակակետ", colDuration: "Տևողություն", colReview: "Ստուգման կարգավիճակ", colCompany: "Ընկերություն",
    fTitle: "Վերնագիր", fType: "Տեսակ", fDest: "Նպատակակետ", fDuration: "Տևողություն (օր)", allTypes: "Բոլոր տեսակները",
    newPkg: "Նոր փաթեթ", back: "Վերադառնալ փաթեթներին", save: "Պահել փաթեթը", activate: "Ակտիվացնել", deactivate: "Ապաակտիվացնել",
    deleteConfirm: "Ջնջե՞լ այս փաթեթը։ Սա մշտական է (վերջնական ջնջում)։", activateConfirm: "Ակտիվացնե՞լ այս փաթեթը։", deactivateConfirm: "Ապաակտիվացնե՞լ այս փաթեթը։",
    lockBanner: "Այս փաթեթը ուղարկված է ստուգման և կողպված է խմբագրումից մինչև հաստատում կամ մերժում։",
  };
  const ru: Record<string, string> = {
    secBasic: "Основное", secDest: "Назначение", secPricing: "Цена", secDetails: "Детали", secVisibility: "Видимость", secMarketing: "Маркетинг", secLocation: "Локация", secCustom: "Доп. поля",
    title: "Название", subtitle: "Подзаголовок", type: "Тип", typeHint: "константы модели fixed / dynamic / semi_fixed", offerId: "ID предложения", offerIdHint: "Нужно существующее предложение type=package · только при создании",
    destLocation: "Локация назначения", destHint: "сохраняется, но не возвращается API", basePrice: "Базовая цена", currency: "Валюта", displayPriceMode: "Режим показа цены",
    durationDays: "Длительность (дни)", minNights: "Мин. ночей", adultsCount: "Взрослых", childrenCount: "Детей",
    featured: "Рекомендуемое", featuredHint: "is_featured · сохраняется, но не возвращается API", mainImage: "Главное изображение", shortDesc: "Краткое описание", apiGapHint: "сохраняется, но не возвращается API", latitude: "Широта", longitude: "Долгота",
    colTitle: "Название", colType: "Тип", colDest: "Назначение", colDuration: "Длительность", colReview: "Статус проверки", colCompany: "Компания",
    fTitle: "Название", fType: "Тип", fDest: "Назначение", fDuration: "Длительность (дни)", allTypes: "Все типы",
    newPkg: "Новый пакет", back: "Назад к пакетам", save: "Сохранить пакет", activate: "Активировать", deactivate: "Деактивировать",
    deleteConfirm: "Удалить этот пакет? Это навсегда (безвозвратное удаление).", activateConfirm: "Активировать этот пакет?", deactivateConfirm: "Деактивировать этот пакет?",
    lockBanner: "Этот пакет отправлен на проверку и заблокирован для редактирования до одобрения или отклонения.",
  };
  return lang === "hy" ? hy : lang === "ru" ? ru : en;
}

function emptyPkg(): PackagePayload {
  return {
    package_title: "", package_subtitle: "", package_type: "multi_service", destination_city: "", destination_country: "", destination_location_id: null,
    duration_days: undefined, min_nights: null, adults_count: 2, children_count: 0, base_price: null, currency: "USD",
    main_image: "", short_description: "", is_featured: false, latitude: null, longitude: null,
  };
}
function pkgFromRow(r: PackageRow): PackagePayload {
  return {
    package_title: r.package_title ?? "", package_subtitle: r.package_subtitle ?? "", package_type: r.package_type ?? "multi_service",
    destination_city: r.destination_city ?? "", destination_country: r.destination_country ?? "", destination_location_id: r.destination_location_id ?? null,
    duration_days: r.duration_days ?? undefined, min_nights: r.min_nights ?? null, adults_count: r.adults_count ?? 2, children_count: r.children_count ?? 0,
    base_price: r.base_price != null ? Number(r.base_price) : null, currency: r.currency ?? "USD",
    main_image: r.main_image ?? "", short_description: r.short_description ?? "", is_featured: r.is_featured ?? false,
    latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
  };
}

function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "active": case "published": return "badge-success";
    case "pending_review": return "badge-warning";
    case "draft": case "inactive": return "badge-gray";
    case "archived": case "rejected": return "badge-danger";
    default: return "badge-gray";
  }
}
function submittable(status: string | null | undefined): boolean {
  return status === "draft" || status === "rejected" || status === "changes_requested";
}

export function PackagesPane({ token, user, lang, registerAction, showToast }: InventoryPaneProps) {
  const s = inventoryStrings(lang);
  const L = lab(lang);
  const confirm = useConfirm();

  const [rows, setRows] = useState<PackageRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [fTitle, setFTitle] = useState("");
  const [fType, setFType] = useState("");
  const [fStatus, setFStatus] = useState("");

  const [form, setForm] = useState<PackagePayload | null>(null);
  const [offerId, setOfferId] = useState<number | "">("");
  const [displayPriceMode, setDisplayPriceMode] = useState("total");
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [editId, setEditId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editPkgStatus, setEditPkgStatus] = useState<string | null>(null);
  const [editOfferId, setEditOfferId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiPackages(token, { page, per_page: 20 });
      setRows(res.data); setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditId(null); setEditStatus(null); setEditPkgStatus(null); setEditOfferId(null);
    setForm(emptyPkg()); setOfferId(""); setDisplayPriceMode("total"); setCustomFields({}); setFormErr(null);
  }
  function openEdit(r: PackageRow) {
    setEditId(r.id); setEditStatus(r.offer?.status ?? null); setEditPkgStatus(r.status ?? null); setEditOfferId(r.offer_id ?? null);
    setForm(pkgFromRow(r)); setOfferId(r.offer_id ?? ""); setDisplayPriceMode("total"); setCustomFields({}); setFormErr(null);
    if (token) void apiCustomFieldValues(token, "package", r.id).then(setCustomFields).catch(() => {});
  }
  function closeForm() { setForm(null); setEditId(null); setFormErr(null); }

  useEffect(() => {
    if (form === null && userHasPermission(user, "packages.create")) {
      registerAction(<button className="btn btn-primary" onClick={openCreate}><i className="ti ti-plus" />{L.newPkg}</button>);
    } else { registerAction(null); }
    return () => registerAction(null);
  }, [form, user, registerAction, L.newPkg]);

  function set(key: keyof PackagePayload, val: unknown) { setForm((p) => (p ? { ...p, [key]: val } : p)); }

  async function handleSubmit() {
    if (!token || !form) return;
    setBusy(true); setFormErr(null);
    try {
      const body: PackagePayload = { ...form, display_price_mode: displayPriceMode, custom_fields: customFields };
      if (editId != null) await apiUpdatePackage(token, editId, body);
      else await apiCreatePackage(token, { ...body, offer_id: offerId === "" ? undefined : Number(offerId) });
      closeForm(); showToast(s.save); await load();
    } catch (e) { setFormErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleDelete(r: PackageRow) {
    if (!token) return;
    const ok = await confirm({ message: L.deleteConfirm, variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try { await apiDeletePackage(token, r.id); showToast(s.delete); await load(); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  async function handleToggle(pkgStatus: string | null, id: number) {
    if (!token) return;
    const activating = pkgStatus !== "active";
    const ok = await confirm({ message: activating ? L.activateConfirm : L.deactivateConfirm, variant: activating ? undefined : "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      if (activating) await apiActivatePackage(token, id); else await apiDeactivatePackage(token, id);
      showToast(s.save); await load(); closeForm();
    } catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  async function handleSubmitForReview(oid: number | null) {
    if (!token || !oid) return;
    const ok = await confirm({ message: s.hSubmitConfirm });
    if (!ok) return;
    setBusy(true);
    try { await apiSubmitOfferForReview(token, oid); await load(); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (forbidden) return <div className="card"><div className="card-body"><ForbiddenNotice /></div></div>;

  // ── FORM ─────────────────────────────────────────────────────────
  if (form) {
    const isEdit = editId != null;
    const locked = editStatus === "pending_review";
    return (
      <div>
        <button className="btn btn-ghost detail-back" onClick={closeForm}><i className="ti ti-arrow-left" />{L.back}</button>
        <div className="detail-head">
          <div className="detail-logo"><i className="ti ti-package" /></div>
          <div><div className="detail-title">{(form.package_title as string) || L.newPkg}</div><div className="detail-meta"><span className="font-mono">{isEdit ? `#${editId}` : "—"}</span></div></div>
          <div className="detail-head-right">{isEdit && editStatus && <span className={`badge ${statusBadgeClass(editStatus)}`}>{editStatus}</span>}</div>
        </div>

        {locked && <div className="alert" style={{ background: "var(--warning-light)", color: "var(--warning-dark)" }}><i className="ti ti-lock" /><div>{L.lockBanner}</div></div>}

        <div className="card"><div className="card-body">
          <div className="form-section"><i className="ti ti-info-circle" />{L.secBasic}</div>
          <div className="form-grid">
            <div className="fld span-2"><label className="fld-label">{L.title}</label><input type="text" value={(form.package_title as string) ?? ""} onChange={(e) => set("package_title", e.target.value)} placeholder="Package title" /></div>
            <div className="fld span-2"><label className="fld-label">{L.subtitle}</label><input type="text" value={(form.package_subtitle as string) ?? ""} onChange={(e) => set("package_subtitle", e.target.value)} placeholder="Optional subtitle" /></div>
            <div className="fld"><label className="fld-label">{L.type}</label><select value={(form.package_type as string) ?? "multi_service"} onChange={(e) => set("package_type", e.target.value)}>{PACKAGE_TYPES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}</select><span className="fld-hint">{L.typeHint}</span></div>
            {!isEdit && <div className="fld"><label className="fld-label">{L.offerId} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" value={offerId} onChange={(e) => setOfferId(e.target.value === "" ? "" : Number(e.target.value))} placeholder="5501" /><span className="fld-hint">{L.offerIdHint}</span></div>}
          </div>

          <div className="form-section"><i className="ti ti-map-pin" />{L.secDest}</div>
          <div className="form-grid">
            <div className="fld span-2"><label className="fld-label">{L.destLocation}</label>
              <LocationCascadeSelect token={token} value={form.destination_location_id == null ? null : Number(form.destination_location_id)} label=""
                onChange={(id, m) => setForm((p) => p ? { ...p, destination_location_id: id, destination_country: m.country?.name ?? p.destination_country, destination_city: m.city?.name ?? p.destination_city } : p)} />
              <span className="fld-hint">{L.destHint}</span></div>
          </div>

          <div className="form-section"><i className="ti ti-cash" />{L.secPricing}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.basePrice}</label><input type="number" min={0} step={0.01} value={form.base_price ?? ""} onChange={(e) => set("base_price", e.target.value === "" ? null : Number(e.target.value))} placeholder="0.00" /></div>
            <div className="fld"><label className="fld-label">{L.currency}</label><input type="text" maxLength={3} value={(form.currency as string) ?? ""} onChange={(e) => set("currency", e.target.value.toUpperCase())} placeholder="USD" /></div>
            <div className="fld"><label className="fld-label">{L.displayPriceMode}</label><select value={displayPriceMode} onChange={(e) => setDisplayPriceMode(e.target.value)}>{DISPLAY_PRICE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
          </div>

          <div className="form-section"><i className="ti ti-list-details" />{L.secDetails}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.durationDays}</label><input type="number" min={0} value={form.duration_days ?? ""} onChange={(e) => set("duration_days", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="5" /></div>
            <div className="fld"><label className="fld-label">{L.minNights}</label><input type="number" min={0} value={form.min_nights ?? ""} onChange={(e) => set("min_nights", e.target.value === "" ? null : Number(e.target.value))} placeholder="4" /></div>
            <div className="fld"><label className="fld-label">{L.adultsCount}</label><input type="number" min={0} value={form.adults_count ?? ""} onChange={(e) => set("adults_count", e.target.value === "" ? null : Number(e.target.value))} placeholder="2" /></div>
            <div className="fld"><label className="fld-label">{L.childrenCount}</label><input type="number" min={0} value={form.children_count ?? ""} onChange={(e) => set("children_count", e.target.value === "" ? null : Number(e.target.value))} placeholder="0" /></div>
          </div>

          <div className="form-section"><i className="ti ti-eye" />{L.secVisibility}</div>
          <label className="switch-row"><span className="switch"><input type="checkbox" checked={!!form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} /><span className="switch-slider" /></span>{L.featured} <span className="text-sm cell-muted">· {L.featuredHint}</span></label>

          <div className="form-section"><i className="ti ti-photo" />{L.secMarketing}</div>
          <div className="form-grid">
            <div className="fld span-2"><label className="fld-label">{L.mainImage}</label><ImageUploadField value={(form.main_image as string) ?? ""} onChange={(v) => set("main_image", v)} section="packages" label="" /><span className="fld-hint">{L.apiGapHint}</span></div>
            <div className="fld span-2"><label className="fld-label">{L.shortDesc}</label><textarea rows={3} value={(form.short_description as string) ?? ""} onChange={(e) => set("short_description", e.target.value)} /><span className="fld-hint">{L.apiGapHint}</span></div>
          </div>

          <div className="form-section"><i className="ti ti-map-2" />{L.secLocation}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.latitude}</label><input type="number" step={0.000001} value={form.latitude ?? ""} onChange={(e) => set("latitude", e.target.value === "" ? null : Number(e.target.value))} placeholder="40.1772" /><span className="fld-hint">{L.apiGapHint}</span></div>
            <div className="fld"><label className="fld-label">{L.longitude}</label><input type="number" step={0.000001} value={form.longitude ?? ""} onChange={(e) => set("longitude", e.target.value === "" ? null : Number(e.target.value))} placeholder="44.5035" /><span className="fld-hint">{L.apiGapHint}</span></div>
          </div>

          {isEdit && (<>
            <div className="form-section"><i className="ti ti-adjustments" />{L.secCustom}</div>
            <CustomFieldsRenderer scope="package" values={customFields} onChange={setCustomFields} />
          </>)}
        </div></div>

        {formErr && <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}><i className="ti ti-alert-triangle" /><div>{formErr}</div></div>}

        <div className="card"><div className="card-foot">
          <button className="btn btn-ghost" onClick={closeForm}>{s.cancel}</button>
          {isEdit && (editPkgStatus === "active" || editPkgStatus === "inactive") && (
            <button className="btn" disabled={busy} onClick={() => void handleToggle(editPkgStatus, editId)}>
              <i className={`ti ${editPkgStatus === "active" ? "ti-player-pause" : "ti-player-play"}`} />{editPkgStatus === "active" ? L.deactivate : L.activate}
            </button>
          )}
          {isEdit && submittable(editStatus) && editOfferId != null && (
            <button className="btn" disabled={busy} onClick={() => void handleSubmitForReview(editOfferId)}><i className="ti ti-send" />{s.hSubmitReview}</button>
          )}
          <button className="btn btn-primary" disabled={busy || locked} onClick={() => void handleSubmit()}><i className="ti ti-check" />{busy ? s.saving : L.save}</button>
        </div></div>
      </div>
    );
  }

  // ── LIST ─────────────────────────────────────────────────────────
  const shown = rows.filter((r) =>
    (!fTitle || (r.package_title ?? "").toLowerCase().includes(fTitle.toLowerCase())) &&
    (!fType || (r.package_type) === fType) &&
    (!fStatus || (r.offer?.status ?? r.status) === fStatus)
  );
  const total = meta?.total ?? shown.length;
  const active = rows.filter((r) => (r.status) === "active").length;
  const pending = rows.filter((r) => (r.offer?.status) === "pending_review").length;
  const featured = rows.filter((r) => r.is_featured).length;
  const from = shown.length ? (page - 1) * 20 + 1 : 0;
  const to = (page - 1) * 20 + shown.length;

  return (
    <div>
      <div className="alert oversight-note"><i className="ti ti-info-circle" /><div><strong>{s.scopeOversight}.</strong> {s.extNoOversight}</div></div>
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}><span className="filter-label">{L.fTitle}</span><input type="text" value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="Package title…" /></div>
        <div className="filter-field"><span className="filter-label">{L.fType}</span>
          <select value={fType} onChange={(e) => setFType(e.target.value)}><option value="">{L.allTypes}</option>{PACKAGE_TYPES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}</select></div>
        <div className="filter-field"><span className="filter-label">{s.status}</span>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">{s.all}</option>{["draft", "active", "inactive", "pending_review", "archived"].map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
      </div>
      <div className="stat-grid">
        <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-package" /></div><div className="stat-value">{total}</div><div className="stat-label">{s.statTotal}</div></div>
        <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-circle-check" /></div><div className="stat-value">{active}</div><div className="stat-label">{s.statActive}</div></div>
        <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-clock" /></div><div className="stat-value">{pending}</div><div className="stat-label">{s.statPending}</div></div>
        <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-star" /></div><div className="stat-value">{featured}</div><div className="stat-label">{L.featured}</div></div>
      </div>
      {err && <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}><i className="ti ti-alert-triangle" /><div>{err}</div></div>}
      <div className="card">
        <div className="card-header"><div><div className="card-title">{s.tabPackages}</div><div className="card-subtitle">One package per type=package offer · activation needs 1+ required components.</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{s.id}</th><th>{L.colTitle}</th><th>{L.colType}</th><th>{L.colDest}</th><th>{L.colDuration}</th><th>{L.colReview}</th><th>{L.colCompany}</th><th style={{ textAlign: "right" }}>{s.actions}</th></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={8} className="no-label" style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>{s.empty}</td></tr>}
              {shown.map((r) => {
                const ost = r.offer?.status ?? r.status ?? "";
                return (
                  <tr key={r.id} onClick={() => openEdit(r)}>
                    <td className="font-mono m-primary" data-label={s.id}>#{r.id}</td>
                    <td data-label={L.colTitle}><div className="flex items-center gap-2"><span className="avatar avatar-purple sm">{(r.package_title ?? "?").slice(0, 2).toUpperCase()}</span><div><div className="font-semibold">{r.package_title ?? "—"}</div><div className="text-sm cell-muted">{r.package_type ?? ""}</div></div></div></td>
                    <td data-label={L.colType}>{r.package_type ?? "—"}</td>
                    <td data-label={L.colDest}>{r.destination_country ?? r.destination_city ?? "—"}</td>
                    <td className="font-mono" data-label={L.colDuration}>{r.duration_days ?? "—"}</td>
                    <td data-label={L.colReview}><span className={`badge ${statusBadgeClass(ost)}`}>{ost || "—"}</span></td>
                    <td data-label={L.colCompany}>{r.company?.name ?? r.company_id ?? "—"}</td>
                    <td className="no-label">
                      <div className="row-actions">
                        {submittable(ost) && r.offer_id && <button className="icon-btn" title={s.hSubmitReview} onClick={(e) => { e.stopPropagation(); void handleSubmitForReview(r.offer_id ?? null); }}><i className="ti ti-send" /></button>}
                        <button className="icon-btn" title={s.edit} onClick={(e) => { e.stopPropagation(); openEdit(r); }}><i className="ti ti-edit" /></button>
                        <button className="icon-btn danger" title={s.delete} onClick={(e) => { e.stopPropagation(); void handleDelete(r); }}><i className="ti ti-trash" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span className="pagination-info">{s.showing} {from}–{to} {s.of} {total}</span>
          <div className="pagination-controls">
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{s.prev}</button>
            <button className="btn btn-sm btn-primary">{page}</button>
            <button className="btn btn-sm" disabled={!meta || page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>{s.next}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
