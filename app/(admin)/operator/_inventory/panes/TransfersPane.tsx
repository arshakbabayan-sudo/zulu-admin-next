"use client";

/**
 * Transfers pane — 1:1 port of #pane-transfers in inventory.html.
 *
 * 6-step wizard (General · Route · Vehicle · Pricing · Publication · Review),
 * field-driven from the existing transfer-field-adapter / transfer-ui modules.
 * Booleans render as true/false selects (per the mock spec). Origin/destination
 * use LocationCascadeSelect (auto-fill country/city). Custom fields (scope=
 * transfer) + a translations note live in the Review step.
 *
 * Wiring: apiTransfers / apiGetTransfer / apiCreateTransfer / apiUpdateTransfer
 * / apiDeleteTransfer (these build the body internally from the form) +
 * validateTransferOperatorStep + transferFormFromRow + emptyTransferOperatorForm.
 */

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiTransfers,
  apiGetTransfer,
  apiCreateTransfer,
  apiUpdateTransfer,
  apiDeleteTransfer,
  apiCustomFieldValues,
  type TransferRow,
} from "@/lib/inventory-crud-api";
import {
  emptyTransferOperatorForm,
  transferFormFromRow,
  type TransferFormValues,
} from "@/lib/transfers/transfer-field-adapter";
import {
  TRANSFER_OPERATOR_WIZARD_STEPS,
  validateTransferOperatorStep,
  type TransferOperatorWizardStep,
} from "@/lib/transfers/transfer-ui";
import { apiSubmitOfferForReview } from "@/lib/platform-admin-api";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { CustomFieldsRenderer } from "@/components/CustomFieldsRenderer";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { userHasPermission } from "@/lib/access";
import { inventoryStrings } from "../inventory-i18n";
import type { InventoryPaneProps } from "../types";

type FType = "text" | "number" | "date" | "time" | "datetime-local" | "select" | "boolean";
type FMeta = { type: FType; required?: boolean; options?: string[] };

const POINT_TYPES = ["airport", "hotel", "address", "station", "port", "landmark"];
const META: Partial<Record<keyof TransferFormValues, FMeta>> = {
  offer_id: { type: "number", required: true },
  transfer_title: { type: "text", required: true },
  transfer_type: { type: "select", required: true, options: ["airport_transfer", "hotel_transfer", "city_transfer", "private_transfer", "shared_transfer", "intercity_transfer"] },
  service_date: { type: "date", required: true },
  pickup_time: { type: "time", required: true },
  estimated_duration_minutes: { type: "number", required: true },
  pickup_country: { type: "text", required: true },
  pickup_city: { type: "text", required: true },
  pickup_point_type: { type: "select", required: true, options: POINT_TYPES },
  pickup_point_name: { type: "text", required: true },
  dropoff_country: { type: "text", required: true },
  dropoff_city: { type: "text", required: true },
  dropoff_point_type: { type: "select", required: true, options: POINT_TYPES },
  dropoff_point_name: { type: "text", required: true },
  route_label: { type: "text" },
  route_distance_km: { type: "number" },
  pickup_latitude: { type: "number" },
  pickup_longitude: { type: "number" },
  dropoff_latitude: { type: "number" },
  dropoff_longitude: { type: "number" },
  availability_window_start: { type: "datetime-local" },
  availability_window_end: { type: "datetime-local" },
  vehicle_category: { type: "select", required: true, options: ["sedan", "suv", "minivan", "minibus", "bus", "luxury_car"] },
  vehicle_class: { type: "text" },
  private_or_shared: { type: "select", options: ["", "private", "shared"] },
  passenger_capacity: { type: "number", required: true },
  luggage_capacity: { type: "number", required: true },
  minimum_passengers: { type: "number", required: true },
  maximum_passengers: { type: "number", required: true },
  maximum_luggage: { type: "number" },
  child_seat_available: { type: "boolean", required: true },
  child_seat_required_rule: { type: "text" },
  accessibility_support: { type: "boolean", required: true },
  special_assistance_supported: { type: "boolean", required: true },
  pricing_mode: { type: "select", required: true, options: ["per_vehicle", "per_person"] },
  base_price: { type: "number", required: true },
  free_cancellation: { type: "boolean", required: true },
  cancellation_policy_type: { type: "select", required: true, options: ["non_refundable", "partially_refundable", "fully_refundable"] },
  cancellation_deadline_at: { type: "datetime-local" },
  availability_status: { type: "select", required: true, options: ["available", "unavailable"] },
  bookable: { type: "boolean", required: true },
  is_package_eligible: { type: "boolean", required: true },
  status: { type: "select", required: true, options: ["draft", "active", "inactive", "archived"] },
  visibility_rule: { type: "select", required: true, options: ["show_all", "show_accepted_only", "hide_rejected"] },
  appears_in_web: { type: "boolean", required: true },
  appears_in_admin: { type: "boolean", required: true },
  appears_in_zulu_admin: { type: "boolean", required: true },
};

