"use client";

/**
 * Visas pane — 1:1 port of #pane-visas in inventory.html.
 *
 * 1:1 with a visa-type offer · location must be country-level · the editable
 * visa amount (visa_price) is sent as `price` on the wire · required_documents
 * is a one-per-line textarea normalized to an array on submit. offer_status /
 * offer_price / currency are display-only (edit mode). No oversight page.
 */

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiVisas,
  apiGetVisa,
  apiCreateVisa,
  apiUpdateVisa,
  apiDeleteVisa,
  apiCustomFieldValues,
  type VisaRow,
  type VisaPayload,
} from "@/lib/inventory-crud-api";
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
    secGeneral: "General", secProcessing: "Processing", secPricing: "Pricing", secContent: "Content", secCustom: "Custom fields",
    location: "Location", locationHint: "Must be COUNTRY-level · auto-derives country", offerId: "Offer ID", offerIdHint: "Create-only · hidden on edit", offerStatus: "Offer status", offerStatusHint: "Edit-only display · not persisted",
    visaType: "Visa type", name: "Name", processingDays: "Processing days", visaPrice: "Visa price", visaPriceHint: "Wire name = price", offerPrice: "Offer price", offerPriceHint: "Edit-only · read-only from offer", currency: "Currency", currencyHint: "Read-only from offer",
    description: "Description", requiredDocs: "Required documents", requiredDocsHint: "One per line → normalized to a required_documents array on submit",
    colCountry: "Country", colType: "Type", colVisaPrice: "Visa price", colOfferPrice: "Offer price", colProcessing: "Processing",
    fType: "Visa type", fProcessing: "Max processing (days)", fLocation: "Location (country)", allCountries: "All countries",
    newVisa: "New visa", back: "Back to visas", save: "Save visa", deleteConfirm: "Delete this visa? This is permanent (hard delete).",
  };
  const hy: Record<string, string> = {
    secGeneral: "Ընդհանուր", secProcessing: "Մշակում", secPricing: "Գին", secContent: "Բովանդակություն", secCustom: "Հատուկ դաշտեր",
    location: "Տեղադրություն", locationHint: "Պետք է լինի ԵՐԿՐԻ մակարդակ · ինքնաշխատ որոշում է երկիրը", offerId: "Առաջարկի ID", offerIdHint: "Միայն ստեղծելիս · խմբագրելիս թաքնված է", offerStatus: "Առաջարկի կարգավիճակ", offerStatusHint: "Միայն ցուցադրում · չի պահվում",
    visaType: "Վիզայի տեսակ", name: "Անուն", processingDays: "Մշակման օրեր", visaPrice: "Վիզայի գին", visaPriceHint: "Ուղարկվում է որպես price", offerPrice: "Առաջարկի գին", offerPriceHint: "Միայն ցուցադրում · առաջարկից", currency: "Արժույթ", currencyHint: "Միայն ցուցադրում · առաջարկից",
    description: "Նկարագրություն", requiredDocs: "Պահանջվող փաստաթղթեր", requiredDocsHint: "Մեկ տողում մեկը → submit-ին դառնում է required_documents զանգված",
    colCountry: "Երկիր", colType: "Տեսակ", colVisaPrice: "Վիզայի գին", colOfferPrice: "Առաջարկի գին", colProcessing: "Մշակում",
    fType: "Վիզայի տեսակ", fProcessing: "Առավ. մշակում (օր)", fLocation: "Տեղադրություն (երկիր)", allCountries: "Բոլոր երկրները",
    newVisa: "Նոր վիզա", back: "Վերադառնալ վիզաներին", save: "Պահել վիզան", deleteConfirm: "Ջնջե՞լ այս վիզան։ Սա մշտական է (վերջնական ջնջում)։",
  };
  const ru: Record<string, string> = {
    secGeneral: "Общее", secProcessing: "Обработка", secPricing: "Цена", secContent: "Содержание", secCustom: "Доп. поля",
    location: "Локация", locationHint: "Должна быть на уровне СТРАНЫ · авто-определяет страну", offerId: "ID предложения", offerIdHint: "Только при создании · скрыто при редактировании", offerStatus: "Статус предложения", offerStatusHint: "Только показ · не сохраняется",
    visaType: "Тип визы", name: "Название", processingDays: "Дней на обработку", visaPrice: "Цена визы", visaPriceHint: "На сервер как price", offerPrice: "Цена предложения", offerPriceHint: "Только показ · из предложения", currency: "Валюта", currencyHint: "Только показ · из предложения",
    description: "Описание", requiredDocs: "Необходимые документы", requiredDocsHint: "По одному на строку → массив required_documents при отправке",
    colCountry: "Страна", colType: "Тип", colVisaPrice: "Цена визы", colOfferPrice: "Цена предложения", colProcessing: "Обработка",
    fType: "Тип визы", fProcessing: "Макс. обработка (дн.)", fLocation: "Локация (страна)", allCountries: "Все страны",
    newVisa: "Новая виза", back: "Назад к визам", save: "Сохранить визу", deleteConfirm: "Удалить эту визу? Это навсегда (безвозвратное удаление).",
  };
  return lang === "hy" ? hy : lang === "ru" ? ru : en;
}

