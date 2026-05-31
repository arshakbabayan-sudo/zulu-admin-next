"use client";

/**
 * Phase 7.13 — Non-service hours (time-off requests + clock-in/out).
 *
 * Two sibling surfaces on one page:
 *   - Top section: live clock-in/out punch tracking (shift attendance)
 *   - Bottom section: planned absences (time-off request workflow)
 *
 * Both feed payroll roll-ups in Phase 7.15.
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessOperatorToolsNav } from "@/lib/access";
import { ApiRequestError, apiFetchJson } from "@/lib/api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "@/lib/api-envelope";
import { exportRowsAsCsv } from "@/lib/export-csv";
import { formatDate } from "@/lib/format";
import {
  Button,
  FormField,
  Input,

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
  SectionTabs,
  V2Button,
  IconButton,
} from "@/components/ui/v2";
import { Download, Check, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const TYPES = ["vacation", "sick", "personal", "unpaid", "other"] as const;
const STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
type Type = (typeof TYPES)[number];
type Status = (typeof STATUSES)[number];

type TimeOffRow = {
  id: number;
  company_id: number;
  company_name: string | null;
  user: { id: number; name: string; email: string } | null;
  type: Type;
  starts_on: string | null;
  ends_on: string | null;
  hours_total: number | null;
  notes: string | null;
  status: Status;
  decided_by: { id: number; name: string } | null;
  decided_at: string | null;
  decision_notes: string | null;
  created_at: string | null;
};

function statusBadgeStyle(s: Status): React.CSSProperties {
  switch (s) {
    case "pending":
      return { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" };
    case "approved":
      return { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" };
    case "rejected":
      return { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" };
    case "cancelled":
    default:
      return { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" };
  }
}

async function fetchTimeOff(
  token: string,
  page: number,
  statusFilter: Status | ""
): Promise<ApiSuccessEnvelope<TimeOffRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", "50");
  if (statusFilter) q.set("status", statusFilter);
  return apiFetchJson(`/time-off?${q.toString()}`, { method: "GET", token });
}

type TimePunchRow = {
  id: number;
  user: { id: number; name: string; email: string } | null;
  punched_in_at: string | null;
  punched_out_at: string | null;
  minutes_worked: number | null;
  is_open: boolean;
  source: string;
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number | null, openSinceIso: string | null): string {
  if (minutes !== null) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  }
  if (openSinceIso) {
    const open = new Date(openSinceIso);
    const diff = Math.max(0, Math.floor((Date.now() - open.getTime()) / 60000));
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m.toString().padStart(2, "0")}m (open)`;
  }
  return "—";
}

export default function Bucket3NonServiceHoursPage() {
  const { token, user } = useAdminAuth();
  const confirm = useConfirm();
  const { t, lang } = useLanguage();
  const allowed = canAccessOperatorToolsNav(user);
  const [rows, setRows] = useState<TimeOffRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    type: "vacation" as Type,
    starts_on: "",
    ends_on: "",
    hours_total: "",
    notes: "",
  });

  const [punches, setPunches] = useState<TimePunchRow[]>([]);
  const [myOpen, setMyOpen] = useState<TimePunchRow | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await fetchTimeOff(token, page, statusFilter);
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load time-off records");
    }
  }, [token, allowed, page, statusFilter]);

  const loadPunches = useCallback(async () => {
    if (!token || !allowed) return;
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const q = new URLSearchParams();
      q.set("per_page", "50");
      q.set("date_from", todayStart.toISOString());
      const res = await apiFetchJson<ApiSuccessEnvelope<TimePunchRow[]>>(
        `/time-punches?${q.toString()}`,
        { method: "GET", token }
      );
      setPunches(res.data);
      const myUserId = user?.id;
      const open = res.data.find((p) => p.is_open && p.user?.id === myUserId) ?? null;
      setMyOpen(open);
    } catch (e) {
      if (!(e instanceof ApiRequestError && e.status === 403)) {
        // Surface the error but don't kill the page — the time-off block is
        // independent.
        setErr(e instanceof ApiRequestError ? e.message : "Failed to load punches");
      }
    }
  }, [token, allowed, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadPunches();
  }, [loadPunches]);

  async function clockIn() {
    if (!token) return;
    setErr(null);
    setBusy(true);
    try {
      await apiFetchJson(`/time-punches/clock-in`, { method: "POST", token });
      await loadPunches();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Clock in failed");
    } finally {
      setBusy(false);
    }
  }

  async function clockOut(id: number) {
    if (!token) return;
    setErr(null);
    setBusy(true);
    try {
      await apiFetchJson(`/time-punches/${id}/clock-out`, { method: "POST", token });
      await loadPunches();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Clock out failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!token) return;
    setErr(null);
    if (!form.starts_on || !form.ends_on) {
      setErr(t("admin.bucket3.non_service_hours.error.dates_required"));
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        type: form.type,
        starts_on: form.starts_on,
        ends_on: form.ends_on,
        notes: form.notes.trim() || null,
      };
      if (form.user_id.trim()) body.user_id = Number(form.user_id);
      if (form.hours_total.trim()) body.hours_total = Number(form.hours_total);
      await apiFetchJson(`/time-off`, { method: "POST", token, body });
      setForm({ user_id: "", type: "vacation", starts_on: "", ends_on: "", hours_total: "", notes: "" });
      await load();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: number, status: "approved" | "rejected" | "cancelled") {
    if (!token) return;
    const messageKey =
      status === "approved"
        ? "admin.bucket3.non_service_hours.confirm_approve"
        : status === "rejected"
        ? "admin.bucket3.non_service_hours.confirm_reject"
        : "admin.bucket3.non_service_hours.confirm_cancel";
    const ok = await confirm({ messageKey });
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetchJson(`/time-off/${id}/decide`, {
        method: "PATCH",
        token,
        body: { status },
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Decision failed");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.bucket3.non_service_hours.title")}</h1>
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
          { label: "My company", href: "/bucket3/employees" },
          { label: t("admin.bucket3.non_service_hours.title") },
        ]}
        title={t("admin.bucket3.non_service_hours.title")}
        subtitle={t("admin.bucket3.non_service_hours.subtitle")}
        actions={
          <>
            <V2Button
              icon={<Download className="h-4 w-4" />}
              disabled={rows.length === 0}
              onClick={() =>
                exportRowsAsCsv("non-service-hours", rows, [
                  ["id", (r) => r.id],
                  ["company_name", (r) => r.company_name ?? ""],
                  ["user_name", (r) => r.user?.name ?? ""],
                  ["user_email", (r) => r.user?.email ?? ""],
                  ["type", (r) => r.type],
                  ["starts_on", (r) => r.starts_on ?? ""],
                  ["ends_on", (r) => r.ends_on ?? ""],
                  ["hours_total", (r) => r.hours_total ?? ""],
                  ["status", (r) => r.status],
                  ["decided_by", (r) => r.decided_by?.name ?? ""],
                  ["decided_at", (r) => r.decided_at ?? ""],
                  ["notes", (r) => r.notes ?? ""],
                ])
              }
            >
              Export
            </V2Button>
            {/* Phase 2C step 8 (2026-05-31) — "Add request" placeholder
                removed; real time-off request creation is the inline form
                below. */}
          </>
        }
      />

      {/* Phase 4E (2026-05-31) — HR group strip. Replaces the prior
          My-company strip. */}
      <SectionTabs
        activeHref="/bucket3/non-service-hours"
        items={[
          { href: "/bucket3/non-service-hours", label: "Non-service hours" },
          { href: "/bucket3/payroll", label: "Payroll" },
        ]}
      />

      <div className="space-y-6">
      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <section className="admin-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold">{t("admin.bucket3.non_service_hours.todays_shifts")}</h2>
            <p className="text-xs text-fg-t6">
              {t("admin.bucket3.non_service_hours.todays_shifts_helper")}
            </p>
          </div>
          {myOpen ? (
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void clockOut(myOpen.id)}>
              {busy ? "…" : t("admin.bucket3.non_service_hours.clock_out_open").replace("{time}", formatTime(myOpen.punched_in_at))}
            </Button>
          ) : (
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void clockIn()}>
              {busy ? "…" : t("admin.bucket3.non_service_hours.clock_in")}
            </Button>
          )}
        </div>

        <Table>
          <THead>
            <TR>
              <TH>{t("admin.bucket3.non_service_hours.col.employee")}</TH>
              <TH>{t("admin.bucket3.non_service_hours.col.in")}</TH>
              <TH>{t("admin.bucket3.non_service_hours.col.out")}</TH>
              <TH>{t("admin.bucket3.non_service_hours.col.duration")}</TH>
              <TH align="right">{t("admin.bucket3.non_service_hours.col.actions")}</TH>
            </TR>
          </THead>
          <TBody>
            {punches.length === 0 ? <TEmpty colSpan={5}>{t("admin.bucket3.non_service_hours.empty_shifts")}</TEmpty> : null}
            {punches.map((p) => {
              const name = p.user?.name ?? "—";
              const tone = pickAvatarTone(p.id);
              return (
              <TR key={p.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={avatarStyle(tone)}
                      aria-hidden
                    >
                      {getInitials(name)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-fg-t8 truncate">{name}</div>
                      <div className="text-[11px] text-fg-t6 truncate">{p.user?.email ?? ""}</div>
                    </div>
                  </div>
                </TD>
                <TD className="text-xs tabular-nums">{formatTime(p.punched_in_at)}</TD>
                <TD className="text-xs tabular-nums">
                  {p.is_open ? <span className="text-success-700">{t("admin.bucket3.non_service_hours.on_the_clock")}</span> : formatTime(p.punched_out_at)}
                </TD>
                <TD className="text-xs tabular-nums">{formatDuration(p.minutes_worked, p.is_open ? p.punched_in_at : null)}</TD>
                <TD align="right">
                  {p.is_open && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void clockOut(p.id)}>
                      {t("admin.bucket3.non_service_hours.clock_out")}
                    </Button>
                  )}
                </TD>
              </TR>
              );
            })}
          </TBody>
        </Table>
      </section>

      <section className="admin-card p-4 space-y-3">
        <h2 className="text-base font-semibold">{t("admin.bucket3.non_service_hours.request_time_off")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={t("admin.bucket3.non_service_hours.field.user_id")} htmlFor="to-user" helperText={t("admin.bucket3.non_service_hours.field.user_id_helper")}>
            <Input
              id="to-user"
              type="number"
              min={1}
              value={form.user_id}
              onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.bucket3.non_service_hours.field.type")} htmlFor="to-type" required>
            <Select
              id="to-type"
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as Type }))}
            >
              {TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {ty}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("admin.bucket3.non_service_hours.field.hours_total")} htmlFor="to-hours">
            <Input
              id="to-hours"
              type="number"
              step="0.01"
              min="0"
              value={form.hours_total}
              onChange={(e) => setForm((p) => ({ ...p, hours_total: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.bucket3.non_service_hours.field.starts")} htmlFor="to-starts" required>
            <Input
              id="to-starts"
              type="date"
              value={form.starts_on}
              onChange={(e) => setForm((p) => ({ ...p, starts_on: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.bucket3.non_service_hours.field.ends")} htmlFor="to-ends" required>
            <Input
              id="to-ends"
              type="date"
              value={form.ends_on}
              onChange={(e) => setForm((p) => ({ ...p, ends_on: e.target.value }))}
            />
          </FormField>
          <FormField label={t("admin.bucket3.non_service_hours.field.notes")} htmlFor="to-notes" className="sm:col-span-2 lg:col-span-3">
            <Input
              as="textarea"
              id="to-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </FormField>
        </div>
        <div>
          <Button size="sm" disabled={busy} onClick={() => void handleCreate()}>
            {busy ? t("admin.bucket3.non_service_hours.submitting") : t("admin.bucket3.non_service_hours.submit_request")}
          </Button>
        </div>
      </section>

      <div className="admin-card p-4">
        <label className="flex items-center gap-2 text-sm text-fg-t6">
          <span className="font-medium text-fg-t7">{t("admin.bucket3.non_service_hours.filter.status")}</span>
          <Select
            fieldSize="sm"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as Status | "");
            }}
            className="!w-auto min-w-[140px]"
          >
            <option value="">{t("common.all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>#</TH>
            <TH>{t("admin.bucket3.non_service_hours.col.employee")}</TH>
            <TH>{t("admin.bucket3.non_service_hours.col.type")}</TH>
            <TH>{t("admin.bucket3.non_service_hours.col.from")}</TH>
            <TH>{t("admin.bucket3.non_service_hours.col.to")}</TH>
            <TH>{t("admin.bucket3.non_service_hours.col.hours")}</TH>
            <TH>{t("admin.bucket3.non_service_hours.col.status")}</TH>
            <TH align="right">{t("admin.bucket3.non_service_hours.col.actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={8}>{t("admin.bucket3.non_service_hours.empty_records")}</TEmpty>
          ) : null}
          {rows.map((r) => {
            const name = r.user?.name ?? "—";
            const tone = pickAvatarTone(r.id);
            return (
            <TR key={r.id}>
              <TD className="tabular-nums text-fg-t7 font-mono text-xs">#{r.id}</TD>
              <TD>
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={avatarStyle(tone)}
                    aria-hidden
                  >
                    {getInitials(name)}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-fg-t8 truncate">{name}</div>
                    <div className="text-[11px] text-fg-t6 truncate">{r.user?.email ?? ""}</div>
                  </div>
                </div>
              </TD>
              <TD>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                >
                  {r.type}
                </span>
              </TD>
              <TD className="text-xs">{formatDate(r.starts_on, lang)}</TD>
              <TD className="text-xs">{formatDate(r.ends_on, lang)}</TD>
              <TD className="tabular-nums text-xs">{r.hours_total ?? "—"}</TD>
              <TD>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={statusBadgeStyle(r.status)}
                >
                  {r.status}
                </span>
              </TD>
              <TD align="right">
                {r.status === "pending" ? (
                  <div className="flex justify-end gap-1">
                    <IconButton
                      onClick={() => void decide(r.id, "approved")}
                      aria-label="Approve"
                      disabled={busy}
                    >
                      <Check className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      onClick={() => void decide(r.id, "rejected")}
                      aria-label="Reject"
                      disabled={busy}
                    >
                      <X className="h-4 w-4" />
                    </IconButton>
                  </div>
                ) : (
                  <span className="text-xs text-fg-t6">—</span>
                )}
              </TD>
            </TR>
            );
          })}
        </TBody>
      </Table>

      {meta && meta.last_page > 1 && (
        <Pagination
          page={meta.current_page}
          lastPage={meta.last_page}
          onPage={(p) => setPage(p)}
        />
      )}
      </div>
    </div>
  );
}

// v2 admin-redesign helpers — avatar tone + initials.
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
