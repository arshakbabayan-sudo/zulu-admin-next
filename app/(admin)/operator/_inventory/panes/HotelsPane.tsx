"use client";

/**
 * Hotels pane — 1:1 port of #pane-hotels in inventory.html.
 *
 * Full-page in-pane detail/create form (list ↔ detail toggle via `form` state):
 * basic info · availability · facilities · policies · review data · a rooms→
 * pricings nested repeater (min 1 room, each ≥1 pricing) · custom fields. Wired
 * to the existing inventory-crud-api (apiHotels / apiGetHotel / apiCreate /
 * apiUpdate / apiDelete) + the hotel-ui validators + the shared
 * LocationCascadeSelect / ImageUploadField / CustomFieldsRenderer widgets.
 *
 * offer_id is create-only (hidden/disabled on edit). Submit-for-review uses
 * apiSubmitOfferForReview. Delete is a hard delete behind the themed confirm.
 */

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiHotels,
  apiGetHotel,
  apiCreateHotel,
  apiUpdateHotel,
  apiDeleteHotel,
  apiCustomFieldValues,
  hotelCreateBodyFromForm,
  hotelUpdateBodyFromForm,
  hotelFormFromDetail,
  newHotelPricingFormRow,
  newHotelRoomFormRow,
  type HotelRow,
  type HotelFormPayload,
  type HotelRoomFormRow,
  type HotelPricingFormRow,
} from "@/lib/inventory-crud-api";
import { validateHotelOperatorForm, formatHotelApiValidationErrors } from "@/lib/hotel-ui";
import { apiSubmitOfferForReview } from "@/lib/platform-admin-api";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { ImageUploadField } from "@/components/ImageUploadField";
import { CustomFieldsRenderer } from "@/components/CustomFieldsRenderer";
import { SourceLanguagePicker } from "@/components/SourceLanguagePicker";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { userHasPermission } from "@/lib/access";
import { inventoryStrings } from "../inventory-i18n";
import type { InventoryPaneProps } from "../types";

const EMPTY: HotelFormPayload = {
  offer_id: "", location_id: "", source_lang: "en",
  hotel_name: "", property_type: "hotel", hotel_type: "resort", accommodation_type: "hotel",
  country: "", region_or_state: "", city: "", district_or_area: "", full_address: "",
  latitude: "", longitude: "", meal_type: "bed_and_breakfast", star_rating: "",
  availability_status: "available", status: "draft",
  bookable: true, is_package_eligible: false, visibility_rule: "show_all", appears_in_packages: true,
  free_wifi: false, parking: false, airport_shuttle: false, indoor_pool: false, outdoor_pool: false,
  room_service: false, front_desk_24h: false, child_friendly: false, accessibility_support: false, pets_allowed: false,
  free_cancellation: false, prepayment_required: false, cancellation_policy_type: "", cancellation_deadline_at: "",
  no_show_policy: "", review_score: "", review_count: "", review_label: "", room_inventory_mode: "",
  main_image: "", short_description: "", rooms: [newHotelRoomFormRow()],
};

const MEAL_TYPES = ["room_only", "breakfast", "bed_and_breakfast", "half_board", "full_board", "all_inclusive"];
const ACCOMMODATION = ["hotel", "apartment", "villa", "hostel", "guesthouse"];
const AVAIL = ["available", "limited", "sold_out", "unavailable"];
const LIFECYCLE = ["draft", "active", "inactive", "sold_out", "unavailable", "archived"];
const VISIBILITY = ["show_all", "show_accepted_only", "hide_rejected"];
const CURRENCIES = ["USD", "EUR", "AMD", "RUB"];