const EMPTY: VisaPayload = {
  offer_id: undefined, country: "", location_id: "", country_id: "", visa_type: "", name: "", description: "",
  required_documents_text: "", processing_days: undefined, visa_price: undefined, offer_price: undefined, currency: "", offer_status: undefined,
};

function visaNum(v: unknown): number | undefined { if (v == null || v === "") return undefined; const n = Number(v); return Number.isFinite(n) ? n : undefined; }
function docsToText(arr: string[] | null | undefined): string { return (arr ?? []).join("\n"); }
function textToDocs(text: string): string[] { return text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean); }

function visaFormFromRow(r: VisaRow): VisaPayload {
  const vp = r.visa_price;
  const visaPrice = vp != null && Number.isFinite(Number(vp)) ? Number(vp) : visaNum(r.price);
  return {
    country: r.country ?? "", location_id: r.location_id != null ? Number(r.location_id) : "", country_id: r.country_id != null ? Number(r.country_id) : "",
    visa_type: r.visa_type ?? "", name: (r.name ?? "").trim(), description: (r.description ?? "").trim(),
    required_documents_text: docsToText(r.required_documents), processing_days: visaNum(r.processing_days), visa_price: visaPrice,
    offer_price: visaNum(r.offer_price), currency: r.currency != null ? String(r.currency).toUpperCase().slice(0, 3) : "", offer_status: (r.status ?? "").trim(),
  };
}

function validateVisa(form: VisaPayload, isCreate: boolean): string[] {
  const lines: string[] = [];
  if (isCreate) { const oid = form.offer_id; if (oid == null || !Number.isFinite(Number(oid)) || Number(oid) <= 0) lines.push("offer_id: required"); }
  if (!(form.country ?? "").trim()) lines.push("country: required");
  if (!(form.visa_type ?? "").trim()) lines.push("visa_type: required");
  const pd = form.processing_days;
  if (pd != null && (Number.isNaN(Number(pd)) || Number(pd) < 0)) lines.push("processing_days: must be >= 0");
  const vp = form.visa_price;
  if (vp != null && (Number.isNaN(Number(vp)) || Number(vp) < 0)) lines.push("visa_price: must be >= 0");
  return lines;
}

