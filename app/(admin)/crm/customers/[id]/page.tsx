"use client";

/**
 * CRM → Customer card (per-customer detail).
 *
 * Tabs mirror docs/admin_designe/new-admin-designe/files/crm.html contact
 * drawer + Arshak's spec: Overview / Bookings / Communication / Notes /
 * Loyalty. Overview + Bookings are data-backed today (reuse the platform
 * user-detail + bookings endpoints); Communication / Notes / Loyalty land as
 * their backends ship. A "customer" is a user, so we read the same
 * PlatformAdminUserDetail the Directory uses.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useDocumentTitle } from "@/lib/use-document-title";
import { canAccessCrmSection } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiShowPlatformUser,
  type PlatformAdminUserDetail,
} from "@/lib/platform-admin-api";
import { apiBookings, type BookingRow } from "@/lib/bookings-api";
import { apiCrmActivities, type CrmActivity } from "@/lib/crm-api";
import {
  STATUS_BADGE_CLASS,
  avatarInitials,
  avatarStyle,
  formatRelativeTime,
  pickAvatarTone,
  statusBadgeStyle,
  type StatusTone,
} from "@/lib/admin-v2-helpers";
import { PageHeader, V2Card, V2CardHeader, V2CardBody, EmptyState } from "@/components/ui/v2";
import { ArrowLeft, MessageSquare, StickyNote, Award, CalendarDays } from "lucide-react";

type TabKey = "overview" | "bookings" | "communication" | "notes" | "loyalty";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "bookings", label: "Bookings" },
  { key: "communication", label: "Communication" },
  { key: "notes", label: "Notes" },
  { key: "loyalty", label: "Loyalty" },
];

function statusTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case "active":
      return "success";
    case "pending":
      return "warning";
    case "suspended":
      return "danger";
    default:
      return "gray";
  }
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="grid grid-cols-[140px_1fr] gap-3 border-b border-dashed py-2 last:border-0"
      style={{ borderColor: "var(--admin-border)" }}
    >
      <span className="text-[12px] font-medium" style={{ color: "var(--admin-text-secondary)" }}>{label}</span>
      <span className="text-[13px]" style={{ color: "var(--admin-text-primary)" }}>{value ?? "—"}</span>
    </div>
  );
}

export default function CrmCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const customerId = Number(params?.id);
  const { token, user: me } = useAdminAuth();
  const allowed = canAccessCrmSection(me);
  useDocumentTitle("CRM — Customer");

  const [data, setData] = useState<PlatformAdminUserDetail | null>(null);
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [activities, setActivities] = useState<CrmActivity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(customerId)) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiShowPlatformUser(token, customerId);
      setData(res.data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof Error ? e.message : "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }, [token, customerId]);

  const loadBookings = useCallback(async () => {
    if (!token || !Number.isFinite(customerId)) return;
    try {
      const res = await apiBookings(token, { user_id: customerId, per_page: 10 });
      setBookings(res.data);
    } catch {
      setBookings([]);
    }
  }, [token, customerId]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const loadActivities = useCallback(async () => {
    if (!token || !Number.isFinite(customerId)) return;
    try {
      const res = await apiCrmActivities(token, { subject_type: "customer", subject_id: customerId, per_page: 50 });
      setActivities(res.data);
    } catch {
      setActivities([]);
    }
  }, [token, customerId]);

  useEffect(() => {
    if (allowed && tab === "bookings" && bookings === null) void loadBookings();
  }, [allowed, tab, bookings, loadBookings]);

  useEffect(() => {
    if (allowed && tab === "communication" && activities === null) void loadActivities();
  }, [allowed, tab, activities, loadActivities]);

  if (!allowed || forbidden) return <ForbiddenNotice />;

  const tone = pickAvatarTone(customerId);
  const title = data?.name || (loading ? "Loading…" : "Customer");

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "CRM", href: "/crm/pipeline" },
          { label: "Customers", href: "/crm/customers" },
          { label: title },
        ]}
        title={
          <span className="flex items-center gap-3">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-semibold"
              style={avatarStyle(tone)}
            >
              {avatarInitials(data?.name)}
            </span>
            {title}
          </span>
        }
        subtitle={data?.email}
        actions={
          <Link
            href="/crm/customers"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-[14px] text-[13px] font-medium"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      {err ? (
        <V2Card className="mb-4">
          <div className="p-4 text-[13px]" style={{ color: "var(--admin-danger)" }}>{err}</div>
        </V2Card>
      ) : null}

      {/* In-page tab strip */}
      <div
        className="mb-5 flex flex-wrap gap-1 overflow-x-auto border-b"
        style={{ borderColor: "var(--admin-border)" }}
        role="tablist"
      >
        {TABS.map((tDef) => {
          const isActive = tab === tDef.key;
          return (
            <button
              key={tDef.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(tDef.key)}
              className="-mb-px inline-flex h-[38px] items-center whitespace-nowrap border-b-2 px-[14px] text-[13px] font-medium transition"
              style={{
                color: isActive ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                borderBottomColor: isActive ? "var(--admin-primary)" : "transparent",
              }}
            >
              {tDef.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        <V2Card>
          <V2CardHeader title="Customer details" />
          <V2CardBody>
            {data ? (
              <div>
                <InfoRow label="Name" value={data.name} />
                <InfoRow label="Email" value={data.email} />
                <InfoRow label="Phone" value={data.phone} />
                <InfoRow
                  label="Status"
                  value={
                    <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusTone(data.status))}>
                      {data.status || "—"}
                    </span>
                  }
                />
                <InfoRow label="Nationality" value={data.nationality} />
                <InfoRow label="Language" value={data.preferred_language} />
                <InfoRow label="Total bookings" value={data.bookings_count} />
                <InfoRow label="Joined" value={formatRelativeTime(data.created_at)} />
                <InfoRow label="Last login" value={formatRelativeTime(data.last_login_at)} />
              </div>
            ) : (
              <p className="text-[13px]" style={{ color: "var(--admin-text-secondary)" }}>
                {loading ? "Loading…" : "No data."}
              </p>
            )}
          </V2CardBody>
        </V2Card>
      ) : null}

      {tab === "bookings" ? (
        <V2Card>
          <V2CardHeader title="Recent bookings" />
          {bookings && bookings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead style={{ backgroundColor: "var(--admin-bg-secondary)" }}>
                  <tr>
                    {["Reference", "Service", "Status", "Amount", "Date"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]"
                        style={{ color: "var(--admin-text-secondary)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                      <td className="px-4 py-2.5 font-medium">
                        {b.order_number || b.booking_reference || `#${b.id}`}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--admin-text-secondary)" }}>
                        {b.offer?.type || b.items?.[0]?.module_type || "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={STATUS_BADGE_CLASS} style={statusBadgeStyle(statusTone(b.status))}>
                          {b.status || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {(() => {
                          const amount = b.total ?? b.total_amount;
                          return amount != null ? `${amount} ${b.currency ?? ""}`.trim() : "—";
                        })()}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--admin-text-secondary)" }}>
                        {formatRelativeTime(b.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <V2CardBody>
              <EmptyState
                icon={<CalendarDays className="h-10 w-10" />}
                title={bookings === null ? "Loading…" : "No bookings yet"}
                subtitle="This customer has no bookings on record."
              />
            </V2CardBody>
          )}
        </V2Card>
      ) : null}

      {tab === "communication" ? (
        <V2Card>
          <V2CardHeader title="Communication log" subtitle="Calls, emails, meetings and notes with this customer" />
          {activities && activities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead style={{ backgroundColor: "var(--admin-bg-secondary)" }}>
                  <tr>
                    {["Type", "Subject", "Owner", "When"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px]"
                        style={{ color: "var(--admin-text-secondary)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a) => (
                    <tr key={a.id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                      <td className="px-4 py-2.5" style={{ color: "var(--admin-text-secondary)" }}>{a.type}</td>
                      <td className="px-4 py-2.5 font-medium">{a.subject}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--admin-text-secondary)" }}>{a.owner?.name ?? "—"}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--admin-text-secondary)" }}>{formatRelativeTime(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <V2CardBody>
              <EmptyState
                icon={<MessageSquare className="h-10 w-10" />}
                title={activities === null ? "Loading…" : "No communication yet"}
                subtitle="Logged calls, emails and meetings with this customer will appear here."
              />
            </V2CardBody>
          )}
        </V2Card>
      ) : null}

      {tab === "notes" ? (
        <EmptyState
          icon={<StickyNote className="h-10 w-10" />}
          title="Notes — in build"
          subtitle="Internal team notes about this customer are being built."
        />
      ) : null}

      {tab === "loyalty" ? (
        <EmptyState
          icon={<Award className="h-10 w-10" />}
          title="Loyalty — in build"
          subtitle="Loyalty tier and points will appear here once the loyalty program is wired in."
        />
      ) : null}
    </div>
  );
}