const STEP_LAYOUT: Record<Exclude<TransferOperatorWizardStep, "review">, (keyof TransferFormValues)[]> = {
  general: ["transfer_title", "transfer_type", "service_date", "pickup_time", "estimated_duration_minutes"],
  route: ["pickup_country", "pickup_city", "pickup_point_type", "pickup_point_name", "dropoff_country", "dropoff_city", "dropoff_point_type", "dropoff_point_name", "route_label", "route_distance_km", "pickup_latitude", "pickup_longitude", "dropoff_latitude", "dropoff_longitude", "availability_window_start", "availability_window_end"],
  vehicle: ["vehicle_category", "vehicle_class", "private_or_shared", "passenger_capacity", "luggage_capacity", "minimum_passengers", "maximum_passengers", "maximum_luggage", "child_seat_available", "child_seat_required_rule", "accessibility_support", "special_assistance_supported"],
  pricing: ["pricing_mode", "base_price", "free_cancellation", "cancellation_policy_type", "cancellation_deadline_at"],
  publication: ["availability_status", "bookable", "is_package_eligible", "status", "visibility_rule", "appears_in_web", "appears_in_admin", "appears_in_zulu_admin"],
};

// trilingual field + section labels (Armenian-first), local to this pane.
function trLab(lang: string): Record<string, string> {
  const en: Record<string, string> = {
    secMeta: "Metadata & marketing", secGeneral: "General", secRoute: "Route & location", secVehicle: "Vehicle & capacity",
    secPricing: "Pricing & policies", secPublication: "Availability & publication", secCustom: "Custom fields",
    stepGeneral: "General", stepRoute: "Route", stepVehicle: "Vehicle", stepPricing: "Pricing", stepPublication: "Publication", stepReview: "Review",
    originLocation: "Origin location", destLocation: "Destination location", currencyRO: "Currency (read-only from offer)", mainImage: "Main image URL", shortDesc: "Short description",
    offer_id: "Offer ID", transfer_title: "Transfer title", transfer_type: "Transfer type", service_date: "Service date", pickup_time: "Pickup time", estimated_duration_minutes: "Estimated duration (min)",
    pickup_country: "Pickup country", pickup_city: "Pickup city", pickup_point_type: "Pickup point type", pickup_point_name: "Pickup point name",
    dropoff_country: "Dropoff country", dropoff_city: "Dropoff city", dropoff_point_type: "Dropoff point type", dropoff_point_name: "Dropoff point name",
    route_label: "Route label", route_distance_km: "Route distance (km)", pickup_latitude: "Pickup latitude", pickup_longitude: "Pickup longitude", dropoff_latitude: "Dropoff latitude", dropoff_longitude: "Dropoff longitude",
    availability_window_start: "Availability window start", availability_window_end: "Availability window end",
    vehicle_category: "Vehicle category", vehicle_class: "Vehicle class", private_or_shared: "Private / shared", passenger_capacity: "Passenger capacity", luggage_capacity: "Luggage capacity",
    minimum_passengers: "Minimum passengers", maximum_passengers: "Maximum passengers", maximum_luggage: "Maximum luggage", child_seat_available: "Child seat available", child_seat_required_rule: "Child seat required rule",
    accessibility_support: "Accessibility support", special_assistance_supported: "Special assistance supported",
    pricing_mode: "Pricing mode", base_price: "Base price", free_cancellation: "Free cancellation", cancellation_policy_type: "Cancellation policy type", cancellation_deadline_at: "Cancellation deadline",
    availability_status: "Availability status", bookable: "Bookable online", is_package_eligible: "Package eligible", status: "Lifecycle status", visibility_rule: "Visibility rule",
    appears_in_web: "Visible on web", appears_in_admin: "Visible in admin", appears_in_zulu_admin: "Visible in zulu admin",
  };
  const hy: Record<string, string> = {
    secMeta: "Մետատվյալներ և մարքեթինգ", secGeneral: "Ընդհանուր", secRoute: "Երթուղի և տեղ", secVehicle: "Մեքենա և տարողություն",
    secPricing: "Գին և կանոններ", secPublication: "Հասանելիություն և հրապարակում", secCustom: "Հատուկ դաշտեր",
    stepGeneral: "Ընդհանուր", stepRoute: "Երթուղի", stepVehicle: "Մեքենա", stepPricing: "Գին", stepPublication: "Հրապարակում", stepReview: "Վերանայում",
    originLocation: "Մեկնման վայր", destLocation: "Նպատակակետի վայր", currencyRO: "Արժույթ (առաջարկից, միայն ցուցադրում)", mainImage: "Հիմնական նկարի հղում", shortDesc: "Կարճ նկարագրություն",
    offer_id: "Առաջարկի ID", transfer_title: "Տրանսֆերի վերնագիր", transfer_type: "Տրանսֆերի տեսակ", service_date: "Ծառայության ամսաթիվ", pickup_time: "Վերցնելու ժամ", estimated_duration_minutes: "Մոտավոր տևողություն (րոպե)",
    pickup_country: "Վերցնելու երկիր", pickup_city: "Վերցնելու քաղաք", pickup_point_type: "Վերցնելու կետի տեսակ", pickup_point_name: "Վերցնելու կետի անուն",
    dropoff_country: "Հասցնելու երկիր", dropoff_city: "Հասցնելու քաղաք", dropoff_point_type: "Հասցնելու կետի տեսակ", dropoff_point_name: "Հասցնելու կետի անուն",
    route_label: "Երթուղու պիտակ", route_distance_km: "Երթուղու երկարություն (կմ)", pickup_latitude: "Վերցնելու լայնություն", pickup_longitude: "Վերցնելու երկայնություն", dropoff_latitude: "Հասցնելու լայնություն", dropoff_longitude: "Հասցնելու երկայնություն",
    availability_window_start: "Հասանելիության սկիզբ", availability_window_end: "Հասանելիության վերջ",
    vehicle_category: "Մեքենայի կարգ", vehicle_class: "Մեքենայի դաս", private_or_shared: "Անհատական / համատեղ", passenger_capacity: "Ուղևորատարողություն", luggage_capacity: "Ուղեբեռի տարողություն",
    minimum_passengers: "Նվազ. ուղևոր", maximum_passengers: "Առավ. ուղևոր", maximum_luggage: "Առավ. ուղեբեռ", child_seat_available: "Մանկական աթոռ կա", child_seat_required_rule: "Մանկական աթոռի կանոն",
    accessibility_support: "Հաշմանդամության աջակցություն", special_assistance_supported: "Հատուկ աջակցություն",
    pricing_mode: "Գնի ռեժիմ", base_price: "Հիմնական գին", free_cancellation: "Անվճար չեղարկում", cancellation_policy_type: "Չեղարկման կանոնի տեսակ", cancellation_deadline_at: "Չեղարկման վերջնաժամկետ",
    availability_status: "Հասանելիության կարգավիճակ", bookable: "Առցանց ամրագրելի", is_package_eligible: "Փաթեթին հարմար", status: "Կենսացիկլի կարգավիճակ", visibility_rule: "Տեսանելիության կանոն",
    appears_in_web: "Երևում է կայքում", appears_in_admin: "Երևում է ադմինում", appears_in_zulu_admin: "Երևում է zulu ադմինում",
  };
  const ru: Record<string, string> = {
    secMeta: "Метаданные и маркетинг", secGeneral: "Общее", secRoute: "Маршрут и локация", secVehicle: "Авто и вместимость",
    secPricing: "Цены и правила", secPublication: "Доступность и публикация", secCustom: "Доп. поля",
    stepGeneral: "Общее", stepRoute: "Маршрут", stepVehicle: "Авто", stepPricing: "Цены", stepPublication: "Публикация", stepReview: "Проверка",
    originLocation: "Локация отправления", destLocation: "Локация назначения", currencyRO: "Валюта (из предложения, только показ)", mainImage: "Ссылка на изображение", shortDesc: "Краткое описание",
    offer_id: "ID предложения", transfer_title: "Название трансфера", transfer_type: "Тип трансфера", service_date: "Дата услуги", pickup_time: "Время подачи", estimated_duration_minutes: "Примерная длительность (мин)",
    pickup_country: "Страна подачи", pickup_city: "Город подачи", pickup_point_type: "Тип точки подачи", pickup_point_name: "Название точки подачи",
    dropoff_country: "Страна высадки", dropoff_city: "Город высадки", dropoff_point_type: "Тип точки высадки", dropoff_point_name: "Название точки высадки",
    route_label: "Метка маршрута", route_distance_km: "Расстояние (км)", pickup_latitude: "Широта подачи", pickup_longitude: "Долгота подачи", dropoff_latitude: "Широта высадки", dropoff_longitude: "Долгота высадки",
    availability_window_start: "Начало окна доступности", availability_window_end: "Конец окна доступности",
    vehicle_category: "Категория авто", vehicle_class: "Класс авто", private_or_shared: "Индивид. / совместный", passenger_capacity: "Вместимость пассажиров", luggage_capacity: "Вместимость багажа",
    minimum_passengers: "Мин. пассажиров", maximum_passengers: "Макс. пассажиров", maximum_luggage: "Макс. багаж", child_seat_available: "Есть детское кресло", child_seat_required_rule: "Правило детского кресла",
    accessibility_support: "Доступная среда", special_assistance_supported: "Спец. сопровождение",
    pricing_mode: "Режим цены", base_price: "Базовая цена", free_cancellation: "Бесплатная отмена", cancellation_policy_type: "Тип правила отмены", cancellation_deadline_at: "Крайний срок отмены",
    availability_status: "Статус доступности", bookable: "Доступно онлайн", is_package_eligible: "Подходит для пакета", status: "Статус жизн. цикла", visibility_rule: "Правило видимости",
    appears_in_web: "Видно на сайте", appears_in_admin: "Видно в админке", appears_in_zulu_admin: "Видно в zulu-админке",
  };
  return lang === "hy" ? hy : lang === "ru" ? ru : en;
}