function bodyFromForm(form: VisaPayload, mode: "create" | "update", customFields: Record<string, unknown>): VisaPayload {
  const out: VisaPayload = {
    country: (form.country ?? "").trim(), visa_type: (form.visa_type ?? "").trim(), name: (form.name ?? "").trim(),
    description: (form.description ?? "").trim(), required_documents: textToDocs(form.required_documents_text ?? ""), custom_fields: customFields,
  };
  if (form.location_id !== "" && form.location_id != null && Number(form.location_id) > 0) out.location_id = Number(form.location_id);
  if (form.country_id !== "" && form.country_id != null && Number(form.country_id) > 0) out.country_id = Number(form.country_id);
  if (form.processing_days != null && !Number.isNaN(Number(form.processing_days))) out.processing_days = Number(form.processing_days);
  if (form.visa_price != null && !Number.isNaN(Number(form.visa_price))) out.price = Number(form.visa_price);
  if (mode === "create" && form.offer_id != null) out.offer_id = Number(form.offer_id);
  return out;
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

export function VisasPane({ token, user, lang, scope, registerAction, showToast }: InventoryPaneProps) {
  const s = inventoryStrings(lang);
  const L = lab(lang);
  const confirm = useConfirm();
  const readOnly = scope === "oversight";

  const [rows, setRows] = useState<VisaRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [fType, setFType] = useState("");
  const [fStatus, setFStatus] = useState("");

  const [form, setForm] = useState<VisaPayload | null>(null);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [editId, setEditId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editOfferId, setEditOfferId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrLines, setFormErrLines] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiVisas(token, { page, per_page: 20 });
      setRows(res.data); setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditId(null); setEditStatus(null); setEditOfferId(null);
    setForm({ ...EMPTY }); setCustomFields({}); setFormErrLines([]);
  }
  const openEdit = useCallback(async (r: VisaRow) => {
    if (!token) return;
    setEditId(r.id); setEditStatus(r.status ?? null); setEditOfferId(r.offer_id ?? null);
    setForm(null); setCustomFields({}); setFormLoading(true); setFormErrLines([]);
    try {
      const res = await apiGetVisa(token, r.id);
      setForm(visaFormFromRow(res.data));
      setCustomFields(await apiCustomFieldValues(token, "visa", r.id).catch(() => ({})));
    } catch (e) { setEditId(null); setErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setFormLoading(false); }
  }, [token]);

  function closeForm() { setForm(null); setEditId(null); setFormErrLines([]); setFormLoading(false); }

  useEffect(() => {
    if (form === null && !formLoading && !readOnly && userHasPermission(user, "visas.create")) {
      registerAction(<button className="btn btn-primary" onClick={openCreate}><i className="ti ti-plus" />{L.newVisa}</button>);
    } else { registerAction(null); }
    return () => registerAction(null);
  }, [form, formLoading, readOnly, user, registerAction, L.newVisa]);

  function set(key: keyof VisaPayload, val: unknown) { setForm((p) => (p ? { ...p, [key]: val } : p)); }

  async function handleSubmit() {
    if (!token || !form) return;
    const isCreate = editId == null;
    const v = validateVisa(form, isCreate);
    if (v.length) { setFormErrLines(v); return; }
    setBusy(true); setFormErrLines([]);
    try {
      if (editId != null) await apiUpdateVisa(token, editId, bodyFromForm(form, "update", customFields));
      else await apiCreateVisa(token, bodyFromForm(form, "create", customFields));
      closeForm(); showToast(s.save); await load();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) setFormErrLines(Object.entries(e.body.errors).flatMap(([k, a]) => (a as string[]).map((m) => `${k}: ${m}`)));
      else setFormErrLines([e instanceof ApiRequestError ? e.message : "Failed"]);
    } finally { setBusy(false); }
  }

  async function handleDelete(r: VisaRow) {
    if (!token) return;
    const ok = await confirm({ message: L.deleteConfirm, variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try { await apiDeleteVisa(token, r.id); showToast(s.delete); await load(); }
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

  if (forbidden) return <div className="card"><div className="card-body"><ForbiddenNotice /></div></div>;
  if (formLoading) return <div className="card"><div className="card-body" style={{ textAlign: "center", color: "var(--text-secondary)", padding: 32 }}>{s.loading}</div></div>;

  // ── FORM ─────────────────────────────────────────────────────────
  if (form) {
    const isEdit = editId != null;
    return (
      <div>
        <button className="btn btn-ghost detail-back" onClick={closeForm}><i className="ti ti-arrow-left" />{L.back}</button>
        <div className="detail-head">
          <div className="detail-logo"><i className="ti ti-id-badge-2" /></div>
          <div><div className="detail-title">{[form.country, form.visa_type].filter(Boolean).join(" ") || L.newVisa}</div><div className="detail-meta"><span className="font-mono">{isEdit ? `#${editId}` : "—"}</span></div></div>
          <div className="detail-head-right">{isEdit && editStatus && <span className={`badge ${statusBadgeClass(editStatus)}`}>{editStatus}</span>}</div>
        </div>

        <div className="card"><div className="card-body">
          <div className="form-section"><i className="ti ti-info-circle" />{L.secGeneral}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.location} <span style={{ color: "var(--danger)" }}>*</span></label>
              <LocationCascadeSelect token={token} value={form.location_id === "" || form.location_id == null ? null : Number(form.location_id)} label=""
                onChange={(id, m) => setForm((p) => p ? { ...p, location_id: id ?? "", country: m.country?.name ?? p.country, country_id: m.country?.id ?? p.country_id } : p)} />
              <span className="fld-hint">{L.locationHint}</span></div>
            {!isEdit && (<div className="fld"><label className="fld-label">{L.offerId} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" value={form.offer_id ?? ""} onChange={(e) => set("offer_id", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="2201" /><span className="fld-hint">{L.offerIdHint}</span></div>)}
            {isEdit && (<div className="fld"><label className="fld-label">{L.offerStatus}</label><input type="text" value={form.offer_status ?? ""} readOnly /><span className="fld-hint">{L.offerStatusHint}</span></div>)}
            <div className="fld"><label className="fld-label">{L.visaType} <span style={{ color: "var(--danger)" }}>*</span></label><input type="text" value={form.visa_type ?? ""} onChange={(e) => set("visa_type", e.target.value)} placeholder="Tourist / Business / Student" /></div>
            <div className="fld span-2"><label className="fld-label">{L.name}</label><input type="text" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Optional" /></div>
          </div>

          <div className="form-section"><i className="ti ti-clock-hour-4" />{L.secProcessing}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.processingDays}</label><input type="number" min={0} value={form.processing_days ?? ""} onChange={(e) => set("processing_days", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="5" /></div>
          </div>

          <div className="form-section"><i className="ti ti-cash" />{L.secPricing}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{L.visaPrice}</label><input type="number" min={0} step={0.01} value={form.visa_price ?? ""} onChange={(e) => set("visa_price", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="25.00" /><span className="fld-hint">{L.visaPriceHint}</span></div>
            {isEdit && (<div className="fld"><label className="fld-label">{L.offerPrice}</label><input type="text" value={form.offer_price ?? ""} readOnly /><span className="fld-hint">{L.offerPriceHint}</span></div>)}
            {isEdit && (<div className="fld"><label className="fld-label">{L.currency}</label><input type="text" value={form.currency ?? ""} readOnly /><span className="fld-hint">{L.currencyHint}</span></div>)}
          </div>

          <div className="form-section"><i className="ti ti-file-text" />{L.secContent}</div>
          <div className="form-grid">
            <div className="fld span-2"><label className="fld-label">{L.description}</label><textarea rows={4} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
            <div className="fld span-2"><label className="fld-label">{L.requiredDocs}</label><textarea rows={5} value={form.required_documents_text ?? ""} onChange={(e) => set("required_documents_text", e.target.value)} placeholder={"Passport (6 months validity)\nPhoto 35x45mm\nBank statement"} /><span className="fld-hint">{L.requiredDocsHint}</span></div>
          </div>

          {isEdit && (<>
            <div className="form-section"><i className="ti ti-adjustments" />{L.secCustom}</div>
            <CustomFieldsRenderer scope="visa" values={customFields} onChange={setCustomFields} />
          </>)}
        </div></div>

        {formErrLines.length > 0 && (
          <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)", flexDirection: "column", alignItems: "stretch" }}>
            {formErrLines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        )}

        <div className="card"><div className="card-foot">
          <button className="btn btn-ghost" onClick={closeForm}>{s.cancel}</button>
          {isEdit && submittable(editStatus) && editOfferId != null && (
            <button className="btn" disabled={busy} onClick={() => void handleSubmitForReview(editOfferId)}><i className="ti ti-send" />{s.hSubmitReview}</button>
          )}
          <button className="btn btn-primary" disabled={busy} onClick={() => void handleSubmit()}><i className="ti ti-check" />{busy ? s.saving : L.save}</button>
        </div></div>
      </div>
    );
  }

  // ── LIST ─────────────────────────────────────────────────────────
  const shown = rows.filter((r) =>
    (!fType || (r.visa_type ?? "").toLowerCase().includes(fType.toLowerCase())) &&
    (!fStatus || (r.status) === fStatus)
  );
  const total = meta?.total ?? shown.length;
  const active = rows.filter((r) => (r.status) === "active").length;
  const pending = rows.filter((r) => (r.status) === "pending_review").length;
  const countries = new Set(rows.map((r) => r.country).filter(Boolean)).size;
  const from = shown.length ? (page - 1) * 20 + 1 : 0;
  const to = (page - 1) * 20 + shown.length;
  const money = (v: number | null | undefined, c: string | null | undefined) => v != null ? `${c ?? ""} ${Number(v).toFixed(2)}` : "—";

  return (
    <div>
      <div className="alert oversight-note"><i className="ti ti-info-circle" /><div><strong>{s.scopeOversight}.</strong> {s.extNoOversight}</div></div>
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}><span className="filter-label">{L.fType}</span><input type="text" value={fType} onChange={(e) => setFType(e.target.value)} placeholder="Tourist" /></div>
        <div className="filter-field"><span className="filter-label">{s.status}</span>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">{s.all}</option>{["draft", "active", "inactive", "pending_review", "archived"].map((o) => <option key={o} value={o}>{o}</option>)}</select>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-id-badge-2" /></div><div className="stat-value">{total}</div><div className="stat-label">{s.statTotal}</div></div>
        <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-circle-check" /></div><div className="stat-value">{active}</div><div className="stat-label">{s.statActive}</div></div>
        <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-clock" /></div><div className="stat-value">{pending}</div><div className="stat-label">{s.statPending}</div></div>
        <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-world" /></div><div className="stat-value">{countries}</div><div className="stat-label">{L.colCountry}</div></div>
      </div>
      {err && <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}><i className="ti ti-alert-triangle" /><div>{err}</div></div>}
      <div className="card">
        <div className="card-header"><div><div className="card-title">{s.tabVisas}</div><div className="card-subtitle">1:1 with a visa-type offer · location must be country-level · visa price sent as price.</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{s.id}</th><th>{L.colCountry}</th><th>{L.colType}</th><th>{L.colVisaPrice}</th><th>{L.colOfferPrice}</th><th>{L.colProcessing}</th><th>{s.status}</th><th style={{ textAlign: "right" }}>{s.actions}</th></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={8} className="no-label" style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>{s.empty}</td></tr>}
              {shown.map((r) => {
                const st = r.status ?? "";
                return (
                  <tr key={r.id} onClick={() => !readOnly && void openEdit(r)}>
                    <td className="font-mono m-primary" data-label={s.id}>#{r.id}</td>
                    <td data-label={L.colCountry}><div className="font-semibold">{r.country ?? "—"}</div><div className="text-sm cell-muted">{r.visa_type ?? ""}</div></td>
                    <td data-label={L.colType}>{r.visa_type ?? "—"}</td>
                    <td className="font-mono" data-label={L.colVisaPrice}>{money(r.visa_price ?? r.price, r.currency)}</td>
                    <td className="font-mono" data-label={L.colOfferPrice}>{money(r.offer_price, r.currency)}</td>
                    <td data-label={L.colProcessing}>{r.processing_days != null ? `${r.processing_days} ${(L.processingDays ?? "").toLowerCase()}` : "—"}</td>
                    <td data-label={s.status}><span className={`badge ${statusBadgeClass(st)}`}>{st || "—"}</span></td>
                    <td className="no-label operator-cta">
                      <div className="row-actions">
                        {submittable(st) && r.offer_id && <button className="icon-btn" title={s.hSubmitReview} onClick={(e) => { e.stopPropagation(); void handleSubmitForReview(r.offer_id ?? null); }}><i className="ti ti-send" /></button>}
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
