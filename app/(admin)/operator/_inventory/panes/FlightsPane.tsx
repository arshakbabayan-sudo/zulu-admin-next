"use client";

/**
 * Flights pane — 1:1 port of #pane-flights in inventory.html.
 *
 * Full-page in-pane form: general · departure · arrival · schedule · age tiers ·
 * a cabins repeater (≥1, primary mirrored to the flight on create) · policies ·
 * visibility · custom fields. Cabins are persisted through the dedicated cabin
 * endpoints — on save we diff (create/update/delete) against the server set.
 * Wired to inventory-crud-api + flight-ui validators.
 */

import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiFlights,
  apiFlight,
  apiCreateFlight,
  apiUpdateFlight,
  apiDeleteFlight,
  apiFlightCabins,
  apiCreateFlightCabin,
  apiUpdateFlightCabin,
  apiDeleteFlightCabin,
  apiCustomFieldValues,
  flightCreateBodyFromForm,
  flightUpdateBodyFromForm,
  flightFormFromDetail,
  newFlightCabinFormRow,
  diffFlightCabins,
  type FlightRow,
  type FlightFormPayload,
  type FlightCabinFormRow,
  type FlightCabinRow,
} from "@/lib/inventory-crud-api";
import { FLIGHT_CABIN_CLASSES, validateFlightOperatorForm, formatFlightApiValidationErrors } from "@/lib/flight-ui";
import { apiSubmitOfferForReview } from "@/lib/platform-admin-api";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { ImageUploadField } from "@/components/ImageUploadField";
import { CustomFieldsRenderer } from "@/components/CustomFieldsRenderer";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { userHasPermission } from "@/lib/access";
import { inventoryStrings } from "../inventory-i18n";
import type { InventoryPaneProps } from "../types";

const EMPTY: FlightFormPayload = {
  offer_id: "", departure_location_id: "", arrival_location_id: "", flight_code_internal: "", service_type: "scheduled",
  departure_country: "", departure_city: "", departure_airport: "", arrival_country: "", arrival_city: "", arrival_airport: "",
  departure_airport_code: "", arrival_airport_code: "", departure_terminal: "", arrival_terminal: "",
  departure_at: "", arrival_at: "", duration_minutes: "", timezone_context: "", check_in_close_at: "", boarding_close_at: "",
  connection_type: "direct", stops_count: 0, connection_notes: "", layover_summary: "",
  adult_age_from: 12, child_age_from: 2, child_age_to: 11, infant_age_from: 0, infant_age_to: 1,
  reservation_allowed: true, online_checkin_allowed: false, airport_checkin_allowed: true,
  cancellation_policy_type: "non_refundable", change_policy_type: "not_allowed",
  reservation_deadline_at: "", cancellation_deadline_at: "", change_deadline_at: "", policy_notes: "",
  is_package_eligible: true, appears_in_web: true, appears_in_admin: true, appears_in_zulu_admin: true,
  status: "draft", main_image: "", short_description: "", cabins: [newFlightCabinFormRow()],
};

const SERVICE_TYPES = ["scheduled", "charter", "package_flight", "private_special"];
const LIFECYCLE = ["draft", "active", "inactive", "sold_out", "cancelled", "completed", "archived"];
const CANCEL_POLICY = ["non_refundable", "partially_refundable", "fully_refundable"];
const CHANGE_POLICY = ["not_allowed", "paid_change", "free_change"];

