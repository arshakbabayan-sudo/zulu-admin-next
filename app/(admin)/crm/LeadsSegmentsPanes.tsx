"use client";

/**
 * CRM Leads + Segments panes (2026-06-12, roadmap §4 — the two former
 * "coming soon" Sales tabs).
 *
 * Design: docs/admin_designe/new-admin-designe/crm.html — Leads = 4 KPI
 * tiles + filter card + table (Lead / Source / Interest / Status / Owner /
 * Created / Actions with Convert); Segments = card grid (dynamic/static,
 * contact count) + rule-builder drawer. Styled with the same management.css
 * primitives the rest of CrmPage uses.
 *
 * Backend: lib/crm-leads-api.ts → /platform-admin/crm/leads + /crm/segments.
 * Write gating mirrors the server: leads are writable by any company member
 * (row-scoped employees keep their own), segments only by owners/managers —
 * the UI additionally hides segment write actions from plain employees.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { crmStrings, type CrmKey } from "./crm-i18n";
import type { PaneProps } from "./CrmPage";
import {
  apiCrmLeads,
  apiCrmLeadsStats,
  apiCreateCrmLead,
  apiUpdateCrmLead,
  apiDeleteCrmLead,
  apiConvertCrmLead,
  apiCrmSegments,
  apiCreateCrmSegment,
  apiUpdateCrmSegment,
  apiDeleteCrmSegment,
  apiCrmSegmentContacts,
  apiAddCrmSegmentMember,
  apiRemoveCrmSegmentMember,
  CRM_LEAD_SOURCES,
  CRM_LEAD_INTERESTS,
  CRM_LEAD_SETTABLE_STATUSES,
  type CrmLead,
  type CrmLeadBody,
  type CrmLeadsStats,
  type CrmSegment,
  type CrmSegmentContact,
  type CrmSegmentRules,
  type CrmSegmentType,
} from "@/lib/crm-leads-api";
import { apiCrmTeam } from "@/lib/crm-api";
import { apiCrmCustomers, type CustomerRow } from "@/lib/customers-api";

// ── local helpers (kept module-local to avoid a circular import on CrmPage) ──
function initials(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const AVATAR_TONES = ["", "avatar-teal", "avatar-amber", "avatar-blue"] as const;
function avatarTone(key: string | number | null | undefined): string {
  if (key == null) return "";
  const sKey = String(key);
  let hash = 0;
  for (let i = 0; i < sKey.length; i++) hash = (hash * 31 + sKey.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

function fmtDate(input: string | null | undefined): string {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB");
}

const LEAD_STATUS_BADGE: Record<string, string> = {
  new: "badge-info",
  contacted: "badge-warning",
  qualified: "badge-success",
  unqualified: "badge-danger",
  converted: "badge-gray",
};
const LEAD_STATUS_KEY: Record<string, CrmKey> = {
  new: "ldStNew",
  contacted: "ldStContacted",
  qualified: "ldStQualified",
  unqualified: "ldStUnqualified",
  converted: "ldStConverted",
};
const LEAD_SOURCE_KEY: Record<string, CrmKey> = {
  website: "ldSrcWebsite",
  referral: "ldSrcReferral",
  social: "ldSrcSocial",
  walk_in: "ldSrcWalkIn",
  partner: "ldSrcPartner",
};
const LEAD_INTEREST_KEY: Record<string, CrmKey> = {
  hotel: "ldIntHotel",
  flight: "ldIntFlight",
  package: "ldIntPackage",
  tour: "ldIntTour",
  transfer: "ldIntTransfer",
};

type OwnerOption = { id: number; name: string };

// ════════════════════════════════════════════════════════════════
// Leads pane — KPI tiles + filter card + table + create/edit drawer
// ════════════════════════════════════════════════════════════════
type LeadDrawerState = { mode: "create" } | { mode: "edit"; row: CrmLead } | null;

export function LeadsPane({ token, lang, registerAction, showToast }: PaneProps) {
  const s = crmStrings(lang);
  const [rows, setRows] = useState<CrmLead[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<CrmLeadsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [interestFilter, setInterestFilter] = useState("");
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<LeadDrawerState>(null);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  // Out-of-order guard: only the latest request may commit state (fast
  // filter/page flips can resolve out of order).
  const reqRef = useRef(0);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    if (!token) return;
    const reqId = ++reqRef.current;
    setLoading(true);
    setErr(null);
    try {
      const [listRes, statsRes] = await Promise.all([
        apiCrmLeads(token, {
          page,
          per_page: PER_PAGE,
          search: search || undefined,
          status: statusFilter || undefined,
          source: sourceFilter || undefined,
          interest: interestFilter || undefined,
        }),
        apiCrmLeadsStats(token).catch(() => null),
      ]);
      if (reqRef.current !== reqId) return;
      // Deleting the last row of the last page leaves us out of range —
      // step back instead of showing a bogus empty state.
      if (listRes.data.length === 0 && page > 1) {
        setPage((p) => Math.max(1, p - 1));
        return;
      }
      setRows(listRes.data);
      setTotal(listRes.meta.total ?? listRes.data.length);
      if (statsRes) setStats(statsRes.data);
    } catch (e) {
      if (reqRef.current === reqId) setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      if (reqRef.current === reqId) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, search, statusFilter, sourceFilter, interestFilter]);
  useEffect(() => { void load(); }, [load]);

  // Owner options for the drawer's assign select — the company's team.
  useEffect(() => {
    if (!token) return;
    apiCrmTeam(token)
      .then((res) => setOwners(res.data.map((r) => ({ id: r.user.id, name: r.user.name }))))
      .catch(() => setOwners([]));
  }, [token]);

  useEffect(() => {
    registerAction(
      <button className="btn btn-primary" onClick={() => setDrawer({ mode: "create" })}>
        <i className="ti ti-plus" />
        {s.actNewLead}
      </button>
    );
    return () => registerAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  async function convert(row: CrmLead) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.ldConvertConfirm)) return;
    try {
      await apiConvertCrmLead(token, row.id);
      showToast(s.ldConvertedToast);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }

  async function remove(row: CrmLead) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.confirmDeleteLead)) return;
    try {
      await apiDeleteCrmLead(token, row.id);
      showToast(s.ldDeletedToast);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }

  const start = (page - 1) * PER_PAGE;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card c-primary">
          <div className="stat-header"><i className="ti ti-user-plus" /></div>
          <div className="stat-value">{stats?.new_7d ?? "—"}</div>
          <div className="stat-label">{s.ldStatNew7d}</div>
        </div>
        <div className="stat-card c-success">
          <div className="stat-header"><i className="ti ti-user-check" /></div>
          <div className="stat-value">{stats?.qualified ?? "—"}</div>
          <div className="stat-label">{s.ldStatQualified}</div>
        </div>
        <div className="stat-card c-info">
          <div className="stat-header"><i className="ti ti-arrow-guide" /></div>
          <div className="stat-value">{stats ? `${stats.conversion_rate}%` : "—"}</div>
          <div className="stat-label">{s.ldStatConversion}</div>
        </div>
        <div className="stat-card c-warning">
          <div className="stat-header"><i className="ti ti-user-question" /></div>
          <div className="stat-value">{stats?.unassigned ?? "—"}</div>
          <div className="stat-label">{s.ldStatUnassigned}</div>
        </div>
      </div>

      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input
            type="search"
            placeholder={s.ldSearchPh}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setPage(1), setSearch(searchInput.trim()))}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.ldFltSource}</span>
          <select value={sourceFilter} onChange={(e) => { setPage(1); setSourceFilter(e.target.value); }}>
            <option value="">{s.ldAllSources}</option>
            {CRM_LEAD_SOURCES.map((src) => (
              <option key={src} value={src}>{s[LEAD_SOURCE_KEY[src]!]}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.status}</span>
          <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}>
            <option value="">{s.ldAllStatuses}</option>
            {Object.keys(LEAD_STATUS_KEY).map((st) => (
              <option key={st} value={st}>{s[LEAD_STATUS_KEY[st]!]}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.ldFltInterest}</span>
          <select value={interestFilter} onChange={(e) => { setPage(1); setInterestFilter(e.target.value); }}>
            <option value="">{s.ldAllInterests}</option>
            {CRM_LEAD_INTERESTS.map((it) => (
              <option key={it} value={it}>{s[LEAD_INTEREST_KEY[it]!]}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => { setPage(1); setSearch(searchInput.trim()); }}>
          <i className="ti ti-filter" />
          {s.apply}
        </button>
      </div>

      {err ? <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div> : null}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.ldColLead}</th>
                <th>{s.ldColSource}</th>
                <th>{s.ldColInterest}</th>
                <th>{s.ldColStatus}</th>
                <th>{s.ldColOwner}</th>
                <th>{s.ldColCreated}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.ldEmpty}</td></tr>
              ) : (
                rows.map((l) => (
                  <tr key={l.id} onClick={() => setDrawer({ mode: "edit", row: l })}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className={`avatar sm ${avatarTone(l.id)}`}>{initials(l.name)}</span>
                        <span>
                          <span className="font-semibold" style={{ display: "block" }}>{l.name}</span>
                          <span className="cell-muted" style={{ fontSize: 12 }}>
                            {l.b2b_company ? `B2B · ${l.b2b_company}` : l.email || l.phone || "—"}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td>
                      {l.source ? (
                        <span className="badge badge-gray">{s[LEAD_SOURCE_KEY[l.source] ?? "none"]}</span>
                      ) : (
                        <span className="cell-muted">—</span>
                      )}
                    </td>
                    <td>{l.interest ? s[LEAD_INTEREST_KEY[l.interest] ?? "none"] : <span className="cell-muted">—</span>}</td>
                    <td>
                      <span className={`badge ${LEAD_STATUS_BADGE[l.status] ?? "badge-gray"}`}>
                        {s[LEAD_STATUS_KEY[l.status] ?? "none"]}
                      </span>
                    </td>
                    <td>{l.owner?.name ?? <span className="cell-muted">{s.ldUnassigned}</span>}</td>
                    <td className="cell-muted">{fmtDate(l.created_at)}</td>
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                        {l.status !== "converted" ? (
                          <button className="btn btn-sm btn-primary" onClick={() => void convert(l)}>
                            <i className="ti ti-arrow-right" />
                            {s.ldConvert}
                          </button>
                        ) : null}
                        <button className="icon-btn" title={s.edit} onClick={() => setDrawer({ mode: "edit", row: l })}>
                          <i className="ti ti-pencil" />
                        </button>
                        <button className="icon-btn danger" title={s.delete} onClick={() => void remove(l)}>
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > 0 ? (
          <div className="pagination">
            <span className="pagination-info">
              {`${start + 1}–${Math.min(start + PER_PAGE, total)} / ${total}`}
            </span>
            <div className="pagination-controls">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{s.prev}</button>
              <button className="btn btn-sm btn-primary">{page}</button>
              <button className="btn btn-sm" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>{s.next}</button>
            </div>
          </div>
        ) : null}
      </div>

      <LeadDrawer
        state={drawer}
        lang={lang}
        token={token}
        owners={owners}
        onClose={() => setDrawer(null)}
        onSaved={() => { setDrawer(null); showToast(s.ldSavedToast); void load(); }}
      />
    </div>
  );
}

function LeadDrawer({
  state,
  lang,
  token,
  owners,
  onClose,
  onSaved,
}: {
  state: LeadDrawerState;
  lang: string;
  token: string | null;
  owners: OwnerOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const s = crmStrings(lang);
  const isEdit = state?.mode === "edit";
  const converted = state?.mode === "edit" && state.row.status === "converted";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [b2b, setB2b] = useState("");
  const [source, setSource] = useState("");
  const [interest, setInterest] = useState("");
  const [status, setStatus] = useState("new");
  const [ownerId, setOwnerId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      setName(state.row.name);
      setEmail(state.row.email ?? "");
      setPhone(state.row.phone ?? "");
      setB2b(state.row.b2b_company ?? "");
      setSource(state.row.source ?? "");
      setInterest(state.row.interest ?? "");
      setStatus(state.row.status);
      setOwnerId(state.row.owner ? String(state.row.owner.id) : "");
      setNotes(state.row.notes ?? "");
    } else {
      setName(""); setEmail(""); setPhone(""); setB2b("");
      setSource(""); setInterest(""); setStatus("new"); setOwnerId(""); setNotes("");
    }
  }, [state]);

  async function submit() {
    if (!token || !state) return;
    setBusy(true);
    try {
      const body: CrmLeadBody = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        b2b_company: b2b.trim() || null,
        source: source || null,
        interest: interest || null,
        notes: notes.trim() || null,
      };
      if (!converted && status !== "converted") body.status = status;
      if (state.mode === "edit") {
        body.owner_user_id = ownerId ? Number(ownerId) : null;
        await apiUpdateCrmLead(token, state.row.id, body);
      } else {
        if (ownerId) body.owner_user_id = Number(ownerId);
        await apiCreateCrmLead(token, body);
      }
      onSaved();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`drawer-overlay ${state ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${state ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div className="card-title">{isEdit ? s.ldDrawerEditTitle : s.ldDrawerNewTitle}</div>
            <div className="card-subtitle">{s.ldDrawerSubtitle}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          <div className="fld mb-3">
            <span className="fld-label">{s.ldFldName}</span>
            <input value={name} placeholder={s.ldFldNamePh} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-grid-2">
            <div className="fld">
              <span className="fld-label">{s.ldFldEmail}</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="fld">
              <span className="fld-label">{s.ldFldPhone}</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="fld" style={{ marginTop: 12 }}>
            <span className="fld-label">{s.ldFldB2b}</span>
            <input value={b2b} placeholder={s.ldFldB2bPh} onChange={(e) => setB2b(e.target.value)} />
          </div>
          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div className="fld">
              <span className="fld-label">{s.ldFltSource}</span>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">—</option>
                {CRM_LEAD_SOURCES.map((src) => (
                  <option key={src} value={src}>{s[LEAD_SOURCE_KEY[src]!]}</option>
                ))}
              </select>
            </div>
            <div className="fld">
              <span className="fld-label">{s.ldFltInterest}</span>
              <select value={interest} onChange={(e) => setInterest(e.target.value)}>
                <option value="">—</option>
                {CRM_LEAD_INTERESTS.map((it) => (
                  <option key={it} value={it}>{s[LEAD_INTEREST_KEY[it]!]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div className="fld">
              <span className="fld-label">{s.ldColStatus}</span>
              <select value={status} disabled={converted} onChange={(e) => setStatus(e.target.value)}>
                {converted ? <option value="converted">{s.ldStConverted}</option> : null}
                {CRM_LEAD_SETTABLE_STATUSES.map((st) => (
                  <option key={st} value={st}>{s[LEAD_STATUS_KEY[st]!]}</option>
                ))}
              </select>
            </div>
            <div className="fld">
              <span className="fld-label">{s.ldColOwner}</span>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">{s.ldUnassigned}</option>
                {owners.map((o) => (
                  <option key={o.id} value={String(o.id)}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="fld" style={{ marginTop: 12 }}>
            <span className="fld-label">{s.ldFldNotes}</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="drawer-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy || name.trim() === ""} onClick={() => void submit()}>
            <i className="ti ti-device-floppy" />
            {s.ldSaveBtn}
          </button>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Segments pane — card grid + rule-builder drawer + contacts drawer
// ════════════════════════════════════════════════════════════════
type SegmentDrawerState = { mode: "create" } | { mode: "edit"; row: CrmSegment } | null;
const SEGMENT_ICONS = ["ti-filter", "ti-crown", "ti-clock-pause", "ti-heart", "ti-repeat", "ti-building"] as const;

export function SegmentsPane({ token, lang, registerAction, showToast }: PaneProps) {
  const s = crmStrings(lang);
  const { user } = useAdminAuth();
  const [segments, setSegments] = useState<CrmSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<SegmentDrawerState>(null);
  const [contactsFor, setContactsFor] = useState<CrmSegment | null>(null);

  // Server gate: segment writes need canManageCompany (owner/manager) or
  // platform staff — mirror it so plain employees see a view-only grid.
  const canWrite = useMemo(() => {
    if (!user) return false;
    if (user.is_super_admin || canAccessPlatformAdminNav(user)) return true;
    return (user.roles ?? []).some((r) => r === "company_admin" || r === "company_manager");
  }, [user]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiCrmSegments(token);
      setSegments(res.data);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!canWrite) {
      registerAction(null);
      return () => registerAction(null);
    }
    registerAction(
      <button className="btn btn-primary" onClick={() => setDrawer({ mode: "create" })}>
        <i className="ti ti-plus" />
        {s.actNewSegment}
      </button>
    );
    return () => registerAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, canWrite]);

  async function remove(seg: CrmSegment) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.confirmDeleteSegment)) return;
    try {
      await apiDeleteCrmSegment(token, seg.id);
      showToast(s.sgDeletedToast);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }

  function ruleSummary(seg: CrmSegment): string {
    if (seg.description) return seg.description;
    const r = seg.rules ?? {};
    const parts: string[] = [];
    if (r.min_bookings) parts.push(`${s.sgRuleMinBookings} ${r.min_bookings}`);
    if (r.min_total_spent) parts.push(`${s.sgRuleMinSpent} ${r.min_total_spent}`);
    if (r.inactive_months) parts.push(s.sgRuleInactive.replace("…", String(r.inactive_months)));
    if (r.active_months) parts.push(s.sgRuleActive.replace("…", String(r.active_months)));
    return parts.length > 0 ? parts.join(" · ") : "—";
  }

  return (
    <div>
      {err ? <div className="card" style={{ padding: 16, color: "var(--danger)" }}>{err}</div> : null}

      {loading && segments.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: "center" }} >
          <span className="cell-muted">{s.loading}</span>
        </div>
      ) : segments.length === 0 && !canWrite ? (
        <div className="empty-state">
          <div className="es-icon"><i className="ti ti-chart-dots" /></div>
          <div className="es-title">{s.pgSegments}</div>
          <div className="es-sub">{s.sgEmpty}</div>
        </div>
      ) : (
        <div className="seg-grid">
          {segments.map((seg) => (
            <div className="seg-card" key={seg.id}>
              <div className="seg-top">
                <div className="seg-ico"><i className={`ti ${seg.icon || "ti-filter"}`} /></div>
                <span className={`badge ${seg.type === "dynamic" ? "badge-success" : "badge-gray"}`}>
                  {seg.type === "dynamic" ? s.sgTypeDynamic : s.sgTypeStatic}
                </span>
              </div>
              <div className="seg-name">{seg.name}</div>
              <div className="seg-desc">{ruleSummary(seg)}</div>
              <div className="seg-foot">
                <div className="seg-count">
                  {seg.contacts_count} <small>{s.sgContacts}</small>
                </div>
                <div className="row-actions">
                  <button className="btn btn-sm" onClick={() => setContactsFor(seg)}>
                    <i className="ti ti-users" />
                    {s.sgViewContacts}
                  </button>
                  {canWrite ? (
                    <>
                      <button className="icon-btn" title={s.edit} onClick={() => setDrawer({ mode: "edit", row: seg })}>
                        <i className="ti ti-pencil" />
                      </button>
                      <button className="icon-btn danger" title={s.delete} onClick={() => void remove(seg)}>
                        <i className="ti ti-trash" />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {canWrite ? (
            <div className="seg-card seg-new" onClick={() => setDrawer({ mode: "create" })}>
              <i className="ti ti-plus" />
              <div className="seg-name">{s.sgNewCardTitle}</div>
              <div style={{ fontSize: 12 }}>{s.sgNewCardSub}</div>
            </div>
          ) : null}
        </div>
      )}

      <SegmentDrawer
        state={drawer}
        lang={lang}
        token={token}
        onClose={() => setDrawer(null)}
        onSaved={() => { setDrawer(null); showToast(s.sgSavedToast); void load(); }}
      />
      <SegmentContactsDrawer
        segment={contactsFor}
        lang={lang}
        token={token}
        canWrite={canWrite}
        onClose={() => setContactsFor(null)}
        onChanged={() => void load()}
        showToast={showToast}
      />
    </div>
  );
}

function SegmentDrawer({
  state,
  lang,
  token,
  onClose,
  onSaved,
}: {
  state: SegmentDrawerState;
  lang: string;
  token: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const s = crmStrings(lang);
  const isEdit = state?.mode === "edit";
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<CrmSegmentType>("dynamic");
  const [icon, setIcon] = useState<string>("ti-filter");
  const [minBookings, setMinBookings] = useState("");
  const [minSpent, setMinSpent] = useState("");
  const [inactiveMonths, setInactiveMonths] = useState("");
  const [activeMonths, setActiveMonths] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      setName(state.row.name);
      setDesc(state.row.description ?? "");
      setType(state.row.type);
      setIcon(state.row.icon || "ti-filter");
      const r = state.row.rules ?? {};
      setMinBookings(r.min_bookings != null ? String(r.min_bookings) : "");
      setMinSpent(r.min_total_spent != null ? String(r.min_total_spent) : "");
      setInactiveMonths(r.inactive_months != null ? String(r.inactive_months) : "");
      setActiveMonths(r.active_months != null ? String(r.active_months) : "");
    } else {
      setName(""); setDesc(""); setType("dynamic"); setIcon("ti-filter");
      setMinBookings(""); setMinSpent(""); setInactiveMonths(""); setActiveMonths("");
    }
  }, [state]);

  async function submit() {
    if (!token || !state) return;
    setBusy(true);
    try {
      const rules: CrmSegmentRules = {};
      if (type === "dynamic") {
        if (minBookings.trim()) rules.min_bookings = Number(minBookings);
        if (minSpent.trim()) rules.min_total_spent = Number(minSpent);
        if (inactiveMonths.trim()) rules.inactive_months = Number(inactiveMonths);
        if (activeMonths.trim()) rules.active_months = Number(activeMonths);
      }
      const body = {
        name: name.trim(),
        description: desc.trim() || null,
        type,
        icon,
        rules: type === "dynamic" ? rules : null,
      };
      if (state.mode === "edit") {
        await apiUpdateCrmSegment(token, state.row.id, body);
      } else {
        await apiCreateCrmSegment(token, body);
      }
      onSaved();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`drawer-overlay ${state ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${state ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div className="card-title">{isEdit ? s.sgDrawerEditTitle : s.sgDrawerNewTitle}</div>
            <div className="card-subtitle">{s.sgDrawerSubtitle}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          <div className="fld mb-3">
            <span className="fld-label">{s.sgFldName}</span>
            <input value={name} placeholder={s.sgFldNamePh} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fld mb-3">
            <span className="fld-label">{s.sgFldDesc}</span>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="form-grid-2">
            <div className="fld">
              <span className="fld-label">{s.sgFldType}</span>
              <select value={type} onChange={(e) => setType(e.target.value as CrmSegmentType)}>
                <option value="dynamic">{s.sgTypeDynamic}</option>
                <option value="static">{s.sgTypeStatic}</option>
              </select>
            </div>
            <div className="fld">
              <span className="fld-label">{s.sgFldIcon}</span>
              <select value={icon} onChange={(e) => setIcon(e.target.value)}>
                {SEGMENT_ICONS.map((ic) => (
                  <option key={ic} value={ic}>{ic.replace("ti-", "")}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="fld-hint" style={{ marginTop: 8 }}>
            {type === "dynamic" ? s.sgTypeDynamicHint : s.sgTypeStaticHint}
          </div>
          {type === "dynamic" ? (
            <>
              <div className="drawer-section" style={{ marginTop: 14 }}>{s.sgRulesTitle}</div>
              <div className="form-grid-2">
                <div className="fld">
                  <span className="fld-label">{s.sgRuleMinBookings}</span>
                  <input type="number" min={1} value={minBookings} onChange={(e) => setMinBookings(e.target.value)} />
                </div>
                <div className="fld">
                  <span className="fld-label">{s.sgRuleMinSpent}</span>
                  <input type="number" min={0} value={minSpent} onChange={(e) => setMinSpent(e.target.value)} />
                </div>
                <div className="fld">
                  <span className="fld-label">{s.sgRuleInactive}</span>
                  <input type="number" min={1} value={inactiveMonths} onChange={(e) => setInactiveMonths(e.target.value)} />
                </div>
                <div className="fld">
                  <span className="fld-label">{s.sgRuleActive}</span>
                  <input type="number" min={1} value={activeMonths} onChange={(e) => setActiveMonths(e.target.value)} />
                </div>
              </div>
            </>
          ) : null}
        </div>
        <div className="drawer-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy || name.trim() === ""} onClick={() => void submit()}>
            <i className="ti ti-device-floppy" />
            {s.sgSaveBtn}
          </button>
        </div>
      </div>
    </>
  );
}

function SegmentContactsDrawer({
  segment,
  lang,
  token,
  canWrite,
  onClose,
  onChanged,
  showToast,
}: {
  segment: CrmSegment | null;
  lang: string;
  token: string | null;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
  showToast: (msg: string) => void;
}) {
  const s = crmStrings(lang);
  const [rows, setRows] = useState<CrmSegmentContact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [suggestions, setSuggestions] = useState<CustomerRow[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Out-of-order guards: a late response from the PREVIOUS segment must not
  // overwrite the current one (the remove button acts on what is rendered,
  // so stale rows would mutate the wrong segment).
  const reqRef = useRef(0);
  const sugReqRef = useRef(0);
  const PER_PAGE = 25;
  const isStatic = segment?.type === "static";

  const load = useCallback(async () => {
    if (!token || !segment) return;
    const reqId = ++reqRef.current;
    setLoading(true);
    try {
      const res = await apiCrmSegmentContacts(token, segment.id, { page, per_page: PER_PAGE });
      if (reqRef.current !== reqId) return;
      setRows(res.data);
      setTotal(res.meta.total ?? res.data.length);
    } catch {
      if (reqRef.current === reqId) {
        setRows([]);
        setTotal(0);
      }
    } finally {
      if (reqRef.current === reqId) setLoading(false);
    }
  }, [token, segment, page]);
  useEffect(() => {
    setPage(1);
    setRows([]);
    setTotal(0);
    setMemberSearch("");
    setSuggestions([]);
  }, [segment?.id]);
  useEffect(() => { void load(); }, [load]);

  // Debounced customer search for the static-segment "add member" box.
  useEffect(() => {
    const sugId = ++sugReqRef.current; // invalidate any in-flight search
    if (!token || !isStatic || !canWrite) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const term = memberSearch.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(() => {
      apiCrmCustomers(token, { search: term, per_page: 5 })
        .then((res) => { if (sugReqRef.current === sugId) setSuggestions(res.data); })
        .catch(() => { if (sugReqRef.current === sugId) setSuggestions([]); });
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [memberSearch, token, isStatic, canWrite]);

  async function addMember(u: CustomerRow) {
    if (!token || !segment) return;
    try {
      await apiAddCrmSegmentMember(token, segment.id, u.id);
      showToast(s.sgMemberAddedToast);
      setMemberSearch("");
      setSuggestions([]);
      await load();
      onChanged();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }

  async function removeMember(c: CrmSegmentContact) {
    if (!token || !segment) return;
    try {
      await apiRemoveCrmSegmentMember(token, segment.id, c.id);
      showToast(s.sgMemberRemovedToast);
      await load();
      onChanged();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <div className={`drawer-overlay ${segment ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${segment ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div className="card-title">{segment?.name ?? s.sgContactsTitle}</div>
            <div className="card-subtitle">{s.sgContactsTitle}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          {isStatic && canWrite ? (
            <div className="fld mb-3">
              <span className="fld-label">{s.sgAddBtn}</span>
              <input
                type="search"
                placeholder={s.sgAddMemberPh}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
              {suggestions.length > 0 ? (
                <div className="card" style={{ marginTop: 6, padding: 6 }}>
                  {suggestions.map((u) => (
                    <div
                      key={u.id}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", gap: 8 }}
                    >
                      <span style={{ fontSize: 13 }}>
                        <span className="font-semibold">{u.name}</span>{" "}
                        <span className="cell-muted">{u.email}</span>
                      </span>
                      <button className="btn btn-sm" onClick={() => void addMember(u)}>
                        <i className="ti ti-plus" />
                        {s.sgAddBtn}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{s.sgColCustomer}</th>
                  <th>{s.sgColBookings}</th>
                  {isStatic && canWrite ? <th style={{ textAlign: "right" }}>{s.colActions}</th> : null}
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr><td colSpan={3} className="cell-muted" style={{ textAlign: "center", padding: 20 }}>{s.loading}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={3} className="cell-muted" style={{ textAlign: "center", padding: 20 }}>{s.sgNoContacts}</td></tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="flex items-center gap-2">
                          <span className={`avatar sm ${avatarTone(c.id)}`}>{initials(c.name)}</span>
                          <span>
                            <span style={{ display: "block", fontSize: 13 }}>{c.name}</span>
                            <span className="cell-muted" style={{ fontSize: 12 }}>{c.email ?? "—"}</span>
                          </span>
                        </span>
                      </td>
                      <td className="num-cell">{c.bookings_count}</td>
                      {isStatic && canWrite ? (
                        <td style={{ textAlign: "right" }}>
                          <button className="icon-btn danger" title={s.sgRemoveBtn} onClick={() => void removeMember(c)}>
                            <i className="ti ti-x" />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {total > PER_PAGE ? (
            <div className="pagination">
              <span className="pagination-info">{`${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} / ${total}`}</span>
              <div className="pagination-controls">
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{s.prev}</button>
                <button className="btn btn-sm" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>{s.next}</button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="drawer-footer">
          <button className="btn" onClick={onClose}>{s.close}</button>
        </div>
      </div>
    </>
  );
}
