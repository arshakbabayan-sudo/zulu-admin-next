"use client";

/**
 * Cars pane — 1:1 port of #pane-cars in inventory.html.
 *
 * Full-page in-pane form with the versioned advanced_options JSON (child seats,
 * extra luggage, services / driver-languages multiselects, and conditional
 * pricing rules: mileage / cross-border / service-radius). Offer is create-only
 * (selecting populates company); a "+ auto-create" option mints a car offer.
 * Reuses lib/cars/car-operator-form.ts for the form-state ↔ API mapping.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiOffers,
  apiCompaniesList,
  apiCreateOffer,
  apiCars,
  apiCreateCar,
  apiUpdateCar,
  apiDeleteCar,
  apiCustomFieldValues,
  CAR_CHILD_SEAT_TYPES,
  CAR_SERVICE_KEYS,
  type CarRow,
  type OfferRow,
} from "@/lib/inventory-crud-api";
import {
  CAR_PRICING_MODES,
  CAR_OPERATIONAL_STATUSES,
  CAR_AVAILABILITY_STATUSES,
  CAR_CROSS_BORDER_POLICIES,
  CAR_OUT_OF_RADIUS_MODES_WITH_RADIUS,
  DRIVER_LANG_PRESETS,
  emptyCarForm,
  carFormFromRow,
  validateCarForm,
  buildCreatePayload,
  buildUpdatePayload,
  type CarFormState,
  type FieldErrors,
} from "@/lib/cars/car-operator-form";
import { apiSubmitOfferForReview } from "@/lib/platform-admin-api";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { ImageUploadField } from "@/components/ImageUploadField";
import { CustomFieldsRenderer } from "@/components/CustomFieldsRenderer";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { userHasPermission } from "@/lib/access";
import { inventoryStrings } from "../inventory-i18n";
import type { InventoryPaneProps } from "../types";

function lab(lang: string): Record<string, string> {
  const en: Record<string, string> = {
    secImageLoc: "Image & location", secOffer: "Offer & company", secRoute: "Route", secVehicle: "Vehicle info", secCapacity: "Capacity", secPricing: "Pricing", secStatus: "Status", secAdvOpt: "Advanced — options", secAdvPrice: "Advanced — pricing rules", secCustom: "Custom fields",
    mainImage: "Main image", shortDesc: "Short description", latitude: "Latitude", longitude: "Longitude",
    offer: "Offer", autoCreate: "+ Auto-create a car offer", company: "Company", location: "Location (cascade)", selectOffer: "Select car offer…",
    pickup: "Pickup location", dropoff: "Drop-off location", vehClass: "Vehicle class", vehType: "Vehicle type", brand: "Brand", model: "Model", year: "Year", transmission: "Transmission type", fuel: "Fuel type", fleet: "Fleet", category: "Category",
    seats: "Seats", suitcases: "Suitcases", smallBag: "Small bag", pricingMode: "Pricing mode", basePrice: "Base price", basePriceHint: "Synced to offer.price",
    availStart: "Availability window start", availEnd: "Availability window end", status: "Status", availStatus: "Availability status",
    childSeatsAvail: "Child seats available", childSeatTypes: "Child seat types", addSuitcases: "Additional suitcases max", addSmallBags: "Additional small bags max", extraLugNotes: "Extra luggage notes", services: "Services", driverLangs: "Driver languages",
    mileageMode: "Mileage mode", includedKm: "Included KM / rental", extraKm: "Extra KM price", crossBorder: "Cross-border policy", borderSurcharge: "Border surcharge amount", serviceRadius: "Service radius (KM)", outMode: "Out-of-radius mode", outFlat: "Out-of-radius flat fee", outPerKm: "Out-of-radius per KM",
    newCar: "New car", back: "Back to cars", save: "Save car", deleteConfirm: "Delete this car? This is permanent (hard delete).",
  };
  const hy: Record<string, string> = {
    secImageLoc: "Նկար և տեղ", secOffer: "Առաջարկ և ընկերություն", secRoute: "Երթուղի", secVehicle: "Մեքենայի տվյալներ", secCapacity: "Տարողություն", secPricing: "Գին", secStatus: "Կարգավիճակ", secAdvOpt: "Լրացուցիչ — ընտրանքներ", secAdvPrice: "Լրացուցիչ — գնագոյացման կանոններ", secCustom: "Հատուկ դաշտեր",
    mainImage: "Հիմնական նկար", shortDesc: "Կարճ նկարագրություն", latitude: "Լայնություն", longitude: "Երկայնություն",
    offer: "Առաջարկ", autoCreate: "+ Ինքնաշխատ ստեղծել մեքենայի առաջարկ", company: "Ընկերություն", location: "Տեղադրություն (cascade)", selectOffer: "Ընտրիր մեքենայի առաջարկ…",
    pickup: "Վերցնելու վայր", dropoff: "Հասցնելու վայր", vehClass: "Մեքենայի դաս", vehType: "Մեքենայի տեսակ", brand: "Մակնիշ", model: "Մոդել", year: "Տարի", transmission: "Փոխանցման տուփ", fuel: "Վառելիք", fleet: "Ավտոպարկ", category: "Կարգ",
    seats: "Նստատեղ", suitcases: "Ճամպրուկ", smallBag: "Փոքր պայուսակ", pricingMode: "Գնի ռեժիմ", basePrice: "Հիմնական գին", basePriceHint: "Համաժամվում է offer.price-ին",
    availStart: "Հասանելիության սկիզբ", availEnd: "Հասանելիության վերջ", status: "Կարգավիճակ", availStatus: "Հասանելիության կարգավիճակ",
    childSeatsAvail: "Մանկական աթոռ կա", childSeatTypes: "Մանկական աթոռի տեսակներ", addSuitcases: "Լրացուցիչ ճամպրուկի առավելագույն", addSmallBags: "Լրացուցիչ փոքր պայուսակի առավելագույն", extraLugNotes: "Լրացուցիչ ուղեբեռի նշումներ", services: "Ծառայություններ", driverLangs: "Վարորդի լեզուներ",
    mileageMode: "Վազքի ռեժիմ", includedKm: "Ներառված ԿՄ / վարձույթ", extraKm: "Լրացուցիչ ԿՄ-ի գին", crossBorder: "Սահմանահատման կանոն", borderSurcharge: "Սահմանի հավելավճար", serviceRadius: "Սպասարկման շառավիղ (ԿՄ)", outMode: "Շառավղից դուրս ռեժիմ", outFlat: "Շառավղից դուրս հաստ. վճար", outPerKm: "Շառավղից դուրս ԿՄ-ի գին",
    newCar: "Նոր մեքենա", back: "Վերադառնալ մեքենաներին", save: "Պահել մեքենան", deleteConfirm: "Ջնջե՞լ այս մեքենան։ Սա մշտական է (վերջնական ջնջում)։",
  };
  const ru: Record<string, string> = {
    secImageLoc: "Изображение и локация", secOffer: "Предложение и компания", secRoute: "Маршрут", secVehicle: "Данные авто", secCapacity: "Вместимость", secPricing: "Цена", secStatus: "Статус", secAdvOpt: "Расширенно — опции", secAdvPrice: "Расширенно — правила цен", secCustom: "Доп. поля",
    mainImage: "Главное изображение", shortDesc: "Краткое описание", latitude: "Широта", longitude: "Долгота",
    offer: "Предложение", autoCreate: "+ Авто-создать предложение авто", company: "Компания", location: "Локация (каскад)", selectOffer: "Выберите предложение авто…",
    pickup: "Место подачи", dropoff: "Место возврата", vehClass: "Класс авто", vehType: "Тип авто", brand: "Марка", model: "Модель", year: "Год", transmission: "Коробка передач", fuel: "Топливо", fleet: "Автопарк", category: "Категория",
    seats: "Мест", suitcases: "Чемоданы", smallBag: "Малая сумка", pricingMode: "Режим цены", basePrice: "Базовая цена", basePriceHint: "Синхр. с offer.price",
    availStart: "Начало окна доступности", availEnd: "Конец окна доступности", status: "Статус", availStatus: "Статус доступности",
    childSeatsAvail: "Есть детские кресла", childSeatTypes: "Типы детских кресел", addSuitcases: "Макс. доп. чемоданов", addSmallBags: "Макс. доп. малых сумок", extraLugNotes: "Заметки о доп. багаже", services: "Услуги", driverLangs: "Языки водителя",
    mileageMode: "Режим пробега", includedKm: "Включено КМ / аренда", extraKm: "Цена доп. КМ", crossBorder: "Правило пересечения границы", borderSurcharge: "Доплата за границу", serviceRadius: "Радиус обслуживания (КМ)", outMode: "Режим вне радиуса", outFlat: "Фикс. плата вне радиуса", outPerKm: "Цена за КМ вне радиуса",
    newCar: "Новое авто", back: "Назад к авто", save: "Сохранить авто", deleteConfirm: "Удалить это авто? Это навсегда (безвозвратное удаление).",
  };
  return lang === "hy" ? hy : lang === "ru" ? ru : en;
}

function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "active": case "published": return "badge-success";
    case "pending_review": return "badge-warning";
    case "draft": case "inactive": case "suspended": return "badge-gray";
    case "archived": case "rejected": return "badge-danger";
    default: return "badge-gray";
  }
}
function submittable(status: string | null | undefined): boolean {
  return status === "draft" || status === "rejected" || status === "changes_requested";
}

export function CarsPane({ token, user, lang, scope, registerAction, showToast }: InventoryPaneProps) {
  const s = inventoryStrings(lang);
  const L = lab(lang);
  const confirm = useConfirm();
  const readOnly = scope === "oversight";
  const offersCache = useRef<OfferRow[] | null>(null);

  const [rows, setRows] = useState<CarRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [fPickup, setFPickup] = useState("");
  const [fStatus, setFStatus] = useState("");

  const [form, setForm] = useState<CarFormState | null>(null);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [editId, setEditId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [carOffers, setCarOffers] = useState<OfferRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiCars(token, { page, per_page: 20 });
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
    const res = await apiOffers(token, { type: "car" });
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
        await apiCreateOffer(token, { company_id: Number(companies[0]!.id), type: "car", title: "Car rental draft", price: 0, currency: "USD" });
        offersCache.current = null;
        offers = await ensureOffers();
      }
    } catch (e) { setBusy(false); setFormErr(e instanceof ApiRequestError ? e.message : "Could not open the form."); return; }
    const used = new Set<number>(); rows.forEach((r) => { if (r.offer_id != null) used.add(Number(r.offer_id)); });
    const available = offers.find((o) => !used.has(o.id));
    if (!available) { setFormErr("Every car offer already has a vehicle linked. Create another car offer."); setBusy(false); return; }
    setEditId(null); setEditStatus(null); setCarOffers(offers);
    setForm({ offer_id: available.id, company_id: available.company_id != null ? Number(available.company_id) : "", ...emptyCarForm() });
    setCustomFields({}); setFormErr(null); setBusy(false);
  }

  const openEdit = useCallback((r: CarRow) => {
    setEditId(r.id); setEditStatus(r.offer?.status ?? r.status ?? null); setCarOffers(null);
    setForm(carFormFromRow(r)); setCustomFields({}); setFormErr(null); setFieldErrs(null);
    if (token) void apiCustomFieldValues(token, "car", r.id).then(setCustomFields).catch(() => {});
  }, [token]);

  function closeForm() { setForm(null); setEditId(null); setFormErr(null); setFieldErrs(null); setCarOffers(null); }

  useEffect(() => {
    if (form === null && !busy && !readOnly && userHasPermission(user, "cars.create")) {
      registerAction(<button className="btn btn-primary" onClick={() => void openCreate()}><i className="ti ti-plus" />{L.newCar}</button>);
    } else { registerAction(null); }
    return () => registerAction(null);
  }, [form, busy, readOnly, user, registerAction, L.newCar]);

  function onOfferChange(v: string) {
    if (v === "__new") { void createNewOffer(); return; }
    const oid = v === "" ? "" : Number(v);
    const list = carOffers ?? offersCache.current ?? [];
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
      const res = await apiCreateOffer(token, { company_id: Number(companies[0]!.id), type: "car", title: "Car rental draft", price: 0, currency: "USD" });
      offersCache.current = null;
      const offers = await ensureOffers();
      setCarOffers(offers);
      const created = res.data;
      if (created) setForm((p) => (p ? { ...p, offer_id: created.id, company_id: created.company_id != null ? Number(created.company_id) : "" } : p));
    } catch (e) { setFormErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleSubmit() {
    if (!token || !form) return;
    setFormErr(null); setFieldErrs(null);
    const isCreate = editId == null;
    const local = validateCarForm(form, isCreate);
    if (local) { setFieldErrs(local); setFormErr("Fix validation errors below."); return; }
    setBusy(true);
    try {
      if (editId != null) await apiUpdateCar(token, editId, { ...buildUpdatePayload(form), custom_fields: customFields });
      else await apiCreateCar(token, { ...buildCreatePayload(form), custom_fields: customFields });
      closeForm(); showToast(s.save); await load();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) setFieldErrs(e.body.errors as FieldErrors);
      setFormErr(e instanceof ApiRequestError ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  async function handleDelete(r: CarRow) {
    if (!token) return;
    const ok = await confirm({ message: L.deleteConfirm, variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try { await apiDeleteCar(token, r.id); showToast(s.delete); await load(); }
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

  function set<K extends keyof CarFormState>(key: K, val: CarFormState[K]) { setForm((p) => (p ? { ...p, [key]: val } : p)); }
  function setAdv(patch: Partial<CarFormState["advanced_options"]>) { setForm((p) => (p ? { ...p, advanced_options: { ...p.advanced_options, ...patch } } : p)); }
  function setPricing(patch: Partial<CarFormState["advanced_options"]["pricing_rules"]>) {
    setForm((p) => (p ? { ...p, advanced_options: { ...p.advanced_options, pricing_rules: { ...p.advanced_options.pricing_rules, ...patch } } } : p));
  }
  const numOrEmpty = (v: string): number | "" => (v === "" ? "" : Number(v));

  if (forbidden) return <div className="card"><div className="card-body"><ForbiddenNotice /></div></div>;

  // ── FORM ─────────────────────────────────────────────────────────
  if (form) {
    const isEdit = editId != null;
    const adv = form.advanced_options;
    const pr = adv.pricing_rules;
    const offerList = carOffers ?? offersCache.current ?? [];
    return (
      <div>
        <button className="btn btn-ghost detail-back" onClick={closeForm}><i className="ti ti-arrow-left" />{L.back}</button>
        <div className="detail-head">
          <div className="detail-logo"><i className="ti ti-steering-wheel" /></div>
          <div><div className="detail-title">{[form.brand, form.model].filter(Boolean).join(" ") || L.newCar}</div><div className="detail-meta"><span className="font-mono">{isEdit ? `#${editId}` : "—"}</span></div></div>
          <div className="detail-head-right">{isEdit && editStatus && <span className={`badge ${statusBadgeClass(editStatus)}`}>{editStatus}</span>}</div>
        </div>

        <div className="card"><div className="card-body">
          <div className="form-section"><i className="ti ti-photo" />{L.secImageLoc}</div>
          <div className="form-grid">
            <div className="fld span-2"><label className="fld-label">{L.mainImage}</label><ImageUploadField value={form.main_image} onChange={(v) => set("main_image", v)} section="cars" label="" /></div>
            <div className="fld span-2"><label className="fld-label">{L.shortDesc}</label><textarea rows={2} value={form.short_description} onChange={(e) => set("short_description", e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{L.latitude}</label><input type="text" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{L.longitude}</label><input type="text" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} /></div>
          </div>

          <div className="form-section"><i className="ti ti-building" />{L.secOffer}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.offer} <span style={{ color: "var(--danger)" }}>*</span></label>
              <select value={String(form.offer_id)} disabled={isEdit} onChange={(e) => onOfferChange(e.target.value)}>
                <option value="">{L.selectOffer}</option>
                {offerList.map((o) => <option key={o.id} value={o.id}>{`#${o.id} · ${o.title ?? "—"}`}</option>)}
                {!isEdit && <option value="__new">{L.autoCreate}</option>}
              </select>
            </div>
            <div className="fld"><label className="fld-label">{L.company} <span style={{ color: "var(--danger)" }}>*</span></label><input type="text" value={form.company_id === "" ? "" : String(form.company_id)} readOnly /></div>
            <div className="fld span-2"><label className="fld-label">{L.location}</label>
              <LocationCascadeSelect token={token} value={form.location_id === "" ? null : Number(form.location_id)} label="" onChange={(id) => set("location_id", id ?? "")} /></div>
          </div>

          <div className="form-section"><i className="ti ti-route" />{L.secRoute}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.pickup} <span style={{ color: "var(--danger)" }}>*</span></label><input type="text" value={form.pickup_location} onChange={(e) => set("pickup_location", e.target.value)} placeholder="Yerevan Airport" /></div>
            <div className="fld"><label className="fld-label">{L.dropoff} <span style={{ color: "var(--danger)" }}>*</span></label><input type="text" value={form.dropoff_location} onChange={(e) => set("dropoff_location", e.target.value)} placeholder="Yerevan Airport" /></div>
          </div>

          <div className="form-section"><i className="ti ti-car" />{L.secVehicle}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.vehClass} <span style={{ color: "var(--danger)" }}>*</span></label><input type="text" value={form.vehicle_class} onChange={(e) => set("vehicle_class", e.target.value)} placeholder="economy" /></div>
            <div className="fld"><label className="fld-label">{L.vehType}</label><input type="text" value={form.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)} placeholder="sedan" /></div>
            <div className="fld"><label className="fld-label">{L.brand}</label><input type="text" value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Hyundai" /></div>
            <div className="fld"><label className="fld-label">{L.model}</label><input type="text" value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="Accent" /></div>
            <div className="fld"><label className="fld-label">{L.year}</label><input type="number" min={1900} max={2100} value={form.year} onChange={(e) => set("year", numOrEmpty(e.target.value))} placeholder="2023" /></div>
            <div className="fld"><label className="fld-label">{L.transmission}</label><input type="text" value={form.transmission_type} onChange={(e) => set("transmission_type", e.target.value)} placeholder="automatic" /></div>
            <div className="fld"><label className="fld-label">{L.fuel}</label><input type="text" value={form.fuel_type} onChange={(e) => set("fuel_type", e.target.value)} placeholder="gasoline" /></div>
            <div className="fld"><label className="fld-label">{L.fleet}</label><input type="text" value={form.fleet} onChange={(e) => set("fleet", e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{L.category}</label><input type="text" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="compact" /></div>
          </div>

          <div className="form-section"><i className="ti ti-briefcase" />{L.secCapacity}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.seats}</label><input type="number" min={1} max={255} value={form.seats} onChange={(e) => set("seats", numOrEmpty(e.target.value))} placeholder="5" /></div>
            <div className="fld"><label className="fld-label">{L.suitcases}</label><input type="number" min={0} max={255} value={form.suitcases} onChange={(e) => set("suitcases", numOrEmpty(e.target.value))} placeholder="2" /></div>
            <div className="fld"><label className="fld-label">{L.smallBag}</label><input type="number" min={0} max={255} value={form.small_bag} onChange={(e) => set("small_bag", numOrEmpty(e.target.value))} placeholder="2" /></div>
          </div>

          <div className="form-section"><i className="ti ti-cash" />{L.secPricing}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.pricingMode}</label><select value={form.pricing_mode} onChange={(e) => set("pricing_mode", e.target.value)}><option value="">—</option>{CAR_PRICING_MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
            <div className="fld"><label className="fld-label">{L.basePrice}</label><input type="number" step={0.01} min={0} value={form.base_price} onChange={(e) => set("base_price", numOrEmpty(e.target.value))} placeholder="45.00" /><span className="fld-hint">{L.basePriceHint}</span></div>
          </div>

          <div className="form-section"><i className="ti ti-calendar-stats" />{L.secStatus}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.availStart}</label><input type="datetime-local" value={form.availability_window_start} onChange={(e) => set("availability_window_start", e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{L.availEnd}</label><input type="datetime-local" value={form.availability_window_end} onChange={(e) => set("availability_window_end", e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{L.status}</label><select value={form.status} onChange={(e) => set("status", e.target.value)}><option value="">—</option>{CAR_OPERATIONAL_STATUSES.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
            <div className="fld"><label className="fld-label">{L.availStatus}</label><select value={form.availability_status} onChange={(e) => set("availability_status", e.target.value)}><option value="">—</option>{CAR_AVAILABILITY_STATUSES.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
          </div>
        </div></div>

        {/* Advanced options */}
        <div className="card"><div className="card-body">
          <div className="form-section"><i className="ti ti-settings-2" />{L.secAdvOpt}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.childSeatsAvail}</label>
              <select value={String(adv.child_seats.available)} onChange={(e) => setAdv({ child_seats: { ...adv.child_seats, available: e.target.value === "true" } })}><option value="false">false</option><option value="true">true</option></select></div>
            {adv.child_seats.available && (
              <div className="fld"><label className="fld-label">{L.childSeatTypes}</label>
                <div className="ms-group">{CAR_CHILD_SEAT_TYPES.map((tt) => {
                  const on = adv.child_seats.types.includes(tt);
                  return <label key={tt} className={`mchip ${on ? "on" : ""}`}><input type="checkbox" checked={on} onChange={(e) => setAdv({ child_seats: { ...adv.child_seats, types: e.target.checked ? [...adv.child_seats.types, tt] : adv.child_seats.types.filter((x) => x !== tt) } })} />{tt}</label>;
                })}</div></div>
            )}
            <div className="fld"><label className="fld-label">{L.addSuitcases}</label><input type="number" min={0} max={255} value={adv.extra_luggage.additional_suitcases_max} onChange={(e) => setAdv({ extra_luggage: { ...adv.extra_luggage, additional_suitcases_max: Number(e.target.value || 0) } })} /></div>
            <div className="fld"><label className="fld-label">{L.addSmallBags}</label><input type="number" min={0} max={255} value={adv.extra_luggage.additional_small_bags_max} onChange={(e) => setAdv({ extra_luggage: { ...adv.extra_luggage, additional_small_bags_max: Number(e.target.value || 0) } })} /></div>
            <div className="fld span-2"><label className="fld-label">{L.extraLugNotes}</label><textarea rows={2} maxLength={500} value={adv.extra_luggage.notes ?? ""} onChange={(e) => setAdv({ extra_luggage: { ...adv.extra_luggage, notes: e.target.value || null } })} /></div>
            <div className="fld span-2"><label className="fld-label">{L.services}</label>
              <div className="ms-group">{CAR_SERVICE_KEYS.map((k) => {
                const on = adv.services.includes(k);
                return <label key={k} className={`mchip ${on ? "on" : ""}`}><input type="checkbox" checked={on} onChange={(e) => setAdv({ services: e.target.checked ? [...adv.services, k] : adv.services.filter((x) => x !== k) })} />{k}</label>;
              })}</div></div>
            <div className="fld span-2"><label className="fld-label">{L.driverLangs}</label>
              <div className="ms-group">{DRIVER_LANG_PRESETS.map((c) => {
                const on = adv.driver_languages.includes(c);
                return <label key={c} className={`mchip ${on ? "on" : ""}`}><input type="checkbox" checked={on} onChange={(e) => setAdv({ driver_languages: e.target.checked ? [...adv.driver_languages, c] : adv.driver_languages.filter((x) => x !== c) })} />{c}</label>;
              })}</div></div>
          </div>

          <div className="form-section"><i className="ti ti-adjustments-dollar" />{L.secAdvPrice}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.mileageMode}</label><select value={pr.mileage.mode} onChange={(e) => setPricing({ mileage: { ...pr.mileage, mode: e.target.value as typeof pr.mileage.mode } })}>{["unlimited", "limited"].map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
            {pr.mileage.mode === "limited" && (<>
              <div className="fld"><label className="fld-label">{L.includedKm}</label><input type="number" min={1} value={pr.mileage.included_km_per_rental ?? ""} onChange={(e) => setPricing({ mileage: { ...pr.mileage, included_km_per_rental: e.target.value === "" ? null : Number(e.target.value) } })} /></div>
              <div className="fld"><label className="fld-label">{L.extraKm}</label><input type="number" min={0} step={0.01} value={pr.mileage.extra_km_price ?? ""} onChange={(e) => setPricing({ mileage: { ...pr.mileage, extra_km_price: e.target.value === "" ? null : Number(e.target.value) } })} /></div>
            </>)}
            <div className="fld"><label className="fld-label">{L.crossBorder}</label><select value={pr.cross_border.policy} onChange={(e) => setPricing({ cross_border: { ...pr.cross_border, policy: e.target.value as typeof pr.cross_border.policy } })}>{CAR_CROSS_BORDER_POLICIES.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
            {(pr.cross_border.policy === "surcharge_fixed" || pr.cross_border.policy === "surcharge_daily") && (
              <div className="fld"><label className="fld-label">{L.borderSurcharge}</label><input type="number" min={0} step={0.01} value={pr.cross_border.surcharge_amount ?? ""} onChange={(e) => setPricing({ cross_border: { ...pr.cross_border, surcharge_amount: e.target.value === "" ? null : Number(e.target.value) } })} /></div>
            )}
            <div className="fld"><label className="fld-label">{L.serviceRadius}</label><input type="number" min={1} value={pr.radius.service_radius_km ?? ""} onChange={(e) => setPricing({ radius: { ...pr.radius, service_radius_km: e.target.value === "" ? null : Number(e.target.value) } })} /></div>
            {pr.radius.service_radius_km != null && pr.radius.service_radius_km > 0 && (<>
              <div className="fld"><label className="fld-label">{L.outMode}</label><select value={pr.radius.out_of_radius_mode} onChange={(e) => setPricing({ radius: { ...pr.radius, out_of_radius_mode: e.target.value as typeof pr.radius.out_of_radius_mode } })}>{CAR_OUT_OF_RADIUS_MODES_WITH_RADIUS.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
              {pr.radius.out_of_radius_mode === "flat_fee" && <div className="fld"><label className="fld-label">{L.outFlat}</label><input type="number" min={0} step={0.01} value={pr.radius.out_of_radius_flat_fee ?? ""} onChange={(e) => setPricing({ radius: { ...pr.radius, out_of_radius_flat_fee: e.target.value === "" ? null : Number(e.target.value) } })} /></div>}
              {pr.radius.out_of_radius_mode === "per_km" && <div className="fld"><label className="fld-label">{L.outPerKm}</label><input type="number" min={0} step={0.01} value={pr.radius.out_of_radius_per_km ?? ""} onChange={(e) => setPricing({ radius: { ...pr.radius, out_of_radius_per_km: e.target.value === "" ? null : Number(e.target.value) } })} /></div>}
            </>)}
          </div>
        </div></div>

        {/* Custom fields */}
        <div className="card"><div className="card-body">
          <div className="form-section"><i className="ti ti-adjustments" />{L.secCustom}</div>
          <CustomFieldsRenderer scope="car" values={customFields} onChange={setCustomFields} />
        </div></div>

        {(formErr || fieldErrs) && (
          <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)", flexDirection: "column", alignItems: "stretch" }}>
            {formErr && <div>{formErr}</div>}
            {fieldErrs && Object.entries(fieldErrs).map(([f, msgs]) => <div key={f}>{f}: {msgs.join(" ")}</div>)}
          </div>
        )}

        <div className="card"><div className="card-foot">
          <button className="btn btn-ghost" onClick={closeForm}>{s.cancel}</button>
          {isEdit && submittable(editStatus) && form.offer_id !== "" && (
            <button className="btn" disabled={busy} onClick={() => void handleSubmitForReview(Number(form.offer_id))}><i className="ti ti-send" />{s.hSubmitReview}</button>
          )}
          <button className="btn btn-primary" disabled={busy} onClick={() => void handleSubmit()}><i className="ti ti-check" />{busy ? s.saving : L.save}</button>
        </div></div>
      </div>
    );
  }

  // ── LIST ─────────────────────────────────────────────────────────
  const shown = rows.filter((r) =>
    (!fPickup || (r.pickup_location ?? "").toLowerCase().includes(fPickup.toLowerCase())) &&
    (!fStatus || (r.offer?.status ?? r.status) === fStatus)
  );
  const total = meta?.total ?? shown.length;
  const active = rows.filter((r) => (r.offer?.status ?? r.status) === "active" || (r.offer?.status ?? r.status) === "published").length;
  const pending = rows.filter((r) => (r.offer?.status ?? r.status) === "pending_review").length;
  const from = shown.length ? (page - 1) * 20 + 1 : 0;
  const to = (page - 1) * 20 + shown.length;

  return (
    <div>
      {readOnly && <div className="alert oversight-note"><i className="ti ti-eye" /><div>{s.oversightBanner}</div></div>}
      <div className="filter-card">
        {readOnly && <div className="filter-field"><span className="filter-label">{s.company}</span><input type="text" placeholder={s.company} /></div>}
        <div className="filter-field" style={{ flex: 2 }}><span className="filter-label">{L.pickup}</span><input type="text" value={fPickup} onChange={(e) => setFPickup(e.target.value)} placeholder="Yerevan" /></div>
        <div className="filter-field"><span className="filter-label">{s.status}</span>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">{s.all}</option>{["draft", "published", "archived", "suspended", "pending_review"].map((o) => <option key={o} value={o}>{o}</option>)}</select>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-steering-wheel" /></div><div className="stat-value">{total}</div><div className="stat-label">{s.statTotal}</div></div>
        <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-circle-check" /></div><div className="stat-value">{active}</div><div className="stat-label">{s.statActive}</div></div>
        <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-clock" /></div><div className="stat-value">{pending}</div><div className="stat-label">{s.statPending}</div></div>
        <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-car" /></div><div className="stat-value">{rows.length}</div><div className="stat-label">{s.tabCars}</div></div>
      </div>
      {err && <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}><i className="ti ti-alert-triangle" /><div>{err}</div></div>}
      <div className="card">
        <div className="card-header"><div><div className="card-title">{s.tabCars}</div><div className="card-subtitle">One car per offer · base_price synced to offer.price.</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{s.id}</th><th>{s.company}</th><th>{L.pickup}</th><th>{L.dropoff}</th><th>{L.vehClass}</th><th>{s.tabOffers}</th><th>{s.status}</th><th style={{ textAlign: "right" }}>{s.actions}</th></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={8} className="no-label" style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>{s.empty}</td></tr>}
              {shown.map((r) => {
                const ost = r.offer?.status ?? r.status ?? "";
                return (
                  <tr key={r.id} onClick={() => !readOnly && openEdit(r)}>
                    <td className="font-mono m-primary" data-label={s.id}>#{r.id}</td>
                    <td data-label={s.company}>{r.company_id ?? r.offer?.company_id ?? "—"}</td>
                    <td data-label={L.pickup}>{r.pickup_location ?? "—"}</td>
                    <td data-label={L.dropoff}>{r.dropoff_location ?? "—"}</td>
                    <td data-label={L.vehClass}><span className="type-badge">{r.vehicle_class ?? "—"}</span></td>
                    <td data-label={s.tabOffers}>{r.offer?.title ?? "—"}</td>
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