function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "active": case "completed": return "badge-success";
    case "pending_review": return "badge-warning";
    case "draft": case "inactive": return "badge-gray";
    case "sold_out": return "badge-warning";
    case "archived": case "rejected": case "cancelled": return "badge-danger";
    default: return "badge-gray";
  }
}
function submittable(status: string | null | undefined): boolean {
  return status === "draft" || status === "rejected" || status === "changes_requested";
}
function fmtDT(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

export function FlightsPane({ token, user, lang, scope, registerAction, showToast }: InventoryPaneProps) {
  const s = inventoryStrings(lang);
  const confirm = useConfirm();
  const readOnly = scope === "oversight";

  const [rows, setRows] = useState<FlightRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [fDepCity, setFDepCity] = useState("");
  const [fArrCity, setFArrCity] = useState("");
  const [fStatus, setFStatus] = useState("");

  const [form, setForm] = useState<FlightFormPayload | null>(null);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [editId, setEditId] = useState<number | null>(null);
  const [editOfferId, setEditOfferId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [serverCabins, setServerCabins] = useState<{ flightId: number; rows: FlightCabinRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrLines, setFormErrLines] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiFlights(token, { page, per_page: 20 });
      setRows(res.data); setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditId(null); setEditOfferId(null); setEditStatus(null); setServerCabins(null);
    setForm({ ...EMPTY, cabins: [newFlightCabinFormRow({ cabin_class: "economy" })] });
    setCustomFields({}); setFormErrLines([]);
  }

  const openEdit = useCallback(async (r: FlightRow) => {
    if (!token) return;
    setEditId(r.id); setEditOfferId(r.offer_id ?? null); setEditStatus(r.offer?.status ?? r.status ?? null);
    setForm(null); setCustomFields({}); setServerCabins(null); setFormLoading(true); setFormErrLines([]);
    try {
      const [detailRes, cabinsRes] = await Promise.all([apiFlight(token, r.id), apiFlightCabins(token, r.id)]);
      setForm(flightFormFromDetail({ ...detailRes.data, cabins: cabinsRes.data ?? [] }));
      setServerCabins({ flightId: r.id, rows: cabinsRes.data ?? [] });
      setCustomFields(await apiCustomFieldValues(token, "flight", r.id).catch(() => ({})));
    } catch (e) {
      setEditId(null);
      setErr(e instanceof ApiRequestError ? e.message : "Failed");
    } finally { setFormLoading(false); }
  }, [token]);

  function closeForm() { setForm(null); setEditId(null); setFormErrLines([]); setFormLoading(false); }

  useEffect(() => {
    if (form === null && !formLoading && !readOnly && userHasPermission(user, "flights.create")) {
      registerAction(<button className="btn btn-primary" onClick={openCreate}><i className="ti ti-plus" />{s.flNew}</button>);
    } else { registerAction(null); }
    return () => registerAction(null);
  }, [form, formLoading, readOnly, user, registerAction, s.flNew]);

  async function handleSubmit() {
    if (!token || !form) return;
    const mode = editId != null ? "edit" : "create";
    const validation = validateFlightOperatorForm(form, mode);
    if (validation.length > 0) { setFormErrLines(validation); return; }
    setBusy(true); setFormErrLines([]);
    try {
      let flightId: number;
      if (editId != null) {
        const res = await apiUpdateFlight(token, editId, { ...flightUpdateBodyFromForm(form), custom_fields: customFields });
        flightId = res.data?.id ?? editId;
      } else {
        const res = await apiCreateFlight(token, { ...flightCreateBodyFromForm(form), custom_fields: customFields });
        flightId = res.data?.id ?? 0;
      }
      if (flightId > 0) {
        const persisted = serverCabins?.rows ?? [];
        const { toDelete, toUpdate, toCreate } = diffFlightCabins(form.cabins, persisted);
        for (const id of toDelete) { try { await apiDeleteFlightCabin(token, flightId, id); } catch { /* best effort */ } }
        for (const u of toUpdate) {
          try { await apiUpdateFlightCabin(token, flightId, u.id, u.body); }
          catch (e) { if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) throw e; }
        }
        const startIdx = editId == null && persisted.length === 0 ? 1 : 0;
        for (let i = startIdx; i < toCreate.length; i++) {
          try { await apiCreateFlightCabin(token, flightId, toCreate[i]!); }
          catch (e) { if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) throw e; }
        }
      }
      closeForm(); showToast(s.flSavedToast); await load();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) setFormErrLines(formatFlightApiValidationErrors(e.body.errors));
      else setFormErrLines([e instanceof ApiRequestError ? e.message : "Failed"]);
    } finally { setBusy(false); }
  }

  async function handleDelete(r: FlightRow) {
    if (!token) return;
    const ok = await confirm({ message: s.flDeleteConfirm, variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try { await apiDeleteFlight(token, r.id); showToast(s.flDeletedToast); await load(); }
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

  function set<K extends keyof FlightFormPayload>(key: K, val: FlightFormPayload[K]) {
    setForm((p) => (p ? { ...p, [key]: val } : p));
  }
  function updateCabin(idx: number, patch: Partial<FlightCabinFormRow>) {
    setForm((p) => (p ? { ...p, cabins: p.cabins.map((c, i) => (i === idx ? { ...c, ...patch } : c)) } : p));
  }
  function addCabin() {
    setForm((p) => {
      if (!p) return p;
      const used = new Set(p.cabins.map((c) => c.cabin_class));
      const next = FLIGHT_CABIN_CLASSES.find((c) => !used.has(c)) ?? "economy";
      return { ...p, cabins: [...p.cabins, newFlightCabinFormRow({ cabin_class: next })] };
    });
  }
  function removeCabin(idx: number) {
    setForm((p) => (p && p.cabins.length > 1 ? { ...p, cabins: p.cabins.filter((_, i) => i !== idx) } : p));
  }
  const numOrEmpty = (v: string): number | "" => (v === "" ? "" : Number(v));

  if (forbidden) return <div className="card"><div className="card-body"><ForbiddenNotice /></div></div>;
  if (formLoading) return <div className="card"><div className="card-body" style={{ textAlign: "center", color: "var(--text-secondary)", padding: 32 }}>{s.loading}</div></div>;

  // ── DETAIL / CREATE FORM ─────────────────────────────────────────
  if (form) {
    const isEdit = editId != null;
    const connected = form.connection_type !== "direct";
    return (
      <div>
        <button className="btn btn-ghost detail-back" onClick={closeForm}><i className="ti ti-arrow-left" />{s.flBack}</button>
        <div className="detail-head">
          <div className="detail-logo"><i className="ti ti-plane-tilt" /></div>
          <div>
            <div className="detail-title">{form.flight_code_internal || s.flNew}</div>
            <div className="detail-meta"><span className="font-mono">{isEdit ? `#${editId}` : "—"}</span></div>
          </div>
          <div className="detail-head-right">{isEdit && editStatus && <span className={`badge ${statusBadgeClass(editStatus)}`}>{editStatus}</span>}</div>
        </div>

        {/* General */}
        <div className="card"><div className="card-body">
          <div className="form-section"><i className="ti ti-info-circle" />{s.flSecGeneral}</div>
          <div className="form-grid">
            {!isEdit && (
              <div className="fld"><label className="fld-label">{s.fOfferId} <span style={{ color: "var(--danger)" }}>*</span></label>
                <input type="number" value={form.offer_id} onChange={(e) => set("offer_id", numOrEmpty(e.target.value))} placeholder="3301" />
                <span className="fld-hint">{s.flOfferHint}</span></div>
            )}
            <div className="fld"><label className="fld-label">{s.flCode} <span style={{ color: "var(--danger)" }}>*</span></label><input type="text" value={form.flight_code_internal} onChange={(e) => set("flight_code_internal", e.target.value)} placeholder="ARM-EVN-CDG" /></div>
            <div className="fld"><label className="fld-label">{s.flServiceType} <span style={{ color: "var(--danger)" }}>*</span></label><select value={form.service_type} onChange={(e) => set("service_type", e.target.value)}>{SERVICE_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
            <div className="fld"><label className="fld-label">{s.fLifecycle} <span style={{ color: "var(--danger)" }}>*</span></label><select value={form.status} onChange={(e) => set("status", e.target.value)}>{LIFECYCLE.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
            <div className="fld span-2"><label className="fld-label">{s.fShortDesc}</label><textarea rows={2} value={form.short_description} onChange={(e) => set("short_description", e.target.value)} /></div>
            <div className="fld span-2"><label className="fld-label">{s.fMainImage}</label><ImageUploadField value={form.main_image} onChange={(v) => set("main_image", v)} section="flights" label="" /></div>
          </div>

          {/* Departure */}
          <div className="form-section"><i className="ti ti-plane-departure" />{s.flSecDeparture}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{s.flDepLocation}</label>
              <LocationCascadeSelect token={token} value={form.departure_location_id === "" ? null : Number(form.departure_location_id)} label=""
                onChange={(id, m) => setForm((p) => p ? { ...p, departure_location_id: id ?? "", departure_country: m.country?.name ?? p.departure_country, departure_city: m.city?.name ?? p.departure_city } : p)} /></div>
            <div className="fld"><label className="fld-label">{s.flDepAirportName} <span style={{ color: "var(--danger)" }}>*</span></label><input type="text" value={form.departure_airport} onChange={(e) => set("departure_airport", e.target.value)} placeholder="Zvartnots Intl" /></div>
            <div className="fld"><label className="fld-label">{s.flDepIata}</label><input type="text" maxLength={8} style={{ textTransform: "uppercase" }} value={form.departure_airport_code} onChange={(e) => set("departure_airport_code", e.target.value.toUpperCase())} placeholder="EVN" /></div>
            <div className="fld"><label className="fld-label">{s.flDepTerminal}</label><input type="text" value={form.departure_terminal} onChange={(e) => set("departure_terminal", e.target.value)} placeholder="1" /></div>
            <div className="fld"><label className="fld-label">{s.flDepCityOv}</label><input type="text" value={form.departure_city} onChange={(e) => set("departure_city", e.target.value)} placeholder="Yerevan" /></div>
            <div className="fld"><label className="fld-label">{s.flDepCountryOv}</label><input type="text" value={form.departure_country} onChange={(e) => set("departure_country", e.target.value)} placeholder="Armenia" /></div>
          </div>

          {/* Arrival */}
          <div className="form-section"><i className="ti ti-plane-arrival" />{s.flSecArrival}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{s.flArrLocation}</label>
              <LocationCascadeSelect token={token} value={form.arrival_location_id === "" ? null : Number(form.arrival_location_id)} label=""
                onChange={(id, m) => setForm((p) => p ? { ...p, arrival_location_id: id ?? "", arrival_country: m.country?.name ?? p.arrival_country, arrival_city: m.city?.name ?? p.arrival_city } : p)} /></div>
            <div className="fld"><label className="fld-label">{s.flArrAirportName} <span style={{ color: "var(--danger)" }}>*</span></label><input type="text" value={form.arrival_airport} onChange={(e) => set("arrival_airport", e.target.value)} placeholder="Charles de Gaulle" /></div>
            <div className="fld"><label className="fld-label">{s.flArrIata}</label><input type="text" maxLength={8} style={{ textTransform: "uppercase" }} value={form.arrival_airport_code} onChange={(e) => set("arrival_airport_code", e.target.value.toUpperCase())} placeholder="CDG" /></div>
            <div className="fld"><label className="fld-label">{s.flArrTerminal}</label><input type="text" value={form.arrival_terminal} onChange={(e) => set("arrival_terminal", e.target.value)} placeholder="2E" /></div>
            <div className="fld"><label className="fld-label">{s.flArrCityOv}</label><input type="text" value={form.arrival_city} onChange={(e) => set("arrival_city", e.target.value)} placeholder="Paris" /></div>
            <div className="fld"><label className="fld-label">{s.flArrCountryOv}</label><input type="text" value={form.arrival_country} onChange={(e) => set("arrival_country", e.target.value)} placeholder="France" /></div>
          </div>

          {/* Schedule */}
          <div className="form-section"><i className="ti ti-clock-hour-4" />{s.flSecSchedule}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{s.flDepAt} <span style={{ color: "var(--danger)" }}>*</span></label><input type="datetime-local" value={form.departure_at} onChange={(e) => set("departure_at", e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.flArrAt} <span style={{ color: "var(--danger)" }}>*</span></label><input type="datetime-local" value={form.arrival_at} onChange={(e) => set("arrival_at", e.target.value)} /><span className="fld-hint">{s.flArrAtHint}</span></div>
            <div className="fld"><label className="fld-label">{s.flDuration} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" value={form.duration_minutes} onChange={(e) => set("duration_minutes", numOrEmpty(e.target.value))} placeholder="260" /></div>
            <div className="fld"><label className="fld-label">{s.flTimezone}</label><input type="text" maxLength={64} value={form.timezone_context} onChange={(e) => set("timezone_context", e.target.value)} placeholder="Europe/Paris" /></div>
            <div className="fld"><label className="fld-label">{s.flCheckInClose}</label><input type="datetime-local" value={form.check_in_close_at} onChange={(e) => set("check_in_close_at", e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.flBoardingClose}</label><input type="datetime-local" value={form.boarding_close_at} onChange={(e) => set("boarding_close_at", e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.flConnType} <span style={{ color: "var(--danger)" }}>*</span></label><select value={form.connection_type} onChange={(e) => set("connection_type", e.target.value)}><option value="direct">direct</option><option value="connected">connected</option></select></div>
            <div className="fld"><label className="fld-label">{s.flStops} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" value={form.stops_count} onChange={(e) => set("stops_count", numOrEmpty(e.target.value))} placeholder="0" /></div>
            {connected && (
              <div className="fld span-2"><div className="form-grid">
                <div className="fld"><label className="fld-label">{s.flConnNotes}</label><input type="text" value={form.connection_notes} onChange={(e) => set("connection_notes", e.target.value)} /></div>
                <div className="fld"><label className="fld-label">{s.flLayover}</label><input type="text" value={form.layover_summary} onChange={(e) => set("layover_summary", e.target.value)} /></div>
              </div></div>
            )}
          </div>

          {/* Age tiers */}
          <div className="form-section"><i className="ti ti-users-group" />{s.flSecAge}<span className="fs-hint">{s.flAgeHint}</span></div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{s.flAdultFrom}</label><input type="number" value={form.adult_age_from} onChange={(e) => set("adult_age_from", numOrEmpty(e.target.value))} /></div>
            <div className="fld"><label className="fld-label">{s.flChildFrom}</label><input type="number" value={form.child_age_from} onChange={(e) => set("child_age_from", numOrEmpty(e.target.value))} /></div>
            <div className="fld"><label className="fld-label">{s.flChildTo}</label><input type="number" value={form.child_age_to} onChange={(e) => set("child_age_to", numOrEmpty(e.target.value))} /></div>
            <div className="fld"><label className="fld-label">{s.flInfantFrom}</label><input type="number" value={form.infant_age_from} onChange={(e) => set("infant_age_from", numOrEmpty(e.target.value))} /></div>
            <div className="fld"><label className="fld-label">{s.flInfantTo}</label><input type="number" value={form.infant_age_to} onChange={(e) => set("infant_age_to", numOrEmpty(e.target.value))} /></div>
          </div>
        </div></div>

        {/* Cabins */}
        <div className="card"><div className="card-body">
          <div className="form-section"><i className="ti ti-armchair" />{s.flSecCabins}<span className="fs-hint">{s.flCabinsHint}</span></div>
          <div className="rep-list">
            {form.cabins.map((cabin, ci) => (
              <div className="rep-card" key={cabin.client_key}>
                <div className="rep-head">
                  <span className="rep-idx">{s.flCabin} {ci + 1}{ci === 0 ? ` · ${s.flPrimary}` : ""}</span>
                  <div className="rep-title">{cabin.cabin_class}</div>
                  {form.cabins.length > 1 && <button className="icon-btn danger" title={s.delete} onClick={() => removeCabin(ci)}><i className="ti ti-trash" /></button>}
                </div>
                <div className="form-grid">
                  <div className="fld"><label className="fld-label">{s.flCabinClass} <span style={{ color: "var(--danger)" }}>*</span></label><select value={cabin.cabin_class} onChange={(e) => updateCabin(ci, { cabin_class: e.target.value })}>{FLIGHT_CABIN_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="fld"><label className="fld-label">{s.flSeatsTotal} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" value={cabin.seat_capacity_total} onChange={(e) => updateCabin(ci, { seat_capacity_total: numOrEmpty(e.target.value) })} placeholder="160" /></div>
                  <div className="fld"><label className="fld-label">{s.flSeatsAvail} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" value={cabin.seat_capacity_available} onChange={(e) => updateCabin(ci, { seat_capacity_available: numOrEmpty(e.target.value) })} placeholder="42" /></div>
                  <div className="fld"><label className="fld-label">{s.flAdultPrice} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" step={0.01} value={cabin.adult_price} onChange={(e) => updateCabin(ci, { adult_price: numOrEmpty(e.target.value) })} placeholder="320.00" /></div>
                  <div className="fld"><label className="fld-label">{s.flChildPrice} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" step={0.01} value={cabin.child_price} onChange={(e) => updateCabin(ci, { child_price: numOrEmpty(e.target.value) })} placeholder="240.00" /></div>
                  <div className="fld"><label className="fld-label">{s.flInfantPrice} <span style={{ color: "var(--danger)" }}>*</span></label><input type="number" step={0.01} value={cabin.infant_price} onChange={(e) => updateCabin(ci, { infant_price: numOrEmpty(e.target.value) })} placeholder="40.00" /></div>
                  <div className="fld"><label className="fld-label">{s.flFareFamily}</label><input type="text" maxLength={100} value={cabin.fare_family} onChange={(e) => updateCabin(ci, { fare_family: e.target.value })} placeholder="Light" /></div>
                  <div className="fld"><label className="fld-label">{s.flHandBagWeight}</label><input type="text" maxLength={32} value={cabin.hand_baggage_weight} onChange={(e) => updateCabin(ci, { hand_baggage_weight: e.target.value })} placeholder="8kg" /></div>
                  <div className="fld"><label className="fld-label">{s.flCheckedBagWeight}</label><input type="text" maxLength={32} value={cabin.checked_baggage_weight} onChange={(e) => updateCabin(ci, { checked_baggage_weight: e.target.value })} placeholder="23kg" /></div>
                </div>
                <div className="perm-check" style={{ marginTop: 12 }}>
                  <label><input type="checkbox" checked={cabin.hand_baggage_included} onChange={(e) => updateCabin(ci, { hand_baggage_included: e.target.checked })} />{s.flHandBagInc}</label>
                  <label><input type="checkbox" checked={cabin.checked_baggage_included} onChange={(e) => updateCabin(ci, { checked_baggage_included: e.target.checked })} />{s.flCheckedBagInc}</label>
                  <label><input type="checkbox" checked={cabin.extra_baggage_allowed} onChange={(e) => updateCabin(ci, { extra_baggage_allowed: e.target.checked })} />{s.flExtraBag}</label>
                  <label><input type="checkbox" checked={cabin.seat_map_available} onChange={(e) => updateCabin(ci, { seat_map_available: e.target.checked })} />{s.flSeatMap}</label>
                </div>
              </div>
            ))}
          </div>
          <button className="btn rep-add" onClick={addCabin}><i className="ti ti-plus" />{s.flAddCabin}</button>
          <div className="note-inline"><i className="ti ti-info-circle" />{s.flCabinDiffNote}</div>
        </div></div>

        {/* Policies + Visibility + Custom fields */}
        <div className="card"><div className="card-body">
          <div className="form-section"><i className="ti ti-file-description" />{s.flSecPolicies}</div>
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{s.flCancelPolicy} <span style={{ color: "var(--danger)" }}>*</span></label><select value={form.cancellation_policy_type} onChange={(e) => set("cancellation_policy_type", e.target.value)}>{CANCEL_POLICY.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
            <div className="fld"><label className="fld-label">{s.flChangePolicy} <span style={{ color: "var(--danger)" }}>*</span></label><select value={form.change_policy_type} onChange={(e) => set("change_policy_type", e.target.value)}>{CHANGE_POLICY.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
            <div className="fld"><label className="fld-label">{s.flResDeadline}</label><input type="datetime-local" value={form.reservation_deadline_at} onChange={(e) => set("reservation_deadline_at", e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.flCancelDeadline}</label><input type="datetime-local" value={form.cancellation_deadline_at} onChange={(e) => set("cancellation_deadline_at", e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.flChangeDeadline}</label><input type="datetime-local" value={form.change_deadline_at} onChange={(e) => set("change_deadline_at", e.target.value)} /></div>
            <div className="fld span-2"><label className="fld-label">{s.flPolicyNotes}</label><textarea rows={2} value={form.policy_notes} onChange={(e) => set("policy_notes", e.target.value)} /></div>
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.reservation_allowed} onChange={(e) => set("reservation_allowed", e.target.checked)} /><span className="switch-slider" /></span>{s.flResAllowed}</label>
            <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.online_checkin_allowed} onChange={(e) => set("online_checkin_allowed", e.target.checked)} /><span className="switch-slider" /></span>{s.flOnlineCheckin}</label>
            <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.airport_checkin_allowed} onChange={(e) => set("airport_checkin_allowed", e.target.checked)} /><span className="switch-slider" /></span>{s.flAirportCheckin}</label>
          </div>

          <div className="form-section"><i className="ti ti-eye" />{s.flSecVisibility}</div>
          <div className="form-grid">
            <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.is_package_eligible} onChange={(e) => set("is_package_eligible", e.target.checked)} /><span className="switch-slider" /></span>{s.fPkgEligible}</label>
            <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.appears_in_web} onChange={(e) => set("appears_in_web", e.target.checked)} /><span className="switch-slider" /></span>{s.flAppearsWeb}</label>
            <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.appears_in_admin} onChange={(e) => set("appears_in_admin", e.target.checked)} /><span className="switch-slider" /></span>{s.flAppearsAdmin}</label>
            <label className="switch-row"><span className="switch"><input type="checkbox" checked={form.appears_in_zulu_admin} onChange={(e) => set("appears_in_zulu_admin", e.target.checked)} /><span className="switch-slider" /></span>{s.flAppearsZulu}</label>
          </div>

          <div className="form-section"><i className="ti ti-adjustments" />{s.hSecCustom}</div>
          <CustomFieldsRenderer scope="flight" values={customFields} onChange={setCustomFields} />
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
          <button className="btn btn-primary" disabled={busy} onClick={() => void handleSubmit()}><i className="ti ti-check" />{busy ? s.saving : s.flSave}</button>
        </div></div>
      </div>
    );
  }

  // ── LIST ─────────────────────────────────────────────────────────
  const shown = rows.filter((r) =>
    (!fDepCity || (r.departure_city ?? "").toLowerCase().includes(fDepCity.toLowerCase())) &&
    (!fArrCity || (r.arrival_city ?? "").toLowerCase().includes(fArrCity.toLowerCase())) &&
    (!fStatus || (r.status) === fStatus)
  );
  const total = meta?.total ?? shown.length;
  const active = rows.filter((r) => (r.offer?.status ?? r.status) === "active").length;
  const pending = rows.filter((r) => (r.offer?.status ?? r.status) === "pending_review").length;
  const from = shown.length ? (page - 1) * 20 + 1 : 0;
  const to = (page - 1) * 20 + shown.length;

  return (
    <div>
      {readOnly && <div className="alert oversight-note"><i className="ti ti-eye" /><div>{s.oversightBanner}</div></div>}

      <div className="filter-card">
        {readOnly && <div className="filter-field"><span className="filter-label">{s.company}</span><input type="text" placeholder={s.company} /></div>}
        <div className="filter-field" style={{ flex: 2 }}><span className="filter-label">{s.flfDepCity}</span><input type="text" value={fDepCity} onChange={(e) => setFDepCity(e.target.value)} placeholder="Yerevan" /></div>
        <div className="filter-field"><span className="filter-label">{s.flfArrCity}</span><input type="text" value={fArrCity} onChange={(e) => setFArrCity(e.target.value)} placeholder="Paris" /></div>
        <div className="filter-field"><span className="filter-label">{s.status}</span>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">{s.all}</option>{LIFECYCLE.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-plane-tilt" /></div><div className="stat-value">{total}</div><div className="stat-label">{s.flStatTotal}</div></div>
        <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-circle-check" /></div><div className="stat-value">{active}</div><div className="stat-label">{s.statActive}</div></div>
        <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-clock" /></div><div className="stat-value">{pending}</div><div className="stat-label">{s.statPending}</div></div>
        <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-armchair" /></div><div className="stat-value">{rows.length}</div><div className="stat-label">{s.flStatCabins}</div></div>
      </div>

      {err && <div className="alert" style={{ background: "var(--danger-light)", color: "var(--danger-dark)" }}><i className="ti ti-alert-triangle" /><div>{err}</div></div>}

      <div className="card">
        <div className="card-header"><div><div className="card-title">{s.tabFlights}</div><div className="card-subtitle">{s.flCardSub}</div></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>{s.id}</th><th>{s.flColRoute}</th>{readOnly && <th data-oversight>{s.company}</th>}<th>{s.flColRouteCol}</th><th>{s.flColDeparture}</th><th>{s.flOfferStatus}</th><th>{s.flFlightStatus}</th><th style={{ textAlign: "right" }}>{s.actions}</th>
            </tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={readOnly ? 8 : 7} className="no-label" style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>{s.empty}</td></tr>}
              {shown.map((r) => {
                const ost = r.offer?.status ?? "";
                return (
                  <tr key={r.id} onClick={() => !readOnly && void openEdit(r)}>
                    <td className="font-mono m-primary" data-label={s.id}>#{r.id}</td>
                    <td data-label={s.flColRoute}><div className="font-semibold">{r.flight_code_internal ?? "—"}</div><div className="text-sm cell-muted">{r.service_type ?? ""}</div></td>
                    {readOnly && <td data-label={s.company}>{r.company_id ?? "—"}</td>}
                    <td data-label={s.flColRouteCol}>{[r.departure_airport, r.departure_city].filter(Boolean).join(" ")} → {[r.arrival_airport, r.arrival_city].filter(Boolean).join(" ")}</td>
                    <td data-label={s.flColDeparture}>{fmtDT(r.departure_at)}</td>
                    <td data-label={s.flOfferStatus}><span className={`badge ${statusBadgeClass(ost)}`}>{ost || "—"}</span></td>
                    <td data-label={s.flFlightStatus}><span className={`badge ${statusBadgeClass(r.status)}`}>{r.status ?? "—"}</span></td>
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
