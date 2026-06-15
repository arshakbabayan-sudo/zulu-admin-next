"use client";

/**
 * Excursions pane — 1:1 port of #pane-excursions in inventory.html.
 *
 * 5-step wizard (Location · Categories · Tour info · Includes · Pricing) with
 * dynamic lists (photos / includes / price-by-dates) and offer auto-create.
 * Reuses lib/excursions/excursion-wizard-state.ts (form state, payload builders,
 * validators) + useExcursionWizardStepper for step navigation.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiExcursions,
  apiCreateExcursion,
  apiUpdateExcursion,
  apiDeleteExcursion,
  apiCustomFieldValues,
  apiOffers,
  apiCompaniesList,
  apiCreateOffer,
  type ExcursionRow,
  type OfferRow,
} from "@/lib/inventory-crud-api";
import {
  coreWritePayloadFromWizard,
  expandedPayloadFromWizard,
  excursionWizardFromRow,
  emptyExcursionWizardTail,
  validateExcursionWizardFull,
  EXCURSION_WIZARD_STEP_COUNT,
  type ExcursionWizardState,
  type FieldErrors,
} from "@/lib/excursions/excursion-wizard-state";
import { useExcursionWizardStepper } from "@/hooks/useExcursionWizardStepper";
import { apiSubmitOfferForReview } from "@/lib/platform-admin-api";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { CustomFieldsRenderer } from "@/components/CustomFieldsRenderer";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { userHasPermission } from "@/lib/access";
import { inventoryStrings } from "../inventory-i18n";
import type { InventoryPaneProps } from "../types";

function lab(lang: string): Record<string, string> {
  const en: Record<string, string> = {
    step1: "Location", step2: "Categories", step3: "Tour info", step4: "Includes", step5: "Pricing",
    secLocation: "Location", secCategories: "Categories / type", secCategoriesHint: "at least one of the three required", secTourInfo: "Tour info, schedule & capacity", secPhotos: "Photos", secIncludes: "Includes", secPricing: "Price by dates", secPricingHint: "min price updates offer.price", secVisibility: "Visibility", secCustom: "Custom fields",
    mainImage: "Main image (URL)", shortDesc: "Short description", latitude: "Latitude", longitude: "Longitude", location: "Location (cascade)", offer: "Offer", company: "Company", selectOffer: "Select excursion offer…", autoCreate: "+ Auto-create",
    generalCategory: "General category", category: "Category", excursionType: "Excursion type",
    tourName: "Tour name", overview: "Overview", duration: "Duration", language: "Language", startsAt: "Starts at", endsAt: "Ends at", groupSize: "Group size", ticketMax: "Max ticket count", status: "Status", isAvailable: "Is available", isBookable: "Is bookable",
    addPhoto: "Add photo", addInclusion: "Add inclusion", meetingPickup: "Meeting / pickup point", additionalInfo: "Additional info", cancellationPolicy: "Cancellation policy",
    addDatePrice: "Add date price", date: "Date", price: "Price", visibilityRule: "Visibility rule", appearsWeb: "Appears in web", appearsAdmin: "Appears in admin", appearsZulu: "Appears in zulu admin",
    newExc: "New excursion", back: "Back to excursions", save: "Save excursion", deleteConfirm: "Delete this excursion? This is permanent (hard delete).",
  };
  const hy: Record<string, string> = {
    step1: "Տեղ", step2: "Կարգեր", step3: "Տուրի տվյալներ", step4: "Ներառվածներ", step5: "Գին",
    secLocation: "Տեղ", secCategories: "Կարգեր / տեսակ", secCategoriesHint: "երեքից առնվազն մեկը պարտադիր է", secTourInfo: "Տուրի տվյալներ, ժամանակացույց և տարողություն", secPhotos: "Լուսանկարներ", secIncludes: "Ներառվածներ", secPricing: "Գին ըստ ամսաթվերի", secPricingHint: "նվազ. գինը թարմացնում է offer.price-ը", secVisibility: "Տեսանելիություն", secCustom: "Հատուկ դաշտեր",
    mainImage: "Հիմնական նկար (URL)", shortDesc: "Կարճ նկարագրություն", latitude: "Լայնություն", longitude: "Երկայնություն", location: "Տեղադրություն (cascade)", offer: "Առաջարկ", company: "Ընկերություն", selectOffer: "Ընտրիր էքսկուրսիայի առաջարկ…", autoCreate: "+ Ինքնաշխատ ստեղծել",
    generalCategory: "Ընդհանուր կարգ", category: "Կարգ", excursionType: "Էքսկուրսիայի տեսակ",
    tourName: "Տուրի անուն", overview: "Ակնարկ", duration: "Տևողություն", language: "Լեզու", startsAt: "Սկսվում է", endsAt: "Ավարտվում է", groupSize: "Խմբի չափ", ticketMax: "Տոմսերի առավելագույն քանակ", status: "Կարգավիճակ", isAvailable: "Հասանելի է", isBookable: "Ամրագրելի է",
    addPhoto: "Ավելացնել լուսանկար", addInclusion: "Ավելացնել ներառում", meetingPickup: "Հանդիպման / վերցնելու կետ", additionalInfo: "Լրացուցիչ տեղեկություն", cancellationPolicy: "Չեղարկման կանոն",
    addDatePrice: "Ավելացնել ամսաթվի գին", date: "Ամսաթիվ", price: "Գին", visibilityRule: "Տեսանելիության կանոն", appearsWeb: "Երևում է կայքում", appearsAdmin: "Երևում է ադմինում", appearsZulu: "Երևում է zulu ադմինում",
    newExc: "Նոր էքսկուրսիա", back: "Վերադառնալ էքսկուրսիաներին", save: "Պահել էքսկուրսիան", deleteConfirm: "Ջնջե՞լ այս էքսկուրսիան։ Սա մշտական է (վերջնական ջնջում)։",
  };
  const ru: Record<string, string> = {
    step1: "Локация", step2: "Категории", step3: "Инфо тура", step4: "Включено", step5: "Цены",
    secLocation: "Локация", secCategories: "Категории / тип", secCategoriesHint: "хотя бы одно из трёх обязательно", secTourInfo: "Инфо тура, расписание и вместимость", secPhotos: "Фото", secIncludes: "Включено", secPricing: "Цены по датам", secPricingHint: "мин. цена обновляет offer.price", secVisibility: "Видимость", secCustom: "Доп. поля",
    mainImage: "Главное изображение (URL)", shortDesc: "Краткое описание", latitude: "Широта", longitude: "Долгота", location: "Локация (каскад)", offer: "Предложение", company: "Компания", selectOffer: "Выберите предложение экскурсии…", autoCreate: "+ Авто-создать",
    generalCategory: "Общая категория", category: "Категория", excursionType: "Тип экскурсии",
    tourName: "Название тура", overview: "Обзор", duration: "Длительность", language: "Язык", startsAt: "Начало", endsAt: "Окончание", groupSize: "Размер группы", ticketMax: "Макс. кол-во билетов", status: "Статус", isAvailable: "Доступно", isBookable: "Доступно к брони",
    addPhoto: "Добавить фото", addInclusion: "Добавить включение", meetingPickup: "Точка встречи / подачи", additionalInfo: "Доп. информация", cancellationPolicy: "Правило отмены",
    addDatePrice: "Добавить цену по дате", date: "Дата", price: "Цена", visibilityRule: "Правило видимости", appearsWeb: "Видно на сайте", appearsAdmin: "Видно в админке", appearsZulu: "Видно в zulu-админке",
    newExc: "Новая экскурсия", back: "Назад к экскурсиям", save: "Сохранить экскурсию", deleteConfirm: "Удалить эту экскурсию? Это навсегда (безвозвратное удаление).",
  };
  return lang === "hy" ? hy : lang === "ru" ? ru : en;
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

export function ExcursionsPane({ token, user, lang, scope, registerAction, showToast }: InventoryPaneProps) {
  const s = inventoryStrings(lang);
  const L = lab(lang);
  const confirm = useConfirm();
  const readOnly = scope === "oversight";
  const offersCache = useRef<OfferRow[] | null>(null);
  const { step, setStep, resetToFirstStep, goPrevious, tryAdvance } = useExcursionWizardStepper();

  const [rows, setRows] = useState<ExcursionRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [fLocation, setFLocation] = useState("");
  const [fStatus, setFStatus] = useState("");

  const [form, setForm] = useState<ExcursionWizardState | null>(null);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [excursionOffers, setExcursionOffers] = useState<OfferRow[] | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiExcursions(token, { page, per_page: 20 });
      setRows(res.data); setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page]);

  useEffect(() => { void load(); }, [load]);

  const ensureOffers = useCallback(async (): Promise<OfferRow[]> => {
    if (offersCache.current !== null) return offersCache.current;
    if (!token) return [];
    const res = await apiOffers(token, { type: "excursion" });
    offersCache.current = res.data ?? [];
    return offersCache.current;
  }, [token]);

  async function openCreate() {
    setBusy(true); setFormErr(null); setFieldErrs(null);
    let offers: OfferRow[] = [];
    try {
      offers = await ensureOffers();
      if (offers.length === 0 && token) {
        const companiesRes = await apiCompaniesList(token);
        const companies = companiesRes.data ?? [];
        if (companies.length === 0) { setFormErr("No companies available."); setBusy(false); return; }
        await apiCreateOffer(token, { company_id: Number(companies[0]!.id), type: "excursion", title: "Excursion draft", price: 0, currency: "USD" });
        offersCache.current = null;
        offers = await ensureOffers();
      }
    } catch (e) { setBusy(false); setFormErr(e instanceof ApiRequestError ? e.message : "Could not open the form."); return; }
    const used = new Set<number>(); rows.forEach((r) => { if (r.offer_id != null) used.add(Number(r.offer_id)); });
    const available = offers.find((o) => !used.has(o.id));
    if (!available) { setFormErr("Every excursion offer already has details linked. Create another excursion offer."); setBusy(false); return; }
    setEditId(null); setEditStatus(null); setExcursionOffers(offers);
    setForm({ offer_id: available.id, company_id: available.company_id != null ? Number(available.company_id) : "", ...emptyExcursionWizardTail() });
    setCustomFields({}); resetToFirstStep(); setFormErr(null); setBusy(false);
  }

  const openEdit = useCallback((r: ExcursionRow) => {
    setEditId(r.id); setEditStatus(r.offer?.status ?? null); setExcursionOffers(null);
    setForm(excursionWizardFromRow(r)); setCustomFields({}); setFormErr(null); setFieldErrs(null); resetToFirstStep();
    if (token) void apiCustomFieldValues(token, "excursion", r.id).then(setCustomFields).catch(() => {});
  }, [token, resetToFirstStep]);

  function closeForm() { setForm(null); setEditId(null); setFormErr(null); setFieldErrs(null); setExcursionOffers(null); resetToFirstStep(); }

  useEffect(() => {
    if (form === null && !busy && !readOnly && userHasPermission(user, "excursions.create")) {
      registerAction(<button className="btn btn-primary" onClick={() => void openCreate()}><i className="ti ti-plus" />{L.newExc}</button>);
    } else { registerAction(null); }
    return () => registerAction(null);
  }, [form, busy, readOnly, user, registerAction, L.newExc]);

  function onOfferChange(v: string) {
    if (v === "__new") { void createNewOffer(); return; }
    const oid = v === "" ? "" : Number(v);
    const list = excursionOffers ?? offersCache.current ?? [];
    const o = list.find((x) => x.id === oid);
    setForm((p) => (p ? { ...p, offer_id: oid, company_id: o?.company_id != null ? Number(o.company_id) : "" } : p));
  }
  async function createNewOffer() {
    if (!token) return;
    setBusy(true);
    try {
      const companiesRes = await apiCompaniesList(token);
      const companies = companiesRes.data ?? [];
      if (companies.length === 0) { setFormErr("No companies available."); setBusy(false); return; }
      const res = await apiCreateOffer(token, { company_id: Number(companies[0]!.id), type: "excursion", title: "Excursion draft", price: 0, currency: "USD" });
      offersCache.current = null;
      setExcursionOffers(await ensureOffers());
      const created = res.data;
      if (created) setForm((p) => (p ? { ...p, offer_id: created.id, company_id: created.company_id != null ? Number(created.company_id) : "" } : p));
    } catch (e) { setFormErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleSubmit() {
    if (!token || !form) return;
    setFormErr(null); setFieldErrs(null);
    const isCreate = editId == null;
    const local = validateExcursionWizardFull(form, isCreate);
    if (local) { setFieldErrs(local); setFormErr("Fix validation errors below."); return; }
    setBusy(true);
    try {
      const core = coreWritePayloadFromWizard(form);
      const expanded = expandedPayloadFromWizard(form);
      if (editId != null) await apiUpdateExcursion(token, editId, { ...core, ...expanded, custom_fields: customFields });
      else await apiCreateExcursion(token, { offer_id: Number(form.offer_id), company_id: Number(form.company_id), ...core, ...expanded, custom_fields: customFields });
      offersCache.current = null;
      closeForm(); showToast(s.save); await load();
    } catch (e) {
      if (e instanceof ApiRequestError) { setFormErr(e.message || "Request failed."); setFieldErrs(e.body?.errors ?? null); }
      else setFormErr("Failed");
    } finally { setBusy(false); }
  }

  async function handleDelete(r: ExcursionRow) {
    if (!token) return;
    const ok = await confirm({ message: L.deleteConfirm, variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try { await apiDeleteExcursion(token, r.id); offersCache.current = null; showToast(s.delete); await load(); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  async function handleSubmitForReview(offerId: number | null) {
    if (!token || !offerId) return;
    const ok = await confirm({ message: s.hSubmitConfirm });
    if (!ok) return;
    setBusy(true);
    try { await apiSubmitOfferForReview(token, offerId); await load(); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  function set<K extends keyof ExcursionWizardState>(key: K, val: ExcursionWizardState[K]) { setForm((p) => (p ? { ...p, [key]: val } : p)); }
  function onTryNext() {
    if (!form) return;
    const r = tryAdvance(form, editId == null);
    if (!r.ok) { setFieldErrs(r.errors); setFormErr("Fix validation errors below."); return; }
    setFieldErrs(null); setFormErr(null);
  }
  const numOrEmpty = (v: string): number | "" => (v === "" ? "" : Number(v));

  if (forbidden) return <div className="card"><div className="card-body"><ForbiddenNotice /></div></div>;

  // ── WIZARD ───────────────────────────────────────────────────────
  if (form) {
    const isEdit = editId != null;
    const isLast = step >= EXCURSION_WIZARD_STEP_COUNT;
    const offerList = excursionOffers ?? offersCache.current ?? [];
    const STEP_LABELS = [L.step1, L.step2, L.step3, L.step4, L.step5];
    return (
      <div>
        <button className="btn btn-ghost detail-back" onClick={closeForm}><i className="ti ti-arrow-left" />{L.back}</button>
        <div className="detail-head">
          <div className="detail-logo"><i className="ti ti-map-2" /></div>
          <div><div className="detail-title">{form.tour_name || L.newExc}</div><div className="detail-meta"><span className="font-mono">{isEdit ? `#${editId}` : "—"}</span></div></div>
          <div className="detail-head-right">{isEdit && editStatus && <span className={`badge ${statusBadgeClass(editStatus)}`}>{editStatus}</span>}</div>
        </div>

        <div className="sub-tabs wizard-strip">
          {STEP_LABELS.map((sl, i) => {
            const n = i + 1;
            return <button key={sl} className={`sub-tab ${n === step ? "active" : n < step ? "done" : ""}`} onClick={() => setStep(n)}><span className="step-no">{n}</span>{sl}</button>;
          })}
        </div>

        <div className="card"><div className="card-body">
          {step === 1 && (<>
            <div className="form-section"><i className="ti ti-map-pin" />{L.secLocation}</div>
            <div className="form-grid">
              <div className="fld span-2"><label className="fld-label">{L.mainImage}</label><input type="text" value={form.main_image} onChange={(e) => set("main_image", e.target.value)} placeholder="https://…/garni.jpg" /></div>
              <div className="fld span-2"><label className="fld-label">{L.shortDesc}</label><textarea rows={2} value={form.short_description} onChange={(e) => set("short_description", e.target.value)} /></div>
              <div className="fld"><label className="fld-label">{L.latitude}</label><input type="number" step="any" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} /></div>
              <div className="fld"><label className="fld-label">{L.longitude}</label><input type="number" step="any" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} /></div>
              <div className="fld span-2"><label className="fld-label">{L.location}</label>
                <LocationCascadeSelect token={token} value={form.location_id === "" ? null : Number(form.location_id)} label=""
                  onChange={(id, m) => setForm((p) => p ? { ...p, location_id: id ?? "", country: m.country?.name ?? p.country, city: m.city?.name ?? p.city } : p)} /></div>
              <div className="fld"><label className="fld-label">{L.offer} <span style={{ color: "var(--danger)" }}>*</span></label>
                <select value={String(form.offer_id)} disabled={isEdit} onChange={(e) => onOfferChange(e.target.value)}>
                  <option value="">{L.selectOffer}</option>
                  {offerList.map((o) => <option key={o.id} value={o.id}>{`#${o.id} · ${o.title ?? "—"}`}</option>)}
                  {!isEdit && <option value="__new">{L.autoCreate}</option>}
                </select></div>
              <div className="fld"><label className="fld-label">{L.company} <span style={{ color: "var(--danger)" }}>*</span></label><input type="text" value={form.company_id === "" ? "" : String(form.company_id)} readOnly /></div>
            </div>
          </>)}

          {step === 2 && (<>
            <div className="form-section"><i className="ti ti-category" />{L.secCategories}<span className="fs-hint">{L.secCategoriesHint}</span></div>
            <div className="form-grid">
              <div className="fld"><label className="fld-label">{L.generalCategory}</label><input type="text" value={form.general_category} onChange={(e) => set("general_category", e.target.value)} placeholder="Cultural" /></div>
              <div className="fld"><label className="fld-label">{L.category}</label><input type="text" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Historical sites" /></div>
              <div className="fld"><label className="fld-label">{L.excursionType}</label><input type="text" value={form.excursion_type} onChange={(e) => set("excursion_type", e.target.value)} placeholder="Guided tour" /></div>
            </div>
          </>)}

          {step === 3 && (<>
            <div className="form-section"><i className="ti ti-clipboard-text" />{L.secTourInfo}</div>
            <div className="form-grid">
              <div className="fld span-2"><label className="fld-label">{L.tourName}</label><input type="text" value={form.tour_name} onChange={(e) => set("tour_name", e.target.value)} /></div>
              <div className="fld span-2"><label className="fld-label">{L.overview}</label><textarea rows={3} value={form.overview} onChange={(e) => set("overview", e.target.value)} /></div>
              <div className="fld"><label className="fld-label">{L.duration} <span style={{ color: "var(--danger)" }}>*</span></label><input type="text" value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="Full day" /></div>
              <div className="fld"><label className="fld-label">{L.language}</label><input type="text" value={form.language} onChange={(e) => set("language", e.target.value)} placeholder="en" /></div>
              <div className="fld"><label className="fld-label">{L.startsAt}</label><input type="datetime-local" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></div>
              <div className="fld"><label className="fld-label">{L.endsAt}</label><input type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} /></div>
              <div className="fld"><label className="fld-label">{L.groupSize} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" min={1} value={form.group_size} onChange={(e) => set("group_size", numOrEmpty(e.target.value))} placeholder="15" /></div>
              <div className="fld"><label className="fld-label">{L.ticketMax}</label><input type="number" min={1} value={form.ticket_max_count} onChange={(e) => set("ticket_max_count", numOrEmpty(e.target.value))} /></div>
              <div className="fld"><label className="fld-label">{L.status}</label><input type="text" value={form.status} onChange={(e) => set("status", e.target.value)} placeholder="draft" /></div>
            </div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.is_available} onChange={(e) => set("is_available", e.target.checked)} /><span className="switch-slider" /></span>{L.isAvailable}</label>
              <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.is_bookable} onChange={(e) => set("is_bookable", e.target.checked)} /><span className="switch-slider" /></span>{L.isBookable}</label>
            </div>
            <div className="form-section" style={{ marginTop: 18 }}><i className="ti ti-photo" />{L.secPhotos}</div>
            {form.photos.map((ph, i) => (
              <div className="line-row" key={i}>
                <input type="text" value={ph} placeholder="https://…/photo.jpg" onChange={(e) => set("photos", form.photos.map((x, j) => (j === i ? e.target.value : x)))} />
                <button className="icon-btn danger" onClick={() => set("photos", form.photos.filter((_, j) => j !== i))}><i className="ti ti-trash" /></button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => set("photos", [...form.photos, ""])}><i className="ti ti-plus" />{L.addPhoto}</button>
          </>)}

          {step === 4 && (<>
            <div className="form-section"><i className="ti ti-list-check" />{L.secIncludes}</div>
            {form.includes.map((inc, i) => (
              <div className="line-row" key={i}>
                <input type="text" value={inc} placeholder="Hotel pickup & drop-off" onChange={(e) => set("includes", form.includes.map((x, j) => (j === i ? e.target.value : x)))} />
                <button className="icon-btn danger" onClick={() => set("includes", form.includes.filter((_, j) => j !== i))}><i className="ti ti-trash" /></button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => set("includes", [...form.includes, ""])}><i className="ti ti-plus" />{L.addInclusion}</button>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="fld span-2"><label className="fld-label">{L.meetingPickup}</label><textarea rows={2} value={form.meeting_pickup} onChange={(e) => set("meeting_pickup", e.target.value)} /></div>
              <div className="fld span-2"><label className="fld-label">{L.additionalInfo}</label><textarea rows={3} value={form.additional_info} onChange={(e) => set("additional_info", e.target.value)} /></div>
              <div className="fld span-2"><label className="fld-label">{L.cancellationPolicy}</label><textarea rows={3} value={form.cancellation_policy} onChange={(e) => set("cancellation_policy", e.target.value)} /></div>
            </div>
          </>)}

          {step === 5 && (<>
            <div className="form-section"><i className="ti ti-calendar-dollar" />{L.secPricing}<span className="fs-hint">{L.secPricingHint}</span></div>
            <div className="rep-list">
              {form.price_by_dates.map((pbd, i) => (
                <div className="rep-card" key={i}>
                  <div className="form-grid">
                    <div className="fld"><label className="fld-label">{L.date}</label><input type="date" value={pbd.date} onChange={(e) => set("price_by_dates", form.price_by_dates.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} /></div>
                    <div className="fld"><label className="fld-label">{L.price}</label><input type="number" step={0.01} value={pbd.price} onChange={(e) => set("price_by_dates", form.price_by_dates.map((x, j) => (j === i ? { ...x, price: numOrEmpty(e.target.value) } : x)))} placeholder="45.00" /></div>
                  </div>
                  <button className="icon-btn danger" style={{ marginTop: 8 }} onClick={() => set("price_by_dates", form.price_by_dates.filter((_, j) => j !== i))}><i className="ti ti-trash" /></button>
                </div>
              ))}
            </div>
            <button className="btn btn-sm rep-add" onClick={() => set("price_by_dates", [...form.price_by_dates, { date: "", price: "" }])}><i className="ti ti-plus" />{L.addDatePrice}</button>
            <div className="form-section" style={{ marginTop: 18 }}><i className="ti ti-eye" />{L.secVisibility}</div>
            <div className="form-grid">
              <div className="fld"><label className="fld-label">{L.visibilityRule}</label><select value={form.visibility_rule} onChange={(e) => set("visibility_rule", e.target.value)}>{["show_all", "show_accepted_only", "hide_rejected"].map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
            </div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.appears_in_web} onChange={(e) => set("appears_in_web", e.target.checked)} /><span className="switch-slider" /></span>{L.appearsWeb}</label>
              <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.appears_in_admin} onChange={(e) => set("appears_in_admin", e.target.checked)} /><span className="switch-slider" /></span>{L.appearsAdmin}</label>
              <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.appears_in_zulu_admin} onChange={(e) => set("appears_in_zulu_admin", e.target.checked)} /><span className="switch-slider" /></span>{L.appearsZulu}</label>
            </div>
            <div className="form-section" style={{ marginTop: 18 }}><i className="ti ti-adjustments" />{L.secCustom}</div>
            <CustomFieldsRenderer scope="excursion" values={customFields} onChange={setCustomFields} />
          </>)}

          {(formErr || fieldErrs) && (
            <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)", flexDirection: "column", alignItems: "stretch", marginTop: 16 }}>
              {formErr && <div>{formErr}</div>}
              {fieldErrs && Object.entries(fieldErrs).map(([f, msgs]) => <div key={f}>{f ? `${f}: ` : ""}{(msgs as string[]).join(" ")}</div>)}
            </div>
          )}

          <div className="wizard-nav">
            <button className="btn btn-ghost" disabled={step <= 1} onClick={goPrevious}><i className="ti ti-chevron-left" />{s.prev}</button>
            <span className="spacer" />
            <button className="btn" onClick={closeForm}>{s.cancel}</button>
            {!isLast && <button className="btn btn-primary" onClick={onTryNext}>{s.next}<i className="ti ti-chevron-right" /></button>}
            {isLast && <button className="btn btn-primary" disabled={busy} onClick={() => void handleSubmit()}><i className="ti ti-check" />{busy ? s.saving : L.save}</button>}
          </div>
        </div></div>
      </div>
    );
  }

  // ── LIST ─────────────────────────────────────────────────────────
  const shown = rows.filter((r) =>
    (!fLocation || (r.location ?? `${r.city ?? ""} ${r.country ?? ""}`).toLowerCase().includes(fLocation.toLowerCase())) &&
    (!fStatus || (r.offer?.status ?? "") === fStatus)
  );
  const total = meta?.total ?? shown.length;
  const active = rows.filter((r) => (r.offer?.status) === "active").length;
  const pending = rows.filter((r) => (r.offer?.status) === "pending_review").length;
  const from = shown.length ? (page - 1) * 20 + 1 : 0;
  const to = (page - 1) * 20 + shown.length;

  return (
    <div>
      {readOnly && <div className="alert oversight-note"><i className="ti ti-eye" /><div>{s.oversightBanner}</div></div>}
      <div className="filter-card">
        {readOnly && <div className="filter-field"><span className="filter-label">{s.company}</span><input type="text" placeholder={s.company} /></div>}
        <div className="filter-field" style={{ flex: 2 }}><span className="filter-label">{L.secLocation}</span><input type="text" value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="Garni" /></div>
        <div className="filter-field"><span className="filter-label">{s.status}</span>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">{s.all}</option>{["draft", "published", "pending_review", "archived"].map((o) => <option key={o} value={o}>{o}</option>)}</select>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-map-2" /></div><div className="stat-value">{total}</div><div className="stat-label">{s.statTotal}</div></div>
        <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-circle-check" /></div><div className="stat-value">{active}</div><div className="stat-label">{s.statActive}</div></div>
        <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-clock" /></div><div className="stat-value">{pending}</div><div className="stat-label">{s.statPending}</div></div>
        <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-users" /></div><div className="stat-value">{rows.length}</div><div className="stat-label">{s.tabExcursions}</div></div>
      </div>
      {err && <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}><i className="ti ti-alert-triangle" /><div>{err}</div></div>}
      <div className="card">
        <div className="card-header"><div><div className="card-title">{s.tabExcursions}</div><div className="card-subtitle">One excursion per offer · location derived from city+country.</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{s.id}</th><th>{L.tourName}</th>{readOnly && <th data-oversight>{s.company}</th>}<th>{L.secLocation}</th><th>{L.duration}</th><th>{s.status}</th><th style={{ textAlign: "right" }}>{s.actions}</th></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={readOnly ? 7 : 6} className="no-label" style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>{s.empty}</td></tr>}
              {shown.map((r) => {
                const ost = r.offer?.status ?? "";
                return (
                  <tr key={r.id} onClick={() => !readOnly && openEdit(r)}>
                    <td className="font-mono m-primary" data-label={s.id}>#{r.id}</td>
                    <td data-label={L.tourName}><div className="font-semibold">{r.tour_name ?? "—"}</div><div className="text-sm cell-muted">{[r.city, r.country].filter(Boolean).join(", ")}</div></td>
                    {readOnly && <td data-label={s.company}>{r.company_id ?? "—"}</td>}
                    <td data-label={L.secLocation}><span className="type-badge">{r.city ?? r.location ?? "—"}</span></td>
                    <td data-label={L.duration}>{r.duration ?? "—"}</td>
                    <td data-label={s.status}><span className={`badge ${statusBadgeClass(ost)}`}>{ost || "—"}</span></td>
                    <td className="no-label operator-cta">
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