function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "active": return "badge-success";
    case "pending_review": return "badge-warning";
    case "draft": case "inactive": return "badge-gray";
    case "archived": case "rejected": case "sold_out": case "unavailable": return "badge-danger";
    default: return "badge-gray";
  }
}
function initials(name: string | null | undefined): string {
  return (name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
function submittable(status: string | null | undefined): boolean {
  return status === "draft" || status === "rejected" || status === "changes_requested";
}

export function HotelsPane({ token, user, lang, scope, registerAction, showToast }: InventoryPaneProps) {
  const s = inventoryStrings(lang);
  const confirm = useConfirm();
  const readOnly = scope === "oversight";

  const [rows, setRows] = useState<HotelRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // filters (client-side over the loaded page — these are UI filters not yet
  // confirmed server-side; see INTEGRATION.md §9).
  const [fName, setFName] = useState("");
  const [fCity, setFCity] = useState("");
  const [fCountry, setFCountry] = useState("");
  const [fStars, setFStars] = useState("");
  const [fStatus, setFStatus] = useState("");

  const [form, setForm] = useState<HotelFormPayload | null>(null);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [editId, setEditId] = useState<number | null>(null);
  const [editOfferId, setEditOfferId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrLines, setFormErrLines] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiHotels(token, { page, per_page: 20 });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditId(null); setEditOfferId(null); setEditStatus(null);
    setForm({ ...EMPTY, rooms: [newHotelRoomFormRow()] });
    setCustomFields({});
    setFormErrLines([]);
  }

  const openEdit = useCallback(async (r: HotelRow) => {
    if (!token) return;
    setEditId(r.id); setEditOfferId(r.offer_id ?? null); setEditStatus(r.offer?.status ?? r.status ?? null);
    setForm(null); setCustomFields({}); setFormLoading(true); setFormErrLines([]);
    try {
      const res = await apiGetHotel(token, r.id);
      setForm(hotelFormFromDetail(res.data));
      setCustomFields(await apiCustomFieldValues(token, "hotel", r.id).catch(() => ({})));
    } catch (e) {
      setEditId(null);
      setErr(e instanceof ApiRequestError ? e.message : "Failed");
    } finally { setFormLoading(false); }
  }, [token]);

  function closeForm() {
    setForm(null); setEditId(null); setFormErrLines([]); setFormLoading(false);
  }

  // top-right CTA — "+ New hotel" in list view (operator scope only).
  useEffect(() => {
    if (form === null && !formLoading && !readOnly && userHasPermission(user, "hotels.create")) {
      registerAction(<button className="btn btn-primary" onClick={openCreate}><i className="ti ti-plus" />{s.hNew}</button>);
    } else {
      registerAction(null);
    }
    return () => registerAction(null);
  }, [form, formLoading, readOnly, user, registerAction, s.hNew]);

  async function handleSubmit() {
    if (!token || !form) return;
    const mode = editId != null ? "edit" : "create";
    const validation = validateHotelOperatorForm(form, mode);
    if (validation.length > 0) { setFormErrLines(validation); return; }
    setBusy(true); setFormErrLines([]);
    try {
      if (editId != null) {
        await apiUpdateHotel(token, editId, { ...hotelUpdateBodyFromForm(form), custom_fields: customFields });
      } else {
        await apiCreateHotel(token, { ...hotelCreateBodyFromForm(form), custom_fields: customFields });
      }
      closeForm();
      showToast(s.hSavedToast);
      await load();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) {
        setFormErrLines(formatHotelApiValidationErrors(e.body.errors));
      } else {
        setFormErrLines([e instanceof ApiRequestError ? e.message : "Failed"]);
      }
    } finally { setBusy(false); }
  }

  async function handleDelete(r: HotelRow) {
    if (!token) return;
    const ok = await confirm({ message: s.hDeleteConfirm, variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try { await apiDeleteHotel(token, r.id); showToast(s.hDeletedToast); await load(); }
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

  // ── form field helpers ───────────────────────────────────────────
  function set<K extends keyof HotelFormPayload>(key: K, val: HotelFormPayload[K]) {
    setForm((p) => (p ? { ...p, [key]: val } : p));
  }
  function updateRoom(idx: number, patch: Partial<HotelRoomFormRow>) {
    setForm((p) => (p ? { ...p, rooms: p.rooms.map((r, i) => (i === idx ? { ...r, ...patch } : r)) } : p));
  }
  function addRoom() { setForm((p) => (p ? { ...p, rooms: [...p.rooms, newHotelRoomFormRow()] } : p)); }
  function removeRoom(idx: number) { setForm((p) => (p ? { ...p, rooms: p.rooms.filter((_, i) => i !== idx) } : p)); }
  function updatePricing(roomIdx: number, pIdx: number, patch: Partial<HotelPricingFormRow>) {
    setForm((p) => (p ? { ...p, rooms: p.rooms.map((r, i) => i === roomIdx ? { ...r, pricings: r.pricings.map((pr, j) => j === pIdx ? { ...pr, ...patch } : pr) } : r) } : p));
  }
  function addPricing(roomIdx: number) {
    setForm((p) => (p ? { ...p, rooms: p.rooms.map((r, i) => i === roomIdx ? { ...r, pricings: [...r.pricings, newHotelPricingFormRow()] } : r) } : p));
  }
  function removePricing(roomIdx: number, pIdx: number) {
    setForm((p) => (p ? { ...p, rooms: p.rooms.map((r, i) => i === roomIdx ? { ...r, pricings: r.pricings.filter((_, j) => j !== pIdx) } : r) } : p));
  }
  const numOrEmpty = (v: string): number | "" => (v === "" ? "" : Number(v));

  if (forbidden) return <div className="card"><div className="card-body"><ForbiddenNotice /></div></div>;

  // ── DETAIL / CREATE FORM ─────────────────────────────────────────
  if (formLoading) {
    return <div className="card"><div className="card-body" style={{ textAlign: "center", color: "var(--text-secondary)", padding: 32 }}>{s.loading}</div></div>;
  }
  if (form) {
    const isEdit = editId != null;
    return (
      <div>
        <button className="btn btn-ghost detail-back" onClick={closeForm}><i className="ti ti-arrow-left" />{s.hBack}</button>
        <div className="detail-head">
          <div className="detail-logo">{initials(form.hotel_name) || "H"}</div>
          <div>
            <div className="detail-title">{form.hotel_name || s.hNew}</div>
            <div className="detail-meta">
              <span className="font-mono">{isEdit ? `#${editId}` : "—"}</span><span>·</span>
              <span>{[form.city, form.country].filter(Boolean).join(", ") || "—"}</span>
            </div>
          </div>
          <div className="detail-head-right">
            {isEdit && editStatus && <span className={`badge ${statusBadgeClass(editStatus)}`}>{editStatus}</span>}
          </div>
        </div>

        {/* Basic info */}
        <div className="card"><div className="card-body">
          <div className="form-section"><i className="ti ti-info-circle" />{s.hSecBasic}</div>
          <div className="form-grid">
            {!isEdit && (
              <div className="fld">
                <label className="fld-label">{s.fOfferId} <span style={{ color: "var(--danger)" }}>*</span></label>
                <input type="number" value={form.offer_id} onChange={(e) => set("offer_id", numOrEmpty(e.target.value))} placeholder="2231" />
                <span className="fld-hint">{s.fOfferHint}</span>
              </div>
            )}
            <div className="fld">
              <label className="fld-label">{s.fName} <span style={{ color: "var(--danger)" }}>*</span></label>
              <input type="text" value={form.hotel_name} onChange={(e) => set("hotel_name", e.target.value)} placeholder="Marriott Yerevan" />
            </div>
            <div className="fld">
              <label className="fld-label">{s.fPropertyType} <span style={{ color: "var(--danger)" }}>*</span></label>
              <input type="text" value={form.property_type} onChange={(e) => set("property_type", e.target.value)} placeholder="hotel" />
            </div>
            <div className="fld">
              <label className="fld-label">{s.fHotelType} <span style={{ color: "var(--danger)" }}>*</span></label>
              <input type="text" value={form.hotel_type} onChange={(e) => set("hotel_type", e.target.value)} placeholder="resort" />
            </div>
            <div className="fld">
              <label className="fld-label">{s.fAccommodation}</label>
              <select value={form.accommodation_type} onChange={(e) => set("accommodation_type", e.target.value as HotelFormPayload["accommodation_type"])}>
                {ACCOMMODATION.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="fld">
              <label className="fld-label">{s.fLocation} <span style={{ color: "var(--danger)" }}>*</span></label>
              <LocationCascadeSelect
                token={token}
                value={form.location_id === "" ? null : Number(form.location_id)}
                label=""
                onChange={(locationId, m) => setForm((p) => p ? { ...p, location_id: locationId ?? "", country: m.country?.name ?? p.country, region_or_state: m.region?.name ?? p.region_or_state, city: m.city?.name ?? p.city } : p)}
              />
              <span className="fld-hint">{s.fLocationHint}</span>
            </div>
            <div className="fld span-2">
              <label className="fld-label">{s.fFullAddress}</label>
              <textarea value={form.full_address} onChange={(e) => set("full_address", e.target.value)} placeholder="1 Amiryan St, Yerevan 0010" />
            </div>
            <div className="fld">
              <label className="fld-label">{s.fLatitude}</label>
              <input type="text" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="40.1772" />
              <span className="fld-hint">{s.fLatHint}</span>
            </div>
            <div className="fld">
              <label className="fld-label">{s.fLongitude}</label>
              <input type="text" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="44.5035" />
              <span className="fld-hint">{s.fLngHint}</span>
            </div>
            <div className="fld">
              <label className="fld-label">{s.fMealPlan} <span style={{ color: "var(--danger)" }}>*</span></label>
              <select value={form.meal_type} onChange={(e) => set("meal_type", e.target.value)}>
                {MEAL_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="fld">
              <label className="fld-label">{s.fStarRating}</label>
              <input type="number" min={1} max={5} value={form.star_rating} onChange={(e) => set("star_rating", numOrEmpty(e.target.value))} placeholder="5" />
            </div>
            <div className="fld span-2">
              <label className="fld-label">{s.fShortDesc}</label>
              <textarea rows={4} maxLength={255} value={form.short_description} onChange={(e) => set("short_description", e.target.value)} placeholder="Max 255 characters" />
            </div>
            <div className="fld span-2">
              <label className="fld-label">{s.fMainImage}</label>
              <ImageUploadField value={form.main_image} onChange={(v) => set("main_image", v)} section="hotels" label="" />
            </div>
            <div className="fld span-2">
              <SourceLanguagePicker value={form.source_lang ?? "en"} onChange={(next) => set("source_lang", next)} />
            </div>
          </div>

          {/* Availability */}
          <div className="form-section"><i className="ti ti-calendar-stats" />{s.hSecAvail}</div>
          <div className="form-grid">
            <div className="fld">
              <label className="fld-label">{s.fAvailStatus} <span style={{ color: "var(--danger)" }}>*</span></label>
              <select value={form.availability_status} onChange={(e) => set("availability_status", e.target.value)}>
                {AVAIL.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="fld">
              <label className="fld-label">{s.fLifecycle} <span style={{ color: "var(--danger)" }}>*</span></label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)}>
                {LIFECYCLE.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="fld">
              <label className="fld-label">{s.fRoomInvMode}</label>
              <input list="hf-rim" value={form.room_inventory_mode} onChange={(e) => set("room_inventory_mode", e.target.value)} placeholder="per_room" />
              <datalist id="hf-rim"><option>per_room</option><option>pooled</option><option>on_request</option></datalist>
              <span className="fld-hint">{s.fFreeText64}</span>
            </div>
            <div className="fld">
              <label className="fld-label">{s.fVisibility}</label>
              <select value={form.visibility_rule} onChange={(e) => set("visibility_rule", e.target.value)}>
                {VISIBILITY.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid" style={{ marginTop: 14 }}>
            <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.bookable} onChange={(e) => set("bookable", e.target.checked)} /><span className="switch-slider" /></span>{s.fBookable}</label>
            <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.is_package_eligible} onChange={(e) => set("is_package_eligible", e.target.checked)} /><span className="switch-slider" /></span>{s.fPkgEligible}</label>
            <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.appears_in_packages} onChange={(e) => set("appears_in_packages", e.target.checked)} /><span className="switch-slider" /></span>{s.fAppearsPkg}</label>
          </div>

          {/* Facilities */}
          <div className="form-section"><i className="ti ti-checklist" />{s.hSecFacilities}</div>
          <div className="perm-check">
            {([
              ["free_wifi", s.facWifi], ["parking", s.facParking], ["airport_shuttle", s.facShuttle], ["indoor_pool", s.facIndoorPool], ["outdoor_pool", s.facOutdoorPool],
              ["room_service", s.facRoomService], ["front_desk_24h", s.facFrontDesk], ["child_friendly", s.facChildFriendly], ["accessibility_support", s.facAccessibility], ["pets_allowed", s.facPets],
            ] as Array<[keyof HotelFormPayload, string]>).map(([k, label]) => (
              <label key={String(k)}><input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked as never)} />{label}</label>
            ))}
          </div>

          {/* Policies */}
          <div className="form-section"><i className="ti ti-file-description" />{s.hSecPolicies}</div>
          <div className="form-grid">
            <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.free_cancellation} onChange={(e) => set("free_cancellation", e.target.checked)} /><span className="switch-slider" /></span>{s.fFreeCancel}</label>
            <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.prepayment_required} onChange={(e) => set("prepayment_required", e.target.checked)} /><span className="switch-slider" /></span>{s.fPrepay}</label>
            <div className="fld">
              <label className="fld-label">{s.fCancelType}</label>
              <input list="hf-cpt" value={form.cancellation_policy_type} onChange={(e) => set("cancellation_policy_type", e.target.value)} placeholder="flexible" />
              <datalist id="hf-cpt"><option>flexible</option><option>moderate</option><option>strict</option><option>non_refundable</option></datalist>
            </div>
            <div className="fld">
              <label className="fld-label">{s.fCancelDeadline}</label>
              <input type="datetime-local" value={form.cancellation_deadline_at} onChange={(e) => set("cancellation_deadline_at", e.target.value)} />
            </div>
            <div className="fld span-2">
              <label className="fld-label">{s.fNoShow}</label>
              <textarea maxLength={255} value={form.no_show_policy} onChange={(e) => set("no_show_policy", e.target.value)} placeholder="Max 255 characters" />
            </div>
          </div>

          {/* Review data */}
          <div className="form-section"><i className="ti ti-star" />{s.hSecReview}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{s.fReviewScore}</label><input type="number" min={0} max={10} step={0.1} value={form.review_score} onChange={(e) => set("review_score", numOrEmpty(e.target.value))} placeholder="8.6" /></div>
            <div className="fld"><label className="fld-label">{s.fReviewCount}</label><input type="number" min={0} value={form.review_count} onChange={(e) => set("review_count", numOrEmpty(e.target.value))} placeholder="0" /></div>
            <div className="fld">
              <label className="fld-label">{s.fReviewLabel}</label>
              <input list="hf-rl" value={form.review_label} onChange={(e) => set("review_label", e.target.value)} placeholder="excellent" />
              <datalist id="hf-rl"><option>excellent</option><option>very_good</option><option>good</option><option>pleasant</option><option>fair</option></datalist>
            </div>
          </div>
        </div></div>

        {/* Rooms & pricings */}
        <div className="card"><div className="card-body">
          <div className="form-section"><i className="ti ti-bed" />{s.hSecRooms}<span className="fs-hint">{s.hRoomsHint}</span></div>
          <div className="rep-list">
            {form.rooms.map((room, ri) => (
              <div className="rep-card" key={room.clientKey}>
                <div className="rep-head">
                  <span className="rep-idx">{s.rRoom} {ri + 1}</span>
                  <div className="rep-title">{room.room_name || "—"}</div>
                  {form.rooms.length > 1 && <button className="icon-btn danger" title={s.delete} onClick={() => removeRoom(ri)}><i className="ti ti-trash" /></button>}
                </div>
                <div className="form-grid">
                  <div className="fld"><label className="fld-label">{s.rType}</label><input type="text" value={room.room_type} onChange={(e) => updateRoom(ri, { room_type: e.target.value })} placeholder="deluxe" /></div>
                  <div className="fld"><label className="fld-label">{s.rName}</label><input type="text" value={room.room_name} onChange={(e) => updateRoom(ri, { room_name: e.target.value })} placeholder="Deluxe Double" /></div>
                  <div className="fld"><label className="fld-label">{s.rMaxAdults} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" value={room.max_adults} onChange={(e) => updateRoom(ri, { max_adults: numOrEmpty(e.target.value) })} placeholder="2" /></div>
                  <div className="fld"><label className="fld-label">{s.rMaxChildren}</label><input type="number" value={room.max_children} onChange={(e) => updateRoom(ri, { max_children: numOrEmpty(e.target.value) })} placeholder="1" /></div>
                  <div className="fld"><label className="fld-label">{s.rMaxTotal} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" value={room.max_total_guests} onChange={(e) => updateRoom(ri, { max_total_guests: numOrEmpty(e.target.value) })} placeholder="3" /></div>
                  <div className="fld"><label className="fld-label">{s.rBedType}</label><input type="text" value={room.bed_type} onChange={(e) => updateRoom(ri, { bed_type: e.target.value })} placeholder="king" /></div>
                  <div className="fld"><label className="fld-label">{s.rBedCount}</label><input type="number" value={room.bed_count} onChange={(e) => updateRoom(ri, { bed_count: numOrEmpty(e.target.value) })} placeholder="1" /></div>
                  <div className="fld"><label className="fld-label">{s.rSize}</label><input type="text" value={room.room_size} onChange={(e) => updateRoom(ri, { room_size: e.target.value })} placeholder="28" /></div>
                  <div className="fld"><label className="fld-label">{s.rView}</label><input type="text" value={room.room_view} onChange={(e) => updateRoom(ri, { room_view: e.target.value })} placeholder="city" /></div>
                  <div className="fld"><label className="fld-label">{s.rViewType}</label><input type="text" value={room.view_type} onChange={(e) => updateRoom(ri, { view_type: e.target.value })} placeholder="panoramic" /></div>
                  <div className="fld"><label className="fld-label">{s.rInvCount}</label><input type="number" value={room.room_inventory_count} onChange={(e) => updateRoom(ri, { room_inventory_count: numOrEmpty(e.target.value) })} placeholder="12" /></div>
                  <div className="fld"><label className="fld-label">{s.rStatus}</label><input type="text" value={room.status} onChange={(e) => updateRoom(ri, { status: e.target.value })} placeholder="active" /></div>
                </div>
                <div className="perm-check" style={{ marginTop: 12 }}>
                  {([
                    ["private_bathroom", s.rPrivBath], ["bath", s.rBath], ["shower", s.rShower], ["air_conditioning", s.rAC], ["wifi", s.rWifi], ["tv", s.rTV], ["mini_fridge", s.rFridge],
                    ["tea_coffee_maker", s.rTeaCoffee], ["kettle", s.rKettle], ["washing_machine", s.rWashing], ["soundproofing", s.rSoundproof], ["terrace_or_balcony", s.rTerrace], ["patio", s.rPatio], ["smoking_allowed", s.rSmoking],
                  ] as Array<[keyof HotelRoomFormRow, string]>).map(([k, label]) => (
                    <label key={String(k)}><input type="checkbox" checked={!!room[k]} onChange={(e) => updateRoom(ri, { [k]: e.target.checked } as Partial<HotelRoomFormRow>)} />{label}</label>
                  ))}
                </div>
                <div className="fld span-2" style={{ marginTop: 12 }}>
                  <label className="fld-label">{s.rImages}</label>
                  <textarea rows={2} value={room.room_images} onChange={(e) => updateRoom(ri, { room_images: e.target.value })} placeholder="https://…/room1.jpg" />
                </div>

                {room.pricings.map((pr, pi) => (
                  <div className="rep-card nested" key={pi}>
                    <div className="rep-head">
                      <span className="rep-idx">{s.pPricing} {pi + 1}</span><div className="rep-title">{s.pPricing}</div>
                      {room.pricings.length > 1 && <button className="icon-btn danger" title={s.delete} onClick={() => removePricing(ri, pi)}><i className="ti ti-trash" /></button>}
                    </div>
                    <div className="form-grid">
                      <div className="fld"><label className="fld-label">{s.pPrice} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" step={0.01} value={pr.price} onChange={(e) => updatePricing(ri, pi, { price: e.target.value })} placeholder="120" /></div>
                      <div className="fld"><label className="fld-label">{s.pCurrency}</label><select value={pr.currency} onChange={(e) => updatePricing(ri, pi, { currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                      <div className="fld"><label className="fld-label">{s.pMode}</label><input type="text" value={pr.pricing_mode} onChange={(e) => updatePricing(ri, pi, { pricing_mode: e.target.value })} placeholder="per_night" /></div>
                      <div className="fld"><label className="fld-label">{s.pMinNights}</label><input type="number" value={pr.min_nights} onChange={(e) => updatePricing(ri, pi, { min_nights: numOrEmpty(e.target.value) })} placeholder="1" /></div>
                      <div className="fld"><label className="fld-label">{s.pValidFrom}</label><input type="date" value={pr.valid_from} onChange={(e) => updatePricing(ri, pi, { valid_from: e.target.value })} /></div>
                      <div className="fld"><label className="fld-label">{s.pValidTo}</label><input type="date" value={pr.valid_to} onChange={(e) => updatePricing(ri, pi, { valid_to: e.target.value })} /></div>
                      <div className="fld"><label className="fld-label">{s.rStatus}</label><input type="text" value={pr.status} onChange={(e) => updatePricing(ri, pi, { status: e.target.value })} placeholder="active" /></div>
                    </div>
                  </div>
                ))}
                <button className="btn btn-sm rep-add" onClick={() => addPricing(ri)}><i className="ti ti-plus" />{s.pAdd}</button>
              </div>
            ))}
          </div>
          <button className="btn rep-add" onClick={addRoom}><i className="ti ti-plus" />{s.rAddRoom}</button>
        </div></div>

        {/* Custom fields */}
        <div className="card"><div className="card-body">
          <div className="form-section"><i className="ti ti-adjustments" />{s.hSecCustom}</div>
          <CustomFieldsRenderer scope="hotel" values={customFields} onChange={setCustomFields} />
          <div className="note-inline"><i className="ti ti-info-circle" />{s.hCustomNote}</div>
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
          <button className="btn btn-primary" disabled={busy} onClick={() => void handleSubmit()}><i className="ti ti-check" />{busy ? s.saving : s.hSave}</button>
        </div></div>
      </div>
    );
  }

  // ── LIST ─────────────────────────────────────────────────────────
  const shown = rows.filter((r) =>
    (!fName || (r.hotel_name ?? "").toLowerCase().includes(fName.toLowerCase())) &&
    (!fCity || (r.city ?? "").toLowerCase().includes(fCity.toLowerCase())) &&
    (!fCountry || (r.country ?? "").toLowerCase().includes(fCountry.toLowerCase())) &&
    (!fStars || String(r.star_rating ?? "") === fStars) &&
    (!fStatus || (r.offer?.status ?? r.status) === fStatus)
  );
  const total = meta?.total ?? shown.length;
  const active = rows.filter((r) => (r.offer?.status ?? r.status) === "active").length;
  const pending = rows.filter((r) => (r.offer?.status ?? r.status) === "pending_review").length;
  const roomsListed = rows.reduce((sum, r) => sum + (r.rooms?.length ?? 0), 0);
  const from = shown.length ? (page - 1) * 20 + 1 : 0;
  const to = (page - 1) * 20 + shown.length;

  return (
    <div>
      {readOnly && <div className="alert oversight-note"><i className="ti ti-eye" /><div>{s.oversightBanner}</div></div>}

      <div className="filter-card">
        {readOnly && <div className="filter-field"><span className="filter-label">{s.company}</span><input type="text" placeholder={s.company} /></div>}
        <div className="filter-field" style={{ flex: 2 }}><span className="filter-label">{s.hfName}</span><input type="text" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Marriott…" /></div>
        <div className="filter-field"><span className="filter-label">{s.hColCity}</span><input type="text" value={fCity} onChange={(e) => setFCity(e.target.value)} placeholder="Yerevan" /></div>
        <div className="filter-field"><span className="filter-label">{s.hColCountry}</span><input type="text" value={fCountry} onChange={(e) => setFCountry(e.target.value)} placeholder="Armenia" /></div>
        <div className="filter-field"><span className="filter-label">{s.hColStars}</span>
          <select value={fStars} onChange={(e) => setFStars(e.target.value)}><option value="">{s.hfAny}</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </div>
        <div className="filter-field"><span className="filter-label">{s.status}</span>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">{s.all}</option>{["draft", "active", "inactive", "pending_review", "archived"].map((o) => <option key={o} value={o}>{o}</option>)}</select>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-building-skyscraper" /></div><div className="stat-value">{total}</div><div className="stat-label">{s.hStatTotal}</div></div>
        <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-circle-check" /></div><div className="stat-value">{active}</div><div className="stat-label">{s.statActive}</div></div>
        <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-clock" /></div><div className="stat-value">{pending}</div><div className="stat-label">{s.statPending}</div></div>
        <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-bed" /></div><div className="stat-value">{roomsListed}</div><div className="stat-label">{s.hStatRooms}</div></div>
      </div>

      {err && <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}><i className="ti ti-alert-triangle" /><div>{err}</div></div>}

      <div className="card">
        <div className="card-header"><div><div className="card-title">{s.tabHotels}</div><div className="card-subtitle">{s.hCardSub}</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>{s.id}</th><th>{s.hColHotel}</th>{readOnly && <th data-oversight>{s.company}</th>}<th>{s.hColCity}</th><th>{s.hColCountry}</th><th>{s.hColStars}</th><th>{s.status}</th><th style={{ textAlign: "right" }}>{s.actions}</th>
            </tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={readOnly ? 8 : 7} className="no-label" style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>{s.empty}</td></tr>}
              {shown.map((r) => {
                const st = r.offer?.status ?? r.status ?? "";
                return (
                  <tr key={r.id} onClick={() => !readOnly && void openEdit(r)}>
                    <td className="font-mono m-primary" data-label={s.id}>#{r.id}</td>
                    <td data-label={s.hColHotel}><div className="flex items-center gap-2"><span className="avatar avatar-blue sm">{initials(r.hotel_name)}</span><div><div className="font-semibold">{r.hotel_name ?? "—"}</div><div className="text-sm cell-muted">{[r.city, r.country].filter(Boolean).join(", ") || "—"}</div></div></div></td>
                    {readOnly && <td data-label={s.company}>{r.company_id ?? "—"}</td>}
                    <td data-label={s.hColCity}>{r.city ?? "—"}</td>
                    <td data-label={s.hColCountry}>{r.country ?? "—"}</td>
                    <td data-label={s.hColStars}>{r.star_rating ? `★ ${r.star_rating}` : "—"}</td>
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