function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "active": return "badge-success";
    case "pending_review": return "badge-warning";
    case "draft": case "inactive": return "badge-gray";
    case "archived": case "rejected": return "badge-danger";
    default: return "badge-gray";
  }
}
function submittable(status: string | null | undefined): boolean {
  return status === "draft" || status === "rejected" || status === "changes_requested";
}

export function TransfersPane({ token, user, lang, scope, registerAction, showToast }: InventoryPaneProps) {
  const s = inventoryStrings(lang);
  const lab = trLab(lang);
  const confirm = useConfirm();
  const readOnly = scope === "oversight";

  const [rows, setRows] = useState<TransferRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [fTitle, setFTitle] = useState("");
  const [fStatus, setFStatus] = useState("");

  const [form, setForm] = useState<TransferFormValues | null>(null);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [editId, setEditId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [step, setStep] = useState<TransferOperatorWizardStep>("general");
  const [busy, setBusy] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrLines, setFormErrLines] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiTransfers(token, { page, per_page: 20 });
      setRows(res.data); setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditId(null); setEditStatus(null);
    setForm(emptyTransferOperatorForm()); setCustomFields({}); setStep("general"); setFormErrLines([]);
  }
  const openEdit = useCallback(async (r: TransferRow) => {
    if (!token) return;
    setEditId(r.id); setEditStatus(r.offer?.status ?? null);
    setForm(null); setCustomFields({}); setStep("general"); setFormLoading(true); setFormErrLines([]);
    try {
      const res = await apiGetTransfer(token, r.id);
      setForm(transferFormFromRow(res.data));
      setCustomFields(await apiCustomFieldValues(token, "transfer", r.id).catch(() => ({})));
    } catch (e) {
      setEditId(null);
      setErr(e instanceof ApiRequestError ? e.message : "Failed");
    } finally { setFormLoading(false); }
  }, [token]);

  function closeForm() { setForm(null); setEditId(null); setFormErrLines([]); setFormLoading(false); }

  useEffect(() => {
    if (form === null && !formLoading && !readOnly && userHasPermission(user, "transfers.create")) {
      registerAction(<button className="btn btn-primary" onClick={openCreate}><i className="ti ti-plus" />{s.tabTransfers}</button>);
    } else { registerAction(null); }
    return () => registerAction(null);
  }, [form, formLoading, readOnly, user, registerAction, s.tabTransfers]);

  async function handleSubmit() {
    if (!token || !form) return;
    const mode = editId != null ? "edit" : "create";
    const allErrs: string[] = [];
    for (const st of TRANSFER_OPERATOR_WIZARD_STEPS) allErrs.push(...validateTransferOperatorStep(form, st.key, mode));
    if (allErrs.length > 0) { setFormErrLines([...new Set(allErrs)]); return; }
    setBusy(true); setFormErrLines([]);
    try {
      const payload = { ...form, custom_fields: customFields } as Parameters<typeof apiCreateTransfer>[1];
      if (editId != null) await apiUpdateTransfer(token, editId, payload);
      else await apiCreateTransfer(token, payload);
      closeForm(); showToast(s.save); await load();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) {
        setFormErrLines(Object.values(e.body.errors).flat().map(String));
      } else setFormErrLines([e instanceof ApiRequestError ? e.message : "Failed"]);
    } finally { setBusy(false); }
  }

  async function handleDelete(r: TransferRow) {
    if (!token) return;
    const ok = await confirm({ message: s.delete + "?", variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try { await apiDeleteTransfer(token, r.id); showToast(s.delete); await load(); }
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

  function setF(key: keyof TransferFormValues, val: unknown) {
    setForm((p) => (p ? { ...p, [key]: val } : p));
  }

  function renderField(key: keyof TransferFormValues) {
    if (!form) return null;
    const m = META[key];
    if (!m) return null;
    const label = lab[key] ?? key;
    const req = m.required ? <span style={{ color: "var(--danger)" }}>*</span> : null;
    const v = form[key];
    if (m.type === "boolean") {
      return (
        <div className="fld" key={key}><label className="fld-label">{label} {req}</label>
          <select value={String(Boolean(v))} onChange={(e) => setF(key, e.target.value === "true")}><option value="true">true</option><option value="false">false</option></select>
        </div>
      );
    }
    if (m.type === "select") {
      return (
        <div className="fld" key={key}><label className="fld-label">{label} {req}</label>
          <select value={String(v ?? "")} onChange={(e) => setF(key, e.target.value)}>{(m.options ?? []).map((o) => <option key={o} value={o}>{o || "—"}</option>)}</select>
        </div>
      );
    }
    const inputType = m.type === "number" ? "number" : m.type;
    return (
      <div className="fld" key={key}><label className="fld-label">{label} {req}</label>
        <input type={inputType} value={v == null ? "" : String(v)}
          onChange={(e) => setF(key, m.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />
      </div>
    );
  }

  if (forbidden) return <div className="card"><div className="card-body"><ForbiddenNotice /></div></div>;
  if (formLoading) return <div className="card"><div className="card-body" style={{ textAlign: "center", color: "var(--text-secondary)", padding: 32 }}>{s.loading}</div></div>;

  // ── WIZARD ───────────────────────────────────────────────────────
  if (form) {
    const isEdit = editId != null;
    const stepIdx = TRANSFER_OPERATOR_WIZARD_STEPS.findIndex((x) => x.key === step);
    const isLast = stepIdx === TRANSFER_OPERATOR_WIZARD_STEPS.length - 1;
    const stepLabel = (k: string) => lab[`step${k.charAt(0).toUpperCase()}${k.slice(1)}`] ?? k;
    const goNext = () => { if (!isLast) setStep(TRANSFER_OPERATOR_WIZARD_STEPS[stepIdx + 1]!.key); };
    const goPrev = () => { if (stepIdx > 0) setStep(TRANSFER_OPERATOR_WIZARD_STEPS[stepIdx - 1]!.key); };
    return (
      <div>
        <button className="btn btn-ghost detail-back" onClick={closeForm}><i className="ti ti-arrow-left" />{s.tabTransfers}</button>
        <div className="detail-head">
          <div className="detail-logo"><i className="ti ti-car" /></div>
          <div><div className="detail-title">{form.transfer_title || s.tabTransfers}</div><div className="detail-meta"><span className="font-mono">{isEdit ? `#${editId}` : "—"}</span><span>·</span><span>{lab.currencyRO}: <span className="font-mono">{form.currency}</span></span></div></div>
          <div className="detail-head-right">{isEdit && editStatus && <span className={`badge ${statusBadgeClass(editStatus)}`}>{editStatus}</span>}</div>
        </div>

        <div className="sub-tabs wizard-strip">
          {TRANSFER_OPERATOR_WIZARD_STEPS.map((x, i) => (
            <button key={x.key} className={`sub-tab ${x.key === step ? "active" : i < stepIdx ? "done" : ""}`} onClick={() => setStep(x.key)}>
              <span className="step-no">{i + 1}</span>{stepLabel(x.key)}
            </button>
          ))}
        </div>

        <div className="card"><div className="card-body">
          {step === "general" && (<>
            <div className="form-section"><i className="ti ti-info-circle" />{lab.secMeta}</div>
            <div className="form-grid">
              {!isEdit && (<div className="fld"><label className="fld-label">{lab.offer_id} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" value={form.offer_id ?? ""} onChange={(e) => setF("offer_id", e.target.value === "" ? null : Number(e.target.value))} placeholder="5501" /></div>)}
              <div className="fld"><label className="fld-label">{lab.currencyRO}</label><input type="text" value={form.currency} readOnly /></div>
              <div className="fld span-2"><label className="fld-label">{lab.mainImage}</label><input type="text" value={form.main_image} onChange={(e) => setF("main_image", e.target.value)} placeholder="https://…/transfer.jpg" /></div>
              <div className="fld span-2"><label className="fld-label">{lab.shortDesc}</label><textarea rows={2} value={form.short_description} onChange={(e) => setF("short_description", e.target.value)} /></div>
            </div>
            <div className="form-section"><i className="ti ti-clipboard-text" />{lab.secGeneral}</div>
            <div className="form-grid">{STEP_LAYOUT.general.map(renderField)}</div>
          </>)}

          {step === "route" && (<>
            <div className="form-section"><i className="ti ti-route" />{lab.secRoute}</div>
            <div className="form-grid">
              <div className="fld"><label className="fld-label">{lab.originLocation}</label>
                <LocationCascadeSelect token={token} value={form.origin_location_id === "" ? null : Number(form.origin_location_id)} label=""
                  onChange={(id, m2) => setForm((p) => p ? { ...p, origin_location_id: id ?? "", pickup_country: m2.country?.name ?? p.pickup_country, pickup_city: m2.city?.name ?? p.pickup_city } : p)} /></div>
              <div className="fld"><label className="fld-label">{lab.destLocation}</label>
                <LocationCascadeSelect token={token} value={form.destination_location_id === "" ? null : Number(form.destination_location_id)} label=""
                  onChange={(id, m2) => setForm((p) => p ? { ...p, destination_location_id: id ?? "", dropoff_country: m2.country?.name ?? p.dropoff_country, dropoff_city: m2.city?.name ?? p.dropoff_city } : p)} /></div>
              {STEP_LAYOUT.route.map(renderField)}
            </div>
          </>)}

          {step === "vehicle" && (<>
            <div className="form-section"><i className="ti ti-bus" />{lab.secVehicle}</div>
            <div className="form-grid">{STEP_LAYOUT.vehicle.map(renderField)}</div>
          </>)}

          {step === "pricing" && (<>
            <div className="form-section"><i className="ti ti-cash" />{lab.secPricing}</div>
            <div className="form-grid">{STEP_LAYOUT.pricing.map(renderField)}</div>
          </>)}

          {step === "publication" && (<>
            <div className="form-section"><i className="ti ti-broadcast" />{lab.secPublication}</div>
            <div className="form-grid">{STEP_LAYOUT.publication.map(renderField)}</div>
          </>)}

          {step === "review" && (<>
            <div className="form-section"><i className="ti ti-adjustments" />{lab.secCustom}</div>
            <CustomFieldsRenderer scope="transfer" values={customFields} onChange={setCustomFields} />
          </>)}

          {formErrLines.length > 0 && (
            <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)", flexDirection: "column", alignItems: "stretch", marginTop: 16 }}>
              {formErrLines.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          )}

          <div className="wizard-nav">
            <button className="btn btn-ghost" disabled={stepIdx === 0} onClick={goPrev}><i className="ti ti-chevron-left" />{s.prev}</button>
            <span className="spacer" />
            <button className="btn" onClick={closeForm}>{s.cancel}</button>
            {!isLast && <button className="btn btn-primary" onClick={goNext}>{s.next}<i className="ti ti-chevron-right" /></button>}
            {isLast && <button className="btn btn-primary" disabled={busy} onClick={() => void handleSubmit()}><i className="ti ti-check" />{busy ? s.saving : s.save}</button>}
          </div>
        </div></div>
      </div>
    );
  }

  // ── LIST ─────────────────────────────────────────────────────────
  const shown = rows.filter((r) =>
    (!fTitle || (r.transfer_title ?? "").toLowerCase().includes(fTitle.toLowerCase())) &&
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
        <div className="filter-field" style={{ flex: 2 }}><span className="filter-label">{lab.transfer_title}</span><input type="text" value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="Airport transfer" /></div>
        <div className="filter-field"><span className="filter-label">{s.status}</span>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">{s.all}</option>{["draft", "active", "inactive", "pending_review", "archived"].map((o) => <option key={o} value={o}>{o}</option>)}</select>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-car" /></div><div className="stat-value">{total}</div><div className="stat-label">{s.statTotal}</div></div>
        <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-circle-check" /></div><div className="stat-value">{active}</div><div className="stat-label">{s.statActive}</div></div>
        <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-clock" /></div><div className="stat-value">{pending}</div><div className="stat-label">{s.statPending}</div></div>
        <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-route" /></div><div className="stat-value">{rows.length}</div><div className="stat-label">{lab.secRoute}</div></div>
      </div>
      {err && <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}><i className="ti ti-alert-triangle" /><div>{err}</div></div>}
      <div className="card">
        <div className="card-header"><div><div className="card-title">{s.tabTransfers}</div><div className="card-subtitle">One transfer per offer · company derived from the offer.</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{s.id}</th><th>{lab.transfer_title}</th>{readOnly && <th data-oversight>{s.company}</th>}<th>{lab.vehicle_category}</th><th>{lab.secRoute}</th><th>{s.status}</th><th style={{ textAlign: "right" }}>{s.actions}</th></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={readOnly ? 7 : 6} className="no-label" style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>{s.empty}</td></tr>}
              {shown.map((r) => {
                const ost = r.offer?.status ?? "";
                return (
                  <tr key={r.id} onClick={() => !readOnly && void openEdit(r)}>
                    <td className="font-mono m-primary" data-label={s.id}>#{r.id}</td>
                    <td data-label={lab.transfer_title}><div className="font-semibold">{r.transfer_title ?? "—"}</div><div className="text-sm cell-muted">{[r.pickup_city, r.dropoff_city].filter(Boolean).join(" → ")}</div></td>
                    {readOnly && <td data-label={s.company}>{r.company_id ?? "—"}</td>}
                    <td data-label={lab.vehicle_category}><span className="type-badge">{r.vehicle_category ?? "—"}</span></td>
                    <td data-label={lab.secRoute}>{[r.pickup_city, r.dropoff_city].filter(Boolean).join(" → ") || "—"}</td>
                    <td data-label={s.status}><span className={`badge ${statusBadgeClass(ost)}`}>{ost || "—"}</span></td>
                    <td className="no-label operator-cta">
                      <div className="row-actions">
                        {submittable(ost) && r.offer_id && <button className="icon-btn" title={s.hSubmitReview} onClick={(e) => { e.stopPropagation(); void handleSubmitForReview(r.offer_id ?? null); }}><i className="ti ti-send" /></button>}
                        <button className="icon-btn" title={s.edit} onClick={(e) => { e.stopPropagation(); void openEdit(r); }}><i className="ti ti-edit" /></button>
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
